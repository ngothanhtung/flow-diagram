// The gate every Lesson document passes on its way in (Firestore, the public
// mirror, Import, the local session). Same philosophy as
// `document-validation.ts`: refuse only what can't be shown (a diagram that
// can't be drawn), repair everything else field by field, say what was
// repaired in `fixes`, never throw, and return the input object itself when
// it was already clean. Unknown keys are kept on a repair.
//
// A plain Diagram JSON is accepted too and becomes a one-step lesson.

import { EDGE_EFFECTS, NODE_EFFECTS } from '../document-vocabulary';
import { normalizeDocument, validateDocument } from '../document-validation';
import type { FlowDocumentJSON } from '../flowchart-types';
import { CALLOUT_KINDS, LESSON_CHAPTERS, LESSON_LEVELS, RESERVED_METRIC_IDS, emptyStep, newStepId } from './lesson-types';
import type { CalloutKind, ElementOverride, ElementPresence, LessonDocumentJSON, LessonMeta, LessonMetric, LessonStep } from './lesson-types';

export type NormalizeLessonResult = { ok: true; lesson: LessonDocumentJSON; fixes: string[] } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function preview(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return String(value);
    return json.length > 40 ? `${json.slice(0, 37)}…` : json;
  } catch {
    return String(value);
  }
}

/** A string as is; anything else (a number included) reads as '' and is reported. */
function textOf(value: unknown, label: string, fixes: string[]): string {
  if (typeof value === 'string') return value;
  fixes.push(`${label}: ${preview(value)} is not text — read as ''.`);
  return '';
}

/** `value` when it is a string naming a member of `ids`, else undefined (with a fix when something was there). */
function referenceTo(value: unknown, ids: ReadonlySet<string>, label: string, what: string, fixes: string[]): string | undefined {
  if (typeof value === 'string' && ids.has(value)) return value;
  if (value !== undefined) fixes.push(`${label}: ignored ${preview(value)} — no such ${what}.`);
  return undefined;
}

function normalizeMeta(raw: unknown, stepIds: ReadonlySet<string>, fixes: string[]): LessonMeta {
  const source: Record<string, unknown> = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) fixes.push(`Lesson meta ${preview(raw)} is not an object — started empty.`);
  const meta: Record<string, unknown> = { ...source };
  meta.title = textOf(source.title, 'Lesson title', fixes);
  meta.summary = textOf(source.summary, 'Lesson summary', fixes);

  if (source.minutes !== undefined && !(typeof source.minutes === 'number' && Number.isFinite(source.minutes) && source.minutes > 0)) {
    fixes.push(`Lesson minutes ${preview(source.minutes)} ignored — expected a positive number.`);
    delete meta.minutes;
  }
  if (source.level !== undefined && !(typeof source.level === 'string' && (LESSON_LEVELS as readonly string[]).includes(source.level))) {
    fixes.push(`Lesson level ${preview(source.level)} ignored — expected one of ${LESSON_LEVELS.join(', ')}.`);
    delete meta.level;
  }

  const metrics: LessonMetric[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(source.metrics)) fixes.push(`Lesson metrics ${preview(source.metrics)} is not a list — ignored.`);
  (Array.isArray(source.metrics) ? source.metrics : []).forEach((entry: unknown, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id || seen.has(entry.id)) {
      const duplicate = isRecord(entry) && typeof entry.id === 'string' && seen.has(entry.id);
      fixes.push(`Metric ${index + 1} ${duplicate ? `has duplicate id "${(entry as { id: string }).id}"` : 'has no usable id'} — dropped.`);
      return;
    }
    if (RESERVED_METRIC_IDS.has(entry.id)) {
      fixes.push(`Metric ${index + 1} has the reserved id "${entry.id}" — dropped.`);
      return;
    }
    seen.add(entry.id);
    const label = textOf(entry.label, `Metric "${entry.id}" label`, fixes);
    metrics.push(typeof entry.label === 'string' ? (entry as unknown as LessonMetric) : { ...entry, id: entry.id, label });
  });
  meta.metrics = metrics;

  const goals: LessonMeta['goals'] = [];
  if (!Array.isArray(source.goals)) fixes.push(`Lesson goals ${preview(source.goals)} is not a list — ignored.`);
  (Array.isArray(source.goals) ? source.goals : []).forEach((entry: unknown, index) => {
    const name = `Goal ${index + 1}`;
    if (!isRecord(entry) || typeof entry.step !== 'string' || !stepIds.has(entry.step)) {
      fixes.push(`${name} points at no existing step — dropped.`);
      return;
    }
    goals.push(typeof entry.text === 'string' ? (entry as unknown as LessonMeta['goals'][number]) : { ...entry, text: textOf(entry.text, `${name} text`, fixes), step: entry.step });
  });
  meta.goals = goals;
  return meta as unknown as LessonMeta;
}

