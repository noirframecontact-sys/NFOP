# NOIR FRAME Operator — Roadmap

**Product:** NOIR FRAME Operator  
**Target version:** 4.0.0-alpha.001  
**Target phase:** ONLINE FOUNDATION  

---

## Phase 0 — Repository

**Status:** In progress (audit complete; consolidation not executed)

**Goal:** One repository = one source of truth (same workflow as `noirframe.art`).

**Scope:**
- Clone and connect `noirframecontact-sys/NFOP` in GitHub Desktop
- Align local working copy → GitHub `NFOP` `main`
- Reconnect Netlify NFOP site to GitHub `NFOP`
- Version cleanup: unified `4.0.0-alpha.001` / ONLINE FOUNDATION in `config.js`
- Archive `NFOP3.0`; keep `noirframe.art` separate

**Out of scope:** UI changes, feature work, Supabase, refactoring.

---

## Phase 1 — Supabase Connection

**Goal:** Connect NFOP to Supabase; establish online foundation.

**Scope:**
- Finalize schema (`projects` + business columns: phone, email, event_location, package, notes)
- Apply schema in Supabase dashboard
- Wire `config.local.js` / env for URL + anon key
- Enable `supabase-sync.js` (currently paused)
- Footer connection status reflects real connectivity

**Prerequisite:** Phase 0 complete; schema sign-off.

---

## Phase 2 — Projects

**Goal:** Projects persist and sync via Supabase.

**Scope:**
- Project CRUD through sync layer
- Local cache + offline queue flush
- Separate `tasks` table (future; not in Phase 1 schema)

---

## Phase 3 — Realtime

**Goal:** Multi-device / multi-operator awareness.

**Scope:**
- Supabase Realtime subscriptions on `projects`
- Conflict handling policy
- UI indicators for remote changes (minimal; no redesign)

---

## Phase 4 — Calendar

**Goal:** Calendar data online-ready.

**Scope:**
- Supervisor and operator calendar sync strategy
- Date locks and reservations in cloud model

---

## Phase 5 — Events

**Goal:** Event bus and cross-module notifications.

**Scope:**
- `events.js` integration with sync and UI modules
- Domain events for project lifecycle

---

## Phase 6 — Authentication

**Goal:** Secure operator access.

**Scope:**
- Supabase Auth (operators / roles)
- RLS policies aligned with auth
- Supervisor PIN evolution or replacement

---

## Phase 7 — Production

**Goal:** Production-grade NFOP Online deployment.

**Scope:**
- Netlify production deploy from `NFOP` `main`
- Monitoring, backup strategy, operator onboarding
- Deprecate stale Netlify snapshots and orphan local folders

---

## Dependency chain

```
Phase 0  Repository
    ↓
Phase 1  Supabase Connection
    ↓
Phase 2  Projects
    ↓
Phase 3  Realtime
    ↓
Phase 4  Calendar
    ↓
Phase 5  Events
    ↓
Phase 6  Authentication
    ↓
Phase 7  Production
```

**Rule:** Do not skip phases. Architecture stability before features.
