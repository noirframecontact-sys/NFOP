"use strict";

/*
  NFOP 4.1 — Supabase transport layer.

  Projects: Volvo Trunk for non-calendar fields; Calendar Lane auto-applies event_date.
  Supervisor blocks: Calendar Lane auto-apply (no Volvo Trunk).
  localStorage nfProjects / nfBlockedDays = Last Known Workspace.
*/

const NF_SYNC_QUEUE_KEY = "nfSyncQueue";
const NF_SYNCED_IDS_KEY = "nfSyncedProjectIds";
const NF_DEVICE_ID_KEY = "nfDeviceId";

const nfSyncState = {
  client: null,
  channel: null,
  blocksChannel: null,
  configured: false,
  supabaseReachable: false,
  browserOnline: navigator.onLine !== false,
  lastConnectionTestAt: null,
  lastConnectionError: null,
  bootstrapped: false,
  calendarLaneEnabled: true,
  supervisorBlocksReady: false,
  blocksWatchTimer: null
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

function nfEmitCalendarChanged(payload) {

  window.NF_events?.emit?.(
    window.NF_events?.TYPES?.CALENDAR_CHANGED,
    payload || {}
  );

}

function nfSaveProjectsSnapshot() {

  if (typeof state === "undefined" || !Array.isArray(state.projects)) {
    return;
  }

  try {
    localStorage.setItem(
      "nfProjects",
      JSON.stringify(state.projects)
    );
  } catch (error) {}

}

function nfCalendarLaneOnlyDiffers(row, localProject) {

  if (!localProject || !row) {
    return false;
  }

  const patch = nfRowToProjectPatch(row);

  if (!patch) {
    return false;
  }

  const remoteDate = String(patch.date ?? "").trim();
  const localDate = String(localProject.date ?? "").trim();

  if (remoteDate === localDate) {
    return false;
  }

  const scalarFields = [
    ["number", "project_number"],
    ["title", "title"],
    ["client", "client_name"],
    ["phone", "phone"],
    ["email", "email"],
    ["eventType", "event_type"],
    ["notes", "notes"],
    ["status", "status"]
  ];

  for (let index = 0; index < scalarFields.length; index += 1) {

    const localKey = scalarFields[index][0];
    const remoteKey = scalarFields[index][1];
    const localValue = String(localProject[localKey] ?? "").trim();
    const remoteValue = String(row[remoteKey] ?? patch[localKey] ?? "").trim();

    if (localValue !== remoteValue) {
      return false;
    }

  }

  const localLocation = nfResolveEventLocation(localProject);
  const remoteLocation = String(row.event_location || "").trim();

  if (localLocation !== remoteLocation) {
    return false;
  }

  return true;

}

function nfApplyCalendarLaneDate(row, source) {

  if (!nfSyncState.calendarLaneEnabled || !row?.id) {
    return false;
  }

  const remoteDate = nfNormalizeEventDate(row.event_date) || "";
  const localProject = typeof state !== "undefined"
    ? state.projects.find(project => project.id === row.id)
    : null;

  if (!localProject) {

    if (!remoteDate) {
      return false;
    }

    const hydrated = nfHydrateRemoteProject(row);

    if (typeof state !== "undefined") {
      state.projects.unshift(hydrated);
      nfSaveProjectsSnapshot();

      const syncedIds = nfLoadSyncedProjectIds();
      syncedIds.add(row.id);
      nfSaveSyncedProjectIds(syncedIds);
    }

    nfEmitCalendarChanged({
      projectId: row.id,
      date: remoteDate,
      source: source || "calendar-lane-insert"
    });

    return true;

  }

  const localDate = String(localProject.date ?? "").trim();

  if (localDate === remoteDate) {
    return false;
  }

  localProject.date = remoteDate;
  nfSaveProjectsSnapshot();

  nfEmitCalendarChanged({
    projectId: row.id,
    date: remoteDate,
    source: source || "calendar-lane-update"
  });

  return true;

}

function nfIsCalendarLaneInbound(type, row) {

  if (!nfSyncState.calendarLaneEnabled || !row?.id) {
    return false;
  }

  const localProject = typeof state !== "undefined"
    ? state.projects.find(project => project.id === row.id)
    : null;

  if (type === "NEW_PROJECT" || type === "UPDATE_PROJECT") {

    if (!localProject) {
      return Boolean(nfNormalizeEventDate(row.event_date));
    }

    return nfCalendarLaneOnlyDiffers(row, localProject);

  }

  return false;

}

function nfEnqueueRemoteChange(type, row, source) {

  if (!row?.id) {
    return;
  }

  nfApplyCalendarLaneDate(row, source);

  if (nfIsCalendarLaneInbound(type, row)) {
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

async function nfFetchSupervisorBlocks() {

  if (!nfSyncState.client) {
    return [];
  }

  const { data, error } = await nfSyncState.client
    .from("supervisor_blocks")
    .select("*")
    .order("block_day", { ascending: true });

  if (error) {
    if (error.code === "PGRST205") {
      nfSyncState.supervisorBlocksReady = false;
      return [];
    }
    throw error;
  }

  nfSyncState.supervisorBlocksReady = true;
  nfStopSupervisorBlocksWatch();
  return Array.isArray(data) ? data : [];

}

async function nfBootstrapBlocksFromRemote() {

  const rows = await nfFetchSupervisorBlocks();

  window.NF_calendarStore?.replaceCacheFromRemote?.(rows);

}

async function nfUpsertSupervisorBlock(blockDay, reason) {

  if (!nfSyncState.client || !blockDay) {
    return { ok: false, reason: "not-ready" };
  }

  const operatorId = nfGetDeviceOperatorId();
  const normalizedDay = String(blockDay).trim();
  const normalizedReason =
    String(reason || "Privat").trim() || "Privat";

  const { error } = await nfSyncState.client
    .from("supervisor_blocks")
    .upsert({
      block_day: normalizedDay,
      reason: normalizedReason,
      updated_by: operatorId,
      created_by: operatorId
    }, {
      onConflict: "block_day"
    });

  if (error) {
    if (error.code === "PGRST205") {
      nfSyncState.supervisorBlocksReady = false;
      return { ok: false, code: "PGRST205", error };
    }
    throw error;
  }

  nfSyncState.supervisorBlocksReady = true;
  return { ok: true, reason: "upserted" };

}

async function nfDeleteSupervisorBlock(blockDay) {

  if (!nfSyncState.client || !blockDay) {
    return { ok: false, reason: "not-ready" };
  }

  const { error } = await nfSyncState.client
    .from("supervisor_blocks")
    .delete()
    .eq("block_day", String(blockDay).trim());

  if (error) {
    if (error.code === "PGRST205") {
      nfSyncState.supervisorBlocksReady = false;
      return { ok: false, code: "PGRST205", error };
    }
    throw error;
  }

  nfSyncState.supervisorBlocksReady = true;
  return { ok: true, reason: "deleted" };

}

function nfApplySupervisorBlockRealtime(type, row) {

  if (type === "DELETE") {

    const day = String(row?.block_day || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);

    if (day) {
      window.NF_calendarStore?.applyRemoteDelete?.({ block_day: day[1] });
      return;
    }

    console.warn(
      "[NF_sync] DELETE supervisor_blocks without block_day — refetching",
      row
    );
    void window.NF_calendarStore?.bootstrapFromRemote?.();
    return;

  }

  if (!row?.block_day) {
    return;
  }

  window.NF_calendarStore?.applyRemoteUpsert?.(row);

}

async function nfPersistCalendarLane(project) {

  if (!project?.id || !nfSyncState.calendarLaneEnabled) {
    return { ok: false, reason: "not-ready" };
  }

  const syncedIds = nfLoadSyncedProjectIds();

  if (!nfIsOnline() || !nfSyncState.client) {

    if (syncedIds.has(project.id)) {
      nfQueueOutboundChange("UPDATE", project.id);
    } else {
      nfQueueOutboundChange("INSERT", project.id);
    }

    return { ok: false, reason: "offline" };

  }

  try {

    if (syncedIds.has(project.id)) {
      return await nfUpdateProject(project);
    }

    return await nfInsertProject(project);

  } catch (error) {
    console.error("[NF_sync] calendar lane persist failed", error);

    if (syncedIds.has(project.id)) {
      nfQueueOutboundChange("UPDATE", project.id);
    } else {
      nfQueueOutboundChange("INSERT", project.id);
    }

    throw error;

  }

}

function nfSubscribeBlocksRealtime() {

  if (!nfSyncState.client || nfSyncState.blocksChannel) {
    return;
  }

  nfSyncState.blocksChannel = nfSyncState.client
    .channel("nfop-supervisor-blocks")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "supervisor_blocks"
      },
      payload => {
        if (payload?.new) {
          nfApplySupervisorBlockRealtime("INSERT", payload.new);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "supervisor_blocks"
      },
      payload => {
        if (payload?.new) {
          nfApplySupervisorBlockRealtime("UPDATE", payload.new);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "supervisor_blocks"
      },
      payload => {
        if (payload?.old) {
          nfApplySupervisorBlockRealtime("DELETE", payload.old);
        }
      }
    )
    .subscribe();

}

function nfUpdateConnectionUi() {

  if (typeof renderDashboard === "function") {
    renderDashboard();
  }

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
    supervisorBlocksReady: nfSyncState.supervisorBlocksReady,
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

async function nfSchedulePersist(projectIds, options) {

  const opts = options || {};
  const ids = Array.isArray(projectIds)
    ? projectIds.filter(Boolean)
    : [];

  if (!ids.length) {
    return;
  }

  const syncedIds = nfLoadSyncedProjectIds();

  for (let index = 0; index < ids.length; index += 1) {

    const projectId = ids[index];
    const project = state.projects.find(item => item.id === projectId);

    if (!project) {
      continue;
    }

    if (opts.calendarLane && nfSyncState.calendarLaneEnabled) {
      nfPersistCalendarLane(project).catch(error => {
        console.error("[NF_sync] calendar lane outbound failed", error);
      });
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

  const connected = await nfTestConnection();

  if (!connected) {
    return;
  }

  try {
    await nfBootstrapFromRemote();
    await window.NF_calendarStore?.init?.();
    nfSubscribeRealtime();
    nfSubscribeBlocksRealtime();
    window.NF_synchro?.refreshFooter?.();
  } catch (error) {
    console.error("[NF_sync] reconnect bootstrap failed", error);
    nfSetConnectionState({
      supabaseReachable: false,
      lastConnectionError: error.message || String(error)
    });
  }

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

function nfStopSupervisorBlocksWatch() {

  if (!nfSyncState.blocksWatchTimer) {
    return;
  }

  clearInterval(nfSyncState.blocksWatchTimer);
  nfSyncState.blocksWatchTimer = null;

}

function nfStartSupervisorBlocksWatch() {

  if (nfSyncState.blocksWatchTimer || nfSyncState.supervisorBlocksReady) {
    return;
  }

  let attempts = 0;

  nfSyncState.blocksWatchTimer = window.setInterval(() => {

    attempts += 1;

    if (
      nfSyncState.supervisorBlocksReady ||
      !nfSyncState.client ||
      !nfIsOnline() ||
      attempts > 12
    ) {
      nfStopSupervisorBlocksWatch();
      return;
    }

    void nfBootstrapBlocksFromRemote()
      .then(() => {

        if (!nfSyncState.supervisorBlocksReady) {
          return;
        }

        nfStopSupervisorBlocksWatch();
        nfSubscribeBlocksRealtime();
        void window.NF_calendarStore?.flushBlockQueue?.();
        window.NF_events?.emit?.(
          window.NF_events?.TYPES?.CALENDAR_BLOCK_CHANGED,
          { source: "schema-ready" }
        );
        nfSetConnectionState({ lastConnectionError: null });
        nfUpdateConnectionUi();

      })
      .catch(() => {});

  }, 30000);

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
    } catch (error) {
      console.error("[NF_sync] projects bootstrap failed", error);
      nfSetConnectionState({
        supabaseReachable: false,
        lastConnectionError: error.message || String(error)
      });
      return nfGetConnectionStatus();
    }

    try {
      await window.NF_calendarStore?.init?.();
      nfSubscribeBlocksRealtime();
    } catch (error) {
      console.warn(
        "[NF_sync] calendar bootstrap failed — run supabase/schema-calendar.sql",
        error
      );
      nfSetConnectionState({
        lastConnectionError:
          "Kalendarz: brak tabeli supervisor_blocks (uruchom schema-calendar.sql)"
      });
    }

    try {
      nfSubscribeRealtime();
      nfStartSupervisorBlocksWatch();
      window.NF_synchro?.refreshFooter?.();
    } catch (error) {
      console.error("[NF_sync] realtime subscribe failed", error);
    }
  }

  return nfGetConnectionStatus();

}

window.NF_sync = {
  init: nfInitSupabaseSync,
  testConnection: nfTestConnection,
  schedulePersist: nfSchedulePersist,
  persistCalendarLane: nfPersistCalendarLane,
  flushOutboundQueue: nfFlushSyncQueue,
  getConnectionStatus: nfGetConnectionStatus,
  isOnline: nfIsOnline,
  projectToRow: nfProjectToRow,
  rowToProjectPatch: nfRowToProjectPatch,
  hydrateRemoteProject: nfHydrateRemoteProject,
  extractPackageSummary: nfExtractPackageSummary,
  resolveEventLocation: nfResolveEventLocation,
  loadSyncedProjectIds: nfLoadSyncedProjectIds,
  saveSyncedProjectIds: nfSaveSyncedProjectIds,
  fetchSupervisorBlocks: nfFetchSupervisorBlocks,
  upsertSupervisorBlock: nfUpsertSupervisorBlock,
  deleteSupervisorBlock: nfDeleteSupervisorBlock,
  applyCalendarLaneDate: nfApplyCalendarLaneDate,
  isCalendarLaneInbound: nfIsCalendarLaneInbound,
  calendarLaneOnlyDiffers: nfCalendarLaneOnlyDiffers
};
