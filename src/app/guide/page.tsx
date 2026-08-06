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
                  'flow · dash · pulse · glow · comet · dots · wave · scanner · traffic · bidirectional · laser · meteor · spark · marching · binary · heartbeat · rail · fade',
                  'The animated overlay. Templates default to `flow` for routine links and reach for `comet`/`pulse`/`dots`/`wave`/`scanner`/`traffic` to draw attention to a specific hop.',
                ],
                ['routing', 'straight · smooth-step · orthogonal · curved', 'Optional — the canvas picks a sane default. `orthogonal` reads best for dense system diagrams.'],
                ['direction', 'forward · reverse · both', 'Defaults to forward. `both` animates the effect in both directions without changing logical from/to.'],
                ['startMarker / endMarker', 'none · arrow · open-arrow · triangle · circle · diamond · tee · cross · circle-cross · arrow-both · arrow-bar · bar', 'Arrowheads at each end, independently configurable.'],
                ['width / effectSize / animationSpeed', 'number', 'Line width, animated-object scale multiplier, and playback speed (0.25×–3×). Keep these consistent across a diagram — see §5.'],
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

          <Section id='style' title='5. Visual conventions (so a diagram reads as one system, not a shape showcase)'>
            <p>
              Every shipped template (<Pill>src/lib/diagram-templates.ts</Pill>) builds nodes through one local factory that fixes almost everything except position, title, description, and theme
              color. Follow the same discipline:
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

          <Section id='example' title='6. Worked example'>
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
              For richer, real-world references, read the full generated documents in <Pill>src/lib/diagram-templates.ts</Pill> (HRM, CRM, software architecture, e-commerce, CI/CD) and the default
              boot document in <Pill>src/lib/flowchart-data.ts</Pill>.
            </p>
          </Section>

          <Section id='checklist' title='7. Checklist before shipping a diagram'>
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
