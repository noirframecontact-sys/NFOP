"use strict";

/*
=========================================
NOIRFRAME OPERATOR
BUILD_005 — Feature 002
Angebot Generator & Versand
=========================================
*/

const angebotState = {
  company: null,
  catalog: null,
  productsByName: {},
  addonsById: {},
  locale: "de-DE",
  currency: "EUR",
  activeProjectId: null,
  mobileSendPayload: null
};

const ANGEBOT_COMPANY_FALLBACK = {
  brand: "NoirFrame",
  owner: "Marcin Porębski",
  email: "noirframe.contact@gmail.com",
  phone: "",
  website: "www.noirframe.art",
  street: "Peter Rossegger Str 29",
  postalCode: "40699",
  city: "Erkrath",
  country: "Deutschland",
  bank: {
    name: "ING-DiBa",
    accountHolder: "Marcin Porębski",
    iban: "DE79 5001 0517 5426 8340 08",
    bic: ""
  },
  offer: {
    depositPercent: 25,
    validityDays: 14,
    emailSubject: "Ihr persönliches Angebot – NoirFrame",
    validityText: "Dieses Angebot ist {days} Tage gültig.",
    legalUnverbindlich:
      "Dieses Angebot ist unverbindlich bis zur schriftlichen Auftragsbestätigung.",
    legalUstg:
      "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
  }
};

angebotState.company = ANGEBOT_COMPANY_FALLBACK;

const ANGEBOT_TAG_START = "[NF-ANGEBOT]";
const ANGEBOT_TAG_END = "[/NF-ANGEBOT]";

function escapeAngebotHtml(text) {

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

}

function formatAngebotEuro(amount) {

  return new Intl.NumberFormat(angebotState.locale, {
    style: "currency",
    currency: angebotState.currency
  }).format(amount);

}

function parseGermanEuro(text) {

  const match = String(text).match(
    /([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)\s*€/
  );

  if (!match) return 0;

  return parseFloat(
    match[1].replace(/\./g, "").replace(",", ".")
  );

}

function formatCatalogMinutes(minutes) {

  if (minutes === undefined || minutes === null || minutes === "") {
    return "-";
  }

  if (typeof minutes === "number") {
    if (minutes >= 60 && minutes % 60 === 0) {
      return minutes / 60 + " h";
    }
    return minutes + " Min.";
  }

  return String(minutes);

}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function formatGermanDateFromIso(isoDate) {

  if (!isoDate) return "";

  const match = String(isoDate).match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) return isoDate;

  return match[3] + "." + match[2] + "." + match[1];

}

function splitProjectDateValue(dateValue) {

  if (!dateValue) {
    return { date: "", time: "", displayDate: "", displayTime: "" };
  }

  const trimmed = String(dateValue).trim();
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/
  );

  if (match) {
    return {
      date: match[1],
      time: match[2] || "",
      displayDate: formatGermanDateFromIso(match[1]),
      displayTime: match[2] || ""
    };
  }

  return {
    date: "",
    time: "",
    displayDate: trimmed,
    displayTime: ""
  };

}

function splitClientName(client) {

  const full = String(client || "").trim();

  if (!full) {
    return { vorname: "-", nachname: "-" };
  }

  const parts = full.split(/\s+/);

  if (parts.length === 1) {
    return { vorname: parts[0], nachname: "-" };
  }

  return {
    vorname: parts[0],
    nachname: parts.slice(1).join(" ")
  };

}

function getClientGreeting(project) {

  const name = String(project?.client || "").trim();

  return name || "Guten Tag";

}

function getClientDisplayName(project) {

  const name = String(project?.client || "").trim();

  return name || "—";

}

function getVerwendungszweckLabel(project) {

  const client = String(project?.client || "").trim();
  const title = String(project?.title || "").trim();
  const fallback =
    title && title !== "Neues Projekt" ? title : "Projekt";

  return "Anzahlung – " + (client || fallback);

}

const OFFER_SECTION_RULE = "──────────────────────────────";

function formatOfferPlainField(label, value) {

  const text = String(value || "—").trim() || "—";

  return label.padEnd(16) + text;

}

function formatOfferPlainServiceLines(item) {

  const parsed = item.parsed;
  const price = formatAngebotEuro(item.total);

  if (isTravelOfferBlock(item.block.content)) {

    const lines = [
      "",
      "▸ Anfahrt / Kilometerpauschale · " + price
    ];

    parsed.rawLines.slice(1).forEach(line => {

      if (line.startsWith("Kosten:")) {
        return;
      }

      lines.push("  " + line);

    });

    return lines;

  }

  const product = item.product;
  const lines = [
    "",
    "▸ " + parsed.productName + " · " + price
  ];

  if (product) {

    lines.push("  Zeit: " + formatCatalogMinutes(product.duration));

    if (product.description) {
      lines.push("  " + product.description);
    }

    if (Array.isArray(product.includes) && product.includes.length) {
      lines.push("  Leistungsumfang:");
      product.includes.forEach(entry => {
        lines.push("    - " + entry);
      });
    }

  } else if (parsed.rawLines.find(line => line.startsWith("Zeit:"))) {
    lines.push(
      "  " + parsed.rawLines.find(line => line.startsWith("Zeit:"))
    );
  }

  if (parsed.addons.length) {
    lines.push("  Zusatzleistungen:");
    parsed.addons.forEach(addon => {
      lines.push("    - " + addon);
    });
  }

  if (parsed.manualNote) {
    lines.push("  Ergänzung: " + parsed.manualNote);
  }

  return lines;

}

