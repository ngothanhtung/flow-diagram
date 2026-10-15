# Implementation plan — PRD v0.2 + v0.3

Tracks delivery of [PRD v0.2](prd/v0.2.md) and [PRD v0.3](prd/v0.3.md). Each task is one commit on its release branch; every task ends with a checkpoint where the product owner signs off before the next one starts.

## Ground rules

- **Branches**: `release/v0.2`, then `release/v0.3` (from `main` after v0.2 merges). Merge + push to `main` only after the release's last checkpoint is approved.
- **Never touch the real Firebase project.** All verification runs against the Firebase Emulator (Auth + Firestore). Firestore rules are deployed by the product owner (`firebase deploy --only firestore:rules`), never by the agent.
- **Definition of done for a task**:
  1. Every acceptance criterion of its PRD section is checked off, with how it was verified (Vitest, rules test, or browser check against the emulator).
  2. `npx tsc --noEmit -p .`, `npm run lint`, `npm test`, `npm run test:rules` (once T0 lands) and `npm run build` pass.
  3. Docs the task changes are updated in the same commit: `CLAUDE.md` (architecture), `/help` + `/help/vi` (user guide), `README.md` (setup).
  4. No temporary verification pages left in `src/app/`.

## Release v0.2 — `release/v0.2`

| # | Task | PRD | Depends on | Status |
| --- | --- | --- | --- | --- |
| T0 | Test & emulator infrastructure | — | — | ☑ |
| T1 | Undo / redo | v0.2 §4.1 | T0 | ☑ |
| T2 | Shortcuts and copy/paste | v0.2 §4.2 | T1 | ☑ |
| T3 | Image export | v0.2 §4.3 | T0 | ☐ |
| T4 | Password reset | v0.2 §4.4 | T0 | ☐ |
| T5 | Access list + email verification | v0.2 §4.5 | T0 | ☐ |

### T0 — Test & emulator infrastructure
- `firebase.json` emulators block (Auth, Firestore, UI); `npm run emulators`.
- `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1` makes `src/lib/firebase/client.ts` connect to the local emulators; `npm run dev:emulator` runs both.
- Vitest: `npm test` for pure logic (`src/**/*.test.ts`), `npm run test:rules` running `tests/rules/**` inside `firebase emulators:exec` with `@firebase/rules-unit-testing`.
- Baseline rules tests for today's rules (owner-only diagrams, public mirror, admin read, templates) so later rule changes are regression-checked.
- `CLAUDE.md`: replace "no test runner" with the new commands; describe the emulator workflow under *Verifying UI work*.

### T1 — Undo / redo
- History lives in the editor store: past/future stacks of `doc` snapshots (documents are immutable values, so a snapshot is a reference), capped at 100.
- One **central** recording point for `doc` changes — not 35 call sites each remembering to push history. Non-content state (selection, run cursor, viewport, run mode, name, public flag) never records.
- **Gestures coalesce**: drag, resize, endpoint drag and slider drags open a transaction; only its first change records a step. Field commits are already single updates.
- Whole-document replacements (template, starter, mermaid, JSON playground, reset) record a step. Opening another Diagram or reloading clears history; Save does not.
- `dirty` stays `JSON.stringify(doc) !== savedSignature`, so undoing back to the saved document clears it for free.
- Undo/Redo buttons in the shared `EditorShell` header (both editors).
- Vitest: history stack, cap, redo-branch truncation, coalescing.

### T2 — Shortcuts and copy/paste
- One keyboard handler on the editor (not the viewer), ignoring events from inputs/textareas/contenteditable.
- Store actions that act on the **selection**: delete, duplicate, select all, nudge (1px / 10px / grid step; one undo step per key-down…key-up).
- Clipboard module (pure, Vitest-covered): selection → Diagram JSON fragment (selected Elements + Frame subtrees + Lines with both ends inside + referenced Line styles); fragment → re-id'd, offset Elements; Line style merge without name clashes; validation of pasted text.
- `?` cheat sheet dialog; shortcut hints in the File menu and button titles; `/help` + `/help/vi` section.

