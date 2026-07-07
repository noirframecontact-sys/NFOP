"use strict";

/*
=========================================
NOIRFRAME — Backup / Save As / Open From
Schema v1 — pod sync 3× iPad
=========================================
*/

const NF_BACKUP_SCHEMA_VERSION = 1;
const NF_BLOCKED_DAYS_STORAGE_KEY = "nfBlockedDays";
const NF_SYNC_SNAPSHOT_KEY = "nfSyncSnapshot";
const NF_BACKUP_DEVICE_ID_KEY = "nfDeviceId";

const backupRuntime = {
  lastSnapshotHash: "",
  setupDone: false
};

function backupGetConfig() {
  return window.NF_CONFIG?.backup || {};
}

function backupGetAppBuild() {
  return window.NF_CONFIG?.app?.build || "iPAD9-3.0";
}

function backupGetProjects() {
  if (typeof window.NF_getProjects === "function") {
    return window.NF_getProjects() || [];
  }

  if (typeof state !== "undefined" && Array.isArray(state.projects)) {
    return state.projects;
  }

  return [];
}

function backupCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function backupGetDeviceId() {
  try {
    let deviceId = localStorage.getItem(NF_BACKUP_DEVICE_ID_KEY);

    if (!deviceId) {
      deviceId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "nf-device-" + Date.now();

      localStorage.setItem(NF_BACKUP_DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (error) {
    return "nf-device-unknown";
  }
}

function backupReadBlockedDays() {
  try {
    const saved = localStorage.getItem(NF_BLOCKED_DAYS_STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(entry => {
        if (typeof entry === "string" && entry.trim()) {
          return { day: entry.trim(), reason: "Privat" };
        }

        if (entry && typeof entry.day === "string" && entry.day.trim()) {
          return {
            day: entry.day.trim(),
            reason: String(entry.reason || "Privat").trim() || "Privat"
          };
        }

        return null;
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function backupWriteBlockedDays(entries) {
  localStorage.setItem(
    NF_BLOCKED_DAYS_STORAGE_KEY,
    JSON.stringify(Array.isArray(entries) ? entries : [])
  );
}

function backupNormalizeProjects(rawProjects) {
  const projects = backupCloneJson(
    Array.isArray(rawProjects) ? rawProjects : []
  );

  if (typeof migrateAllProjects === "function") {
    migrateAllProjects(projects);
  } else {
    projects.forEach(migrateProjectAddress);
    projects.forEach(migrateProjectOffer);
    projects.forEach(migrateProjectNotes);
    projects.forEach(migrateProjectTasks);
    projects.forEach(migrateProjectRevision);
  }

  return projects;
}

function backupBuildEnvelope(projects) {
  return {
    schemaVersion: NF_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appBuild: backupGetAppBuild(),
    deviceId: backupGetDeviceId(),
    projects: backupCloneJson(Array.isArray(projects) ? projects : []),
    blockedDays: backupReadBlockedDays(),
    theme: localStorage.getItem("nfTheme") || "light"
  };
}

function backupParseEnvelope(rawText) {
  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error("Ungültige JSON-Datei.");
  }

  if (Array.isArray(parsed)) {
    return {
      schemaVersion: 0,
      exportedAt: null,
      appBuild: "legacy",
      deviceId: null,
      projects: parsed,
      blockedDays: [],
      theme: null,
      legacy: true
    };
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Backup-Format nicht erkannt.");
  }

  if (!Array.isArray(parsed.projects)) {
    throw new Error("Backup enthält keine Projekte.");
  }

  return parsed;
}

function backupGetProjectRevision(project) {
  const stamp =
    project?.updatedAt ||
    project?.notesUpdatedAt ||
    project?.lastOfferSentAt ||
    project?.createdAt ||
    "";

  const time = Date.parse(stamp);

  return Number.isFinite(time) ? time : 0;
}

function backupMergeProjects(localProjects, incomingProjects) {
  const merged = new Map();

  backupNormalizeProjects(localProjects).forEach(project => {
    merged.set(project.id, project);
  });

  backupNormalizeProjects(incomingProjects).forEach(project => {
    const existing = merged.get(project.id);

    if (!existing) {
      merged.set(project.id, project);
      return;
    }

    if (
      backupGetProjectRevision(project) >=
      backupGetProjectRevision(existing)
    ) {
      merged.set(project.id, project);
    }
  });

  return Array.from(merged.values());
}

function backupMergeBlockedDays(localEntries, incomingEntries) {
  const merged = new Map();

  (Array.isArray(localEntries) ? localEntries : []).forEach(entry => {
    if (entry?.day) {
      merged.set(entry.day, entry);
    }
  });

  (Array.isArray(incomingEntries) ? incomingEntries : []).forEach(entry => {
    if (entry?.day) {
      merged.set(entry.day, entry);
    }
  });

  return Array.from(merged.values());
}

function backupApplyTheme(themeValue) {
  if (!themeValue || typeof applyTheme !== "function") {
    return;
  }

  applyTheme(themeValue === "dark" ? "dark" : "light");
}

function backupQueueEnvelopeProjectsOutbound(projectIds) {

  const ids = Array.isArray(projectIds)
    ? projectIds.filter(Boolean)
    : [];

  if (!ids.length) {
    return;
  }

  const syncedIds =
    typeof window.NF_sync?.loadSyncedProjectIds === "function"
      ? window.NF_sync.loadSyncedProjectIds()
      : new Set();

  ids.forEach(projectId => {
    const type = syncedIds.has(projectId) ? "UPDATE" : "INSERT";
    window.NF_synchro?.enqueueOutbound?.(type, projectId);
  });

  window.NF_synchro?.refreshFooter?.();

}

function backupApplyEnvelope(envelope, mode) {
  const normalizedMode = mode === "merge" ? "merge" : "replace";
  const incomingProjects = backupNormalizeProjects(envelope.projects);
  const localProjects = backupGetProjects();

  if (typeof state !== "undefined") {
    state.projects =
      normalizedMode === "merge"
        ? backupMergeProjects(localProjects, incomingProjects)
        : incomingProjects;
  } else {
    throw new Error("Projektstatus nicht verfügbar.");
  }

  const blockedDays =
    normalizedMode === "merge"
      ? backupMergeBlockedDays(
          backupReadBlockedDays(),
          envelope.blockedDays || []
        )
      : Array.isArray(envelope.blockedDays)
        ? envelope.blockedDays
        : [];

  backupWriteBlockedDays(blockedDays);

  if (normalizedMode === "replace" && envelope.theme) {
    backupApplyTheme(envelope.theme);
  }

  backupQueueEnvelopeProjectsOutbound(
    incomingProjects.map(project => project.id)
  );

  if (typeof saveProjects === "function") {
    saveProjects();
  }

  if (typeof renderProjects === "function") {
    renderProjects();
  }

  if (typeof updateMooseModeStatus === "function") {
    updateMooseModeStatus();
  }

  window.NF_operatorTerminCal?.reset?.();
  window.NF_supervisorCal?.close?.();

  backupWriteSyncSnapshot(true);

  return {
    ok: true,
    mode: normalizedMode,
    projectCount: state.projects.length
  };
}

function backupSanitizeFilename(name) {
  return String(name || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function backupTimestampFilename() {
  const now = new Date();
  const pad = value => String(value).padStart(2, "0");

  const stamp =
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate()) +
    "_" +
    pad(now.getHours()) +
    "-" +
    pad(now.getMinutes()) +
    "-" +
    pad(now.getSeconds());

  return "NFOP_" + stamp;
}

function backupDefaultFilename() {
  return backupTimestampFilename();
}

function backupDownloadEnvelope(envelope, filename) {
  const safeName = backupSanitizeFilename(filename) || backupDefaultFilename();
  const payload = JSON.stringify(envelope, null, 2);
  const blob = new Blob([payload], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = safeName.endsWith(".json") ? safeName : `${safeName}.json`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// TODO CLEANUP NFOP 3.2 — brak UI; tylko eksport programistyczny
function backupExportDefault() {
  backupDownloadEnvelope(
    backupBuildEnvelope(backupGetProjects()),
    backupDefaultFilename()
  );
}

function backupSaveAs() {

  const duplicate = backupDuplicateActiveProjectLocally();

  backupDownloadEnvelope(
    backupBuildEnvelope(backupGetProjects()),
    backupTimestampFilename()
  );

  if (duplicate) {
    window.NF_synchro?.refreshFooter?.();
  }

}

function backupResolveActiveProject() {

  const activeId =
    typeof window.NF_getActiveProjectId === "function"
      ? window.NF_getActiveProjectId()
      : null;

  if (activeId) {
    return backupGetProjects().find(project => project.id === activeId) || null;
  }

  const projects = backupGetProjects().filter(
    project => typeof isProjectComplete === "function"
      ? !isProjectComplete(project)
      : true
  );

  if (projects.length === 1) {
    return projects[0];
  }

  if (!projects.length) {
    return null;
  }

  const lines = projects.map((project, index) => {
    return (
      String(index + 1) +
      ". " +
      (project.title || "Neues Projekt") +
      " — " +
      (project.client || "Kunde")
    );
  });

  // TODO NFOP 3.2 — nativer prompt(); eigenes Modal
  const choice = window.prompt(
    "Save As — welchen Auftrag duplizieren?\n\n" +
      lines.join("\n") +
      "\n\nNummer eingeben (Abbrechen = nur JSON-Export):"
  );

  if (choice === null || String(choice).trim() === "") {
    return null;
  }

  const index = Number(choice) - 1;

  if (!Number.isInteger(index) || index < 0 || index >= projects.length) {
    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    window.alert("Ungültige Auswahl — nur JSON-Export.");
    return null;
  }

  return projects[index];

}

function backupDuplicateActiveProjectLocally() {

  const source = backupResolveActiveProject();

  if (!source) {
    return null;
  }

  const duplicate = backupCloneJson(source);
  const projects = backupGetProjects();
  const maxNumber = projects.reduce(
    (max, project) => Math.max(max, Number(project.number) || 0),
    0
  );

  duplicate.id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "nf-copy-" + Date.now();

  duplicate.number = maxNumber + 1;
  duplicate.title =
    String(source.title || "Neues Projekt").trim() + " (Kopie)";

  const now = new Date().toISOString();
  duplicate.createdAt = now;
  duplicate.updatedAt = now;
  duplicate.notesUpdatedAt = "";
  duplicate.lastOfferSentAt = "";
  duplicate.lastOfferVersion = "";
  duplicate.offerHistory = Array.isArray(source.offerHistory)
    ? backupCloneJson(source.offerHistory)
    : [];
  duplicate.collapsed = false;

  if (typeof state !== "undefined") {
    state.projects.unshift(duplicate);
  }

  if (typeof saveProjects === "function") {
    saveProjects(duplicate.id);
  }

  if (typeof renderProjects === "function") {
    renderProjects();
  }

  return duplicate;

}

function backupConfirmImportMode(envelope) {
  const projectCount = envelope.projects.length;
  const blockedCount = Array.isArray(envelope.blockedDays)
    ? envelope.blockedDays.length
    : 0;
  const exportedAt = envelope.exportedAt
    ? `\nExport: ${envelope.exportedAt}`
    : "";
  const legacyHint = envelope.legacy
    ? "\n(Legacy-Format — nur Projekte)"
    : "";

  // TODO NFOP 3.2 — nativer confirm(); eigenes Modal
  const mergeOk = window.confirm(
    "Backup laden — Merge?\n\n" +
      "OK = Merge (neuere Aufträge nach updatedAt gewinnen)\n" +
      "Abbrechen = nächste Option" +
      exportedAt +
      legacyHint +
      `\n\nProjekte: ${projectCount}\nSperren: ${blockedCount}`
  );

  if (mergeOk) {
    return "merge";
  }

  // TODO NFOP 3.2 — nativer confirm(); eigenes Modal
  const replaceOk = window.confirm(
    "Backup komplett ersetzen?\n\n" +
      "Alle lokalen Projekte und Supervisor-Sperren " +
      "werden durch die Datei ersetzt.\n\n" +
      "Fortfahren?"
  );

  return replaceOk ? "replace" : null;
}

function backupOpenFromFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const envelope = backupParseEnvelope(String(reader.result || ""));
      const mode = backupConfirmImportMode(envelope);

      if (!mode) {
        return;
      }

      const result = backupApplyEnvelope(envelope, mode);

      // TODO NFOP 3.2 — nativer alert(); eigenes Modal
      window.alert(
        `Backup geladen (${result.mode}).\n` +
          `${result.projectCount} Projekt(e) aktiv.`
      );
    } catch (error) {
      // TODO NFOP 3.2 — nativer alert(); eigenes Modal
      window.alert(
        error?.message || "Backup konnte nicht geladen werden."
      );
    }
  };

  reader.onerror = () => {
    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    window.alert("Datei konnte nicht gelesen werden.");
  };

  reader.readAsText(file);
}

function backupHashEnvelope(envelope) {
  return JSON.stringify(envelope);
}

function backupWriteSyncSnapshot(force) {
  const config = backupGetConfig();

  if (!config.autoSnapshotOnSave && !force) {
    return;
  }

  try {
    const envelope = backupBuildEnvelope(backupGetProjects());
    const hash = backupHashEnvelope(envelope);

    if (!force && hash === backupRuntime.lastSnapshotHash) {
      return;
    }

    backupRuntime.lastSnapshotHash = hash;
    localStorage.setItem(
      NF_SYNC_SNAPSHOT_KEY,
      JSON.stringify(envelope)
    );
  } catch (error) {
    console.info("[NF_backup] Snapshot skipped:", error.message);
  }
}

function backupOnLocalDataSaved() {
  backupWriteSyncSnapshot(false);
}

function setupBackupModule() {
  if (backupRuntime.setupDone) {
    return;
  }

  backupRuntime.setupDone = true;

  document
    .getElementById("serviceSaveAsBackupBtn")
    ?.addEventListener("click", backupSaveAs);

  document
    .getElementById("backupImportInput")
    ?.addEventListener("change", event => {
      const file = event.target?.files?.[0];

      backupOpenFromFile(file);

      if (event.target) {
        event.target.value = "";
      }
    });

  window.addEventListener("online", () => {
    backupWriteSyncSnapshot(true);
  });

  backupWriteSyncSnapshot(true);
}

window.NF_backup = Object.freeze({
  setup: setupBackupModule,
  buildEnvelope: backupBuildEnvelope,
  exportDefault: backupExportDefault,
  saveAs: backupSaveAs,
  openFromFile: backupOpenFromFile,
  applyEnvelope: backupApplyEnvelope,
  mergeProjects: backupMergeProjects,
  onLocalDataSaved: backupOnLocalDataSaved,
  getSyncSnapshotKey: () => NF_SYNC_SNAPSHOT_KEY
});
