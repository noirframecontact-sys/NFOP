"use strict";

/*
  NFOP storage — Last Known Workspace (localStorage key: nfProjects).

  Restored on startup for immediate render. Not the source of truth while
  remote changes are pending in Volvo Trunk. After operator Synchronize +
  Apply, this snapshot is updated from the applied workspace state.
*/

const MOOSE_DELETE_UNLOCK_TITLE = "AWISTA";

const NF_FACTORY_PROJECT = {
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
  status: "NEW"
};

function isEmptyProjectValue(value) {

  if (value === undefined || value === null) {
    return true;
  }

  const text = String(value).trim();

  return text === "" || text === "-";

}

function isProjectMinimalDraft(project) {

  if (!project || project.title !== NF_FACTORY_PROJECT.title) {
    return false;
  }

  if (project.client !== NF_FACTORY_PROJECT.client) {
    return false;
  }

  const scalarFields = [
    "phone",
    "email",
    "clientAddress",
    "location",
    "eventAddress",
    "eventPostalCode",
    "eventCity",
    "eventStreet",
    "eventHouseNumber",
    "date",
    "notes",
    "guests",
    "price",
    "eventType"
  ];

  for (let index = 0; index < scalarFields.length; index++) {

    const field = scalarFields[index];

    if (!isEmptyProjectValue(project[field])) {
      return false;
    }

  }

  if (project.status && project.status !== NF_FACTORY_PROJECT.status) {
    return false;
  }

  if (Array.isArray(project.offerHistory) && project.offerHistory.length) {
    return false;
  }

  if (project.lastOfferSentAt || project.lastOfferVersion) {
    return false;
  }

  if (project.notesUpdatedAt) {
    return false;
  }

  if (project.collapsed === true) {
    return false;
  }

  if (!Array.isArray(project.tasks)) {
    return false;
  }

  if (project.tasks.some(task => task.done)) {
    return false;
  }

  return true;

}

function canMooseDeleteProject(project) {

  if (!project) {
    return false;
  }

  if (project.title === MOOSE_DELETE_UNLOCK_TITLE) {
    return true;
  }

  return isProjectMinimalDraft(project);

}

function countMooseDeletableProjects(projects) {

  const list = Array.isArray(projects) ? projects : state.projects;

  return list.filter(canMooseDeleteProject).length;

}

function countLockedDraftProjects(projects) {

  const list = Array.isArray(projects) ? projects : state.projects;

  return list.filter(project => {

    if (project.title === MOOSE_DELETE_UNLOCK_TITLE) {
      return false;
    }

    if (project.title !== NF_FACTORY_PROJECT.title) {
      return false;
    }

    return !isProjectMinimalDraft(project);

  }).length;

}

function getMooseDeletableProjects(projects) {

  const list = Array.isArray(projects) ? projects : state.projects;

  return list.filter(canMooseDeleteProject);

}



function migrateProjectRevision(project) {

  if (!project) {
    return;
  }

  if (!project.createdAt) {
    project.createdAt =
      project.updatedAt ||
      project.notesUpdatedAt ||
      project.lastOfferSentAt ||
      new Date().toISOString();
  }

  if (!project.updatedAt) {
    project.updatedAt =
      project.notesUpdatedAt ||
      project.lastOfferSentAt ||
      project.createdAt;
  }

}

function migrateProjectTasks(project) {

  const defaultLabels = [
    "Termin",
    "Kundendaten",
    "Bestätigung",
    "Anzahlung",
    "Vertrag",
    "Shooting",
    "Bearbeitung",
    "Photonesto",
    "Google Drive",
    "Freigabe",
    "Rechnung"
  ];

  if (!project) {
    return;
  }

  if (!Array.isArray(project.tasks)) {
    project.tasks = defaultLabels.map(label => ({
      label,
      done: false
    }));
    return;
  }

  project.tasks = project.tasks
    .filter(task => task && typeof task.label === "string")
    .map(task => ({
      label: task.label,
      done: Boolean(task.done)
    }));

  if (!project.tasks.length) {
    project.tasks = defaultLabels.map(label => ({
      label,
      done: false
    }));
  }

}

