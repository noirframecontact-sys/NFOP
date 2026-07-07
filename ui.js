"use strict";

/*
=========================================
NOIRFRAME OPERATOR — ui.js
Catalog UI (renderProjects / renderFooter live in app.js)
=========================================
*/

/*
=========================================
BUILD_005 — Feature 001
NOIRFRAME CATALOG
=========================================
*/

const catalogState = {

  products: [],

  filteredProducts: [],

  query: "",

  loaded: false,

  loadError: null,

  activeProductId: null,

  categoriesById: {},

  addonsById: {},

  currency: "EUR",

  locale: "de-DE",

  editContext: null

};

const CATALOG_DESKTOP_MQ = "(min-width: 1024px)";

const CATALOG_INITIAL_PREVIEW_LIMIT = 8;

function getCatalogUrl() {

  const config = window.NF_CONFIG;

  if (
    config &&
    config.catalog &&
    config.catalog.url
  ) {
    return config.catalog.url;
  }

  return "catalog.json";

}

function isCatalogDesktopLayout() {

  return window.matchMedia(CATALOG_DESKTOP_MQ).matches;

}

function isCatalogProductActive(product) {

  return product.active !== false;

}

function sortCatalogProducts(products) {

  return [...products].sort((left, right) => {

    const leftSort =
      typeof left.sort === "number"
        ? left.sort
        : Number.MAX_SAFE_INTEGER;

    const rightSort =
      typeof right.sort === "number"
        ? right.sort
        : Number.MAX_SAFE_INTEGER;

    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    return (left.name || "").localeCompare(
      right.name || "",
      "de"
    );

  });

}

function normalizeCatalogSearchText(text) {

  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");

}

async function loadCatalog(options) {

  const force = Boolean(options && options.force);

  if (catalogState.loaded && !force) {
    return catalogState.products;
  }

  if (applyCatalogPayload(window.NF_CATALOG_DATA)) {
    return catalogState.products;
  }

  if (typeof window.NF_canFetchAssets === "function" && !window.NF_canFetchAssets()) {
    catalogState.products = [];
    catalogState.loadError = "file_protocol";
    catalogState.loaded = true;
    catalogState.filteredProducts = [];
    console.info("[NF] Running in file:// mode — catalog.json unavailable.");
    return catalogState.products;
  }

  try {

    const response = await fetch(getCatalogUrl());

    if (!response.ok) {
      throw new Error(`${getCatalogUrl()} (${response.status})`);
    }

    const data = await response.json();

    if (applyCatalogPayload(data)) {
      return catalogState.products;
    }

    catalogState.products = [];
    catalogState.loadError = "empty";

  } catch (error) {

    console.error("Catalog load error:", error);

    if (applyCatalogPayload(window.NF_CATALOG_DATA)) {
      return catalogState.products;
    }

    catalogState.products = [];

    catalogState.loadError =
      error.message || "load_failed";

  }

  catalogState.loaded = true;

  catalogState.filteredProducts = [...catalogState.products];

  return catalogState.products;

}

function applyCatalogPayload(data) {

  if (!data || typeof data !== "object") {
    return false;
  }

  catalogState.currency = data.currency || "EUR";

  catalogState.locale = data.locale || "de-DE";

  catalogState.categoriesById = {};

  (Array.isArray(data.categories) ? data.categories : []).forEach(
    category => {
      if (category && category.id) {
        catalogState.categoriesById[category.id] = category;
      }
    }
  );

  catalogState.addonsById = {};

  (Array.isArray(data.addons) ? data.addons : []).forEach(
    addon => {
      if (addon && addon.id) {
        catalogState.addonsById[addon.id] = addon;
      }
    }
  );

  const products = Array.isArray(data.products)
    ? data.products
    : [];

  const activeProducts = sortCatalogProducts(
    products.filter(isCatalogProductActive)
  );

  if (!activeProducts.length) {
    catalogState.products = [];
    catalogState.loadError = "empty";
  } else {
    catalogState.products = activeProducts;
    catalogState.loadError = null;
  }

  catalogState.loaded = true;
  catalogState.filteredProducts = [...catalogState.products];

  return activeProducts.length > 0;

}

window.NF_applyCatalogPayload = applyCatalogPayload;

function getCatalogProductById(productId) {

  return catalogState.products.find(
    product => product.id === productId
  );

}

function resolveCatalogCategoryName(categoryRef) {

  if (!categoryRef) return "";

  const category =
    catalogState.categoriesById[categoryRef];

  return category?.name || categoryRef;

}

function resolveCatalogAddonSearchTerms(addonRefs) {

  if (!Array.isArray(addonRefs)) return [];

  return addonRefs.flatMap(ref => {

    const addon = catalogState.addonsById[ref];

    if (addon) {
      return [addon.name, addon.id];
    }

    return [ref];

  });

}

function buildCatalogSearchHaystack(product) {

  const tags = Array.isArray(product.tags)
    ? product.tags
    : [];

  const includes = Array.isArray(product.includes)
    ? product.includes
    : [];

  const addonTerms = resolveCatalogAddonSearchTerms(
    product.addons
  );

  return normalizeCatalogSearchText(
    [
      product.name,
      product.id,
      resolveCatalogCategoryName(product.category),
      product.category,
      product.shortDescription,
      product.description,
      ...tags,
      ...includes,
      ...addonTerms
    ]
      .filter(Boolean)
      .join(" ")
  );

}

