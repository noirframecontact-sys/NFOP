"use strict";

/*
  NFOP 4.1 — Shared calendar block store.

  Last Known Workspace: localStorage nfBlockedDays.
  Source of truth: Supabase supervisor_blocks (via NF_sync transport).
  Realtime auto-apply: supabase-sync.js (Calendar Lane — no Volvo Trunk).
*/

const NF_BLOCKED_DAYS_KEY = "nfBlockedDays";
const NF_BLOCK_SYNC_QUEUE_KEY = "nfBlockSyncQueue";

const nfCalendarStoreState = {
  bootstrapped: false,
  flushing: false,
  bootstrapPromise: null,
  bootstrapLastAt: 0
};

const NF_CAL_BOOTSTRAP_MIN_MS = 30000;

function nfCalNormalizeDay(day) {
  const match = String(day || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function nfCalNormalizeEntries(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map(item => {
      if (typeof item === "string" && item.trim()) {
        return {
          day: nfCalNormalizeDay(item),
          reason: "Privat",
          createdAt: ""
        };
      }

      if (item && typeof item.day === "string" && item.day.trim()) {
        return {
          day: nfCalNormalizeDay(item.day),
          reason: String(item.reason || "Privat").trim() || "Privat",
          createdAt: String(item.createdAt || item.created_at || "").trim()
        };
      }

      return null;
    })
    .filter(entry => entry && entry.day);
}

function nfCalLoadCache() {
  try {
    const saved = localStorage.getItem(NF_BLOCKED_DAYS_KEY);

    if (!saved) {
      return [];
    }

    return nfCalNormalizeEntries(JSON.parse(saved));
  } catch (error) {
    return [];
  }
}

function nfCalSaveCache(entries) {
  const normalized = nfCalNormalizeEntries(entries);

  localStorage.setItem(
    NF_BLOCKED_DAYS_KEY,
    JSON.stringify(normalized)
  );

  window.NF_backup?.onLocalDataSaved?.();
}

function nfCalEmitBlockChanged(payload) {
  window.NF_events?.emit?.(
    window.NF_events?.TYPES?.CALENDAR_BLOCK_CHANGED,
    payload || {}
  );
}

function nfCalLoadBlockQueue() {
  try {
    const raw = localStorage.getItem(NF_BLOCK_SYNC_QUEUE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function nfCalSaveBlockQueue(queue) {
  try {
    localStorage.setItem(
      NF_BLOCK_SYNC_QUEUE_KEY,
      JSON.stringify(Array.isArray(queue) ? queue : [])
    );
  } catch (error) {}
}

function nfCalEnqueueBlockChange(entry) {
  const queue = nfCalLoadBlockQueue().filter(
    item => item.blockDay !== entry.blockDay
  );

  queue.push({
    type: entry.type,
    blockDay: entry.blockDay,
    reason: entry.reason || "Privat",
    queuedAt: new Date().toISOString()
  });

  nfCalSaveBlockQueue(queue);
}

function nfCalGetBlocks() {
  return nfCalLoadCache().map(entry => entry.day);
}

function nfCalGetBlockEntries() {
  return nfCalLoadCache().slice();
}

function nfCalGetBlockEntry(day) {
  const normalizedDay = nfCalNormalizeDay(day);

  return (
    nfCalLoadCache().find(entry => entry.day === normalizedDay) || null
  );
}

function nfCalApplyRemoteUpsert(row) {
  const day = nfCalNormalizeDay(row?.block_day);

  if (!day) {
    return;
  }

  const reason = String(row.reason || "Privat").trim() || "Privat";
  const existing = nfCalGetBlockEntry(day);

  if (existing && existing.reason === reason) {
    return;
  }

  const entries = nfCalLoadCache().filter(entry => entry.day !== day);

  entries.push({
    day,
    reason,
    createdAt: row.created_at || row.updated_at || ""
  });

  nfCalSaveCache(entries);
  nfCalEmitBlockChanged({ day, source: "remote" });
}

function nfCalApplyRemoteDelete(row) {
  const day = nfCalNormalizeDay(row?.block_day);

  if (!day) {
    return;
  }

  if (!nfCalGetBlockEntry(day)) {
    return;
  }

  nfCalSaveCache(
    nfCalLoadCache().filter(entry => entry.day !== day)
  );

  nfCalEmitBlockChanged({ day, source: "remote-delete" });
}

function nfCalSyncErrorMessage(error) {
  const code = String(error?.code || "");

  if (code === "PGRST205") {
    return (
      "Brak tabeli supervisor_blocks — uruchom schema-calendar.sql w Supabase SQL Editor."
    );
  }

  return error?.message || "Sync fehlgeschlagen.";
}

async function nfCalPersistBlock(day, reason) {
  if (window.NF_sync?.upsertSupervisorBlock) {
    return window.NF_sync.upsertSupervisorBlock(day, reason);
  }

  return { ok: false, reason: "sync-not-ready" };
}

async function nfCalPersistUnblock(day) {
  if (window.NF_sync?.deleteSupervisorBlock) {
    return window.NF_sync.deleteSupervisorBlock(day);
  }

  return { ok: false, reason: "sync-not-ready" };
}

async function nfCalFlushBlockQueue() {
  if (nfCalendarStoreState.flushing) {
    return { ok: false, reason: "busy" };
  }

  if (!window.NF_sync?.isOnline?.() || !window.NF_sync?.upsertSupervisorBlock) {
    return { ok: false, reason: "offline" };
  }

  const queue = nfCalLoadBlockQueue();

  if (!queue.length) {
    return { ok: true, reason: "empty" };
  }

  nfCalendarStoreState.flushing = true;

  const remaining = [];

  try {

    for (let index = 0; index < queue.length; index += 1) {

      const entry = queue[index];

      try {

        if (entry.type === "DELETE") {
          await nfCalPersistUnblock(entry.blockDay);
        } else {
          await nfCalPersistBlock(
            entry.blockDay,
            entry.reason || "Privat"
          );
        }

      } catch (error) {
        console.error("[NF_calendarStore] queue flush failed", entry, error);
        remaining.push(entry);
      }

    }

    nfCalSaveBlockQueue(remaining);

    return { ok: true };

  } finally {
    nfCalendarStoreState.flushing = false;
  }

}

async function nfCalBlockDay(day, reason) {
  const normalizedDay = nfCalNormalizeDay(day);

  if (!normalizedDay) {
    return { ok: false, message: "Ungültiges Datum." };
  }

  const normalizedReason =
    String(reason || "Privat").trim() || "Privat";

  const entries = nfCalLoadCache().filter(
    entry => entry.day !== normalizedDay
  );

  entries.push({
    day: normalizedDay,
    reason: normalizedReason,
    createdAt: new Date().toISOString()
  });

  nfCalSaveCache(entries);
  nfCalEmitBlockChanged({
    day: normalizedDay,
    source: "local"
  });

  if (window.NF_sync?.isOnline?.()) {

    try {
      const result = await nfCalPersistBlock(
        normalizedDay,
        normalizedReason
      );

      if (result?.code === "PGRST205") {
        nfCalEnqueueBlockChange({
          type: "UPSERT",
          blockDay: normalizedDay,
          reason: normalizedReason
        });
        return {
          ok: true,
          day: normalizedDay,
          warning: nfCalSyncErrorMessage(result.error || { code: "PGRST205" })
        };
      }

      if (result?.ok === false) {
        throw result.error || new Error("block persist failed");
      }

      return {
        ok: true,
        day: normalizedDay,
        synced: true
      };

    } catch (error) {
      console.error("[NF_calendarStore] block persist failed", error);
      nfCalEnqueueBlockChange({
        type: "UPSERT",
        blockDay: normalizedDay,
        reason: normalizedReason
      });
    }

  } else {
    nfCalEnqueueBlockChange({
      type: "UPSERT",
      blockDay: normalizedDay,
      reason: normalizedReason
    });
  }

  return { ok: true, day: normalizedDay };
}

async function nfCalUnblockDay(day) {
  const normalizedDay = nfCalNormalizeDay(day);

  if (!normalizedDay) {
    return { ok: false, message: "Ungültiges Datum." };
  }

  if (window.NF_sync?.isOnline?.()) {

    try {
      const result = await nfCalPersistUnblock(normalizedDay);

      if (result?.code === "PGRST205") {
        nfCalSaveCache(
          nfCalLoadCache().filter(entry => entry.day !== normalizedDay)
        );
        nfCalEmitBlockChanged({
          day: normalizedDay,
          source: "local-unblock-schema-missing"
        });
        return {
          ok: true,
          day: normalizedDay,
          warning: nfCalSyncErrorMessage(result.error || { code: "PGRST205" })
        };
      }

      if (result?.ok === false) {
        throw result.error || new Error("unblock persist failed");
      }

    } catch (error) {
      console.error("[NF_calendarStore] unblock persist failed", error);
      const code = String(error?.code || "");

      if (code === "PGRST205") {
        nfCalSaveCache(
          nfCalLoadCache().filter(entry => entry.day !== normalizedDay)
        );
        nfCalEmitBlockChanged({
          day: normalizedDay,
          source: "local-unblock-schema-missing"
        });
        return {
          ok: true,
          day: normalizedDay,
          warning: nfCalSyncErrorMessage(error)
        };
      }

      nfCalEnqueueBlockChange({
        type: "DELETE",
        blockDay: normalizedDay
      });
      return {
        ok: false,
        message: nfCalSyncErrorMessage(error)
      };
    }

  } else {
    nfCalEnqueueBlockChange({
      type: "DELETE",
      blockDay: normalizedDay
    });
  }

  nfCalSaveCache(
    nfCalLoadCache().filter(entry => entry.day !== normalizedDay)
  );

  nfCalEmitBlockChanged({
    day: normalizedDay,
    source: "local-unblock"
  });

  return { ok: true, day: normalizedDay };
}

function nfCalReplaceCacheFromRemote(rows) {
  const remoteEntries = (Array.isArray(rows) ? rows : [])
    .map(row => ({
      day: nfCalNormalizeDay(row.block_day),
      reason: String(row.reason || "Privat").trim() || "Privat",
      createdAt: row.created_at || row.updated_at || ""
    }))
    .filter(entry => entry.day);

  const nextJson = JSON.stringify(remoteEntries);
  const prevJson = JSON.stringify(nfCalLoadCache());

  if (nextJson === prevJson) {
    return false;
  }

  nfCalSaveCache(remoteEntries);
  return true;
}

async function nfCalBootstrapFromRemote() {
  if (!window.NF_sync?.fetchSupervisorBlocks) {
    return { ok: false, reason: "no-sync" };
  }

  try {

    const rows = await window.NF_sync.fetchSupervisorBlocks();
    const status = window.NF_sync?.getConnectionStatus?.() || {};

    if (!status.supervisorBlocksReady) {
      return { ok: false, reason: "schema-missing" };
    }

    if (nfCalReplaceCacheFromRemote(rows)) {
      nfCalEmitBlockChanged({ source: "remote-bootstrap" });
    }

    return { ok: true, count: rows.length };

  } catch (error) {
    console.warn("[NF_calendarStore] bootstrap failed", error);
    return { ok: false, reason: "fetch-failed", error };
  }
}

async function nfCalBootstrapDebounced(force) {
  const now = Date.now();

  if (
    !force &&
    now - nfCalendarStoreState.bootstrapLastAt < NF_CAL_BOOTSTRAP_MIN_MS
  ) {
    return { ok: false, reason: "debounced" };
  }

  if (nfCalendarStoreState.bootstrapPromise) {
    return nfCalendarStoreState.bootstrapPromise;
  }

  nfCalendarStoreState.bootstrapPromise = nfCalBootstrapFromRemote()
    .finally(() => {
      nfCalendarStoreState.bootstrapPromise = null;
      nfCalendarStoreState.bootstrapLastAt = Date.now();
    });

  return nfCalendarStoreState.bootstrapPromise;
}

async function nfCalInit() {
  try {
    if (!nfCalendarStoreState.bootstrapped) {
      await nfCalBootstrapFromRemote();
    }

    await nfCalFlushBlockQueue();
  } catch (error) {
    console.error("[NF_calendarStore] bootstrap failed", error);
  }

  nfCalendarStoreState.bootstrapped = true;
}

window.NF_calendarStore = {
  init: nfCalInit,
  bootstrapFromRemote: nfCalBootstrapFromRemote,
  bootstrapDebounced: nfCalBootstrapDebounced,
  flushBlockQueue: nfCalFlushBlockQueue,
  blockDay: nfCalBlockDay,
  unblockDay: nfCalUnblockDay,
  getBlocks: nfCalGetBlocks,
  getBlockEntries: nfCalGetBlockEntries,
  getBlockEntry: nfCalGetBlockEntry,
  applyRemoteUpsert: nfCalApplyRemoteUpsert,
  applyRemoteDelete: nfCalApplyRemoteDelete,
  replaceCacheFromRemote: nfCalReplaceCacheFromRemote,
  loadCache: nfCalLoadCache,
  saveCache: nfCalSaveCache,
  STORAGE_KEY: NF_BLOCKED_DAYS_KEY
};
