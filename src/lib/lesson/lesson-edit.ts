// Pure Lesson editing operations. Each returns a new LessonContent, or the
// input itself when nothing changed. No React, no Firebase.

import type { FlowDocumentJSON } from '../flowchart-types';
import {
  emptyStep,
  newStepId,
  type ElementOverride,
  type ElementPresence,
  type LessonContent,
  type LessonMeta,
  type LessonStep,
} from './lesson-types';

function withSteps(content: LessonContent, steps: LessonStep[]): LessonContent {
  return { ...content, steps };
}

/** Drops undefined keys; null when nothing is left. */
function compact<T extends object>(value: T): T | null {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  return entries.length === 0 ? null : (Object.fromEntries(entries) as T);
}

function setEntry<T>(record: Record<string, T>, key: string, value: T | null): Record<string, T> {
  const { [key]: _old, ...rest } = record;
  void _old;
  return value === null ? rest : { ...rest, [key]: value };
}

export function addStep(content: LessonContent, afterStepId: string | null): { content: LessonContent; stepId: string } {
  const stepId = newStepId(content.steps.map((s) => s.id));
  const at = afterStepId === null ? -1 : content.steps.findIndex((s) => s.id === afterStepId);
  const insertAt = at === -1 ? content.steps.length : at + 1;
  const steps = [...content.steps];
  steps.splice(insertAt, 0, emptyStep(stepId));
  return { content: withSteps(content, steps), stepId };
}

export function duplicateStep(content: LessonContent, stepId: string): { content: LessonContent; stepId: string } {
  const at = content.steps.findIndex((s) => s.id === stepId);
  if (at === -1) return { content, stepId };
  const source = content.steps[at];
  const id = newStepId(content.steps.map((s) => s.id));
  const copy: LessonStep = {
    ...structuredClone(source),
    id,
    short: `${source.short} copy`,
  };
  const steps = [...content.steps];
  steps.splice(at + 1, 0, copy);
  return { content: withSteps(content, steps), stepId: id };
}

export function removeStep(content: LessonContent, stepId: string): LessonContent {
  const at = content.steps.findIndex((s) => s.id === stepId);
  if (at === -1 || content.steps.length <= 1) return content;
  const next = content.steps[at + 1];
  const prev = content.steps[at - 1];
  const steps = content.steps.filter((s) => s.id !== stepId);

  const presence: Record<string, ElementPresence> = {};
  for (const [id, p] of Object.entries(content.presence)) {
    const moved: ElementPresence = { ...p };
    if (p.from === stepId) moved.from = (next ?? prev).id;
    if (p.until === stepId) {
      if (next) moved.until = next.id;
      else delete moved.until;
    }
    const kept = compact(moved);
    if (kept) presence[id] = kept;
  }

  const target = (next ?? prev).id;
  const goals = content.meta.goals.map((g) => (g.step === stepId ? { ...g, step: target } : g));
  return { meta: { ...content.meta, goals }, presence, steps };
}

export function moveStep(content: LessonContent, stepId: string, toIndex: number): LessonContent {
  const from = content.steps.findIndex((s) => s.id === stepId);
  if (from === -1) return content;
  const to = Math.max(0, Math.min(content.steps.length - 1, Math.trunc(toIndex)));
  if (to === from) return content;
  const steps = [...content.steps];
  const [moved] = steps.splice(from, 1);
  steps.splice(to, 0, moved);
  return withSteps(content, steps);
}

export function updateStep(content: LessonContent, stepId: string, patch: Partial<Omit<LessonStep, 'id'>>): LessonContent {
  if (!content.steps.some((s) => s.id === stepId)) return content;
  return withSteps(content, content.steps.map((s) => (s.id === stepId ? { ...s, ...patch, id: s.id } : s)));
}

export function updateMeta(content: LessonContent, patch: Partial<LessonMeta>): LessonContent {
  return { ...content, meta: { ...content.meta, ...patch } };
}

export function removeFromStep(content: LessonContent, elementIds: readonly string[], stepId: string): LessonContent {
  if (elementIds.length === 0) return content;
  const presence = { ...content.presence };
  for (const id of elementIds) presence[id] = { ...presence[id], until: stepId };
  return { ...content, presence };
}

export function setPresence(content: LessonContent, elementId: string, presence: ElementPresence | null): LessonContent {
  const next = presence === null ? null : compact({ ...presence });
  if (next === null && !(elementId in content.presence)) return content;
  return { ...content, presence: setEntry(content.presence, elementId, next) };
}

export function setOverride(content: LessonContent, stepId: string, elementId: string, patch: Partial<ElementOverride>): LessonContent {
  if (!content.steps.some((s) => s.id === stepId)) return content;
  return withSteps(
    content,
    content.steps.map((s) => {
      if (s.id !== stepId) return s;
      const merged = compact({ ...s.overrides[elementId], ...patch });
      return { ...s, overrides: setEntry(s.overrides, elementId, merged) };
    }),
  );
}

function elementIds(diagram: FlowDocumentJSON): Set<string> {
  return new Set([...diagram.nodes.map((n) => n.id), ...diagram.edges.map((e) => e.id)]);
}

export function stampNewElements(
  content: LessonContent,
  before: FlowDocumentJSON,
  after: FlowDocumentJSON,
  stepId: string | null,
): LessonContent {
  if (stepId === null || stepId === content.steps[0]?.id) return content;
  const known = elementIds(before);
  const fresh = [...elementIds(after)].filter((id) => !known.has(id));
  if (fresh.length === 0) return content;
  const presence = { ...content.presence };
  for (const id of fresh) presence[id] = { ...presence[id], from: stepId };
  return { ...content, presence };
}

export function pruneMissingElements(content: LessonContent, diagram: FlowDocumentJSON): LessonContent {
  const live = elementIds(diagram);
  const presenceStale = Object.keys(content.presence).some((id) => !live.has(id));
  const overridesStale = content.steps.some((s) => Object.keys(s.overrides).some((id) => !live.has(id)));
  if (!presenceStale && !overridesStale) return content;
  const keepLive = <T>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([id]) => live.has(id))) as Record<string, T>;
  return {
    ...content,
    presence: keepLive(content.presence),
    steps: content.steps.map((s) => ({ ...s, overrides: keepLive(s.overrides) })),
  };
}

export interface PresenceWarning {
  elementId: string;
  kind: 'never-visible';
}

/** Elements no step shows. Looks at presence and per-step `visible` overrides only. */
export function presenceWarnings(content: LessonContent, diagram: FlowDocumentJSON): PresenceWarning[] {
  const order = new Map(content.steps.map((s, i) => [s.id, i]));
  const warnings: PresenceWarning[] = [];
  for (const id of elementIds(diagram)) {
    const p = content.presence[id];
    const from = p?.from !== undefined ? order.get(p.from) : undefined;
    const until = p?.until !== undefined ? order.get(p.until) : undefined;
    const shown = content.steps.some((step, i) => {
      const inRange = (from === undefined || i >= from) && (until === undefined || i < until);
      return step.overrides[id]?.visible ?? inRange;
    });
    if (!shown) warnings.push({ elementId: id, kind: 'never-visible' });
  }
  return warnings;
}
