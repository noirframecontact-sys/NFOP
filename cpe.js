"use strict";

/*
=========================================
NOIRFRAME — Calendar Physics Engine (CPE)
Integration wrapper (advisory only, no writes)
Faza 1: Shadow hook — logi w konsoli, bez zapisu decyzji.
*/

const cpeModuleState = {
  ready: false,
  config: null,
  catalog: null,
  fileModeNoticeLogged: false
};

function cpeIsFileMode() {
  return (
    typeof window.NF_canFetchAssets === "function" &&
    !window.NF_canFetchAssets()
  );
}

function cpeLogFileModeNotice() {
  if (cpeModuleState.fileModeNoticeLogged) {
    return;
  }

  if (!cpeIsFileMode()) {
    return;
  }

  cpeModuleState.fileModeNoticeLogged = true;

  console.info("[NF_cpe] Running in file:// mode.");
  console.info("[NF_cpe] Catalog unavailable.");
  console.info("[NF_cpe] Using default duration assumptions.");
}

function cpeLogCatalogFallbackNotice() {
  console.info("[NF_cpe] Catalog unavailable.");
  console.info("[NF_cpe] Using default duration assumptions.");
}

function cpeLogReasons(label, reasons) {
  const list = Array.isArray(reasons) ? reasons : [];

  if (!list.length) {
    console.info(`[NF_cpe] ${label}: brak powodow.`);
    return;
  }

  console.info(`[NF_cpe] ${label} (${list.length}):`);

  if (typeof console.table === "function") {
    console.table(
      list.map((reason, index) => ({
        nr: index + 1,
        code: reason.code,
        message: reason.message,
        weight: reason.weight
      }))
    );
  }

  list.forEach((reason, index) => {
    console.info(
      `[NF_cpe]   ${index + 1}. [${reason.code}] ${reason.message}`
    );
  });
}

function cpeLogShadowAdvisory(projectId, advisory) {
  console.group("[NF_cpe] Shadow advisory — Termin gespeichert");
  console.info("[NF_cpe] projectId:", projectId);
  console.info("[NF_cpe] advisory:", advisory.advisory);
  console.info("[NF_cpe] ok:", advisory.ok);
  console.info(
    `[NF_cpe] ${typeof advisory.meta?.dayCapacity === "number" ? "Tag-Kapazität" : "score"}: ${
      typeof advisory.meta?.dayCapacity === "number"
        ? `${advisory.meta.dayCapacity}%`
        : `${advisory.score}/${advisory.scoreScale || 100}`
    }`
  );
  console.info(
    `[NF_cpe] confidence: ${advisory.confidence}/${advisory.scoreScale || 100}`
  );

  cpeLogReasons("reasons", advisory.reasons);

  if (Array.isArray(advisory.conflicts) && advisory.conflicts.length) {
    advisory.conflicts.forEach((conflict, index) => {
      cpeLogReasons(`conflict ${index + 1}`, conflict.reasons);
    });
  }

  if (Array.isArray(advisory.warnings) && advisory.warnings.length) {
    advisory.warnings.forEach((warning, index) => {
      cpeLogReasons(`warning ${index + 1}`, warning.reasons);
    });
  }

  console.groupEnd();
}

function cpeGetEngine() {
  if (typeof window.CPE_ENGINE !== "object" || !window.CPE_ENGINE) {
    throw new Error("CPE_ENGINE not loaded. Include cpe-engine.js first.");
  }

  return window.CPE_ENGINE;
}

function cpeBuildContext(overrides) {
  const engine = cpeGetEngine();
  const baseConfig =
    cpeModuleState.config ||
    window.NF_CONFIG?.cpe ||
    { physics: engine.DEFAULT_PHYSICS, resources: engine.DEFAULT_RESOURCES };

  return {
    config: engine.mergeConfig(baseConfig),
    catalog: overrides?.catalog ?? cpeModuleState.catalog,
    travelKm: overrides?.travelKm,
    blockedDays: overrides?.blockedDays ?? getBlockedDays()
  };
}