function productMatchesCatalogQuery(product, query) {

  const normalized = normalizeCatalogSearchText(
    (query || "").trim()
  );

  if (!normalized) return true;

  const haystack = buildCatalogSearchHaystack(product);

  const tokens = normalized.split(/\s+/).filter(Boolean);

  return tokens.every(token => haystack.includes(token));

}

function filterCatalogProducts(query) {

  catalogState.query = query || "";

  catalogState.filteredProducts = catalogState.products.filter(
    product => productMatchesCatalogQuery(product, catalogState.query)
  );

}

function getCatalogListProducts() {

  const query = catalogState.query.trim();

  if (!query) {

    return catalogState.products.slice(
      0,
      CATALOG_INITIAL_PREVIEW_LIMIT
    );

  }

  return catalogState.filteredProducts;

}

function formatCatalogPrice(product) {

  if (
    product.price === undefined ||
    product.price === null ||
    product.price === ""
  ) {
    return "-";
  }

  if (typeof product.price === "number") {

    return new Intl.NumberFormat(
      catalogState.locale || "de-DE",
      {
        style: "currency",
        currency: catalogState.currency || "EUR"
      }
    ).format(product.price);

  }

  return product.price;

}

function formatCatalogDuration(product) {

  const minutes =
    product.duration ?? product.time;

  if (
    minutes === undefined ||
    minutes === null ||
    minutes === ""
  ) {
    return "-";
  }

  if (typeof minutes === "number") {

    if (minutes >= 60) {

      const hours = Math.floor(minutes / 60);

      const rest = minutes % 60;

      return rest
        ? `${hours} h ${rest} min`
        : `${hours} h`;

    }

    return `${minutes} min`;

  }

  return minutes;

}

function renderCatalogLoadErrorMessage() {

  return `
<p class="catalogEmptyMessage">
📦 Kein Produktkatalog gefunden.<br>
Bitte catalog.json prüfen.
</p>`;

}

function renderCatalogRecommendedBadge(product) {

  if (!product.recommended) {
    return "";
  }

  return `<p class="catalogRecommended">NOIRFRAME EMPFIEHLT</p>`;

}

function renderCatalogCard(product) {

  const isActive =
    product.id === catalogState.activeProductId;

  return `

<div
  class="card catalogCard${isActive ? " catalogCard--active" : ""}"
  data-catalog-product="${product.id}"
  role="button"
  tabindex="0"
>

<h3>${product.name || "Produkt"}</h3>

<p>${formatCatalogPrice(product)}</p>

<p>${formatCatalogDuration(product)}</p>

<p>${product.shortDescription || ""}</p>

${renderCatalogRecommendedBadge(product)}

</div>

`;

}

function renderCatalogList() {

  if (catalogState.loadError) {

    return renderCatalogLoadErrorMessage();

  }

  const query = catalogState.query.trim();

  const products = getCatalogListProducts();

  if (!products.length) {

    return query
      ? `<p class="catalogEmptyMessage">Keine Produkte gefunden.</p>`
      : renderCatalogLoadErrorMessage();

  }

  return products.map(renderCatalogCard).join("");

}

function syncCatalogSearchFromInput() {

  const search = document.getElementById("catalogSearchInput");

  filterCatalogProducts(search ? search.value : "");

}

function updateCatalogSearchStatus() {

  const status = document.getElementById("catalogSearchStatus");

  if (!status) return;

  if (catalogState.loadError) {
    status.textContent = "";
    status.hidden = true;
    return;
  }

  status.hidden = false;

  const total = catalogState.products.length;

  const query = catalogState.query.trim();

  if (!query) {

    const shown = Math.min(
      CATALOG_INITIAL_PREVIEW_LIMIT,
      total
    );

    status.textContent = total
      ? `${shown} von ${total} — tippen zum Filtern`
      : "";

    return;

  }

  const count = catalogState.filteredProducts.length;

  status.textContent = count
    ? `${count} Treffer`
    : "Keine Produkte gefunden.";

}

function renderCatalog() {

  syncCatalogSearchFromInput();

  const list = document.getElementById("catalogList");

  if (!list) return;

  list.innerHTML = renderCatalogList();

  updateCatalogSearchStatus();

  bindCatalogCardEvents();

}

function renderCatalogProductBody(product) {

  const includes = Array.isArray(product.includes)
    ? product.includes
    : [];

  const addons = Array.isArray(product.addons)
    ? product.addons
    : [];

  const includesHtml = includes.length
    ? `<h4>Enthalten</h4><ul>${includes.map(
        item => `<li>${item}</li>`
      ).join("")}</ul>`
    : "";

  const addonsHtml = addons.length
    ? `<h4>Zusätze</h4><ul>${addons.map(
        ref => {
          const addon = catalogState.addonsById[ref];
          return `<li>${addon?.name || ref}</li>`;
        }
      ).join("")}</ul>`
    : "";

  const recommendedHtml = product.recommended
    ? `<p class="catalogRecommended">NOIRFRAME EMPFIEHLT</p>`
    : "";

  return `

${recommendedHtml}

<p><strong>Kategorie:</strong> ${resolveCatalogCategoryName(product.category) || "-"}</p>

<p><strong>Preis:</strong> ${formatCatalogPrice(product)}</p>

<p><strong>Zeit:</strong> ${formatCatalogDuration(product)}</p>

<h4>Beschreibung</h4>

<p>${product.description || product.shortDescription || "-"}</p>

${includesHtml}

${addonsHtml}

`;

}

