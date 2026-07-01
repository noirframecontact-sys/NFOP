"use strict";

/*
=========================================
NOIRFRAME — modal scroll lock (iPad)
Blokuje przewijanie tła pod aktywnym oknem.
=========================================
*/

function nfGetScrollY() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function nfUpdateModalScrollLock() {
  const modals = document.querySelectorAll(".modal");
  const anyOpen = [...modals].some(
    modal => !modal.classList.contains("hidden")
  );

  if (anyOpen) {
    if (!document.body.classList.contains("nf-modal-open")) {
      const scrollY = nfGetScrollY();

      document.body.dataset.nfScrollY = String(scrollY);
      document.body.classList.add("nf-modal-open");
      document.documentElement.classList.add("nf-modal-open");
      document.body.style.top = `-${scrollY}px`;
    }

    return;
  }

  if (!document.body.classList.contains("nf-modal-open")) {
    return;
  }

  const scrollY = Number(document.body.dataset.nfScrollY || 0);

  document.body.classList.remove("nf-modal-open");
  document.documentElement.classList.remove("nf-modal-open");
  document.body.style.top = "";
  delete document.body.dataset.nfScrollY;
  window.scrollTo(0, scrollY);
}

function setupModalScrollLock() {
  const modals = document.querySelectorAll(".modal");

  modals.forEach(modal => {
    new MutationObserver(nfUpdateModalScrollLock).observe(modal, {
      attributes: true,
      attributeFilter: ["class"]
    });
  });

  nfUpdateModalScrollLock();
}

window.NF_modalUi = Object.freeze({
  setup: setupModalScrollLock,
  refresh: nfUpdateModalScrollLock
});