function normalizePresence(raw: unknown, elementIds: ReadonlySet<string>, stepIds: ReadonlySet<string>, fixes: string[]): Record<string, ElementPresence> {
  if (!isRecord(raw)) fixes.push(`Presence ${preview(raw)} is not an object — ignored.`);
  const entries: [string, ElementPresence][] = [];
  for (const [id, value] of Object.entries(isRecord(raw) ? raw : {})) {
    const label = `Presence of "${id}"`;
    if (!elementIds.has(id)) {
      fixes.push(`${label}: no such Element — dropped.`);
      continue;
    }
    if (!isRecord(value)) {
      fixes.push(`${label}: ${preview(value)} is not an object — dropped.`);
      continue;
    }
    const presence: Record<string, unknown> = { ...value };
    for (const end of ['from', 'until'] as const) {
      if (value[end] === undefined) continue;
      const kept = referenceTo(value[end], stepIds, `${label} ${end}`, 'step', fixes);
      if (kept === undefined) delete presence[end];
    }
    if (Object.keys(presence).length === 0) {
      fixes.push(`${label}: nothing left — dropped.`);
      continue;
    }
    entries.push([id, presence as ElementPresence]);
  }
  return Object.fromEntries(entries);
}

function normalizeOverride(raw: unknown, isEdge: boolean, label: string, fixes: string[]): ElementOverride | null {
  if (!isRecord(raw)) {
    fixes.push(`${label}: ${preview(raw)} is not an object — dropped.`);
    return null;
  }
  const override: Record<string, unknown> = { ...raw };
  // A node is renamed through `title`, a line through `label`.
  const wrongText = isEdge ? 'title' : 'label';
  const rightText = isEdge ? 'label' : 'title';
  if (raw[wrongText] !== undefined) {
    fixes.push(`${label}: ignored ${wrongText} — ${isEdge ? 'a Line' : 'an Element'} is renamed through "${rightText}".`);
    delete override[wrongText];
  }
  if (raw[rightText] !== undefined && typeof raw[rightText] !== 'string') {
    fixes.push(`${label}: ignored ${rightText} ${preview(raw[rightText])} — expected a string.`);
    delete override[rightText];
  }
  if (raw.effect !== undefined) {
    const vocabulary: ReadonlySet<string> = isEdge ? EDGE_EFFECTS : NODE_EFFECTS;
    if (typeof raw.effect !== 'string' || !vocabulary.has(raw.effect)) {
      fixes.push(`${label}: ignored effect ${preview(raw.effect)} — not an effect ${isEdge ? 'a Line' : 'an Element'} has.`);
      delete override.effect;
    }
  }
  for (const flag of ['visible', 'emphasis'] as const) {
    if (raw[flag] !== undefined && typeof raw[flag] !== 'boolean') {
      fixes.push(`${label}: ignored ${flag} ${preview(raw[flag])} — expected true or false.`);
      delete override[flag];
    }
  }
  if (Object.keys(override).length === 0) {
    fixes.push(`${label}: nothing left — dropped.`);
    return null;
  }
  return override as ElementOverride;
}

