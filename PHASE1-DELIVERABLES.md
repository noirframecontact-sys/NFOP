# NFOP 4.0 Phase 1 — ONLINE FOUNDATION

**Version:** `4.0.0-alpha.001` (single source: `config.js` → `NF_CONFIG.app.version`)

---

## ⚠️ Schema review — sync paused

Database synchronization is **on hold** until the `projects` table schema is approved.

**Review document:** `supabase/SCHEMA-REVIEW.md`  
**SQL (proposed):** `supabase/schema.sql`  
**Migration (if v1 already applied):** `supabase/schema-migration-v1-to-v2.sql`

### Phase 1 synced columns (proposed)

| Column | NFOP field |
|--------|------------|
| Core identity | `id`, `number`, `title`, `client`, `eventType`, `date`, `status` |
| **Business-critical** | `phone`, `email`, `event_location`, `package`, `notes` |
| Audit | `created_at`, `updated_at`, `created_by`, `updated_by` |

### Deferred

- **`tasks`** → separate `project_tasks` table (Phase 2+)
- Structured address parts, offer history, UI-only state → local cache

---

## Architectural rules (unchanged)

- PostgreSQL columns only — **no JSON blob** on `projects`
- Supabase = source of truth for synced columns
- `localStorage` = offline working cache
- No UI / workflow / refactor changes

---

## Code prepared (not live until schema approved)

| File | Role |
|------|------|
| `supabase-sync.js` | Row mapping aligned to proposed schema |
| `events.js` | Event bus skeleton |
| `storage.js` | Hook ready for sync queue |
| `app.js` | Footer status + version |

Row mapping helpers:

- `event_location` ← `formatEventAddress(project)`
- `package` ← first line of primary `[NF-ANGEBOT]` block in notes
- `notes` ← full `project.notes`

---

## Environment setup (when approved)

See `config.local.example.js` — Supabase URL + anon key in `config.local.js`.

---

## Open points (need PO confirmation)

1. Sync **`client_address`** in Phase 1?
2. **`event_location` only** — OK that structured PLZ/street fields stay local until Phase 2?
3. Phase 1 sync **updates** (upsert on every save) for phone/email/notes — recommended **yes**

---

## Version

**`4.0.0-alpha.002`** — Volvo Trunk / operator-controlled sync (see `DESIGN-PRINCIPLES.md`)

> Realtime synchronizes data. The operator controls the workspace.
