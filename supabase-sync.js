"use strict";

/*
  NFOP 4.0 Phase 1 — Supabase sync layer.
  Supabase = source of truth (normalized project columns).
  localStorage = offline working cache.

  STATUS: Schema review in progress — see supabase/SCHEMA-REVIEW.md
  Do not apply schema or enable production sync until approved.
*/

const NF_SYNC_QUEUE_KEY = "nfSyncQueue";
const NF_SYNCED_IDS_KEY = "nfSyncedProjectIds";
const NF_DEVICE_ID_KEY = "nfDeviceId";

const nfSyncState = {
  client: null,
  channel: null,
  configured: false,
  supabaseReachable: false,
  browserOnline: navigator.onLine !== false,
  lastConnectionTestAt: null,
  lastConnectionError: null,
  bootstrapped: false
};

function nfGetMergedConfig() {

  const base = window.NF_CONFIG?.supabase || {};
  const local = window.NF_CONFIG_LOCAL?.supabase || {};

  return {
    url: String(local.url || base.url || "").trim(),
    anonKey: String(local.anonKey || base.anonKey || "").trim()
  };

}

function nfGetDeviceOperatorId() {

  try {

    let deviceId = localStorage.getItem(NF_DEVICE_ID_KEY);

    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(NF_DEVICE_ID_KEY, deviceId);
    }

    return deviceId;

  } catch (error) {
    return "unknown-device";
  }

}

function nfLoadSyncedProjectIds() {

  try {

    const raw = localStorage.getItem(NF_SYNCED_IDS_KEY);

    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw);

    return new Set(Array.isArray(parsed) ? parsed : []);

  } catch (error) {
    return new Set();
  }

}

function nfSaveSyncedProjectIds(idSet) {

  try {
    localStorage.setItem(
      NF_SYNCED_IDS_KEY,
      JSON.stringify(Array.from(idSet))
    );
  } catch (error) {}

}

