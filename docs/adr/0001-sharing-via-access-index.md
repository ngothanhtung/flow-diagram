# 0001 — Share a Diagram through an access index, not by moving Diagrams

- **Status**: Accepted
- **Date**: 2026-10-15
- **Context for**: [PRD v0.3 §4.2](../prd/v0.3.md) — Share for Collaborators

## Context

Every Diagram lives at `users/{ownerUid}/diagrams/{id}`, and the Editor reads it through the *signed-in* user's uid. That path is what made "only the owner can open it" free, and it is exactly what v0.3's Share breaks: a Collaborator must open a Diagram that sits under someone else's uid.

The PRD adds two hard constraints: every existing `/diagrams/{id}/edit` and `/diagrams/{id}/view` link — including Public links already sent to customers — must keep working, and the app must keep running on Firebase's free plan with no server code (no Cloud Functions), so nothing can fan out or migrate data in the background.

## Options

**(a) Keep Diagrams where they are; add an access index.** A small `diagram-access/{diagramId}` document records `ownerUid` and the Collaborators, keyed by **email** with their Access level. The Editor resolves the owner through it; a Diagram with no index document belongs to whoever is opening it, which is exactly today's behaviour. Firestore rules on the owner's path grant Collaborators access by `get()`-ing the index.

**(b) Move every Diagram to a top-level `diagrams/{id}`** carrying `ownerUid` and Collaborators. One collection, simpler queries — but production data has to be migrated by a script, the Public link mirror and the admin overview rewritten, and a botched migration loses user work.

## Decision

**(a).** Old links work by construction rather than by a migration being right, and there is no production data step at all.

Keying Collaborators by email (not uid) is what makes invitations to someone without an account work with no server: the invite simply starts matching once they sign up with that email. This relies on the email being **verified** — the same requirement the Access list introduced in v0.2 — otherwise anyone could register an invited address.

## Consequences

- "Shared with me" is one query over `diagram-access` by the signed-in user's email.
- Every rule on `users/{uid}/diagrams/**` (Diagram, Versions) gains a Collaborator branch that reads the index; the index itself is writable only by the Owner.
- The index and the Diagram are two documents, so creating/deleting a shared Diagram must write both; a missing index degrades safely to owner-only.
- Transferring ownership later means moving a Diagram between uid paths — still possible, but not free. v0.3 does not offer it.

### As built (T7)

- **The index is keyed `diagram-access/{ownerUid}_{diagramId}`, not `{diagramId}`.** Diagram ids are client-chosen and every Public link exposes one, so with the bare id anyone could create their own Diagram under that id and claim the index slot first; the real Owner could then never Share it. The uid prefix makes the slot unclaimable, and lets the rules find the index from the Diagram's path. A bare `/diagrams/{id}/…` link is resolved by the user's own path first, then by a query (`diagramId ==` + `collaboratorEmails array-contains`), which needs one composite index (`firestore.indexes.json`).
- **A Collaborator match requires a verified email even when the Access list is open** — the verification the ADR relies on is enforced in the rules (`hasVerifiedEmail()`), not left to the Access list.
- **"Shared with me" is one query plus one read per shared Diagram.** Its name and last-saved time are read from the Diagram rather than copied into the index: the index is the Owner's to write, so a Collaborator's Save couldn't keep a copy current.
- **Creating a Diagram writes no index** (absence = owner-only); deleting one deletes the index before the Diagram itself, so a half-done delete never leaves Collaborators pointing at nothing.
- **Concurrent Saves are detected with a `revision` counter** on the Diagram, compared inside the Save's transaction and required to step by exactly one by the rules — real-time collaboration stays out of scope.