function renderOfferServiceHtml(item) {

  const product = item.product;
  const parsed = item.parsed;
  const isTravel = isTravelOfferBlock(item.block.content);
  const serviceTitle = isTravel
    ? "Anfahrt / Kilometerpauschale"
    : parsed.productName;

  const travelDetailsHtml = isTravel
    ? parsed.rawLines.slice(1)
      .filter(line => !line.startsWith("Kosten:"))
      .map(line =>
        `<p class="angebotTravelDetail">${escapeAngebotHtml(line)}</p>`
      )
      .join("")
    : "";

  const includesHtml = product && Array.isArray(product.includes)
    ? `<ul class="angebotIncludes">${product.includes.map(entry =>
        `<li>${escapeAngebotHtml(entry)}</li>`
      ).join("")}</ul>`
    : "";

  const addonsHtml = parsed.addons.length
    ? `<div class="angebotAddons"><strong>Zusatzleistungen</strong><ul>${parsed.addons.map(addon =>
        `<li>${escapeAngebotHtml(addon)}</li>`
      ).join("")}</ul></div>`
    : "";

  const description = product?.description
    ? `<p class="angebotDescription">${escapeAngebotHtml(product.description)}</p>`
    : "";

  const duration = product
    ? formatCatalogMinutes(product.duration)
    : (parsed.rawLines.find(line => line.startsWith("Zeit:")) || "")
      .replace(/^Zeit:\s*/, "");

  return `

<article class="angebotService${isTravel ? " angebotService--travel" : ""}">

  <div class="angebotServiceHead">
    <h4>${escapeAngebotHtml(serviceTitle)}</h4>
    <span class="angebotServicePrice">${escapeAngebotHtml(formatAngebotEuro(item.total))}</span>
  </div>

  ${duration ? `<p class="angebotDuration"><strong>Zeit:</strong> ${escapeAngebotHtml(duration)}</p>` : ""}

  ${description}

  ${includesHtml ? `<div class="angebotScope"><strong>Leistungsumfang</strong>${includesHtml}</div>` : ""}

  ${addonsHtml}

  ${travelDetailsHtml}

  ${parsed.manualNote ? `<p class="angebotManual"><strong>Ergänzung:</strong> ${escapeAngebotHtml(parsed.manualNote)}</p>` : ""}

</article>

`;

}

function getCompanyConfig() {

  return angebotState.company || ANGEBOT_COMPANY_FALLBACK;

}

function getOfferSettings() {

  const company = getCompanyConfig();

  return company.offer || {
    depositPercent: 25,
    validityDays: 14
  };

}

// TODO CLEANUP NFOP 3.2 — duplikat parseProjectNotesParts z app.js
function parseOfferNotesParts(notes) {

  if (!notes || !String(notes).trim()) {
    return [];
  }

  const parts = [];
  let remaining = String(notes);
  let offerIndex = 0;

  while (remaining.length) {

    const start = remaining.indexOf(ANGEBOT_TAG_START);

    if (start === -1) {

      const text = remaining.trim();

      if (text) {
        parts.push({ type: "text", content: text });
      }

      break;

    }

    if (start > 0) {

      const text = remaining.slice(0, start).trim();

      if (text) {
        parts.push({ type: "text", content: text });
      }

    }

    const contentStart = start + ANGEBOT_TAG_START.length;
    const end = remaining.indexOf(ANGEBOT_TAG_END, contentStart);

    if (end === -1) {

      parts.push({
        type: "text",
        content: remaining.slice(start).trim()
      });

      break;

    }

    const offerContent = remaining.slice(contentStart, end).trim();

    if (offerContent) {
      parts.push({
        type: "offer",
        content: offerContent,
        offerIndex: offerIndex++
      });
    }

    remaining = remaining.slice(end + ANGEBOT_TAG_END.length);

  }

  return parts;

}

function cleanOfferProductName(line) {

  let text = String(line || "").trim();
  const dash = text.indexOf(" — ");

  if (dash > 0) {
    text = text.slice(0, dash).trim();
  }

  if (text.charCodeAt(0) > 127) {
    const space = text.indexOf(" ");
    if (space > 0) {
      text = text.slice(space + 1).trim();
    }
  }

  return text || "Leistung";

}

function isTravelOfferBlock(content) {
  return (content.split("\n")[0] || "").includes("Anfahrt");
}

