# NFOP 4.0 — Design Principles

> **Realtime synchronizes data. The operator controls the workspace.**

## Startup

1. Restore **Last Known Workspace** from `localStorage` (`nfProjects`)
2. Render immediately — no spinner waiting for Supabase
3. Bootstrap Supabase in the background; Realtime stays active

## Synchro Gate (Volvo Trunk)

Every remote change follows:

```
Supabase → Realtime → Synchro Gate → Volvo Trunk Queue
  → Operator Synchronize → Apply → Render
```

No module may update the UI directly from Realtime events.

## Operator owns the screen

Never from Realtime or sync apply:

- Open a project
- Steal focus
- Switch editor
- Auto-scroll
- Replace active context

## Last Known Workspace

- `localStorage nfProjects` = Last Known Workspace (not “cache”)
- After **Synchronize + Apply**: persist from applied state; Supabase wins on apply

## Deletes

- Remote DELETE → Volvo Trunk queue (not auto-purge)
- Local delete of synced project → outbound DELETE queue
- Apply deletes only after operator confirms in the Synchronize flow

## Save As

- Duplicate locally with new UUID and project number
- Queue outbound INSERT — upload only on **Synchronize**
- JSON export remains available

## Footer (Phase 1.2)

Minimal: `📦 N pending` + **Synchronize** button. Details in a lightweight modal.