async function cpeLoadCatalog(url) {
  if (cpeIsFileMode()) {
    cpeLogFileModeNotice();
    return null;
  }

  const catalogUrl =
    url ||
    window.NF_CONFIG?.catalog?.url ||
    "catalog.json";

  const response = await fetch(catalogUrl);

  if (!response.ok) {
    throw new Error(`CPE catalog fetch failed: ${response.status}`);
  }

  return response.json();
}

function cpeTryBorrowCatalog() {
  if (cpeModuleState.catalog) {
    return cpeModuleState.catalog;
  }

  const shared = window.NF_angebot?.getCatalog?.();

  if (shared) {
    cpeModuleState.catalog = shared;
  }

  return cpeModuleState.catalog;
}

async function initCpeModule(options) {
  const engine = cpeGetEngine();
  const input = options && typeof options === "object" ? options : {};

  cpeModuleState.config = engine.mergeConfig(
    input.config || window.NF_CONFIG?.cpe || {}
  );

  if (input.catalog) {
    cpeModuleState.catalog = input.catalog;
  } else if (window.NF_CATALOG_DATA) {
    cpeModuleState.catalog = window.NF_CATALOG_DATA;
  } else if (input.loadCatalog !== false) {
    cpeTryBorrowCatalog();

    if (!cpeModuleState.catalog) {
      try {
        const loaded = await cpeLoadCatalog(input.catalogUrl);

        if (loaded) {
          cpeModuleState.catalog = loaded;
        } else if (cpeIsFileMode()) {
          cpeLogFileModeNotice();
        }
      } catch (error) {
        cpeLogCatalogFallbackNotice();
      }
    } else if (cpeIsFileMode() && !cpeModuleState.catalog) {
      cpeLogFileModeNotice();
    }
  }

  cpeModuleState.ready = true;

  return {
    advisory: true,
    ready: true,
    resourceCount: cpeModuleState.config.resources.length,
    shadowMode: Boolean(cpeModuleState.config.shadowMode ?? true)
  };
}

function normalizeProject(project, contextOverrides) {
  return cpeGetEngine().normalizeProject(
    project,
    cpeBuildContext(contextOverrides)
  );
}

function loadEvents(projects, contextOverrides) {
  const stornoTitle = window.NF_CONFIG?.storno?.title || "AWISTA";
  const activeProjects = (Array.isArray(projects) ? projects : []).filter(
    project => String(project?.title || "").trim() !== stornoTitle
  );

  return cpeGetEngine().loadEvents(
    activeProjects,
    cpeBuildContext(contextOverrides)
  );
}

function scanConflicts(events, resources, contextOverrides) {
  return cpeGetEngine().scanConflicts(
    events,
    resources,
    cpeBuildContext(contextOverrides)
  );
}

function validateAssignment(targetEvent, allEvents, resources, contextOverrides) {
  return cpeGetEngine().validateAssignment(
    targetEvent,
    allEvents,
    resources,
    cpeBuildContext(contextOverrides)
  );
}

function scoreSlot(placement, contextOverrides) {
  const physics = cpeBuildContext(contextOverrides).config.physics;
  return cpeGetEngine().scoreSlot(placement, physics);
}

function proposeSlots(request, resources, existingEvents, contextOverrides) {
  return cpeGetEngine().proposeSlots(
    request,
    resources,
    existingEvents,
    cpeBuildContext(contextOverrides)
  );
}

function analyzeProjects(projects, contextOverrides) {
  return cpeGetEngine().analyzeProjects(
    projects,
    cpeBuildContext(contextOverrides)
  );
}

function getDefaultResources() {
  return cpeGetEngine()
    .DEFAULT_RESOURCES.map(resource => ({ ...resource }));
}

function isEnabled() {
  return Boolean(window.NF_CONFIG?.cpe?.enabled);
}

function isShadowMode() {
  return Boolean(
    window.NF_CONFIG?.cpe?.shadowMode ??
      cpeModuleState.config?.shadowMode ??
      true
  );
}

function cpeExtractCalendarDay(dateValue) {
  const match = String(dateValue || "")
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})/);

  return match ? match[1] : "";
}

