// Lesson document model. A Lesson is a Diagram plus a sequence of Lesson
// steps that reveal, hide and narrate its Elements. Pure data, no React.
// `normalizeLessonDocument` (lesson-normalize.ts) is the gate every lesson
// passes on its way in.

import type { FlowDocumentJSON, EdgeEffect, NodeEffect } from '../flowchart-types';

export type LessonChapter = 'setup' | 'problem' | 'solution' | 'technique' | 'tradeoff' | 'insight' | 'recap';
export type LessonLevel = 'beginner' | 'intermediate' | 'advanced';
export type CalloutKind = 'insight' | 'tip' | 'warning';

export interface LessonMetric {
  id: string;
  label: string;
}

/** `step` is a Lesson step id. */
export interface LessonGoal {
  text: string;
  step: string;
}

export interface LessonMeta {
  title: string;
  summary: string;
  minutes?: number;
  level?: LessonLevel;
  metrics: LessonMetric[];
  goals: LessonGoal[];
}

/** A missing `from` means from the first step; a missing `until`, to the end. */
export interface ElementPresence {
  from?: string;
  until?: string;
}

export interface ElementOverride {
  title?: string;
  label?: string;
  effect?: NodeEffect | EdgeEffect;
  visible?: boolean;
  emphasis?: boolean;
}

export interface LessonCallout {
  kind: CalloutKind;
  text: string;
}

export interface LessonStep {
  id: string;
  short: string;
  title: string;
  chapter?: LessonChapter;
  body: string;
  callout?: LessonCallout;
  changes: string[];
  metrics: Record<string, string>;
  overrides: Record<string, ElementOverride>;
}

export interface LessonContent {
  meta: LessonMeta;
  presence: Record<string, ElementPresence>;
  steps: LessonStep[];
}

export interface LessonDocumentJSON extends LessonContent {
  format: 'x-flow-lesson';
  version: 1;
  diagram: FlowDocumentJSON;
}

export type ElementLook = 'normal' | 'emphasis' | 'muted' | 'ghost' | 'gone';

export const LESSON_CHAPTERS: Record<LessonChapter, { label: string; tone: 'sand' | 'red' | 'green' | 'blue' | 'amber' | 'violet' | 'ink' }> = {
  setup: { label: 'Setup', tone: 'sand' },
  problem: { label: 'Problem', tone: 'red' },
  solution: { label: 'Solution', tone: 'green' },
  technique: { label: 'Technique', tone: 'blue' },
  tradeoff: { label: 'Trade-off', tone: 'amber' },
  insight: { label: 'Insight', tone: 'violet' },
  recap: { label: 'Recap', tone: 'ink' },
};

export const CALLOUT_KINDS: readonly CalloutKind[] = ['insight', 'tip', 'warning'];
export const LESSON_LEVELS: readonly LessonLevel[] = ['beginner', 'intermediate', 'advanced'];

export function emptyStep(id: string): LessonStep {
  return { id, short: 'Step', title: '', body: '', changes: [], metrics: {}, overrides: {} };
}

export function emptyLessonDocument(title?: string): LessonDocumentJSON {
  return toLessonDocument(
    { nodes: [], edges: [] },
    { meta: { title: title ?? 'Untitled lesson', summary: '', metrics: [], goals: [] }, presence: {}, steps: [emptyStep('s1')] },
  );
}

export function toLessonDocument(diagram: FlowDocumentJSON, content: LessonContent): LessonDocumentJSON {
  return { format: 'x-flow-lesson', version: 1, diagram, meta: content.meta, presence: content.presence, steps: content.steps };
}

export function contentOf(lesson: LessonDocumentJSON): LessonContent {
  return { meta: lesson.meta, presence: lesson.presence, steps: lesson.steps };
}

/** 's' + the smallest number not yet used, counting from 1. */
export function newStepId(existing: readonly string[]): string {
  const taken = new Set(existing);
  let n = 1;
  while (taken.has(`s${n}`)) n += 1;
  return `s${n}`;
}
