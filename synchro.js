"use strict";

/*
  NFOP 4.0 Phase 1.2 — Volvo Trunk / Synchro Gate.

  Flow: Supabase → Realtime → Synchro Gate → Volvo Trunk Queue
        → Operator Synchronize → Apply → Render

  Realtime synchronizes data. The operator controls the workspace.
*/

const NF_VOLVO_TRUNK_KEY = "nfVolvoTrunk";

const nfSynchroRuntime = {
  detailsOpen: false,
  synchronizeRunning: false
};

function nfSynchroLoadTrunk() {

  try {

    const raw = localStorage.getItem(NF_VOLVO_TRUNK_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {
    return [];
  }

}

function nfSynchroSaveTrunk(entries) {

  try {
    localStorage.setItem(
      NF_VOLVO_TRUNK_KEY,
      JSON.stringify(Array.isArray(entries) ? entries : [])
    );
  } catch (error) {
    console.error("[NF_synchro] trunk save failed", error);
  }

}

function nfSynchroLoadOutbound() {

  if (typeof nfLoadSyncQueue === "function") {
    return nfLoadSyncQueue();
  }

  try {

    const raw = localStorage.getItem("nfSyncQueue");

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {
    return [];
  }

}

function nfSynchroSaveOutbound(queue) {

  if (typeof nfSaveSyncQueue === "function") {
    nfSaveSyncQueue(queue);
    return;
  }

  try {
    localStorage.setItem("nfSyncQueue", JSON.stringify(queue));
  } catch (error) {}

}

function nfSynchroGetPendingCount() {

  const inbound = nfSynchroLoadTrunk().length;
  const outbound = nfSynchroLoadOutbound().length;

  return inbound + outbound;

}

function nfSynchroTrunkLabel(type) {

  switch (type) {

    case "NEW_PROJECT":
      return "Neu";

    case "UPDATE_PROJECT":
      return "Update";

    case "DELETE_PROJECT":
      return "Löschen";

    default:
      return type;

  }

}

function nfSynchroOutboundLabel(type) {

  switch (type) {

    case "INSERT":
      return "Upload (neu)";

    case "UPDATE":
      return "Upload (Update)";

    case "DELETE":
      return "Upload (Löschen)";

    default:
      return type;

  }

}

function nfSynchroEntryTitle(entry, direction) {

  const row = entry.remoteRow;
  const projectId = entry.projectId;

  if (row?.title) {
    return String(row.title);
  }

  const local = typeof state !== "undefined"
    ? state.projects.find(project => project.id === projectId)
    : null;

  if (local?.title) {
    return String(local.title);
  }

  return direction === "outbound"
    ? "Lokal"
    : "Remote";

}

function nfSynchroReplaceTrunkEntry(entries, nextEntry) {

  const filtered = entries.filter(
    entry => entry.projectId !== nextEntry.projectId
  );

  filtered.push(nextEntry);

  return filtered;

}

function nfSynchroShouldEnqueueInbound(type, row) {

  const local = typeof state !== "undefined"
    ? state.projects.find(project => project.id === row?.id)
    : null;

  if (type === "DELETE_PROJECT") {
    return { enqueue: true, type };
  }

  if (!local) {
    return {
      enqueue: true,
      type: type === "UPDATE_PROJECT" ? "NEW_PROJECT" : type
    };
  }

  let resolvedType = type === "NEW_PROJECT" ? "UPDATE_PROJECT" : type;

  if (!nfSynchroRowDiffers(row, local)) {
    return { enqueue: false, type: resolvedType };
  }

  return { enqueue: true, type: resolvedType };

}

function nfSynchroEnqueueInbound(type, projectId, remoteRow, source) {

  if (!projectId) {
    return;
  }

  const entries = nfSynchroLoadTrunk();
  const nextEntry = {
    type,
    projectId,
    remoteRow: remoteRow || null,
    receivedAt: new Date().toISOString(),
    source: source || "remote"
  };

  const updated = nfSynchroReplaceTrunkEntry(entries, nextEntry);

  nfSynchroSaveTrunk(updated);
  nfSynchroRefreshFooter();

}

function nfSynchroCoalesceOutbound(entries, nextEntry) {

  let queue = entries.filter(entry => entry.projectId !== nextEntry.projectId);

  if (nextEntry.type === "DELETE") {
    nfSynchroSaveOutbound(queue.concat(nextEntry));
    return;
  }

  const existing = entries.find(
    entry => entry.projectId === nextEntry.projectId
  );

  if (existing?.type === "INSERT" && nextEntry.type === "UPDATE") {
    queue = entries.filter(entry => entry.projectId !== nextEntry.projectId);
    queue.push(existing);
    nfSynchroSaveOutbound(queue);
    return;
  }

  queue.push(nextEntry);
  nfSynchroSaveOutbound(queue);

}

function nfSynchroEnqueueOutbound(type, projectId) {

  if (!projectId) {
    return;
  }

  const entries = nfSynchroLoadOutbound();

  nfSynchroCoalesceOutbound(entries, {
    type,
    projectId,
    queuedAt: new Date().toISOString()
  });

  nfSynchroRefreshFooter();

}

function nfSynchroRemoteTimestamp(row) {

  const stamp = row?.updated_at || row?.created_at || "";

  const time = Date.parse(stamp);

  return Number.isFinite(time) ? time : 0;

}

function nfSynchroLocalTimestamp(project) {

  const stamp =
    project?.updatedAt ||
    project?.notesUpdatedAt ||
    project?.createdAt ||
    "";

  const time = Date.parse(stamp);

  return Number.isFinite(time) ? time : 0;

}

function nfSynchroRowDiffers(row, localProject) {

  if (!localProject || !row) {
    return true;
  }

  const patch = window.NF_sync?.rowToProjectPatch?.(row);

  if (!patch) {
    return true;
  }

  const fields = [
    ["number", "project_number"],
    ["title", "title"],
    ["client", "client_name"],
    ["phone", "phone"],
    ["email", "email"],
    ["eventType", "event_type"],
    ["date", "event_date"],
    ["notes", "notes"],
    ["status", "status"]
  ];

  for (let index = 0; index < fields.length; index++) {

    const localKey = fields[index][0];
    const remoteKey = fields[index][1];
    const localValue = String(localProject[localKey] ?? "").trim();
    const remoteValue = String(row[remoteKey] ?? patch[localKey] ?? "").trim();

    if (localValue !== remoteValue) {
      return true;
    }

  }

  const localLocation =
    typeof window.NF_sync?.resolveEventLocation === "function"
      ? window.NF_sync.resolveEventLocation(localProject)
      : String(localProject.eventAddress || "").trim();

  const remoteLocation = String(row.event_location || "").trim();

  if (localLocation !== remoteLocation) {
    return true;
  }

  return false;

}

function nfSynchroCompareRemoteAndEnqueue(rows, source) {

  const remoteRows = Array.isArray(rows) ? rows : [];
  const remoteIds = new Set(remoteRows.map(row => row.id));
  const localProjects = typeof state !== "undefined"
    ? state.projects
    : [];

  remoteRows.forEach(row => {

    if (!row?.id) {
      return;
    }

    const localProject = localProjects.find(
      project => project.id === row.id
    );

    if (!localProject) {
      nfSynchroEnqueueInbound(
        "NEW_PROJECT",
        row.id,
        row,
        source || "bootstrap"
      );
      return;
    }

    const remoteTime = nfSynchroRemoteTimestamp(row);
    const localTime = nfSynchroLocalTimestamp(localProject);

    if (
      remoteTime > localTime ||
      nfSynchroRowDiffers(row, localProject)
    ) {
      nfSynchroEnqueueInbound(
        "UPDATE_PROJECT",
        row.id,
        row,
        source || "bootstrap"
      );
    }

  });

  const syncedIds =
    typeof window.NF_sync?.loadSyncedProjectIds === "function"
      ? window.NF_sync.loadSyncedProjectIds()
      : new Set();

  localProjects.forEach(project => {

    if (!project?.id) {
      return;
    }

    if (!syncedIds.has(project.id)) {
      return;
    }

    if (!remoteIds.has(project.id)) {
      nfSynchroEnqueueInbound(
        "DELETE_PROJECT",
        project.id,
        { id: project.id, title: project.title || "" },
        source || "bootstrap"
      );
    }

  });

}

function nfSynchroApplyInboundEntry(entry) {

  if (!entry?.projectId) {
    return;
  }

  if (entry.type === "DELETE_PROJECT") {

    if (typeof state !== "undefined") {
      state.projects = state.projects.filter(
        project => project.id !== entry.projectId
      );
    }

    if (typeof window.NF_sync?.loadSyncedProjectIds === "function") {
      const syncedIds = window.NF_sync.loadSyncedProjectIds();
      syncedIds.delete(entry.projectId);
      window.NF_sync.saveSyncedProjectIds(syncedIds);
    }

    return;

  }

  if (!entry.remoteRow) {
    return;
  }

  const hydrate = window.NF_sync?.hydrateRemoteProject;

  if (typeof hydrate !== "function") {
    return;
  }

  const hydrated = hydrate(entry.remoteRow);
  const index = state.projects.findIndex(
    project => project.id === hydrated.id
  );

  if (index === -1) {
    state.projects.unshift(hydrated);
  } else {
    state.projects[index] = Object.assign(
      {},
      state.projects[index],
      hydrated
    );
  }

  if (typeof window.NF_sync?.loadSyncedProjectIds === "function") {
    const syncedIds = window.NF_sync.loadSyncedProjectIds();
    syncedIds.add(entry.projectId);
    window.NF_sync.saveSyncedProjectIds(syncedIds);
  }

}

function nfSynchroConfirmDeletes(deleteEntries) {

  if (!deleteEntries.length) {
    return true;
  }

  const titles = deleteEntries
    .slice(0, 3)
    .map(entry => nfSynchroEntryTitle(entry, "inbound"))
    .join(", ");

  const suffix = deleteEntries.length > 3
    ? " …"
    : "";

  const message = deleteEntries.length === 1
    ? "1 Remote-Löschung anwenden?\n\n" + titles
    : deleteEntries.length +
      " Remote-Löschungen anwenden?\n\n" +
      titles +
      suffix;

  return window.confirm(message);

}

function nfSynchroConfirmOutboundDeletes(deleteEntries) {

  if (!deleteEntries.length) {
    return true;
  }

  const message = deleteEntries.length === 1
    ? "1 lokalen Auftrag in Supabase löschen?"
    : deleteEntries.length +
      " lokale Aufträge in Supabase löschen?";

  return window.confirm(message);

}

async function nfSynchroFlushOutbound(skipDelete) {

  if (!window.NF_sync?.flushOutboundQueue) {
    return { ok: false, reason: "sync-not-ready" };
  }

  return window.NF_sync.flushOutboundQueue({
    skipDelete: skipDelete === true
  });

}

async function nfSynchroSynchronize() {

  if (nfSynchroRuntime.synchronizeRunning) {
    return { ok: false, reason: "busy" };
  }

  nfSynchroRuntime.synchronizeRunning = true;

  try {

    const trunk = nfSynchroLoadTrunk();
    const inboundDeletes = trunk.filter(
      entry => entry.type === "DELETE_PROJECT"
    );
    const outbound = nfSynchroLoadOutbound();
    const outboundDeletes = outbound.filter(
      entry => entry.type === "DELETE"
    );

    const applyDeletes = nfSynchroConfirmDeletes(inboundDeletes);
    const flushDeletes = nfSynchroConfirmOutboundDeletes(outboundDeletes);

    const inboundApply = trunk.filter(entry => {

      if (entry.type !== "DELETE_PROJECT") {
        return true;
      }

      return applyDeletes;

    });

    inboundApply.forEach(nfSynchroApplyInboundEntry);

    const remainingTrunk = trunk.filter(entry => {

      if (entry.type !== "DELETE_PROJECT") {
        return false;
      }

      return !applyDeletes;

    });

    nfSynchroSaveTrunk(remainingTrunk);

    await nfSynchroFlushOutbound(!flushDeletes);

    if (typeof saveProjects === "function") {
      saveProjects();
    }

    if (typeof renderProjects === "function") {
      renderProjects();
    }

    nfSynchroRefreshFooter();
    nfSynchroCloseDetails();

    return { ok: true };

  } catch (error) {

    console.error("[NF_synchro] synchronize failed", error);

    return {
      ok: false,
      reason: error.message || String(error)
    };

  } finally {
    nfSynchroRuntime.synchronizeRunning = false;
  }

}

function nfSynchroEscapeHtml(text) {

  if (typeof escapeHtml === "function") {
    return escapeHtml(text);
  }

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

}

function nfSynchroBuildDetailsHtml() {

  const trunk = nfSynchroLoadTrunk();
  const outbound = nfSynchroLoadOutbound();

  if (!trunk.length && !outbound.length) {
    return "<p class=\"nfSynchroDetailsEmpty\">Keine ausstehenden Änderungen.</p>";
  }

  let html = "";

  if (trunk.length) {

    html += "<h3 class=\"nfSynchroDetailsHeading\">Eingehend</h3><ul class=\"nfSynchroDetailsList\">";

    trunk.forEach(entry => {
      html +=
        "<li>" +
        nfSynchroEscapeHtml(nfSynchroTrunkLabel(entry.type)) +
        " — " +
        nfSynchroEscapeHtml(nfSynchroEntryTitle(entry, "inbound")) +
        "</li>";
    });

    html += "</ul>";

  }

  if (outbound.length) {

    html += "<h3 class=\"nfSynchroDetailsHeading\">Ausgehend</h3><ul class=\"nfSynchroDetailsList\">";

    outbound.forEach(entry => {

      const local = state.projects.find(
        project => project.id === entry.projectId
      );

      const title = local?.title || entry.projectId.slice(0, 8);

      html +=
        "<li>" +
        nfSynchroEscapeHtml(nfSynchroOutboundLabel(entry.type)) +
        " — " +
        nfSynchroEscapeHtml(title) +
        "</li>";

    });

    html += "</ul>";

  }

  return html;

}

function nfSynchroEnsureDetailsModal() {

  let modal = document.getElementById("nfSynchroDetailsModal");

  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = "nfSynchroDetailsModal";
  modal.className = "modal hidden";

  modal.innerHTML =
    "<div class=\"modalContent nfSynchroDetailsModal\">" +
    "<h2>Volvo Trunk</h2>" +
    "<div id=\"nfSynchroDetailsBody\"></div>" +
    "<button type=\"button\" id=\"nfSynchroDetailsCloseBtn\">Schließen</button>" +
    "</div>";

  document.body.appendChild(modal);

  modal.addEventListener("click", event => {

    if (
      event.target === modal ||
      event.target.closest("#nfSynchroDetailsCloseBtn")
    ) {
      nfSynchroCloseDetails();
    }

  });

  return modal;

}

function nfSynchroOpenDetails() {

  const modal = nfSynchroEnsureDetailsModal();
  const body = document.getElementById("nfSynchroDetailsBody");

  if (body) {
    body.innerHTML = nfSynchroBuildDetailsHtml();
  }

  modal.classList.remove("hidden");
  nfSynchroRuntime.detailsOpen = true;

}

function nfSynchroCloseDetails() {

  const modal = document.getElementById("nfSynchroDetailsModal");

  if (modal) {
    modal.classList.add("hidden");
  }

  nfSynchroRuntime.detailsOpen = false;

}

function nfSynchroRefreshFooter() {

  const pendingEl = document.getElementById("nfSyncPendingCount");
  const syncBtn = document.getElementById("nfSynchronizeBtn");
  const onlineEl = document.getElementById("nfDashboardOnline");
  const count = nfSynchroGetPendingCount();
  const connection = window.NF_sync?.getConnectionStatus?.() || {};
  const supabaseConfigured = connection.configured !== false;
  const isOnline = connection.online === true;

  const onlineTitle = !supabaseConfigured
    ? "Supabase nicht konfiguriert"
    : isOnline
      ? "Online · Supabase verbunden"
      : "Offline · Supabase nicht erreichbar";

  if (onlineEl) {
    onlineEl.classList.toggle("heroOnlineBtn--up", isOnline);
    onlineEl.classList.toggle("heroOnlineBtn--down", !isOnline);
    onlineEl.title = onlineTitle;
    onlineEl.setAttribute("aria-label", onlineTitle);
  }

  if (pendingEl) {
    const countSpan = pendingEl.querySelector(".heroPendingCount");

    if (countSpan) {
      countSpan.textContent = String(count);
    }

    pendingEl.classList.toggle("heroPendingBtn--active", count > 0);
    pendingEl.setAttribute(
      "aria-label",
      count + " ausstehende Änderungen"
    );
  }

  if (syncBtn) {
    syncBtn.disabled = count === 0 || nfSynchroRuntime.synchronizeRunning;
  }

  if (nfSynchroRuntime.detailsOpen) {
    const body = document.getElementById("nfSynchroDetailsBody");

    if (body) {
      body.innerHTML = nfSynchroBuildDetailsHtml();
    }
  }

  if (!pendingEl && typeof renderDashboard === "function") {
    renderDashboard();
  }

}

function nfSynchroSetupFooterInteractions() {

  document
    .getElementById("nfSynchronizeBtn")
    ?.addEventListener("click", () => {
      nfSynchroSynchronize();
    });

  document
    .getElementById("nfSyncPendingCount")
    ?.addEventListener("click", () => {
      nfSynchroOpenDetails();
    });

}

window.NF_synchro = {
  enqueueInbound: nfSynchroEnqueueInbound,
  shouldEnqueueInbound: nfSynchroShouldEnqueueInbound,
  enqueueOutbound: nfSynchroEnqueueOutbound,
  compareRemoteAndEnqueue: nfSynchroCompareRemoteAndEnqueue,
  getPendingCount: nfSynchroGetPendingCount,
  getTrunkEntries: nfSynchroLoadTrunk,
  getOutboundEntries: nfSynchroLoadOutbound,
  synchronize: nfSynchroSynchronize,
  refreshFooter: nfSynchroRefreshFooter,
  setupFooterInteractions: nfSynchroSetupFooterInteractions
};
