# Seed lessons

The 40 lessons of the sibling project
[system-design-tutorials](../../../system-design-tutorials), converted to X Flow
Tool Lessons (`LessonDocumentJSON`, see `/guide/lessons`):

- `en/<id>.lesson.json` — English, as in the source.
- `vi/<id>.lesson.json` — Vietnamese, from the source's
  `backend/data/translations/<id>.json`; a string with no translation stays
  English.

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

It reads the source's `backend/data/{lessons,translations,i18n}` and imports
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

It refuses anything but a `demo-*` project on local emulator hosts. Stop the
emulators with Ctrl+C so the data is exported to `.emulator-data/`.

**By hand, anywhere**: on `/lessons` press **New lesson**, then in the lesson
editor **File → Import JSON…** and pick a file; Save, then set Public if
wanted.

## Upgrading an existing deployment

A real Firebase project needs the lesson rules first: run
`firebase deploy --only firestore` (rules and indexes) before anyone opens
`/lessons` there or imports these files. Until then the deployed rules deny
every Lesson read and write.
