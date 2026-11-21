import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LESSON_GUIDE_EXAMPLE } from '@/lib/lesson/lesson-guide-example';
import { LESSON_CHAPTERS } from '@/lib/lesson/lesson-types';

export const metadata: Metadata = {
  title: 'Lesson authoring guide — X Flow Tool',
  description: 'The rules and conventions an AI or developer must follow to author a valid LessonDocumentJSON: a Diagram plus Lesson steps and Narration.',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className='scroll-mt-20 border-t border-border py-8 first:border-t-0 first:pt-0'>
      <h2 className='text-lg font-semibold text-foreground'>{title}</h2>
      <div className='mt-3 space-y-4 text-sm leading-relaxed text-muted-foreground'>{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return <pre className='overflow-x-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-cyan-700 dark:text-cyan-100 ring-1 ring-border'>{children}</pre>;
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className='overflow-x-auto rounded-lg ring-1 ring-border'>
      <table className='w-full border-collapse text-xs'>
        <thead>
          <tr className='bg-accent text-left text-foreground'>
            {head.map((h) => (
              <th key={h} className='px-3 py-2 font-semibold'>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className='border-t border-border'>
              {row.map((cell, j) => (
                <td key={j} className={['px-3 py-2 align-top', j === 0 ? 'font-mono text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground'].join(' ')}>
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
  return <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground'>{children}</code>;
}

const TOC = [
  ['model', 'The model'],
  ['schema', 'Document schema'],
  ['presence', 'Presence and until'],
  ['overrides', 'Overrides and emphasis'],
  ['chapters', 'Chapters, callouts, levels'],
  ['narration', 'Narration markup'],
  ['normalizer', 'What the normalizer does'],
  ['example', 'Worked example'],
  ['checklist', 'Checklist'],
] as const;

const SCHEMA = `{
  "format": "x-flow-lesson",
  "version": 1,
  "meta": {
    "title": string,
    "summary": string,
    "minutes"?: number,                         // > 0
    "level"?: "beginner" | "intermediate" | "advanced",
    "metrics": { "id": string, "label": string }[],
    "goals": { "text": string, "step": <Lesson step id> }[]
  },
  "diagram": FlowDocumentJSON,                  // the one shared Diagram
  "presence": {                                 // when each Element / Line is there
    "<nodeId or edgeId>": { "from"?: <step id>, "until"?: <step id> }
  },
  "steps": [                                    // at least one, in order
    {
      "id": string,                             // unique; referenced by id, never by index
      "short": string,                          // label on the step bar
      "title": string,
      "chapter"?: "setup" | "problem" | "solution" | "technique" | "tradeoff" | "insight" | "recap",
      "body": string,                           // Narration markup
      "callout"?: { "kind": "insight" | "tip" | "warning", "text": string },
      "changes": string[],                      // "+ added", "~ changed", "- removed"
      "metrics": { "<metric id>": string },
      "overrides": {
        "<nodeId>": { "title"?, "effect"?, "visible"?, "emphasis"? },
        "<edgeId>": { "label"?, "effect"?, "visible"?, "emphasis"? }
      }
    }
  ]
}`;

export default function LessonGuidePage() {
  return (
    <div className='min-h-screen bg-background text-foreground'>
      <header className='flex items-center justify-between border-b border-border px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <GraduationCap size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>Lesson authoring guide</h1>
            <p className='text-xs text-muted-foreground'>Rules for producing a valid LessonDocumentJSON — for humans and AI agents alike</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Link href='/guide' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-foreground ring-1 ring-border transition hover:bg-accent'>
            Diagram guide
          </Link>
          <Link href='/lessons' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-foreground ring-1 ring-border transition hover:bg-accent'>
            Back to lessons
          </Link>
          <ThemeToggle variant='toolbar' size='icon' />
        </div>
      </header>

      <div className='mx-auto flex max-w-5xl gap-10 px-6 py-10'>
        <nav className='sticky top-10 hidden h-fit w-48 shrink-0 flex-col gap-1 text-xs md:flex'>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className='rounded-md px-2 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground'>
              {label}
            </a>
          ))}
        </nav>

        <main className='min-w-0 flex-1'>
          <p className='max-w-2xl text-sm leading-relaxed text-muted-foreground'>
            A Lesson is one JSON value, <Pill>LessonDocumentJSON</Pill> (defined in <Pill>src/lib/lesson/lesson-types.ts</Pill>): a Diagram plus an ordered list of Lesson steps that reveal,
            hide and narrate its Elements. The drawing follows the <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>Diagram authoring guide</Link>; this page
            covers only what a Lesson adds. Import it with <strong>File → Import JSON…</strong> in the lesson editor and keep editing by hand.
          </p>

          <Section id='model' title='1. The model'>
            <ul className='list-disc space-y-1.5 pl-5'>
              <li>
                A Lesson has <strong>one Diagram</strong>, shared by every Lesson step. Each Lesson step chooses what of it shows, and carries its own <strong>Narration</strong> (title, body,
                callout, changes, metrics).
              </li>
              <li>
                A Lesson step is always called a <em>Lesson step</em>, never a bare &quot;step&quot; — <Pill>Step</Pill> already means a position in a Diagram&apos;s Replay. Replay settings
                (<Pill>sortOrder</Pill>, run mode, repeat) are not used in a Lesson; Effects run continuously.
              </li>
              <li>Lesson steps are referenced by <strong>id</strong>, never by index, so reordering them breaks nothing.</li>
              <li>
                A plain Diagram JSON is also accepted on Import: it becomes a Lesson with one empty Lesson step.
              </li>
            </ul>
          </Section>

          <Section id='schema' title='2. Document schema'>
            <p>
              <Pill>diagram</Pill> is a complete <Pill>FlowDocumentJSON</Pill>. Everything else is the Lesson layer:
            </p>
            <Code>{SCHEMA}</Code>
            <p>
              Metrics are defined once in <Pill>meta.metrics</Pill> and given a value per Lesson step as a <em>string</em> (<Pill>&quot;48 KB&quot;</Pill>); a missing value shows as
              &quot;—&quot;. A goal is ticked in the viewer once the viewer reaches its <Pill>step</Pill>; clicking it jumps there.
            </p>
          </Section>

          <Section id='presence' title='3. Presence and until'>
            <p>
              <Pill>presence</Pill> says when each Element or Line is there. It is keyed by node or edge id, and each entry has an optional <Pill>from</Pill> and <Pill>until</Pill>, both Lesson
              step ids:
            </p>
            <ul className='list-disc space-y-1.5 pl-5'>
              <li>
                <strong>No entry</strong> = present in every Lesson step. <Pill>from</Pill> missing = from the first; <Pill>until</Pill> missing = to the end.
              </li>
              <li>
                Present in the Lesson steps whose position (in the current order of <Pill>steps</Pill>) lies in <Pill>[from, until)</Pill>: <Pill>until</Pill> is the first Lesson step where
                the Element is <em>gone</em>.
              </li>
              <li>
                A Line shows only when it is present <strong>and</strong> both its ends show. An Element inside a hidden Frame is hidden too.
              </li>
              <li>
                If reordering puts <Pill>until</Pill> before <Pill>from</Pill>, the Element is present nowhere — the editor warns but does not repair it.
              </li>
              <li>
                In the viewer, Elements arriving at a Lesson step fade in and are emphasised with an outline; Elements leaving fade out.
              </li>
            </ul>
          </Section>

          <Section id='overrides' title='4. Overrides and emphasis'>
            <p>
              A Lesson step&apos;s <Pill>overrides</Pill> change how an Element or Line looks <em>in that Lesson step only</em>, keyed by id. Only these fields are allowed:
            </p>
            <Table
              head={['Target', 'Fields']}
              rows={[
                ['Element (node id)', 'title, effect (a node Effect, or "none"), visible, emphasis'],
                ['Line (edge id)', 'label, effect (a line Effect, or "none" to stop the flow), visible, emphasis'],
              ]}
            />
            <ul className='list-disc space-y-1.5 pl-5'>
              <li>
                <Pill>visible</Pill> beats <Pill>presence</Pill> in that Lesson step — the way to hide an Element and show it again later, or hide it in one step only.
              </li>
              <li>
                Emphasis in a Lesson step = whatever has <Pill>from</Pill> at that step, plus whatever has <Pill>emphasis: true</Pill>. While anything is emphasised, the rest is dimmed slightly.
              </li>
              <li>Use the Line key <Pill>label</Pill> and the Element key <Pill>title</Pill>; the other one is dropped.</li>
            </ul>
          </Section>

          <Section id='chapters' title='5. Chapters, callouts, levels'>
            <Table
              head={['chapter', 'Label / colour tone']}
              rows={Object.entries(LESSON_CHAPTERS).map(([key, value]) => [key, `${value.label} · ${value.tone}`])}
            />
            <Table
              head={['callout.kind', 'Meaning']}
              rows={[
                ['insight', 'A conclusion worth remembering'],
                ['tip', 'Practical advice'],
                ['warning', 'A pitfall. "warn" is read as "warning".'],
              ]}
            />
            <p>
              <Pill>level</Pill> is <Pill>beginner</Pill>, <Pill>intermediate</Pill> or <Pill>advanced</Pill>. <Pill>chapter</Pill> and <Pill>callout</Pill> are optional; an unknown value is
              dropped.
            </p>
          </Section>

          <Section id='narration' title='6. Narration markup'>
            <p>
              <Pill>body</Pill>, <Pill>callout.text</Pill> and the <Pill>changes</Pill> lines are plain text with a small, safe markup. <strong>HTML is never rendered</strong> — tags show as
              literal text, so write none.
            </p>
            <Table
              head={['Write', 'Shows as']}
              rows={[
                ['blank line', 'new paragraph'],
                ['**bold**', 'bold'],
                ['*italic*', 'italic'],
                ['`code`', 'code'],
                ['[[term]]', 'a highlighted glossary term'],
              ]}
            />
            <p>
              Markers do not nest, and an unclosed one stays literal text. Each <Pill>changes</Pill> line starts with <Pill>+</Pill> (added), <Pill>~</Pill> (changed) or <Pill>-</Pill>{' '}
              (removed); these are sentences you write, not Element ids.
            </p>
          </Section>

          <Section id='normalizer' title='7. What the normalizer fixes and refuses'>
            <p>
              Every Lesson — from Import, Firestore, the Public mirror or the local session — goes through <Pill>normalizeLessonDocument</Pill>. It <strong>refuses</strong> only what cannot be
              drawn: the input is not a JSON object, or its Diagram is refused by the Diagram rules. Everything else it <strong>repairs and lists</strong> as a fix:
            </p>
            <ul className='list-disc space-y-1.5 pl-5'>
              <li>Lesson step without an id, or repeating one → given a new id (<Pill>s2</Pill>, …). No Lesson steps at all → one empty Lesson step is created.</li>
              <li>
                <Pill>presence</Pill>, <Pill>overrides</Pill>, <Pill>goals</Pill> pointing at an Element or Lesson step that does not exist → dropped. An entry left empty → dropped.
              </li>
              <li>Unknown <Pill>chapter</Pill>, <Pill>callout</Pill>, <Pill>level</Pill>, or <Pill>minutes</Pill> that is not positive → dropped. <Pill>&quot;warn&quot;</Pill> → <Pill>&quot;warning&quot;</Pill>.</li>
              <li>An override field outside its allowed set or vocabulary (an effect a Line does not have, <Pill>title</Pill> on a Line, a non-boolean <Pill>visible</Pill>) → dropped.</li>
              <li>A metric value that is a number → read as text. A metric id not declared in <Pill>meta.metrics</Pill>, or a duplicate declaration → dropped.</li>
              <li>Non-text where text belongs → read as an empty string. Wrong <Pill>format</Pill> or <Pill>version</Pill> → set to <Pill>&quot;x-flow-lesson&quot;</Pill> and <Pill>1</Pill>.</li>
            </ul>
            <p>Unknown extra keys are kept. A document that needs no repair is loaded untouched, so opening a Lesson never marks it as changed.</p>
          </Section>

          <Section id='example' title='8. Worked example'>
            <p>
              A phone calls a REST API in Lesson steps 1 and 2; Lesson step 3 brings a GraphQL endpoint in (note its <Pill>presence</Pill>), and turns the REST Line&apos;s Effect off with an
              override. This exact document passes the normalizer with no fix (it is checked by a test):
            </p>
            <Code>{JSON.stringify(LESSON_GUIDE_EXAMPLE, null, 2)}</Code>
          </Section>

          <Section id='checklist' title='9. Checklist before shipping a Lesson'>
            <ul className='list-disc space-y-1.5 pl-5'>
              <li>
                <Pill>format</Pill> is <Pill>&quot;x-flow-lesson&quot;</Pill>, <Pill>version</Pill> is <Pill>1</Pill>, and <Pill>diagram</Pill> follows the Diagram guide.
              </li>
              <li>At least one Lesson step; every Lesson step id is unique and every <Pill>from</Pill>/<Pill>until</Pill>/<Pill>goals[].step</Pill> names one.</li>
              <li>Every key in <Pill>presence</Pill> and <Pill>overrides</Pill> is a real node or edge id.</li>
              <li>An Element that appears mid-lesson has <Pill>presence.from</Pill>; nothing has <Pill>until</Pill> at or before its <Pill>from</Pill>.</li>
              <li>Every metric used in a Lesson step is declared in <Pill>meta.metrics</Pill>, with a string value.</li>
              <li>Narration uses only the markup in §6 and no HTML; <Pill>changes</Pill> lines start with <Pill>+</Pill>, <Pill>~</Pill> or <Pill>-</Pill>.</li>
            </ul>
          </Section>
        </main>
      </div>
    </div>
  );
}
