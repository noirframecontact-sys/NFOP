"use strict";
window.NF_CATALOG_DATA = {
  "version": "2.0",
  "company": "NoirFrame",
  "currency": "EUR",
  "locale": "de-DE",

  "categories": [
    { "id": "photo", "name": "Fotografie" },
    { "id": "video", "name": "Video" },
    { "id": "event", "name": "Event" }
  ],

  "products": [
    {
      "id": "foto-unternehmer",
      "category": "photo",
      "name": "Fotografie Unternehmer",
      "price": 450,
      "duration": 120,
      "description": "Business-Fotografie für Unternehmen, Teams und Personal Branding.",
      "shortDescription": "Business-Fotografie — 450 €",
      "includes": [
        "Professionelle Business-Fotos",
        "Online-Galerie",
        "Bildauswahl",
        "Nutzungsrechte für Unternehmen"
      ],
      "addons": ["second-photographer", "drone", "highlights-4k", "reel", "express", "extra-hour", "special-effects"],
      "recommended": true,
      "active": true,
      "sort": 10,
      "tags": ["Business", "Unternehmer", "Fotografie"]
    },
    {
      "id": "foto-event",
      "category": "event",
      "name": "Fotografie Event",
      "price": 599,
      "duration": 180,
      "description": "Reportage-Fotografie für Events, Feiern und Veranstaltungen.",
      "shortDescription": "Event-Fotografie",
      "includes": [
        "Event-Reportage",
        "Online-Galerie",
        "Bildauswahl",
        "Private Nutzungsrechte"
      ],
      "addons": ["second-photographer", "drone", "highlights-4k", "reel", "express", "extra-hour", "special-effects"],
      "active": true,
      "sort": 20,
      "tags": ["Event", "Feier", "Reportage"]
    },
    {
      "id": "foto-hochzeit-basic",
      "category": "event",
      "name": "Hochzeit Basic",
      "price": 1299,
      "duration": 360,
      "description": "Kompakte Hochzeitsreportage — Trauung und Feier bis zu 6 Stunden.",
      "shortDescription": "Hochzeit Basic — 6 h Reportage",
      "includes": [
        "Begleitung bis 6 Stunden",
        "Trauung & Feier",
        "Online-Galerie",
        "Bildauswahl",
        "Private Nutzungsrechte"
      ],
      "addons": ["second-photographer", "drone", "highlights-4k", "reel", "extra-hour", "special-effects"],
      "active": true,
      "sort": 30,
      "tags": ["Hochzeit", "Wedding", "Basic", "Trauung"]
    },
    {
      "id": "foto-hochzeit-standard",
      "category": "event",
      "name": "Hochzeit Standard",
      "price": 1699,
      "duration": 480,
      "description": "Klassische Hochzeitsreportage — Getting Ready, Trauung, Feier bis zu 8 Stunden.",
      "shortDescription": "Hochzeit Standard — 8 h Reportage",
      "includes": [
        "Begleitung bis 8 Stunden",
        "Getting Ready, Trauung & Feier",
        "Online-Galerie",
        "Bildauswahl",
        "Private Nutzungsrechte"
      ],
      "addons": ["second-photographer", "drone", "highlights-4k", "reel", "extra-hour", "special-effects"],
      "recommended": true,
      "active": true,
      "sort": 31,
      "tags": ["Hochzeit", "Wedding", "Standard", "Trauung"]
    },
    {
      "id": "foto-hochzeit-signature",
      "category": "event",
      "name": "Hochzeit Signature",
      "price": 2199,
      "duration": 600,
      "description": "Premium Hochzeitsreportage — ganztägige Begleitung mit erweitertem Leistungsumfang.",
      "shortDescription": "Hochzeit Signature — 10 h Reportage",
      "includes": [
        "Ganztägige Begleitung bis 10 Stunden",
        "Getting Ready, First Look, Trauung & Feier",
        "Online-Galerie",
        "Bildauswahl & Retusche",
        "Private Nutzungsrechte",
        "Premium Album-Vorlage"
      ],
      "addons": ["second-photographer", "drone", "highlights-4k", "reel", "extra-hour", "special-effects"],
      "active": true,
      "sort": 32,
      "tags": ["Hochzeit", "Wedding", "Signature", "Premium", "Trauung"]
    },
    {
      "id": "foto-taufe",
      "category": "event",
      "name": "Taufe",
      "price": 399,
      "duration": 120,
      "description": "Fotografie der Tauffeier — Zeremonie und Familienfotos.",
      "shortDescription": "Tauffeier",
      "includes": [
        "Reportage der Feier",
        "Online-Galerie",
        "Bildauswahl",
        "Private Nutzungsrechte"
      ],
      "addons": ["second-photographer", "drone", "reel", "express", "extra-hour", "special-effects"],
      "active": true,
      "sort": 40,
      "tags": ["Taufe", "Familie", "Event"]
    },
    {
      "id": "foto-portrait",
      "category": "photo",
      "name": "Porträt",
      "price": 249,
      "duration": 90,
      "description": "Porträtshooting — Studio oder Outdoor.",
      "shortDescription": "Porträtshooting",
      "includes": [
        "Porträt-Fotos",
        "Online-Galerie",
        "Bildauswahl",
        "Private Nutzungsrechte"
      ],
      "addons": ["reel", "express", "extra-hour", "special-effects"],
      "active": true,
      "sort": 50,
      "tags": ["Porträt", "Portrait", "Einzelperson"]
    },
    {
      "id": "video-event",
      "category": "video",
      "name": "Video Event",
      "price": 799,
      "duration": 180,
      "description": "Event-Video — Highlights und Atmosphäre.",
      "shortDescription": "Event-Video",
      "includes": [
        "Event-Video",
        "Online-Bereitstellung",
        "Private Nutzungsrechte"
      ],
      "addons": ["second-photographer", "drone", "highlights-4k", "reel", "express", "extra-hour", "special-effects"],
      "active": true,
      "sort": 60,
      "tags": ["Video", "Event", "Highlights"]
    },
    {
      "id": "video-unternehmer",
      "category": "video",
      "name": "Video Unternehmer",
      "price": 450,
      "duration": 120,
      "description": "Business-Video für Unternehmen und Personal Branding.",
      "shortDescription": "Business-Video — 450 €",
      "includes": [
        "Business-Video",
        "Online-Bereitstellung",
        "Nutzungsrechte für Unternehmen"
      ],
      "addons": ["second-photographer", "drone", "highlights-4k", "reel", "express", "extra-hour", "special-effects"],
      "active": true,
      "sort": 70,
      "tags": ["Video", "Business", "Unternehmer"]
    }
  ],

  "addons": [
    {
      "id": "second-photographer",
      "name": "Zweiter Fotograf",
      "price": 149,
      "active": true
    },
    {
      "id": "drone",
      "name": "Drone",
      "price": 49,
      "active": true
    },
    {
      "id": "highlights-4k",
      "name": "Highlights Video 4K",
      "price": 49,
      "active": true
    },
    {
      "id": "reel",
      "name": "Social Media Reel",
      "price": 49,
      "active": true
    },
    {
      "id": "express",
      "name": "Express Delivery",
      "price": 99,
      "active": true
    },
    {
      "id": "extra-hour",
      "name": "Zusätzliche Stunde",
      "price": 79,
      "active": true
    },
    {
      "id": "special-effects",
      "name": "Spezialeffekte",
      "price": 79,
      "active": true
    },
    {
      "id": "travel-included",
      "name": "Anfahrt innerhalb 30 km",
      "price": "inklusive",
      "active": false
    }
  ]
};