function buildCatalogDescriptionText(product) {

  if (!product) return "";

  const includes = Array.isArray(product.includes)
    ? product.includes
    : [];

  const addons = Array.isArray(product.addons)
    ? product.addons
    : [];

  const lines = [
    product.name || "",
    ""
  ];

  if (product.recommended) {
    lines.push("NOIRFRAME EMPFIEHLT", "");
  }

  lines.push(
    `Kategorie: ${product.category || "-"}`,
    `Preis: ${product.price || "-"}`,
    `Zeit: ${product.time || "-"}`,
    "",
    product.description || product.shortDescription || "",
    ""
  );

  if (includes.length) {

    lines.push("Enthalten:");

    includes.forEach(item => {
      lines.push(`- ${item}`);
    });

    lines.push("");

  }

  if (addons.length) {

    lines.push("Zusätze:");

    addons.forEach(item => {
      lines.push(`- ${item}`);
    });

  }

  return lines.join("\n").trim();

}

async function copyCatalogDescription() {

  const product = getCatalogProductById(
    catalogState.activeProductId
  );

  if (!product) return;

  const text = buildCatalogDescriptionText(product);

  try {

    await navigator.clipboard.writeText(text);

    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert("Beschreibung kopiert.");

  } catch (error) {

    console.error("Clipboard error:", error);

    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert("Beschreibung konnte nicht kopiert werden.");

  }

}

function formatCatalogAddonPrice(addon) {

  if (!addon) return "";

  if (typeof addon.price === "number") {

    return new Intl.NumberFormat(
      catalogState.locale || "de-DE",
      {
        style: "currency",
        currency: catalogState.currency || "EUR"
      }
    ).format(addon.price);

  }

  return String(addon.price || "");

}

function getCatalogTravelConfig() {

  const travel = window.NF_CONFIG?.catalog?.travel;

  return {
    includedKm: travel?.includedKm ?? 30,
    ratePerKm: travel?.ratePerKm ?? 0.35
  };

}

function parseCatalogTravelKm(value) {

  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return null;
  }

  const km = Number(trimmed);

  if (!Number.isFinite(km) || km < 0) {
    return null;
  }

  return Math.round(km);

}

function calculateCatalogTravel(km) {

  const { includedKm, ratePerKm } = getCatalogTravelConfig();

  if (km === null || km <= 0) {
    return null;
  }

  if (km <= includedKm) {

    return {
      oneWayKm: km,
      totalKm: km,
      chargeableKm: 0,
      cost: 0,
      included: true,
      ratePerKm
    };

  }

  const totalKm = km * 2;

  return {
    oneWayKm: km,
    totalKm,
    chargeableKm: totalKm,
    cost: totalKm * ratePerKm,
    included: false,
    ratePerKm
  };

}

function formatCatalogTravelCost(amount) {

  return new Intl.NumberFormat(
    catalogState.locale || "de-DE",
    {
      style: "currency",
      currency: catalogState.currency || "EUR"
    }
  ).format(amount);

}

function buildCatalogTravelNotesText(km) {

  const travel = calculateCatalogTravel(km);

  if (!travel) {
    return null;
  }

  const { includedKm, ratePerKm } = getCatalogTravelConfig();

  if (travel.included) {

    return [
      `🚗 Anfahrt — ${travel.oneWayKm} km (einfach)`,
      `Bis ${includedKm} km — inklusive`
    ].join("\n");

  }

  return [
    `🚗 Anfahrt — ${travel.oneWayKm} km (einfach)`,
    `Gesamt: ${travel.totalKm} km (Hin & Rück)`,
    `${travel.totalKm} km × ${ratePerKm.toFixed(2).replace(".", ",")} €`,
    `Kosten: ${formatCatalogTravelCost(travel.cost)}`
  ].join("\n");

}

function updateCatalogTravelCalc(
  kmInputId,
  calcId
) {

  const input = document.getElementById(kmInputId);

  const calc = document.getElementById(calcId);

  if (!input || !calc) return;

  const { includedKm, ratePerKm } = getCatalogTravelConfig();

  const km = parseCatalogTravelKm(input.value);

  if (km === null) {
    calc.textContent = `Bis ${includedKm} km — inklusive`;
    return;
  }

  const travel = calculateCatalogTravel(km);

  if (!travel) {
    calc.textContent = "—";
    return;
  }

  if (travel.included) {
    calc.textContent =
      `${travel.oneWayKm} km (einfach) — inklusive`;
    return;
  }

  calc.textContent =
    `${travel.oneWayKm} km (einfach) · ${travel.totalKm} km gesamt · ${ratePerKm.toFixed(2).replace(".", ",")} €/km = ${formatCatalogTravelCost(travel.cost)}`;

}