### T3 — Image export
- Render the Diagram in `static` run mode, collect bounds of all (or selected) Elements + Lines, serialise a standalone SVG with icons/logos inlined as data and fonts embedded; PNG = that SVG rasterised at 2×.
- Background: theme canvas colour or transparent; grid never drawn.
- Export dialog from both editors' File menu; download button in the Viewer.
- Risk to verify early: tables render inside `<foreignObject>`; confirm rasterising it does not taint the canvas in Chromium and Safari. Fallback: render table rows as plain SVG for export.

### T4 — Password reset
- "Forgot password" on `LoginForm` → `sendPasswordResetEmail`; one neutral message for every outcome; client-side email format check.

### T5 — Access list + email verification
- Config doc `config/access` `{ domains: string[], emails: string[] }`, edited by hand; missing/empty = open.
- Rules: `isAllowed()` = admin, or list empty, or (email verified **and** domain/email listed); gate every user-data and template rule with it. Public mirror reads stay open.
- Client: after sign-in, check the same condition to show a clear refusal or the "Check your inbox" screen (with resend) instead of generic permission errors.
- Rules tests for every acceptance criterion; README section on configuring the Access list.

**Release v0.2 checkpoint**: merge `release/v0.2` → `main`, push, hand over the rules diff + deploy command.

## Release v0.3 — `release/v0.3`

| # | Task | PRD | Depends on | Status |
| --- | --- | --- | --- | --- |
| T6 | Versions | v0.3 §4.1 | v0.2 | ☐ |
| T7 | Share for Collaborators | v0.3 §4.2, [ADR 0001](adr/0001-sharing-via-access-index.md) | T6 | ☐ |
| T8 | Auto-layout | v0.3 §4.3 | v0.2 (undo) | ☐ |

### T6 — Versions
- Each Save also writes `users/{owner}/diagrams/{id}/versions/{versionId}` (`document`, `savedBy`, `savedAt`, optional `name`), then prunes unnamed Versions beyond 50 (client-side; no server).
- History panel in the Editor: list, preview (read-only canvas with Replay), restore (loads as unsaved change — one undo step), save as new Diagram, name/rename/unname.
- "Last saved by … at …" in the Editor and the Diagrams list.
- Rules: Versions follow the Diagram's owner-only rule (T7 adds Collaborators); deleting a Diagram deletes its Versions.

### T7 — Share for Collaborators (ADR 0001)
- `diagram-access/{id}`: `ownerUid`, `collaborators: { [email]: 'edit' | 'view' }`, `collaboratorEmails: string[]` for querying.
- Editor resolves the owner through the index; no index = current user owns it (old links unchanged).
- Rules: Collaborator branches on Diagram + Versions; index writable by Owner only; invitee must satisfy the Access list.
- Save conflict: Save runs in a transaction comparing a revision counter to the one loaded; mismatch → conflict dialog (overwrite / save as new / load latest).
- Share dialog (Collaborators + Public link), "Shared with me" on the Diagrams list, Can view opens in the Viewer, revoke handling on Save, delete warning with Collaborator count.
- Rules tests for the whole Access level table.

### T8 — Auto-layout
- Reference set in `seed/layout-reference/` (synthetic set first; product owner's real Diagrams replace it before sign-off).
- Quality metrics module (Line-through-Element, crossings, chain straightness, overlap) with Vitest assertions over the reference set — the PRD's measurable criteria become automated tests.
- Layout improvements: align a node with its inputs, reserve lanes for multi-rank Lines, Frames laid out recursively and fitted, Text/Icon/Free line untouched, ports re-picked.
- Command (selection or whole Diagram, TB/LR) with an Undo toast; Mermaid import and Starters use the new layout.
- Product owner visual sign-off on every reference Diagram.

**Release v0.3 checkpoint**: merge `release/v0.3` → `main`, push, hand over the rules diff + deploy command.
