// Present mode offers the isometric view as a toggle, off to start.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PresentMode } from '@/components/present/PresentMode';
import type { FlowDocumentJSON, FlowNode } from '@/lib/flowchart-types';

describe('Present mode', () => {
  it('offers an Isometric toggle, off to start', () => {
    const document: FlowDocumentJSON = { nodes: [{ id: 'a', type: 'process', title: 'A', position: { x: 0, y: 0 } } as FlowNode], edges: [] };
    const html = renderToStaticMarkup(createElement(PresentMode, { document, name: 'D', onExit: () => {} }));
    expect(html).toMatch(/aria-label="Isometric view"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*aria-label="Isometric view"/);
  });
});