function nfLoadSyncQueue() {

  try {

    const raw = localStorage.getItem(NF_SYNC_QUEUE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {
    return [];
  }

}

function nfSaveSyncQueue(queue) {

  try {
    localStorage.setItem(
      NF_SYNC_QUEUE_KEY,
      JSON.stringify(queue)
    );
  } catch (error) {}

}

function nfNormalizeEventDate(value) {

  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  return text;

}

function nfResolveEventLocation(project) {

  if (typeof window.NF_formatEventAddress === "function") {
    return window.NF_formatEventAddress(project) || "";
  }

  return String(
    project?.eventAddress ||
    project?.location ||
    ""
  ).trim();

}

function nfExtractPackageSummary(notes) {

  const text = String(notes || "");
  const startTag = "[NF-ANGEBOT]";
  const endTag = "[/NF-ANGEBOT]";
  const start = text.indexOf(startTag);

  if (start === -1) {
    return "";
  }

  const contentStart = start + startTag.length;
  const end = text.indexOf(endTag, contentStart);
  const block = end === -1
    ? text.slice(contentStart)
    : text.slice(contentStart, end);

  const firstLine = block
    .split("\n")
    .map(line => line.trim())
    .find(Boolean);

  return firstLine || "";

}

function nfProjectToRow(project, operatorId) {

  const now = new Date().toISOString();
  const notes = project.notes || "";

  return {
    id: project.id,
    project_number: Number(project.number) || 0,
    title: project.title || "Neues Projekt",
    client_name: project.client || "",
    phone: project.phone || "",
    email: project.email || "",
    event_type: project.eventType || "",
    event_date: nfNormalizeEventDate(project.date),
    event_location: nfResolveEventLocation(project),
    package: nfExtractPackageSummary(notes),
    notes,
    status: project.status || "NEW",
    created_at: project.createdAt || now,
    updated_at: project.updatedAt || now,
    created_by: operatorId,
    updated_by: operatorId
  };

}

function nfRowToProjectPatch(row) {

  return {
    id: row.id,
    number: row.project_number,
    title: row.title,
    client: row.client_name,
    phone: row.phone || "",
    email: row.email || "",
    eventType: row.event_type,
    date: row.event_date || "",
    eventAddress: row.event_location || "",
    notes: row.notes || "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

}

function nfHydrateRemoteProject(row) {

  const patch = nfRowToProjectPatch(row);
  const existing = state.projects.find(
    project => project.id === patch.id
  );

  if (existing) {
    const merged = Object.assign({}, existing, patch);
    nfMigrateProjectRecord(merged);
    return merged;
  }

  const merged = Object.assign(
    {
      title: "Neues Projekt",
      client: "",
      phone: "",
      email: "",
      clientAddress: "",
      location: "",
      eventAddress: "",
      eventPostalCode: "",
      eventCity: "",
      eventStreet: "",
      eventHouseNumber: "",
      date: "",
      notes: "",
      guests: "",
      price: "",
      eventType: "",
      status: "NEW",
      offerHistory: [],
      tasks: []
    },
    patch
  );

  nfMigrateProjectRecord(merged);

  return merged;

}

function nfMigrateProjectRecord(project) {

  if (typeof migrateProjectTasks === "function") {
    migrateProjectTasks(project);
  }

  if (typeof migrateProjectRevision === "function") {
    migrateProjectRevision(project);
  }

  if (typeof migrateProjectOffer === "function") {
    migrateProjectOffer(project);
  }

  if (typeof migrateProjectAddress === "function") {
    migrateProjectAddress(project);
  }

}

function nfPersistLocalCache() {

  try {
    localStorage.setItem("nfProjects", JSON.stringify(state.projects));
  } catch (error) {
    console.error("[NF_sync] local cache write failed", error);
  }

}

function nfMergeRemoteProject(row, options) {

  const opts = options || {};
  const hydrated = nfHydrateRemoteProject(row);
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

  nfPersistLocalCache();

  if (!opts.silent && typeof renderProjects === "function") {
    renderProjects();
  }

  if (opts.emitEvent !== false) {
    window.NF_events?.emit?.(
      window.NF_events?.TYPES?.NEW_PROJECT,
      { projectId: hydrated.id, source: opts.source || "remote" }
    );
  }

}

function nfUpdateConnectionUi() {

  if (typeof renderFooter === "function") {
    renderFooter();
  }

}

function nfSetConnectionState(partial) {

  Object.assign(nfSyncState, partial);
  nfUpdateConnectionUi();

}

function nfIsOnline() {
  return nfSyncState.browserOnline && nfSyncState.supabaseReachable;
}

function nfGetConnectionStatus() {

  return {
    browserOnline: nfSyncState.browserOnline,
    supabaseReachable: nfSyncState.supabaseReachable,
    configured: nfSyncState.configured,
    online: nfIsOnline(),
    lastConnectionTestAt: nfSyncState.lastConnectionTestAt,
    lastConnectionError: nfSyncState.lastConnectionError
  };

}

async function nfTestConnection() {

  if (!nfSyncState.client) {
    nfSetConnectionState({
      supabaseReachable: false,
      lastConnectionTestAt: new Date().toISOString(),
      lastConnectionError: "Supabase client not configured"
    });
    return false;
  }

  try {

    const { error } = await nfSyncState.client
      .from("projects")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    nfSetConnectionState({
      supabaseReachable: true,
      lastConnectionTestAt: new Date().toISOString(),
      lastConnectionError: null
    });

    return true;

  } catch (error) {

    nfSetConnectionState({
      supabaseReachable: false,
      lastConnectionTestAt: new Date().toISOString(),
      lastConnectionError: error.message || String(error)
    });

    return false;

  }

}

async function nfInsertProject(project) {

  if (!nfSyncState.client || !project?.id) {
    return { ok: false, reason: "not-ready" };
  }

  const operatorId = nfGetDeviceOperatorId();
  const row = nfProjectToRow(project, operatorId);
  const syncedIds = nfLoadSyncedProjectIds();

  if (syncedIds.has(project.id)) {
    return { ok: true, reason: "already-synced" };
  }

  const { error } = await nfSyncState.client
    .from("projects")
    .insert(row);

  if (error) {

    if (error.code === "23505") {
      syncedIds.add(project.id);
      nfSaveSyncedProjectIds(syncedIds);
      return { ok: true, reason: "duplicate" };
    }

    throw error;

  }

  syncedIds.add(project.id);
  nfSaveSyncedProjectIds(syncedIds);

  window.NF_events?.emit?.(
    window.NF_events?.TYPES?.NEW_PROJECT,
    { projectId: project.id, source: "local-insert" }
  );

  return { ok: true, reason: "inserted" };

}

async function nfFetchProjects() {

  if (!nfSyncState.client) {
    return [];
  }

  const { data, error } = await nfSyncState.client
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];

}

async function nfBootstrapFromRemote() {

  const rows = await nfFetchProjects();
  const syncedIds = nfLoadSyncedProjectIds();

  rows.forEach(row => {
    nfMergeRemoteProject(row, {
      silent: true,
      emitEvent: false
    });
    syncedIds.add(row.id);
  });

  nfSaveSyncedProjectIds(syncedIds);

  if (typeof renderProjects === "function") {
    renderProjects();
  }

}

function nfQueueProjectInsert(projectId) {

  if (!projectId) {
    return;
  }

  const queue = nfLoadSyncQueue();

  if (queue.some(entry => entry.type === "INSERT" && entry.projectId === projectId)) {
    return;
  }

  queue.push({
    type: "INSERT",
    projectId,
    queuedAt: new Date().toISOString()
  });

  nfSaveSyncQueue(queue);

}

async function nfFlushSyncQueue() {

  if (!nfIsOnline() || !nfSyncState.client) {
    return;
  }

  const queue = nfLoadSyncQueue();

  if (!queue.length) {
    return;
  }

  const remaining = [];

  for (let index = 0; index < queue.length; index++) {

    const entry = queue[index];

    if (entry.type !== "INSERT") {
      remaining.push(entry);
      continue;
    }

    const project = state.projects.find(
      item => item.id === entry.projectId
    );

    if (!project) {
      continue;
    }

    try {
      await nfInsertProject(project);
    } catch (error) {
      console.error("[NF_sync] queue flush failed", entry, error);
      remaining.push(entry);
    }

  }

  nfSaveSyncQueue(remaining);

}

function nfSubscribeRealtime() {

  if (!nfSyncState.client || nfSyncState.channel) {
    return;
  }

  nfSyncState.channel = nfSyncState.client
    .channel("nfop-projects")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "projects"
      },
      payload => {
        if (payload?.new) {
          nfMergeRemoteProject(payload.new, {
            source: "realtime-insert"
          });
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "projects"
      },
      payload => {
        if (payload?.new) {
          nfMergeRemoteProject(payload.new, {
            source: "realtime-update",
            emitEvent: false
          });
        }
      }
    )
    .subscribe();

}

async function nfSchedulePersist(projectIds) {

  const ids = Array.isArray(projectIds)
    ? projectIds.filter(Boolean)
    : [];

  if (!ids.length) {
    return;
  }

  const syncedIds = nfLoadSyncedProjectIds();

  for (let index = 0; index < ids.length; index++) {

    const projectId = ids[index];

    if (syncedIds.has(projectId)) {
      continue;
    }

    const project = state.projects.find(item => item.id === projectId);

    if (!project) {
      continue;
    }

    if (!nfIsOnline()) {
      nfQueueProjectInsert(projectId);
      continue;
    }

    try {
      await nfInsertProject(project);
    } catch (error) {
      console.error("[NF_sync] insert failed", projectId, error);
      nfQueueProjectInsert(projectId);
      nfSetConnectionState({
        supabaseReachable: false,
        lastConnectionError: error.message || String(error)
      });
    }

  }

}

async function nfHandleConnectivityRestored() {

  const ok = await nfTestConnection();

  if (!ok) {
    return;
  }

  await nfFlushSyncQueue();

}

function nfSetupConnectivityListeners() {

  window.addEventListener("online", () => {
    nfSetConnectionState({ browserOnline: true });
    nfHandleConnectivityRestored();
  });

  window.addEventListener("offline", () => {
    nfSetConnectionState({
      browserOnline: false,
      supabaseReachable: false
    });
  });

}

async function nfInitSupabaseSync() {

  if (nfSyncState.bootstrapped) {
    return nfGetConnectionStatus();
  }

  nfSyncState.bootstrapped = true;
  nfSetupConnectivityListeners();

  const config = nfGetMergedConfig();

  if (!config.url || !config.anonKey) {
    nfSetConnectionState({
      configured: false,
      supabaseReachable: false,
      lastConnectionError: "Missing Supabase URL or anon key (config.local.js)"
    });
    return nfGetConnectionStatus();
  }

  if (typeof supabase?.createClient !== "function") {
    nfSetConnectionState({
      configured: true,
      supabaseReachable: false,
      lastConnectionError: "Supabase JS library not loaded"
    });
    return nfGetConnectionStatus();
  }

  nfSyncState.client = supabase.createClient(
    config.url,
    config.anonKey,
    {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  );

  nfSetConnectionState({
    configured: true
  });

  const connected = await nfTestConnection();

  if (connected) {
    try {
      await nfBootstrapFromRemote();
      nfSubscribeRealtime();

      const syncedIds = nfLoadSyncedProjectIds();
      const unsyncedIds = state.projects
        .map(project => project.id)
        .filter(projectId => !syncedIds.has(projectId));

      if (unsyncedIds.length) {
        await nfSchedulePersist(unsyncedIds);
      }

      await nfFlushSyncQueue();
    } catch (error) {
      console.error("[NF_sync] bootstrap failed", error);
      nfSetConnectionState({
        supabaseReachable: false,
        lastConnectionError: error.message || String(error)
      });
    }
  }

  return nfGetConnectionStatus();

}

window.NF_sync = {
  init: nfInitSupabaseSync,
  testConnection: nfTestConnection,
  schedulePersist: nfSchedulePersist,
  getConnectionStatus: nfGetConnectionStatus,
  isOnline: nfIsOnline,
  projectToRow: nfProjectToRow,
  rowToProjectPatch: nfRowToProjectPatch,
  extractPackageSummary: nfExtractPackageSummary,
  resolveEventLocation: nfResolveEventLocation
};
