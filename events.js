"use strict";

/*
  NFOP event bus — Phase 1 architecture only.
  No UI. Future phases may subscribe to these events.
*/

const NF_EVENT_TYPES = Object.freeze({
  NEW_PROJECT: "NEW_PROJECT",
  PROJECT_CANCELLED: "PROJECT_CANCELLED",
  DEPOSIT_RECEIVED: "DEPOSIT_RECEIVED",
  CALENDAR_BLOCK_CHANGED: "CALENDAR_BLOCK_CHANGED",
  CALENDAR_CHANGED: "CALENDAR_CHANGED"
});

const nfEventListeners = new Map();

function nfOn(eventType, handler) {

  if (typeof handler !== "function") {
    return () => {};
  }

  if (!nfEventListeners.has(eventType)) {
    nfEventListeners.set(eventType, new Set());
  }

  nfEventListeners.get(eventType).add(handler);

  return () => {
    nfEventListeners.get(eventType)?.delete(handler);
  };

}

function nfOff(eventType, handler) {
  nfEventListeners.get(eventType)?.delete(handler);
}

function nfEmit(eventType, payload) {

  const listeners = nfEventListeners.get(eventType);

  if (!listeners || !listeners.size) {
    return;
  }

  listeners.forEach(handler => {
    try {
      handler(payload);
    } catch (error) {
      console.error("[NF_events]", eventType, error);
    }
  });

}

window.NF_events = {
  TYPES: NF_EVENT_TYPES,
  on: nfOn,
  off: nfOff,
  emit: nfEmit
};