function normalizeBlockedDayEntries(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map(item => {
      if (typeof item === "string" && item.trim()) {
        return { day: item.trim(), reason: "Privat" };
      }

      if (item && typeof item.day === "string" && item.day.trim()) {
        return {
          day: item.day.trim(),
          reason: String(item.reason || "Privat").trim() || "Privat"
        };
      }

      return null;
    })
    .filter(Boolean);
}

function getBlockedDayEntries() {
  if (window.NF_calendarStore?.getBlockEntries) {
    return window.NF_calendarStore.getBlockEntries();
  }

  try {
    const saved = localStorage.getItem("nfBlockedDays");

    if (!saved) {
      return [];
    }

    return normalizeBlockedDayEntries(JSON.parse(saved));
  } catch (error) {
    return [];
  }
}

function getBlockedDays() {
  return getBlockedDayEntries().map(entry => entry.day);
}

function getBlockedDayEntry(day) {
  return (
    getBlockedDayEntries().find(entry => entry.day === day) || null
  );
}

function saveBlockedDayEntries(entries) {
  localStorage.setItem(
    "nfBlockedDays",
    JSON.stringify(normalizeBlockedDayEntries(entries))
  );

  window.NF_backup?.onLocalDataSaved?.();
}

async function setBlockedDay(day, reason) {
  const normalizedDay = cpeExtractCalendarDay(day);

  if (!normalizedDay) {
    return { ok: false, message: "Ungültiges Datum." };
  }

  if (window.NF_calendarStore?.blockDay) {
    return window.NF_calendarStore.blockDay(normalizedDay, reason);
  }

  const entries = getBlockedDayEntries().filter(
    entry => entry.day !== normalizedDay
  );

  entries.push({
    day: normalizedDay,
    reason: String(reason || "Privat").trim() || "Privat",
    createdAt: new Date().toISOString()
  });

  saveBlockedDayEntries(entries);

  return { ok: true, day: normalizedDay };
}

async function removeBlockedDay(day) {
  const normalizedDay = cpeExtractCalendarDay(day);

  if (!normalizedDay) {
    return { ok: false, message: "Ungültiges Datum." };
  }

  if (window.NF_calendarStore?.unblockDay) {
    return window.NF_calendarStore.unblockDay(normalizedDay);
  }

  saveBlockedDayEntries(
    getBlockedDayEntries().filter(entry => entry.day !== normalizedDay)
  );

  return { ok: true, day: normalizedDay };
}

function getAuftraegeOnCalendarDay(allProjects, day) {
  const stornoTitle = window.NF_CONFIG?.storno?.title || "AWISTA";

  return (Array.isArray(allProjects) ? allProjects : []).filter(
    project =>
      String(project?.title || "").trim() !== stornoTitle &&
      cpeExtractCalendarDay(project.date) === day
  );
}

function getOperatorDayCalendarStatus(day, allProjects, editingProjectId) {
  const auftraege = getAuftraegeOnCalendarDay(allProjects, day);
  const blockEntry = getBlockedDayEntry(day);
  const ownProject = editingProjectId
    ? auftraege.find(project => project.id === editingProjectId)
    : null;
  const othersOnDay = auftraege.filter(
    project => project.id !== editingProjectId
  );

  if (othersOnDay.length > 0) {
    const first = othersOnDay[0];

    return {
      day,
      kind: "auftrag",
      title: first.title || first.client || "Auftrag",
      count: othersOnDay.length
    };
  }

  if (ownProject) {
    return {
      day,
      kind: "own",
      title: ownProject.title || ownProject.client || "Auftrag"
    };
  }

  if (blockEntry) {
    return {
      day,
      kind: "blocked",
      reason: blockEntry.reason || "Privat"
    };
  }

  return { day, kind: "free" };
}

