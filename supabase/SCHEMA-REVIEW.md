# NFOP 4.0 Phase 1 — Projects table schema review

**Status:** Proposed — sync implementation paused pending approval  
**Version:** `4.0.0-alpha.001`  
**Rule:** PostgreSQL columns only — no JSON blob for the project row

---

## Summary

| Scope | Fields |
|-------|--------|
| **Synced in Phase 1** | identity, client contact, event, package, notes, audit |
| **Deferred (Phase 2+)** | `tasks` → separate `project_tasks` table |
| **Local cache only (Phase 1)** | structured address parts, offer history, UI state, CPE, calendar blocks |

---

## Table: `projects`

| Column | PostgreSQL type | NFOP source | Phase 1 sync |
|--------|-----------------|-------------|--------------|
| `id` | `uuid` PK | `project.id` | Yes |
| `project_number` | `integer` | `project.number` | Yes |
| `title` | `text` | `project.title` | Yes |
| `client_name` | `text` | `project.client` | Yes |
| `phone` | `text` | `project.phone` | **Yes** |
| `email` | `text` | `project.email` | **Yes** |
| `event_type` | `text` | `project.eventType` | Yes |
| `event_date` | `date` | `project.date` | Yes |
| `event_location` | `text` | `formatEventAddress(project)` → `eventAddress` | **Yes** |
| `package` | `text` | Primary `[NF-ANGEBOT]` summary line | **Yes** |
| `notes` | `text` | `project.notes` (full text) | **Yes** |
| `status` | `text` | `project.status` | Yes |
| `created_at` | `timestamptz` | `project.createdAt` | Yes |
| `updated_at` | `timestamptz` | `project.updatedAt` | Yes |
| `created_by` | `text` | device operator id | Yes |
| `updated_by` | `text` | device operator id | Yes |

SQL file: `supabase/schema.sql`  
Migration from earlier minimal schema: `supabase/schema-migration-v1-to-v2.sql`

---

## Field mapping notes

### `event_location`

- **Write:** formatted venue string (same as Maps / card `📍` line).
- **Read:** hydrate into `project.eventAddress`.
- Structured parts (`eventPostalCode`, `eventCity`, `eventStreet`, `eventHouseNumber`) stay **local-only in Phase 1** so the address modal round-trip on a second device may need re-entry until Phase 2 adds optional structured columns.

### `package` vs `notes`

NFOP stores catalog offers inside `project.notes` as `[NF-ANGEBOT]…[/NF-ANGEBOT]` blocks.

| Column | Content |
|--------|---------|
| `notes` | Full `project.notes` — source of truth for offers and free text |
| `package` | Denormalized summary for list/search (first line of primary offer, e.g. `📦 Hochzeit Basic — 1.299 €`) |

No app refactor required: sync layer derives `package` on write; hydrate restores `notes` in full.

### `phone` / `email`

Direct 1:1 mapping. Required for operator workflow and offer delivery hints.

---

## Not synced in Phase 1 (localStorage cache)

| NFOP field | Reason |
|------------|--------|
| `tasks[]` | Separate table in Phase 2+ |
| `offerHistory[]` | Offers / invoices phase |
| `clientAddress` | Client address — confirm if needed in Phase 1b |
| `eventPostalCode`, `eventCity`, `eventStreet`, `eventHouseNumber` | Structured venue — Phase 2 optional columns |
| `guests`, `price`, `location` | Secondary / legacy |
| `collapsed`, `notesUpdatedAt`, `lastOffer*` | UI / local state |

---

## Phase 2+ (prepared, not implemented)

```sql
-- project_tasks (future)
-- project_id → projects.id
-- label, done, sort_order, audit columns
```

Realtime on `projects` remains sufficient for Phase 1 create/read. Task sync would add a second Realtime subscription later.

---

## Open points for confirmation

1. **`client_address`** — sync in Phase 1 or defer with structured event address in Phase 2?
2. **`event_location` only** — acceptable that Device B gets formatted address but empty structured fields until Phase 2?
3. **`package` derivation** — OK to derive from first `[NF-ANGEBOT]` block, or add explicit `project.package` in app later?
4. **Updates** — Phase 1 sync should **upsert on every `saveProjects`** for synced columns (not insert-only)? Recommended: **yes**, so phone/email/notes edits propagate.

---

## Next step after approval

1. Apply `supabase/schema.sql` (or migration script)
2. Enable sync in `supabase-sync.js` (insert + update for all synced columns)
3. Realtime INSERT/UPDATE on `projects`
4. Two-device test with client data + notes + package

**Do not run live sync until this schema is approved.**
