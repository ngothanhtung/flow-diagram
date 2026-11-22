// A block's padding: its own `padding` when set (the same on every side),
// else the old size-derived padding, so existing Diagrams draw exactly as before.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlowCanvas } from '@/components/FlowCanvas';
import type { FlowNode } from './flowchart-types';
import { blockPadding, NEW_BLOCK_FONT_SIZE, NEW_BLOCK_PADDING } from './node-style';

const block = (extra: Partial<FlowNode> = {}): FlowNode => ({ id: 'b', type: 'process', title: 'Gateway', position: { x: 0, y: 0 }, width: 112, height: 112, ...extra }) as FlowNode;

describe('blockPadding', () => {
  it('keeps the old size-derived padding when the block has none of its own', () => {
    const { x, y } = blockPadding(block(), 112, 112);
    expect(y).toBeCloseTo(14.56);
    expect(x).toBeCloseTo(22.56);
  });

  it('uses the block’s own padding on every side, clamped to 0–64', () => {
    expect(blockPadding(block({ padding: 24 }), 112, 112)).toEqual({ x: 24, y: 24 });
    expect(blockPadding(block({ padding: 0 }), 112, 112)).toEqual({ x: 0, y: 0 });
    expect(blockPadding(block({ padding: 500 }), 112, 112)).toEqual({ x: 64, y: 64 });
    expect(blockPadding(block({ padding: Number.NaN }), 112, 112).y).toBeCloseTo(14.56);
  });
});

describe('a new block', () => {
  it('is born with 24px padding and 16px text, big enough for its icon and two lines inside', async () => {
    expect([NEW_BLOCK_PADDING, NEW_BLOCK_FONT_SIZE]).toEqual([24, 16]);
    const { useEditorStore } = await import('./editor-store');
    useEditorStore.setState({ doc: { nodes: [], edges: [] } });
    // A plain click on the canvas asks for 190×86.
    const id = useEditorStore.getState().onShapeCreate('rounded', { x: 0, y: 0 }, 190, 86);
    const node = useEditorStore.getState().doc.nodes.find((n) => n.id === id)!;
    expect(node).toMatchObject({ padding: 24, fontSize: 16 });
    const badge = (node.iconSize ?? 18) + 25;
    expect(node.height! - 2 * 24).toBeGreaterThanOrEqual(badge);
    expect(node.width! - 2 * 24).toBeGreaterThanOrEqual(120);
  });
});

describe('the card', () => {
  const render = (node: FlowNode) =>
    renderToStaticMarkup(
      createElement(FlowCanvas, {
        document: { nodes: [node], edges: [] },
        readOnly: true,
        infoOpen: false,
        onToggleInfo: () => {},
        selectedNodeId: null,
        onSelectNode: () => {},
        onNodeMove: () => {},
        onNodeResize: () => {},
        onNodeDragStart: () => {},
        onNodeDragEnd: () => {},
        onConnect: () => {},
        isDragging: false,
        linkingFromId: null,
        onLinkStart: () => {},
        onLinkMove: () => {},
        onLinkEnd: () => {},
        selectedEdgeId: null,
        onSelectEdge: () => {},
        onEdgeReconnect: () => {},
        onEdgeUpdate: () => {},
        activeShape: null,
        onShapeDrawn: () => {},
      }),
    );

  it('lays its content out inside its own padding', () => {
    expect(render(block({ padding: 24 }))).toContain('padding:24px 24px');
  });

  it('draws an old block exactly as before', () => {
    expect(render(block())).toContain('padding:14.56px 22.560000000000002px');
  });
});
