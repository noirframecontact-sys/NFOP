"use strict";

/*
=========================================
NOIRFRAME — Calendar Physics Engine (CPE)
Resource-first scheduling physics (pure logic)
=========================================
Advisory only. Never mutates projects or storage.
*/

const CPE_RESOURCE_TYPES = Object.freeze({
  PHOTOGRAPHER: "photographer",
  VEHICLE: "vehicle",
  EQUIPMENT: "equipment"
});

const CPE_SEVERITY = Object.freeze({
  HARD: "hard",
  SOFT: "soft",
  INFO: "info"
});

const CPE_REASON_CODES = Object.freeze({
  RESOURCE_OVERLAP: "RESOURCE_OVERLAP",
  INSUFFICIENT_CAPACITY: "INSUFFICIENT_CAPACITY",
  TRAVEL_BUFFER_COLLISION: "TRAVEL_BUFFER_COLLISION",
  TIGHT_TURNAROUND: "TIGHT_TURNAROUND",
  MISSING_TIME_INPUT: "MISSING_TIME_INPUT",
  MISSING_DURATION_INPUT: "MISSING_DURATION_INPUT",
  DEFAULT_DURATION_ASSUMED: "DEFAULT_DURATION_ASSUMED",
  DEFAULT_TRAVEL_ASSUMED: "DEFAULT_TRAVEL_ASSUMED",
  CAPABILITY_MISMATCH: "CAPABILITY_MISMATCH",
  NO_EVENT_ANCHOR: "NO_EVENT_ANCHOR",
  SLOT_AVAILABLE: "SLOT_AVAILABLE",
  SLOT_MARGINAL: "SLOT_MARGINAL",
  DAY_CAPACITY_EXHAUSTED: "DAY_CAPACITY_EXHAUSTED",
  DAY_CAPACITY_FREE: "DAY_CAPACITY_FREE",
  PHOTOGRAPHER_B_REQUIRED: "PHOTOGRAPHER_B_REQUIRED",
  PHOTOGRAPHER_B_UNAVAILABLE: "PHOTOGRAPHER_B_UNAVAILABLE"
});

const CPE_CAPACITY_MODES = Object.freeze({
  RESOURCE: "resource",
  HUMAN_DAY: "human-day"
});

const CPE_DEFAULT_CAPACITY = Object.freeze({
  mode: CPE_CAPACITY_MODES.HUMAN_DAY,
  maxAuftraegePerDay: 1
});

const CPE_DEFAULT_PHOTOGRAPHER_B = Object.freeze({
  id: "photographer-secondary",
  label: "Fotograf B (Video/Drohne)",
  trigger: ["drone", "video", "drohne", "reel"]
});

const CPE_DEFAULT_PHYSICS = Object.freeze({
  defaultSetupMin: 30,
  defaultTeardownMin: 20,
  minGapMin: 15,
  defaultTravelMin: 45,
  travelMinPerKm: 1.2,
  includedKm: 30,
  defaultShootMin: 120,
  searchHorizonDays: 90,
  slotStepMin: 30
});

const CPE_DEFAULT_RESOURCES = Object.freeze([
  {
    id: "photographer-primary",
    type: CPE_RESOURCE_TYPES.PHOTOGRAPHER,
    label: "Fotograf (Primary)",
    capabilities: ["*"],
    quantity: 1
  },
  {
    id: "vehicle-primary",
    type: CPE_RESOURCE_TYPES.VEHICLE,
    label: "Fahrzeug (Primary)",
    capabilities: ["transport"],
    quantity: 1
  },
  {
    id: "equipment-standard",
    type: CPE_RESOURCE_TYPES.EQUIPMENT,
    label: "Standard Kit",
    capabilities: ["standard"],
    quantity: 1
  },
  {
    id: "equipment-drone",
    type: CPE_RESOURCE_TYPES.EQUIPMENT,
    label: "Drohne",
    capabilities: ["drone"],
    quantity: 1
  },
  {
    id: "photographer-secondary",
    type: CPE_RESOURCE_TYPES.PHOTOGRAPHER,
    label: "Fotograf B (Video/Drohne)",
    capabilities: ["secondary", "video"],
    quantity: 1
  }
]);

const CPE_ADDON_RESOURCE_DEMANDS = Object.freeze({
  drone: [
    {
      resourceType: CPE_RESOURCE_TYPES.EQUIPMENT,
      capabilities: ["drone"],
      count: 1
    }
  ]
});

const CPE_SCORE_SCALE = 100;

function cpeToUnit(value) {
  if (typeof value !== "number") {
    return 0;
  }

  if (value <= 1) {
    return cpeClamp(value, 0, 1);
  }

  return cpeClamp(value / CPE_SCORE_SCALE, 0, 1);
}

function cpeToScore(value) {
  return Math.round(cpeToUnit(value) * CPE_SCORE_SCALE);
}

function cpeScaleConflictItem(item) {
  return {
    ...item,
    score: cpeToScore(item.score ?? item.confidence ?? 50),
    confidence: cpeToScore(item.confidence ?? item.score ?? 50),
    reasons: Array.isArray(item.reasons) ? item.reasons : []
  };
}

function cpeClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cpePad(value) {
  return String(value).padStart(2, "0");
}