function sumOfferBlock(content) {

  const lines = content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return 0;

  if (isTravelOfferBlock(content)) {

    const kostenLine = lines.find(line =>
      line.startsWith("Kosten:")
    );

    return kostenLine ? parseGermanEuro(kostenLine) : 0;

  }

  let total = parseGermanEuro(lines[0]);
  let inZusatz = false;

  lines.slice(1).forEach(line => {

    if (line === "Zusatz:") {
      inZusatz = true;
      return;
    }

    if (line.startsWith("Ergänzung:")) {
      inZusatz = false;
      return;
    }

    if (inZusatz && line.startsWith("-")) {
      total += parseGermanEuro(line);
    }

  });

  return total;

}

function parseOfferBlockLines(content) {

  const lines = content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const productName = cleanOfferProductName(lines[0] || "");
  const addons = [];
  let manualNote = "";
  let inZusatz = false;

  lines.slice(1).forEach(line => {

    if (line === "Zusatz:") {
      inZusatz = true;
      return;
    }

    if (line.startsWith("Ergänzung:")) {
      inZusatz = false;
      manualNote = line.replace(/^Ergänzung:\s*/, "");
      return;
    }

    if (inZusatz && line.startsWith("-")) {
      addons.push(line.replace(/^-\s*/, ""));
      return;
    }

    if (!inZusatz && line.startsWith("Zeit:")) {
      return;
    }

  });

  return {
    productName,
    addons,
    manualNote,
    blockTotal: sumOfferBlock(content),
    rawLines: lines
  };

}

function findCatalogProduct(productName) {

  const key = String(productName || "").trim().toLowerCase();

  return angebotState.productsByName[key] || null;

}

function getProjectOfferBlocks(project) {

  if (typeof window.NF_getProjectOfferBlocks === "function") {
    return window.NF_getProjectOfferBlocks(project);
  }

  return parseOfferNotesParts(project.notes || "").filter(
    part => part.type === "offer"
  );

}

function calculateOfferTotals(blocks) {

  const total = blocks.reduce(
    (sum, block) => sum + sumOfferBlock(block.content),
    0
  );

  const settings = getOfferSettings();
  const depositPercent = Number(settings.depositPercent) || 25;
  const deposit = Math.round(total * depositPercent) / 100;
  const remainder = Math.round((total - deposit) * 100) / 100;

  return {
    total,
    deposit,
    remainder,
    depositPercent
  };

}

function getNextOfferVersion(project) {

  const history = Array.isArray(project.offerHistory)
    ? project.offerHistory
    : [];

  const sentCount = history.filter(
    entry => entry.type === "Angebot gesendet"
  ).length;

  return sentCount + 1;

}

function getOfferCreatedDate() {
  return new Date();
}

function formatOfferCreatedLabel(date) {

  const pad = padDatePart;

  return (
    pad(date.getDate()) +
    "." +
    pad(date.getMonth() + 1) +
    "." +
    date.getFullYear()
  );

}

function formatOfferSentHistoryLabel(isoString) {

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  const pad = padDatePart;

  return (
    pad(date.getDate()) +
    "." +
    pad(date.getMonth() + 1) +
    "." +
    date.getFullYear() +
    " " +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );

}

function getValidityLabel(createdDate) {

  const settings = getOfferSettings();
  const days = Number(settings.validityDays) || 14;
  const validUntil = new Date(createdDate);

  validUntil.setDate(validUntil.getDate() + days);

  const template = settings.validityText ||
    "Dieses Angebot ist {days} Tage gültig.";

  const untilLabel = formatOfferCreatedLabel(validUntil);

  return (
    template.replace("{days}", String(days)) +
    " (bis " +
    untilLabel +
    ")"
  );

}

function getEventAddress(project) {

  if (typeof window.NF_formatEventAddress === "function") {
    return window.NF_formatEventAddress(project) || "-";
  }

  return (
    project.eventAddress ||
    project.address ||
    "-"
  );

}

function buildOfferItems(blocks) {

  return blocks.map(block => {

    const parsed = parseOfferBlockLines(block.content);
    const product = findCatalogProduct(parsed.productName);

    return {
      block,
      parsed,
      product,
      total: parsed.blockTotal
    };

  });

}

