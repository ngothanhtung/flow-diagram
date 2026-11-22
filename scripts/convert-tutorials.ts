// Converts every lesson of the sibling project system-design-tutorials into
// a Lesson file, in English and Vietnamese:
//
//   npx vite-node scripts/convert-tutorials.ts [--src ../system-design-tutorials] [--out seed/lessons]
//
// Reads `backend/data/lessons/<id>.json`, `backend/data/translations/<id>.json`
// (EN string → VI string, a missing key keeps the English) and
// `backend/data/i18n/vi.json`, and imports `METRIC_DEFS` from the source's
// `frontend/src/engine/metrics.ts` for metric labels and value formats.
// Writes `<out>/{en,vi}/<id>.lesson.json`. Every file must pass
// `normalizeLessonDocument` with no fix, or the script fails.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeLessonDocument } from '../src/lib/lesson/lesson-normalize';
import { convertTutorialLesson } from '../src/lib/lesson/tutorial-import';
import { lessonNameOf } from '../src/lib/lesson/lesson-types';
import { tutorialTree, type CurriculumModule } from '../src/lib/lesson/tutorial-tree';

type Lang = 'en' | 'vi';
interface MetricDef {
  label: string;
  fmt?: (value: unknown) => string;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argValue = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const src = path.resolve(root, argValue('--src', '../system-design-tutorials'));
const out = path.resolve(root, argValue('--out', 'seed/lessons'));

const readJson = (file: string): Record<string, unknown> => JSON.parse(readFileSync(file, 'utf8'));
const lessonsDir = path.join(src, 'backend/data/lessons');
if (!existsSync(lessonsDir)) {
  console.error(`No lessons at ${lessonsDir} — pass --src <path to system-design-tutorials>.`);
  process.exit(1);
}
const { METRIC_DEFS } = (await import(pathToFileURL(path.join(src, 'frontend/src/engine/metrics.ts')).href)) as { METRIC_DEFS: Record<string, MetricDef> };
const uiVi = readJson(path.join(src, 'backend/data/i18n/vi.json')) as Record<string, string>;

// The source formats numbers with `toLocaleString(undefined, …)`, i.e. the
// machine's locale. Pin it per language so the output doesn't depend on
// where the script runs.
const LOCALES: Record<Lang, string> = { en: 'en-US', vi: 'vi-VN' };
const nativeToLocaleString = Number.prototype.toLocaleString;
function withLocale<T>(lang: Lang, run: () => T): T {
  Number.prototype.toLocaleString = function (this: number, locales?: Intl.LocalesArgument, opts?: Intl.NumberFormatOptions) {
    return nativeToLocaleString.call(this, locales ?? LOCALES[lang], opts);
  };
  try {
    return run();
  } finally {
    Number.prototype.toLocaleString = nativeToLocaleString;
  }
}

function formatMetric(lang: Lang, id: string, value: unknown): string {
  if (value === null || value === undefined || value === '' || value === '—') return '';
  const def = Object.hasOwn(METRIC_DEFS, id) ? METRIC_DEFS[id] : undefined;
  return withLocale(lang, () => {
    let shown = def?.fmt ? def.fmt(value) : String(value);
    // The extracted source leaves its "{n} jobs"-style templates unfilled.
    if (shown.includes('{n}')) {
      const template = lang === 'vi' ? (uiVi[shown] ?? shown) : shown;
      const n = typeof value === 'number' ? (id === 'stuffing' ? (+value.toFixed(2)).toLocaleString() : Math.round(value).toLocaleString()) : String(value);
      shown = template.replace('{n}', n);
    }
    if (lang === 'vi') shown = shown.replace(/\breq\/s\b/, uiVi['req/s'] ?? 'req/s');
    return shown;
  });
}

const files = readdirSync(lessonsDir).filter((file) => file.endsWith('.json')).sort();
let failed = false;
// Converted titles per language, for the Lesson tree (tree.json, below).
const titles: Record<Lang, Record<string, string>> = { en: {}, vi: {} };
for (const lang of ['en', 'vi'] as Lang[]) {
  mkdirSync(path.join(out, lang), { recursive: true });
  let missing = 0;
  let looked = 0;
  for (const file of files) {
    const id = file.replace(/\.json$/, '');
    const raw = readJson(path.join(lessonsDir, file));
    const dictionaryFile = path.join(src, 'backend/data/translations', file);
    const dictionary = lang === 'vi' && existsSync(dictionaryFile) ? (readJson(dictionaryFile) as Record<string, string>) : {};
    const translate = (text: string): string => {
      if (lang === 'en' || text.trim() === '') return text;
      const hit = Object.hasOwn(dictionary, text) ? dictionary[text] : Object.hasOwn(uiVi, text) ? uiVi[text] : undefined;
      // Not counted: numbers, and a line with a sign/marker the converter looks up again without it.
      const counted = !/^[\d\s.,%]+$/.test(text) && !/^\s*[+~\-−!=#]\s/.test(text);
      if (counted) looked += 1;
      if (typeof hit === 'string' && hit !== '') return hit;
      if (counted) missing += 1;
      return text;
    };
    const metricLabel = (metricId: string) => {
      const label = Object.hasOwn(METRIC_DEFS, metricId) ? METRIC_DEFS[metricId].label : metricId;
      return translate(label);
    };
    const lesson = convertTutorialLesson(raw, { translate, metricLabel, formatMetric: (metricId, value) => formatMetric(lang, metricId, value) });
    const result = normalizeLessonDocument(lesson);
    if (!result.ok || result.fixes.length > 0) {
      failed = true;
      console.error(`${lang}/${id}: ${result.ok ? result.fixes.join('\n  ') : result.error}`);
    }
    writeFileSync(path.join(out, lang, `${id}.lesson.json`), `${JSON.stringify(lesson, null, 2)}\n`);
    // The seed scripts title Vietnamese copies "<title> (VI)"; the tree index matches.
    const title = lessonNameOf(lesson);
    titles[lang][id] = lang === 'vi' ? `${title} (VI)` : title;
  }
  console.log(`${lang}: ${files.length} lessons written to ${path.relative(root, path.join(out, lang))}${lang === 'vi' ? ` (${missing} of ${looked} strings had no translation and stay English)` : ''}`);
}

// The Lesson tree: the curriculum's chapters under one root per language.
const curriculum = JSON.parse(readFileSync(path.join(src, 'backend/data/curriculum.json'), 'utf8')) as CurriculumModule[];
const tree = tutorialTree(curriculum, uiVi, titles);
const placed = Object.keys(tree.lessons).length;
if (placed !== files.length * 2) {
  failed = true;
  console.error(`tree.json places ${placed} lessons, expected ${files.length * 2}.`);
}
writeFileSync(path.join(out, 'tree.json'), `${JSON.stringify(tree, null, 2)}\n`);
console.log(`tree: ${Object.keys(tree.folders).length} folders, ${placed} lessons written to ${path.relative(root, path.join(out, 'tree.json'))}`);

if (failed) process.exit(1);
