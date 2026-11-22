// The committed lessons under seed/lessons (converted from
// system-design-tutorials by scripts/convert-tutorials.ts) must load as they
// are: no normalizer fix, every Lesson step resolvable, and a readable 2D
// layout — sizes inside what the canvas renders and no two blocks shown in
// the same step overlapping, in the viewer or (ghosts included) in the editor.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { icons } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { FlowNode } from '../flowchart-types';
import { nodeSizeLimits } from '../node-style';
import { facingSides, nodePortAnchor } from '../../components/edge-geometry';
import { normalizeLessonDocument } from './lesson-normalize';
import { resolveStepView } from './lesson-step-view';
import { contentOf, type LessonDocumentJSON } from './lesson-types';

const GRID = 40;
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

        // Snapped to the editor's 40px grid: every box's edges sit on grid lines,
        // and a Line's bends on half-grid points (where box centres fall).
        const offGrid = nodes
          .filter((node) => [node.position.x - (node.width ?? 0) / 2, node.position.y - (node.height ?? 0) / 2, node.width ?? 0, node.height ?? 0].some((value) => value % GRID !== 0))
          .map((node) => node.id);
        expect(offGrid, 'boxes off the grid').toEqual([]);
        // A Line between two blocks that share a row (or a column) of the source
        // runs straight: their centres line up, so it needs no jog.
        const byId = new Map(nodes.map((node) => [node.id, node]));
        const jogs = lesson.diagram.edges
          .filter((edge) => !edge.bendPoints?.length)
          .filter((edge) => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b || a.type !== 'process' || b.type !== 'process') return false;
            const dy = Math.abs(a.position.y - b.position.y);
            const dx = Math.abs(a.position.x - b.position.x);
            // Side by side but a few pixels off-centre, or stacked but a few pixels off-axis.
            return (dy > 0 && dy < GRID && dx > GRID) || (dx > 0 && dx < GRID && dy > GRID);
          })
          .map((edge) => edge.id);
        expect(jogs, 'lines with a small jog').toEqual([]);
        const offBends = lesson.diagram.edges.filter((edge) => (edge.bendPoints ?? []).some((point) => point.x % (GRID / 2) !== 0 || point.y % (GRID / 2) !== 0)).map((edge) => edge.id);
        expect(offBends, 'bends off the half grid').toEqual([]);
        // …and so does each end of a Line: the port it leaves or enters sits on a
        // box edge (a data store is a `cylinder`, whose caps fill its box — the
        // classic `database` silhouette's top and bottom ports fall inside it).
        const offEnds = lesson.diagram.edges.flatMap((edge) => {
          const [from, to] = [byId.get(edge.from), byId.get(edge.to)];
          if (!from || !to) return [];
          const facing = facingSides(from, to);
          return (
            [
              [from, edge.fromSide ?? facing.fromSide],
              [to, edge.toSide ?? facing.toSide],
            ] as const
          )
            .filter(([node, side]) => {
              const anchor = nodePortAnchor(node, side);
              // Anchors are scaled from a 112px box (920/112·56 = 459.99…), so allow float dust.
              const off = (value: number) => Math.abs(value - Math.round(value / (GRID / 2)) * (GRID / 2)) > 1e-6;
              return off(node.position.x + anchor.x) || off(node.position.y + anchor.y);
            })
            .map(([node, side]) => `${edge.id}:${node.id}.${side}`);
        });
        expect(offEnds, 'line ends off the half grid').toEqual([]);
        expect(nodes.filter((node) => node.shape === 'database').map((node) => node.id), 'classic database shapes').toEqual([]);

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

          // The editor also draws hidden Elements, as faint ghosts: those
          // must not pile up on each other or on the shown blocks either.
          const editorLooks = resolveStepView(lesson.diagram, content, step.id, 'editor').looks;
          // Groups count too, except against their own members (at any depth).
          const byId = new Map(nodes.map((node) => [node.id, node]));
          const within = (child: FlowNode, group: FlowNode) => {
            for (let cur = child.parentId; cur !== undefined; cur = byId.get(cur)?.parentId) if (cur === group.id) return true;
            return false;
          };
          const drawn = nodes.filter((node) => editorLooks[node.id] !== 'gone');
          const ghostClashes: string[] = [];
          for (let i = 0; i < drawn.length; i += 1) {
            for (let j = i + 1; j < drawn.length; j += 1) {
              const [a, b] = [drawn[i], drawn[j]];
              if (editorLooks[a.id] !== 'ghost' && editorLooks[b.id] !== 'ghost') continue;
              if (within(a, b) || within(b, a)) continue;
              if (overlaps(a, b)) ghostClashes.push(`${a.id} × ${b.id}`);
            }
          }
          expect(ghostClashes, `${step.id} editor overlaps`).toEqual([]);
        }
      });
    }
  }
});
