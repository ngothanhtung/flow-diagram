# X Flow Tool

A browser-based editor for animated diagrams — system architectures, business processes and database schemas — that can be presented step by step and shared read-only.

## Diagrams

**Diagram**:
One user's saved drawing: its elements, the lines between them and its settings.
_Avoid_: Document, flow, flowchart, canvas

**Diagram JSON**:
The single-file text form of a Diagram, used for export, paste-in and hand- or AI-authoring.
_Avoid_: FlowDocumentJSON (in product writing), document file

**Public diagram**:
A Diagram its owner has opened to anyone holding the link, read-only.
_Avoid_: Published diagram, mirror

**Share**:
Handing out the read-only link to a Public diagram.

**Viewer**:
The read-only screen a Public diagram opens in; no sign-in required.

**Template**:
A ready-made Diagram an administrator publishes to the shared library, used as a starting point.
_Avoid_: Sample, example

**Starter**:
A ready-made Diagram that ships with the app itself, independent of the Template library.
_Avoid_: Sample, example, built-in template

## Accounts

**Access list**:
The email domains and individual addresses allowed to sign in to a deployment; empty means anyone may.
_Avoid_: Whitelist, allowlist, domain restriction

## Elements

**Element**:
Anything placed on a Diagram's canvas other than a Line.
_Avoid_: Node, object, shape

**Block**:
An Element with a painted body — a process, start, decision or output card.
_Avoid_: Node, card, box

**Table**:
A Block that carries a column list and renders as a database table.
_Avoid_: Entity, ERD node

**Frame**:
An Element that visually contains other Elements; moving it moves its contents.
_Avoid_: Group (as a noun), container

**Text**:
An Element that is only words — no body, border or ports.
_Avoid_: Label, caption, text object

**Icon**:
An Element that is only a glyph or brand logo — no body, border or ports.
_Avoid_: Logo block, sticker, icon object

**Free line**:
A straight stroke Element attached to nothing, shaped by its two endpoints.
_Avoid_: Line (unqualified), divider

## Lines

**Line**:
A connection drawn from one Element to another.
_Avoid_: Edge, connector, arrow

**Line style**:
A named kind of Line (e.g. "primary", "async") defined once per Diagram; changing it restyles every Line that follows it.
_Avoid_: Edge style class, theme

**Stroke pattern**:
Whether a Line or Free line is drawn solid, dashed or dotted.
_Avoid_: Line style, dash style

**Effect**:
An optional animation on a Line (travelling marks or a moving pattern) or on a Block (motion or decoration).
_Avoid_: Animation (unqualified)

**Effect mark**:
One of the dots, dashes or icons that travel along a Line while its Effect plays.
_Avoid_: Object, particle

## Replay

**Replay**:
The animation that walks through a Diagram step by step to present it.
_Avoid_: Execution, simulation, play, run

**Step**:
The set of Elements sharing one position in the Replay order; they light up together.
_Avoid_: Execution order, stage

**Run mode**:
How the Replay advances — sequential (timed), concurrent (all at once), manual (user clicks Next) or static (everything still).
_Avoid_: Execution mode
