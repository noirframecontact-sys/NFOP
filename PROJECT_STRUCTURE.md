# NOIR FRAME Operator — Project Structure

**Audit date:** 2026-07-05  
**Phase:** 0 — Repository Consolidation (read-only audit)

---

## Canonical target (from today)

| Field | Value |
|-------|-------|
| **Product** | NOIR FRAME Operator |
| **Version (target)** | 4.0.0-alpha.001 |
| **Phase (target)** | ONLINE FOUNDATION |
| **Official GitHub repository** | [noirframecontact-sys/NFOP](https://github.com/noirframecontact-sys/NFOP) |

---

## Repository map

| Repository | GitHub URL | Role | Default branch | Last push (GitHub) |
|------------|------------|------|----------------|--------------------|
| **NFOP** | https://github.com/noirframecontact-sys/NFOP | Official NFOP production source | `main` | 2026-07-02 |
| **NFOP3.0** | https://github.com/noirframecontact-sys/NFOP3.0 | Legacy archive | — | Older snapshot |
| **noirframe.art** | https://github.com/noirframecontact-sys/noirframe.art | Public website (separate product) | `main` | Active |

---

## Local working copies

| Folder | Path | Git | Version in `config.js` | Last modified | Status |
|--------|------|-----|------------------------|---------------|--------|
| **NOIRFRAME FINAL OS iPAD 4.0** | `C:\Users\marcin\Desktop\nrop baza\NOIRFRAME FINAL OS iPAD 4.0` | **Not a git repo** | `4.0.0-alpha.001` / ONLINE FOUNDATION | 2026-07-05 (Phase 1 draft files) | **Newest local copy** — superset of GitHub NFOP + draft Supabase layer |
| NOIRFRAME OS iPAD9 3.0 | `C:\Users\marcin\Desktop\nrop baza\NOIRFRAME OS iPAD9 3.0` | Not a git repo | `iPAD9-3.0` | 2026-07-02 | Matches GitHub NFOP `main` baseline (NFOP 3.1) |
| NOIRFRAME OS iPAD9 | `C:\Users\marcin\Desktop\nrop baza\NOIRFRAME OS iPAD9` | Not a git repo | Legacy | 2026-07-01 | Older prototype; not canonical |
| noirframe.art (clone) | `C:\Users\marcin\Documents\GitHub\noirframe.art` | Git — tracked in GitHub Desktop | N/A (website) | Active | Website only |

**No local clone of `NFOP` exists** at `C:\Users\marcin\Documents\GitHub\NFOP`.

---

## GitHub Desktop

| Tracked? | Repository | Local path |
|----------|------------|------------|
| **Yes** | `noirframecontact-sys/noirframe.art` | `C:\Users\marcin\Documents\GitHub\noirframe.art` |
| **No** | `noirframecontact-sys/NFOP` | — (not cloned) |
| **No** | `noirframecontact-sys/NFOP3.0` | — |

Account: `noirframecontact-sys` (confirmed in Desktop logs, 2026-07-05).

---

## Netlify

| Site | URL | Serves | Linked to GitHub? | Deployment status |
|------|-----|--------|-------------------|-------------------|
| **super-gnome-3649d5** | https://super-gnome-3649d5.netlify.app/ | NFOP Operator (iPad PWA) | **Unknown / likely stale** — live site missing `backup.js`, `travel.js`, modern `config.js` | **Stale** — pre–NFOP 3.1 snapshot; does not match GitHub `NFOP` `main` |
| **noirframe.art** | https://noirframe.art/ | Public website | Yes — `noirframe.art` repo | **Current** — separate product |

**Fingerprint (Netlify NFOP):** minimal `config.js` (no `app.build`, no `backup` block, no maps origin); `backup.js` and `travel.js` return 404.

---

## Supabase

| Field | Status |
|-------|--------|
| **Project** | Not connected in production |
| **Local draft** | `supabase/schema.sql`, `supabase-sync.js`, `config.local.example.js` present in FINAL 4.0 folder |
| **Sync state** | **Paused** — schema review in progress (`supabase/SCHEMA-REVIEW.md`) |
| **Secrets** | `config.local.js` exists locally — must remain gitignored |

Supabase integration is **Phase 1** work; not part of Phase 0 consolidation execution.

---

## Version matrix (current confusion)

| Location | Product label | Version / build | Phase |
|----------|---------------|-----------------|-------|
| Folder name | — | `4.0` (folder) | — |
| Local FINAL 4.0 `config.js` | NOIR FRAME Operator (implicit) | `4.0.0-alpha.001` | ONLINE FOUNDATION |
| GitHub NFOP `config.js` | — | `iPAD9-3.0` | — |
| Netlify live | NOIRFRAME PAD | None declared | — |
| `manifest.json` (local 4.0) | NOIRFRAME PAD | description references 4.0.0-alpha.001 | ONLINE FOUNDATION |

**Target (proposed, not applied):** NOIR FRAME Operator · `4.0.0-alpha.001` · ONLINE FOUNDATION — single source in `config.js` + aligned `manifest.json`.

---

## Deployment status summary

```
[Operators]  →  Netlify super-gnome  →  STALE (pre-3.1)
[GitHub]     →  NFOP main            →  NFOP 3.1 (iPAD9-3.0)
[Local dev]  →  FINAL OS iPAD 4.0    →  4.0.0-alpha.001 + draft Supabase
[Website]    →  noirframe.art        →  OK (separate repo)
```

Three divergent NFOP copies exist today. Phase 0 goal: one repository (`NFOP`) as source of truth before cloud sync.

---

## Purpose

**NOIR FRAME Operator (NFOP)** is the internal iPad operating system for NOIR FRAME studio operations: projects, scheduling, offers, supervisor calendar, backup, and CPE capacity planning. It is **not** the public website (`noirframe.art`).
