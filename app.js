function renderHero() {

  const hero = document.getElementById("hero");

  if (!hero) return;

  const url =
    typeof NF_WEBSITE_URL === "string"
      ? NF_WEBSITE_URL
      : "https://noirframe.art";

  hero.innerHTML = `

    <div class="heroBar">

      <div class="heroBarLeft">

      <a
        href="${url}"
        target="_blank"
        rel="noopener noreferrer"
        class="nfWebLink checkEngineLink"
        aria-label="NoirFrame Website — www"
        title="Galerien — noirframe.art"
      >
        <span class="checkEngineLamp" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M6 9V7h2V5h2v2h2V5h2v2h2v2h-1v2h1v2h-2v2h-2v-2h-2v2h-2v-2H8v2H6v-2H4V9h2zm12 0h2v4h-2V9zM9 11h1v2H9v-2zm5 0h1v2h-1v-2z"/>
          </svg>
        </span>
      </a>

      <button
        type="button"
        id="heroCatalogBtn"
        class="nfWebLink catalogDashBtn"
        aria-label="NF Katalog"
        title="NF Katalog"
      >
        <span class="catalogDashLamp" aria-hidden="true">📦</span>
      </button>

      <button
        type="button"
        id="heroNewInquiryBtn"
        class="nfWebLink heroNewInquiryBtn"
        aria-label="Neues Angebot — Verfügbarkeit prüfen"
        title="Neues Angebot — Verfügbarkeit prüfen"
      >
        <span class="heroNewInquiryLamp" aria-hidden="true">➕</span>
      </button>

      </div>

      <div class="heroBarRight">

      <button
        type="button"
        id="heroSupervisorBtn"
        class="nfWebLink supervisorCalBtn"
        aria-label="Supervisor — Kalender und Tagessperren"
        title="Supervisor — Kalender"
      >
        <span class="supervisorCalLamp" aria-hidden="true">💉</span>
      </button>

      </div>

    </div>

  `;

}

function setupHeroBarActions() {

  const hero = document.getElementById("hero");

  if (!hero || hero.dataset.heroBarBound === "true") {
    return;
  }

  hero.dataset.heroBarBound = "true";

  hero.addEventListener("click", (event) => {

    if (event.target.closest("#heroNewInquiryBtn")) {

      event.preventDefault();

      addProject();

      return;

    }

    if (event.target.closest("#heroCatalogBtn")) {

      event.preventDefault();

      if (typeof openCatalogScreen === "function") {
        openCatalogScreen();
      }

      return;

    }

    if (event.target.closest("#heroSupervisorBtn")) {

      event.preventDefault();

      window.NF_supervisorCal?.open?.();

    }

  });

}

function renderFooter() {

  const footer = document.getElementById(

    "footer"

  );

  const isDark = getStoredTheme() === "dark";

  footer.innerHTML = `

    <div class="footerBar">

      <span id="serviceTrigger">

  NF OP � 2026

</span>

      <br>

      Created by Marcin Porębski 

      <br>

      Digitaler Assistent: Atlas (ChatGPT)           🦌

      <br>

      Entwicklungspartner: Composer (Cursor)

      <br>

      <button
        type="button"
        id="themeToggle"
        class="themeToggle"
      >
        ${isDark ? "DUNKELMODUS: AN" : "DUNKELMODUS: AUS"}
      </button>

    </div>

  `;

}

function getStoredTheme() {

  try {

    const theme = localStorage.getItem("nfTheme") || "light";

    if (theme === "win7") {
      // TODO CLEANUP NFOP 3.2 — legacy motyw win7
      return "light";
    }

    return theme === "dark" ? "dark" : "light";

  } catch (error) {
    return "light";
  }

}

function applyTheme(theme) {

  const resolved = theme === "dark" ? "dark" : "light";

  document.documentElement.setAttribute(
    "data-theme",
    resolved === "dark" ? "dark" : "light"
  );

  try {
    localStorage.setItem("nfTheme", resolved);
  } catch (error) {}

  const toggle = document.getElementById("themeToggle");

  if (toggle) {
    toggle.textContent =
      resolved === "dark"
        ? "DUNKELMODUS: AN"
        : "DUNKELMODUS: AUS";
  }

}

function setupThemeToggle() {

  const toggle = document.getElementById("themeToggle");

  if (!toggle) return;

  toggle.addEventListener("click", () => {

    const next =
      getStoredTheme() === "dark"
        ? "light"
        : "dark";

    applyTheme(next);

  });

}

function init() {

  loadProjects();

  renderHero();

  setupHeroBarActions();

  renderProjects();

  renderFooter();

  applyTheme(getStoredTheme());

  setupThemeToggle();

  setupServiceMode();

  setupCatalog();

  setupNotesOfferToggleDelegation();

  setupOfferPreviewDelegation();

  setupOfferPreviewModalApp();

  setupProjectMapDelegation();

  window.NF_cpe?.setup?.();

  window.NF_supervisorCal?.setup?.();

  window.NF_operatorTerminCal?.setup?.();

  window.NF_backup?.setup?.();

  window.NF_modalUi?.setup?.();

}

function safeAngebotStatusBadge(project) {

  try {
    return window.NF_angebot?.renderStatusBadge?.(project) || "";
  } catch (error) {
    return "";
  }

}

function safeAngebotHistoryHtml(project) {

  try {
    return window.NF_angebot?.renderHistoryHtml?.(project) || "";
  } catch (error) {
    return "";
  }

}

function openAngebotPreview(projectId) {

  const modal = document.getElementById("offerPreviewModal");
  const body = document.getElementById("offerPreviewBody");

  if (!modal || !body) {

    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert(
      "Angebot-Vorschau fehlt — index.html auf dem iPad aktualisieren."
    );

    return;

  }

  modal.classList.remove("hidden");

  body.innerHTML =
    '<p class="offerPreviewLoading">Angebot wird geladen…</p>';

  try {

    const project =
      state.projects.find(p => p.id === projectId) ||
      window.NF_getProjectById?.(projectId);

    if (!project) {
      throw new Error("Projekt nicht gefunden.");
    }

    if (
      !window.NF_angebot ||
      typeof window.NF_angebot.buildDocument !== "function"
    ) {

      const scriptTag = document.querySelector(
        'script[src*="angebot.js"]'
      );

      throw new Error(
        scriptTag
          ? "Angebot-Modul Fehler — angebot.js prüfen."
          : "angebot.js fehlt — mit index.html synchronisieren."
      );

    }

    if (typeof window.NF_angebot.setActiveProject === "function") {
      window.NF_angebot.setActiveProject(projectId);
    }

    const version =
      typeof window.NF_angebot.getNextVersion === "function"
        ? window.NF_angebot.getNextVersion(project)
        : 1;

    const offerDoc = window.NF_angebot.buildDocument(
      project,
      version,
      new Date()
    );

    body.innerHTML = offerDoc.html;

    if (
      typeof window.NF_angebot.updatePreviewActions === "function"
    ) {
      window.NF_angebot.updatePreviewActions(project, version);
    }

  } catch (error) {

    console.error("Angebot preview:", error);

    body.innerHTML =
      '<div class="offerPreviewError">' +
      escapeHtml(String(error.message || error)) +
      "</div>";

    modal.classList.remove("hidden");

  }

}

