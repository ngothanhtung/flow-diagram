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

`src/lib/editor-store.ts` (`useEditorStore`) holds the whole editing session: the document (`doc`), persistence metadata (`currentDiagramId`/`currentDiagramName`/`currentDiagramPublic`/`savedSignature`), run cursor (`seed`/`runStep`/`runPhase`), selection (`selectedNodeId`/`selectedNodeIds`/`selectedEdgeId`/`draggingNodeId`/`linkingFromId`/`activeShape`/`infoOpen`), and every document mutation (`onNodeMove`, `onNodeUpdate`, `onConnect`, `onShapeCreate`, `onEdgeUpdate`, …). Components read what they need with a selector; nothing passes `setDoc` around.

### Selection is a set, with one primary

`selectedNodeIds` is the whole selection; `selectedNodeId` is the **primary** — the last node clicked — and is what the inspector edits. Keeping both is what let multi-select land without touching every panel: a panel still reads one node, while layout actions read the array. They never disagree — `selectNode` (plain click) sets a one-entry array, `toggleNodeSelection` (shift-click) adds/removes and hands the primary to whatever is left, `selectNodes` (marquee) replaces both, and selecting an edge clears both.

- **Marquee** is shift-drag on empty canvas (`FlowCanvas`), because plain drag has always panned. It selects on *overlap*, not containment — a box you have to drag fully around each node is fiddly when zoomed out. The in-flight box is mirrored into `marqueeRef` so the pointerup handler can read the final rectangle without doing the selection inside a `setState` updater, which runs during render and trips React's setState-in-render guard.
- **Dragging any selected node moves the whole selection**: `onNodeMove` applies its delta to every other selected node, and each selected frame still carries its own subtree — the same absolute-position rule groups already used, now with more than one root.
- **Resize handles only appear on a lone selection** (`FlowNodeCard`'s `showResizeHandles`): with several nodes selected there is no single box those four corners would resize.
- `SelectionToolbar` (top-centre of the canvas, opposite the shape dock) mounts from two nodes up and drives `alignSelectedNodes` / `distributeSelectedNodes` / `matchSelectedNodeSize`. Align works against the **selection's own bounding box**, so the outermost nodes stay put. Distribute evens the *gaps*, not the centres — with mixed node sizes, equal centre spacing still leaves visibly uneven whitespace, which is the thing being fixed — and needs 3+ nodes. Match size resizes around each node's centre (the app's `position` is a centre, and the inspector's width/height fields behave the same way), clamped per node kind by `nodeSizeLimits`.

`hydrate(uid)` restores the localStorage session and is guarded by `hydrated` so it runs once per page load. `DiagramEditor` calls it from a **layout** effect, not during render — mutating the store mid-render trips React's "setState while rendering a different component" guard, and a layout effect still resolves before paint.

### Shared editor shell

`src/components/editor/EditorShell.tsx` is the frame every editing surface shares (header, playback controls, canvas, inspector drawer, info panels). Two surfaces mount it — `editor/DiagramEditor.tsx` (a user's diagram) and `admin/TemplateEditor.tsx` (a library template) — and supply only what differs: branding icon, subtitle, File menu, action buttons, persistence dialogs. Put anything both editors need into the shell (or `EditorChrome.tsx`), not into one surface.

- `editor/EditorChrome.tsx` — `EditorFileMenu` (with `afterOpen`/`afterExport` slots), `FileMenuItem`, `SaveButton`, `ResetCanvasDialog`, `EditorStatusScreen`, `downloadDocumentJson`.
- `editor/InspectorSidebar.tsx` — the inspector is a **non-modal drawer floating over the canvas** (`modal={false}` + `disablePointerDismissal`, so canvas clicks don't race the next selection); it hosts `NodeInspector`, `EdgeInspector`, the Info panels and `EdgeStylePaletteDialog`.
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

Templates live only in Firestore's shared `templates` collection and are managed through `/admin/templates`. `src/lib/firebase/templates.ts` owns reads and writes; `editor/TemplatePickerDialog.tsx`'s `useTemplateLibrary()` is the read hook. Choosing a template calls `loadRemoteTemplate()`, which swaps `doc` wholesale and resets run state. There is no bundled local-template fallback — an empty collection produces an empty library. That is separate from the built-in **starters** (see *Mermaid import, auto-layout and starters*), which ship with the app and are reached from a different File-menu command.

Ready-made template documents ship as JSON under `seed/templates/` (e.g. `database-schema.json`, the ERD sample) and are imported through the admin UI. See `seed/templates/README.md`.

### Canvas rendering

`src/components/FlowCanvas.tsx` is a single SVG whose content sits in a `<g transform="translate(...) scale(...)">`. Pointer↔data coordinate conversion always goes through `src/lib/coords.ts` (`screenToData`) using the current `ViewTransform` (`src/lib/view-transform.ts`) — never hand-roll that math elsewhere. Each node renders as `FlowNodeCard`; each edge as `AnimatedEdge`.

**Performance mode**: `FlowCanvas` sets `performanceMode = nodes.length > 20 || edges.length > 28` and culls off-screen nodes/edges. The flag is threaded down to cards and edge effects, where it thins *default* decoration (blur radii, halo layers) — it must never strip something the user explicitly configured. A past bug: the glow slider was dead on any real diagram because the effect layer short-circuited on `performanceMode` before reading the configured value.

**Snap to grid always snaps an *edge or corner*, never a centre.** `snapPoint` itself just rounds a point to `gridSize`; what matters is which point each gesture hands it. A node's `position` is its **centre**, so snapping that is the one thing that looks broken — a 190×86 block ends up centred on a grid crossing with its outline touching no line at all, which reads as "snap is off" no matter how exact the centre is. So `handleNodeMove` snaps the node's top-left **corner** and converts back to a centre, `handleNodeResize` snaps the **edges** the user is dragging (keeping the opposite, anchored edge exactly where it was), `handleLineEndpointMove` snaps the **endpoint** being dragged, and the draw gesture snaps the pointer, so a shape is born on the grid. The accepted trade-off in `handleNodeMove` is that differently-sized nodes no longer share a snapped centre line; same-sized ones — the normal case, since a diagram reuses one card size — stay in lockstep either way. In a multi-node drag only the primary snaps and the rest follow by the same delta, so a selection keeps its internal arrangement.

`handleNodeResize` clamps through `nodeSizeLimits(node)`, never a local floor: a hardcoded 72 here used to override what a text object or free line is allowed to be *and* push the anchored edge to make room.

### Edge geometry vs. edge effects (kept deliberately separate)

- **Geometry** (`src/components/edge-geometry.ts`): `buildEdgeGeometry()` computes the SVG path `d` for a given `routing` (`straight` | `smooth-step` | `orthogonal` | `curved`). The orthogonal/smooth-step router builds each port's lead-out along its own side normal (`sideNormal()`) so a line always approaches a port in that port's natural direction — it does not just dogleg based on the source side. This same builder produces the path for both the live edge and the "ghost" preview while dragging a new connection, so a completed connection never jumps.
- **Effects** (`src/components/edge-effect-layer.tsx`): `EdgeEffectLayer` renders the animated overlay along that same path. `direction: 'both'` is implemented by rendering the component twice internally (`EdgeEffectLayerSingle`, once forward once reverse) rather than every effect branch special-casing bidirectionality. All effects share one sizing formula, `objectWidth = lineWidth * scale * effectSize`, so "Effect object size" means the same thing everywhere.

Effects split into two families, and the per-edge knobs apply to one family each:

| Family | Examples | Knob |
| --- | --- | --- |
| Travelling objects | `comet`, `pulse`, `dots`, `laser`, `meteor`, `convoy`, `chase` | `effectCount` (1–8 objects; unset = spacing-based), `effectShape` |
| Tiled patterns | `flow`, `heartbeat`, `rail`, `ants`, `morse` | `effectDensity` (0.5×–2× mark density) |

`effect: 'none'` is the opt-out — `EdgeEffectLayer` returns `null` before any of the above, leaving a static line.

Shared knobs: `glowIntensity` (0–3, **unset = no halo**; `onConnect` stamps `1` on newly drawn lines so a glow is always explicit), `glowColor` (unset = white, `'auto'` = follow the object's colour, or a hex), `animationSpeed`, `effectColor`.

`effectShape` (a `NodeIcon` reference, e.g. `lucide:Home`) swaps the plain dash segment for that icon riding the route instead — picked through `IconPicker`, the same dialog a block's icon field uses, so there's one icon-browsing experience in the app rather than a bespoke one. `edge-motion-icons.tsx` (`EdgeMotionIcons`) places it with CSS `offset-path`/`offset-distance` against the same `d`, at a **fixed 16px** — there's no size knob, unlike the rest of the sizing conventions on this page. It always renders upright (no `offset-rotate`), since a picked icon has no inherent "forward" direction to turn to. There is no catalog of built-in shapes (arrow, envelope, coin…) anymore — only an icon or the plain dash.

Six pattern/travelling effects that were near-indistinguishable single-path dash textures or literal duplicates of another effect at a different speed — `dash`/"Packets", `wave`, `traffic`, `spark` (a `dots` duplicate), `marching`, and `binary` — were removed outright rather than kept as filler or reworked; a two-layer redesign was tried for `marching`/`binary` first, but they were cut anyway once decided the effect list itself was better off smaller. `heartbeat` is the one survivor that got a real rework instead of removal: its dasharray (`[3, 3, 5, 20]`) is a "lub-dub…" timing rhythm rather than an evenly spaced dash — a dasharray can only shape *timing* along the existing path, not bend the path into an actual EKG spike.

`FlowEdge.lineStyle` (`solid` | `dashed` | `dotted`, unset = solid) is the **third** thing a line can carry, and it is not an effect: it's `stroke-dasharray` on the base path, scaled by line width (`edgeLineDash` / `edgeLineCap` in `edge-style.ts`, so a 1px and a 6px dotted line read as the same style). It exists because an effect's marks only exist while the diagram plays, and "dashed means async" has to hold in a screenshot too — so it holds in **every** run mode, including while a line draws itself in. That costs a mask: `.edge-power-draw` implements the draw-in reveal with `stroke-dasharray`, the same attribute the pattern needs, so `AnimatedEdge` moves the reveal onto a `<mask>` (`edge-draw-{id}`) whenever a drawing edge carries a pattern and leaves solid lines on the cheap single path. Dropping the pattern for the draw's duration instead is what used to make the control look dead everywhere but `static`: `concurrent` marks *every* edge `'active'` for the whole run, so there was no "after the draw" for the pattern to return in. The mask's region is derived from the endpoints padded by the route's own arc length — no point on a path can be further from an endpoint than that — rather than from a DOM bounding box, which is zero-height on a horizontal line.

### Named line styles (the document's line vocabulary)

`src/lib/edge-style.ts` is the whole feature. `DiagramSettings.edgeStyles` holds `EdgeStyleClass[]` — a named kind of line (`{ id, name, …EdgeStyleProps }`) — and `FlowEdge.styleRef` points at one. What makes a large diagram readable is how *few* kinds of line it has, so a class is that vocabulary made editable in one place: change the class, every line following it changes.

- **`EdgeStyleProps` is a `Pick` of `FlowEdge`**, and `EDGE_STYLE_FIELDS` is the same list at runtime (tied together with `satisfies`). Add a field to one and the other fails to compile. Deliberately excluded: anything about *this particular* line — endpoints, label text, bend points, replay order.
- **Precedence is `resolveNodeStyle`'s**: the line's own explicit field wins over its class, which wins over the built-in default. A class is a default set, not a lock. Assigning one (`assignEdgeStyle`) *clears* the line's own values for the fields the class defines — otherwise picking a class would appear to do nothing on a line that already carries an explicit colour — and detaching bakes the class's look back on so the line doesn't jump. Same for `removeEdgeStyle`: deleting a class must never silently restyle the diagram.
- **Resolution happens once, at the top of `FlowCanvas`** (`resolveDocumentStyles(rawDocument)`, shadowing the `document` prop). Everything downstream — paint, geometry, hit-testing, the viewer — therefore sees a plain `FlowEdge` and needs no knowledge of the palette. Don't re-resolve per consumer, and don't thread the palette down. Writes are unaffected: they go out by id and land on the store's raw document.
- **`EdgeInspector` is the exception that reads both**: it displays `resolveEdgeStyle(edge, styles)` (what the line actually paints) while writing to the line's own fields, and `edgeStyleOverrides` powers the amber "this line overrides …" notice plus its Reset. Without that notice an accidental override is invisible.
- `components/edge-style-fields.tsx` holds what the inspector and the palette dialog both need (`EDGE_EFFECTS`, `ROUTING_OPTIONS`, `LINE_STYLE_OPTIONS`, `MARKERS`, `MarkerPicker`, `EdgeStyleSample`). It exists to break the cycle — `EdgeInspector` opens `EdgeStylePaletteDialog`, so the dialog can't import from it.
- `editor/EdgeStylePaletteDialog.tsx` is mounted by `InspectorSidebar`, not by `EdgeInspector`, so it survives the line being deselected while it's open. An empty palette offers `STARTER_EDGE_STYLES` (primary / secondary / async / policy) rather than starting blank.

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

`type: 'logo'` was a dedicated brand-mark block (no icon by default until one is picked, a much larger icon ceiling than other nodes) and has been removed — the free `'icon'` object below covers the same need without a second node kind. `'logo'` stays in the `NodeType` union purely so a diagram saved before the removal still resolves a default shape/colour and renders (`DEFAULT_BY_TYPE`, `resolveNodeStyle`'s icon-size ceiling); nothing creates one any more, there's no dock button, and `BlockInspector` — which a stray `'logo'` node still falls into — only ever shows the plain `IconPicker`, never `LogoPicker`. A legacy logo node's `logo:` icon still renders (`FlowNodeCard`'s `logoSlug` check is generic, not type-gated) and its `iconSize` ceiling stays 256 so an already-large mark doesn't get clamped down the moment someone reopens the inspector; it just can't be re-picked from a brand catalog there any more — delete it and drop a fresh `'icon'` object instead.

### Groups (nested blocks)

A container is a node with `type: 'group'`; a member points at it with `parentId`. Membership lives on the child only — a frame never lists its contents — so there is a single field to keep consistent. `src/lib/node-tree.ts` owns every tree operation (`descendantIds`, `sortByTreeDepth`, `findDropTarget`, `groupGeometryFor`).

**Positions stay absolute.** A member's `position` is a canvas coordinate, never an offset from its frame; the store's `onNodeMove` applies the same delta to every descendant when a frame moves. That is what keeps edges, ports, SQL export and the viewer working without any knowledge of groups — don't switch to parent-relative coordinates.

- **Membership** is decided on drop, not while dragging: `onNodeDrop(id)` (called from `EditorCanvas`'s `onNodeDragEnd`, and after a resize) finds the deepest frame containing the node's centre. `findDropTarget` skips the dragged node's own descendants, so a frame can't become its own ancestor. A drop outside every frame clears `parentId`.
- **Paint order**: `FlowCanvas` renders `sortByTreeDepth(nodes)` instead of document order, so a frame always paints behind what it contains. The sort is stable, so same-depth nodes keep document order.
- **A frame is not a card, but it drags and resizes exactly like one**: `FlowNodeCard` branches on `isGroup` and draws a translucent wash instead of a solid fill, but that wash carries `pointerEvents='all'` just like a block's body, so grabbing anywhere inside the frame moves it — not just the border or title bar. This trades away the frame's earlier click-through-to-contents behaviour by design; an edge or node fully hidden under the wash with nothing else painted over it is easiest to reach from outside the frame's bounds instead. The four corner resize handles are the same `RESIZE_HANDLES` every block gets, with no group-specific branch. The title bar strip (`GROUP_HEADER_HEIGHT`) only paints when `node.title` is non-empty — an untitled frame skips it entirely rather than showing an empty tinted bar. Frames **do** render the same four ports as any other block (only text objects opt out), so an edge can point at the group as a whole — the top port sits directly over the title bar's centre, which is the one spot that hands a pointer-down to the port instead of the drag handle.
- **`computeOrderedGroups` filters frames out** of the replay — a container flashing as its own step would interrupt the run of the blocks inside it.
- **Delete takes the contents with it**; `ungroupNode` releases members (one level) and keeps the frame; `fitGroupToContents` shrink-wraps a frame via `groupGeometryFor`. `onNodeDuplicate` copies a frame's whole subtree plus the edges wholly inside it.
- **Size ceiling** comes from `nodeSizeLimits` (see below), not from a clamp written inline.
- Group headers honour their own `textAlign`, read off the **raw** field rather than the resolved one: unset resolves to `'center'` everywhere else.

### Free text

`type: 'text'` is a node that renders only words — no silhouette, fill, border, icon or ports. Its content is `title` (newlines preserved via `white-space: pre-wrap`); `description` is not rendered. `FlowNodeCard`'s text branch draws an invisible `<rect pointerEvents='all'>` as the hit area, because there is no painted body to click, plus a hairline that appears on hover so an empty label stays findable. Like frames, text is filtered out of `computeOrderedGroups` — a caption isn't a step.

`TextInspector` is its own panel rather than a stack of guards — see *Inspector panels* below.

**Text only gets the motion family of node effects.** Every decoration effect (`glow`/`pulse`/`ripple`/`trace`/`sheen`) traces `outline.d`, and a text node's outline defaults to a plain rectangle — rendering one on text would draw exactly the border a text object is defined not to have. `FlowNodeCard` skips mounting `<NodeEffectLayer>` for `isText` nodes (motion still applies, via the `<g style={motionStyle}>` wrapper), and `NodeEffectField` hides the whole Decoration group from the picker on a text node so the UI doesn't offer a choice that renders nothing.

### Free icon / logo objects

`type: 'icon'` is the graphic counterpart to free text: a single glyph or brand mark on the canvas with no silhouette, fill, border or ports, positioned and resized independently of any block — arm it from the dock's Icon tool (`Sticker` glyph, next to Text), which builds a square-ish box via `nodeSizeLimits`'s `ICON_OBJECT_*` constants (24–480, default 96×96). The glyph itself renders at `iconSize` (12–256, default 64 — the same large ceiling `resolveNodeStyle` gives the legacy logo type above), independent of that box, exactly like the old dedicated logo block's icon did.

Unlike the removed logo block, which fixed the picker to `LogoPicker` by node type, `IconInspector` lets the user flip between a generic icon and a brand logo on the *same* object — a local `Kind` toggle (seeded from whether the current `icon` value starts with `logo:`) swaps between `IconPicker` and `LogoPicker` underneath one `NodeInspector` panel, so there's one node kind rather than two. `FlowNodeCard` renders it with the same invisible-hit-rect-plus-hover-outline pattern as text (nothing painted otherwise), and it picks up the same exclusions text already has: no ports, filtered out of `computeOrderedGroups` (scenery, not a replay step), and only the motion family of node effects (no outline to trace decoration onto).

### Free line

`type: 'line'` is a straight stroke, not attached to any node — the free-standing counterpart to an edge. **It is a segment, not a box**: the user reshapes it by its two endpoints, each moving anywhere independently, and it never wears a block's dashed selection ring or four corner handles.

**The box is storage, not the interaction.** A line is still *placed* by the same `position`/`width`/`height` every other node has, so it inherits dragging as a whole, group membership, culling and the drop-target rules for free — the alternative, a second absolute point on the node, would have to be kept in sync by every mover (`onNodeMove`'s group delta, duplicate's offset, align/distribute) and one missed spot would tear a line in half. What turns that box back into a segment is `FlowNode.lineStart`: which **corner** the start endpoint sits on, the end taking the opposite corner.

`src/lib/line-geometry.ts` owns both directions of that conversion and nothing else may re-derive them: `endpointsOfLine`/`localEndpointsOfLine` (box → the two points the stroke, hit band, arrowheads and handles all share) and `lineGeometryFromEndpoints` (two points → box + corner). They are inverses, and drifting apart would show up as a line that jumps the moment an endpoint is touched.

**Four corner values, not a two-way flip.** Which end is the *start* is not cosmetic — it decides which endpoint wears `startMarker` and which wears `endMarker` — so dragging one end clean past the other must not silently swap the arrowheads. The earlier `lineFlip` boolean could only name the diagonal, which did exactly that; `lineCornerOf` still reads it as a fallback so documents saved before the change render unchanged.

- **Endpoint handles** (`FlowNodeCard`'s `LINE_ENDPOINTS`) replace `RESIZE_HANDLES` on a line, and report the raw pointer position through `onLineEndpointMove` rather than going through the corner-resize path: there is no opposite corner anchored and no minimum box to respect. `FlowCanvas.handleLineEndpointMove` snaps that point (so snap applies to the end the user is actually aiming) and converts back.
- **Selection paints on the stroke** — a wider translucent copy of the segment — since ringing the bounding box would draw exactly the frame the object is defined not to have.
- **Drawing** runs from where the pointer went down to where it came up, with no box minimum, so a dead-horizontal drag stays dead horizontal (`height: 0`); a click with no drag gets a default-length horizontal line. The corner the drag began at becomes `lineStart`, so the start end is the end the user started from.
- **`LineInspector` shows the two endpoints**, not the shared `GeometryFields` X/Y/W/H, plus **Swap ends** — which keeps the segment exactly where it is and only trades which end counts as the start, so the markers change places.
- `FlowNodeCard` draws an invisible 16px-wide hit band along the segment (a near-flat line's box can be a few pixels tall, far too thin to grab), the visible stroke through `edgeLineDash`/`edgeLineCap` off `borderStyle`, and the optional `startMarker`/`endMarker` (the same `EdgeMarkerSymbol` an edge uses) rotated to face outward.

Like text and free icons, a line has no ports, is filtered out of `computeOrderedGroups` (scenery, not a replay step) and `UNLAYOUTABLE` (auto-layout never moves one), and only picks up the motion family of node effects — no outline to trace a decoration effect onto.

### Mermaid import, auto-layout and starters

Three pieces that exist to shorten "idea → finished diagram", and they build on each other: the importer places what it parses by calling the layout, and each starter *is* a mermaid string the importer parses.

- **`src/lib/auto-layout.ts`** — `layoutDocument(doc, options)` is pure and returns a `Map<id, position>`; the caller decides whether to apply it. A cut-down Sugiyama: rank by longest path from a source, order each rank by barycentre over four sweeps, then space out. Cycles are handled by dropping the back edges a DFS finds — a cyclic flow still has to lay out, and refusing (or looping) is worse than one edge pointing up. `UNLAYOUTABLE` skips frames, text, icons and free lines. Direction is written once as an along/across axis pair rather than as two near-copies of the same code.
- **`src/lib/mermaid-import.ts`** — a hand-written parser for `flowchart`/`graph` and `erDiagram`. Not mermaid's own grammar: it covers a dozen chart types this editor can't represent, so the dependency would be large and mostly rejecting input. **Unrecognised lines become warnings, never an exception** — a 90%-understood paste is far more useful than an error, and the dialog shows what was dropped *before* the import replaces the canvas.
  - Flowchart statements are walked character by character rather than matched with one big regex, because a label can contain the same brackets and arrows the syntax uses (`A[a --> b]`). The inline-label link forms (`-- text -->`) are tried before the plain operators, and their label may not *start* with `-`/`>`/`=`/`.` — without that, `A --> B --> C` parses as a link labelled "> B".
  - `IMPORT_PAINT` carries the pale/deep pair a filled card wears, cycled per hue so a diagram isn't monotone.
- **`src/lib/starter-diagrams.ts`** — each starter is stored as its mermaid source and built through the importer on demand, so there is one description of it rather than a hand-built document beside it that drifts. Every starter therefore doubles as a worked example of what the importer accepts. These are **not** the template library: templates live in Firestore and an empty collection still yields an empty library. Starters ship with the app.

Whole-document **Tidy layout** is a File-menu command, next to the other document-wide actions; the selection-scoped one lives in `SelectionToolbar`. It is deliberately *not* on the canvas dock: that dock is left-anchored and the shape dock is centred on the same row, and at canvas widths under ~1000px the centred dock already overlaps the last ~35px of the left one.

### Node size limits

`nodeSizeLimits(node)` in `node-style.ts` is the single source for min/max/default width and height, keyed on node kind (group 120–4000, text 24–1600×1200, line up to 4000, table up to 420×900, ordinary card 72–320×240). `resolveNodeStyle`, `FlowNodeCard`'s drag-resize and `NodeInspector`'s number fields all read it — never re-derive a clamp locally, which is what previously left tables un-resizable past a card's 320×240 despite rendering much larger.

### Fit to content

Group frames fit to their *members* (`fitGroupToContents` / `groupGeometryFor`, above); blocks, text objects and free icon/logo objects fit to their own *content* instead — `src/lib/fit-to-content.ts`'s `fitBlockNodeSize` / `fitTextNodeSize` / `fitIconNodeSize`. The icon case is a pure formula (`iconSize + 16`, since the glyph renders at a fixed size independent of the box — see above). Text and block sizing can't be computed from stored data alone — there's no cheap way to know a string's rendered pixel width without asking the browser — so both mount a hidden, DOM-attached replica of exactly what `FlowNodeCard` renders (same Tailwind classes, same padding/gap formulas, `white-space: pre` so the user's own line breaks are respected but nothing auto-wraps), measure its natural size, then remove it. It has to be attached to `document.body`, not a detached node: the font families are `var(--font-…)` custom properties that only resolve inside the real page cascade.

A block's padding (`cardPadding` in `FlowNodeCard`) is itself derived from the node's *final* width/height — a self-reference `fitBlockNodeSize` breaks by using the unpadded content size as the stand-in, close enough for a one-click convenience action rather than an exactly-converged fixed point. `GeometryFields` (`fields.tsx`) takes an optional `onFitToContent` and renders the "Fit" button next to the Geometry hint text only when it's passed — `BlockInspector`/`TextInspector`/`IconInspector` wire it, `GroupInspector` doesn't (it has its own "Fit to contents" in the Contents section instead). `BlockInspector` omits it for a table node (`node.table`), since a table's height already tracks its column count on every edit. Both `BlockInspector` and `TextInspector` build the sized-for `FlowNode` from the *draft* title/description (`useNodeFieldDraft`'s `.value`), not the possibly-stale committed one, so fitting while a field still has focus reads what's actually on screen.

### Database tables (ERD)

An ER diagram is not a separate document type: a table is just a `FlowNode` carrying `table?: TableSpec` (`{ columns: TableColumn[], schema?: string }`), so ERD and flow blocks mix on one canvas and inherit saving, sharing, templates, and line effects for free.

- **Creating**: the dock's Table tool arms `activeShape = 'table'` (`DrawTool = NodeShape | 'table' | 'group' | 'text' | 'icon' | 'line'`); `onShapeCreate` builds a `rounded` card with `starterColumns()` and a height from `tableCardHeight(columnCount)`, not from the drag — a new table is never born with rows clipped.
- **Rendering**: `TableCardBody.tsx` draws the header (title + schema) and one row per column. Flags are shown the sparse way round: `U`, `IX`, and `NULL` — nullable is the exception, so `NOT NULL` gets no badge.
- **Clipping**: table content lives in a `<foreignObject>`, which is always a rectangle. `FlowNodeCard` clips it to the node's silhouette (`clipPath` from `outline.d`) **for table nodes only**, otherwise a `rounded` card shows square corners poking past its outline.
- **Editing**: `TableColumnsEditor.tsx` (rendered by `NodeInspector`) writes straight through to the document, and every column write recomputes `height: tableCardHeight(next.length)`. It also offers "Convert to database table" on a node without `table`.
- **Relationships**: lines attach table-to-table like any other edge — there are no field-level anchors. `FlowEdge.fromColumn`/`toColumn` are metadata used for the label and for SQL FK emission. Cardinality uses the crow's-foot markers in `edge-marker.tsx` (`crow-one`, `crow-many`, `crow-one-many`, `crow-zero-one`, `crow-zero-many`), which follow the file's convention of "tip at the origin, body running towards −x". `EdgeInspector` only overwrites a relationship label it generated itself, and keeps it short (`id → user_id`) so it doesn't overflow into neighbouring tables.
- **Export**: `src/lib/sql-export.ts`'s `buildCreateTableSql(document)` emits `CREATE TABLE` + `CREATE INDEX` + `ALTER TABLE … ADD FOREIGN KEY`, surfaced by `editor/SqlExportDialog.tsx` from the File menu's `afterExport` slot. Data types are free text so the output suits whatever dialect the user had in mind. `resolveForeignKey` picks the child side from the column flags (explicit `foreignKey` wins, else the end pointing at a primary key is the parent), so which direction the user drew the line doesn't matter. Export only — there is no SQL import.

### Execution simulation (the "replay" animation)

`computeOrderedGroups()` groups nodes by resolved `sortOrder` — nodes sharing an order animate simultaneously as one step, not strictly one-by-one — and already filters out group frames, text objects and free icon/logo and line objects (see below), so anything reading "which nodes are active" must go through it rather than `doc.nodes` directly. `runMode` (`doc.settings.runMode`) is `sequential` (auto-advances on a timer, `EDGE_DRAW_DURATION_MS`/`NODE_FADE_DURATION_MS` from `src/lib/execution-timing.ts`), `concurrent` (everything active at once — `use-execution-playback.ts`'s `active` array is `orderedGroups.flat()`, not `doc.nodes.map(...)`; the latter was a real bug that gave every frame and text object a permanent blinking halo in concurrent mode, since `FlowNodeCard` renders that halo for any `isActive` node regardless of type), `manual` (user-driven), or `static`. The sequential timer and the manual "Next" button both call the store's single `advanceStep()`, so the two modes can't drift out of sync.

**`static` is not "concurrent with the highlight off."** It freezes every animation on the canvas, not just the replay: `active` is `[]`, `nodeExecutionStates` is `undefined` (renders `'normal'` everywhere), `edgeExecutionStates` stamps every edge `'normal'` (not `'active'`, which would still trigger the draw-in class), and — the part that's easy to miss — `runningEdgeIds` is `[]` rather than `null`. `null` means "every edge animates" (concurrent's reading); an empty array means "no edge is in the running set," which is the exact same mechanism sequential/manual already use to pause every edge except the current step's, so it pauses all of them.

A node's own opt-in `effect` (motion or decoration) doesn't stop on its own from any of that — `FlowCanvas`/`EditorShell`/`DiagramViewer` also compute `effectsPaused = runMode === 'static'` and thread it through `FlowNodeCard` into `nodeMotionStyle()`/`<NodeEffectLayer>`, which set `animationPlayState: 'paused'` rather than unmounting, so a paused node still renders at whatever pose the animation stopped on instead of snapping back to rest.

**Edges do the opposite of nodes here on purpose.** A first attempt paused edge effects the same way (freeze mid-animation), but a travelling-object mark — a short dash the same colour as the line, `comet`/`dots`/etc. — reads as barely distinguishable from the plain line once it stops moving; frozen, the diagram looked broken rather than intentional. So `effectsPaused` also reaches `AnimatedEdge` as `flattenEffect`, which forces `effect` to `'none'` for the duration — every line renders as a plain connector (`EdgeEffectLayer`'s existing `effect === 'none'` early return handles it, no separate code path), not a frozen one. `RunControls` hides Next/Repeat/Replay entirely in `static` — there's no run cursor for any of them to act on.

### Inspector panels

`components/inspector/NodeInspector.tsx` is a dispatcher, not a panel: it renders `BlockInspector`, `TextInspector`, `GroupInspector`, `IconInspector` or `LineInspector` based on `node.type`. The five kinds paint genuinely different things — a block has a body, a text object has only words, a frame has a wash and a title bar, a free icon/logo object has only a glyph, a line has only a stroke — so each panel lists only the controls that do something for that kind. Don't add a `node.type === …` guard inside a panel; put the control in the panel it belongs to.

- **`BlockInspector`** — everything with a painted body (process/start/decision/output cards, database tables, and any legacy `type: 'logo'` node): title + sub title, geometry, sort order, typography, shape, the paired colour fields, border/shadow, icon, all three alignment rows, and the table section.
- **`TextInspector`** — the text itself (a Textarea, since newlines are content), geometry, typography, a single foreground colour field, opacity and text alignment. No sort order: the replay skips text, so an execution position would do nothing.
- **`GroupInspector`** — title, a **Contents** block (member count + Fit to contents / Ungroup), geometry, typography, wash/border colour fields, opacity. No shadow (the frame branch paints none) and no sort order.
- **`LineInspector`** — the two endpoints (not `GeometryFields`: a line is a segment, its box is storage) plus Swap ends, stroke colour/width/style, start/end `MarkerPicker`s, opacity. No title, no typography, no sort order: the replay skips it.
- **`IconInspector`** — geometry, an Icon/Logo kind toggle plus the matching picker, icon/logo size, a tint colour field (icon mode only — a logo paints its own colour), opacity. No title, no typography, no sort order: same reasoning as text, nothing renders a title and the replay skips it.

`components/inspector/fields.tsx` holds everything shared: the field primitives (`NumberField`, `RangeField`, `SelectField`, `SegmentedButtons`, `ColorField`, `ShapeThumb`), the colour palette (`COLOR_PRESETS`), the composed sections used by more than one panel (`GeometryFields`, `TypographyFields`, `FillField`, `TextAlignField`, `GroupMembershipSection`, `ActionsSection`, `InspectorShell`), and `useNodeFieldDraft`.

**Colour is per-field, not a separate preset step.** Every `ColorField` (Text/icon · Border, Background, Wash, Text colour, Effect colour) is a complete picker on its own: a row of the ten `COLOR_PRESETS` dots for quick picks, a native `<input type="color">`, and a hex box that free-types any value — `parseHex` accepts `#abc`, `#aabbcc`, `#aabbccdd` with or without the leading `#`, and reverts to the field's current value on anything else. There used to be a `ColorPresetGrid` above the fields that set foreground + background + border together from one 30-swatch grid; it's gone; each field now sets only what it owns, and a picker beats a two-step preset-then-tweak flow.

`useNodeFieldDraft` is the reason edits aren't lost: clicking away deselects the node, which unmounts the panel *before* the input's blur fires, so commit-on-blur alone drops the last keystrokes. The hook mirrors the draft into a ref and flushes it from the unmount cleanup.

### UI primitives and shared conventions

`src/components/ui/*` are shadcn components (`components.json`, style `base-nova`) built on **`@base-ui/react`, not Radix**. Base UI has sharper structural requirements:

- `DropdownMenuLabel` must sit inside a `DropdownMenuGroup` or it throws at runtime (`MenuGroupContext is missing`).
- `AlertDialogAction` and similar action buttons do **not** auto-close their dialog when given a custom `onClick` — the handler must call `setOpen(false)` itself (see `ResetCanvasDialog` and the delete confirmation in the diagrams list).
- A `Button` rendered as something other than a native button (e.g. `render={<Link …/>}`) needs `nativeButton={false}`, or Base UI logs "A component that acts as a button expected a native `<button>`".

Prefer extending an existing `components/ui` primitive over a raw `<dialog>` or hand-rolled popover, and prefer these shared pieces over restyling per-surface:

- `Button` variants `toolbar` (frosted header/toolbar control, theme-aware — see below) and `accent` (cyan call-to-action: New diagram, Copy link, Sign in) — added on top of the stock shadcn variants.
- `Input` variant `toolbar`, matching the `toolbar` button.
- `src/components/data-table.tsx` — `DataTable`, `DataTableFooter`, `SortHeaderButton`, `formatDateTime`, `formatNumber`, shared by the diagrams list and both admin tables (TanStack Table).

### Light/dark theme

`next-themes` is wired up for real: `ThemeProvider` (`src/components/theme-provider.tsx`, `attribute="class"`, `defaultTheme="system"`) wraps the app in `layout.tsx`, and `ThemeToggle` (`src/components/theme-toggle.tsx`) is mounted in every top-level chrome surface (editor/viewer header, `DiagramsHome`, `AdminShell`, `LoginForm`, `/help`, `/guide`). Its "wait for mount" guard goes through `useSyncExternalStore` rather than a `useState`+`useEffect` pair — this repo's React Compiler lint rule flags a bare `setState` inside an effect, and `useSyncExternalStore` is the pattern already used elsewhere (`icon-library.ts`, `IconPicker.tsx`) for "resolve after hydration."

Every hand-built surface reads colour through the shadcn semantic tokens already defined in `globals.css` (`:root` for light, `.dark` for dark) — `bg-background`/`text-foreground` for page-level surfaces, `bg-card`/`bg-popover` for panels and dropdowns, `text-muted-foreground` for secondary text, `border-border`/`ring-border` for hairlines, `bg-accent`/`text-accent-foreground` for hover and resting pill surfaces. **Never hardcode `zinc-*`, a literal `white/`\-alpha, or `black/`\-alpha for chrome** — every one of those was a dark-only assumption that broke light mode when this was audited; token classes carry the correct value in both themes automatically. The one place that needed a real new token rather than a straight token swap is the `toolbar` Button/Input variant: it's a deliberately frosted-glass control floating over the canvas, so it reads `--toolbar-bg`/`--toolbar-border` (defined in both `:root` and `.dark` in `globals.css`) instead of a semantic surface token.

A recurring contrast bug the same audit surfaced: a light accent shade (`cyan-100`/`-200`, `emerald-200`, `rose-200`/`-300`, …) painted directly as text or an icon colour — on a translucent tinted chip (`bg-cyan-400/15`) or a plain card/popover — is illegible once that surface can be light instead of dark. The fix is a dual-toned class, e.g. `text-cyan-700 dark:text-cyan-200`, not a single dark-tuned value; apply this whenever you add a new accent-coloured label or icon, not just chrome greys. `LogoPicker.tsx`'s logo-preview tiles are a deliberate exception — a neutral dark backdrop for arbitrary-coloured brand marks needs to stay consistent regardless of app theme, so those specific tiles keep a literal dark fill.

Colour that's diagram **content** — a saved node's `color`/`backgroundColor`/`borderColor`, `node-style.ts`'s type-based `COLORS` defaults, `edge-label-style.ts`'s `EDGE_LABEL_PRESETS` — is never touched by the theme and must not be: each node/label paints its own opaque fill, so it already reads fine on either canvas background, and a document has to render identically regardless of the viewer's app theme. The one place colour *does* follow the theme is what a picker **offers** for a fresh pick: `inspector/fields.tsx`'s `useColorPresets()` returns `DARK_COLOR_PRESETS` or `LIGHT_COLOR_PRESETS` (same 10 hues, inverted pairing — pale foreground/deep background for dark, deep foreground/pale background for light) based on `next-themes`'s `resolvedTheme`, so a newly-applied preset reads well on whichever canvas the user is actually looking at.

### Responsive header and toolbar

The editor/viewer header (`EditorShell.tsx`'s `<header>`, and `DiagramViewer.tsx`'s own copy of the same layout) is `flex flex-wrap` rather than a fixed single row — on a narrow viewport the right-hand cluster (run-mode picker, Next/Repeat/Replay, Help, `headerEnd`) drops to its own line(s) instead of clipping or forcing horizontal scroll on the page. Within that cluster, `RunControls` (`editor/PlaybackControls.tsx`) hides its button labels behind Tailwind breakpoints and falls back to icon-only + `title` tooltip: the four run-mode buttons keep only their icon below `lg`, and Next/Repeat/Replay/Help keep only their icon below `sm`. This is shared by the viewer for free since `DiagramViewer` renders the same `RunControls` component. The branding title ("X Flow Tool") hides below `md` since the diagram name in `subtitle` already carries the identity at that width.

Three places used to spell out "which tools aren't a plain silhouette" as a chain of `!==` comparisons that had to be kept in sync by hand; `node-style.ts`'s `isShapeTool` / `drawToolPreviewShape` are now the one list. Add a tool there, not to the chains.

`ShapeToolbar.tsx`'s floating shape dock is a fixed-width row of ~10 controls that doesn't wrap (wrapping would break its "one settled row centered on the canvas" look). Instead it's capped to `max-w-[calc(100vw-1rem)]` with `overflow-x-auto` and the scrollbar hidden (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`), so on a phone-width canvas the dock scrolls horizontally within itself instead of overflowing past the screen edge.

### Firebase

`src/lib/firebase/client.ts` initializes the app from `NEXT_PUBLIC_FIREBASE_*` env vars (see `.env.example`) and throws immediately if a required var is missing — there's no silent-degrade path. `auth.ts`, `diagrams.ts`, `templates.ts` and `roles.ts` are the only modules that talk to Firebase; everything else goes through them. `firestore.rules` is the source of truth for access and is deployed separately (`firebase deploy --only firestore:rules`) — a change to a collection's shape usually needs a matching rules change.

## Verifying UI work

There's no test runner, so visual changes are checked by hand: run `npm run dev` with placeholder Firebase env vars, add a temporary page under `src/app/` that renders the component with fixture data, drive it with Playwright (Chromium is available at `/opt/pw-browsers`) — screenshots plus `page.evaluate` to read computed styles, which is how several "looks fine, is actually dead" bugs were caught. **Delete the temporary page before committing**, then run `npx tsc --noEmit -p .`, `npm run lint`, and a production build.
