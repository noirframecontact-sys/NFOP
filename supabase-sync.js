"use strict";

/*
  NFOP 4.0 Phase 1.2 — Supabase transport layer.
  Supabase = source of truth for synced columns (on operator Synchronize).
  localStorage nfProjects = Last Known Workspace (immediate render, not source of truth).

  Remote events enqueue to Volvo Trunk (synchro.js) — no direct UI updates.
  Realtime synchronizes data. The operator controls the workspace.
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

function nfEnqueueRemoteChange(type, row, source) {

  if (!row?.id) {
    return;
  }

  const decision = window.NF_synchro?.shouldEnqueueInbound?.(type, row);

  if (decision && decision.enqueue === false) {
    return;
  }

  const resolvedType = decision?.type || type;

  window.NF_synchro?.enqueueInbound?.(
    resolvedType,
    row.id,
    row,
    source || "remote"
  );

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

async function nfUpdateProject(project) {

  if (!nfSyncState.client || !project?.id) {
    return { ok: false, reason: "not-ready" };
  }

  const operatorId = nfGetDeviceOperatorId();
  const row = nfProjectToRow(project, operatorId);

  const { error } = await nfSyncState.client
    .from("projects")
    .update({
      project_number: row.project_number,
      title: row.title,
      client_name: row.client_name,
      phone: row.phone,
      email: row.email,
      event_type: row.event_type,
      event_date: row.event_date,
      event_location: row.event_location,
      package: row.package,
      notes: row.notes,
      status: row.status,
      updated_at: row.updated_at,
      updated_by: row.updated_by
    })
    .eq("id", project.id);

  if (error) {
    throw error;
  }

  return { ok: true, reason: "updated" };

}

async function nfDeleteProject(projectId) {

  if (!nfSyncState.client || !projectId) {
    return { ok: false, reason: "not-ready" };
  }

  const { error } = await nfSyncState.client
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    throw error;
  }

  const syncedIds = nfLoadSyncedProjectIds();
  syncedIds.delete(projectId);
  nfSaveSyncedProjectIds(syncedIds);

  return { ok: true, reason: "deleted" };

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

  window.NF_synchro?.compareRemoteAndEnqueue?.(
    rows,
    "bootstrap"
  );

}

function nfQueueOutboundChange(type, projectId) {

  window.NF_synchro?.enqueueOutbound?.(type, projectId);

}

async function nfFlushSyncQueue(options) {

  const opts = options || {};

  if (!nfIsOnline() || !nfSyncState.client) {
    return { ok: false, reason: "offline" };
  }

  const queue = nfLoadSyncQueue();

  if (!queue.length) {
    return { ok: true, reason: "empty" };
  }

  const remaining = [];

  for (let index = 0; index < queue.length; index++) {

    const entry = queue[index];

    if (entry.type === "DELETE" && opts.skipDelete) {
      remaining.push(entry);
      continue;
    }

    const project = state.projects.find(
      item => item.id === entry.projectId
    );

    try {

      if (entry.type === "INSERT") {

        if (!project) {
          continue;
        }

        await nfInsertProject(project);

      } else if (entry.type === "UPDATE") {

        if (!project) {
          continue;
        }

        await nfUpdateProject(project);

      } else if (entry.type === "DELETE") {

        await nfDeleteProject(entry.projectId);

      } else {
        remaining.push(entry);
      }

    } catch (error) {
      console.error("[NF_sync] queue flush failed", entry, error);
      remaining.push(entry);
    }

  }

  nfSaveSyncQueue(remaining);

  return { ok: true };

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
          nfEnqueueRemoteChange(
            "NEW_PROJECT",
            payload.new,
            "realtime-insert"
          );
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
          nfEnqueueRemoteChange(
            "UPDATE_PROJECT",
            payload.new,
            "realtime-update"
          );
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "projects"
      },
      payload => {
        if (payload?.old) {
          nfEnqueueRemoteChange(
            "DELETE_PROJECT",
            payload.old,
            "realtime-delete"
          );
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
    const project = state.projects.find(item => item.id === projectId);

    if (!project) {
      continue;
    }

    if (syncedIds.has(projectId)) {
      nfQueueOutboundChange("UPDATE", projectId);
    } else {
      nfQueueOutboundChange("INSERT", projectId);
    }

  }

}

async function nfHandleConnectivityRestored() {

  await nfTestConnection();

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
      window.NF_synchro?.refreshFooter?.();
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
  flushOutboundQueue: nfFlushSyncQueue,
  getConnectionStatus: nfGetConnectionStatus,
  isOnline: nfIsOnline,
  projectToRow: nfProjectToRow,
  rowToProjectPatch: nfRowToProjectPatch,
  hydrateRemoteProject: nfHydrateRemoteProject,
  extractPackageSummary: nfExtractPackageSummary,
  resolveEventLocation: nfResolveEventLocation,
  loadSyncedProjectIds: nfLoadSyncedProjectIds,
  saveSyncedProjectIds: nfSaveSyncedProjectIds
};
