"use strict";

/*
=========================================
NOIRFRAME — Supervisor Kalender
Shared blocks via Supabase (nfBlockedDays cache)
=========================================
*/

const supervisorCalState = {
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  selectedDay: "",
  unlocked: false
};

const SUPERVISOR_MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember"
];

function supervisorCalGetPin() {
  return String(window.NF_CONFIG?.supervisor?.pin || "226720");
}

function verifySupervisorAccess() {
  // TODO NFOP 3.2 — nativer prompt(); eigenes Modal
  const entered = window.prompt("Supervisor — Passwort:");

  if (entered === null) {
    return false;
  }

  if (entered.trim() !== supervisorCalGetPin()) {
    // TODO NFOP 3.2 — nativer alert(); eigenes Modal
    window.alert("Falsches Passwort.");
    return false;
  }

  supervisorCalState.unlocked = true;

  return true;
}

function ensureSupervisorAccess() {
  if (supervisorCalState.unlocked) {
    return true;
  }

  return verifySupervisorAccess();
}

function supervisorCalEscapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function supervisorCalGetProjects() {
  if (typeof window.NF_getProjects === "function") {
    return window.NF_getProjects() || [];
  }

  return [];
}

function supervisorCalGetCpe() {
  return window.NF_cpe || null;
}

function supervisorCalTodayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function supervisorCalBuildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  let startOffset = first.getDay();

  startOffset = startOffset === 0 ? 6 : startOffset - 1;

  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const monthText = String(month + 1).padStart(2, "0");
    const dayText = String(day).padStart(2, "0");

    cells.push(`${year}-${monthText}-${dayText}`);
  }

  return cells;
}

function supervisorCalShowDetailError(message) {
  const error = document.getElementById("supervisorCalDetailError");

  if (!error) {
    return;
  }

  if (!message) {
    error.textContent = "";
    error.classList.add("hidden");
    return;
  }

  error.textContent = message;
  error.classList.remove("hidden");
}

function supervisorCalRenderDetail(day) {
  const detail = document.getElementById("supervisorCalDetail");
  const status = document.getElementById("supervisorCalDayStatus");
  const reasonInput = document.getElementById("supervisorCalReason");
  const blockBtn = document.getElementById("supervisorCalBlockBtn");
  const unblockBtn = document.getElementById("supervisorCalUnblockBtn");
  const cpe = supervisorCalGetCpe();

  if (!detail || !status || !day) {
    detail?.classList.add("hidden");
    return;
  }

  supervisorCalShowDetailError("");

  const dayStatus =
    cpe?.getDayCalendarStatus?.(day, supervisorCalGetProjects()) || {
      day,
      kind: "free"
    };

  detail.classList.remove("hidden");

  status.className = "supervisorCalDayStatus";

  if (dayStatus.kind === "auftrag") {
    status.classList.add("supervisorCalDayStatus--auftrag");
    status.innerHTML =
      `<strong>${supervisorCalEscapeHtml(day)}</strong><br>` +
      `Auftrag: ${supervisorCalEscapeHtml(dayStatus.title)}<br>` +
      `<span class="supervisorCalPriority">Zlecung hat Priorität — Tag ausgebucht.</span>`;

    if (reasonInput) {
      reasonInput.value = "";
      reasonInput.disabled = true;
    }

    if (blockBtn) {
      blockBtn.disabled = true;
    }

    if (unblockBtn) {
      unblockBtn.disabled = true;
    }

    return;
  }

  if (reasonInput) {
    reasonInput.disabled = false;
  }

  if (blockBtn) {
    blockBtn.disabled = false;
  }

  if (unblockBtn) {
    unblockBtn.disabled = false;
  }

  if (dayStatus.kind === "blocked") {
    status.classList.add("supervisorCalDayStatus--blocked");
    status.innerHTML =
      `<strong>${supervisorCalEscapeHtml(day)}</strong><br>` +
      `Gesperrt — ${supervisorCalEscapeHtml(dayStatus.reason)}<br>` +
      `Operator: keine Reservierung möglich.`;

    if (reasonInput) {
      reasonInput.value = dayStatus.reason || "";
    }

    return;
  }

  status.classList.add("supervisorCalDayStatus--free");
  status.innerHTML =
    `<strong>${supervisorCalEscapeHtml(day)}</strong><br>` +
    `Verfügbar — Tag kann privat gesperrt werden.`;

  if (reasonInput) {
    reasonInput.value = "";
  }
}

function supervisorCalRenderGrid() {
  const grid = document.getElementById("supervisorCalGrid");
  const label = document.getElementById("supervisorCalMonthLabel");
  const cpe = supervisorCalGetCpe();
  const projects = supervisorCalGetProjects();
  const year = supervisorCalState.viewYear;
  const month = supervisorCalState.viewMonth;
  const today = supervisorCalTodayString();

  if (label) {
    label.textContent = `${SUPERVISOR_MONTH_NAMES[month]} ${year}`;
  }

  if (!grid) {
    return;
  }

  const cells = supervisorCalBuildMonthCells(year, month);

  grid.innerHTML = cells
    .map(day => {
      if (!day) {
        return `<span class="supervisorCalDay supervisorCalDay--empty"></span>`;
      }

      const dayNumber = day.slice(8, 10);
      const status =
        cpe?.getDayCalendarStatus?.(day, projects) || {
          day,
          kind: "free"
        };

      const classes = ["supervisorCalDay"];

      if (day === today) {
        classes.push("supervisorCalDay--today");
      }

      if (day === supervisorCalState.selectedDay) {
        classes.push("supervisorCalDay--selected");
      }

      if (status.kind === "auftrag") {
        classes.push("supervisorCalDay--auftrag");
      } else if (status.kind === "blocked") {
        classes.push("supervisorCalDay--blocked");
      } else {
        classes.push("supervisorCalDay--free");
      }

      let hint = "Verfügbar";

      if (status.kind === "auftrag") {
        hint = status.title || "Auftrag";
      } else if (status.kind === "blocked") {
        hint = status.reason || "Gesperrt";
      }

      return (
        `<button type="button" class="${classes.join(" ")}" ` +
        `data-day="${day}" title="${supervisorCalEscapeHtml(hint)}">` +
        `<span class="supervisorCalDayNum">${dayNumber}</span>` +
        `</button>`
      );
    })
    .join("");
}

