# Narration Markdown editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edit a Lesson step's Body and Callout in a CodeMirror Markdown editor (toolbar, shortcuts, Write/Preview), with lists, small headings and code blocks added to the Narration markup.

**Architecture:** `narration.ts` gains a block parser (data only) rendered by `NarrationText`; pure toolbar commands in `narration-commands.ts`; `NarrationEditor.tsx` wraps `@uiw/react-codemirror` and opens one history gesture per stretch of typing.

**Tech Stack:** Next.js 16, React 19, `@uiw/react-codemirror`, `@codemirror/lang-markdown`, `@codemirror/language`, `@lezer/highlight`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-narration-editor-design.md`

## Global Constraints
- No HTML, no links in Narration; renderer builds React nodes only.
- Old Narration renders unchanged (paragraph split on blank lines, single newlines kept).
- Blocks: `- `/`* ` bullet, `N. `/`N) ` ordered, `#`–`###` heading, ```` ``` ```` fence (unclosed fence runs to the end).
- Toolbar: Bold `**`, Italic `*`, Code `` ` ``, Term `[[ ]]`, Bullet list, Numbered list, Heading `### `, Code block. Shortcuts Mod-b, Mod-i, Mod-e.
- Copy: "Write", "Preview", hint `**bold** *italic* \`code\` [[term]] · - list · 1. list · ### heading · \`\`\` code`.

## Review Focus
1. A line starting `*italic*` (no space) stays italic text, not a list (Task 1).
2. Typing in the editor is one undo step, not one per key (Task 3, manual).
3. Undo/redo or switching Lesson steps shows the stored text (editor keyed like the old field) (Task 3, manual).
4. Code block content with `**` or `[[` renders literally (Task 1).
5. Preview equals the viewer (same component) (Task 2).

### Task 1: Block parser — `src/lib/lesson/narration.ts` (+ `narration.test.ts`)
`export type NarrationBlock = { kind: 'paragraph' | 'heading'; content: NarrationParagraph } | { kind: 'list'; ordered: boolean; items: NarrationParagraph[] } | { kind: 'code'; text: string }`; `export function parseNarrationBlocks(source: string): NarrationBlock[]`. Tests: old paragraphs unchanged; bullets/ordered grouped; heading; fence keeps raw text (no inline parsing) and unclosed fence runs to end; `*italic* word` at line start is a paragraph.

### Task 2: Renderer — `src/components/lessons/NarrationText.tsx`
Block mode renders paragraph `<p>`, heading `<h4>`, list `<ul>/<ol>`, code `<pre><code>`; inline mode unchanged. Test in `lesson-player-render.test.ts`: a step body with a list and a fence renders `<li>` and `<pre>` and the literal `**x**` inside code.

### Task 3: Editor — `src/lib/lesson/narration-commands.ts` (+ test), `src/components/lessons/NarrationEditor.tsx`, `LessonSidePanel.tsx`
Pure commands on `(doc, from, to)` returning `{ from, to, insert, selectFrom, selectTo }`: `toggleWrap(marker | [open, close])`, `prefixLines('bullet' | 'ordered' | 'heading')`, `fenceBlock`. Editor: CodeMirror with markdown language, a token-based highlight style, line wrapping, keymap, toolbar, Write/Preview, `beginHistoryGesture` on first change / `endHistoryGesture` on blur. Body and Callout use it; Changes stays a textarea. Manual check in the emulator.

### Task 4: Docs, gates, deploy
`/guide/lessons` Narration syntax, Help EN/VI, CLAUDE.md narration line. Gates: tsc, lint, `npm test`, `npm run test:rules`, build. Push to `main`, check Vercel.
