# Seed lessons

The 40 lessons of the sibling project
[system-design-tutorials](../../../system-design-tutorials), converted to X Flow
Tool Lessons (`LessonDocumentJSON`, see `/guide/lessons`):

- `en/<id>.lesson.json` — English, as in the source.
- `vi/<id>.lesson.json` — Vietnamese, from the source's
  `backend/data/translations/<id>.json`; a string with no translation stays
  English.

`tree.json` is the Lesson tree for them (spec
`docs/superpowers/specs/2026-11-22-lesson-tree-design.md` §5.4): roots
"System Design (EN)" / "System Design (VI)" (ids `tutorial-en` / `tutorial-vi`),
under each the curriculum's 9 chapters in order with their colours (ids
`tutorial-<lang>-<chapter>`, Vietnamese names from the source's
`i18n/vi.json`), and in each chapter its lessons.

Every lesson is laid out on the editor's 40px grid: each box's top-left on a
grid point and its size whole cells (so all edges sit on grid lines), a Line's
free bends on the half grid, and blocks that share a source row or column sized
so their centres line up (a Line between them runs straight). Lessons someone
has already edited are tidied in place instead of re-imported:
`scripts/snap-lessons-to-grid.ts` (see below).

Every file passes `normalizeLessonDocument` with no fix, and no two blocks
shown in the same Lesson step overlap — `src/lib/lesson/seed-lessons.test.ts`
checks both on `npm test`.

## How they are made

`src/lib/lesson/tutorial-import.ts` does the conversion (spec §10 of
`docs/superpowers/specs/2026-11-21-lessons-design.md`): the source draws a
fresh scene per step, so an entity that looks different in some steps becomes
one Element per look, shown through `presence` only in its own steps; links
follow, and flows become Line Effects with per-step `effect` overrides
(`none` where a line carries no traffic). The isometric plan is projected to
2D as `(x·S, y·S)` with S chosen per lesson (`tutorial-layout.ts`); info
panels go in a column to the right of the scene.

Regenerate after changing the converter or the source:

```bash
npx vite-node scripts/convert-tutorials.ts [--src ../system-design-tutorials] [--out seed/lessons]
```

It reads the source's `backend/data/{lessons,translations,i18n}` and
`curriculum.json` (for `tree.json`), and imports
`METRIC_DEFS` from its `frontend/src/engine/metrics.ts` (labels and value
formats). The script fails if any output needs a normalizer fix.

## Loading them

**Into the local emulator** (`npm run emulators` running): for one account,
created if it doesn't exist and made an administrator, with Public on so each
lesson's `/lessons/<id>/view` link works at once. Ids are
`tutorial-<lang>-<id>`, so a re-run overwrites; the Vietnamese copies are titled
"<title> (VI)" (in `meta.title`, which is the Lesson's name, and the stored
`name` alike).

```bash
SEED_EMAIL=you@example.com SEED_PASSWORD=… npx vite-node scripts/seed-emulator-lessons.ts [--lang en|vi|all]
```

Both loaders then merge `tree.json` into the account's Lesson tree — the
seeded folders are overwritten by id, the account's own folders and lessons
are kept — and rewrite its public copy. Other lessons the account has show up
as Unfiled the next time its owner opens `/lessons`.

It refuses anything but a `demo-*` project on local emulator hosts. Stop the
emulators with Ctrl+C so the data is exported to `.emulator-data/`.

**Into a real Firebase project** (rules deployed first, see below), all of
them at once, owned by one account — every write goes through the deployed
rules, as the app's own Save does:

```bash
FIREBASE_API_KEY=… SEED_EMAIL=… SEED_PASSWORD=… \
  npx vite-node scripts/import-lessons.ts --project <project-id> [--lang en|vi|all] [--create-account]
```

Without the account's password, a project owner can import for it by uid
instead (this bypasses the rules): `FIREBASE_ACCESS_TOKEN=… npx vite-node
scripts/import-lessons.ts --project <project-id> --uid <uid>`. Neither grants
the account a role. Add `--tree-only` to leave the account's Lessons untouched
and write only the Lesson tree (its index is checked against the account's
real Lessons — their names and Public flags — before it is written).

**Re-importing over edited lessons**: `import-lessons.ts --skip a,b` leaves the
named lessons alone. To put lessons a person has edited onto the grid without
losing their changes, snap them in place (only `document` is written, plus the
Public copy):

```bash
npx vite-node scripts/snap-lessons-to-grid.ts --emulator --uid <uid> [--ids a,b]
FIREBASE_ACCESS_TOKEN=… npx vite-node scripts/snap-lessons-to-grid.ts --project <id> --uid <uid> [--ids a,b]
```

**By hand, anywhere**: on `/lessons` press **New lesson**, then in the lesson
editor **File → Import JSON…** and pick a file; Save, then set Public if
wanted.

## Upgrading an existing deployment

A real Firebase project needs the lesson rules first: run
`firebase deploy --only firestore` (rules and indexes) before anyone opens
`/lessons` there or imports these files. Until then the deployed rules deny
every Lesson read and write.