function setupCatalogTravelInputs() {

  const pairs = [
    ["catalogOfferTravelKm", "catalogOfferTravelCalc"],
    ["catalogPanelOfferTravelKm", "catalogPanelOfferTravelCalc"]
  ];

  pairs.forEach(([kmInputId, calcId]) => {

    const input = document.getElementById(kmInputId);

    if (!input || input.dataset.travelBound === "true") {
      return;
    }

    input.dataset.travelBound = "true";

    input.addEventListener("input", () => {
      updateCatalogTravelCalc(kmInputId, calcId);
      const product = getCatalogProductById(catalogState.activeProductId);
      if (product) {
        updateCatalogOfferTotalDisplay(product);
      }
    });

    updateCatalogTravelCalc(kmInputId, calcId);

  });

  setupCatalogProjectTravelPrefill();

}

async function prefillCatalogTravelKmForProject(projectId) {

  const pairs = [
    ["catalogOfferTravelKm", "catalogOfferTravelCalc"],
    ["catalogPanelOfferTravelKm", "catalogPanelOfferTravelCalc"]
  ];

  const setCalcMessage = (calcId, message) => {

    const calc = document.getElementById(calcId);

    if (calc) {
      calc.textContent = message;
    }

  };

  if (!projectId) {

    pairs.forEach(([kmInputId, calcId]) => {

      const input = document.getElementById(kmInputId);

      if (input) {
        input.value = "";
      }

      updateCatalogTravelCalc(kmInputId, calcId);

    });

    return;

  }

  const project =
    typeof window.NF_getProjectById === "function"
      ? window.NF_getProjectById(projectId)
      : null;

  const address =
    project &&
    typeof window.NF_formatEventAddress === "function"
      ? window.NF_formatEventAddress(project)
      : "";

  if (!address) {

    pairs.forEach(([kmInputId, calcId]) => {

      const input = document.getElementById(kmInputId);

      if (input) {
        input.value = "";
      }

      setCalcMessage(
        calcId,
        "Veranstaltungsadresse fehlt — km manuell oder Adresse im Projekt."
      );

      updateCatalogTravelCalc(kmInputId, calcId);

    });

    return;

  }

  pairs.forEach(([, calcId]) => {
    setCalcMessage(calcId, "Route wird berechnet…");
  });

  const result =
    typeof window.NF_travel?.calculateKmToDestination === "function"
      ? await window.NF_travel.calculateKmToDestination(address)
      : {
          ok: false,
          message: "Entfernungsberechnung nicht verfügbar."
        };

  if (!result.ok) {

    pairs.forEach(([kmInputId, calcId]) => {

      const input = document.getElementById(kmInputId);

      if (input) {
        input.value = "";
      }

      setCalcMessage(
        calcId,
        result.message ||
          "Route nicht berechenbar — Google Maps prüfen."
      );

    });

    return;

  }

  pairs.forEach(([kmInputId, calcId]) => {

    const input = document.getElementById(kmInputId);

    if (input) {
      input.value = String(result.km);
    }

    updateCatalogTravelCalc(kmInputId, calcId);

  });

}

function setupCatalogProjectTravelPrefill() {

  [
    "catalogOfferProjectSelect",
    "catalogPanelOfferProjectSelect"
  ].forEach(selectId => {

    const select = document.getElementById(selectId);

    if (!select || select.dataset.travelProjectBound === "true") {
      return;
    }

    select.dataset.travelProjectBound = "true";

    select.addEventListener("change", () => {
      prefillCatalogTravelKmForProject(select.value);
    });

  });

}

function isTravelOfferContent(content) {

  return (String(content || "").split("\n")[0] || "").includes("Anfahrt");

}

function parseTravelKmFromOfferContent(content) {

  const firstLine = String(content || "").split("\n")[0] || "";
  const match = firstLine.match(/(\d+)\s*km/i);

  return match ? Number(match[1]) : null;

}

function findProductIdFromOfferTitle(titleLine) {

  let cleanName = String(titleLine || "")
    .replace(/^📦\s*/, "")
    .split(" — ")[0]
    .trim();

  if (cleanName === "Hochzeit") {
    cleanName = "Hochzeit Standard";
  }

  const product = catalogState.products.find(
    item => item.name === cleanName
  );

  return product ? product.id : null;

}

function parseAddonIdsFromOfferContent(content) {

  const lines = String(content || "").split("\n");
  const addonIds = [];
  let inZusatz = false;

  lines.forEach(line => {

    const trimmed = line.trim();

    if (trimmed === "Zusatz:") {
      inZusatz = true;
      return;
    }

    if (trimmed.startsWith("Ergänzung:")) {
      inZusatz = false;
      return;
    }

    if (inZusatz && trimmed.startsWith("-")) {

      const addonName = trimmed
        .replace(/^-\s*/, "")
        .split(" (")[0]
        .trim();

      const legacyAddonNames = {
        "Drone Footage": "Drone",
        "Highlights Facebook Reel": "Social Media Reel",
        "Extra Hour": "Zusätzliche Stunde",
        "Express Delivery": "Express Delivery"
      };

      const resolvedName =
        legacyAddonNames[addonName] || addonName;

      const addon = Object.values(catalogState.addonsById).find(
        item => item.name === resolvedName
      );

      if (addon) {
        addonIds.push(addon.id);
      }

    }

  });

  return addonIds;

}

