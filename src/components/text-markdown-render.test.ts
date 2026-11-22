import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlowCanvas } from '@/components/FlowCanvas';
import type { FlowDocumentJSON, FlowNode } from '@/lib/flowchart-types';

const noop = () => {};
function render(node: Partial<FlowNode>, elementLooks?: Record<string, 'emphasis'>): string {
  const document: FlowDocumentJSON = { nodes: [{ id: 't', type: 'text', title: '', position: { x: 0, y: 0 }, width: 240, height: 160, ...node }], edges: [] };
  return renderToStaticMarkup(
    createElement(FlowCanvas, {
      document, elementLooks, selectedNodeId: null, onSelectNode: noop, onNodeMove: noop, onNodeResize: noop, onNodeDragStart: noop, onNodeDragEnd: noop, onConnect: noop, isDragging: false, linkingFromId: null,
      onLinkStart: noop, onLinkMove: noop, onLinkEnd: noop, selectedEdgeId: null, onSelectEdge: noop, onEdgeReconnect: noop, onEdgeUpdate: noop, activeShape: null, onShapeDrawn: noop, infoOpen: false, onToggleInfo: noop,
    }),
  );
}

describe('a free text object', () => {
  const source = '**bold** and `code`\n\n- one\n- two';

  it('is drawn as formatted Markdown when markdown is on', () => {
    const html = render({ title: source, markdown: true });
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code');
    expect(html).toContain('<li>one</li>');
    expect(html).not.toContain('**bold**');
  });

  it('colours a {colour|span} and never lets the colour value carry markup', () => {
    const html = render({ title: '{red|hot} {#52c41a|ok} {red;x:y|no}', markdown: true });
    expect(html).toContain('color:#ff4d4f');
    expect(html).toContain('color:#52c41a');
    expect(html).toContain('{red;x:y|no}');
  });

  it('stays plain text otherwise, asterisks and all', () => {
    const html = render({ title: source });
    expect(html).toContain('**bold**');
    expect(html).not.toContain('<strong>');
  });

  it('wears one outline when emphasised in a Lesson step: the box’s own rounded corners, not a square around it', () => {
    const html = render({ title: 'x', borderColor: '#64748b', borderWidth: 1, cornerRadius: 12 }, { t: 'emphasis' });
    const cyan = html.match(/<(rect|path)[^>]*stroke="#22d3ee"[^>]*>/g) ?? [];
    expect(cyan).toHaveLength(1);
    expect(cyan[0]).toContain('rx="16"');
    // …outside the border, which keeps its own colour.
    expect(html).toMatch(/<rect[^>]*stroke="#64748b"/);
  });
});