function buildOfferDocument(project, version, createdDate) {

  const company = getCompanyConfig();
  const settings = getOfferSettings();
  const blocks = getProjectOfferBlocks(project);
  const items = buildOfferItems(blocks);
  const totals = calculateOfferTotals(blocks);
  const eventDate = splitProjectDateValue(project.date);
  const versionLabel = "Angebot V" + version;
  const createdLabel = formatOfferCreatedLabel(createdDate);
  const validityLabel = getValidityLabel(createdDate);
  const verwendungszweck = getVerwendungszweckLabel(project);
  const clientName = getClientDisplayName(project);

  const plainLines = [
    versionLabel,
    "",
    company.brand || "NoirFrame",
    company.owner || "",
    "E-Mail: " + (company.email || ""),
    "Website: " + (company.website || ""),
    company.phone ? "Telefon: " + company.phone : "",
    "",
    "Erstellt am " + createdLabel,
    validityLabel,
    "",
    OFFER_SECTION_RULE,
    "KUNDE",
    OFFER_SECTION_RULE,
    formatOfferPlainField("Name / Firma:", clientName),
    formatOfferPlainField("E-Mail:", project.email || "—"),
    formatOfferPlainField("Telefon:", project.phone || "—"),
    formatOfferPlainField("Adresse:", project.clientAddress || "—"),
    "",
    OFFER_SECTION_RULE,
    "EVENT",
    OFFER_SECTION_RULE,
    formatOfferPlainField("Datum:", eventDate.displayDate || "noch offen"),
    formatOfferPlainField("Uhrzeit:", eventDate.displayTime || "—"),
    formatOfferPlainField("Ort:", getEventAddress(project)),
    "",
    OFFER_SECTION_RULE,
    "LEISTUNGEN",
    OFFER_SECTION_RULE
  ];

  items.forEach(item => {
    plainLines.push(...formatOfferPlainServiceLines(item));
  });

  if (!items.length) {
    plainLines.push("", "  Kein Paket in Notizen");
  }

  plainLines.push(
    "",
    OFFER_SECTION_RULE,
    formatOfferPlainField(
      "Gesamtpreis:",
      formatAngebotEuro(totals.total)
    ),
    formatOfferPlainField(
      "Anzahlung (" + totals.depositPercent + " %):",
      formatAngebotEuro(totals.deposit)
    ),
    formatOfferPlainField(
      "Restzahlung:",
      formatAngebotEuro(totals.remainder)
    ),
    "",
    OFFER_SECTION_RULE,
    "BANKVERBINDUNG",
    OFFER_SECTION_RULE,
    company.bank?.name || "",
    formatOfferPlainField(
      "Kontoinhaber:",
      company.bank?.accountHolder || company.owner || ""
    ),
    formatOfferPlainField("IBAN:", company.bank?.iban || ""),
    company.bank?.bic
      ? formatOfferPlainField("BIC:", company.bank.bic)
      : "",
    formatOfferPlainField("Verwendungszweck:", verwendungszweck),
    "",
    settings.legalUnverbindlich || "",
    settings.legalUstg || ""
  );

  const plainText = plainLines
    .filter(line => line !== null && line !== undefined)
    .join("\n")
    .trim();

  const servicesHtml = items.length
    ? items.map(renderOfferServiceHtml).join("")
    : `<p class="angebotEmpty">Kein Paket in Notizen. Bitte Paket im Katalog wählen.</p>`;

  const html = `

<div class="angebotSheet">

  <div class="angebotVersion">${escapeAngebotHtml(versionLabel)}</div>

  <header class="angebotHeader">
    <h2 class="angebotTitle">Angebot</h2>
    <div class="angebotCompany">
      <p><strong>${escapeAngebotHtml(company.brand || "NoirFrame")}</strong></p>
      <p>${escapeAngebotHtml(company.owner || "")}</p>
      <p>E-Mail: ${escapeAngebotHtml(company.email || "")}</p>
      <p>Website: ${escapeAngebotHtml(company.website || "")}</p>
      ${company.phone ? `<p>Telefon: ${escapeAngebotHtml(company.phone)}</p>` : ""}
    </div>
    <p class="angebotMeta">Erstellt am ${escapeAngebotHtml(createdLabel)}</p>
    <p class="angebotValidity">${escapeAngebotHtml(validityLabel)}</p>
  </header>

  <section class="angebotSection">
    <h3>Kunde</h3>
    <p><strong>Name / Firma:</strong> ${escapeAngebotHtml(clientName)}</p>
    <p><strong>E-Mail:</strong> ${escapeAngebotHtml(project.email || "—")}</p>
    <p><strong>Telefon:</strong> ${escapeAngebotHtml(project.phone || "—")}</p>
    <p><strong>Adresse:</strong> ${escapeAngebotHtml(project.clientAddress || "—")}</p>
  </section>

  <section class="angebotSection">
    <h3>Event</h3>
    <p><strong>Veranstaltungsdatum:</strong> ${escapeAngebotHtml(eventDate.displayDate || "noch offen")}</p>
    <p><strong>Uhrzeit:</strong> ${escapeAngebotHtml(eventDate.displayTime || "—")}</p>
    <p><strong>Ort:</strong> ${escapeAngebotHtml(getEventAddress(project))}</p>
  </section>

  <section class="angebotSection">
    <h3>Leistungen</h3>
    ${servicesHtml}
  </section>

  <section class="angebotSection angebotPricing">
    <div class="angebotPriceRow">
      <span>Gesamtpreis</span>
      <strong>${escapeAngebotHtml(formatAngebotEuro(totals.total))}</strong>
    </div>
    <div class="angebotPriceRow angebotPriceRow--deposit">
      <span>Anzahlung (${escapeAngebotHtml(String(totals.depositPercent))} %)</span>
      <strong>${escapeAngebotHtml(formatAngebotEuro(totals.deposit))}</strong>
    </div>
    <div class="angebotPriceRow">
      <span>Restzahlung</span>
      <strong>${escapeAngebotHtml(formatAngebotEuro(totals.remainder))}</strong>
    </div>
  </section>

  <section class="angebotSection">
    <h3>Bankverbindung</h3>
    <p>${escapeAngebotHtml(company.bank?.name || "")}</p>
    <p><strong>Kontoinhaber:</strong> ${escapeAngebotHtml(company.bank?.accountHolder || company.owner || "")}</p>
    <p><strong>IBAN:</strong> ${escapeAngebotHtml(company.bank?.iban || "")}</p>
    ${company.bank?.bic ? `<p><strong>BIC:</strong> ${escapeAngebotHtml(company.bank.bic)}</p>` : ""}
    <p><strong>Verwendungszweck:</strong> ${escapeAngebotHtml(verwendungszweck)}</p>
  </section>

  <footer class="angebotLegal">
    <p>${escapeAngebotHtml(settings.legalUnverbindlich || "")}</p>
    <p>${escapeAngebotHtml(settings.legalUstg || "")}</p>
  </footer>

</div>

`;

  return {
    html,
    plainText,
    totals,
    versionLabel,
    createdDate,
    createdLabel
  };

}

