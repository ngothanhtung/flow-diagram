// The left accent bar some shapes wear. A note's folded corner already marks it,
// so the bar there was a second line hugging the left border.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlowCanvas } from '@/components/FlowCanvas';
import type { FlowNode, NodeShape } from '@/lib/flowchart-types';

const ACCENT = /stroke-width="3" stroke-linecap="round" opacity="0.8"/;

function render(shape: NodeShape) {
  const node = { id: 'n', type: 'process', title: 'Nghiệm thu', description: 'UAT', position: { x: 0, y: 0 }, width: 240, height: 160, shape } as FlowNode;
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(FlowCanvas, {
      document: { nodes: [node], edges: [] },
      readOnly: true,
      infoOpen: false,
      onToggleInfo: noop,
      selectedNodeId: null,
      onSelectNode: noop,
      onNodeMove: noop,
      onNodeResize: noop,
      onNodeDragStart: noop,
      onNodeDragEnd: noop,
      onConnect: noop,
      isDragging: false,
      linkingFromId: null,
      onLinkStart: noop,
      onLinkMove: noop,
      onLinkEnd: noop,
      selectedEdgeId: null,
      onSelectEdge: noop,
      onEdgeReconnect: noop,
      onEdgeUpdate: noop,
      activeShape: null,
      onShapeDrawn: noop,
    }),
  );
}

describe('card accent bar', () => {
  it('is gone from a note (folded corner)', () => {
    expect(render('note')).not.toMatch(ACCENT);
  });

  it('is still on the shapes that use it', () => {
    expect(render('server')).toMatch(ACCENT);
  });
});
