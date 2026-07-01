"use strict";



/*

=========================================

NOIRFRAME — Operator Termin-Kalender

Jedyny wybór daty (bez natywnego pickera)

=========================================

*/



const operatorTerminCalState = {

  viewYear: new Date().getFullYear(),

  viewMonth: new Date().getMonth(),

  projectId: null,

  selectedDay: ""

};



const OPERATOR_TERMIN_MONTH_NAMES = [

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



function operatorTerminCalEscapeHtml(text) {

  return String(text)

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;");

}



function operatorTerminCalGetProjects() {

  if (typeof window.NF_getProjects === "function") {

    return window.NF_getProjects() || [];

  }



  return [];

}



function operatorTerminCalBuildMonthCells(year, month) {

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



function operatorTerminCalGetSelectedDay() {

  return operatorTerminCalState.selectedDay || "";

}



function operatorTerminCalSetSelectedDay(day) {

  operatorTerminCalState.selectedDay = day || "";

}



function operatorTerminCalSyncViewToSelectedDay(day) {

  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {

    return;

  }



  const parts = day.split("-");



  operatorTerminCalState.viewYear = Number(parts[0]);

  operatorTerminCalState.viewMonth = Number(parts[1]) - 1;

}



function operatorTerminCalUpdateSelectedLabel() {

  const label = document.getElementById("dateSelectedLabel");



  if (!label) {

    return;

  }



  const day = operatorTerminCalGetSelectedDay();



  if (!day) {

    label.textContent = "Bitte Tag im Kalender wählen.";

    label.className = "dateSelectedLabel dateSelectedLabel--empty";

    return;

  }



  const parts = day.split("-");

  const display = parts[2] + "." + parts[1] + "." + parts[0];



  label.textContent = "Gewählt: " + display;

  label.className = "dateSelectedLabel dateSelectedLabel--set";

}



function operatorTerminCalRenderGrid() {

  const grid = document.getElementById("operatorTerminCalGrid");

  const label = document.getElementById("operatorTerminCalMonthLabel");

  const cpe = window.NF_cpe;

  const projects = operatorTerminCalGetProjects();

  const year = operatorTerminCalState.viewYear;

  const month = operatorTerminCalState.viewMonth;

  const selectedDay = operatorTerminCalGetSelectedDay();

  const today = new Date();

  const todayString =

    `${today.getFullYear()}-` +

    `${String(today.getMonth() + 1).padStart(2, "0")}-` +

    `${String(today.getDate()).padStart(2, "0")}`;



  if (label) {

    label.textContent = `${OPERATOR_TERMIN_MONTH_NAMES[month]} ${year}`;

  }



  if (!grid) {

    return;

  }



  grid.innerHTML = operatorTerminCalBuildMonthCells(year, month)

    .map(day => {

      if (!day) {

        return `<span class="supervisorCalDay supervisorCalDay--empty"></span>`;

      }



      const dayNumber = day.slice(8, 10);

      const status =

        cpe?.getOperatorDayCalendarStatus?.(

          day,

          projects,

          operatorTerminCalState.projectId

        ) || { day, kind: "free" };



      const classes = ["supervisorCalDay"];



      if (day === todayString) {

        classes.push("supervisorCalDay--today");

      }



      if (day === selectedDay) {

        classes.push("supervisorCalDay--selected");

      }



      if (day < todayString) {

        classes.push("supervisorCalDay--past");

      }



      if (status.kind === "auftrag") {

        classes.push("supervisorCalDay--auftrag");

      } else if (status.kind === "blocked") {

        classes.push("supervisorCalDay--blocked");

      } else if (status.kind === "own") {

        classes.push("supervisorCalDay--own");

      } else {

        classes.push("supervisorCalDay--free");

      }



      let hint = "Verfügbar";



      if (status.kind === "auftrag") {

        hint = status.title || "Auftrag";

      } else if (status.kind === "blocked") {

        hint = status.reason || "Gesperrt";

      } else if (status.kind === "own") {

        hint = "Eigener Termin";

      }



      return (

        `<button type="button" class="${classes.join(" ")}" ` +

        `data-day="${day}" title="${operatorTerminCalEscapeHtml(hint)}">` +

        `<span class="supervisorCalDayNum">${dayNumber}</span>` +

        `</button>`

      );

    })

    .join("");



  operatorTerminCalUpdateSelectedLabel();

}



function operatorTerminCalHandleDayClick(day) {

  const today = new Date();

  const todayString =

    `${today.getFullYear()}-` +

    `${String(today.getMonth() + 1).padStart(2, "0")}-` +

    `${String(today.getDate()).padStart(2, "0")}`;



  if (day < todayString) {

    window.NF_showDateModalError?.(

      "Vergangene Tage können nicht gebucht werden."

    );

    window.NF_onInquiryDayBlocked?.(day, { kind: "past" });

    return;

  }



  const cpe = window.NF_cpe;

  const status =

    cpe?.getOperatorDayCalendarStatus?.(

      day,

      operatorTerminCalGetProjects(),

      operatorTerminCalState.projectId

    ) || { day, kind: "free" };



  if (status.kind === "auftrag") {

    window.NF_showDateModalError?.(

      `Tag ${day} ausgebucht — ${status.title || "Auftrag"}. ` +

        "Leider nicht verfügbar."

    );

    window.NF_onInquiryDayBlocked?.(day, status);

    return;

  }



  if (status.kind === "blocked") {

    window.NF_showDateModalError?.(

      `Tag ${day} gesperrt — ${status.reason || "Privat"}. ` +

        "Keine Reservierung möglich."

    );

    window.NF_onInquiryDayBlocked?.(day, status);

    return;

  }



  window.NF_clearDateModalError?.();



  operatorTerminCalSetSelectedDay(day);

  operatorTerminCalRenderGrid();



  window.NF_onInquiryDaySelected?.(day);

}



function operatorTerminCalShiftMonth(delta) {

  let month = operatorTerminCalState.viewMonth + delta;

  let year = operatorTerminCalState.viewYear;



  while (month < 0) {

    month += 12;

    year -= 1;

  }



  while (month > 11) {

    month -= 12;

    year += 1;

  }



  operatorTerminCalState.viewMonth = month;

  operatorTerminCalState.viewYear = year;

  operatorTerminCalRenderGrid();

}



function renderOperatorTerminCalendar(projectId) {

  operatorTerminCalState.projectId = projectId || null;



  const selectedDay = operatorTerminCalGetSelectedDay();



  if (selectedDay) {

    operatorTerminCalSyncViewToSelectedDay(selectedDay);

  } else {

    const now = new Date();



    operatorTerminCalState.viewYear = now.getFullYear();

    operatorTerminCalState.viewMonth = now.getMonth();

  }



  operatorTerminCalRenderGrid();

}



function resetOperatorTerminCalendar() {

  operatorTerminCalState.projectId = null;

  operatorTerminCalState.selectedDay = "";

}



function setupOperatorTerminCalendar() {

  document

    .getElementById("operatorTerminCalPrev")

    ?.addEventListener("click", () => operatorTerminCalShiftMonth(-1));



  document

    .getElementById("operatorTerminCalNext")

    ?.addEventListener("click", () => operatorTerminCalShiftMonth(1));



  document

    .getElementById("operatorTerminCalGrid")

    ?.addEventListener("click", event => {

      const button = event.target?.closest?.("[data-day]");



      if (!button?.dataset?.day) {

        return;

      }



      operatorTerminCalHandleDayClick(button.dataset.day);

    });

}



window.NF_operatorTerminCal = Object.freeze({

  setup: setupOperatorTerminCalendar,

  render: renderOperatorTerminCalendar,

  reset: resetOperatorTerminCalendar,

  getSelectedDay: operatorTerminCalGetSelectedDay,

  setSelectedDay: operatorTerminCalSetSelectedDay

});


