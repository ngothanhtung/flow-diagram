// A Lesson's emphasis on a block keeps the block's own border colour and
// adds a glow in that colour, instead of a cyan stroke painted over the border.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlowCanvas } from '@/components/FlowCanvas';
import type { FlowDocumentJSON, FlowNode } from '@/lib/flowchart-types';

const noop = () => undefined;
function render(node: Partial<FlowNode>, emphasis: boolean): string {
  const document: FlowDocumentJSON = { nodes: [{ id: 'b', type: 'process', title: 'Server B', position: { x: 0, y: 0 }, width: 200, height: 80, ...node } as FlowNode], edges: [] };
  return renderToStaticMarkup(
    createElement(FlowCanvas, {
      document, elementLooks: emphasis ? { b: 'emphasis' } : undefined, selectedNodeId: null, onSelectNode: noop, onNodeMove: noop, onNodeResize: noop, onNodeDragStart: noop, onNodeDragEnd: noop, onConnect: noop, isDragging: false, linkingFromId: null,
      onLinkStart: noop, onLinkMove: noop, onLinkEnd: noop, selectedEdgeId: null, onSelectEdge: noop, onEdgeReconnect: noop, onEdgeUpdate: noop, activeShape: null, onShapeDrawn: noop, infoOpen: false, onToggleInfo: noop,
    }),
  );
}

describe('an emphasised block', () => {
  it('shows no cyan stroke over its border', () => {
    expect(render({ borderColor: '#f97316', color: '#f97316' }, true)).not.toContain('#22d3ee');
  });

  it('glows in its own border colour', () => {
    const glow = render({ borderColor: '#f97316', color: '#f97316' }, true).match(/<path[^>]*data-emphasis="glow"[^>]*>/)?.[0] ?? '';
    expect(glow).toContain('stroke="#f97316"');
    expect(glow).toMatch(/drop-shadow\(0 0 \d+px #f97316/);
  });

  it('keeps a dashed border dashed under the glow', () => {
    const html = render({ borderColor: '#f97316', color: '#f97316', borderStyle: 'dashed', borderWidth: 2 }, true);
    const glow = html.match(/<path[^>]*data-emphasis="glow"[^>]*>/)?.[0] ?? '';
    expect(glow).toContain('stroke-dasharray="10 6"');
  });

  it('draws no glow when not emphasised', () => {
    expect(render({ borderColor: '#f97316' }, false)).not.toContain('data-emphasis');
  });
});