function formatOfferReadableSpacing(text) {

  return String(text || "")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join("\n\n");

}

function buildOfferEmailIntro(project) {

  const company = getCompanyConfig();

  return [
    "Hallo " + getClientGreeting(project) + ",",
    "vielen Dank für Ihre Anfrage.",
    "Anbei erhalten Sie Ihr persönliches Angebot.",
    "Bei Fragen stehe ich Ihnen jederzeit gerne zur Verfügung.",
    "Mit freundlichen Grüßen",
    company.owner || "Marcin Porębski",
    company.brand || "NoirFrame"
  ].join("\n");

}

function buildOfferEmailBody(project, version, createdDate) {

  const offerDoc = buildOfferDocument(project, version, createdDate);
  const intro = buildOfferEmailIntro(project);

  const rawBody =
    intro +
    "\n" +
    OFFER_SECTION_RULE +
    "\n" +
    offerDoc.plainText;

  return formatOfferReadableSpacing(rawBody);

}

function isGoogleChrome() {

  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";

  if (/Edg\//.test(ua) || /OPR\//.test(ua)) {
    return false;
  }

  return /CriOS|Chrome\//.test(ua);

}

function isChromeOnIos() {

  if (!isGoogleChrome()) {
    return false;
  }

  return /iPad|iPhone|iPod/.test(navigator.userAgent || "");

}

function isSafariMobile() {

  return isAppleMobile() && !isGoogleChrome();

}

function shouldUseGmailAccountChooser() {

  const companyEmail = getCompanySenderEmail();

  if (!companyEmail) {
    return false;
  }

  if (isSafariMobile()) {
    return true;
  }

  if (isGoogleChrome() && !isChromeOnIos()) {
    return true;
  }

  return false;

}

function getCompanySenderEmail() {

  return (getCompanyConfig().email || "").trim();

}

function isAppleMobile() {

  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";

  if (/iPad|iPhone|iPod/.test(ua)) {
    return true;
  }

  return (
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1
  );

}

function buildOfferGmailParams(
  project,
  version,
  createdDate,
  bodyText
) {

  const clientEmail = (project.email || "").trim();
  const companyEmail = getCompanySenderEmail();
  const settings = getOfferSettings();
  const subject = settings.emailSubject ||
    "Ihr persönliches Angebot – NoirFrame";

  const params = new URLSearchParams();

  params.set("view", "cm");
  params.set("fs", "1");
  params.set("su", subject);
  params.set("body", bodyText);

  if (clientEmail) {
    params.set("to", clientEmail);
  }

  if (companyEmail) {
    params.set("authuser", companyEmail);
  }

  return params;

}

function copyOfferTextToClipboard(text) {

  if (!text) {
    return Promise.resolve(false);
  }

  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {

    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);

  }

  return Promise.resolve(false);

}

function buildOfferGmailWebUrl(project, version, createdDate) {

  const bodyText = buildOfferEmailBody(
    project,
    version,
    createdDate
  );

  const composeUrl =
    "https://mail.google.com/mail/?" +
    buildOfferGmailParams(
      project,
      version,
      createdDate,
      bodyText
    ).toString();

  if (shouldUseGmailAccountChooser()) {

    const companyEmail = getCompanySenderEmail();

    return (
      "https://accounts.google.com/AccountChooser" +
      "?Email=" + encodeURIComponent(companyEmail) +
      "&continue=" + encodeURIComponent(composeUrl)
    );

  }

  return composeUrl;

}

function shouldUseMobileGmailSheet() {

  if (isAppleMobile()) {
    return true;
  }

  const ua = navigator.userAgent || "";

  if (/Android/i.test(ua)) {
    return true;
  }

  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches &&
    window.innerWidth < 1200
  ) {
    return true;
  }

  return false;

}

function buildOfferGmailAppUrl(
  project,
  version,
  createdDate,
  bodyText
) {

  const clientEmail = (project.email || "").trim();
  const settings = getOfferSettings();
  const subject = settings.emailSubject ||
    "Ihr persönliches Angebot – NoirFrame";
  const body = bodyText || buildOfferEmailBody(
    project,
    version,
    createdDate
  );

  return (
    "googlegmail:///co" +
    "?to=" + encodeURIComponent(clientEmail) +
    "&subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(body.slice(0, 8000))
  );

}

