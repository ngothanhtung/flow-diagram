# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start the dev server at localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (flat config: eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit -p .   # typecheck (no dedicated `typecheck` script exists)
```

There is no test runner configured in this repo (no test script, no Jest/Vitest/Playwright). Don't assume one exists.

`npm run build` needs the `NEXT_PUBLIC_FIREBASE_*` env vars set — `src/lib/firebase/client.ts` throws on a missing var, and pages are prerendered at build time. Placeholder values are enough for a build check.

If `tsc` reports errors in `.next/dev/types/`, they are stale generated route types (usually left behind by a deleted page). `rm -rf .next` and re-run.

## What this app is

A browser-based flowchart / diagram editor (SaaS architecture diagrams, CRM/HRM flows, ER diagrams) with animated connectors, built on Next.js 16 App Router + React 19. Diagrams are saved to Firestore per authenticated user, can be shared read-only, and a shared template library is managed by administrators.

## Routes

| Route | Component | Notes |
| --- | --- | --- |
| `/` | `components/diagrams/DiagramsHome` | The user's diagram list (create / open / delete / share) |
| `/diagrams/[id]/edit` | `components/editor/DiagramEditor` | The editor. Reads `users/{uid}/diagrams/{id}` — owner only |
| `/diagrams/[id]/view` | `components/viewer/DiagramViewer` | Read-only viewer for a public diagram |
| `/admin/diagrams`, `/admin/templates`, `/admin/templates/[id]/edit` | `components/admin/*` | Administrators only (see Roles) |
| `/guide` | `app/guide/page.tsx` | Authoring reference for `FlowDocumentJSON` (aimed at AI/devs writing documents by hand) |
| `/help`, `/help/vi` | `app/help/*` | End-user guide, bilingual EN/VI. Shared shell in `app/help/ui.tsx` |

There is no `FlowEditor` component and no `src/lib/use-editor.ts` — the editor was moved into a zustand store and a shared shell. Don't reintroduce prop-drilled `doc`/`setDoc`.

## Architecture

### Editor state lives in a zustand store

`src/lib/editor-store.ts` (`useEditorStore`) holds the whole editing session: the document (`doc`), persistence metadata (`currentDiagramId`/`currentDiagramName`/`currentDiagramPublic`/`savedSignature`), run cursor (`seed`/`runStep`/`runPhase`), selection (`selectedNodeId`/`selectedEdgeId`/`draggingNodeId`/`linkingFromId`/`activeShape`/`infoOpen`), and every document mutation (`onNodeMove`, `onNodeUpdate`, `onConnect`, `onShapeCreate`, `onEdgeUpdate`, …). Components read what they need with a selector; nothing passes `setDoc` around.

`hydrate(uid)` restores the localStorage session and is guarded by `hydrated` so it runs once per page load. `DiagramEditor` calls it from a **layout** effect, not during render — mutating the store mid-render trips React's "setState while rendering a different component" guard, and a layout effect still resolves before paint.

### Shared editor shell

`src/components/editor/EditorShell.tsx` is the frame every editing surface shares (header, playback controls, canvas, inspector drawer, info panels). Two surfaces mount it — `editor/DiagramEditor.tsx` (a user's diagram) and `admin/TemplateEditor.tsx` (a library template) — and supply only what differs: branding icon, subtitle, File menu, action buttons, persistence dialogs. Put anything both editors need into the shell (or `EditorChrome.tsx`), not into one surface.

- `editor/EditorChrome.tsx` — `EditorFileMenu` (with `afterOpen`/`afterExport` slots), `FileMenuItem`, `SaveButton`, `ResetCanvasDialog`, `EditorStatusScreen`, `downloadDocumentJson`.
- `editor/InspectorSidebar.tsx` — the inspector is a **non-modal drawer floating over the canvas** (`modal={false}` + `disablePointerDismissal`, so canvas clicks don't race the next selection); it hosts `NodeInspector`, `EdgeInspector`, and the Info panels.
- `editor/PlaybackControls.tsx` — split into presentational `RunControls` (pure props) and store-wired `PlaybackControls`. The viewer reuses `RunControls`, so the play bar can't drift between editor and viewer.
- `lib/use-execution-playback.ts` — derives every per-node/per-edge execution state from the store's run cursor, and drives the sequential timer. Shared by both editors and the viewer.

### Document model

The whole diagram is one JSON value, `FlowDocumentJSON` (`src/lib/flowchart-types.ts`): `{ nodes: FlowNode[], edges: FlowEdge[], settings?: DiagramSettings }`. Almost every field on `FlowNode`/`FlowEdge` is optional so older documents keep rendering — read styling through the resolvers (below), never off the raw fields. New nodes get an auto-incrementing `sortOrder` (`max existing + 1`).

### Persistence — two independent layers

- **Local autosave** (`src/lib/editor-session.ts`): the editor writes `{doc, currentDiagramId, currentDiagramName, currentDiagramPublic, savedSignature}` to `localStorage` under `flowgram:session:{uid}` on every change and restores it on mount. This is what makes a refresh preserve in-progress (unsaved) work — it is NOT the save-to-cloud path. If a restored session already holds the route's diagram id, `DiagramEditor` skips the Firestore fetch so unsaved edits survive.
- **Cloud save** (`src/lib/firebase/diagrams.ts`): explicit "Save" writes `users/{uid}/diagrams/{id}`. `dirty` is `JSON.stringify(doc) !== savedSignature` (the signature at last successful cloud save).
- **Public mirror**: a diagram flagged `public: true` is mirrored to a flat `public-diagrams/{id}` doc by `syncPublicMirror()`, so the viewer can read it with one `get()` — no collection-group query, no `isAdministrator()` in the path. The mirror sync is best-effort (logs, never throws); toggling public off deletes the mirror.

### Roles / admin

`src/lib/firebase/roles.ts` reads `users-roles/{uid}` and checks `roles` contains `administrators`. The doc **must** be keyed by uid because `firestore.rules` cannot query collections (`isAdministrator()` mirrors this exactly). Admins get cross-user diagram reads and full write access to `templates`.

### Templates

Templates live only in Firestore's shared `templates` collection and are managed through `/admin/templates`. `src/lib/firebase/templates.ts` owns reads and writes; `editor/TemplatePickerDialog.tsx`'s `useTemplateLibrary()` is the read hook. Choosing a template calls `loadRemoteTemplate()`, which swaps `doc` wholesale and resets run state. There is no bundled local-template fallback — an empty collection produces an empty library.

Ready-made template documents ship as JSON under `seed/templates/` (e.g. `database-schema.json`, the ERD sample) and are imported through the admin UI. See `seed/templates/README.md`.

### Canvas rendering

`src/components/FlowCanvas.tsx` is a single SVG whose content sits in a `<g transform="translate(...) scale(...)">`. Pointer↔data coordinate conversion always goes through `src/lib/coords.ts` (`screenToData`) using the current `ViewTransform` (`src/lib/view-transform.ts`) — never hand-roll that math elsewhere. Each node renders as `FlowNodeCard`; each edge as `AnimatedEdge`.

**Performance mode**: `FlowCanvas` sets `performanceMode = nodes.length > 20 || edges.length > 28` and culls off-screen nodes/edges. The flag is threaded down to cards and edge effects, where it thins *default* decoration (blur radii, halo layers) — it must never strip something the user explicitly configured. A past bug: the glow slider was dead on any real diagram because the effect layer short-circuited on `performanceMode` before reading the configured value.

### Edge geometry vs. edge effects (kept deliberately separate)

- **Geometry** (`src/components/edge-geometry.ts`): `buildEdgeGeometry()` computes the SVG path `d` for a given `routing` (`straight` | `smooth-step` | `orthogonal` | `curved`). The orthogonal/smooth-step router builds each port's lead-out along its own side normal (`sideNormal()`) so a line always approaches a port in that port's natural direction — it does not just dogleg based on the source side. This same builder produces the path for both the live edge and the "ghost" preview while dragging a new connection, so a completed connection never jumps.
- **Effects** (`src/components/edge-effect-layer.tsx`): `EdgeEffectLayer` renders the animated overlay along that same path. `direction: 'both'` is implemented by rendering the component twice internally (`EdgeEffectLayerSingle`, once forward once reverse) rather than every effect branch special-casing bidirectionality. All effects share one sizing formula, `objectWidth = lineWidth * scale * effectSize`, so "Effect object size" means the same thing everywhere.

Effects split into two families, and the per-edge knobs apply to one family each:

| Family | Examples | Knob |
| --- | --- | --- |
| Travelling objects | `comet`, `pulse`, `dots`, `laser`, `meteor`, `convoy`, `chase` | `effectCount` (1–8 objects; unset = spacing-based), `effectShape` |
| Tiled patterns | `flow`, `dash`, `wave`, `marching`, `ants`, `morse` | `effectDensity` (0.5×–2× mark density) |

`effect: 'none'` is the opt-out — `EdgeEffectLayer` returns `null` before any of the above, leaving a static line.

Shared knobs: `glowIntensity` (0–3, **unset = no halo**; `onConnect` stamps `1` on newly drawn lines so a glow is always explicit), `glowColor` (unset = white, `'auto'` = follow the object's colour, or a hex), `phaseOffset` (0–1 cycle, so parallel lines don't run in lockstep), `animationSpeed`, `effectColor`.

`effectShape` swaps the plain dash segment for a real silhouette from `edge-object-shapes.tsx` (12 glyphs authored in a 20×20 box, each declaring whether it `rotate`s), placed by `edge-motion-objects.tsx` using CSS `offset-path`/`offset-distance` against the same `d`. Reversed objects need `offset-rotate: 'auto 180deg'` — plain `auto` follows the *path* direction, not travel direction, and makes them fly backwards.

### Node effects

`FlowNode.effect` (`src/components/node-effect-layer.tsx`) is the node counterpart to `FlowEdge.effect`, and it is **off by default**: unset (or `'none'`) means nothing moves and nothing extra is painted. Two families, same split as the edges:

| Family | Effects | How it renders |
| --- | --- | --- |
| Motion | `float`, `breathe`, `bounce`, `wobble`, `shake`, `blink` | `nodeMotionStyle()` returns a CSS animation for a wrapper `<g>` **inside** the positioned group — animating the positioned group itself would fight its `translate` |
| Decoration | `glow`, `pulse`, `ripple`, `trace`, `sheen` | `<NodeEffectLayer>` paints extra SVG over the silhouette, using the same `outline.d` as the body |

Shared knobs (`effectSpeed`, `effectIntensity`, `effectColor`) mean the same thing for every effect. Intensity reaches the motion keyframes through the `--node-fx-intensity` custom property, so one keyframe set covers the whole range instead of one per level; `sheen` likewise gets its sweep distance from `--node-fx-sweep`, because a percentage translate would be relative to the band rather than the card.

**Body fill is a choice.** `fill: 'flat'` paints just `backgroundColor`; `'sheen'` adds the top-to-bottom gradient overlay. `resolveNodeStyle` defaults an unset field to `'sheen'` so every saved document renders exactly as before, while every creation path in the store stamps `'flat'` — the same "old docs unchanged, new work plain" split used for `shadow`. Blocks and group frames both honour it; a text object paints no body, so `TextInspector` doesn't offer it.

**`effect: 'none'` means the node is completely inert**, and three separate pieces of always-on decoration had to go for that to be true:

- the framer-motion spring that scaled every node in on mount and on every canvas re-seed — `FlowNodeCard` no longer imports framer-motion at all;
- the neon underlay path painted behind every body;
- the coloured halo `shadow` used to add. `shadow` is now depth only — a plain black `drop-shadow` — so the glow/pulse effects are the only source of a coloured halo. The two systems no longer overlap.

The one animation left that `effect` does not gate is the replay's active halo, which only runs while the play bar is running that node. Ports and the selection ring keep their glow: those are editor affordances, not node styling.

### Node styling

`src/lib/node-style.ts` defines `SHAPES`/`ICONS`/`COLORS` and `resolveNodeStyle(node)`, which merges a node's explicit fields over type-based defaults (a `decision` node defaults to a diamond, `start`/`output` get distinct palettes) — always read a node's rendered style through `resolveNodeStyle`, not `node.shape`/`node.color`, since those are optional.

`resolveNodeStyle` clamps geometry, and the ceiling depends on whether the node is a table: `width ≤ 320` / `height ≤ 240` for normal nodes, `≤ TABLE_MAX_WIDTH (420)` / `≤ TABLE_MAX_HEIGHT (900)` for table nodes. Keep that split — a 12-column table needs the taller ceiling, an ordinary card must not get it.

### Icons and brand logos

`NodeIcon` accepts `lucide:<Name>` / `tabler:<Name>` (resolved on demand from the full catalogs by `src/lib/icon-library.ts`), a handful of legacy bare names kept so old documents resolve without a fetch, and `logo:<slug>`.

Brand marks are ~15K static SVGs committed under `public/logos/<slug>.svg`, indexed by `public/logos.json`. `src/lib/logo-catalog.ts` fetches that index once and caches it in-module (`loadLogoCatalog` / `getCachedLogoCatalog`); `LogoPicker.tsx` searches it and `FlowNodeCard` renders the chosen mark as an `<img src="/logos/{slug}.svg">`. Both the catalog and the SVGs are checked in — the `build:logos` script and its `prebuild` hook were removed, so nothing regenerates them at build time.

The `logo` node type (and the dock's matching `DrawTool` value) is a dedicated brand-mark block: no icon by default until one is picked, and a much larger icon ceiling than other nodes (`resolveNodeStyle` allows `iconSize` up to 256 with a default of 64, versus 48/20 elsewhere).

### Groups (nested blocks)

A container is a node with `type: 'group'`; a member points at it with `parentId`. Membership lives on the child only — a frame never lists its contents — so there is a single field to keep consistent. `src/lib/node-tree.ts` owns every tree operation (`descendantIds`, `sortByTreeDepth`, `findDropTarget`, `groupGeometryFor`).

**Positions stay absolute.** A member's `position` is a canvas coordinate, never an offset from its frame; the store's `onNodeMove` applies the same delta to every descendant when a frame moves. That is what keeps edges, ports, SQL export and the viewer working without any knowledge of groups — don't switch to parent-relative coordinates.

- **Membership** is decided on drop, not while dragging: `onNodeDrop(id)` (called from `EditorCanvas`'s `onNodeDragEnd`, and after a resize) finds the deepest frame containing the node's centre. `findDropTarget` skips the dragged node's own descendants, so a frame can't become its own ancestor. A drop outside every frame clears `parentId`.
- **Paint order**: `FlowCanvas` renders `sortByTreeDepth(nodes)` instead of document order, so a frame always paints behind what it contains. The sort is stable, so same-depth nodes keep document order.
- **A frame is not a card**: `FlowNodeCard` branches on `isGroup` and draws a translucent wash with `pointerEvents='none'`, a grabbable border (`pointerEvents='stroke'`) and a title bar. The body *must* stay click-through — edges paint before nodes, so a solid frame would make every line inside it unselectable. Frames also render **no ports**: they aren't flow steps, and a top port would sit exactly on the title bar the user drags.
- **`computeOrderedGroups` filters frames out** of the replay — a container flashing as its own step would interrupt the run of the blocks inside it.
- **Delete takes the contents with it**; `ungroupNode` releases members (one level) and keeps the frame; `fitGroupToContents` shrink-wraps a frame via `groupGeometryFor`. `onNodeDuplicate` copies a frame's whole subtree plus the edges wholly inside it.
- **Size ceiling** comes from `nodeSizeLimits` (see below), not from a clamp written inline.

### Free text

`type: 'text'` is a node that renders only words — no silhouette, fill, border, icon or ports. Its content is `title` (newlines preserved via `white-space: pre-wrap`); `description` is not rendered. `FlowNodeCard`'s text branch draws an invisible `<rect pointerEvents='all'>` as the hit area, because there is no painted body to click, plus a hairline that appears on hover so an empty label stays findable. Like frames, text is filtered out of `computeOrderedGroups` — a caption isn't a step.

`TextInspector` is its own panel rather than a stack of guards — see *Inspector panels* below.

**Text only gets the motion family of node effects.** Every decoration effect (`glow`/`pulse`/`ripple`/`trace`/`sheen`) traces `outline.d`, and a text node's outline defaults to a plain rectangle — rendering one on text would draw exactly the border a text object is defined not to have. `FlowNodeCard` skips mounting `<NodeEffectLayer>` for `isText` nodes (motion still applies, via the `<g style={motionStyle}>` wrapper), and `NodeEffectField` hides the whole Decoration group from the picker on a text node so the UI doesn't offer a choice that renders nothing.

### Node size limits

`nodeSizeLimits(node)` in `node-style.ts` is the single source for min/max/default width and height, keyed on node kind (group 120–4000, text 24–1600×1200, table up to 420×900, ordinary card 72–320×240). `resolveNodeStyle`, `FlowNodeCard`'s drag-resize and `NodeInspector`'s number fields all read it — never re-derive a clamp locally, which is what previously left tables un-resizable past a card's 320×240 despite rendering much larger.

### Database tables (ERD)

An ER diagram is not a separate document type: a table is just a `FlowNode` carrying `table?: TableSpec` (`{ columns: TableColumn[], schema?: string }`), so ERD and flow blocks mix on one canvas and inherit saving, sharing, templates, and line effects for free.

- **Creating**: the dock's Table tool arms `activeShape = 'table'` (`DrawTool = NodeShape | 'table' | 'logo' | 'group' | 'text'`); `onShapeCreate` builds a `rounded` card with `starterColumns()` and a height from `tableCardHeight(columnCount)`, not from the drag — a new table is never born with rows clipped.
- **Rendering**: `TableCardBody.tsx` draws the header (title + schema) and one row per column. Flags are shown the sparse way round: `U`, `IX`, and `NULL` — nullable is the exception, so `NOT NULL` gets no badge.
- **Clipping**: table content lives in a `<foreignObject>`, which is always a rectangle. `FlowNodeCard` clips it to the node's silhouette (`clipPath` from `outline.d`) **for table nodes only**, otherwise a `rounded` card shows square corners poking past its outline.
- **Editing**: `TableColumnsEditor.tsx` (rendered by `NodeInspector`) writes straight through to the document, and every column write recomputes `height: tableCardHeight(next.length)`. It also offers "Convert to database table" on a node without `table`.
- **Relationships**: lines attach table-to-table like any other edge — there are no field-level anchors. `FlowEdge.fromColumn`/`toColumn` are metadata used for the label and for SQL FK emission. Cardinality uses the crow's-foot markers in `edge-marker.tsx` (`crow-one`, `crow-many`, `crow-one-many`, `crow-zero-one`, `crow-zero-many`), which follow the file's convention of "tip at the origin, body running towards −x". `EdgeInspector` only overwrites a relationship label it generated itself, and keeps it short (`id → user_id`) so it doesn't overflow into neighbouring tables.
- **Export**: `src/lib/sql-export.ts`'s `buildCreateTableSql(document)` emits `CREATE TABLE` + `CREATE INDEX` + `ALTER TABLE … ADD FOREIGN KEY`, surfaced by `editor/SqlExportDialog.tsx` from the File menu's `afterExport` slot. Data types are free text so the output suits whatever dialect the user had in mind. `resolveForeignKey` picks the child side from the column flags (explicit `foreignKey` wins, else the end pointing at a primary key is the parent), so which direction the user drew the line doesn't matter. Export only — there is no SQL import.

### Execution simulation (the "replay" animation)

`computeOrderedGroups()` groups nodes by resolved `sortOrder` — nodes sharing an order animate simultaneously as one step, not strictly one-by-one — and already filters out group frames and text objects (see below), so anything reading "which nodes are active" must go through it rather than `doc.nodes` directly. `runMode` (`doc.settings.runMode`) is `sequential` (auto-advances on a timer, `EDGE_DRAW_DURATION_MS`/`NODE_FADE_DURATION_MS` from `src/lib/execution-timing.ts`), `concurrent` (everything active at once — `use-execution-playback.ts`'s `active` array is `orderedGroups.flat()`, not `doc.nodes.map(...)`; the latter was a real bug that gave every frame and text object a permanent blinking halo in concurrent mode, since `FlowNodeCard` renders that halo for any `isActive` node regardless of type), or `manual` (user-driven). The sequential timer and the manual "Next" button both call the store's single `advanceStep()`, so the two modes can't drift out of sync.

### Inspector panels

`components/inspector/NodeInspector.tsx` is a dispatcher, not a panel: it renders `BlockInspector`, `TextInspector` or `GroupInspector` based on `node.type`. The three kinds paint genuinely different things — a block has a body, a text object has only words, a frame has a wash and a title bar — so each panel lists only the controls that do something for that kind. Don't add a `node.type === …` guard inside a panel; put the control in the panel it belongs to.

- **`BlockInspector`** — everything with a painted body (process/start/decision/output cards, logo blocks, database tables): title + sub title, geometry, sort order, typography, shape, the paired colour fields, border/shadow, icon or logo, all three alignment rows, and the table section.
- **`TextInspector`** — the text itself (a Textarea, since newlines are content), geometry, typography, a single foreground colour field, opacity and text alignment. No sort order: the replay skips text, so an execution position would do nothing.
- **`GroupInspector`** — title, a **Contents** block (member count + Fit to contents / Ungroup), geometry, typography, wash/border colour fields, opacity. No shadow (the frame branch paints none) and no sort order.

`components/inspector/fields.tsx` holds everything shared: the field primitives (`NumberField`, `RangeField`, `SelectField`, `SegmentedButtons`, `ColorField`, `ShapeThumb`), the colour palette (`COLOR_PRESETS`), the composed sections used by more than one panel (`GeometryFields`, `TypographyFields`, `FillField`, `TextAlignField`, `GroupMembershipSection`, `ActionsSection`, `InspectorShell`), and `useNodeFieldDraft`.

**Colour is per-field, not a separate preset step.** Every `ColorField` (Text/icon · Border, Background, Wash, Text colour, Effect colour) is a complete picker on its own: a row of the ten `COLOR_PRESETS` dots for quick picks, a native `<input type="color">`, and a hex box that free-types any value — `parseHex` accepts `#abc`, `#aabbcc`, `#aabbccdd` with or without the leading `#`, and reverts to the field's current value on anything else. There used to be a `ColorPresetGrid` above the fields that set foreground + background + border together from one 30-swatch grid; it's gone; each field now sets only what it owns, and a picker beats a two-step preset-then-tweak flow.

`useNodeFieldDraft` is the reason edits aren't lost: clicking away deselects the node, which unmounts the panel *before* the input's blur fires, so commit-on-blur alone drops the last keystrokes. The hook mirrors the draft into a ref and flushes it from the unmount cleanup.

### UI primitives and shared conventions

`src/components/ui/*` are shadcn components (`components.json`, style `base-nova`) built on **`@base-ui/react`, not Radix**. Base UI has sharper structural requirements:

- `DropdownMenuLabel` must sit inside a `DropdownMenuGroup` or it throws at runtime (`MenuGroupContext is missing`).
- `AlertDialogAction` and similar action buttons do **not** auto-close their dialog when given a custom `onClick` — the handler must call `setOpen(false)` itself (see `ResetCanvasDialog` and the delete confirmation in the diagrams list).
- A `Button` rendered as something other than a native button (e.g. `render={<Link …/>}`) needs `nativeButton={false}`, or Base UI logs "A component that acts as a button expected a native `<button>`".

Prefer extending an existing `components/ui` primitive over a raw `<dialog>` or hand-rolled popover, and prefer these shared pieces over restyling per-surface:

- `Button` variants `toolbar` (frosted dark header/toolbar control) and `accent` (cyan call-to-action: New diagram, Copy link, Sign in) — added on top of the stock shadcn variants.
- `Input` variant `toolbar`, matching the `toolbar` button.
- `src/components/data-table.tsx` — `DataTable`, `DataTableFooter`, `SortHeaderButton`, `formatDateTime`, `formatNumber`, shared by the diagrams list and both admin tables (TanStack Table).

### Firebase

`src/lib/firebase/client.ts` initializes the app from `NEXT_PUBLIC_FIREBASE_*` env vars (see `.env.example`) and throws immediately if a required var is missing — there's no silent-degrade path. `auth.ts`, `diagrams.ts`, `templates.ts` and `roles.ts` are the only modules that talk to Firebase; everything else goes through them. `firestore.rules` is the source of truth for access and is deployed separately (`firebase deploy --only firestore:rules`) — a change to a collection's shape usually needs a matching rules change.

## Verifying UI work

There's no test runner, so visual changes are checked by hand: run `npm run dev` with placeholder Firebase env vars, add a temporary page under `src/app/` that renders the component with fixture data, drive it with Playwright (Chromium is available at `/opt/pw-browsers`) — screenshots plus `page.evaluate` to read computed styles, which is how several "looks fine, is actually dead" bugs were caught. **Delete the temporary page before committing**, then run `npx tsc --noEmit -p .`, `npm run lint`, and a production build.
