import type { Metadata } from 'next';
import Link from 'next/link';
import { Boxes } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Diagram authoring guide — X Flow Tool',
  description: 'The rules and conventions an AI or developer must follow to author a valid, well-formed FlowDocumentJSON diagram.',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className='scroll-mt-20 border-t border-white/5 py-8 first:border-t-0 first:pt-0'>
      <h2 className='text-lg font-semibold text-zinc-100'>{title}</h2>
      <div className='mt-3 space-y-4 text-sm leading-relaxed text-zinc-400'>{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return <pre className='overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-cyan-100 ring-1 ring-white/10'>{children}</pre>;
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className='overflow-x-auto rounded-lg ring-1 ring-white/10'>
      <table className='w-full border-collapse text-xs'>
        <thead>
          <tr className='bg-white/5 text-left text-zinc-300'>
            {head.map((h) => (
              <th key={h} className='px-3 py-2 font-semibold'>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className='border-t border-white/5'>
              {row.map((cell, j) => (
                <td key={j} className={['px-3 py-2 align-top', j === 0 ? 'font-mono text-cyan-200' : 'text-zinc-400'].join(' ')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return <code className='rounded bg-white/8 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200'>{children}</code>;
}

const TOC = [
  ['schema', 'Document schema'],
  ['nodes', 'Node rules'],
  ['edges', 'Edge rules'],
  ['execution', 'Execution order'],
  ['tables', 'Database tables'],
  ['groups', 'Groups (nested blocks)'],
  ['text', 'Free text'],
  ['style', 'Visual conventions'],
  ['example', 'Worked example'],
  ['checklist', 'Checklist'],
] as const;

export default function GuidePage() {
  return (
    <div className='min-h-screen bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <Boxes size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>Diagram authoring guide</h1>
            <p className='text-xs text-zinc-500'>Rules for producing a valid FlowDocumentJSON — for humans and AI agents alike</p>
          </div>
        </div>
        <Link href='/' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-white/5 px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10'>
          Back to diagrams
        </Link>
      </header>

      <div className='mx-auto flex max-w-5xl gap-10 px-6 py-10'>
        <nav className='sticky top-10 hidden h-fit w-48 shrink-0 flex-col gap-1 text-xs md:flex'>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className='rounded-md px-2 py-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200'>
              {label}
            </a>
          ))}
        </nav>

        <main className='min-w-0 flex-1'>
          <p className='max-w-2xl text-sm leading-relaxed text-zinc-400'>
            A diagram in this app is one JSON value, <Pill>FlowDocumentJSON</Pill> (defined in <Pill>src/lib/flowchart-types.ts</Pill>). This page is the single source of truth for what makes a
            diagram <em>valid</em> and what makes it <em>read well</em> — follow it when generating or editing a diagram document, whether by hand or by an AI assistant such as Claude Code.
          </p>

          <Section id='schema' title='1. Document schema'>
            <p>
              The whole document is exactly three top-level fields. Nothing else is read by the app — extra fields are silently ignored, so don&apos;t invent new ones.
            </p>
            <Code>{`{
  "nodes": FlowNode[],
  "edges": FlowEdge[],
  "settings"?: { "runMode"?: "sequential" | "concurrent" | "manual", "repeatEnabled"?: boolean }
}`}</Code>
            <p>
              <Pill>settings</Pill> is optional and only affects the play bar (the replay animation) — omit it unless you specifically want to control the default run mode.
            </p>
          </Section>

          <Section id='nodes' title='2. Node rules'>
            <p>Every node needs at minimum an <Pill>id</Pill>, <Pill>type</Pill>, <Pill>title</Pill>, and a <Pill>position</Pill> (the node&apos;s center, in canvas coordinates):</p>
            <Code>{`{ "id": "svc-auth", "type": "process", "title": "Auth Service", "position": { "x": 630, "y": 210 } }`}</Code>
            <p>
              <Pill>id</Pill> must be unique within the document — edges reference nodes by id, so a typo or duplicate silently breaks the connection. Everything else on a node is optional and
              falls back to a default derived from <Pill>type</Pill>:
            </p>
            <Table
              head={['type', 'default shape', 'default color', 'default icon', 'when to use']}
              rows={[
                ['start', 'circle', 'sky', 'flag', 'The entry point(s) of the flow — request origin, trigger, user action.'],
                ['process', 'circle', 'indigo', 'cog', 'Any regular step — a service, a job, a transformation. The default, most common type.'],
                ['decision', 'hexagon', 'amber', 'play', 'A branch point. Outgoing edges should carry a label ("yes"/"no", a condition) to say which branch is which.'],
                ['output', 'circle', 'emerald', 'bell', 'A terminal step — a result, a notification, a completed state.'],
              ]}
            />
            <p>
              <Pill>shape</Pill> can be overridden to any of the ~35 values in <Pill>NodeShape</Pill> — common ones for system diagrams: <Pill>rounded</Pill> (generic block),{' '}
              <Pill>database</Pill>, <Pill>server</Pill>, <Pill>cloud</Pill>, <Pill>queue</Pill>, <Pill>component</Pill> (UML component), <Pill>document</Pill>, <Pill>diamond</Pill> (decision),{' '}
              <Pill>folder</Pill>. Full list is in <Pill>src/lib/flowchart-types.ts</Pill> (<Pill>NodeShape</Pill>) / <Pill>src/lib/node-style.ts</Pill> (<Pill>SHAPES</Pill>).
            </p>
            <p>
              <Pill>color</Pill> is either a palette name (<Pill>NodeColor</Pill> — <Pill>red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple pink coral brown rose</Pill>
              ) or a literal <Pill>#hex</Pill>. Palette names drive a themed gradient body automatically; a hex value is used as-is for text/icon/border. <Pill>backgroundColor</Pill> (hex only)
              overrides the fill independently of <Pill>color</Pill>.
            </p>
            <p>
              <Pill>icon</Pill> accepts a short legacy name (<Pill>cog play flag bell mail database cloud code send sparkles</Pill>) or, for the full catalog,{' '}
              <Pill>lucide:&lt;PascalCaseName&gt;</Pill> / <Pill>tabler:&lt;kebab-name&gt;</Pill> (e.g. <Pill>lucide:webhook</Pill>, <Pill>tabler:world</Pill>). Set it to <Pill>null</Pill> explicitly to
              hide the icon — omitting the field uses the type default instead.
            </p>
            <p>
              Sizing: <Pill>width</Pill>/<Pill>height</Pill> default to 112×112 and are clamped to 72–320 × 72–240. <Pill>connectionPoints</Pill> (<Pill>{`{ input, output }`}</Pill>, each{' '}
              <Pill>top | right | bottom | left</Pill>) pins where edges attach — for a left-to-right flow, set <Pill>{`{ input: 'left', output: 'right' }`}</Pill> on every node so connectors read
              consistently.
            </p>
            <p>
              <Pill>fill</Pill> chooses how the body is painted: <Pill>&quot;flat&quot;</Pill> is the plain <Pill>backgroundColor</Pill>, <Pill>&quot;sheen&quot;</Pill> lays a soft top-to-bottom
              gradient over it. Omitting the field means <Pill>&quot;sheen&quot;</Pill>, so documents written before it existed are unchanged; the editor stamps <Pill>&quot;flat&quot;</Pill> on
              newly drawn blocks. Pick one and stay with it across a diagram — mixing the two reads as an accident.
            </p>
            <p>
              <Pill>shadow</Pill> (<Pill>none | soft | glow</Pill>) casts a plain dark drop shadow for depth — it adds no colour. Every coloured halo comes from <Pill>effect</Pill>, so the two
              never fight over the same look.
            </p>
            <p>
              <strong className='text-zinc-300'>Effects are opt-in.</strong> Omit <Pill>effect</Pill> (or set <Pill>&quot;none&quot;</Pill>) and the node is completely static — no motion, no halo,
              nothing painted. That is the default for every kind of node, exactly as <Pill>effect: &quot;none&quot;</Pill> is for a line. Pick one when the node genuinely needs attention, not as
              decoration on every block.
            </p>
            <Table
              head={['effect', 'family', 'what it does']}
              rows={[
                ['float · breathe · bounce · wobble · shake', 'motion', 'The node itself animates — drifts, scales, hops, rocks or jitters.'],
                ['blink', 'motion', 'Fades out and back on a loop.'],
                ['glow · pulse', 'decoration', 'A halo around the outline: steady, or swelling in and out.'],
                ['ripple', 'decoration', 'Rings radiating outwards from the outline.'],
                ['trace', 'decoration', 'Dashes marching around the border.'],
                ['sheen', 'decoration', 'A band of light sweeping across the body.'],
              ]}
            />
            <p>
              Three shared knobs, all optional: <Pill>effectSpeed</Pill> and <Pill>effectIntensity</Pill> (0.25–3, default 1 — cycle rate and how far it travels or how bright it burns) and{' '}
              <Pill>effectColor</Pill> (hex; unset follows the node&apos;s <Pill>color</Pill>). They mean the same thing for every effect.
            </p>
            <Code>{`{ "id": "alert", "type": "process", "title": "Rate limiter",
  "position": { "x": 300, "y": 200 },
  "effect": "pulse", "effectColor": "#f43f5e", "effectIntensity": 1.6 }`}</Code>
          </Section>

          <Section id='edges' title='3. Edge rules'>
            <p>Every edge needs <Pill>id</Pill>, <Pill>from</Pill>, and <Pill>to</Pill> (both must match real node ids):</p>
            <Code>{`{ "id": "e-auth-db", "from": "svc-auth", "to": "db-users", "label": "reads", "effect": "comet" }`}</Code>
            <Table
              head={['field', 'values', 'notes']}
              rows={[
                ['label', 'string', 'Use it for decision branches ("yes"/"no") or to name the data/action flowing across the edge ("sync", "candidates").'],
                [
                  'effect',
                  'flow · dash · pulse · glow · comet · dots · wave · scanner · traffic · bidirectional · laser · meteor · spark · marching · binary · heartbeat · rail · fade · convoy · chase · charging · morse · ants · blink',
                  'The animated overlay. Templates default to `flow` for routine links and reach for `comet`/`pulse`/`dots`/`wave`/`scanner`/`traffic` to draw attention to a specific hop.',
                ],
                ['routing', 'straight · smooth-step · orthogonal · curved', 'Optional — the canvas picks a sane default. `orthogonal` reads best for dense system diagrams.'],
                ['direction', 'forward · reverse · both', 'Defaults to forward. `both` animates the effect in both directions without changing logical from/to.'],
                ['startMarker / endMarker', 'none · arrow · open-arrow · triangle · circle · diamond · tee · cross · circle-cross · arrow-both · arrow-bar · bar', 'Arrowheads at each end, independently configurable.'],
                ['width / effectSize / animationSpeed', 'number', 'Line width, animated-object scale multiplier, and playback speed (0.25×–3×). Keep these consistent across a diagram — see §5.'],
                ['effectCount', '1 – 8', 'Exact number of objects travelling the line for the travelling-object effects (pulse, comet, dots, laser…). Omit for automatic spacing (longer lines carry more objects). Pattern effects (flow, dash, wave…) tile the line and ignore it.'],
                [
                  'effectShape',
                  'arrow · chevron · plane · bolt · envelope · box · coin · dot · ring · square · diamond · star',
                  'Replaces the travelling effect\u2019s dash objects with a real silhouette riding the route (an arrow for control flow, an envelope for messages, a coin for payments\u2026). Arrows/chevrons/planes/bolts turn to follow the line; the rest stay upright. Travelling effects only.',
                ],
                ['effectDensity', '0.5 – 2', 'Mark density for the pattern effects (flow, dash, wave…): higher = more, smaller marks at the same apparent speed. Travelling-object effects ignore it — use effectCount there.'],
                ['glowIntensity', '0 – 3', 'Strength of the neon halo around the moving objects. Omit for no halo at all — the editor puts 1 on newly drawn lines, so a glow is always a deliberate choice.'],
                ['glowColor', '#hex · auto', 'Halo colour. Omit for white (the classic neon look); \u2018auto\u2019 follows the travelling object\u2019s own colour.'],
                ['phaseOffset', '0 – 1', "Starts the animation partway through its cycle (fraction of one loop), so parallel connectors don't run in lockstep."],
              ]}
            />
          </Section>

          <Section id='execution' title='4. Execution order (the play bar)'>
            <p>
              The play bar animates nodes/edges in steps driven by <Pill>sortOrder</Pill> on each node (defaults to document order when omitted or 0). Nodes that share the same{' '}
              <Pill>sortOrder</Pill> animate <em>simultaneously</em>, as one step — use this deliberately to show parallel branches (e.g. two services processed in tandem) rather than assigning every
              node a unique, strictly increasing number.
            </p>
            <p>Only set <Pill>sortOrder</Pill> when the natural left-to-right / top-to-bottom reading order of the diagram doesn&apos;t already match the intended execution order — otherwise omit it.</p>
          </Section>

          <Section id='tables' title='5. Database tables (ERD)'>
            <p>
              A node with a <Pill>table</Pill> field renders as a database table — a name header plus one row per column — instead of the icon + title card. Everything else about the node
              (shape, colours, ports, dragging) is unchanged, so ERD tables and flow blocks live in the same document.
            </p>
            <Code>{`{
  "id": "orders", "type": "process", "title": "orders",
  "position": { "x": 470, "y": 170 }, "shape": "rounded", "icon": null,
  "table": {
    "schema": "public",
    "columns": [
      { "id": "c1", "name": "id",      "dataType": "bigserial",   "primaryKey": true },
      { "id": "c2", "name": "user_id", "dataType": "uuid",        "foreignKey": true, "index": true },
      { "id": "c3", "name": "status",  "dataType": "varchar(24)", "index": true },
      { "id": "c4", "name": "note",    "dataType": "text",        "nullable": true }
    ]
  }
}`}</Code>
            <Table
              head={['column field', 'values', 'notes']}
              rows={[
                ['name / dataType', 'string', 'Data types are free text and are emitted verbatim on SQL export, so any dialect works: uuid, varchar(255), timestamptz…'],
                ['primaryKey / foreignKey', 'boolean', 'Drawn as the PK / FK badge on the row. Primary keys are NOT NULL by definition, so they don’t also carry a null flag.'],
                ['unique / index', 'boolean', 'Rendered as the U / IX flags; on export they become UNIQUE and a CREATE INDEX statement.'],
                ['nullable', 'boolean', 'Columns are NOT NULL unless this is true — the card flags the exceptions with NULL rather than stamping NN on every other row.'],
                ['defaultValue', 'string', 'Emitted as DEFAULT … on export. Written raw, so `now()` stays a function call rather than a string.'],
              ]}
            />
            <p>
              Set <Pill>height</Pill> from the column count (header 34px + 24px per row + 8px padding) so no row is clipped; the editor does this for you on every column change. Tables may be
              up to 420 × 900, well past the 320 × 240 ceiling that still applies to ordinary nodes.
            </p>
            <p>
              Relationships are ordinary edges between two table nodes, plus <Pill>fromColumn</Pill> / <Pill>toColumn</Pill> naming the joined columns. Those drive the line&apos;s label and the{' '}
              <Pill>FOREIGN KEY</Pill> statements on SQL export — the direction you draw in does <em>not</em> decide which side holds the key, the column flags do. Use the crow&apos;s foot
              markers (<Pill>crow-one</Pill>, <Pill>crow-many</Pill>, <Pill>crow-one-many</Pill>, <Pill>crow-zero-one</Pill>, <Pill>crow-zero-many</Pill>) at each end for cardinality.
            </p>
            <Code>{`{ "id": "r1", "from": "users", "to": "orders",
  "fromColumn": "id", "toColumn": "user_id", "label": "id → user_id",
  "routing": "orthogonal", "startMarker": "crow-one", "endMarker": "crow-many" }`}</Code>
          </Section>

          <Section id='groups' title='6. Groups (blocks nested inside a block)'>
            <p>
              A container is a node with <Pill>type: &quot;group&quot;</Pill>; a block joins it by pointing at it with <Pill>parentId</Pill>. Membership is stored on the child only — a frame never
              lists what it holds — so there is one field to keep consistent, and frames may be nested to any depth.
            </p>
            <Code>{`{ "id": "svc", "type": "group", "title": "Ingest subsystem",
  "position": { "x": 320, "y": 250 }, "width": 460, "height": 320,
  "shape": "rounded", "icon": null, "borderStyle": "dashed" }

{ "id": "queue", "type": "process", "title": "Queue",
  "position": { "x": 420, "y": 250 }, "parentId": "svc" }`}</Code>
            <p>
              <strong className='text-zinc-300'>Positions stay absolute.</strong> A member&apos;s <Pill>position</Pill> is a canvas coordinate, never an offset from its frame — moving a frame
              rewrites every descendant&apos;s position by the same delta. So when you author by hand, place a frame so its box actually encloses the members you gave it; nothing recomputes that
              for you.
            </p>
            <Table
              head={['behaviour', 'rule']}
              rows={[
                ['Membership', 'A drag or resize ends by testing the node’s centre against every frame; the deepest frame containing it wins, and a centre outside every frame clears parentId.'],
                ['Moving', 'Moving a frame moves all of its descendants. Moving a member moves only itself, and may take it out of the frame.'],
                ['Deleting', 'Deleting a frame deletes what it holds. Ungroup first to keep the members.'],
                ['Replay', 'Frames are skipped by the play bar — a container is not a step — so they stay visible for the whole run and need no sortOrder.'],
                ['Ports', 'Frames have none: lines connect blocks, not containers.'],
                ['Size', 'Up to 4000 × 4000, versus 320 × 240 for an ordinary node.'],
              ]}
            />
            <p>
              Never point <Pill>parentId</Pill> at a node that is not a frame, and never build a cycle (a frame inside its own descendant). The editor refuses both; a hand-written document that
              breaks them will still render, because every tree walk is bounded, but the nesting will not mean what you intended.
            </p>
          </Section>

          <Section id='text' title='7. Free text'>
            <p>
              A node with <Pill>type: &quot;text&quot;</Pill> is words on the canvas: no silhouette, no fill, no border, no ports. Its whole content is <Pill>title</Pill>, and newlines in that
              string are preserved, so a caption is a single node rather than a stack of them. <Pill>description</Pill> is not rendered — put everything in the title.
            </p>
            <Code>{`{ "id": "note1", "type": "text",
  "title": "Retry 3× then dead-letter\nSLA: 5 minutes",
  "position": { "x": 690, "y": 380 }, "width": 300, "height": 80,
  "icon": null, "color": "#a5b4fc", "fontSize": 13, "textAlign": "left" }`}</Code>
            <p>
              Only the typography fields apply: <Pill>fontSize</Pill>, <Pill>fontFamily</Pill>, <Pill>fontWeight</Pill>, <Pill>textAlign</Pill>, <Pill>color</Pill> (the text colour) and{' '}
              <Pill>opacity</Pill>. Setting <Pill>backgroundColor</Pill>, <Pill>borderWidth</Pill>, <Pill>shadow</Pill>, <Pill>shape</Pill> or an <Pill>icon</Pill> on a text node has no effect —
              use a real shape node if you want a box. Sizes run from 24 × 24 up to 1600 × 1200; the box only bounds where the text wraps, it is never painted.
            </p>
            <p>
              Like a group frame, a text object is skipped by the play bar, so a caption stays readable for the whole run and does not need a <Pill>sortOrder</Pill>. Text nodes can sit inside a
              group frame (<Pill>parentId</Pill>) and travel with it like any other member.
            </p>
            <p>
              <Pill>effect</Pill> only accepts the motion family (<Pill>float</Pill>, <Pill>breathe</Pill>, <Pill>bounce</Pill>, <Pill>wobble</Pill>, <Pill>shake</Pill>, <Pill>blink</Pill>) on a
              text node — the words themselves move. The decoration family (<Pill>glow</Pill>, <Pill>pulse</Pill>, <Pill>ripple</Pill>, <Pill>trace</Pill>, <Pill>sheen</Pill>) traces a node&apos;s
              outline, and text has none, so setting one is a no-op: nothing renders.
            </p>
          </Section>

          <Section id='style' title='8. Visual conventions (so a diagram reads as one system, not a shape showcase)'>
            <p>
              Templates in the shared Firestore library should keep almost everything consistent except position, title, description, and theme color. Follow the same discipline:
            </p>
            <ul className='list-disc space-y-1.5 pl-5'>
              <li>
                Pick <strong>one shape</strong> for the whole diagram — normally <Pill>rounded</Pill> — and only deviate for a semantically distinct node type (e.g. <Pill>diamond</Pill> for a
                decision, <Pill>database</Pill> for a datastore). Don&apos;t use a different shape per node just for variety.
              </li>
              <li>
                Pick a <strong>small palette</strong> (3–6 colors) and assign color by <em>layer or domain</em> (e.g. blue = client-facing, violet = integration, green = ops, amber = decision/risk,
                rose = data), not per-node at random.
              </li>
              <li>
                Use a consistent node size for body content — templates use <Pill>{`width: 174, height: 84`}</Pill> with <Pill>{`iconPosition: 'left'`}</Pill>, <Pill>{`fontSize: 12`}</Pill>,{' '}
                <Pill>{`textAlign: 'left'`}</Pill> for a label+icon &quot;card&quot; look, which reads better than the 112×112 icon-centric default once a diagram has more than ~5 nodes.
              </li>
              <li>
                Space nodes on a loose grid: ~260–280px between columns, ~110–160px between rows in the same column. Cramped nodes make edges overlap and effects unreadable.
              </li>
              <li>
                Keep edges visually uniform: <Pill>width: 1</Pill>, <Pill>effectSize: 1.5</Pill>, <Pill>animationSpeed: 0.9</Pill> is the template baseline — deviate only to intentionally emphasize
                one critical path.
              </li>
              <li>Give every node a short <Pill>description</Pill> (3–5 words) — it renders under the title and is what makes a diagram self-explanatory without the JSON.</li>
            </ul>
          </Section>

          <Section id='example' title='9. Worked example'>
            <p>A minimal three-node flow, following every rule above:</p>
            <Code>{`{
  "nodes": [
    { "id": "client", "type": "start", "title": "Client", "description": "Browser request",
      "position": { "x": 90, "y": 200 }, "width": 174, "height": 84, "shape": "rounded",
      "color": "#dbeafe", "backgroundColor": "#082f49", "borderColor": "#dbeafe",
      "icon": "lucide:user", "iconPosition": "left", "fontSize": 12, "textAlign": "left",
      "connectionPoints": { "input": "left", "output": "right" } },
    { "id": "server", "type": "process", "title": "API Server", "description": "Auth & routing",
      "position": { "x": 360, "y": 200 }, "width": 174, "height": 84, "shape": "rounded",
      "color": "#d1fae5", "backgroundColor": "#022c22", "borderColor": "#d1fae5",
      "icon": "server", "iconPosition": "left", "fontSize": 12, "textAlign": "left",
      "connectionPoints": { "input": "left", "output": "right" } },
    { "id": "db", "type": "output", "title": "Database", "description": "Postgres primary",
      "position": { "x": 630, "y": 200 }, "width": 174, "height": 84, "shape": "database",
      "color": "#fef3c7", "backgroundColor": "#451a03", "borderColor": "#fef3c7",
      "icon": "database", "iconPosition": "left", "fontSize": 12, "textAlign": "left",
      "connectionPoints": { "input": "left", "output": "right" } }
  ],
  "edges": [
    { "id": "e1", "from": "client", "to": "server", "label": "HTTPS", "effect": "flow", "width": 1, "effectSize": 1.5, "animationSpeed": 0.9 },
    { "id": "e2", "from": "server", "to": "db", "label": "SQL", "effect": "pulse", "width": 1, "effectSize": 1.5, "animationSpeed": 0.9 }
  ]
}`}</Code>
            <p>
              For richer, real-world references, open the shared templates from Firestore in the template admin.
            </p>
          </Section>

          <Section id='checklist' title='10. Checklist before shipping a diagram'>
            <ul className='list-disc space-y-1.5 pl-5'>
              <li>Every node id is unique; every edge&apos;s <Pill>from</Pill>/<Pill>to</Pill> matches a real node id.</li>
              <li>One shape family, one small color palette, mapped to meaning (layer/domain/status) — not decoration.</li>
              <li>Every node has a short <Pill>description</Pill>.</li>
              <li>Consistent <Pill>connectionPoints</Pill> matching the diagram&apos;s overall direction (left→right or top→bottom).</li>
              <li>Consistent edge <Pill>width</Pill>/<Pill>effectSize</Pill>/<Pill>animationSpeed</Pill>, with <Pill>effect</Pill> varied only to draw attention to specific hops.</li>
              <li>Decision nodes (<Pill>{`type: "decision"`}</Pill>) have labeled outgoing edges for each branch.</li>
              <li><Pill>sortOrder</Pill> only set where it changes the natural reading order, and shared across nodes that should animate in parallel.</li>
              <li>No stray top-level fields outside <Pill>nodes</Pill> / <Pill>edges</Pill> / <Pill>settings</Pill>.</li>
            </ul>
          </Section>
        </main>
      </div>
    </div>
  );
}
