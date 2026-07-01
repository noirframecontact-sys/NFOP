"use strict";

/*
=========================================
CPE Shadow Mode — test suite
Uruchamiany wyłącznie z cpe-shadow.html (bez app.js)
=========================================
*/

(function () {

  const results = [];

  function assert(condition, message, details) {
    if (!condition) {
      const error = new Error(message);
      error.details = details;
      throw error;
    }
  }

  function assertAdvisory(result, label) {
    assert(result && result.advisory === true, `${label}: wynik musi być doradczy (advisory: true)`, result);
    assert(Array.isArray(result.reasons), `${label}: brak reasons[]`, result);
    assert(typeof result.confidence === "number", `${label}: brak confidence`, result);
    assert(typeof result.score === "number", `${label}: brak score`, result);
    assert(result.score >= 0 && result.score <= 100, `${label}: score poza 0–100`, result);
    assert(result.confidence >= 0 && result.confidence <= 100, `${label}: confidence poza 0–100`, result);
    assert(result.scoreScale === 100, `${label}: brak scoreScale 100`, result);
  }

  function assertConflictShape(conflict, label) {
    assert(Array.isArray(conflict.reasons) && conflict.reasons.length, `${label}: konflikt bez reasons[]`, conflict);
    assert(typeof conflict.confidence === "number", `${label}: konflikt bez confidence`, conflict);
    assert(typeof conflict.score === "number", `${label}: konflikt bez score`, conflict);
    assert(conflict.score >= 0 && conflict.score <= 100, `${label}: score poza 0–100`, conflict);
    assert(conflict.confidence >= 0 && conflict.confidence <= 100, `${label}: confidence poza 0–100`, conflict);
    assert(conflict.severity, `${label}: konflikt bez severity`, conflict);
  }

  function project(overrides) {
    return {
      id: overrides.id || "p1",
      title: overrides.title || "Test Projekt",
      client: "Test Kunde",
      date: overrides.date || "",
      eventType: overrides.eventType || "",
      notes: overrides.notes || "",
      eventCity: overrides.eventCity || "Erkrath",
      cpe: overrides.cpe || undefined
    };
  }

  function runCase(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({
        name,
        ok: false,
        message: error.message,
        details: error.details
      });
    }
  }

  function runShadowTests() {
    const engine = window.CPE_ENGINE;
    const NF = window.NF_cpe;

    assert(engine, "CPE_ENGINE missing");
    assert(NF, "NF_cpe missing");

    const baseContext = {
      config: engine.mergeConfig({}),
      catalog: {
        products: [
          { id: "outdoor-standard", name: "Outdoor Standard", duration: 120 },
          { id: "wedding-day", name: "Hochzeit Reportage", duration: 720 }
        ]
      }
    };

    runCase("01 — pojedynczy event bez kolizji", () => {
      const loaded = engine.loadEvents(
        [project({ id: "a1", date: "2026-08-10 14:00", cpe: { shootMin: 120, travelKm: 10 } })],
        baseContext
      );

      assert(loaded.events.length === 1, "event powinien powstać");

      const scan = engine.scanConflicts(loaded.events, engine.DEFAULT_RESOURCES, baseContext);
      assertAdvisory(scan, "scan");
      assert(scan.ok === true, "brak twardych konfliktów", scan);
      assert(scan.conflicts.length === 0, "conflicts powinny być puste", scan);
      assert(scan.score === 100, "100% Kapazität", scan);
      assert(scan.meta.dayCapacity === 100, "dayCapacity 100", scan);
    });

    runCase("02 — dwa Auftragi tego samego dnia = 0% Kapazität", () => {
      const loaded = engine.loadEvents(
        [
          project({ id: "b1", date: "2026-08-10 09:00", cpe: { shootMin: 120, travelKm: 10 } }),
          project({ id: "b2", date: "2026-08-10 18:00", cpe: { shootMin: 120, travelKm: 10 } })
        ],
        baseContext
      );

      const scan = engine.scanConflicts(loaded.events, engine.DEFAULT_RESOURCES, baseContext);
      assertAdvisory(scan, "scan");
      assert(scan.ok === false, "dzień z dwoma Auftragi", scan);
      assert(scan.score === 0, "0% Kapazität", scan);
      assert(scan.conflicts.length === 1, "jeden konflikt dnia", scan);
      assert(
        scan.conflicts[0].reasons.some(
          r => r.code === engine.REASON_CODES.DAY_CAPACITY_EXHAUSTED
        ),
        "DAY_CAPACITY_EXHAUSTED",
        scan
      );
    });

    runCase("03 — overlap tego samego dnia = DAY_CAPACITY", () => {
      const loaded = engine.loadEvents(
        [
          project({ id: "c1", date: "2026-08-12 12:00", cpe: { shootMin: 180, travelKm: 20 } }),
          project({ id: "c2", date: "2026-08-12 13:00", cpe: { shootMin: 180, travelKm: 20 } })
        ],
        baseContext
      );

      const scan = engine.scanConflicts(loaded.events, engine.DEFAULT_RESOURCES, baseContext);
      assertAdvisory(scan, "scan");
      assert(scan.ok === false, "oczekiwany konflikt", scan);
      assert(scan.conflicts.length === 1, "jeden konflikt dnia", scan);

      const dayConflict = scan.conflicts.find(c =>
        c.reasons.some(r => r.code === engine.REASON_CODES.DAY_CAPACITY_EXHAUSTED)
      );

      assert(dayConflict, "brak DAY_CAPACITY_EXHAUSTED", scan);
      assertConflictShape(dayConflict, "dayConflict");
    });

    runCase("04 — brak godziny obniża confidence", () => {
      const normalized = engine.normalizeProject(
        project({ id: "d1", date: "2026-08-15" }),
        baseContext
      );

      assert(normalized.event, "event z samą datą");
      assert(normalized.confidence < 90, "confidence powinno spaść", normalized);
      assert(
        normalized.reasons.some(r => r.code === engine.REASON_CODES.MISSING_TIME_INPUT),
        "brak MISSING_TIME_INPUT",
        normalized
      );
    });

    runCase("05 — brak daty = brak eventu + reason", () => {
      const normalized = engine.normalizeProject(
        project({ id: "d2", date: "" }),
        baseContext
      );

      assert(normalized.event === null, "brak eventu");
      assert(
        normalized.reasons.some(r => r.code === engine.REASON_CODES.NO_EVENT_ANCHOR),
        "NO_EVENT_ANCHOR",
        normalized
      );
    });

    runCase("06 — Drohne: Fotograf B w tym samym Auftrag", () => {
      const loaded = engine.loadEvents(
        [
          project({
            id: "e1",
            date: "2026-08-20 10:00",
            notes: "Bitte Drohne einplanen",
            cpe: { shootMin: 120, travelKm: 5 }
          })
        ],
        baseContext
      );

      const scan = engine.scanConflicts(loaded.events, engine.DEFAULT_RESOURCES, baseContext);
      assert(scan.ok === true, "pojedynczy Auftrag OK", scan);
      assert(scan.score === 100, "100% Kapazität", scan);
      assert(
        scan.reasons.some(r => r.code === engine.REASON_CODES.PHOTOGRAPHER_B_REQUIRED),
        "PHOTOGRAPHER_B_REQUIRED",
        scan
      );
    });

    runCase("07 — trzy eventy / jeden fotograf", () => {
      const loaded = engine.loadEvents(
        [
          project({ id: "f1", date: "2026-09-01 10:00", cpe: { shootMin: 240, travelKm: 10 } }),
          project({ id: "f2", date: "2026-09-01 12:00", cpe: { shootMin: 240, travelKm: 10 } }),
          project({ id: "f3", date: "2026-09-01 14:00", cpe: { shootMin: 240, travelKm: 10 } })
        ],
        baseContext
      );

      const scan = engine.scanConflicts(loaded.events, engine.DEFAULT_RESOURCES, baseContext);
      assert(scan.conflicts.length === 1, "jeden konflikt dnia", scan);
      assert(scan.score === 0, "0% Kapazität", scan);
      scan.conflicts.forEach((conflict, index) => {
        assertConflictShape(conflict, `conflict-${index}`);
      });
    });

    runCase("08 — human-day: 2 fotografów ≠ 2 Auftragi/dzień", () => {
      const events = engine.loadEvents(
        [
          project({ id: "g1", date: "2026-09-05 11:00", cpe: { shootMin: 180, travelKm: 10 } }),
          project({ id: "g2", date: "2026-09-05 12:00", cpe: { shootMin: 180, travelKm: 10 } })
        ],
        baseContext
      ).events;

      const scan = engine.scanConflicts(events, engine.DEFAULT_RESOURCES, baseContext);

      assert(scan.ok === false, "drugi Auftrag tego dnia zablokowany");
      assert(scan.score === 0, "0% Kapazität");
      assert(scan.conflicts.length === 1, "jeden konflikt dnia");
    });

    runCase("09 — validateAssignment zwraca reasons i confidence", () => {
      const loaded = engine.loadEvents(
        [
          project({ id: "h1", date: "2026-09-10 10:00", cpe: { shootMin: 120, travelKm: 10 } }),
          project({ id: "h2", date: "2026-09-10 11:00", cpe: { shootMin: 120, travelKm: 10 } })
        ],
        baseContext
      );

      const target = loaded.events.find(e => e.projectId === "h2");
      const validation = engine.validateAssignment(
        target,
        loaded.events,
        engine.DEFAULT_RESOURCES,
        baseContext
      );

      assertAdvisory(validation, "validateAssignment");
      assert(validation.ok === false, "powinien wykryć konflikt targetu");
      assert(validation.score === 0, "0% Kapazität", validation);
      assert(validation.meta.dayCapacity === 0, "dayCapacity 0", validation);
      assert(validation.conflicts.length > 0, "conflicts required");
    });

    runCase("10 — proposeSlots zwraca score + confidence (doradczo)", () => {
      const template = engine.normalizeProject(
        project({ id: "slot-target", date: "2026-10-01 12:00", cpe: { shootMin: 120, travelKm: 10 } }),
        baseContext
      ).event;

      const existing = engine.loadEvents(
        [project({ id: "slot-block", date: "2026-10-01 12:00", cpe: { shootMin: 240, travelKm: 10 } })],
        baseContext
      ).events;

      const proposal = engine.proposeSlots(
        {
          eventTemplate: template,
          searchStartMs: new Date("2026-10-01T06:00:00").getTime(),
          limit: 3
        },
        engine.DEFAULT_RESOURCES,
        existing,
        baseContext
      );

      assert(proposal.advisory === true, "proposal advisory");
      assert(Array.isArray(proposal.slots), "slots array");
      assert(proposal.reasons.length > 0, "reasons on proposal");

      if (proposal.slots.length) {
        proposal.slots.forEach((slot, index) => {
          assert(typeof slot.score === "number", `slot ${index} score`);
          assert(typeof slot.confidence === "number", `slot ${index} confidence`);
          assert(Array.isArray(slot.reasons), `slot ${index} reasons`);
        });
      }
    });

    runCase("11 — analyzeProjects przez NF_cpe wrapper", () => {
      const analysis = NF.analyzeProjects(
        [
          project({ id: "i1", date: "2026-11-01 09:00", cpe: { shootMin: 60, travelKm: 5 } }),
          project({ id: "i2", date: "2026-11-01 09:30", cpe: { shootMin: 60, travelKm: 5 } })
        ],
        { catalog: baseContext.catalog }
      );

      assertAdvisory(analysis, "analyzeProjects");
      assert(analysis.ok === false, "wrapper wykrywa konflikt");
    });

    runCase("12 — NF_cpe nigdy nie zapisuje (brak side-effect API)", () => {
      const forbidden = [
        "saveProjects",
        "persist",
        "write",
        "commit",
        "apply",
        "setProjectDate"
      ];

      forbidden.forEach(key => {
        assert(typeof NF[key] === "undefined", `NF_cpe nie powinien eksponować ${key}`);
      });
    });

    runCase("13 — tight turnaround = SOFT warning (resource mode)", () => {
      const physics = {
        ...engine.DEFAULT_PHYSICS,
        minGapMin: 120
      };

      const context = {
        ...baseContext,
        config: engine.mergeConfig({
          physics,
          capacity: { mode: engine.CAPACITY_MODES.RESOURCE }
        })
      };

      const loaded = engine.loadEvents(
        [
          project({ id: "j1", date: "2026-12-01 09:00", cpe: { shootMin: 120, travelKm: 5 } }),
          project({ id: "j2", date: "2026-12-01 13:50", cpe: { shootMin: 120, travelKm: 5 } })
        ],
        context
      );

      const scan = engine.scanConflicts(loaded.events, engine.DEFAULT_RESOURCES, context);
      assertAdvisory(scan, "tight turnaround");
      assert(scan.warnings.length > 0, "powinno być ostrzeżenie SOFT", scan);

      const tight = scan.warnings.find(w =>
        w.reasons.some(r => r.code === engine.REASON_CODES.TIGHT_TURNAROUND)
      );

      assert(tight, "TIGHT_TURNAROUND", scan);
      assertConflictShape(tight, "tight-warning");
    });

    runCase("14 — pusty input nie wywala silnika", () => {
      const scan = engine.scanConflicts([], engine.DEFAULT_RESOURCES, baseContext);
      assertAdvisory(scan, "empty scan");
      assert(scan.ok === true, "pusty kalendarz OK");
    });

    runCase("15 — rozszerzenie pojazdu (resource mode)", () => {
      const resourceContext = {
        ...baseContext,
        config: engine.mergeConfig({
          capacity: { mode: engine.CAPACITY_MODES.RESOURCE }
        })
      };

      const events = engine.loadEvents(
        [
          project({ id: "k1", date: "2027-01-10 11:00", cpe: { shootMin: 180, travelKm: 10 } }),
          project({ id: "k2", date: "2027-01-10 12:00", cpe: { shootMin: 180, travelKm: 10 } })
        ],
        baseContext
      ).events;

      const oneVehicle = engine.DEFAULT_RESOURCES;
      const expandedPool = oneVehicle.concat([
        {
          id: "vehicle-secondary",
          type: engine.RESOURCE_TYPES.VEHICLE,
          label: "Fahrzeug (Secondary)",
          capabilities: ["transport"],
          quantity: 1
        },
        {
          id: "photographer-secondary",
          type: engine.RESOURCE_TYPES.PHOTOGRAPHER,
          label: "Fotograf (Secondary)",
          capabilities: ["*"],
          quantity: 1
        },
        {
          id: "equipment-standard-secondary",
          type: engine.RESOURCE_TYPES.EQUIPMENT,
          label: "Standard Kit B",
          capabilities: ["standard"],
          quantity: 1
        }
      ]);

      function vehicleHard(scan) {
        return scan.conflicts.filter(conflict =>
          conflict.severity === engine.SEVERITY.HARD &&
          (
            conflict.reasons.some(reason =>
              reason.code === engine.REASON_CODES.RESOURCE_OVERLAP &&
              reason.evidence?.resourceType === engine.RESOURCE_TYPES.VEHICLE
            ) ||
            conflict.reasons.some(reason =>
              reason.code === engine.REASON_CODES.INSUFFICIENT_CAPACITY &&
              reason.evidence?.demand?.resourceType === engine.RESOURCE_TYPES.VEHICLE
            )
          )
        );
      }

      const oneScan = engine.scanConflicts(events, oneVehicle, resourceContext);
      const expandedScan = engine.scanConflicts(events, expandedPool, resourceContext);

      assert(vehicleHard(oneScan).length > 0, "1 pojazd — konflikt pojazdu");
      assert(vehicleHard(expandedScan).length === 0, "2 pojazdy — brak kolizji pojazdu");
    });

    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);

    return {
      passed,
      failed: failed.length,
      total: results.length,
      ok: failed.length === 0,
      results
    };
  }

  window.CPE_SHADOW_TESTS = Object.freeze({
    run: runShadowTests
  });

})();