function supervisorCalRender() {
  supervisorCalRenderGrid();
  supervisorCalRenderDetail(supervisorCalState.selectedDay);
}

function supervisorCalSelectDay(day) {
  supervisorCalState.selectedDay = day || "";
  supervisorCalRender();
}

function supervisorCalShiftMonth(delta) {
  let month = supervisorCalState.viewMonth + delta;
  let year = supervisorCalState.viewYear;

  while (month < 0) {
    month += 12;
    year -= 1;
  }

  while (month > 11) {
    month -= 12;
    year += 1;
  }

  supervisorCalState.viewMonth = month;
  supervisorCalState.viewYear = year;
  supervisorCalState.selectedDay = "";
  supervisorCalRender();
}

function closeSupervisorCalendar() {
  document
    .getElementById("supervisorCalendarModal")
    ?.classList.add("hidden");

  supervisorCalState.selectedDay = "";
  supervisorCalShowDetailError("");
}

function openSupervisorCalendar() {
  if (!ensureSupervisorAccess()) {
    return;
  }

  const modal = document.getElementById("supervisorCalendarModal");

  if (!modal) {
    return;
  }

  const now = new Date();

  supervisorCalState.viewYear = now.getFullYear();
  supervisorCalState.viewMonth = now.getMonth();
  supervisorCalState.selectedDay = supervisorCalTodayString();

  supervisorCalRender();
  modal.classList.remove("hidden");
}

async function supervisorCalBlockSelectedDay() {
  const day = supervisorCalState.selectedDay;
  const reasonInput = document.getElementById("supervisorCalReason");
  const cpe = supervisorCalGetCpe();

  if (!day || !cpe?.setBlockedDay) {
    return;
  }

  const status = cpe.getDayCalendarStatus?.(
    day,
    supervisorCalGetProjects()
  );

  if (status?.kind === "auftrag") {
    supervisorCalShowDetailError(
      "Auftrag hat Priorität — Tag ist bereits ausgebucht."
    );
    return;
  }

  const result = await cpe.setBlockedDay(
    day,
    reasonInput?.value || "Privat"
  );

  if (!result?.ok) {
    supervisorCalShowDetailError(result?.message || "Sperre fehlgeschlagen.");
    return;
  }

  supervisorCalShowDetailError("");
  supervisorCalRender();
}

async function supervisorCalUnblockSelectedDay() {
  const day = supervisorCalState.selectedDay;
  const cpe = supervisorCalGetCpe();

  if (!day || !cpe?.removeBlockedDay) {
    return;
  }

  const result = await cpe.removeBlockedDay(day);

  if (!result?.ok) {
    supervisorCalShowDetailError(
      result?.message || "Freigabe fehlgeschlagen."
    );
    return;
  }

  supervisorCalShowDetailError("");
  supervisorCalRender();
}

function setupSupervisorCalendar() {
  // Hero-Button: setupHeroBarActions() in app.js (delegacja na #hero)

  const refreshIfOpen = () => {
    const modal = document.getElementById("supervisorCalendarModal");

    if (modal && !modal.classList.contains("hidden")) {
      supervisorCalRender();
    }
  };

  window.NF_events?.on?.(
    window.NF_events?.TYPES?.CALENDAR_BLOCK_CHANGED,
    refreshIfOpen
  );

  window.NF_events?.on?.(
    window.NF_events?.TYPES?.CALENDAR_CHANGED,
    refreshIfOpen
  );

  document
    .getElementById("closeSupervisorCalBtn")
    ?.addEventListener("click", closeSupervisorCalendar);

  document
    .getElementById("supervisorCalPrev")
    ?.addEventListener("click", () => supervisorCalShiftMonth(-1));

  document
    .getElementById("supervisorCalNext")
    ?.addEventListener("click", () => supervisorCalShiftMonth(1));

  document
    .getElementById("supervisorCalGrid")
    ?.addEventListener("click", event => {
      const button = event.target?.closest?.("[data-day]");

      if (!button?.dataset?.day) {
        return;
      }

      supervisorCalSelectDay(button.dataset.day);
    });

  document
    .getElementById("supervisorCalBlockBtn")
    ?.addEventListener("click", supervisorCalBlockSelectedDay);

  document
    .getElementById("supervisorCalUnblockBtn")
    ?.addEventListener("click", supervisorCalUnblockSelectedDay);

  document
    .getElementById("supervisorCalendarModal")
    ?.addEventListener("click", event => {
      if (event.target?.id === "supervisorCalendarModal") {
        closeSupervisorCalendar();
      }
    });
}

window.NF_supervisorCal = Object.freeze({
  setup: setupSupervisorCalendar,
  open: openSupervisorCalendar,
  close: closeSupervisorCalendar
});
