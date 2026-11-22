// The isometric view on screen and in export: boxes with three faces, lines
// on the floor, labels upright (never rotated or skewed).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IsometricDiagram } from '@/components/present/IsometricDiagram';
import type { FlowDocumentJSON, FlowEdge, FlowNode } from '@/lib/flowchart-types';

const doc: FlowDocumentJSON = {
  nodes: [
    { id: 'lb', type: 'process', title: 'Load Balancer', description: 'round robin', position: { x: 0, y: 0 }, width: 240, height: 100, borderColor: '#fb923c', color: '#fb923c', backgroundColor: '#431407' } as FlowNode,
    { id: 'b', type: 'process', title: 'Server B', position: { x: 0, y: 300 }, width: 240, height: 100 } as FlowNode,
  ],
  edges: [{ id: 'e', from: 'lb', to: 'b', label: 'HTTP' } as FlowEdge],
};

describe('IsometricDiagram', () => {
  const html = renderToStaticMarkup(createElement(IsometricDiagram, { document: doc }));

  it('draws each block as a box of three faces in its own colours', () => {
    expect(html.match(/data-face="top"/g)).toHaveLength(2);
    expect(html.match(/data-face="right"/g)).toHaveLength(2);
    expect(html.match(/data-face="front"/g)).toHaveLength(2);
    expect(html).toMatch(/data-face="top"[^>]*fill="#431407"[^>]*stroke="#fb923c"|fill="#431407"[^>]*stroke="#fb923c"[^>]*data-face="top"/);
  });

  it('keeps every label upright', () => {
    for (const text of ['Load Balancer', 'round robin', 'Server B', 'HTTP']) expect(html).toContain(`>${text}</text>`);
    expect(html).not.toMatch(/<text[^>]*transform=/);
    expect(html).not.toMatch(/<g[^>]*transform="[^"]*(rotate|skew|matrix)/);
  });

  it('lays the connector on the floor with an arrowhead', () => {
    expect(html).toMatch(/<polyline[^>]*data-line="e"/);
    expect(html).toMatch(/data-arrow="e"/);
  });

  it('lights up the block the run is on', () => {
    const lit = renderToStaticMarkup(createElement(IsometricDiagram, { document: doc, nodeStates: { lb: 'active', b: 'pending' } }));
    expect(lit).toMatch(/data-box="lb"[^>]*data-active="true"/);
    expect(lit).toMatch(/data-box="b"[^>]*opacity="0.38"/);
  });
});
