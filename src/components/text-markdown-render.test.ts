import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlowCanvas } from '@/components/FlowCanvas';
import type { FlowDocumentJSON, FlowNode } from '@/lib/flowchart-types';

const noop = () => {};
function render(node: Partial<FlowNode>): string {
  const document: FlowDocumentJSON = { nodes: [{ id: 't', type: 'text', title: '', position: { x: 0, y: 0 }, width: 240, height: 160, ...node }], edges: [] };
  return renderToStaticMarkup(
    createElement(FlowCanvas, {
      document, selectedNodeId: null, onSelectNode: noop, onNodeMove: noop, onNodeResize: noop, onNodeDragStart: noop, onNodeDragEnd: noop, onConnect: noop, isDragging: false, linkingFromId: null,
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

  it('stays plain text otherwise, asterisks and all', () => {
    const html = render({ title: source });
    expect(html).toContain('**bold**');
    expect(html).not.toContain('<strong>');
  });
});
