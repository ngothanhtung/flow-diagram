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
  ['database', 'Database diagrams'],
  ['groups', 'Grouping blocks'],
  ['run', 'Running the flow'],
  ['save', 'Saving your work'],
  ['share', 'Sharing a diagram'],
  ['json', 'Export, images & JSON tools'],
  ['shortcuts', 'Keyboard shortcuts & copy/paste'],
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
      <p className='max-w-2xl text-sm leading-relaxed text-muted-foreground'>
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
          Forgot your password? Click <strong>Forgot password?</strong> on the sign-in form, enter your email and press <strong>Send reset link</strong>. If the email has an account you&apos;ll
          receive a link to choose a new password — for privacy the form shows the same message either way, so check your inbox (and spam folder). If you sign in with Google you don&apos;t
          need a password at all — just use <strong>Continue with Google</strong>.
        </p>
        <p>
          Your workspace may be limited to an <strong>Access list</strong> — your company&apos;s email domains plus a few named addresses. If your email isn&apos;t on it you&apos;ll see{' '}
          <em>&ldquo;This email isn&apos;t allowed to use X Flow Tool. Contact your administrator.&rdquo;</em> — ask your administrator to add you, or press <strong>Sign out</strong> and use
          your work account. When a list is in place, an email + password account must also <strong>verify its email</strong>: after signing up you&apos;ll see{' '}
          <strong>Check your inbox</strong>. Open the link in the verification email, then press <strong>I&apos;ve verified</strong> (or reload the page) — no need to sign out. No email?
          Check spam, then press <strong>Resend verification email</strong>. Google accounts are already verified. Public links open for anyone, list or not.
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
          <strong>Add free text:</strong> the <strong>T</strong> button at the end of the dock drops plain text on the canvas — no box, no border, no ports, just words. Use it for headings,
          captions and annotations. Draw it the same way (click-drag sets the text area, a plain click gives a default box), then type into the <strong>Text</strong> field in the inspector;
          press Enter there for a second line. Size, font, weight, colour and alignment are the usual typography controls. Text is scenery rather than a step, so the play bar leaves it
          visible for the whole run.
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
          <strong>Auto-layout:</strong> <strong>File → Auto-layout, top to bottom</strong> (or <strong>left to right</strong>) rearranges the whole diagram in one step: each block lands
          below (or right of) what feeds it, straight chains line up, lines are re-routed and get new connection ports so none runs through a block, and each frame is arranged inside and
          shrunk to fit. Select two or more elements (or one frame) first and the same command — also on the two layout buttons at the right of the selection toolbar — arranges only those,
          in place. Text, icons and free lines never move, and neither does a frame that contains any of them. A message confirms the change; its <strong>Undo</strong> button, or{' '}
          <Kbd>⌘Z</Kbd> / <Kbd>Ctrl+Z</Kbd>, puts everything back in one step.
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
            <strong>Block inspector:</strong> title and description, shape, colour (every field — text/border, background — is its own picker: ten preset dots for a quick pick, plus a native
            colour wheel and a hex box so any colour is one click away, no separate preset step needed), icon (searchable picker with the full Lucide and Tabler catalogs), size, font,
            rotation, connection sides (which side edges enter and leave), and execution order. It also has <strong>Duplicate</strong> and <strong>Delete</strong> buttons.
          </li>
          <li>
            <strong>Fill:</strong> <strong>Flat colour</strong> paints the background as one solid tone; <strong>Gradient sheen</strong> lays a soft top-to-bottom sheen over it. New blocks and
            frames start flat. The same choice is on the group frame&apos;s wash. <strong>Shadow</strong> next to it casts plain depth only — every coloured glow comes from the Effect picker, so a
            block with the effect set to <em>None</em> is completely inert: nothing moves, nothing glows.
          </li>
          <li>
            <strong>Block effect:</strong> blocks, frames and text all start completely static — no glow, no movement. The <strong>Effect</strong> picker works exactly like the one for
            connectors: open it and choose from <em>motion</em> effects, where the block itself moves (float, breathe, bounce, wobble, shake, blink), or <em>decoration</em> effects, where
            something extra is painted around it (glow, pulse, ripple, trace, sheen). A live preview shows the choice before you apply it, and <strong>Speed</strong>, <strong>Intensity</strong>{' '}
            and <strong>Effect colour</strong> tune it. Use it to make one block stand out — if everything pulses, nothing does. Free text has no border to trace or halo to paint, so its picker
            only offers the motion effects — the words themselves drift, breathe or blink, nothing is drawn around them.
          </li>
          <li>
            <strong>Connector inspector:</strong> label, animated effect (comet, dots, pulse, wave, scanner, binary and a dozen more), routing style (straight, curved, orthogonal,
            smooth-step), direction (forward / reverse / both), start and end markers (arrowheads), line width, effect object size, the shape of the objects riding the line (arrow, envelope, coin and more), the number of them, pattern density, glow strength and colour, phase offset, and animation speed — plus <strong>Delete</strong>.
          </li>
        </ul>
        <p>
          Tip: diagrams read best when they use one shape family and a small, consistent color palette. The <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>authoring guide</Link>{' '}
          has the full set of visual conventions the shared Firestore templates follow.
        </p>
      </Section>

      <Section id='database' title='5. Database diagrams (ERD)'>
        <p>
          The same canvas draws entity-relationship diagrams. The <strong>Table</strong> button at the right of the shape dock draws a database table instead of a plain block: click-drag and
          you get a card with a starter <Pill>id</Pill> / <Pill>name</Pill> / <Pill>created_at</Pill> column list. An existing block can become one via <strong>Convert to database table</strong>
          in its inspector, and a table can drop back to a plain block the same way.
        </p>
        <p>
          Select a table and the inspector shows a <strong>Columns</strong> section: name, data type (free text, with a dropdown of common types, so any database works), the{' '}
          <strong>PK · FK · U · IX · NULL</strong> toggles, a default value, and reorder / delete buttons. The card grows and shrinks with the list, so no row is ever cut off. The optional{' '}
          <strong>schema</strong> field prints next to the table name.
        </p>
        <p>
          <strong>Relationships</strong> are ordinary connectors between two tables. Select one and the inspector adds a Relationship block where you pick the column at each end — that fills in
          the line&apos;s label (<Pill>id → user_id</Pill>) and drives the foreign keys on export. <strong>One-to-many ends</strong> sets crow&apos;s foot markers on both ends in one click; the
          full set (one, many, one-or-many, zero-or-one, zero-or-many) is in the Line start / Line end pickers.
        </p>
        <p>
          <strong>File → Export SQL</strong> turns the whole diagram into a <Pill>CREATE TABLE</Pill> script — columns with NOT NULL / DEFAULT / UNIQUE, primary keys, indexes, and foreign keys
          as ALTER TABLE — ready to copy or download as a <Pill>.sql</Pill> file. Data types come out exactly as you typed them. To start from something
          complete, an administrator can import the ready-made <strong>Database Schema</strong> document from <Pill>seed/templates/</Pill> in the repository — it then shows up in{' '}
          <strong>New from template</strong> for everyone.
        </p>
      </Section>

      <Section id='groups' title='6. Grouping blocks (blocks inside a block)'>
        <p>
          The <strong>Group</strong> button at the far right of the shape dock draws a <em>frame</em> — a container other blocks live inside, for a subsystem, a swimlane, a bounded context.
          Click-drag a frame anywhere; if you draw it around blocks that are already there, they join it immediately.
        </p>
        <Table
          head={['To do this', 'Do that']}
          rows={[
            ['Put a block in a frame', 'Drag it so it drops inside the frame. It joins whichever frame its centre lands in.'],
            ['Take a block out', 'Drag it out of the frame — dropping it on empty canvas releases it. Or use Remove from group in its inspector.'],
            ['Move a whole subsystem', 'Drag the frame by its title bar or its border: everything inside travels with it, at the same relative spacing.'],
            ['Resize a frame', 'Select it and drag a corner handle, or use Fit to contents in the inspector to shrink-wrap it around what it holds.'],
            ['Nest frames', 'Drop a frame into another frame. Nesting goes as deep as you like; a frame can never end up inside itself.'],
            ['Break a group up', 'Ungroup in the inspector releases every block but keeps the empty frame. Deleting the frame deletes what is inside it.'],
          ]}
        />
        <p>
          A frame is a container, not a step: it is skipped by the play bar and stays visible for the whole run, and it carries no connection ports — draw your lines between blocks. Its middle
          is click-through too, so blocks and lines inside a frame stay selectable; grab the title bar or the dashed border when you want the frame itself.
        </p>
      </Section>

      <Section id='run' title='7. Running the flow'>
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
            ['Static', 'No run at all. Every block and connector renders at rest — no highlighting, and any line or block effect the diagram has configured is frozen too. For a diagram meant to be read as a plain reference chart, not walked through.'],
            ['Next', 'Manual mode only: run the next execution step.'],
            ['Repeat', 'Sequential mode only: automatically restart the run after it completes.'],
            ['Replay', 'Sequential, Concurrent or Manual: restart the animation from the beginning. Static has no run to restart, so Next / Repeat / Replay all disappear when it is selected.'],
          ]}
        />
        <p>
          The order in which blocks animate comes from each block&apos;s <strong>execution order</strong> (set it in the block inspector). Blocks with the same number run in the same step —
          use that deliberately to show things happening in parallel.
        </p>
      </Section>

      <Section id='save' title='8. Saving your work'>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>Save</strong> (header button) writes the diagram to the cloud. An amber dot on the button means you have unsaved changes.
          </li>
          <li>
            <strong>Session autosave:</strong> in-progress edits are also kept locally in your browser, so an accidental refresh or closed tab does not lose work — the editor restores exactly
            where you left off. This is a safety net, not cloud storage: click <strong>Save</strong> to persist for real.
          </li>
          <li>
            <strong>Undo / Redo</strong> (the two arrow buttons next to the File menu) step back and forward through your changes to the diagram — moving, resizing, restyling, deleting,
            grouping, picking a template or starter, importing, Reset. A whole drag, one slider drag or one edit of a field counts as a single step, and the last 100 steps are kept. Selecting,
            panning and zooming, the run mode, the diagram name and Public/Private are not undo steps. Saving keeps the history; opening another diagram or reloading the page clears it.
          </li>
          <li>
            <strong>File → Save as</strong> duplicates the current document into a brand-new diagram (&quot;… copy&quot;) and opens it.
          </li>
          <li>
            <strong>File → Reset</strong> throws away all unsaved changes and reverts the canvas to the last loaded state. It asks for confirmation; if you change your mind afterwards,{' '}
            <strong>Undo</strong> brings the changes back.
          </li>
        </ul>
        <h3 id='versions' className='scroll-mt-20 pt-2 text-sm font-semibold text-foreground'>Version history</h3>
        <p>
          Every <strong>Save</strong> also keeps a <strong>version</strong> — the diagram exactly as it was at that moment, with who saved it and when. Nothing you have saved is overwritten for good.
          Open the list with <strong>History</strong> in the editor header (newest first).
        </p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>Preview</strong> opens a version read-only, with its own play bar so you can Replay it. The diagram you are editing does not change.
          </li>
          <li>
            <strong>Restore</strong> puts that version on the canvas as an <strong>unsaved change</strong> (amber dot). <strong>Undo</strong> (⌘Z) takes you straight back to what you had;{' '}
            <strong>Save</strong> makes it the main copy and adds a new version — the one you restored stays in the list.
          </li>
          <li>
            <strong>Name</strong> a version (e.g. &quot;Sent to client&quot;) to find it again later; <strong>Rename</strong> or remove the name at any time. Named versions are highlighted and
            are <strong>never removed automatically</strong>.
          </li>
          <li>
            <strong>Save as a new diagram</strong> (the copy icon on a row, or the button in Preview) copies that version into a new diagram of your own; the original is untouched. Use{' '}
            <strong>Open</strong> on the confirmation to go to it.
          </li>
          <li>
            The <strong>50 most recent unnamed versions</strong> are kept; older unnamed ones are removed when you save. Deleting a diagram deletes its whole history.
          </li>
          <li>
            The header shows <strong>Last saved by … at …</strong>, and the diagrams list shows the same in its <strong>Last saved</strong> column.
          </li>
        </ul>
      </Section>

      <Section id='share' title='9. Sharing a diagram'>
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

      <Section id='json' title='10. Export, images & JSON tools'>
        <p>
          A diagram is a single JSON document under the hood. <strong>File → Export to JSON</strong> downloads it as a <Pill>.json</Pill> file — useful for backups, version control, or
          hand-editing.
        </p>
        <p>
          <strong>File → Export image…</strong> downloads a picture for slides, documents and tickets: <Pill>PNG</Pill> at twice the diagram&apos;s size (sharp on any screen) or{' '}
          <Pill>SVG</Pill> (a scalable vector file with its fonts and logos built in). The picture is cropped to the diagram with a small margin — it always contains the whole diagram,
          including anything scrolled out of view — and never shows the grid. With Elements selected you can export <strong>Selection only</strong>: those Elements (with everything
          inside a selected Frame) and the Lines between them. The background is your current theme&apos;s canvas colour, or <strong>Transparent</strong>. The image is always a still
          picture, as Static run mode shows it: effects and the replay highlight are left out, while line patterns, markers, labels and line styles are kept — so exporting in the
          middle of a replay gives the same image. The file is named after the diagram. The read-only viewer has the same export behind its <strong>Image</strong> button, no
          sign-in needed. An empty diagram has nothing to export, so the command is greyed out.
        </p>
        <p>
          The <strong>Info</strong> toggle on the canvas dock opens a side panel with the document summary, a live JSON view that updates as you edit, and a JSON playground for applying a
          pasted document to the canvas. The exact schema, field-by-field, is documented in the <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>authoring guide</Link>.
        </p>
      </Section>

      <Section id='shortcuts' title='11. Keyboard shortcuts & copy/paste'>
        <p>
          The editor (and the template editor) has the shortcuts you know from other drawing tools. Use <Kbd>⌘</Kbd> on macOS and <Kbd>Ctrl</Kbd> on Windows and Linux. Press{' '}
          <Kbd>?</Kbd> on the canvas to see this list in the app — the tooltips on the Undo, Redo and Save buttons show the keys too.
        </p>
        <Table
          head={['Keys', 'What it does']}
          rows={[
            ['Delete / Backspace', 'Delete everything selected — all selected Elements (a Frame with its contents), or the selected Line'],
            ['⌘C / ⌘X / ⌘V', 'Copy / cut / paste the selection'],
            ['⌘D', 'Duplicate the selection'],
            ['⌘A', 'Select all Elements'],
            ['⌘Z', 'Undo'],
            ['⌘⇧Z (or Ctrl+Y on Windows/Linux)', 'Redo'],
            ['⌘S', 'Save (in the template editor: save the template)'],
            ['← ↑ → ↓', 'Nudge the selection 1 px'],
            ['⇧ + arrow', 'Nudge 10 px — or exactly one grid cell when snap is on'],
            ['Esc', 'Deselect, or put away the armed drawing tool'],
            ['?', 'Show the keyboard shortcuts'],
          ]}
        />
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            While you are typing in a field — a title, the inspector, the JSON playground — keys keep their usual meaning there: <Kbd>Backspace</Kbd> deletes a character, not the Element,
            and <Kbd>⌘Z</Kbd> undoes your typing. <Kbd>⌘S</Kbd> is the exception: it saves from anywhere, including what you just typed.
          </li>
          <li>
            Holding an arrow key moves the selection continuously, and one <Kbd>⌘Z</Kbd> takes the whole move back. Delete, duplicate and paste are one undo step each, however many
            Elements they touch.
          </li>
          <li>The read-only viewer has no shortcuts.</li>
        </ul>
        <p>
          <strong>Copy and paste</strong> carry part of a diagram: the selected Elements (a Frame always brings everything inside it), the Lines whose <em>both</em> ends are in the selection
          — a Line leading out of the selection is left behind — and the Line styles those Lines use. You can paste into the same diagram, into another diagram, in another tab, or into the
          template editor. Pasted Elements get new ids and become the selection; pasted into the same diagram they land slightly down-right of the originals, and pasting again steps further
          so copies never sit exactly on top of each other. A Line style the target diagram doesn&apos;t have is added to it, so the pasted Lines look exactly as they did; if the target already
          has a different style with the same name, the pasted one is renamed (e.g. &quot;async (2)&quot;).
        </p>
        <p>
          What you copy is plain Diagram JSON, so you can also go the other way: paste Diagram JSON written by hand or by an AI — a whole document or just{' '}
          <Pill>{'{ "nodes": [...], "edges": [...] }'}</Pill> — straight onto the canvas, and it is <em>added</em> to what is already there (the JSON playground replaces the canvas
          instead). Text that isn&apos;t valid Diagram JSON shows a short message and changes nothing.
        </p>
      </Section>

      <Section id='reference' title='12. Quick reference'>
        <Table
          head={['Action', 'How']}
          rows={[
            ['Add a block', 'Pick a shape in the bottom dock, then click-drag on the canvas'],
            ['Cancel the armed shape tool', 'Esc, or click the active tool again'],
            ['Select several Elements', 'Shift-click them, or Shift-drag a box on empty canvas; ⌘A selects all'],
            ['Connect two blocks', 'Drag from a port on one block onto another block'],
            ['Reroute a connector', 'Select it, then double-click the line to add a bend point; drag bend points; double-click a bend point to remove it'],
            ['Tidy up the whole diagram', 'File → Auto-layout, top to bottom / left to right (Undo in the message puts it back)'],
            ['Tidy up just part of it', 'Select 2+ Elements (or a frame), then the layout buttons on the selection toolbar'],
            ['Edit a block / connector', 'Click it — the inspector opens on the right'],
            ['Duplicate or delete', '⌘D / Delete, or the buttons in the inspector'],
            ['Copy part of a diagram elsewhere', 'Select, ⌘C, open the other diagram, ⌘V'],
            ['Pan the canvas', 'Drag empty canvas (or middle-mouse drag anywhere)'],
            ['Zoom', 'Scroll, or the Zoom in / Zoom out / Fit buttons in the view dock'],
            ['Rename the diagram', 'Click its name in the header, type, press Enter'],
            ['Undo / redo a change', '⌘Z / ⌘⇧Z, or the Undo / Redo buttons next to the File menu'],
            ['Save to the cloud', '⌘S, or the Save button in the header (amber dot = unsaved changes)'],
            ['Go back to an earlier save', 'History in the header → Preview, Restore (then Save), or Save as a new diagram'],
            ['See every shortcut', 'Press ? on the canvas'],
            ['Play the animation', 'Replay — pick Sequential, Concurrent or Manual first'],
            ['Share read-only', 'Set the diagram to Public, then File → Share → Copy'],
            ['Draw a database table', 'Table button at the right of the shape dock, then click-drag'],
            ['Edit columns', 'Select the table — the Columns section is in the inspector'],
            ['Link two tables', 'Connect them, then pick a column at each end in the Relationship block'],
            ['Get the SQL', 'File → Export SQL → Copy or Download .sql'],
            ['Put the diagram in a slide or document', 'File → Export image… (or Image in the viewer) → PNG or SVG'],
          ]}
        />
      </Section>
    </HelpShell>
  );
}
