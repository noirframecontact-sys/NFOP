"use strict";

/*
=========================================
NOIRFRAME — Anfahrt / Kilometer
Start: Peter-Rosegger-Str. 29, Erkrath
=========================================
*/

const NF_TRAVEL_ORIGIN_ADDRESS =
  "Peter-Rosegger-Str. 29, 40699 Erkrath, Deutschland";

const travelCache = {
  originCoords: null
};

function travelGetOriginAddress() {
  const config = window.NF_CONFIG?.maps?.origin;

  if (typeof config === "string" && config.trim()) {
    return config.trim();
  }

  if (config && typeof config.address === "string" && config.address.trim()) {
    return config.address.trim();
  }

  return NF_TRAVEL_ORIGIN_ADDRESS;
}

async function travelGeocode(address) {
  const query = String(address || "").trim();

  if (!query) {
    throw new Error("Adresse fehlt.");
  }

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: query,
      format: "json",
      limit: "1"
    }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Geocoding nicht verfügbar.");
  }

  const results = await response.json();

  if (!Array.isArray(results) || !results.length) {
    throw new Error("Adresse nicht gefunden.");
  }

  return {
    lat: Number(results[0].lat),
    lon: Number(results[0].lon)
  };
}

async function travelGetOriginCoords() {
  if (travelCache.originCoords) {
    return travelCache.originCoords;
  }

  travelCache.originCoords = await travelGeocode(travelGetOriginAddress());

  return travelCache.originCoords;
}

async function travelFetchDrivingKm(destinationAddress) {
  const destination = String(destinationAddress || "").trim();

  if (!destination) {
    throw new Error("Zieladresse fehlt.");
  }

  const origin = await travelGetOriginCoords();
  const target = await travelGeocode(destination);

  const url =
    "https://router.project-osrm.org/route/v1/driving/" +
    origin.lon +
    "," +
    origin.lat +
    ";" +
    target.lon +
    "," +
    target.lat +
    "?overview=false";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Routenberechnung nicht verfügbar.");
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.[0]?.distance) {
    throw new Error("Keine Route gefunden.");
  }

  return Math.max(1, Math.round(data.routes[0].distance / 1000));
}

function travelBuildGoogleMapsUrl(destinationAddress) {
  const origin = encodeURIComponent(travelGetOriginAddress());
  const destination = encodeURIComponent(String(destinationAddress || "").trim());
  const travelMode = window.NF_CONFIG?.maps?.travelMode || "driving";

  const params = new URLSearchParams({
    api: "1",
    origin: travelGetOriginAddress(),
    destination: String(destinationAddress || "").trim(),
    travelmode: travelMode
  });

  return "https://www.google.com/maps/dir/?" + params.toString();
}

function travelOpenGoogleMaps(destinationAddress) {
  const destination = String(destinationAddress || "").trim();

  if (!destination) {
    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    window.alert("Keine Veranstaltungsadresse hinterlegt.");
    return false;
  }

  const url = travelBuildGoogleMapsUrl(destination);
  const link = document.createElement("a");

  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return true;
}

async function travelCalculateKmToDestination(destinationAddress) {
  try {
    const km = await travelFetchDrivingKm(destinationAddress);

    return {
      ok: true,
      km,
      origin: travelGetOriginAddress()
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error?.message ||
        "Entfernung konnte nicht berechnet werden. Route in Google Maps prüfen.",
      origin: travelGetOriginAddress()
    };
  }
}

window.NF_travel = Object.freeze({
  getOriginAddress: travelGetOriginAddress,
  calculateKmToDestination: travelCalculateKmToDestination,
  buildGoogleMapsUrl: travelBuildGoogleMapsUrl,
  openGoogleMaps: travelOpenGoogleMaps
});