function normalizeStep(
  raw: Record<string, unknown>,
  id: string,
  context: { nodeIds: ReadonlySet<string>; elementIds: ReadonlySet<string>; metricIds: ReadonlySet<string> },
  fixes: string[],
): LessonStep {
  const label = `Lesson step "${id}"`;
  const step: Record<string, unknown> = { ...raw, id };
  step.short = textOf(raw.short, `${label} short`, fixes);
  step.title = textOf(raw.title, `${label} title`, fixes);
  step.body = textOf(raw.body, `${label} body`, fixes);

  if (raw.chapter !== undefined && !(typeof raw.chapter === 'string' && Object.hasOwn(LESSON_CHAPTERS, raw.chapter))) {
    fixes.push(`${label}: ignored chapter ${preview(raw.chapter)} — expected one of ${Object.keys(LESSON_CHAPTERS).join(', ')}.`);
    delete step.chapter;
  }

  if (raw.callout !== undefined) {
    const callout = raw.callout;
    // 'warn' is what people write by hand.
    const kind = isRecord(callout) ? (callout.kind === 'warn' ? 'warning' : callout.kind) : undefined;
    if (!isRecord(callout) || typeof kind !== 'string' || !(CALLOUT_KINDS as readonly string[]).includes(kind)) {
      fixes.push(`${label}: ignored callout ${preview(callout)} — expected { kind: ${CALLOUT_KINDS.join(' | ')}, text }.`);
      delete step.callout;
    } else if (kind !== callout.kind || typeof callout.text !== 'string') {
      if (kind !== callout.kind) fixes.push(`${label}: read callout kind "warn" as "warning".`);
      step.callout = { ...callout, kind: kind as CalloutKind, text: textOf(callout.text, `${label} callout text`, fixes) };
    }
  }

  if (!Array.isArray(raw.changes)) fixes.push(`${label}: changes ${preview(raw.changes)} is not a list — ignored.`);
  const changes: string[] = [];
  for (const entry of Array.isArray(raw.changes) ? raw.changes : []) {
    // Author-written lines ("+ added", "~ changed", "- removed"), not Element ids.
    if (typeof entry === 'string') changes.push(entry);
    else fixes.push(`${label}: change ${preview(entry)} is not text — dropped.`);
  }
  step.changes = changes;

  if (!isRecord(raw.metrics)) fixes.push(`${label}: metrics ${preview(raw.metrics)} is not an object — ignored.`);
  const metrics: [string, string][] = [];
  for (const [metricId, value] of Object.entries(isRecord(raw.metrics) ? raw.metrics : {})) {
    if (!context.metricIds.has(metricId)) {
      fixes.push(`${label}: metric "${metricId}" is not declared in the lesson — dropped.`);
    } else if (typeof value === 'string') {
      metrics.push([metricId, value]);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      metrics.push([metricId, String(value)]);
      fixes.push(`${label}: read metric "${metricId}" ${preview(value)} as ${preview(String(value))}.`);
    } else {
      fixes.push(`${label}: metric "${metricId}" ${preview(value)} is not text — dropped.`);
    }
  }
  step.metrics = Object.fromEntries(metrics);

  if (!isRecord(raw.overrides)) fixes.push(`${label}: overrides ${preview(raw.overrides)} is not an object — ignored.`);
  const overrides: [string, ElementOverride][] = [];
  for (const [elementId, value] of Object.entries(isRecord(raw.overrides) ? raw.overrides : {})) {
    const name = `${label} override of "${elementId}"`;
    if (!context.elementIds.has(elementId)) {
      fixes.push(`${name}: no such Element — dropped.`);
      continue;
    }
    const override = normalizeOverride(value, !context.nodeIds.has(elementId), name, fixes);
    if (override) overrides.push([elementId, override]);
  }
  step.overrides = Object.fromEntries(overrides);
  return step as unknown as LessonStep;
}