function buildOfferGmailMobileWebUrl(
  project,
  version,
  createdDate,
  bodyText
) {

  const clientEmail = encodeURIComponent(
    (project.email || "").trim()
  );
  const settings = getOfferSettings();
  const subject = encodeURIComponent(
    settings.emailSubject ||
      "Ihr persönliches Angebot – NoirFrame"
  );
  const body = encodeURIComponent(
    bodyText || buildOfferEmailBody(
      project,
      version,
      createdDate
    )
  );
  const companyEmail = getCompanySenderEmail();
  const hash =
    "co?to=" + clientEmail +
    "&su=" + subject +
    "&body=" + body;

  if (companyEmail) {

    return (
      "https://mail.google.com/mail/mu/mp/0/" +
      "?authuser=" + encodeURIComponent(companyEmail) +
      "#" + hash
    );

  }

  return "https://mail.google.com/mail/mu/mp/0/#" + hash;

}

function setMobileGmailSendStatus(message) {

  const status = document.getElementById("offerMobileSendStatus");

  if (status) {
    status.textContent = message;
  }

}

function closeMobileGmailSendModal() {

  document
    .getElementById("offerMobileSendModal")
    ?.classList.add("hidden");

  angebotState.mobileSendPayload = null;

}

async function openMobileGmailSendSheet(
  project,
  version,
  createdDate
) {

  const modal = document.getElementById("offerMobileSendModal");
  const toLine = document.getElementById("offerMobileSendTo");
  const fromLine = document.getElementById("offerMobileSendFrom");
  const companyEmail = getCompanySenderEmail();
  const settings = getOfferSettings();
  const subject = settings.emailSubject ||
    "Ihr persönliches Angebot – NoirFrame";
  const bodyText = buildOfferEmailBody(
    project,
    version,
    createdDate
  );

  if (!modal) {
    openOfferGmailCompose(project, version, createdDate);
    return;
  }

  angebotState.mobileSendPayload = {
    project: project,
    version: version,
    createdDate: createdDate,
    bodyText: bodyText,
    appUrl: buildOfferGmailAppUrl(
      project,
      version,
      createdDate,
      bodyText
    ),
    webUrl: buildOfferGmailMobileWebUrl(
      project,
      version,
      createdDate,
      bodyText
    )
  };

  if (toLine) {

    const clientEmail = (project.email || "").trim();

    toLine.textContent = clientEmail
      ? "An: " + clientEmail
      : "Keine Kunden-E-Mail — WhatsApp / Messenger";

  }

  if (fromLine) {
    fromLine.textContent =
      "Von: " + (companyEmail || "NoirFrame") +
      " · Betreff: " + subject;
  }

  setMobileGmailSendStatus(
    "Gmail öffnen — vollständiges Angebot wird übernommen."
  );

  modal.classList.remove("hidden");

  copyOfferTextToClipboard(bodyText);

}

function setupMobileGmailSendModal() {

  if (document.body.dataset.offerMobileSendBound === "true") {
    return;
  }

  document.body.dataset.offerMobileSendBound = "true";

  document
    .getElementById("offerMobileSendCloseBtn")
    ?.addEventListener("click", closeMobileGmailSendModal);

  document
    .getElementById("offerMobileSendModal")
    ?.addEventListener("click", (event) => {

      if (event.target.id === "offerMobileSendModal") {
        closeMobileGmailSendModal();
      }

    });

  document
    .getElementById("offerMobileSendCopyBtn")
    ?.addEventListener("click", async () => {

      const payload = angebotState.mobileSendPayload;

      if (!payload) return;

      const copied = await copyOfferTextToClipboard(payload.bodyText);

      setMobileGmailSendStatus(
        copied
          ? "Angebotstext kopiert."
          : "Kopieren fehlgeschlagen — Text markieren und manuell kopieren."
      );

    });

  document
    .getElementById("offerMobileSendAppBtn")
    ?.addEventListener("click", () => {

      const payload = angebotState.mobileSendPayload;

      if (!payload) return;

      window.location.assign(payload.appUrl);

    });

  document
    .getElementById("offerMobileSendWebBtn")
    ?.addEventListener("click", () => {

      const payload = angebotState.mobileSendPayload;

      if (!payload) return;

      window.location.assign(payload.webUrl);

    });

}

function openOfferGmailCompose(project, version, createdDate) {

  const webUrl = buildOfferGmailWebUrl(
    project,
    version,
    createdDate
  );

  if (isChromeOnIos() || isSafariMobile()) {

    window.location.assign(webUrl);

    return true;

  }

  if (isGoogleChrome()) {

    const opened = window.open(webUrl, "_blank");

    if (!opened) {
      window.location.assign(webUrl);
    }

    return true;

  }

  const opened = window.open(webUrl, "_blank");

  if (!opened) {
    window.location.assign(webUrl);
  }

  return true;

}