function setupOfferPreviewDelegation() {

  const container = document.getElementById("projects");

  if (!container || container.dataset.offerPreviewBound === "true") {
    return;
  }

  container.dataset.offerPreviewBound = "true";

  container.addEventListener("click", (event) => {

    const button = event.target.closest(".offerPdfBtn");

    if (!button) return;

    event.preventDefault();

    event.stopPropagation();

    openAngebotPreview(button.dataset.project);

  });

}

function setupOfferPreviewModalApp() {

  // TODO CLEANUP NFOP 3.2 — częściowy duplikat setupOfferPreviewModal w angebot.js

  if (document.body.dataset.offerModalAppBound === "true") {
    return;
  }

  document.body.dataset.offerModalAppBound = "true";

  document
    .getElementById("closeOfferPreviewBtn")
    ?.addEventListener("click", () => {

      document
        .getElementById("offerPreviewModal")
        ?.classList.add("hidden");

      window.NF_angebot?.closePreview?.();

    });

}

window.openAngebotPreview = openAngebotPreview;

function isProjectComplete(project) {

  return (
    project.tasks.length > 0 &&
    project.tasks.every(task => task.done)
  );

}

function toggleProjectCollapse(projectId) {

  const project = state.projects.find(
    p => p.id === projectId
  );

  if (!project || !isProjectComplete(project)) return;

  project.collapsed = !project.collapsed;

  saveProjects(projectId);

  renderProjects();

}

const state = {

  projects: [],

  // TODO CLEANUP NFOP 3.2 — activeProjectId nieużywane
  activeProjectId: null

};

function createProject() {

  return {

    id: crypto.randomUUID(),

    title: "Neues Projekt",

    client: "",

    number: state.projects.length + 1,

    location: "",

    clientAddress: "",

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

    tasks: [

 { label: "Termin", done: false },

 { label: "Kundendaten", done: false },

 { label: "Bestätigung", done: false },

 { label: "Anzahlung", done: false },

 { label: "Vertrag", done: false },

 { label: "Shooting", done: false },

 { label: "Bearbeitung", done: false },

 { label: "Photonesto", done: false },

 { label: "Google Drive", done: false },

 { label: "Freigabe", done: false },

 { label: "Rechnung", done: false }


    ],

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
    

  };

}

function addProject() {

  startNewInquiry();

}

function startNewInquiry() {

  dateModalMode = "new";

  editingDateProjectId = null;

  inquiryDayApproved = false;

  window.NF_operatorTerminCal?.setSelectedDay?.("");

  const timeInput = document.getElementById("timeInput");

  if (timeInput) {
    timeInput.value = "";
  }

  updateDateModalChrome();

  clearDateModalError();

  clearDateModalOk();

  document.getElementById("dateModal")?.classList.remove("hidden");

  window.NF_operatorTerminCal?.render?.(null);

}

function toggleTask(projectId, taskIndex) {

  const project = state.projects.find(

    p => p.id === projectId

  );

  if (!project) return;

  project.tasks[taskIndex].done =

    !project.tasks[taskIndex].done;

  if (isProjectComplete(project)) {
    project.collapsed = true;
  }

    saveProjects(projectId);

  renderProjects();

}

function editTitle(projectId) {

  const project = state.projects.find(

    p => p.id === projectId

  );

  if (!project) return;

  // TODO NFOP 3.2 — nativer prompt(); eigenes Modal
  const title = prompt(

    "Name des Auftrags",

    project.title

  );

  if (!title) return;

  project.title = title;

  clearProjectCalendarOnStorno(project);

  saveProjects(projectId);

  renderProjects();

  

}

function clearProjectCalendarOnStorno(project) {

  const stornoTitle =
    window.NF_CONFIG?.storno?.title || "AWISTA";

  if (String(project?.title || "").trim() !== stornoTitle) {
    return false;
  }

  project.date = "";

  const termin = Array.isArray(project.tasks)
    ? project.tasks.find(task => task.label === "Termin")
    : null;

  if (termin) {
    termin.done = false;
  }

  return true;

}

// TODO CLEANUP NFOP 3.2 — zastąpione przez openClientModal(); nigdy nie wywoływane
function editClient(projectId) {

  const project = state.projects.find(

    p => p.id === projectId

  );

  if (!project) return;

  // TODO NFOP 3.2 — nativer prompt(); eigenes Modal
  const client = prompt(

    "👤 Name",

    project.client || ""

  );

  if (client === null) return;

  const phone = prompt(

    "📞 Telefon",

    project.phone || ""

  );

  if (phone === null) return;

  const email = prompt(

    "✉️ E-Mail",

    project.email || ""

  );

  if (email === null) return;

  project.client = client;

  project.phone = phone;

  project.email = email;

  const kunde = project.tasks.find(

    task => task.label === "Kundendaten"

  );

  if (kunde) {

    kunde.done = true;

  }

  saveProjects(projectId);

  renderProjects();

}

let editingProjectId = null;

let editingDateProjectId = null;

let dateModalMode = "edit";

let inquiryDayApproved = false;

let mooseClicks = 0;

let mooseTimer = null;

let editingNotesProjectId = null;

const NOTES_MAX_LENGTH = 1000;

const NF_OFFER_START = "[NF-ANGEBOT]";

const NF_OFFER_END = "[/NF-ANGEBOT]";

function escapeHtml(text) {

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

}

function wrapCatalogOfferBlock(text) {

  const trimmed = String(text || "").trim();

  if (
    trimmed.startsWith(NF_OFFER_START) &&
    trimmed.endsWith(NF_OFFER_END)
  ) {
    return trimmed;
  }

  return (
    NF_OFFER_START +
    "\n" +
    trimmed +
    "\n" +
    NF_OFFER_END
  );

}

function parseProjectNotesParts(notes) {

  if (!notes || !String(notes).trim()) {
    return [];
  }

  const parts = [];

  let remaining = String(notes);

  let offerIndex = 0;

  while (remaining.length) {

    const start = remaining.indexOf(NF_OFFER_START);

    if (start === -1) {

      const text = remaining.trim();

      if (text) {
        parts.push({
          type: "text",
          content: text
        });
      }

      break;

    }

    if (start > 0) {

      const text = remaining.slice(0, start).trim();

      if (text) {
        parts.push({
          type: "text",
          content: text
        });
      }

    }

    const contentStart = start + NF_OFFER_START.length;

    const end = remaining.indexOf(
      NF_OFFER_END,
      contentStart
    );

    if (end === -1) {

      parts.push({
        type: "text",
        content: remaining.slice(start).trim()
      });

      break;

    }

    const offerContent = remaining
      .slice(contentStart, end)
      .trim();

    if (offerContent) {

      parts.push({
        type: "offer",
        content: offerContent,
        offerIndex: offerIndex++
      });

    }

    remaining = remaining.slice(
      end + NF_OFFER_END.length
    );

  }

  return parts;

}