function getDayCalendarStatus(day, allProjects) {
  const auftraege = getAuftraegeOnCalendarDay(allProjects, day);
  const blockEntry = getBlockedDayEntry(day);

  if (auftraege.length > 0) {
    const first = auftraege[0];

    return {
      day,
      kind: "auftrag",
      title: first.title || first.client || "Auftrag",
      count: auftraege.length
    };
  }

  if (blockEntry) {
    return {
      day,
      kind: "blocked",
      reason: blockEntry.reason || "Privat"
    };
  }

  return { day, kind: "free" };
}

function checkTerminBooking(project, dateValue, allProjects) {
  const day = cpeExtractCalendarDay(dateValue);

  if (!day) {
    return {
      allowed: false,
      code: "INVALID",
      message: "Ungültiges Datum."
    };
  }

  const maxPerDay =
    cpeModuleState.config?.capacity?.maxAuftraegePerDay ?? 1;

  const onDayEntries = (Array.isArray(allProjects) ? allProjects : [])
    .filter(
      item =>
        String(item?.title || "").trim() !==
        (window.NF_CONFIG?.storno?.title || "AWISTA")
    )
    .map(item => ({
      id: item.id,
      day: cpeExtractCalendarDay(
        item.id === project?.id ? dateValue : item.date
      ),
      title: item.title || item.client || "Auftrag"
    }))
    .filter(entry => entry.day === day);

  const othersOnDay = onDayEntries.filter(
    entry => entry.id !== project?.id
  );

  if (othersOnDay.length >= maxPerDay) {
    const blocker = othersOnDay[0];

    return {
      allowed: false,
      code: "DAY_FULL",
      blockingDay: day,
      blockingProjectTitle: blocker.title,
      message:
        `Tag ${day} ausgebucht — ${blocker.title}. ` +
        "Leider nicht verfügbar."
    };
  }

  const blockEntry = getBlockedDayEntry(day);

  if (blockEntry) {
    const savedDay = cpeExtractCalendarDay(project?.date);
    const isExistingZlecung = savedDay === day;

    if (!isExistingZlecung) {
      const reason = blockEntry.reason || "Privat";

      return {
        allowed: false,
        code: "PRIVATE_BLOCK",
        blockingDay: day,
        blockingReason: reason,
        message:
          `Tag ${day} gesperrt — ${reason}. ` +
          "Keine Reservierung möglich."
      };
    }
  }

  if (!isEnabled() || !cpeModuleState.ready) {
    return { allowed: true, blockingDay: day };
  }

  return { allowed: true, blockingDay: day };
}

function isKundendatenAllowed(project, allProjects) {
  if (!project) {
    return {
      allowed: false,
      message: "Projekt nicht gefunden."
    };
  }

  if (!isEnabled() || !cpeModuleState.ready) {
    return { allowed: true };
  }

  if (!cpeExtractCalendarDay(project.date)) {
    return {
      allowed: false,
      code: "NO_TERMIN",
      message: "Bitte zuerst einen Termin wählen und speichern."
    };
  }

  const terminCheck = checkTerminBooking(
    project,
    project.date,
    allProjects
  );

  if (!terminCheck.allowed) {
    return {
      allowed: false,
      code: terminCheck.code,
      message: terminCheck.message,
      blockingDay: terminCheck.blockingDay,
      blockingProjectTitle: terminCheck.blockingProjectTitle
    };
  }

  const terminTask = Array.isArray(project.tasks)
    ? project.tasks.find(task => task.label === "Termin")
    : null;

  if (terminTask && !terminTask.done) {
    return {
      allowed: false,
      code: "TERMIN_OPEN",
      message:
        "Bitte Termin speichern, bevor Kundendaten eingegeben werden."
    };
  }

  return { allowed: true };
}

