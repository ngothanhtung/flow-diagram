// Every Inspector reads like the Narration preview: one docked column with a
// small uppercase header strip, flat sections inside — no floating drawer,
// no card per panel.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EdgeInspector } from '@/components/EdgeInspector';
import { InspectorColumn, InspectorSidebar } from '@/components/editor/InspectorSidebar';
import { NodeInspector } from '@/components/inspector/NodeInspector';
import type { FlowDocumentJSON, FlowEdge, FlowNode } from '@/lib/flowchart-types';

const block = (id: string, type: FlowNode['type'] = 'process'): FlowNode => ({ id, type, title: id, position: { x: 0, y: 0 } }) as FlowNode;
const edge: FlowEdge = { id: 'e1', from: 'a', to: 'b' } as FlowEdge;
const document: FlowDocumentJSON = { nodes: [block('a'), block('b')], edges: [edge] };
const noop = () => undefined;


describe('InspectorSidebar', () => {
  it('is a docked column with the Narration preview header strip', () => {
    const html = renderToStaticMarkup(createElement(InspectorColumn, { ariaLabel: 'Diagram inspector', onClose: noop } as Parameters<typeof InspectorColumn>[0], 'panels'));
    expect(html).toMatch(/^<aside[^>]*aria-label="Diagram inspector"[^>]*class="[^"]*border-l border-border bg-card\/40/);
    expect(html).toMatch(/uppercase tracking-\[0.14em\][^>]*>.*Inspector/);
    expect(html).toContain('aria-label="Close the inspector"');
  });

  it('renders nothing when nothing is selected', () => {
    expect(renderToStaticMarkup(createElement(InspectorSidebar, { document, ariaLabel: 'Diagram inspector' }))).not.toContain('<aside');
  });
});

describe('panels inside the column', () => {
  it.each(['process', 'text', 'group', 'icon', 'line'] as const)('a %s panel is a flat section, not a card', (type) => {
    const html = renderToStaticMarkup(createElement(NodeInspector, { node: block('n', type), onUpdate: noop, onDuplicate: noop, onDelete: noop, onClose: noop }));
    expect(html).not.toContain('data-slot="card"');
    expect(html).toMatch(/^<section/);
  });

  it('the line panel is a flat section too, with no second close button', () => {
    const html = renderToStaticMarkup(
      createElement(EdgeInspector, { edge, styles: [], sourceTitle: 'a', targetTitle: 'b', fallbackColor: '#67e8f9', onUpdate: noop, onAssignStyle: noop, onManageStyles: noop, onDelete: noop, onClose: noop }),
    );
    expect(html).not.toContain('data-slot="card"');
    expect(html).not.toContain('Close line inspector');
    expect(html).toContain('a → b');
  });
});