function parseManualTextFromOfferContent(content) {

  const lines = String(content || "").split("\n");

  for (let index = 0; index < lines.length; index++) {

    const line = lines[index].trim();

    if (line.startsWith("Ergänzung:")) {
      return line.replace(/^Ergänzung:\s*/, "");
    }

  }

  return "";

}

function parseOfferBlockForEdit(content) {

  const lines = String(content || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const titleLine = lines[0] || "";

  return {
    productId: findProductIdFromOfferTitle(titleLine),
    addonIds: parseAddonIdsFromOfferContent(content),
    manualText: parseManualTextFromOfferContent(content)
  };

}

function findTravelOfferIndexInNotes(notes) {

  const parts = typeof window.NF_parseProjectNotesParts === "function"
    ? window.NF_parseProjectNotesParts(notes || "")
    : [];

  for (let index = 0; index < parts.length; index++) {

    const part = parts[index];

    if (
      part.type === "offer" &&
      isTravelOfferContent(part.content)
    ) {
      return part.offerIndex;
    }

  }

  return null;

}

function calculateCatalogOfferTotal(
  product,
  selectedAddonRefs,
  travelKm
) {

  if (!product) {
    return 0;
  }

  let total = Number(product.price) || 0;

  selectedAddonRefs.forEach(ref => {

    const addon = catalogState.addonsById[ref];

    if (addon && typeof addon.price === "number") {
      total += addon.price;
    }

  });

  const travel = calculateCatalogTravel(travelKm);

  if (travel && !travel.included) {
    total += travel.cost;
  }

  return total;

}

function formatCatalogOfferTotal(amount) {

  return new Intl.NumberFormat(
    catalogState.locale || "de-DE",
    {
      style: "currency",
      currency: catalogState.currency || "EUR"
    }
  ).format(amount);

}

function updateCatalogOfferTotalDisplay(product) {

  if (!product) {
    return;
  }

  const {
    travelInput,
    addonsSelector
  } = getActiveCatalogOfferElements();

  const travelKm = parseCatalogTravelKm(
    travelInput ? travelInput.value : ""
  );

  const addonRefs = getSelectedCatalogOfferAddonRefs(
    addonsSelector
  );

  const total = calculateCatalogOfferTotal(
    product,
    addonRefs,
    travelKm
  );

  const text = `Gesamtpreis: ${formatCatalogOfferTotal(total)}`;

  [
    "catalogOfferTotal",
    "catalogPanelOfferTotal"
  ].forEach(id => {

    const element = document.getElementById(id);

    if (element) {
      element.textContent = text;
    }

  });

}

function updateCatalogApplyButtonLabels() {

  const isEdit = Boolean(catalogState.editContext);

  const label = isEdit
    ? "💾 Paket aktualisieren"
    : "✅ Zum Projekt übernehmen";

  [
    "catalogOfferBtn",
    "catalogPanelOfferBtn"
  ].forEach(id => {

    const button = document.getElementById(id);

    if (button) {
      button.textContent = label;
    }

  });

}

function clearCatalogEditContext() {

  catalogState.editContext = null;

  updateCatalogApplyButtonLabels();

}

function buildCatalogOfferNotesText(
  product,
  selectedAddonRefs,
  manualText
) {

  const lines = [
    `📦 ${product.name} — ${formatCatalogPrice(product)}`,
    `Zeit: ${formatCatalogDuration(product)}`
  ];

  const selectedAddons = selectedAddonRefs
    .map(ref => catalogState.addonsById[ref])
    .filter(Boolean);

  if (selectedAddons.length) {

    lines.push("Zusatz:");

    selectedAddons.forEach(addon => {
      lines.push(
        `- ${addon.name} (${formatCatalogAddonPrice(addon)})`
      );
    });

  }

  const manual = (manualText || "").trim();

  if (manual) {
    lines.push(`Ergänzung: ${manual}`);
  }

  return lines.join("\n");

}

function getCatalogOfferSelectableAddons(product) {

  const refs = Array.isArray(product.addons)
    ? product.addons
    : [];

  return refs
    .map(ref => catalogState.addonsById[ref])
    .filter(addon => addon && addon.id !== "travel-included");

}

function renderCatalogOfferProjectOptions(
  selectId,
  selectedProjectId
) {

  const select = document.getElementById(selectId);

  if (!select) return;

  const getOptions =
    typeof window.NF_getProjectOptions === "function"
      ? window.NF_getProjectOptions
      : null;

  const projects = getOptions ? getOptions() : [];

  if (!projects.length) {
    select.innerHTML =
      `<option value="">Kein Projekt</option>`;
    return;
  }

  select.innerHTML = projects.map(project => `

<option
  value="${project.id}"
  ${project.id === selectedProjectId ? "selected" : ""}
>
  ${project.label}
</option>

  `).join("");

}

function renderCatalogOfferAddonsList(
  containerId,
  checkboxName,
  product,
  selectedAddonIds
) {

  const container = document.getElementById(containerId);

  if (!container) return;

  const addons = getCatalogOfferSelectableAddons(product);
  const selected = new Set(selectedAddonIds || []);

  if (!addons.length) {

    container.innerHTML =
      `<p class="catalogOfferEmpty">Keine Zusatzleistungen für dieses Paket.</p>`;

    return;

  }

  container.innerHTML = addons.map(addon => `

<label class="catalogOfferAddonOption">
  <input
    type="checkbox"
    name="${checkboxName}"
    value="${addon.id}"
    ${selected.has(addon.id) ? "checked" : ""}
  >
  <span>${addon.name} — ${formatCatalogAddonPrice(addon)}</span>
</label>

  `).join("");

  container.querySelectorAll("input[type='checkbox']").forEach(input => {

    input.addEventListener("change", () => {
      updateCatalogOfferTotalDisplay(product);
    });

  });

}

function renderCatalogOfferControls(product, prefill) {

  const options = prefill || {};

  const projects =
    typeof window.NF_getProjectOptions === "function"
      ? window.NF_getProjectOptions()
      : [];

  const defaultProjectId =
    options.projectId ||
    (projects.length ? projects[0].id : "");

  renderCatalogOfferProjectOptions(
    "catalogOfferProjectSelect",
    defaultProjectId
  );

  renderCatalogOfferProjectOptions(
    "catalogPanelOfferProjectSelect",
    defaultProjectId
  );

  renderCatalogOfferAddonsList(
    "catalogOfferAddonsList",
    "catalogOfferAddon",
    product,
    options.addonIds
  );

  renderCatalogOfferAddonsList(
    "catalogPanelOfferAddonsList",
    "catalogPanelOfferAddon",
    product,
    options.addonIds
  );

  [
    ["catalogOfferManualInput", options.manualText || ""],
    ["catalogPanelOfferManualInput", options.manualText || ""],
    ["catalogOfferTravelKm", options.travelKm ?? ""],
    ["catalogPanelOfferTravelKm", options.travelKm ?? ""]
  ].forEach(([id, value]) => {

    const input = document.getElementById(id);

    if (input) {
      input.value = value === null || value === undefined
        ? ""
        : String(value);
    }

  });

  updateCatalogTravelCalc(
    "catalogOfferTravelKm",
    "catalogOfferTravelCalc"
  );

  updateCatalogTravelCalc(
    "catalogPanelOfferTravelKm",
    "catalogPanelOfferTravelCalc"
  );

  updateCatalogApplyButtonLabels();

  updateCatalogOfferTotalDisplay(product);

  const isEdit = Boolean(catalogState.editContext);

  [
    "catalogOfferProjectSelect",
    "catalogPanelOfferProjectSelect"
  ].forEach(id => {

    const select = document.getElementById(id);

    if (select) {
      select.disabled = isEdit;
    }

  });

  if (options.travelKm === undefined || options.travelKm === null) {
    prefillCatalogTravelKmForProject(defaultProjectId);
  }

}

function getActiveCatalogOfferElements() {

  const panel = document.getElementById("catalogDetailPanel");

  const usePanel =
    isCatalogDesktopLayout() &&
    panel &&
    !panel.classList.contains("hidden");

  if (usePanel) {

    return {
      projectSelect: document.getElementById(
        "catalogPanelOfferProjectSelect"
      ),
      manualInput: document.getElementById(
        "catalogPanelOfferManualInput"
      ),
      travelInput: document.getElementById(
        "catalogPanelOfferTravelKm"
      ),
      addonsSelector:
        "#catalogPanelOfferAddonsList input[name='catalogPanelOfferAddon']:checked"
    };

  }

  return {
    projectSelect: document.getElementById(
      "catalogOfferProjectSelect"
    ),
    manualInput: document.getElementById(
      "catalogOfferManualInput"
    ),
    travelInput: document.getElementById(
      "catalogOfferTravelKm"
    ),
    addonsSelector:
      "#catalogOfferAddonsList input[name='catalogOfferAddon']:checked"
  };

}

function getSelectedCatalogOfferAddonRefs(addonsSelector) {

  return Array.from(
    document.querySelectorAll(addonsSelector)
  ).map(input => input.value);

}

function handleCatalogApplyClick(triggerButton) {

  const productId =
    triggerButton?.dataset?.productId ||
    catalogState.activeProductId;

  const product = getCatalogProductById(productId);

  if (!product) {
    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert("Bitte zuerst ein Produkt wählen.");
    return;
  }

  const {
    projectSelect,
    manualInput,
    travelInput,
    addonsSelector
  } = getActiveCatalogOfferElements();

  const editContext = catalogState.editContext;

  const projectId = editContext
    ? editContext.projectId
    : (projectSelect ? projectSelect.value : "");

  if (!projectId) {
    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert(
      "Kein Projekt vorhanden. Bitte zuerst ein Projekt anlegen."
    );
    return;
  }

  const offerText = buildCatalogOfferNotesText(
    product,
    getSelectedCatalogOfferAddonRefs(addonsSelector),
    manualInput ? manualInput.value : ""
  );

  const applyOffer =
    typeof window.NF_applyCatalogOfferToProject === "function"
      ? window.NF_applyCatalogOfferToProject
      : null;

  const updateOffer =
    typeof window.NF_updateCatalogOfferInProject === "function"
      ? window.NF_updateCatalogOfferInProject
      : null;

  const removeOffer =
    typeof window.NF_removeProjectOfferBlock === "function"
      ? window.NF_removeProjectOfferBlock
      : null;

  if (!applyOffer || !updateOffer) {
    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert("Notizen konnten nicht gespeichert werden.");
    return;
  }

  if (editContext) {

    if (!updateOffer(projectId, editContext.offerIndex, offerText)) {
      // TODO NFOP 3.2 — nativer alert(); eigenes Modal
      alert("Notizen konnten nicht gespeichert werden.");
      return;
    }

  } else {

    if (!applyOffer(projectId, offerText)) {
      // TODO NFOP 3.2 — nativer alert(); eigenes Modal
      alert("Notizen konnten nicht gespeichert werden.");
      return;
    }

  }

  const travelKm = parseCatalogTravelKm(
    travelInput ? travelInput.value : ""
  );

  const travelText = buildCatalogTravelNotesText(travelKm);

  if (travelText) {

    if (
      editContext &&
      editContext.travelOfferIndex !== null &&
      editContext.travelOfferIndex !== undefined
    ) {
      updateOffer(
        projectId,
        editContext.travelOfferIndex,
        travelText
      );
    } else {
      applyOffer(projectId, travelText);
    }

  } else if (
    editContext &&
    editContext.travelOfferIndex !== null &&
    editContext.travelOfferIndex !== undefined &&
    removeOffer
  ) {
    removeOffer(
      projectId,
      editContext.travelOfferIndex,
      true
    );
  }

  clearCatalogEditContext();

  clearCatalogProductSelection();

  closeCatalogScreen();

}

function renderCatalogProductDetail(product) {

  const bodyHtml = renderCatalogProductBody(product);

  const modalTitle =
    document.getElementById("catalogProductTitle");

  const modalBody =
    document.getElementById("catalogProductBody");

  const panelTitle =
    document.getElementById("catalogDetailPanelTitle");

  const panelBody =
    document.getElementById("catalogDetailPanelBody");

  if (modalTitle) {
    modalTitle.textContent = product.name || "Produkt";
  }

  if (modalBody) {
    modalBody.innerHTML = bodyHtml;
  }

  if (panelTitle) {
    panelTitle.textContent = product.name || "Produkt";
  }

  if (panelBody) {
    panelBody.innerHTML = bodyHtml;
  }

  const prefill =
    catalogState.editContext &&
    catalogState.editContext.productId === product.id
      ? catalogState.editContext.prefill
      : null;

  renderCatalogOfferControls(product, prefill);

  [
    "catalogOfferBtn",
    "catalogPanelOfferBtn"
  ].forEach(id => {

    const button = document.getElementById(id);

    if (button) {
      button.dataset.productId = product.id;
    }

  });

}

function showCatalogDetailPanel() {

  const panel =
    document.getElementById("catalogDetailPanel");

  if (!panel) return;

  panel.classList.remove("hidden");

  document
    .getElementById("catalogModal")
    ?.classList.add("catalogModal--split");

}

function hideCatalogDetailPanel() {

  const panel =
    document.getElementById("catalogDetailPanel");

  if (!panel) return;

  panel.classList.add("hidden");

  document
    .getElementById("catalogModal")
    ?.classList.remove("catalogModal--split");

}

function openCatalogProductModal() {

  document
    .getElementById("catalogProductModal")
    .classList.remove("hidden");

}

function closeCatalogProductModal() {

  document
    .getElementById("catalogProductModal")
    .classList.add("hidden");

}

function clearCatalogProductSelection() {

  catalogState.activeProductId = null;

  clearCatalogEditContext();

  closeCatalogProductModal();

  hideCatalogDetailPanel();

  renderCatalog();

}

function openCatalogProduct(productId) {

  const product = getCatalogProductById(productId);

  if (!product) return;

  catalogState.activeProductId = productId;

  renderCatalogProductDetail(product);

  renderCatalog();

  if (isCatalogDesktopLayout()) {

    closeCatalogProductModal();

    showCatalogDetailPanel();

    return;

  }

  hideCatalogDetailPanel();

  openCatalogProductModal();

}

function handleCatalogLayoutChange() {

  if (
    !document.getElementById("catalogModal") ||
    document
      .getElementById("catalogModal")
      .classList.contains("hidden")
  ) {
    return;
  }

  if (!catalogState.activeProductId) {
    hideCatalogDetailPanel();
    closeCatalogProductModal();
    return;
  }

  const product = getCatalogProductById(
    catalogState.activeProductId
  );

  if (!product) return;

  renderCatalogProductDetail(product);

  if (isCatalogDesktopLayout()) {

    closeCatalogProductModal();

    showCatalogDetailPanel();

    return;

  }

  hideCatalogDetailPanel();

  openCatalogProductModal();

}

async function openCatalogScreen() {

  await loadCatalog({ force: true });

  const search = document.getElementById("catalogSearchInput");

  if (search) {
    search.value = "";
  }

  catalogState.query = "";

  catalogState.activeProductId = null;

  clearCatalogEditContext();

  hideCatalogDetailPanel();

  closeCatalogProductModal();

  renderCatalog();

  document
    .getElementById("catalogModal")
    .classList.remove("hidden");

  if (search) {
    requestAnimationFrame(() => {
      search.focus({ preventScroll: true });
    });
  }

}

function closeCatalogScreen() {

  clearCatalogProductSelection();

  document
    .getElementById("catalogModal")
    .classList.add("hidden");

}

async function openCatalogForOfferEdit(projectId, offerIndex) {

  await loadCatalog({ force: true });

  const getProject =
    typeof window.NF_getProjectById === "function"
      ? window.NF_getProjectById
      : null;

  const parseParts =
    typeof window.NF_parseProjectNotesParts === "function"
      ? window.NF_parseProjectNotesParts
      : null;

  const project = getProject ? getProject(projectId) : null;

  if (!project || !parseParts) {
    return;
  }

  const parts = parseParts(project.notes || "");
  const offerPart = parts.find(
    part =>
      part.type === "offer" &&
      part.offerIndex === offerIndex
  );

  if (!offerPart || isTravelOfferContent(offerPart.content)) {
    return;
  }

  const parsed = parseOfferBlockForEdit(offerPart.content);

  if (!parsed.productId) {
    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert("Paket konnte nicht zum Bearbeiten geladen werden.");
    return;
  }

  const travelOfferIndex =
    findTravelOfferIndexInNotes(project.notes);

  let travelKm = null;

  if (travelOfferIndex !== null) {

    const travelPart = parts.find(
      part =>
        part.type === "offer" &&
        part.offerIndex === travelOfferIndex
    );

    if (travelPart) {
      travelKm = parseTravelKmFromOfferContent(
        travelPart.content
      );
    }

  }

  catalogState.editContext = {
    projectId,
    offerIndex,
    travelOfferIndex,
    productId: parsed.productId,
    prefill: {
      projectId,
      addonIds: parsed.addonIds,
      manualText: parsed.manualText,
      travelKm
    }
  };

  catalogState.query = "";
  catalogState.activeProductId = parsed.productId;

  const search = document.getElementById("catalogSearchInput");

  if (search) {
    search.value = "";
  }

  hideCatalogDetailPanel();

  closeCatalogProductModal();

  renderCatalog();

  document
    .getElementById("catalogModal")
    .classList.remove("hidden");

  openCatalogProduct(parsed.productId);

}

window.NF_openCatalogForOfferEdit = openCatalogForOfferEdit;

function bindCatalogCardEvents() {

  document
    .querySelectorAll(".catalogCard:not([data-catalog-bound])")
    .forEach(card => {

      card.dataset.catalogBound = "true";

      card.addEventListener("click", () => {
        openCatalogProduct(card.dataset.catalogProduct);
      });

      card.addEventListener("keydown", (event) => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          openCatalogProduct(card.dataset.catalogProduct);
        }

      });

    });

}