function resolveDayBlockerInfo(target, loaded, allProjects) {
  if (!target?.calendarDay) {
    return null;
  }

  const maxPerDay =
    cpeModuleState.config?.capacity?.maxAuftraegePerDay ??
    window.NF_CONFIG?.cpe?.capacity?.maxAuftraegePerDay ??
    1;

  const onDay = loaded.events.filter(
    event => event.calendarDay === target.calendarDay
  );

  if (onDay.length >= maxPerDay) {
    const first = onDay
      .slice()
      .sort((left, right) => left.anchorMs - right.anchorMs)[0];

    const blockerProject = allProjects.find(
      item => item.id === first.projectId
    );

    return {
      blockingDay: target.calendarDay,
      blockingProjectTitle:
        blockerProject?.title ||
        blockerProject?.client ||
        first.label ||
        "Auftrag"
    };
  }

  const blockEntry = getBlockedDayEntry(target.calendarDay);

  if (blockEntry) {
    return {
      blockingDay: target.calendarDay,
      privateBlock: true,
      privateBlockReason: blockEntry.reason || "Privat"
    };
  }

  return null;
}

function buildProjectAdvisory(project, allProjects) {
  cpeTryBorrowCatalog();

  const normalized = normalizeProject(project);
  const loaded = loadEvents(allProjects);
  const target =
    loaded.events.find(event => event.projectId === project.id) ||
    normalized.event;

  if (!target) {
    return {
      advisory: true,
      ok: false,
      score: 0,
      confidence: normalized.confidence || 0,
      scoreScale: cpeGetEngine().SCORE_SCALE,
      reasons: normalized.reasons || [],
      conflicts: [],
      warnings: [],
      meta: {
        projectId: project?.id,
        projectTitle: project?.title || project?.client,
        projectDate: project?.date || "",
        noAnchor: true
      }
    };
  }

  const assignment = validateAssignment(
    target,
    loaded.events,
    undefined
  );

  const calendarScan = analyzeProjects(allProjects);
  const blocker = resolveDayBlockerInfo(target, loaded, allProjects);
  const meta = {
    ...(assignment.meta || {}),
    projectId: project?.id,
    projectTitle: project?.title || project?.client,
    projectDate: project?.date || "",
    calendarConflictCount: calendarScan.conflicts.length,
    calendarWarningCount: calendarScan.warnings.length,
    ...(blocker || {})
  };

  if (blocker) {
    meta.dayCapacity = 0;
  }

  return {
    ...assignment,
    score: blocker ? 0 : assignment.score,
    meta
  };
}

function onProjectDateSaved(project, allProjects) {
  if (!isShadowMode()) {
    return null;
  }

  if (!cpeModuleState.ready) {
    console.info("[NF_cpe] Shadow: silnik niegotowy, pomijam advisory.");
    return null;
  }

  if (!project) {
    return null;
  }

  try {
    const advisory = buildProjectAdvisory(project, allProjects);

    if (advisory.meta?.noAnchor) {
      console.info("[NF_cpe] Shadow advisory — brak kotwicy zasobowej.");
      console.info("[NF_cpe] projectId:", project.id);
      cpeLogReasons("reasons", advisory.reasons);
      return advisory;
    }

    cpeLogShadowAdvisory(project.id, advisory);

    return advisory;
  } catch (error) {
    console.info("[NF_cpe] Shadow advisory skipped:", error.message);
    return null;
  }
}

function setupCpeShadow() {
  if (typeof initCpeModule !== "function") {
    return;
  }

  initCpeModule().catch(error => {
    console.info("[NF_cpe] Shadow init skipped:", error.message);
  });
}

window.NF_cpe = Object.freeze({
  init: initCpeModule,
  setup: setupCpeShadow,
  isEnabled,
  isShadowMode,
  getDefaultResources,
  normalizeProject,
  loadEvents,
  scanConflicts,
  validateAssignment,
  scoreSlot,
  proposeSlots,
  analyzeProjects,
  buildProjectAdvisory,
  onProjectDateSaved,
  checkTerminBooking,
  isKundendatenAllowed,
  getBlockedDays,
  getBlockedDayEntries,
  getBlockedDayEntry,
  setBlockedDay,
  removeBlockedDay,
  getDayCalendarStatus,
  getOperatorDayCalendarStatus,
  getAuftraegeOnCalendarDay,
  getState: () => ({
    advisory: true,
    ready: cpeModuleState.ready,
    enabled: isEnabled(),
    shadowMode: isShadowMode(),
    resourceCount: cpeModuleState.config?.resources?.length || 0
  })
});