function cpeSplitProjectDate(dateValue) {
  if (!dateValue) {
    return { date: "", time: "", hasTime: false };
  }

  const trimmed = String(dateValue).trim();
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/
  );

  if (!match) {
    return { date: "", time: "", hasTime: false };
  }

  return {
    date: match[1],
    time: match[2] || "",
    hasTime: Boolean(match[2])
  };
}

function cpeParseDateParts(dateStr, timeStr) {
  const [year, month, day] = String(dateStr)
    .split("-")
    .map(Number);

  let hours = 0;
  let minutes = 0;

  if (timeStr && String(timeStr).trim()) {
    const parts = String(timeStr).trim().split(":");
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function cpeMs(date) {
  return date.getTime();
}

function cpeMinutesToMs(minutes) {
  return minutes * 60 * 1000;
}

function cpeReason(code, message, weight, evidence) {
  return {
    code,
    message,
    weight: typeof weight === "number" ? weight : 1,
    evidence: evidence || null
  };
}

function cpeCreateAdvisoryResult(partial) {
  const conflicts = Array.isArray(partial.conflicts)
    ? partial.conflicts
    : [];
  const warnings = Array.isArray(partial.warnings)
    ? partial.warnings
    : [];
  const reasons = Array.isArray(partial.reasons) ? partial.reasons : [];

  const conflictPenalty = conflicts.reduce(
    (sum, conflict) =>
      sum +
      (conflict.severity === CPE_SEVERITY.HARD ? 0.35 : 0.15) *
        cpeToUnit(conflict.confidence ?? conflict.score ?? 0.5),
    0
  );

  const warningPenalty = warnings.length * 0.05;
  const scoreUnit = cpeClamp(
    typeof partial.score === "number"
      ? cpeToUnit(partial.score)
      : 1 - conflictPenalty - warningPenalty,
    0,
    1
  );

  const confidenceUnit = cpeClamp(
    typeof partial.confidence === "number"
      ? cpeToUnit(partial.confidence)
      : scoreUnit,
    0,
    1
  );

  return {
    advisory: true,
    ok: conflicts.filter(c => c.severity === CPE_SEVERITY.HARD).length === 0,
    conflicts: conflicts.map(cpeScaleConflictItem),
    warnings: warnings.map(cpeScaleConflictItem),
    reasons,
    confidence: cpeToScore(confidenceUnit),
    score: cpeToScore(scoreUnit),
    scoreScale: CPE_SCORE_SCALE,
    meta: partial.meta || {}
  };
}

function cpeMergeConfig(config) {
  const input = config && typeof config === "object" ? config : {};

  return {
    physics: {
      ...CPE_DEFAULT_PHYSICS,
      ...(input.physics || {})
    },
    capacity: {
      ...CPE_DEFAULT_CAPACITY,
      ...(input.capacity || {})
    },
    photographerB: {
      ...CPE_DEFAULT_PHOTOGRAPHER_B,
      ...(input.photographerB || {})
    },
    resources: Array.isArray(input.resources) && input.resources.length
      ? input.resources.map(resource => ({ ...resource }))
      : CPE_DEFAULT_RESOURCES.map(resource => ({ ...resource }))
  };
}

function cpeIsHumanDayMode(config) {
  return cpeMergeConfig(config).capacity.mode === CPE_CAPACITY_MODES.HUMAN_DAY;
}

function cpeEventCalendarDay(event) {
  if (event?.calendarDay) {
    return String(event.calendarDay);
  }

  if (event?.anchorMs) {
    const date = new Date(event.anchorMs);
    return (
      date.getFullYear() +
      "-" +
      cpePad(date.getMonth() + 1) +
      "-" +
      cpePad(date.getDate())
    );
  }

  return "";
}

function cpeNeedsPhotographerB(project, config) {
  const merged = cpeMergeConfig(config);
  const triggers = Array.isArray(merged.photographerB.trigger)
    ? merged.photographerB.trigger
    : CPE_DEFAULT_PHOTOGRAPHER_B.trigger;
  const addons = project?.cpe?.addons;

  if (Array.isArray(addons) && addons.some(addon => triggers.includes(addon))) {
    return true;
  }

  const notes = String(project?.notes || "").toLowerCase();
  const eventType = String(project?.eventType || "").toLowerCase();

  return triggers.some(trigger => {
    const needle = String(trigger).toLowerCase();
    return notes.includes(needle) || eventType.includes(needle);
  });
}

function cpeComputeDayCapacityScore(events, config) {
  const merged = cpeMergeConfig(config);
  const maxPerDay = merged.capacity.maxAuftraegePerDay || 1;
  const byDay = new Map();

  events.forEach(event => {
    const day = cpeEventCalendarDay(event);

    if (!day) {
      return;
    }

    if (!byDay.has(day)) {
      byDay.set(day, 0);
    }

    byDay.set(day, byDay.get(day) + 1);
  });

  let overcrowded = false;

  byDay.forEach(count => {
    if (count > maxPerDay) {
      overcrowded = true;
    }
  });

  return overcrowded ? 0 : 100;
}

function cpeComputeTargetDayCapacityScore(targetEvent, allEvents, config) {
  const merged = cpeMergeConfig(config);
  const maxPerDay = merged.capacity.maxAuftraegePerDay || 1;
  const day = cpeEventCalendarDay(targetEvent);

  if (!day) {
    return 0;
  }

  const onDay = (Array.isArray(allEvents) ? allEvents : []).filter(
    event => cpeEventCalendarDay(event) === day
  );

  return onDay.length <= maxPerDay ? 100 : 0;
}

function cpeNormalizeResources(resources) {
  return (Array.isArray(resources) ? resources : []).map(resource => ({
    id: String(resource.id),
    type: String(resource.type),
    label: resource.label || resource.id,
    capabilities: Array.isArray(resource.capabilities)
      ? resource.capabilities.slice()
      : ["*"],
    quantity:
      typeof resource.quantity === "number" && resource.quantity > 0
        ? resource.quantity
        : 1
  }));
}

function cpeResourceMatchesDemand(resource, demand) {
  if (resource.type !== demand.resourceType) {
    return false;
  }

  if (demand.resourceId && demand.resourceId !== resource.id) {
    return false;
  }

  const required = Array.isArray(demand.capabilities)
    ? demand.capabilities
    : [];

  if (!required.length) {
    return true;
  }

  if (resource.capabilities.includes("*")) {
    return true;
  }

  return required.every(capability =>
    resource.capabilities.includes(capability)
  );
}

function cpeExpandResourceUnits(resources) {
  const units = [];

  resources.forEach(resource => {
    const count = resource.quantity || 1;

    for (let index = 0; index < count; index += 1) {
      units.push({
        ...resource,
        unitId: count > 1 ? `${resource.id}#${index + 1}` : resource.id
      });
    }
  });

  return units;
}

function cpeInferTravelMinutes(project, physics, context) {
  const explicitKm = Number(
    project?.cpe?.travelKm ??
      project?.travelKm ??
      context?.travelKm
  );

  if (Number.isFinite(explicitKm) && explicitKm >= 0) {
    const extraKm = Math.max(0, explicitKm - physics.includedKm);
    return Math.round(
      physics.defaultTravelMin + extraKm * physics.travelMinPerKm
    );
  }

  return physics.defaultTravelMin;
}

function cpeInferShootMinutes(project, catalog, physics) {
  const explicit = Number(
    project?.cpe?.shootMin ?? project?.shootMin
  );

  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const eventType = String(project?.eventType || "").trim();
  const products = Array.isArray(catalog?.products) ? catalog.products : [];

  if (eventType) {
    const matched = products.find(product => {
      const name = String(product.name || "").toLowerCase();
      const id = String(product.id || "").toLowerCase();
      const needle = eventType.toLowerCase();
      return name === needle || id === needle || name.includes(needle);
    });

    if (matched && Number(matched.duration) > 0) {
      return Number(matched.duration);
    }
  }

  return physics.defaultShootMin;
}

function cpeInferAddonDemands(project) {
  const demands = [];
  const addons = project?.cpe?.addons;

  if (Array.isArray(addons)) {
    addons.forEach(addonId => {
      const mapped = CPE_ADDON_RESOURCE_DEMANDS[addonId];

      if (mapped) {
        demands.push(...mapped.map(demand => ({ ...demand })));
      }
    });
  }

  const notes = String(project?.notes || "");

  if (/\bdrone\b|\bdrohne\b/i.test(notes)) {
    demands.push({
      resourceType: CPE_RESOURCE_TYPES.EQUIPMENT,
      capabilities: ["drone"],
      count: 1
    });
  }

  return demands;
}

function cpeBuildBaseDemands(project, config) {
  const merged = cpeMergeConfig(config);

  if (merged.capacity.mode === CPE_CAPACITY_MODES.HUMAN_DAY) {
    const demands = [
      {
        resourceType: CPE_RESOURCE_TYPES.PHOTOGRAPHER,
        resourceId: "photographer-primary",
        capabilities: ["primary", "*"],
        count: 1
      },
      {
        resourceType: CPE_RESOURCE_TYPES.VEHICLE,
        capabilities: ["transport"],
        count: 1
      },
      {
        resourceType: CPE_RESOURCE_TYPES.EQUIPMENT,
        capabilities: ["standard"],
        count: 1
      }
    ];

    if (cpeNeedsPhotographerB(project, merged)) {
      demands.push({
        resourceType: CPE_RESOURCE_TYPES.PHOTOGRAPHER,
        resourceId: merged.photographerB.id,
        capabilities: ["secondary", "video"],
        count: 1
      });
    }

    return demands;
  }

  const photographerCount = Number(project?.cpe?.photographers) || 1;

  return [
    {
      resourceType: CPE_RESOURCE_TYPES.PHOTOGRAPHER,
      capabilities: ["*"],
      count: photographerCount
    },
    {
      resourceType: CPE_RESOURCE_TYPES.VEHICLE,
      capabilities: ["transport"],
      count: 1
    },
    {
      resourceType: CPE_RESOURCE_TYPES.EQUIPMENT,
      capabilities: ["standard"],
      count: 1
    }
  ];
}

function cpeMergeDemands(baseDemands, addonDemands) {
  return baseDemands.concat(addonDemands).map(demand => ({
    resourceType: demand.resourceType,
    capabilities: Array.isArray(demand.capabilities)
      ? demand.capabilities.slice()
      : [],
    count: demand.count || 1,
    resourceId: demand.resourceId || null,
    optional: Boolean(demand.optional)
  }));
}

function cpeBuildEnvelope(anchorMs, shootMin, travelMin, physics) {
  const setupMs = cpeMinutesToMs(physics.defaultSetupMin);
  const teardownMs = cpeMinutesToMs(physics.defaultTeardownMin);
  const shootMs = cpeMinutesToMs(shootMin);
  const travelMs = cpeMinutesToMs(travelMin);

  const startMs = anchorMs - travelMs - setupMs;
  const endMs = anchorMs + shootMs + teardownMs + travelMs;

  return {
    anchorMs,
    startMs,
    endMs,
    setupMs,
    shootMs,
    teardownMs,
    travelMs,
    shootMin,
    travelMin
  };
}

function cpeNormalizeProject(project, context) {
  const config = cpeMergeConfig(context?.config);
  const physics = config.physics;
  const catalog = context?.catalog || null;
  const parts = cpeSplitProjectDate(project?.date);
  const reasons = [];
  let confidence = 1;

  if (!parts.date) {
    return {
      event: null,
      reasons: [
        cpeReason(
          CPE_REASON_CODES.NO_EVENT_ANCHOR,
          "Projekt ohne Termin — brak kotwicy zasobowej.",
          1,
          { projectId: project?.id }
        )
      ],
      confidence: 0
    };
  }

  if (!parts.hasTime) {
    reasons.push(
      cpeReason(
        CPE_REASON_CODES.MISSING_TIME_INPUT,
        "Brak godziny — kotwica ustawiona na 00:00, niska precyzja.",
        0.35,
        { projectId: project?.id, date: parts.date }
      )
    );
    confidence -= 0.25;
  }

  const shootMin = cpeInferShootMinutes(project, catalog, physics);
  const explicitDuration = Number(project?.cpe?.shootMin ?? project?.shootMin);

  if (!Number.isFinite(explicitDuration) || explicitDuration <= 0) {
    const matchedCatalog = Boolean(
      project?.eventType &&
        Array.isArray(catalog?.products) &&
        catalog.products.some(product => {
          const name = String(product.name || "").toLowerCase();
          const needle = String(project.eventType).toLowerCase();
          return name.includes(needle);
        })
    );

    if (!matchedCatalog) {
      reasons.push(
        cpeReason(
          CPE_REASON_CODES.DEFAULT_DURATION_ASSUMED,
          `Przyjęto domyślny czas realizacji ${shootMin} min.`,
          0.25,
          { shootMin }
        )
      );
      confidence -= 0.15;
    }
  }

  const travelMin = cpeInferTravelMinutes(project, physics, context);
  const explicitTravel = project?.cpe?.travelKm ?? project?.travelKm;

  if (explicitTravel === undefined || explicitTravel === null || explicitTravel === "") {
    reasons.push(
      cpeReason(
        CPE_REASON_CODES.DEFAULT_TRAVEL_ASSUMED,
        `Przyjęto domyślny bufor dojazdu ${travelMin} min.`,
        0.2,
        { travelMin }
      )
    );
    confidence -= 0.1;
  }

  const anchor = cpeParseDateParts(
    parts.date,
    parts.hasTime ? parts.time : "09:00"
  );

  if (!parts.hasTime) {
    reasons.push(
      cpeReason(
        CPE_REASON_CODES.MISSING_TIME_INPUT,
        "Do obliczeń użyto domyślnej godziny 09:00.",
        0.2,
        { assumedTime: "09:00" }
      )
    );
  }

  const envelope = cpeBuildEnvelope(
    cpeMs(anchor),
    shootMin,
    travelMin,
    physics
  );

  const demands = cpeMergeDemands(
    cpeBuildBaseDemands(project, config),
    cpeInferAddonDemands(project)
  );

  confidence = cpeClamp(confidence, 0.15, 1);

  return {
    event: {
      id: project?.cpe?.eventId || `project:${project?.id}`,
      projectId: project?.id,
      label: project?.title || project?.client || project?.id,
      anchorMs: envelope.anchorMs,
      calendarDay: parts.date,
      envelope,
      demands,
      location: {
        eventAddress: project?.eventAddress || "",
        eventCity: project?.eventCity || "",
        eventPostalCode: project?.eventPostalCode || ""
      },
      inputs: {
        hasTime: parts.hasTime,
        shootMin,
        travelMin
      }
    },
    reasons,
    confidence: cpeToScore(confidence)
  };
}

function cpeLoadEvents(projects, context) {
  const list = Array.isArray(projects) ? projects : [];
  const events = [];
  const skipped = [];

  list.forEach(project => {
    const normalized = cpeNormalizeProject(project, context);

    if (normalized.event) {
      events.push({
        ...normalized.event,
        confidence: cpeToUnit(normalized.confidence),
        inputReasons: normalized.reasons
      });
    } else {
      skipped.push({
        projectId: project?.id,
        reasons: normalized.reasons,
        confidence: normalized.confidence
      });
    }
  });

  return { events, skipped };
}

function cpeIntervalsOverlap(a, b) {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function cpeGapMinutesBetween(a, b) {
  if (a.endMs <= b.startMs) {
    return (b.startMs - a.endMs) / 60000;
  }

  if (b.endMs <= a.startMs) {
    return (a.startMs - b.endMs) / 60000;
  }

  return 0;
}

function cpeAllocateResources(event, resourceUnits, existingReservations) {
  const allocations = [];
  const allocationReasons = [];
  const reservations = Array.isArray(existingReservations)
    ? existingReservations
    : [];

  event.demands.forEach(demand => {
    const candidates = resourceUnits.filter(resource =>
      cpeResourceMatchesDemand(resource, demand)
    );
    const interval = {
      startMs: event.envelope.startMs,
      endMs: event.envelope.endMs
    };
    let assigned = 0;

    candidates.forEach(resource => {
      if (assigned >= (demand.count || 1)) {
        return;
      }

      const unitTaken = reservations.some(reservation =>
        reservation.resourceUnitId === resource.unitId &&
        cpeIntervalsOverlap(reservation.interval, interval)
      );

      if (unitTaken) {
        return;
      }

      allocations.push({
        eventId: event.id,
        projectId: event.projectId,
        resourceId: resource.id,
        resourceUnitId: resource.unitId,
        resourceType: resource.type,
        resourceLabel: resource.label,
        interval
      });

      assigned += 1;
    });

    if (!candidates.length) {
      allocationReasons.push(
        cpeReason(
          CPE_REASON_CODES.CAPABILITY_MISMATCH,
          `Brak zasobu typu ${demand.resourceType} dla wymagań ${(
            demand.capabilities || []
          ).join(", ") || "*"}.`,
          0.9,
          { demand, eventId: event.id }
        )
      );
      return;
    }

    if (assigned < (demand.count || 1)) {
      allocationReasons.push(
        cpeReason(
          CPE_REASON_CODES.INSUFFICIENT_CAPACITY,
          `Niewystarczająca liczba wolnych zasobów ${demand.resourceType}: wymagane ${demand.count}, przydzielono ${assigned}.`,
          0.95,
          {
            demand,
            assigned,
            eventId: event.id
          }
        )
      );

      const fallback = candidates[assigned] || candidates[0];

      if (fallback) {
        allocations.push({
          eventId: event.id,
          projectId: event.projectId,
          resourceId: fallback.id,
          resourceUnitId: fallback.unitId,
          resourceType: fallback.type,
          resourceLabel: fallback.label,
          interval
        });
      }
    }
  });

  return { allocations, allocationReasons };
}

function cpeBuildResourceTimeline(events, resources) {
  const resourceUnits = cpeExpandResourceUnits(
    cpeNormalizeResources(resources)
  );
  const reservations = [];
  const allocationIssues = [];

  events.forEach(event => {
    const { allocations, allocationReasons } = cpeAllocateResources(
      event,
      resourceUnits,
      reservations
    );

    reservations.push(...allocations);
    allocationIssues.push(...allocationReasons);
  });

  return {
    resourceUnits,
    reservations,
    allocationIssues
  };
}

function cpeScanConflictsHumanDay(events, resources, context) {
  const config = cpeMergeConfig(context?.config);
  const maxPerDay = config.capacity.maxAuftraegePerDay || 1;
  const normalizedResources = cpeNormalizeResources(
    resources || config.resources
  );
  const conflicts = [];
  const warnings = [];
  const reasons = [];
  const byDay = new Map();

  events.forEach(event => {
    const day = cpeEventCalendarDay(event);

    if (!day) {
      return;
    }

    if (!byDay.has(day)) {
      byDay.set(day, []);
    }

    byDay.get(day).push(event);
  });

  byDay.forEach((dayEvents, day) => {
    if (dayEvents.length <= maxPerDay) {
      if (dayEvents.length === 0) {
        return;
      }

      reasons.push(
        cpeReason(
          CPE_REASON_CODES.DAY_CAPACITY_FREE,
          `Tag ${day}: ${100}% Kapazität — ${dayEvents.length}/${maxPerDay} Auftrag.`,
          0.5,
          { day, count: dayEvents.length, maxPerDay }
        )
      );
      return;
    }

    const dayReason = cpeReason(
      CPE_REASON_CODES.DAY_CAPACITY_EXHAUSTED,
      `Tag ${day} ausgebucht — 0% Kapazität (${dayEvents.length}/${maxPerDay} Aufträge).`,
      0.95,
      {
        day,
        count: dayEvents.length,
        maxPerDay,
        projects: dayEvents.map(event => event.projectId)
      }
    );

    conflicts.push({
      id: `day-capacity:${day}`,
      severity: CPE_SEVERITY.HARD,
      score: 0,
      confidence: 0.95,
      reasons: [dayReason],
      affectedResources: [`shoot-day:${day}`],
      overlappingEvents: dayEvents.map(event => event.id)
    });
    reasons.push(dayReason);
  });

  events.forEach(event => {
    const needsB = (event.demands || []).some(
      demand => demand.resourceId === config.photographerB.id
    );

    if (!needsB) {
      return;
    }

    reasons.push(
      cpeReason(
        CPE_REASON_CODES.PHOTOGRAPHER_B_REQUIRED,
        `Fotograf B im selben Auftrag eingeplant (${config.photographerB.label}).`,
        0.35,
        { projectId: event.projectId, eventId: event.id }
      )
    );

    const hasB = normalizedResources.some(
      resource => resource.id === config.photographerB.id
    );

    if (!hasB) {
      const missingReason = cpeReason(
        CPE_REASON_CODES.PHOTOGRAPHER_B_UNAVAILABLE,
        `Fotograf B nicht in der Ressourcenliste verfügbar.`,
        0.9,
        { resourceId: config.photographerB.id, projectId: event.projectId }
      );

      conflicts.push({
        id: `photographer-b:${event.id}`,
        severity: CPE_SEVERITY.HARD,
        score: 0,
        confidence: 0.9,
        reasons: [missingReason],
        affectedResources: [config.photographerB.id],
        overlappingEvents: [event.id]
      });
      reasons.push(missingReason);
    }
  });

  const capacityScore = cpeComputeDayCapacityScore(events, config);
  const hardCount = conflicts.filter(
    conflict => conflict.severity === CPE_SEVERITY.HARD
  ).length;

  return cpeCreateAdvisoryResult({
    score: capacityScore,
    conflicts,
    warnings,
    reasons,
    confidence: hardCount ? 0.85 : 0.9,
    meta: {
      capacityMode: CPE_CAPACITY_MODES.HUMAN_DAY,
      dayCapacity: capacityScore,
      maxAuftraegePerDay: maxPerDay,
      eventCount: events.length
    }
  });
}

function cpeScanConflictsResource(events, resources, context) {
  const config = cpeMergeConfig(context?.config);
  const physics = config.physics;
  const normalizedResources = cpeNormalizeResources(
    resources || config.resources
  );
  const { reservations, allocationIssues } = cpeBuildResourceTimeline(
    events,
    normalizedResources
  );

  const conflicts = [];
  const warnings = [];
  const reasons = [];

  allocationIssues.forEach(issue => {
    conflicts.push({
      id: `capacity:${issue.evidence?.eventId}:${issue.evidence?.demand?.resourceType}`,
      severity: CPE_SEVERITY.HARD,
      score: 0.95,
      confidence: 0.95,
      reasons: [issue],
      affectedResources: issue.evidence?.demand?.resourceType
        ? [issue.evidence.demand.resourceType]
        : [],
      overlappingEvents: issue.evidence?.eventId
        ? [issue.evidence.eventId]
        : []
    });
    reasons.push(issue);
  });

  for (let i = 0; i < reservations.length; i += 1) {
    for (let j = i + 1; j < reservations.length; j += 1) {
      const left = reservations[i];
      const right = reservations[j];

      if (left.resourceUnitId !== right.resourceUnitId) {
        continue;
      }

      if (!cpeIntervalsOverlap(left.interval, right.interval)) {
        const gap = cpeGapMinutesBetween(left.interval, right.interval);

        if (gap > 0 && gap < physics.minGapMin) {
          const tightReason = cpeReason(
            CPE_REASON_CODES.TIGHT_TURNAROUND,
            `Zasób ${left.resourceLabel}: ${Math.round(
              gap
            )} min przerwy (< ${physics.minGapMin} min).`,
            0.55,
            {
              resourceUnitId: left.resourceUnitId,
              gapMin: gap,
              events: [left.eventId, right.eventId]
            }
          );

          warnings.push({
            id: `tight:${left.resourceUnitId}:${left.eventId}:${right.eventId}`,
            severity: CPE_SEVERITY.SOFT,
            score: 0.55,
            confidence: 0.6,
            reasons: [tightReason],
            affectedResources: [left.resourceUnitId],
            overlappingEvents: [left.eventId, right.eventId]
          });
          reasons.push(tightReason);
        }

        continue;
      }

      const overlapReason = cpeReason(
        CPE_REASON_CODES.RESOURCE_OVERLAP,
        `Zasób ${left.resourceLabel} (${left.resourceType}) zajęty równolegle przez ${left.projectId} i ${right.projectId}.`,
        0.95,
        {
          resourceUnitId: left.resourceUnitId,
          resourceType: left.resourceType,
          intervals: [left.interval, right.interval]
        }
      );

      conflicts.push({
        id: `overlap:${left.resourceUnitId}:${left.eventId}:${right.eventId}`,
        severity: CPE_SEVERITY.HARD,
        score: 0.92,
        confidence: cpeClamp(
          ((events.find(e => e.id === left.eventId)?.confidence || 0.7) +
            (events.find(e => e.id === right.eventId)?.confidence || 0.7)) /
            2,
          0.4,
          1
        ),
        reasons: [overlapReason],
        affectedResources: [left.resourceUnitId],
        overlappingEvents: [left.eventId, right.eventId]
      });
      reasons.push(overlapReason);
    }
  }

  return cpeCreateAdvisoryResult({
    conflicts,
    warnings,
    reasons,
    confidence:
      conflicts.length === 0
        ? 0.85
        : cpeClamp(
            1 -
              conflicts.length * 0.1 -
              (allocationIssues.length ? 0.15 : 0),
            0.35,
            0.95
          ),
    meta: {
      capacityMode: CPE_CAPACITY_MODES.RESOURCE,
      reservationCount: reservations.length,
      resourceCount: normalizedResources.length
    }
  });
}

function cpeScanConflicts(events, resources, context) {
  const config = cpeMergeConfig(context?.config);

  if (config.capacity.mode === CPE_CAPACITY_MODES.HUMAN_DAY) {
    return cpeScanConflictsHumanDay(events, resources, context);
  }

  return cpeScanConflictsResource(events, resources, context);
}

function cpeValidateAssignmentHumanDay(targetEvent, allEvents, resources, context) {
  const config = cpeMergeConfig(context?.config);
  const mergedEvents = (Array.isArray(allEvents) ? allEvents : []).filter(
    event => event.id !== targetEvent.id
  );

  mergedEvents.push(targetEvent);

  const scan = cpeScanConflictsHumanDay(mergedEvents, resources, context);
  const related = scan.conflicts.filter(conflict =>
    conflict.overlappingEvents.includes(targetEvent.id)
  );
  const capacityScore = cpeComputeTargetDayCapacityScore(
    targetEvent,
    mergedEvents,
    config
  );
  const inputReasons = Array.isArray(targetEvent.inputReasons)
    ? targetEvent.inputReasons
    : [];

  return cpeCreateAdvisoryResult({
    score: capacityScore,
    conflicts: related,
    warnings: scan.warnings,
    reasons: inputReasons.concat(
      related.length
        ? related.flatMap(conflict => conflict.reasons || [])
        : scan.reasons.filter(
            reason => reason.code === CPE_REASON_CODES.DAY_CAPACITY_FREE
          )
    ),
    confidence: cpeClamp(
      (cpeToUnit(targetEvent.confidence || 70) + cpeToUnit(scan.confidence)) / 2,
      0.2,
      1
    ),
    meta: {
      capacityMode: CPE_CAPACITY_MODES.HUMAN_DAY,
      dayCapacity: capacityScore,
      targetEventId: targetEvent.id,
      calendarConflictCount: scan.conflicts.length,
      calendarWarningCount: scan.warnings.length,
      maxAuftraegePerDay: config.capacity.maxAuftraegePerDay
    }
  });
}

function cpeValidateAssignmentResource(targetEvent, allEvents, resources, context) {
  const mergedEvents = (Array.isArray(allEvents) ? allEvents : []).filter(
    event => event.id !== targetEvent.id
  );

  mergedEvents.push(targetEvent);

  const scan = cpeScanConflictsResource(mergedEvents, resources, context);
  const related = scan.conflicts.filter(conflict =>
    conflict.overlappingEvents.includes(targetEvent.id)
  );
  const relatedWarnings = scan.warnings.filter(warning =>
    warning.overlappingEvents.includes(targetEvent.id)
  );

  return cpeCreateAdvisoryResult({
    conflicts: related.length ? related : scan.conflicts,
    warnings: relatedWarnings.concat(scan.warnings),
    reasons: targetEvent.inputReasons || [],
    confidence: cpeClamp(
      (cpeToUnit(targetEvent.confidence || 70) + cpeToUnit(scan.confidence)) / 2,
      0.2,
      1
    ),
    meta: {
      capacityMode: CPE_CAPACITY_MODES.RESOURCE,
      targetEventId: targetEvent.id,
      globalScan: scan.meta
    }
  });
}

function cpeValidateAssignment(targetEvent, allEvents, resources, context) {
  if (!targetEvent) {
    return cpeCreateAdvisoryResult({
      ok: false,
      conflicts: [
        {
          id: "missing-event",
          severity: CPE_SEVERITY.HARD,
          score: 1,
          confidence: 1,
          reasons: [
            cpeReason(
              CPE_REASON_CODES.NO_EVENT_ANCHOR,
              "Brak zdarzenia do walidacji.",
              1
            )
          ],
          affectedResources: [],
          overlappingEvents: []
        }
      ],
      reasons: [
        cpeReason(
          CPE_REASON_CODES.NO_EVENT_ANCHOR,
          "Brak zdarzenia do walidacji.",
          1
        )
      ],
      confidence: 1
    });
  }

  const config = cpeMergeConfig(context?.config);

  if (config.capacity.mode === CPE_CAPACITY_MODES.HUMAN_DAY) {
    return cpeValidateAssignmentHumanDay(
      targetEvent,
      allEvents,
      resources,
      context
    );
  }

  return cpeValidateAssignmentResource(
    targetEvent,
    allEvents,
    resources,
    context
  );
}

function cpeCanPlaceEventAt(anchorMs, eventTemplate, existingEvents, resources, context) {
  const config = cpeMergeConfig(context?.config);
  const physics = config.physics;
  const candidate = {
    ...eventTemplate,
    anchorMs,
    calendarDay: cpeEventCalendarDay({ anchorMs }),
    envelope: cpeBuildEnvelope(
      anchorMs,
      eventTemplate.inputs.shootMin,
      eventTemplate.inputs.travelMin,
      physics
    )
  };

  const validation = cpeValidateAssignment(
    candidate,
    existingEvents,
    resources,
    context
  );

  const hardConflicts = validation.conflicts.filter(
    conflict => conflict.severity === CPE_SEVERITY.HARD
  );

  return {
    ok: hardConflicts.length === 0,
    candidate,
    validation
  };
}

function cpeScoreSlot(placement, physics) {
  if (!placement.ok) {
    return cpeCreateAdvisoryResult({
      score: 0,
      confidence: placement.validation.confidence,
      conflicts: placement.validation.conflicts,
      warnings: placement.validation.warnings,
      reasons: [
        cpeReason(
          CPE_REASON_CODES.RESOURCE_OVERLAP,
          "Slot niedostępny — konflikt zasobów.",
          0.9
        )
      ]
    });
  }

  const reasons = [
    cpeReason(
      CPE_REASON_CODES.SLOT_AVAILABLE,
      "Slot wolny dla wymaganych zasobów.",
      0.8
    )
  ];

  let scoreUnit = 0.82;
  let confidenceUnit = cpeToUnit(placement.validation.confidence);

  if (placement.validation.warnings.length) {
    scoreUnit -= 0.12;
    confidenceUnit -= 0.08;
    reasons.push(
      cpeReason(
        CPE_REASON_CODES.SLOT_MARGINAL,
        "Slot dostępny, ale z marginesem ostrzeżeń.",
        0.45,
        { warningCount: placement.validation.warnings.length }
      )
    );
  }

  return cpeCreateAdvisoryResult({
    score: cpeClamp(scoreUnit, 0, 1),
    confidence: cpeClamp(confidenceUnit, 0.2, 1),
    conflicts: [],
    warnings: placement.validation.warnings,
    reasons,
    meta: {
      anchorMs: placement.candidate.anchorMs,
      minGapMin: physics.minGapMin
    }
  });
}

function cpeProposeSlots(request, resources, existingEvents, context) {
  const config = cpeMergeConfig(context?.config);
  const physics = config.physics;
  const template = request?.eventTemplate;

  if (!template || !template.inputs) {
    return {
      advisory: true,
      ok: false,
      slots: [],
      reasons: [
        cpeReason(
          CPE_REASON_CODES.NO_EVENT_ANCHOR,
          "Brak szablonu zdarzenia (eventTemplate) do wyszukiwania slotów.",
          1
        )
      ],
      confidence: 0,
      score: 0,
      scoreScale: CPE_SCORE_SCALE
    };
  }

  const horizonMs = cpeMinutesToMs(physics.searchHorizonDays * 24 * 60);
  const stepMs = cpeMinutesToMs(physics.slotStepMin);
  const startMs = request?.searchStartMs || Date.now();
  const endMs = startMs + horizonMs;
  const slots = [];

  for (let cursor = startMs; cursor <= endMs; cursor += stepMs) {
    const placement = cpeCanPlaceEventAt(
      cursor,
      template,
      existingEvents,
      resources,
      context
    );
    const scored = cpeScoreSlot(placement, physics);

    if (placement.ok) {
      slots.push({
        advisory: true,
        anchorMs: cursor,
        anchorIso: new Date(cursor).toISOString(),
        score: scored.score,
        confidence: scored.confidence,
        reasons: scored.reasons,
        warnings: scored.warnings
      });
    }

    if (slots.length >= (request?.limit || 5)) {
      break;
    }
  }

  slots.sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  return {
    advisory: true,
    ok: slots.length > 0,
    slots,
    reasons: slots.length
      ? [
          cpeReason(
            CPE_REASON_CODES.SLOT_AVAILABLE,
            `Znaleziono ${slots.length} doradczych slotów zasobowych.`,
            0.7
          )
        ]
      : [
          cpeReason(
            CPE_REASON_CODES.INSUFFICIENT_CAPACITY,
            "Brak wolnych slotów w horyzoncie wyszukiwania.",
            0.85
          )
        ],
    confidence: slots.length ? slots[0].confidence : 40,
    score: slots.length ? slots[0].score : 0,
    scoreScale: CPE_SCORE_SCALE
  };
}

function cpeAnalyzeProjects(projects, context) {
  const config = cpeMergeConfig(context?.config);
  const loaded = cpeLoadEvents(projects, context);
  const scan = cpeScanConflicts(
    loaded.events,
    config.resources,
    context
  );

  return cpeCreateAdvisoryResult({
    conflicts: scan.conflicts,
    warnings: scan.warnings,
    reasons: scan.reasons.concat(
      loaded.skipped.flatMap(item => item.reasons || [])
    ),
    confidence: scan.confidence,
    score: scan.score,
    meta: {
      eventCount: loaded.events.length,
      skippedCount: loaded.skipped.length,
      skipped: loaded.skipped
    }
  });
}

window.CPE_ENGINE = Object.freeze({
  VERSION: "0.1.0",
  SCORE_SCALE: CPE_SCORE_SCALE,
  CAPACITY_MODES: CPE_CAPACITY_MODES,
  DEFAULT_CAPACITY: CPE_DEFAULT_CAPACITY,
  toScore: cpeToScore,
  toUnit: cpeToUnit,
  RESOURCE_TYPES: CPE_RESOURCE_TYPES,
  SEVERITY: CPE_SEVERITY,
  REASON_CODES: CPE_REASON_CODES,
  DEFAULT_PHYSICS: CPE_DEFAULT_PHYSICS,
  DEFAULT_RESOURCES: CPE_DEFAULT_RESOURCES,
  mergeConfig: cpeMergeConfig,
  normalizeResources: cpeNormalizeResources,
  normalizeProject: cpeNormalizeProject,
  loadEvents: cpeLoadEvents,
  buildResourceTimeline: cpeBuildResourceTimeline,
  scanConflicts: cpeScanConflicts,
  validateAssignment: cpeValidateAssignment,
  scoreSlot: cpeScoreSlot,
  proposeSlots: cpeProposeSlots,
  analyzeProjects: cpeAnalyzeProjects
});