function buildOfferGmailUrl(project, version, createdDate) {

  return buildOfferGmailWebUrl(project, version, createdDate);

}

function recordOfferSent(project, version) {

  const sentAt = new Date().toISOString();

  if (!Array.isArray(project.offerHistory)) {
    project.offerHistory = [];
  }

  project.offerHistory.push({
    type: "Angebot gesendet",
    version: version,
    label: "Angebot V" + version,
    sentAt: sentAt
  });

  project.status = "ANGEBOT GESENDET";
  project.lastOfferSentAt = sentAt;
  project.lastOfferVersion = version;

}

function renderOfferHistoryHtml(project) {

  const history = Array.isArray(project.offerHistory)
    ? project.offerHistory
    : [];

  const sent = history.filter(
    entry => entry.type === "Angebot gesendet"
  );

  if (!sent.length) {
    return "";
  }

  const items = sent.map(entry => `

<li class="angebotHistoryItem">
  <span>${escapeAngebotHtml(entry.label || entry.type)}</span>
  <time>${escapeAngebotHtml(formatOfferSentHistoryLabel(entry.sentAt))}</time>
</li>

`).join("");

  return `

<div class="angebotHistory">
  <h4>Angebotsverlauf</h4>
  <ul class="angebotHistoryList">${items}</ul>
</div>

`;

}

function renderProjectStatusBadge(project) {

  if (project.status !== "ANGEBOT GESENDET") {
    return "";
  }

  return `<span class="projectStatusBadge">ANGEBOT GESENDET</span>`;

}

async function fetchWithTimeout(url, timeoutMs) {

  const controller = typeof AbortController !== "undefined"
    ? new AbortController()
    : null;

  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {

    const response = await fetch(url, controller
      ? { signal: controller.signal }
      : undefined
    );

    return response;

  } finally {

    if (timer) clearTimeout(timer);

  }

}

async function loadCompanyConfig() {

  const url = window.NF_CONFIG?.company?.url || "company.json";

  if (typeof window.NF_canFetchAssets === "function" && !window.NF_canFetchAssets()) {
    angebotState.company = ANGEBOT_COMPANY_FALLBACK;
    console.info("[NF] Running in file:// mode — company.json unavailable (using fallback).");
    return;
  }

  try {

    const response = await fetchWithTimeout(url, 2500);

    if (!response.ok) {
      throw new Error("company.json (" + response.status + ")");
    }

    angebotState.company = await response.json();

  } catch (error) {

    angebotState.company = ANGEBOT_COMPANY_FALLBACK;

  }

}

function applyAngebotCatalogData(data) {

  if (!data || typeof data !== "object") {
    return false;
  }

  angebotState.catalog = data;
  angebotState.locale = data.locale || "de-DE";
  angebotState.currency = data.currency || "EUR";
  angebotState.productsByName = {};

  (angebotState.catalog.products || []).forEach(product => {
    if (product.name) {
      angebotState.productsByName[product.name.trim().toLowerCase()] =
        product;
    }
  });

  angebotState.addonsById = {};

  (angebotState.catalog.addons || []).forEach(addon => {
    angebotState.addonsById[addon.id] = addon;
  });

  return Array.isArray(angebotState.catalog.products) &&
    angebotState.catalog.products.length > 0;

}

async function loadCatalogData() {

  const url = window.NF_CONFIG?.catalog?.url || "catalog.json";

  if (applyAngebotCatalogData(window.NF_CATALOG_DATA)) {
    return;
  }

  if (typeof window.NF_canFetchAssets === "function" && !window.NF_canFetchAssets()) {
    angebotState.catalog = null;
    console.info("[NF] Running in file:// mode — catalog.json unavailable.");
    return;
  }

  try {

    const response = await fetchWithTimeout(url, 2500);

    if (!response.ok) {
      throw new Error("catalog.json (" + response.status + ")");
    }

    applyAngebotCatalogData(await response.json());

  } catch (error) {

    if (!applyAngebotCatalogData(window.NF_CATALOG_DATA)) {
      angebotState.catalog = null;
    }

  }

}

async function initAngebotModule() {

  if (angebotState._initPromise) {
    return angebotState._initPromise;
  }

  angebotState._initPromise = Promise.all([
    loadCompanyConfig(),
    loadCatalogData()
  ]).catch(error => {
    console.error("Angebot module init error:", error);
  });

  return angebotState._initPromise;

}

function getProjectById(projectId) {

  if (typeof window.NF_getProjectById === "function") {

    const project = window.NF_getProjectById(projectId);

    if (project) return project;

  }

  if (typeof window.NF_getProjects === "function") {

    const projects = window.NF_getProjects() || [];

    return projects.find(project => project.id === projectId) || null;

  }

  if (typeof state !== "undefined" && Array.isArray(state.projects)) {

    return state.projects.find(project => project.id === projectId) || null;

  }

  return null;

}