function serializeProjectNotesParts(parts) {

  return parts
    .map(part => {

      if (part.type === "text") {
        return part.content.trim();
      }

      return wrapCatalogOfferBlock(part.content);

    })
    .filter(Boolean)
    .join("\n\n");

}


function removeOfferFromNotes(notes, offerIndexToRemove) {

  let offerCount = 0;

  const filtered = parseProjectNotesParts(notes).filter(
    part => {

      if (part.type !== "offer") {
        return true;
      }

      const remove =
        offerCount === offerIndexToRemove;

      offerCount++;

      return !remove;

    }
  );

  return serializeProjectNotesParts(filtered);

}

function buildNotesModalPreviewHtml(notes) {

  const parts = parseProjectNotesParts(notes);

  if (!parts.length) {
    return `<p class="notesPreviewEmpty">Keine Notizen.</p>`;
  }

  return parts.map(part => {

    if (part.type === "text") {

      return (
        `<div class="notesModalText">` +
        escapeHtml(part.content).replace(/\n/g, "<br>") +
        `</div>`
      );

    }

    const lines = part.content
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    const title = lines[0] || "Paket";
    const details = lines.slice(1);

    const detailsHtml = details.length
      ? `<ul class="notesModalPackageDetails">${details.map(line =>
          `<li>${escapeHtml(line)}</li>`
        ).join("")}</ul>`
      : "";

    return (
      `<article class="notesModalPackage">` +
      `<h3 class="notesModalPackageTitle">${escapeHtml(title)}</h3>` +
      detailsHtml +
      `</article>`
    );

  }).join("");

}

function buildProjectNotesHtml(notes, projectId) {

  const parts = parseProjectNotesParts(notes);

  if (!parts.length) {
    return `<span class="projectNotesPlaceholder">Notizen</span>`;
  }

  return parts.map(part => {

    if (part.type === "text") {

      return `<span class="projectNotesText">${escapeHtml(part.content).replace(/\n/g, "<br>")}</span>`;

    }

    const titleLine =
      part.content.split("\n")[0] || "Angebot";

    return `

<div
  class="projectNotesOffer"
  data-offer-index="${part.offerIndex}"
  data-project="${projectId}"
>

  <div class="projectNotesOfferHead">

    <button
      type="button"
      class="projectNotesOfferToggle"
      aria-expanded="false"
    >
      <span class="projectNotesOfferIcon" aria-hidden="true">＋</span>
      <span class="projectNotesOfferTitle">${escapeHtml(titleLine)}</span>
    </button>

    <button
      type="button"
      class="projectNotesOfferRemove"
      aria-label="Paket entfernen"
      title="Paket entfernen"
    >✕</button>

  </div>

  <div class="projectNotesOfferBody hidden">${escapeHtml(part.content).replace(/\n/g, "<br>")}</div>

</div>`;

  }).join("");

}

function renderProjectNotesDisplay(project) {

  const notes = (project.notes || "").trim();

  if (!notes) {

    return `
<div
  class="projectNotes"
  data-project="${project.id}"
>
📝 Notizen
</div>`;

  }

  return `
<div
  class="projectNotes"
  data-project="${project.id}"
>
  <span class="projectNotesLead">📝</span>
  <div class="projectNotesContent">${buildProjectNotesHtml(notes, project.id)}</div>
</div>`;

}

function removeProjectOfferBlock(
  projectId,
  offerIndex
) {

  const project = state.projects.find(
    p => p.id === projectId
  );

  if (!project) return;

  if (
    Number.isNaN(offerIndex) ||
    offerIndex < 0
  ) {
    return;
  }

  if (
    // TODO NFOP 3.2 — nativer confirm(); eigenes Modal
    !confirm("Paket aus Notizen entfernen?")
  ) {
    return;
  }

  project.notes = removeOfferFromNotes(
    project.notes || "",
    offerIndex
  );

  project.notesUpdatedAt =
    new Date().toISOString();

  if (editingNotesProjectId === projectId) {

    const input = document.getElementById("notesInput");

    if (input) {
      input.value = project.notes;
    }

    updateNotesCharCount();

    renderNotesPreviewContent();

  }

  saveProjects(projectId);

  renderProjects();

}

function setupNotesOfferToggleDelegation() {

  const bindContainer = (container) => {

    if (!container || container.dataset.offerActionsBound) {
      return;
    }

    container.dataset.offerActionsBound = "true";

    container.addEventListener("click", (event) => {

      const removeBtn = event.target.closest(
        ".projectNotesOfferRemove"
      );

      if (removeBtn) {

        event.preventDefault();

        event.stopPropagation();

        const offer = removeBtn.closest(
          ".projectNotesOffer"
        );

        if (!offer) return;

        const projectId =
          offer.dataset.project ||
          offer.closest(".projectNotes")?.dataset.project;

        removeProjectOfferBlock(
          projectId,
          Number(offer.dataset.offerIndex)
        );

        return;

      }

      const toggle = event.target.closest(
        ".projectNotesOfferToggle"
      );

      if (!toggle) return;

      event.preventDefault();

      event.stopPropagation();

      const offer = toggle.closest(".projectNotesOffer");

      const body = offer?.querySelector(
        ".projectNotesOfferBody"
      );

      const icon = toggle.querySelector(
        ".projectNotesOfferIcon"
      );

      if (!body) return;

      const expanded =
        toggle.getAttribute("aria-expanded") === "true";

      toggle.setAttribute(
        "aria-expanded",
        expanded ? "false" : "true"
      );

      body.classList.toggle("hidden", expanded);

      if (icon) {
        icon.textContent = expanded ? "＋" : "−";
      }

    });

  };

  bindContainer(document.getElementById("projects"));

  bindContainer(document.getElementById("notesPreview"));

}

function applyCatalogOfferToProject(
  projectId,
  offerText
) {

  const project = state.projects.find(
    p => p.id === projectId
  );

  if (!project) return false;

  const block = wrapCatalogOfferBlock(offerText);

  const existing = (project.notes || "").trim();

  const separator = existing ? "\n\n" : "";

  let combined = existing + separator + block;

  if (combined.length > NOTES_MAX_LENGTH) {

    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert(
      "Notizen voll (max " +
      NOTES_MAX_LENGTH +
      " Zeichen). Bitte ein Paket entfernen."
    );

    return false;

  }

  project.notes = combined;

  project.notesUpdatedAt =
    new Date().toISOString();

  saveProjects(projectId);

  renderProjects();

  return true;

}

function getProjectOptionsForCatalog() {

  return state.projects.map(project => ({

    id: project.id,

    label: `${project.title} — ${project.client || "Kunde"}`

  }));

}

window.NF_getProjectOptions = getProjectOptionsForCatalog;

window.NF_applyCatalogOfferToProject =
  applyCatalogOfferToProject;

