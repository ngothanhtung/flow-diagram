// Every Inspector panel is split into named sections from one shared
// vocabulary, always in the same order, so a property is found in the same
// place whichever kind of element is selected.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EdgeInspector } from '@/components/EdgeInspector';
import { NodeInspector } from '@/components/inspector/NodeInspector';
import { INSPECTOR_SECTION_ORDER } from '@/components/inspector/fields';
import type { FlowEdge, FlowNode } from '@/lib/flowchart-types';

const noop = () => undefined;
const node = (type: FlowNode['type'], extra: Partial<FlowNode> = {}): FlowNode => ({ id: 'n', type, title: 'T', position: { x: 0, y: 0 }, ...extra }) as FlowNode;
const sections = (html: string) => [...html.matchAll(/data-section="([a-z]+)"/g)].map((m) => m[1]);
const renderNode = (n: FlowNode) => renderToStaticMarkup(createElement(NodeInspector, { node: n, onUpdate: noop, onDuplicate: noop, onDelete: noop, onClose: noop, parentTitle: n.parentId ? 'Frame' : null }));
const renderEdge = (columns = false) =>
  renderToStaticMarkup(
    createElement(EdgeInspector, {
      edge: { id: 'e', from: 'a', to: 'b' } as FlowEdge,
      styles: [],
      sourceTitle: 'a',
      targetTitle: 'b',
      fallbackColor: '#67e8f9',
      sourceColumns: columns ? [{ name: 'id' }] : undefined,
      targetColumns: columns ? [{ name: 'a_id' }] : undefined,
      onUpdate: noop,
      onAssignStyle: noop,
      onManageStyles: noop,
      onDelete: noop,
      onClose: noop,
    } as Parameters<typeof EdgeInspector>[0]),
  );

const PANELS: [string, string, string[]][] = [
  ['block', renderNode(node('process')), ['content', 'layout', 'typography', 'appearance', 'icon', 'replay', 'effect', 'actions']],
  ['table', renderNode(node('process', { table: { columns: [{ name: 'id' }] } } as Partial<FlowNode>)), ['content', 'columns', 'layout', 'typography', 'appearance', 'icon', 'replay', 'effect', 'actions']],
  ['text', renderNode(node('text')), ['content', 'layout', 'typography', 'appearance', 'effect', 'actions']],
  ['group', renderNode(node('group')), ['content', 'members', 'layout', 'typography', 'appearance', 'effect', 'actions']],
  ['icon', renderNode(node('icon')), ['content', 'layout', 'appearance', 'effect', 'actions']],
  ['line', renderNode(node('line')), ['layout', 'appearance', 'effect', 'actions']],
  ['block in a group', renderNode(node('process', { parentId: 'g' })), ['content', 'layout', 'typography', 'appearance', 'icon', 'replay', 'effect', 'group', 'actions']],
  ['connector', renderEdge(), ['content', 'appearance', 'routing', 'replay', 'effect', 'actions']],
  ['ERD connector', renderEdge(true), ['content', 'relationship', 'appearance', 'routing', 'replay', 'effect', 'actions']],
];

describe('Inspector sections', () => {
  it.each(PANELS)('the %s panel has its sections, in the shared order', (_name, html, expected) => {
    expect(sections(html)).toEqual(expected);
    const order = sections(html).map((id) => INSPECTOR_SECTION_ORDER.indexOf(id as (typeof INSPECTOR_SECTION_ORDER)[number]));
    expect(order.every((index, i) => index >= 0 && (i === 0 || index > order[i - 1]))).toBe(true);
  });

  it.each(PANELS)('the %s panel keeps no loose headings outside the sections', (_name, html) => {
    // The old inline headings (sky label + rule, or cyan uppercase labels).
    expect(html).not.toContain('tracking-[0.16em] text-sky-600/80');
    expect(html).not.toContain('text-cyan-300/80');
  });
});

describe('section titles', () => {
  it('stand out: foreground colour, bold, an accent mark — one shared style', async () => {
    const { SECTION_TITLE_CLASS } = await import('@/components/inspector/fields');
    expect(SECTION_TITLE_CLASS).toContain('text-foreground');
    expect(SECTION_TITLE_CLASS).toContain('font-bold');
    expect(SECTION_TITLE_CLASS).toContain('before:');
    const html = PANELS[0][1].replaceAll('&quot;', '"');
    expect(html).toContain(`<h3 class="${SECTION_TITLE_CLASS}">Content</h3>`);
  });
});
