// Snaps stored Lessons' Diagrams onto the editor's 40px grid in place
// (lib/snap-diagram.ts): for Lessons a person has edited, where re-importing
// the seed would throw their changes away. Only the `document` field is
// written (and the Public copy's, when the Lesson is Public); name, Public
// flag and times are kept.
//
//   Emulator:  npx vite-node scripts/snap-lessons-to-grid.ts --emulator --uid <uid> [--ids a,b]
//   Real:      FIREBASE_ACCESS_TOKEN=… npx vite-node scripts/snap-lessons-to-grid.ts --project <id> --uid <uid> [--ids a,b]
//
// Without --ids every Lesson of the account is snapped; one already on the
// grid is left untouched.

import { snapDiagramToGrid } from '../src/lib/snap-diagram';
import type { FlowDocumentJSON } from '../src/lib/flowchart-types';
import { argValue, fail, fromFields, toFields, type FirestoreValue } from './seed-lessons-shared';

const emulator = process.argv.includes('--emulator');
const project = emulator ? 'demo-x-flow-tool' : argValue('--project', '');
const uid = argValue('--uid', '');
const only = argValue('--ids', '');
const token = emulator ? 'owner' : process.env.FIREBASE_ACCESS_TOKEN;
if (!project) fail('Pass --project <id> (or --emulator).');
if (!uid) fail('Pass --uid <owner uid>.');
if (!token) fail('Set FIREBASE_ACCESS_TOKEN (a project owner token), or pass --emulator.');
if (!emulator && project.startsWith('demo-')) fail('demo-* projects are emulator-only: pass --emulator.');

const base = emulator ? `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents` : `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function listLessons(): Promise<{ id: string; fields: Record<string, unknown> }[]> {
  const out: { id: string; fields: Record<string, unknown> }[] = [];
  let pageToken = '';
  do {
    const response = await fetch(`${base}/users/${uid}/lessons?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers });
    if (!response.ok) fail(`Listing lessons failed: ${response.status} ${await response.text()}`);
    const body = (await response.json()) as { documents?: { name: string; fields?: Record<string, FirestoreValue> }[]; nextPageToken?: string };
    for (const document of body.documents ?? []) out.push({ id: document.name.split('/').pop() ?? '', fields: fromFields(document.fields ?? {}) });
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

async function writeDocument(docPath: string, document: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${base}/${docPath}?updateMask.fieldPaths=document`, { method: 'PATCH', headers, body: JSON.stringify({ fields: toFields({ document }) }) });
  if (!response.ok) fail(`Writing ${docPath} failed: ${response.status} ${await response.text()}`);
}

const wanted = only ? new Set(only.split(',').map((id) => id.trim()).filter(Boolean)) : null;
let changed = 0;
let checked = 0;
for (const lesson of await listLessons()) {
  if (wanted && !wanted.has(lesson.id)) continue;
  const document = lesson.fields.document as { diagram?: FlowDocumentJSON } | undefined;
  if (!document?.diagram || !Array.isArray(document.diagram.nodes)) continue;
  checked += 1;
  const diagram = snapDiagramToGrid({ ...document.diagram, edges: document.diagram.edges ?? [] });
  if (JSON.stringify(diagram) === JSON.stringify(document.diagram)) continue;
  const next = { ...document, diagram };
  await writeDocument(`users/${uid}/lessons/${lesson.id}`, next);
  if (lesson.fields.public === true) await writeDocument(`public-lessons/${lesson.id}`, next);
  changed += 1;
  console.log(`snapped ${lesson.id}${lesson.fields.public === true ? ' (and its Public copy)' : ''}`);
}
if (wanted && checked < wanted.size) console.warn(`Only ${checked} of ${wanted.size} requested lessons were found.`);
console.log(`Done — ${changed} of ${checked} lessons snapped in ${project}.`);