window.NF_parseProjectNotesParts = parseProjectNotesParts;

window.NF_getProjectOfferBlocks = function(project) {

  return parseProjectNotesParts(project.notes || "").filter(
    part => part.type === "offer"
  );

};

let notesModalMode = "preview";

function renderNotesPreviewContent() {

  const preview = document.getElementById("notesPreview");

  const textarea = document.getElementById("notesInput");

  if (!preview || !textarea) return;

  const notes = textarea.value.trim();

  if (!notes) {

    preview.innerHTML =
      `<p class="notesPreviewEmpty">Keine Notizen.</p>`;

    return;

  }

  preview.innerHTML = buildNotesModalPreviewHtml(notes);

}

function setNotesModalMode(mode) {

  notesModalMode = mode === "edit" ? "edit" : "preview";

  const preview = document.getElementById("notesPreview");

  const textarea = document.getElementById("notesInput");

  const toggleBtn = document.getElementById(
    "toggleNotesEditBtn"
  );

  const modalContent = document.querySelector(
    ".notesCenter"
  );

  const saveBtn = document.getElementById("saveNotesBtn");
  const cancelBtn = document.getElementById("cancelNotesBtn");

  if (notesModalMode === "preview") {

    renderNotesPreviewContent();

    preview?.classList.remove("hidden");

    textarea?.classList.add("hidden");

    modalContent?.classList.remove("notesCenter--edit");

    if (toggleBtn) {
      toggleBtn.textContent = "✏️ Bearbeiten";
    }

    if (saveBtn) {
      saveBtn.classList.add("hidden");
    }

    if (cancelBtn) {
      cancelBtn.textContent = "Schließen";
    }

    return;

  }

  if (saveBtn) {
    saveBtn.classList.remove("hidden");
  }

  if (cancelBtn) {
    cancelBtn.textContent = "❌ Abbrechen";
  }

  preview?.classList.add("hidden");

  textarea?.classList.remove("hidden");

  modalContent?.classList.add("notesCenter--edit");

  if (toggleBtn) {
    toggleBtn.textContent = "👁 Vorschau";
  }

  textarea?.focus();

  handleNotesInput();

}

function toggleNotesModalMode() {

  setNotesModalMode(
    notesModalMode === "preview" ? "edit" : "preview"
  );

}

function openNotesPreview(projectId) {

  editNotes(projectId);

  setNotesModalMode("preview");

}

window.NF_openNotesPreview = openNotesPreview;


function showClientGateMessage(gate, projectId) {

  if (!gate || gate.allowed) {
    return true;
  }

  // TODO NFOP 3.2 — nativer alert(); eigenes Modal
  window.alert(gate.message);

  if (
    gate.code === "NO_TERMIN" ||
    gate.code === "TERMIN_OPEN" ||
    gate.code === "DAY_FULL" ||
    gate.code === "PRIVATE_BLOCK"
  ) {
    editDate(projectId);
  }

  return false;

}

function getKundendatenGate(project) {

  if (typeof window.NF_cpe?.isKundendatenAllowed !== "function") {
    return { allowed: true };
  }

  return window.NF_cpe.isKundendatenAllowed(
    project,
    state.projects
  );

}

function openClientModal(projectId){

  const project = state.projects.find(
    p => p.id === projectId
  );

  if(!project) return;

  if (!showClientGateMessage(getKundendatenGate(project), projectId)) {
    return;
  }

  editingProjectId = projectId;

  document.getElementById(
    "clientNameInput"
  ).value = project.client || "";

  document.getElementById(
    "clientPhoneInput"
  ).value = project.phone || "";

  document.getElementById(
    "clientEmailInput"
  ).value = project.email || "";

 document.getElementById(
  "clientAddressInput"
).value = project.clientAddress || "";

  document.getElementById(
    "clientModal"
  ).classList.remove("hidden");

}

function getTodayDateString() {

  const now = new Date();

  const pad = value =>
    String(value).padStart(2, "0");

  return (
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate())
  );

}

function splitProjectDate(dateValue) {

  if (!dateValue) {
    return { date: "", time: "" };
  }

  const trimmed = String(dateValue).trim();

  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/
  );

  if (match) {
    return {
      date: match[1],
      time: match[2] || ""
    };
  }

  return { date: "", time: "" };

}

function isValidEventTime(timeValue) {

  if (!timeValue || !String(timeValue).trim()) {
    return true;
  }

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    String(timeValue).trim()
  );

}

function parseEventDateTime(dateStr, timeStr) {

  const [year, month, day] = dateStr
    .split("-")
    .map(Number);

  let hours = 0;

  let minutes = 0;

  if (timeStr && String(timeStr).trim()) {

    const parts = String(timeStr).trim().split(":");

    hours = Number(parts[0]);

    minutes = Number(parts[1]);

  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);

}

function validateEventDateTime(dateStr, timeStr) {

  const date = (dateStr || "").trim();

  const time = (timeStr || "").trim();

  if (!date) {

    return {
      ok: false,
      message: "Bitte Datum wählen."
    };

  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {

    return {
      ok: false,
      message: "Ungültiges Datum."
    };

  }

  if (time && !isValidEventTime(time)) {

    return {
      ok: false,
      message: "Ungültige Uhrzeit (HH:MM, z. B. 14:30)."
    };

  }

  const todayStart = new Date();

  todayStart.setHours(0, 0, 0, 0);

  const eventDay = parseEventDateTime(date, "");

  if (eventDay < todayStart) {

    return {
      ok: false,
      message: "Datum darf nicht in der Vergangenheit liegen."
    };

  }

  if (time) {

    const eventDateTime = parseEventDateTime(date, time);

    if (eventDateTime.getTime() < Date.now()) {

      return {
        ok: false,
        message: "Termin darf nicht in der Vergangenheit liegen."
      };

    }

  }

  return {
    ok: true,
    value: time ? `${date} ${time}` : date
  };

}

function clearDateModalError() {

  const error = document.getElementById("dateModalError");

  if (!error) return;

  error.textContent = "";

  error.classList.add("hidden");

}

function showDateModalOk(message) {

  const ok = document.getElementById("dateModalOk");

  if (!ok) return;

  ok.textContent = message;

  ok.classList.remove("hidden");

}

function clearDateModalOk() {

  const ok = document.getElementById("dateModalOk");

  if (!ok) return;

  ok.textContent = "";

  ok.classList.add("hidden");

}

function updateDateModalChrome() {

  const title = document.getElementById("dateModalTitle");

  const hint = document.getElementById("dateModalHint");

  const saveBtn = document.getElementById("saveDateBtn");

  const removeBtn = document.getElementById("removeDateBtn");

  const isNew = dateModalMode === "new";

  if (title) {
    title.textContent = isNew
      ? "📅 Verfügbarkeit prüfen"
      : "📅 Termin";
  }

  if (hint) {
    hint.textContent = isNew
      ? "Kundenwunsch — Tag im Kalender wählen. Belegte Tage sind nicht buchbar."
      : "Tag im Kalender wählen oder Termin entfernen.";
  }

  if (saveBtn) {
    saveBtn.textContent = isNew ? "Auftrag anlegen" : "Speichern";
    saveBtn.disabled = isNew && !inquiryDayApproved;
  }

  if (removeBtn) {
    removeBtn.classList.toggle("hidden", isNew);

    if (!isNew) {
      updateRemoveDateButtonState();
    }
  }

}

function getSelectedEventDateValue() {

  return window.NF_operatorTerminCal?.getSelectedDay?.() || "";

}

window.NF_onInquiryDaySelected = function(day) {

  inquiryDayApproved = true;

  clearDateModalError();

  showDateModalOk(
    "Frei — Termin verfügbar am " +
    formatGermanDateFromIso(day) +
    ". Jetzt Auftrag anlegen."
  );

  updateDateModalChrome();

};

window.NF_onInquiryDayBlocked = function() {

  inquiryDayApproved = false;

  clearDateModalOk();

  updateDateModalChrome();

};

function formatGermanDateFromIso(isoDate) {

  const match = String(isoDate || "").match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) {
    return isoDate || "";
  }

  return match[3] + "." + match[2] + "." + match[1];

}

