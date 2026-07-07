# CHANGELOG

## 4.0.0-alpha.003

Pre-deployment polish and hero operational dashboard

- Move sync controls to hero bar: online status, pending (handbrake), SYNCHRO (4×4)
- Move Dunkelmodus toggle to hero bar (light bulb on/off icon); minimal footer
- Open From queues outbound INSERT/UPDATE for imported projects
- Reconnect runs bootstrap compare → Volvo Trunk (operator still decides via SYNCHRO)
- Remove direct `localStorage nfProjects` access from `angebot.js`
- Remove dead BUILD 001 render code from `ui.js`
- Remove obsolete `editClient`, `bindEvents`, and unused sync footer UI

## 4.0.0-alpha.002

Volvo Trunk — operator-controlled synchronization

- Add `synchro.js` — Synchro Gate / Volvo Trunk queue (inbound + outbound)
- Realtime and bootstrap enqueue only; no direct UI updates from remote events
- Footer: pending count + Synchronize button; lightweight details panel
- Save As duplicates locally and queues outbound INSERT (no immediate upload)
- Moose cleanup queues outbound DELETE for synced projects
- Supabase UPDATE/DELETE outbound support
- Last Known Workspace terminology (`localStorage nfProjects`)
- Design principles documented in `DESIGN-PRINCIPLES.md`

## 4.0.0-alpha.001

Repository Consolidation

- Canonical Git repository established
- Versioning introduced
- Project structure documented
- Roadmap documented
- Foundation prepared for Supabase
