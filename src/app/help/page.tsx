import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpShell, Kbd, Pill, Section, Table } from './ui';

export const metadata: Metadata = {
  title: 'User guide — X Flow Tool',
  description: 'How to sign in, create and edit diagrams, run the flow animation, save your work and share diagrams in X Flow Tool.',
};

const TOC = [
  ['start', 'Getting started'],
  ['create', 'Creating a diagram'],
  ['canvas', 'Working on the canvas'],
  ['inspect', 'Editing nodes & edges'],
  ['run', 'Running the flow'],
  ['save', 'Saving your work'],
  ['share', 'Sharing a diagram'],
  ['json', 'Export & JSON tools'],
  ['reference', 'Quick reference'],
] as const;

export default function HelpPage() {
  return (
    <HelpShell
      title='User guide'
      tagline='Everything you need to create, animate and share flow diagrams'
      languageSwitch={{ href: '/help/vi', label: 'Tiếng Việt' }}
      authoringGuideLabel='Authoring guide'
      backLabel='Back to diagrams'
      toc={TOC}
    >
      <p className='max-w-2xl text-sm leading-relaxed text-zinc-400'>
        X Flow Tool is a browser-based editor for animated flow diagrams — system architectures, business processes, CI/CD pipelines. This page walks through the day-to-day workflow. If you
        want the rules for authoring diagram JSON by hand (or with an AI), see the <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>diagram authoring guide</Link>{' '}
        instead.
      </p>

      <Section id='start' title='1. Getting started'>
        <p>
          Sign in with your <strong>Google account</strong> or an <strong>email + password</strong>. Every diagram you create belongs to your account and is stored in the cloud — no one else
          can open or edit it unless you explicitly make it public.
        </p>
        <p>
          After signing in you land on the <strong>diagrams list</strong>: a table of everything you own, with node/edge counts, visibility, and created/updated timestamps. From here you can:
        </p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>Click a diagram&apos;s name to open it in the editor.</li>
          <li>Search the list by name or id, sort any column, and page through large collections.</li>
          <li>
            Use the <Pill>⋯</Pill> menu at the end of each row for <strong>Edit</strong>, <strong>View</strong> (read-only viewer in a new tab), <strong>Share</strong> (public diagrams only)
            and <strong>Delete</strong>.
          </li>
        </ul>
      </Section>

      <Section id='create' title='2. Creating a diagram'>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>New diagram</strong> — starts from a blank canvas.
          </li>
          <li>
            <strong>New from template</strong> — starts from a ready-made diagram (HRM, CRM, software architecture, e-commerce, CI/CD…). Templates are fully editable after loading: move and
            resize blocks, change shapes, reconnect nodes, restyle connectors.
          </li>
        </ul>
        <p>
          Both buttons live on the diagrams list; inside the editor the same commands are under the <strong>File</strong> menu. To rename a diagram, click its name in the editor header, type
          the new name, and press <Kbd>Enter</Kbd> (or <Kbd>Esc</Kbd> to cancel).
        </p>
      </Section>

      <Section id='canvas' title='3. Working on the canvas'>
        <p>
          <strong>Add a block:</strong> pick a shape from the dock at the bottom of the canvas — either one of the quick-draw buttons (rectangle, rounded, pill, diamond) or the full shape grid
          behind the dropdown (hexagon, cylinder, cloud, document, star, and more). The cursor becomes a crosshair; click-drag on the canvas to draw the block at the size you want. The tool
          disarms after each draw, so re-pick a shape for the next block. Press <Kbd>Esc</Kbd> to cancel an armed tool.
        </p>
        <p>
          <strong>Move &amp; resize:</strong> drag a block to move it. Select it first to reveal the four corner handles, then drag a handle to resize.
        </p>
        <p>
          <strong>Connect blocks:</strong> hover a block to reveal its connection ports, then drag from a port onto another block. A ghost preview of the connector follows your pointer, and
          the target&apos;s input port pulses when the drop will connect. You can also drag an existing connector&apos;s endpoint to re-attach it to a different block.
        </p>
        <p>
          <strong>Shape a connector&apos;s path:</strong> double-click anywhere on a selected line to drop a <em>bend point</em> there, drag bend points to route the line around other blocks,
          and double-click a bend handle to remove it again.
        </p>
        <p>
          <strong>Navigate:</strong> drag empty canvas to pan (middle-mouse drag works anywhere), scroll to zoom, and use the view dock for <em>Zoom in / Zoom out / Fit diagram to view</em>.
          The grid controls next to it toggle snapping and grid size.
        </p>
      </Section>

      <Section id='inspect' title='4. Editing nodes & edges'>
        <p>
          Clicking a block or a connector opens the <strong>inspector</strong> on the right — all styling happens there.
        </p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>Block inspector:</strong> title and description, shape, color palette or custom colors, icon (searchable picker with the full Lucide and Tabler catalogs), size, font,
            rotation, connection sides (which side edges enter and leave), and execution order. It also has <strong>Duplicate</strong> and <strong>Delete</strong> buttons.
          </li>
          <li>
            <strong>Connector inspector:</strong> label, animated effect (comet, dots, pulse, wave, scanner, binary and a dozen more), routing style (straight, curved, orthogonal,
            smooth-step), direction (forward / reverse / both), start and end markers (arrowheads), line width, effect object size and animation speed — plus <strong>Delete</strong>.
          </li>
        </ul>
        <p>
          Tip: diagrams read best when they use one shape family and a small, consistent color palette. The <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>authoring guide</Link>{' '}
          has the full set of visual conventions the built-in templates follow.
        </p>
      </Section>

      <Section id='run' title='5. Running the flow'>
        <p>
          Every diagram can be <em>played</em>: blocks light up and connectors draw themselves in execution order, which is great for walking an audience through a process step by step. The
          playback cluster sits in the editor header:
        </p>
        <Table
          head={['Control', 'What it does']}
          rows={[
            ['Sequential', 'Steps auto-advance on a timer, one execution step at a time. Blocks that share the same execution order animate together as one step (parallel branches).'],
            ['Concurrent', 'Everything animates at once — useful to see the whole system alive.'],
            ['Manual', 'Nothing advances until you click Next — you drive each step yourself, ideal for presentations.'],
            ['Next', 'Manual mode only: run the next execution step.'],
            ['Repeat', 'Sequential mode only: automatically restart the run after it completes.'],
            ['Replay', 'Restart the animation from the beginning in any mode.'],
          ]}
        />
        <p>
          The order in which blocks animate comes from each block&apos;s <strong>execution order</strong> (set it in the block inspector). Blocks with the same number run in the same step —
          use that deliberately to show things happening in parallel.
        </p>
      </Section>

      <Section id='save' title='6. Saving your work'>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>Save</strong> (header button) writes the diagram to the cloud. An amber dot on the button means you have unsaved changes.
          </li>
          <li>
            <strong>Session autosave:</strong> in-progress edits are also kept locally in your browser, so an accidental refresh or closed tab does not lose work — the editor restores exactly
            where you left off. This is a safety net, not cloud storage: click <strong>Save</strong> to persist for real.
          </li>
          <li>
            <strong>File → Save as</strong> duplicates the current document into a brand-new diagram (&quot;… copy&quot;) and opens it.
          </li>
          <li>
            <strong>File → Reset</strong> throws away all unsaved changes and reverts the canvas to the last loaded state. It asks for confirmation — this cannot be undone.
          </li>
        </ul>
      </Section>

      <Section id='share' title='7. Sharing a diagram'>
        <p>Diagrams are <strong>private</strong> by default — only you (and administrators) can open them. To share one:</p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            In the editor header, click the <strong>Private / Public</strong> toggle to make the diagram public, then save.
          </li>
          <li>
            Open <strong>File → Share</strong> (or the <strong>Share</strong> row action on the diagrams list) and copy the link. The link opens a <strong>read-only viewer</strong> — visitors
            can watch the animation but never edit, and making a diagram public never grants edit access to anyone.
          </li>
          <li>Flip the toggle back to <strong>Private</strong> at any time to revoke the link.</li>
        </ul>
      </Section>

      <Section id='json' title='8. Export & JSON tools'>
        <p>
          A diagram is a single JSON document under the hood. <strong>File → Export to JSON</strong> downloads it as a <Pill>.json</Pill> file — useful for backups, version control, or
          hand-editing.
        </p>
        <p>
          The <strong>Info</strong> toggle on the canvas dock opens a side panel with the document summary, a live JSON view that updates as you edit, and a JSON playground for applying a
          pasted document to the canvas. The exact schema, field-by-field, is documented in the <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>authoring guide</Link>.
        </p>
      </Section>

      <Section id='reference' title='9. Quick reference'>
        <Table
          head={['Action', 'How']}
          rows={[
            ['Add a block', 'Pick a shape in the bottom dock, then click-drag on the canvas'],
            ['Cancel the armed shape tool', 'Esc, or click the active tool again'],
            ['Connect two blocks', 'Drag from a port on one block onto another block'],
            ['Reroute a connector', 'Select it, then double-click the line to add a bend point; drag bend points; double-click a bend point to remove it'],
            ['Edit a block / connector', 'Click it — the inspector opens on the right'],
            ['Duplicate or delete', 'Buttons at the top of the inspector'],
            ['Pan the canvas', 'Drag empty canvas (or middle-mouse drag anywhere)'],
            ['Zoom', 'Scroll, or the Zoom in / Zoom out / Fit buttons in the view dock'],
            ['Rename the diagram', 'Click its name in the header, type, press Enter'],
            ['Save to the cloud', 'Save button in the header (amber dot = unsaved changes)'],
            ['Play the animation', 'Replay — pick Sequential, Concurrent or Manual first'],
            ['Share read-only', 'Set the diagram to Public, then File → Share → Copy'],
          ]}
        />
      </Section>
    </HelpShell>
  );
}