function showDateModalError(message) {

  const error = document.getElementById("dateModalError");

  if (!error) return;

  error.textContent = message;

  error.classList.remove("hidden");

}

function closeDateModal() {

  clearDateModalError();

  clearDateModalOk();

  document
    .getElementById("dateModal")
    ?.classList.add("hidden");

  editingDateProjectId = null;

  dateModalMode = "edit";

  inquiryDayApproved = false;

  window.NF_operatorTerminCal?.reset?.();

}

function updateRemoveDateButtonState() {

  const removeBtn = document.getElementById("removeDateBtn");

  if (!removeBtn || !editingDateProjectId) {
    return;
  }

  const project = state.projects.find(
    p => p.id === editingDateProjectId
  );

  const hasDate = Boolean(
    getSelectedEventDateValue() ||
    (project?.date || "").trim()
  );

  removeBtn.disabled = !hasDate;

}

function clearEventDateFromProject() {

  const project = state.projects.find(
    p => p.id === editingDateProjectId
  );

  if (!project) return;

  clearDateModalError();

  project.date = "";

  const termin = project.tasks.find(
    task => task.label === "Termin"
  );

  if (termin) {
    termin.done = false;
  }

  saveProjects(editingDateProjectId);

  renderProjects();

  closeDateModal();

}

function saveEventDate() {

  const timeInput = document.getElementById("timeInput");

  const dateVal = getSelectedEventDateValue();

  const timeVal = (timeInput?.value || "").trim();

  if (dateModalMode === "new") {

    if (!inquiryDayApproved || !dateVal) {
      showDateModalError("Bitte zuerst einen freien Tag wählen.");
      return;
    }

    const validation = validateEventDateTime(dateVal, timeVal);

    if (!validation.ok) {
      showDateModalError(validation.message);
      return;
    }

    const capacityCheck = window.NF_cpe?.checkTerminBooking?.(
      { id: "__new__", date: "" },
      validation.value,
      state.projects
    );

    if (capacityCheck && !capacityCheck.allowed) {
      showDateModalError(capacityCheck.message);
      inquiryDayApproved = false;
      updateDateModalChrome();
      return;
    }

    const project = createProject();

    project.date = validation.value;

    const termin = project.tasks.find(
      task => task.label === "Termin"
    );

    if (termin) {
      termin.done = true;
    }

    state.projects.unshift(project);

    saveProjects(project.id);

    renderProjects();

    closeDateModal();

    window.NF_cpe?.onProjectDateSaved?.(project, state.projects);

    return;

  }

  const project = state.projects.find(
    p => p.id === editingDateProjectId
  );

  if (!project) return;

  if (!dateVal) {

    if (timeVal) {
      showDateModalError("Uhrzeit ohne Datum ist nicht möglich.");
      return;
    }

    clearEventDateFromProject();

    return;

  }

  const validation = validateEventDateTime(
    dateVal,
    timeVal
  );

  if (!validation.ok) {
    showDateModalError(validation.message);
    return;
  }

  const capacityCheck = window.NF_cpe?.checkTerminBooking?.(
    project,
    validation.value,
    state.projects
  );

  if (capacityCheck && !capacityCheck.allowed) {
    showDateModalError(capacityCheck.message);
    return;
  }

  clearDateModalError();

  project.date = validation.value;

  const termin = project.tasks.find(
    task => task.label === "Termin"
  );

  if (termin) {
    termin.done = true;
  }

  saveProjects(editingDateProjectId);

  renderProjects();

  closeDateModal();

  window.NF_cpe?.onProjectDateSaved?.(project, state.projects);

}

window.NF_validateEventDateTime = validateEventDateTime;

function editDate(projectId) {

  const project = state.projects.find(
    p => p.id === projectId
  );

  if (!project) return;

  dateModalMode = "edit";

  inquiryDayApproved = false;

  editingDateProjectId = projectId;

  const parts = splitProjectDate(project.date || "");

  const timeInput = document.getElementById("timeInput");

  window.NF_operatorTerminCal?.setSelectedDay?.(parts.date);

  if (timeInput) {
    timeInput.value = parts.time;
  }

  updateDateModalChrome();

  clearDateModalError();

  clearDateModalOk();

  document
    .getElementById("dateModal")
    .classList.remove("hidden");

  window.NF_operatorTerminCal?.render?.(projectId);

}

window.NF_showDateModalError = showDateModalError;

window.NF_clearDateModalError = clearDateModalError;

function formatEventAddress(project) {

  const plz = (project.eventPostalCode || "").trim();

  const ort = (project.eventCity || "").trim();

  const str = (project.eventStreet || "").trim();

  const haus = (project.eventHouseNumber || "").trim();

  const hasStructured = plz || ort || str || haus;

  if (hasStructured) {

    const streetPart = [str, haus].filter(Boolean).join(" ");

    const cityPart = [plz, ort].filter(Boolean).join(" ");

    return [streetPart, cityPart].filter(Boolean).join(", ");

  }

  return (
    project.eventAddress ||
    project.address ||
    ""
  ).trim();

}

window.NF_formatEventAddress = formatEventAddress;

window.NF_getProjectById = function(projectId) {

  const project = state.projects.find(
    p => p.id === projectId
  );

  return project || null;

};

window.NF_getProjects = function() {
  return state.projects;
};

function editAddress(projectId) {

  const project = state.projects.find(
    p => p.id === projectId
  );

  if (!project) return;

  editingProjectId = projectId;

  document.getElementById("eventPostalCodeInput").value =
    project.eventPostalCode || "";

  document.getElementById("eventCityInput").value =
    project.eventCity || "";

  document.getElementById("eventStreetInput").value =
    project.eventStreet || "";

  document.getElementById("eventHouseNumberInput").value =
    project.eventHouseNumber || "";

  document
    .getElementById("eventAddressModal")
    .classList.remove("hidden");

}

