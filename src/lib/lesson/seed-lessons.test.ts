// The committed lessons under seed/lessons (converted from
// system-design-tutorials by scripts/convert-tutorials.ts) must load as they
// are: no normalizer fix, every Lesson step resolvable, and a readable 2D
// layout — sizes inside what the canvas renders and no two blocks shown in
// the same step overlapping.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { icons } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { FlowNode } from '../flowchart-types';
import { nodeSizeLimits } from '../node-style';
import { normalizeLessonDocument } from './lesson-normalize';
import { resolveStepView } from './lesson-step-view';
import { contentOf, type LessonDocumentJSON } from './lesson-types';

const seedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../seed/lessons');
const LANGUAGES = ['en', 'vi'] as const;

function lessonFiles(lang: string): string[] {
  return readdirSync(path.join(seedRoot, lang)).filter((file) => file.endsWith('.lesson.json')).sort();
}

function overlaps(a: FlowNode, b: FlowNode): boolean {
  const w = ((a.width ?? 0) + (b.width ?? 0)) / 2;
  const h = ((a.height ?? 0) + (b.height ?? 0)) / 2;
  return Math.abs(a.position.x - b.position.x) < w && Math.abs(a.position.y - b.position.y) < h;
}

describe('seed lessons', () => {
  it('has the same 40 lessons in each language', () => {
    const en = lessonFiles('en');
    expect(en).toHaveLength(40);
    expect(lessonFiles('vi')).toEqual(en);
  });

  for (const lang of LANGUAGES) {
    for (const file of lessonFiles(lang)) {
      it(`${lang}/${file} loads clean and lays out without overlaps`, () => {
        const input: unknown = JSON.parse(readFileSync(path.join(seedRoot, lang, file), 'utf8'));
        const result = normalizeLessonDocument(input);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.fixes).toEqual([]);
        const lesson: LessonDocumentJSON = result.lesson;
        const { nodes } = lesson.diagram;

        for (const node of nodes) {
          const limits = nodeSizeLimits(node);
          expect(node.width, node.id).toBeGreaterThanOrEqual(limits.minWidth);
          expect(node.width, node.id).toBeLessThanOrEqual(limits.maxWidth);
          expect(node.height, node.id).toBeGreaterThanOrEqual(limits.minHeight);
          expect(node.height, node.id).toBeLessThanOrEqual(limits.maxHeight);
          if (typeof node.icon === 'string') expect(Object.hasOwn(icons, node.icon.replace(/^lucide:/, '')), node.icon).toBe(true);
        }

        const content = contentOf(lesson);
        for (const step of lesson.steps) {
          const view = resolveStepView(lesson.diagram, content, step.id, 'viewer');
          expect(view.visibleIds.size, step.id).toBeGreaterThan(0);
          const shown = nodes.filter((node) => view.visibleIds.has(node.id) && node.type !== 'group');
          const clashes: string[] = [];
          for (let i = 0; i < shown.length; i += 1) {
            for (let j = i + 1; j < shown.length; j += 1) if (overlaps(shown[i], shown[j])) clashes.push(`${shown[i].id} × ${shown[j].id}`);
          }
          expect(clashes, `${step.id} overlaps`).toEqual([]);
        }
      });
    }
  }
});
