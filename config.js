"use strict";

window.NF_CONFIG = {

  app: {
    version: "4.0.0-alpha.003",
    phase: "ONLINE FOUNDATION",
    build: "4.0.0-alpha.003"
  },

  supabase: {
    url: "https://mcppojmghmwwvubyrufo.supabase.co",
    anonKey: ""
  },

  website: {
    url: "https://noirframe.art"
  },

  company: {
    url: "company.json"
  },

  catalog: {
    url: "catalog.json",
    travel: {
      includedKm: 30,
      ratePerKm: 0.35
    }
  },

  maps: {
    provider: "google",
    travelMode: "driving",
    origin: "Peter-Rosegger-Str. 29, 40699 Erkrath, Deutschland"
  },

  supervisor: {
    pin: "226720"
  },

  storno: {
    title: "AWISTA"
  },

  backup: {
    schemaVersion: 1,
    autoSnapshotOnSave: true,
    autoExportOnOnline: false
  },

  cpe: {
    enabled: true,
    shadowMode: true,
    capacityMode: "human-day",
    maxAuftraegePerDay: 1,
    capacity: {
      mode: "human-day",
      maxAuftraegePerDay: 1
    },
    photographerB: {
      id: "photographer-secondary",
      label: "Fotograf B (Video/Drohne)",
      trigger: ["drone", "video", "drohne", "reel"]
    },
    physics: {
      defaultSetupMin: 30,
      defaultTeardownMin: 20,
      minGapMin: 15,
      defaultTravelMin: 45,
      travelMinPerKm: 1.2,
      includedKm: 30,
      defaultShootMin: 120,
      searchHorizonDays: 90,
      slotStepMin: 30
    },
    resources: [
      {
        id: "photographer-primary",
        type: "photographer",
        label: "Fotograf (Primary)",
        capabilities: ["primary", "*"],
        quantity: 1
      },
      {
        id: "photographer-secondary",
        type: "photographer",
        label: "Fotograf B (Video/Drohne)",
        capabilities: ["secondary", "video"],
        quantity: 1
      },
      {
        id: "vehicle-primary",
        type: "vehicle",
        label: "Fahrzeug (Primary)",
        capabilities: ["transport"],
        quantity: 1
      },
      {
        id: "equipment-standard",
        type: "equipment",
        label: "Standard Kit",
        capabilities: ["standard"],
        quantity: 1
      },
      {
        id: "equipment-drone",
        type: "equipment",
        label: "Drohne",
        capabilities: ["drone"],
        quantity: 1
      }
    ]
  }

};

function nfCanFetchAssets() {
  const protocol = window.location?.protocol || "";
  return protocol === "http:" || protocol === "https:";
}

window.NF_canFetchAssets = nfCanFetchAssets;

const NF_WEBSITE_URL = window.NF_CONFIG.website.url;

window.NF_CONFIG_LOCAL = window.NF_CONFIG_LOCAL || {};

function nfLoadOptionalConfig(filename) {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", filename, false);
    xhr.send(null);
    if (xhr.status === 200 && xhr.responseText.trim()) {
      Function(xhr.responseText)();
    }
  } catch (error) {}
}

nfLoadOptionalConfig("config.local.js");
nfLoadOptionalConfig("config.production.js");