function getProjectEventAddress(project) {

  return formatEventAddress(project);

}

function buildGoogleMapsDirectionsUrl(address) {

  if (window.NF_travel?.buildGoogleMapsUrl) {
    return window.NF_travel.buildGoogleMapsUrl(address);
  }

  const travelMode =
    window.NF_CONFIG?.maps?.travelMode || "driving";

  const params = new URLSearchParams({
    api: "1",
    destination: address,
    travelmode: travelMode
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;

}

function setupProjectMapDelegation() {

  const container = document.getElementById("projects");

  if (!container || container.dataset.mapBound === "true") {
    return;
  }

  container.dataset.mapBound = "true";

  container.addEventListener("click", (event) => {

    const mapBtn = event.target.closest(".projectAddressMapBtn");

    if (!mapBtn || mapBtn.disabled) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    openEventAddressInMaps(mapBtn.dataset.project);

  });

}

function openEventAddressInMaps(projectId) {

  const project = state.projects.find(
    p => p.id === projectId
  );

  if (!project) return;

  const address = getProjectEventAddress(project);

  if (!address) {

    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    alert("Keine Veranstaltungsadresse hinterlegt.");

    return;

  }

  if (window.NF_travel?.openGoogleMaps) {
    window.NF_travel.openGoogleMaps(address);
    return;
  }

  const url = buildGoogleMapsDirectionsUrl(address);
  const link = document.createElement("a");

  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

}

function editNotes(projectId) {

  const project = state.projects.find(

    p => p.id === projectId

  );

  if (!project) return;

  editingNotesProjectId = projectId;

  document.getElementById("notesInput").value =
    project.notes || "";

  updateNotesCharCount();

  updateNotesLastEdited(project);

  document
    .getElementById("notesModal")
    .classList.remove("hidden");

  setNotesModalMode("preview");

}

function updateNotesCharCount() {

  const length =
    document.getElementById("notesInput").value.length;

  document.getElementById("notesCharCount").textContent =
    length + " / " + NOTES_MAX_LENGTH + " Zeichen";

}

function autoResizeNotesTextarea() {

  const textarea =
    document.getElementById("notesInput");

  if (!textarea || notesModalMode !== "edit") return;

  textarea.style.height = "auto";

  const nextHeight = Math.min(
    textarea.scrollHeight,
    240
  );

  textarea.style.height = nextHeight + "px";

  textarea.style.overflowY =
    textarea.scrollHeight > 240 ? "auto" : "hidden";

}

function handleNotesInput() {

  updateNotesCharCount();

  autoResizeNotesTextarea();

}

function formatNotesTimestamp(isoString) {

  const date = new Date(isoString);

  const pad = value =>
    String(value).padStart(2, "0");

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

function updateNotesLastEdited(project) {

  const element =
    document.getElementById("notesLastEdited");

  if (!project.notesUpdatedAt) {

    element.classList.add("hidden");

    element.textContent = "";

    return;

  }

  element.textContent =
    "Zuletzt bearbeitet: " +
    formatNotesTimestamp(project.notesUpdatedAt);

  element.classList.remove("hidden");

}

function saveNotes() {

  const project = state.projects.find(
    p => p.id === editingNotesProjectId
  );

  if (!project) return;

  project.notes =
    document.getElementById("notesInput").value;

  project.notesUpdatedAt =
    new Date().toISOString();

  closeNotesModal();

  saveProjects(editingNotesProjectId);

  renderProjects();

}

function closeNotesModal() {

  document
    .getElementById("notesModal")
    .classList.add("hidden");

  editingNotesProjectId = null;

  notesModalMode = "preview";

}

// TODO CLEANUP NFOP 3.2 — martwy kod; listenery są w renderProjects()
function bindEvents() {

  document
    .getElementById("newProjectButton")
    ?.addEventListener("click", addProject);

  document
    .querySelectorAll(".projectNotes")
    .forEach(item => {

      item.addEventListener("click", (event) => {

        if (
          event.target.closest(".projectNotesOfferToggle") ||
          event.target.closest(".projectNotesOfferRemove")
        ) {
          return;
        }

        editNotes(item.dataset.project);

      });

    });

  document
    .querySelectorAll(".taskItem")
    .forEach(item => {

      item.addEventListener("click", () =>
        toggleTask(
          item.dataset.project,
          Number(item.dataset.task)
        )
      );

    });

  document
    .querySelectorAll(".projectTitle")
    .forEach(item => {

      item.addEventListener("click", () =>
        editTitle(item.dataset.project)
      );

    });

  document
    .querySelectorAll(".clientName")
    .forEach(item => {

      item.addEventListener("click", () =>
        openClientModal(item.dataset.project)
      );

    });

  document
    .querySelectorAll(".projectAddressMapBtn")
    .forEach(item => {

      item.addEventListener("click", (event) => {

        event.stopPropagation();

        openEventAddressInMaps(item.dataset.project);

      });

    });

  document
    .querySelectorAll(".projectDate")
    .forEach(item => {

      item.addEventListener("click", () =>
        editDate(item.dataset.project)
      );

    });

}

let completedSectionCollapsed = true;

function toggleCompletedSection() {

  completedSectionCollapsed = !completedSectionCollapsed;

  renderProjects();

}

function buildProjectCardHtml(project, options) {

  const archive = options && options.archive === true;

  const doneCount = project.tasks.filter(
    task => task.done
  ).length;

  const totalCount = project.tasks.length;

  const isComplete = isProjectComplete(project);

  const isCollapsed =
    isComplete && project.collapsed === true;

  const percent = totalCount
    ? Math.round((doneCount / totalCount) * 100)
    : 0;

  const kundeGate = getKundendatenGate(project);

  const clientLockedClass = kundeGate.allowed
    ? ""
    : " clientName--locked";

  const cardClasses = [
    "card",
    isCollapsed ? "card--collapsed" : "",
    archive ? "card--archive" : ""
  ].filter(Boolean).join(" ");

  return `

      <div class="${cardClasses}">

        <h3
          class="projectTitle"
          data-project="${project.id}"
          data-complete="${isComplete ? "true" : "false"}"
        >
          ${isComplete ? "📦" : "📷"} ${project.title}
          ${isComplete
            ? `<span class="projectCompleteMark">${doneCount}/${totalCount} ${isCollapsed ? "▶" : "▼"}</span>`
            : ""}
          <span
            class="projectEditBtn"
            data-project="${project.id}"
            role="button"
            tabindex="0"
          >✏️</span>
        </h3>

        <div class="projectBody${isCollapsed ? " hidden" : ""}">

        ${safeAngebotStatusBadge(project)}

        <h4>Termin</h4>

        <div class="projectDateRow">

        <p
          class="projectDate"
          data-project="${project.id}"
        >
          📅 ${project.date || "Termin wählen"}
        </p>

        </div>

        <h4>Kundendaten</h4>

        <p
          class="clientName${clientLockedClass}"
          data-project="${project.id}"
          title="${kundeGate.allowed ? "" : kundeGate.message}"
        >

👤 ${project.client || "—"}

<br>

📞 ${project.phone || "-"}

<br>

✉️ ${project.email || "-"}

</p>

        <div class="projectAddressRow">

        <p
class="projectAddress"
data-project="${project.id}"
>

📍 ${formatEventAddress(project) || "Adresse"}

</p>

        <button
          type="button"
          class="projectAddressMapBtn"
          data-project="${project.id}"
          aria-label="Entfernung in Google Maps prüfen"
          title="Route & Entfernung — Google Maps"
          ${getProjectEventAddress(project) ? "" : "disabled"}
        >
          🗺
        </button>

        </div>

        ${renderProjectNotesDisplay(project)}

        ${safeAngebotHistoryHtml(project)}

        <button
          class="offerPdfBtn"
          type="button"
          data-project="${project.id}"
        >
          📋 Angebot Vorschau
        </button>

        <h4>

          ☑ Ablauf

        </h4>

        <div class="progressBlock">
          <div class="progressLabel">
            <span>FORTSCHRITT</span>
            <span>${doneCount} / ${totalCount}</span>
          </div>
          <div class="progressTrack">
            <div
              class="progressFill${isComplete ? " progressFill--complete" : ""}"
              style="width:${percent}%"
            ></div>
          </div>
        </div>

        <p class="nextStep">

          ${isComplete

            ? "📦 Bereit zum Archivieren"

            : `👉 Jetzt: ${project.tasks.find(task => !task.done)?.label}`}

        </p>

        <ul class="taskList">

          ${project.tasks.map((task,index) => `

            <li
              class="taskItem"
              data-project="${project.id}"
              data-task="${index}"
            >
              ${task.done ? "☑" : "☐"}
              ${task.label}
            </li>

          `).join("")}

        </ul>

        </div>

      </div>

    `;

}

function renderProjects() {

  const container = document.getElementById("projects");

  const activeProjects = state.projects.filter(
    project => !isProjectComplete(project)
  );

  const completedProjects = state.projects.filter(
    project => isProjectComplete(project)
  );

  let html = `

    <div class="card">

      <h2>Aktive Projekte</h2>

      <p>${activeProjects.length} aktiv${completedProjects.length ? ` · ${completedProjects.length} abgeschlossen` : ""}</p>

    </div>

  `;

  activeProjects.forEach(project => {
    html += buildProjectCardHtml(project);
  });

  if (completedProjects.length) {

    html += `

    <div class="completedProjectsSection">

      <button
        type="button"
        id="completedSectionToggle"
        class="completedSectionHeader"
        aria-expanded="${completedSectionCollapsed ? "false" : "true"}"
      >
        📦 Abgeschlossene Aufträge (${completedProjects.length})
        <span class="completedSectionChevron">${completedSectionCollapsed ? "▶" : "▼"}</span>
      </button>

      <div class="completedProjectsBody${completedSectionCollapsed ? " hidden" : ""}">

    `;

    completedProjects.forEach(project => {
      html += buildProjectCardHtml(project, { archive: true });
    });

    html += `

      </div>

    </div>

    `;

  }

  container.innerHTML = html;

  document

    .getElementById("completedSectionToggle")

    ?.addEventListener("click", toggleCompletedSection);
document

.querySelectorAll(".projectNotes")

.forEach(item => {

  item.addEventListener(

    "click",

    (event) => {

      if (
        event.target.closest(".projectNotesOfferToggle") ||
        event.target.closest(".projectNotesOfferRemove")
      ) {
        return;
      }

      editNotes(item.dataset.project);

    }

  );

});

  document

    .querySelectorAll(".taskItem")

    .forEach(item => {

      item.addEventListener(

        "click",

        () => toggleTask(

          item.dataset.project,

          Number(item.dataset.task)

        )

      );

    });

  document

    .querySelectorAll(".projectTitle")

    .forEach(item => {

      item.addEventListener(

        "click",

        (event) => {

          if (event.target.closest(".projectEditBtn")) {
            return;
          }

          const projectId = item.dataset.project;

          if (item.dataset.complete === "true") {
            toggleProjectCollapse(projectId);
            return;
          }

          editTitle(projectId);

        }

      );

    });

  document

    .querySelectorAll(".projectEditBtn")

    .forEach(item => {

      item.addEventListener("click", (event) => {

        event.stopPropagation();

        editTitle(item.dataset.project);

      });

      item.addEventListener("keydown", (event) => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          event.stopPropagation();
          editTitle(item.dataset.project);
        }

      });

    });

  document

    .querySelectorAll(".clientName")

    .forEach(item => {

      item.addEventListener(

        "click",

        () => openClientModal
        (item.dataset.project)

      );

    });

  document

    .querySelectorAll(".projectAddress")

    .forEach(item => {

      item.addEventListener(

        "click",

        () => editAddress(

          item.dataset.project

        )

      );

    });

  document

  .querySelectorAll(".projectDate")

  .forEach(item => {

    item.addEventListener(

      "click",

      () => editDate(

        item.dataset.project

        
      )

    );

  });

}


document
  .getElementById("saveClientBtn")
  ?.addEventListener("click", () => {

    const project = state.projects.find(
      p => p.id === editingProjectId
    );

    if (!project) return;

    const gate = getKundendatenGate(project);

    if (!showClientGateMessage(gate, editingProjectId)) {
      return;
    }

    project.client =
      document.getElementById("clientNameInput").value;

    project.phone =
      document.getElementById("clientPhoneInput").value;

    project.email =
      document.getElementById("clientEmailInput").value;

    project.clientAddress =
  document.getElementById("clientAddressInput").value;

    const kunde = project.tasks.find(
      task => task.label === "Kundendaten"
    );

    if (kunde) {
      kunde.done = true;
    }

    document
      .getElementById("clientModal")
      .classList.add("hidden");

    saveProjects(editingProjectId);

    renderProjects();

});

document
  .getElementById("saveDateBtn")
  ?.addEventListener("click", saveEventDate);

document
  .getElementById("removeDateBtn")
  ?.addEventListener("click", clearEventDateFromProject);

document
  .getElementById("cancelDateBtn")
  ?.addEventListener("click", closeDateModal);

document
  .getElementById("timeInput")
  ?.addEventListener("input", clearDateModalError);

document
  .getElementById("saveEventAddressBtn")
  ?.addEventListener("click", () => {

    const project = state.projects.find(
      p => p.id === editingProjectId
    );

    if (!project) return;

    project.eventPostalCode =
      document.getElementById("eventPostalCodeInput").value.trim();

    project.eventCity =
      document.getElementById("eventCityInput").value.trim();

    project.eventStreet =
      document.getElementById("eventStreetInput").value.trim();

    project.eventHouseNumber =
      document.getElementById("eventHouseNumberInput").value.trim();

    project.eventAddress = formatEventAddress(project);

    document
      .getElementById("eventAddressModal")
      .classList.add("hidden");

    saveProjects(editingProjectId);

    renderProjects();

  });

document
  .getElementById("saveNotesBtn")
  ?.addEventListener("click", saveNotes);

document
  .getElementById("cancelNotesBtn")
  ?.addEventListener("click", closeNotesModal);

document
  .getElementById("toggleNotesEditBtn")
  ?.addEventListener("click", toggleNotesModalMode);

document
  .getElementById("notesInput")
  ?.addEventListener("input", handleNotesInput);

document
  .getElementById("notesInput")
  ?.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {

      event.preventDefault();

      closeNotesModal();

      return;

    }

    if (event.ctrlKey && event.key === "Enter") {

      event.preventDefault();

      saveNotes();

    }

  });