function migrateAllProjects(projects) {

  if (!Array.isArray(projects)) {
    return;
  }

  projects.forEach(migrateProjectAddress);
  projects.forEach(migrateProjectOffer);
  projects.forEach(migrateProjectNotes);
  projects.forEach(migrateProjectTasks);
  projects.forEach(migrateProjectRevision);

}

function bumpProjectRevision(project) {

  if (!project) {
    return;
  }

  project.updatedAt = new Date().toISOString();

}

function saveProjects(...args) {

  let revisionProjectIds = args;
  let persistOptions = null;
  const lastArg = args[args.length - 1];

  if (
    lastArg &&
    typeof lastArg === "object" &&
    !Array.isArray(lastArg) &&
    Object.prototype.hasOwnProperty.call(lastArg, "calendarLane")
  ) {
    persistOptions = lastArg;
    revisionProjectIds = args.slice(0, -1);
  }

  revisionProjectIds.forEach(projectId => {
    if (!projectId) {
      return;
    }

    bumpProjectRevision(
      state.projects.find(project => project.id === projectId)
    );
  });

  localStorage.setItem(

    "nfProjects",

    JSON.stringify(state.projects)

  );

  /* Last Known Workspace — updated on every local save and after Synchronize */

  if (typeof window.NF_backup?.onLocalDataSaved === "function") {
    window.NF_backup.onLocalDataSaved();
  }

  if (typeof window.NF_sync?.schedulePersist === "function") {
    window.NF_sync.schedulePersist(revisionProjectIds, persistOptions || undefined);
  }

}

function loadProjects() {

  /* Restore Last Known Workspace — first paint before Supabase bootstrap */

  const saved = localStorage.getItem(

    "nfProjects"

  );

  if (!saved) return;

  state.projects = JSON.parse(saved);

  state.projects.forEach(migrateProjectAddress);

  state.projects.forEach(migrateProjectOffer);

  state.projects.forEach(migrateProjectNotes);

  state.projects.forEach(migrateProjectTasks);

  state.projects.forEach(migrateProjectRevision);

}

function migrateProjectNotes(project) {

  const notes = project.notes;

  if (!notes || typeof notes !== "string") {
    return;
  }

  const startTag = "[NF-ANGEBOT]";
  const endTag = "[/NF-ANGEBOT]";

  if (!notes.includes(startTag)) {
    return;
  }

  let remaining = notes;
  let repaired = "";
  let changed = false;

  while (remaining.length) {

    const start = remaining.indexOf(startTag);

    if (start === -1) {
      repaired += remaining;
      break;
    }

    repaired += remaining.slice(0, start);

    const contentStart = start + startTag.length;
    const end = remaining.indexOf(endTag, contentStart);

    if (end === -1) {

      const content = remaining.slice(contentStart).trim();

      if (content) {
        repaired +=
          startTag + "\n" + content + "\n" + endTag;
        changed = true;
      }

      break;

    }

    repaired += remaining.slice(start, end + endTag.length);
    remaining = remaining.slice(end + endTag.length);

  }

  if (changed) {
    project.notes = repaired.trim();
  }

}

function migrateProjectOffer(project) {

  if (!project.status) {
    project.status = "NEW";
  }

  if (!Array.isArray(project.offerHistory)) {
    project.offerHistory = [];
  }

}

function migrateProjectAddress(project) {

  if (project.address && !project.eventAddress) {

    project.eventAddress = project.address;

  }

  if (project.eventPostalCode === undefined) {
    project.eventPostalCode = "";
  }

  if (project.eventCity === undefined) {
    project.eventCity = "";
  }

  if (project.eventStreet === undefined) {
    project.eventStreet = "";
  }

  if (project.eventHouseNumber === undefined) {
    project.eventHouseNumber = "";
  }

}

function cleanupProjects() {

  state.projects = state.projects.filter(
    project => !canMooseDeleteProject(project)
  );

}