function updateOfferPreviewActions(project, version) {

  const sendBtn = document.getElementById("offerPreviewSendBtn");
  const hint = document.getElementById("offerPreviewSendHint");

  if (sendBtn) {

    const hasClientEmail = !!(project.email || "").trim();
    const hasOffers = getProjectOfferBlocks(project).length > 0;

    sendBtn.disabled = !hasOffers;

    sendBtn.title = !hasOffers
      ? "Kein Paket in Notizen"
      : hasClientEmail
        ? "Angebot V" + version + " per Gmail senden"
        : "Angebot senden — E-Mail optional";

  }

  if (hint) {

    const companyEmail = getCompanySenderEmail();
    const hasClientEmail = !!(project.email || "").trim();

    if (!hasClientEmail) {

      hint.textContent =
        "Keine Kunden-E-Mail — Angebot per WhatsApp oder anderem Messenger senden.";

      return;

    } else if (shouldUseMobileGmailSheet()) {

      hint.textContent =
        "Mobil: Text kopieren + Gmail App oder Web — " +
        (companyEmail || "NoirFrame");

    } else if (isGoogleChrome()) {

      hint.textContent =
        "Gmail Compose — " +
        (companyEmail || "NoirFrame") +
        " (Chrome: gleiches Fenster)";

    } else if (isSafariMobile()) {

      hint.textContent =
        "Gmail Compose als " +
        (companyEmail || "NoirFrame") +
        " — nicht Posteingang";

    } else {

      hint.textContent =
        "Via Gmail — " + (companyEmail || "");

    }

  }

}

function setActiveOfferProject(projectId) {
  angebotState.activeProjectId = projectId;
}

// TODO CLEANUP NFOP 3.2 — duplikat openAngebotPreview z app.js; UI używa app.openAngebotPreview
function openOfferPreview(projectId) {

  const project = getProjectById(projectId);

  if (!project) {
    throw new Error("Projekt nicht gefunden.");
  }

  const modal = document.getElementById("offerPreviewModal");
  const body = document.getElementById("offerPreviewBody");

  if (!modal || !body) {
    throw new Error("Angebot-Vorschau nicht verfügbar.");
  }

  angebotState.activeProjectId = projectId;

  const version = getNextOfferVersion(project);
  const createdDate = getOfferCreatedDate();
  const offerDoc = buildOfferDocument(project, version, createdDate);

  body.innerHTML = offerDoc.html;

  updateOfferPreviewActions(project, version);

  modal.classList.remove("hidden");

}

function hasClientEmailHint(project) {
  return !!(project.email || "").trim();
}

function closeOfferPreviewModal() {

  document
    .getElementById("offerPreviewModal")
    ?.classList.add("hidden");

  angebotState.activeProjectId = null;

}

function sendOfferForProject(project) {

  if (!getProjectOfferBlocks(project).length) {

    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert(
      "Kein Angebot in Notizen. Bitte Paket im Katalog wählen."
    );

    return;

  }

  const version = getNextOfferVersion(project);
  const createdDate = getOfferCreatedDate();

  recordOfferSent(project, version);

  if (typeof saveProjects === "function") {
    saveProjects(project.id);
  }

  if (typeof renderProjects === "function") {
    renderProjects();
  }

  closeOfferPreviewModal();

  if (shouldUseMobileGmailSheet()) {

    openMobileGmailSendSheet(project, version, createdDate);

    return;

  }

  openOfferGmailCompose(project, version, createdDate);

}

function setupOfferPreviewModal() {

  if (document.body.dataset.offerAngebotModalBound === "true") {
    return;
  }

  document.body.dataset.offerAngebotModalBound = "true";

  setupMobileGmailSendModal();

  document
    .getElementById("closeOfferPreviewBtn")
    ?.addEventListener("click", closeOfferPreviewModal);

  document
    .getElementById("offerPreviewSendBtn")
    ?.addEventListener("click", () => {

      if (!angebotState.activeProjectId) return;

      const project = getProjectById(angebotState.activeProjectId);

      if (!project) return;

      sendOfferForProject(project);

    });

  document
    .getElementById("offerPreviewModal")
    ?.addEventListener("click", (event) => {

      if (event.target.id === "offerPreviewModal") {
        closeOfferPreviewModal();
      }

    });

}

/*
  PDF-Anhang: generateOfferPdfBlob(project, version) kann hier angebunden
  werden (z. B. pdf-lib), sobald BUILD_005 PDF-Export aktiviert ist.
  Aktuell: vollständiges Angebot im E-Mail-Body.
*/

window.NF_angebot = {
  init: initAngebotModule,
  setup: setupOfferPreviewModal,
  openPreview: openOfferPreview,
  closePreview: closeOfferPreviewModal,
  closeMobileSend: closeMobileGmailSendModal,
  sendOffer: sendOfferForProject,
  renderHistoryHtml: renderOfferHistoryHtml,
  renderStatusBadge: renderProjectStatusBadge,
  buildDocument: buildOfferDocument,
  getNextVersion: getNextOfferVersion,
  setActiveProject: setActiveOfferProject,
  updatePreviewActions: updateOfferPreviewActions,
  getCatalog: () => angebotState.catalog
};

setupOfferPreviewModal();

initAngebotModule().catch(error => {
  console.error("Angebot module init error:", error);
});