function handleCatalogSearchInput() {

  renderCatalog();

}

function setupCatalogSearchEvents() {

  const modal = document.getElementById("catalogModal");

  if (!modal || modal.dataset.catalogSearchBound === "true") {
    return;
  }

  modal.dataset.catalogSearchBound = "true";

  const onSearchChange = (event) => {

    if (event.target.id !== "catalogSearchInput") {
      return;
    }

    handleCatalogSearchInput();

  };

  modal.addEventListener("input", onSearchChange);

  modal.addEventListener("keyup", onSearchChange);

}

function setupCatalogLayoutListener() {

  const mediaQuery =
    window.matchMedia(CATALOG_DESKTOP_MQ);

  const handler = () => handleCatalogLayoutChange();

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handler);
  } else if (mediaQuery.addListener) {
    mediaQuery.addListener(handler);
  }

}

function setupCatalogOfferApply() {

  if (document.body.dataset.catalogApplyBound === "true") {
    return;
  }

  document.body.dataset.catalogApplyBound = "true";

  document.addEventListener("click", (event) => {

    const button = event.target.closest(
      ".catalogApplyBtn, #catalogOfferBtn, #catalogPanelOfferBtn"
    );

    if (!button) return;

    event.preventDefault();

    event.stopPropagation();

    handleCatalogApplyClick(button);

  }, true);

}

function setupCatalog() {

  // Hero-Buttons: setupHeroBarActions() in app.js (delegacja na #hero)

  const closeBtn =
    document.getElementById("catalogCloseBtn");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeCatalogScreen);
  }

  const productCloseBtn =
    document.getElementById("catalogProductCloseBtn");

  if (productCloseBtn) {
    productCloseBtn.addEventListener(
      "click",
      clearCatalogProductSelection
    );
  }

  const copyBtn =
    document.getElementById("catalogCopyDescBtn");

  if (copyBtn) {
    copyBtn.addEventListener("click", copyCatalogDescription);
  }

  const panelCopyBtn =
    document.getElementById("catalogPanelCopyDescBtn");

  if (panelCopyBtn) {
    panelCopyBtn.addEventListener("click", copyCatalogDescription);
  }

  setupCatalogOfferApply();

  setupCatalogTravelInputs();

  setupCatalogSearchEvents();

  setupCatalogLayoutListener();

}