document.addEventListener("keydown", (event) => {

  if (event.key !== "Escape") return;

  const catalogProductModal =
    document.getElementById("catalogProductModal");

  if (
    catalogProductModal &&
    !catalogProductModal.classList.contains("hidden")
  ) {
    closeCatalogProductModal();
    return;
  }

  const catalogModal =
    document.getElementById("catalogModal");

  if (
    catalogModal &&
    !catalogModal.classList.contains("hidden")
  ) {
    if (
      isCatalogDesktopLayout() &&
      catalogState.activeProductId
    ) {
      clearCatalogProductSelection();
      return;
    }

    closeCatalogScreen();
    return;
  }

  const serviceModal =
    document.getElementById("serviceModal");

  if (
    serviceModal &&
    !serviceModal.classList.contains("hidden")
  ) {
    closeServiceModal();
    return;
  }

  const notesModal =
    document.getElementById("notesModal");

  if (
    notesModal &&
    !notesModal.classList.contains("hidden")
  ) {
    closeNotesModal();
    return;
  }

  const dateModal =
    document.getElementById("dateModal");

  if (
    dateModal &&
    !dateModal.classList.contains("hidden")
  ) {
    closeDateModal();
    return;
  }

  const offerMobileSendModal =
    document.getElementById("offerMobileSendModal");

  if (
    offerMobileSendModal &&
    !offerMobileSendModal.classList.contains("hidden")
  ) {
    window.NF_angebot?.closeMobileSend?.();
    return;
  }

  const offerPreviewModal =
    document.getElementById("offerPreviewModal");

  if (
    offerPreviewModal &&
    !offerPreviewModal.classList.contains("hidden")
  ) {
    window.NF_angebot?.closePreview?.();
    return;
  }

  const clientModal =
    document.getElementById("clientModal");

  if (
    clientModal &&
    !clientModal.classList.contains("hidden")
  ) {
    clientModal.classList.add("hidden");
    return;
  }

  const eventAddressModal =
    document.getElementById("eventAddressModal");

  if (
    eventAddressModal &&
    !eventAddressModal.classList.contains("hidden")
  ) {
    eventAddressModal.classList.add("hidden");
    return;
  }

});