/**
 * Repairs a Lesson document (or imports a plain Diagram JSON as a one-step
 * lesson) — see the top of this file. `ok: false` only when the diagram
 * can't be drawn; the lesson part is always repairable.
 */
export function normalizeLessonDocument(input: unknown): NormalizeLessonResult {
  if (!isRecord(input)) return { ok: false, error: 'A lesson must be a JSON object.' };

  const fixes: string[] = [];
  const isLesson = input.format === 'x-flow-lesson' || isRecord(input.diagram);
  const rawDiagram = isLesson ? input.diagram : input;

  const error = validateDocument(rawDiagram);
  if (error) return { ok: false, error };
  const normalizedDiagram = normalizeDocument(rawDiagram);
  const diagram: FlowDocumentJSON = normalizedDiagram.document;
  fixes.push(...normalizedDiagram.fixes);

  if (!isLesson) {
    fixes.push('Imported a Diagram as a one-step lesson.');
    const lesson: LessonDocumentJSON = {
      format: 'x-flow-lesson',
      version: 1,
      diagram,
      meta: { title: '', summary: '', metrics: [], goals: [] },
      presence: {},
      steps: [emptyStep('s1')],
    };
    return { ok: true, lesson, fixes };
  }

  const nodeIds = new Set(diagram.nodes.map((node) => node.id));
  const elementIds = new Set([...nodeIds, ...diagram.edges.map((edge) => edge.id)]);

  // Steps: ids first, since goals and presence point at them.
  let rawSteps: unknown[] = [];
  if (Array.isArray(input.steps)) rawSteps = input.steps;
  else if (input.steps !== undefined) fixes.push(`"steps" ${preview(input.steps)} is not a list of Lesson steps — started with one step.`);
  const kept: Record<string, unknown>[] = [];
  rawSteps.forEach((raw, index) => {
    if (isRecord(raw)) kept.push(raw);
    else fixes.push(`Lesson step ${index + 1} ${preview(raw)} is not an object — dropped.`);
  });
  const usedIds = new Set<string>();
  const ids: (string | null)[] = kept.map((raw) => {
    if (typeof raw.id === 'string' && raw.id && !usedIds.has(raw.id)) {
      usedIds.add(raw.id);
      return raw.id;
    }
    return null;
  });
  const stepIds = new Map<number, string>();
  ids.forEach((id, index) => {
    if (id !== null) {
      stepIds.set(index, id);
      return;
    }
    const raw = kept[index];
    const fresh = newStepId([...usedIds, ...kept.map((other) => other.id).filter((other): other is string => typeof other === 'string')]);
    usedIds.add(fresh);
    stepIds.set(index, fresh);
    fixes.push(`Lesson step ${index + 1} ${typeof raw.id === 'string' && raw.id ? `repeats id "${raw.id}"` : 'has no id'} — given id "${fresh}".`);
  });
  const created = kept.length === 0;
  if (created) {
    fixes.push('The lesson has no Lesson steps — created one.');
    usedIds.add('s1');
  }

  const meta = normalizeMeta(input.meta, usedIds, fixes);
  const metricIds = new Set(meta.metrics.map((metric) => metric.id));
  const presence = normalizePresence(input.presence, elementIds, usedIds, fixes);
  const steps = created ? [emptyStep('s1')] : kept.map((raw, index) => normalizeStep(raw, stepIds.get(index) as string, { nodeIds, elementIds, metricIds }, fixes));

  if (input.format !== 'x-flow-lesson') fixes.push('Set format "x-flow-lesson".');
  if (input.version !== 1) fixes.push(`Read version ${preview(input.version)} as 1.`);

  // Every repair above reports a fix, so no fixes means nothing changed.
  if (fixes.length === 0) return { ok: true, lesson: input as unknown as LessonDocumentJSON, fixes };
  const lesson: LessonDocumentJSON = { ...input, format: 'x-flow-lesson', version: 1, diagram, meta, presence, steps };
  return { ok: true, lesson, fixes };
}
