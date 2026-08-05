# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start the dev server (Turbopack) at localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (flat config: eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit -p .   # typecheck (no dedicated `typecheck` script exists)
```

There is no test runner configured in this repo (no test script, no Jest/Vitest/Playwright). Don't assume one exists.

Known pre-existing issue: `src/components/FlowCanvas.tsx` has a handful of `tsc` errors around `geometry.points` (a union-type narrowing gap in `buildEdgeGeometry`'s return type). These predate most feature work in this repo — verify with `git stash` before assuming a change you made caused them.

## What this app is

A browser-based flowchart/diagram editor (SaaS architecture diagrams, CRM/HRM flows, etc.) with animated connectors, built on Next.js 16 App Router + React 19. Diagrams are saved to Firestore per authenticated user. It is effectively a single-page app: `src/app/page.tsx`'s `FlowEditor` component holds nearly all editor state and renders the whole UI (canvas + inspectors + topbar).

## Architecture

### Entry / auth gate

`src/app/page.tsx`'s `Home()` gates on `useAuth()` (`src/components/auth/AuthProvider.tsx`): shows `AuthLoadingScreen` / `LoginForm` until a Firebase user exists, then mounts `FlowEditor`. Because of this, `FlowEditor` only ever mounts client-side after hydration — lazy `useState(() => ...)` initializers in it that touch `localStorage`/`window` are safe (no SSR/hydration mismatch risk).

### Document model

The whole diagram is one JSON value, `FlowDocumentJSON` (`src/lib/flowchart-types.ts`): `{ nodes: FlowNode[], edges: FlowEdge[] }`. `FlowEditor` owns it as a single `doc` state and passes `doc`/`setDoc` into `useEditor()` (`src/lib/use-editor.ts`), which returns memoized CRUD callbacks (`onNodeMove`, `onNodeCreate`, `onConnect`, `onNodeResize`, etc.) consumed by the canvas and inspectors. New nodes get an auto-incrementing `sortOrder` (`max existing + 1`) so execution-order stays sane without manual numbering.

### Persistence — two independent layers

- **Local autosave** (`src/lib/editor-session.ts`): every `doc`/`currentDiagramId`/`currentDiagramName`/`savedSignature` change is written to `localStorage` under `flowgram:session:{uid}` and restored on mount. This is what makes a page refresh preserve in-progress (unsaved) work — it is NOT the save-to-cloud path.
- **Cloud save** (`src/lib/firebase/diagrams.ts` + `src/components/diagrams/DiagramManager.tsx`): explicit "Save" persists to Firestore at `users/{uid}/diagrams/{id}` (`firestore.rules` restricts each collection to its owner). `dirty` is computed by comparing `JSON.stringify(doc)` against `savedSignature` (the signature at last successful cloud save).

### Templates

`src/lib/diagram-templates.ts` exports `diagramTemplates: DiagramTemplate[]`, built with local `node()`/`edge()` factory helpers (fixed theme palette, forces `shape: 'rounded'`, edge `width: 1`, `effectSize: 1.5` so every template reads as one consistent visual system). The default boot document (`src/lib/flowchart-data.ts`'s `initialDocument`, a minimal Client→Server→Database example) is itself one of the templates. The "Open templates" dropdown in the topbar calls `loadTemplate()` in `page.tsx`, which swaps `doc` wholesale and resets execution/run state.

### Canvas rendering

`src/components/FlowCanvas.tsx` is a single SVG whose content sits in a `<g transform="translate(...) scale(...)">`. Pointer↔data coordinate conversion always goes through `src/lib/coords.ts` (`screenToData`) using the current `ViewTransform` (`src/lib/view-transform.ts`) — never hand-roll that math elsewhere. Each node renders as `FlowNodeCard`; each edge as `AnimatedEdge`.

### Edge geometry vs. edge effects (kept deliberately separate)

- **Geometry** (`src/components/edge-geometry.ts`): `buildEdgeGeometry()` computes the SVG path `d` for a given `routing` (`straight` | `smooth-step` | `orthogonal` | `curved`). The orthogonal/smooth-step router builds each port's lead-out along its own side normal (`sideNormal()`) so a line always approaches a port in that port's natural direction — it does not just dogleg based on the source side. This same builder produces the path for both the live edge and the "ghost" preview while a user is dragging a new connection, so a newly completed connection never jumps.
- **Effects** (`src/components/edge-effect-layer.tsx`): `EdgeEffectLayer` renders the animated overlay (comet/dots/pulse/binary/etc.) along that same path. `direction: 'both'` is implemented by having the component render itself twice internally (`EdgeEffectLayerSingle`, once forward once reverse) rather than every effect branch special-casing bidirectionality. All effects share one sizing formula, `objectWidth = lineWidth * scale * effectSize`, so the "Effect object size" control means the same thing across every effect.

### Node styling

`src/lib/node-style.ts` defines `SHAPES`/`ICONS`/`COLORS` and `resolveNodeStyle(node)`, which merges a node's explicit fields over type-based defaults (e.g. a `decision` node defaults to a diamond, `start`/`output` get distinct palettes) — always read a node's rendered style through `resolveNodeStyle`, not by reading `node.shape`/`node.color` directly, since those are optional.

### Execution simulation (the "replay" animation)

`FlowEditor` groups nodes by resolved `sortOrder` into `orderedGroups` — nodes sharing the same order animate simultaneously as one step, not strictly one-by-one. `runMode` is one of `sequential` (auto-advances on a timer, `EDGE_DRAW_DURATION_MS`/`NODE_FADE_DURATION_MS` from `src/lib/execution-timing.ts`), `concurrent` (everything active at once), or `manual` (user-driven — the shared `advanceStep()` callback is reused by both the sequential timer and the manual "Next" button, so the two modes can't drift out of sync).

### UI primitives

`src/components/ui/*` are shadcn components (`components.json`, style `base-nova`) built on `@base-ui/react`, not Radix. Base UI has sharper structural requirements than Radix — e.g. `DropdownMenuLabel` must be inside a `DropdownMenuGroup` or it throws at runtime (`MenuGroupContext is missing`), and `AlertDialogAction`/similar action buttons do not auto-close their dialog when given a custom `onClick` — the handler must close it explicitly (see how `DiagramManager.tsx`'s delete confirmation and `page.tsx`'s reset confirmation both call their `setOpen(false)` at the end of the handler). Prefer extending an existing `components/ui` primitive over reaching for a raw `<dialog>`/custom popover.

### Firebase

`src/lib/firebase/client.ts` initializes the app from `NEXT_PUBLIC_FIREBASE_*` env vars (see `.env.example`) and throws immediately if any required var is missing — there's no silent-degrade path. `src/lib/firebase/auth.ts` and `diagrams.ts` are the only modules that talk to Firebase directly; everything else goes through them.