function countDraftProjects() {

  return countMooseDeletableProjects(state.projects);

}

function countLockedNeuesProjektDrafts() {

  return countLockedDraftProjects(state.projects);

}

function updateMooseModeStatus() {

  const status = document.getElementById("mooseModeStatus");

  if (!status) return;

  const deletableCount = countDraftProjects();
  const lockedCount = countLockedNeuesProjektDrafts();
  const unlockName = MOOSE_DELETE_UNLOCK_TITLE;

  const parts = [];

  if (deletableCount) {

    parts.push(
      deletableCount === 1
        ? "1 löschbarer leerer Auftrag"
        : deletableCount + " löschbare leere Aufträge"
    );

  }

  if (lockedCount) {

    parts.push(
      lockedCount === 1
        ? "1 gesperrter Entwurf (Daten geändert, Name noch „Neues Projekt“)"
        : lockedCount +
          " gesperrte Entwürfe (Daten geändert, Name noch „Neues Projekt“)"
    );

    parts.push(
      "Storno/Fehler: Auftrag in „" + unlockName + "“ umbenennen, dann löschen"
    );

  }

  status.textContent = parts.length
    ? parts.join(" · ")
    : "Keine löschbaren Aufträge";

  const cleanupBtn =
    document.getElementById("serviceCleanupDraftsBtn");

  if (cleanupBtn) {
    cleanupBtn.disabled = deletableCount === 0;
  }

}

function mooseCleanupDraftProjects() {

  const deletable = getMooseDeletableProjects(state.projects);

  if (!deletable.length) {

    const lockedCount = countLockedNeuesProjektDrafts();

    if (lockedCount) {

      // TODO NFOP 3.2 — nativer alert(); eigenes Modal
      alert(
        "Keine leeren Aufträge. " +
        lockedCount +
        " gesperrte Entwürfe — zum Löschen in „" +
        MOOSE_DELETE_UNLOCK_TITLE +
        "“ umbenennen."
      );

    } else {

      // TODO NFOP 3.2 — nativer alert(); eigenes Modal
      alert("Keine löschbaren Aufträge.");

    }

    return;

  }

  const emptyCount = deletable.filter(isProjectMinimalDraft).length;
  const unlockCount = deletable.filter(
    project => project.title === MOOSE_DELETE_UNLOCK_TITLE
  ).length;

  let confirmText =
    deletable.length === 1
      ? "1 Auftrag wirklich löschen?"
      : deletable.length + " Aufträge wirklich löschen?";

  const details = [];

  if (emptyCount) {
    details.push(emptyCount + " leer („Neues Projekt“)");
  }

  if (unlockCount) {
    details.push(unlockCount + " als „" + MOOSE_DELETE_UNLOCK_TITLE + "“");
  }

  if (details.length) {
    confirmText += "\n\n" + details.join(", ");
  }

  // TODO NFOP 3.2 — nativer confirm(); eigenes Modal
  if (!confirm(confirmText)) {
    return;
  }

  cleanupProjects();

  saveProjects();

  renderProjects();

  updateMooseModeStatus();

}

function openServiceModal() {

  updateMooseModeStatus();

  document
    .getElementById("serviceModal")
    .classList.remove("hidden");

}

function closeServiceModal() {

  document
    .getElementById("serviceModal")
    .classList.add("hidden");

}

    function setupServiceMode() {

    const trigger =
        document.getElementById("serviceTrigger");

    if (!trigger) return;

    trigger.addEventListener("click", () => {

        mooseClicks++;

        clearTimeout(mooseTimer);

        mooseTimer = setTimeout(() => {

            mooseClicks = 0;

        }, 1500);

        if (mooseClicks === 5) {

            mooseClicks = 0;

            openServiceModal();

        }

    });

    const closeBtn =
      document.getElementById("serviceCloseBtn");

    if (closeBtn) {
      closeBtn.addEventListener("click", closeServiceModal);
    }

    const cleanupBtn =
      document.getElementById("serviceCleanupDraftsBtn");

    if (cleanupBtn) {
      cleanupBtn.addEventListener(
        "click",
        mooseCleanupDraftProjects
      );
    }

}



init();
