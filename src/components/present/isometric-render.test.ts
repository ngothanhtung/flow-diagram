// Isometric view (spike): the canvas tilted to the isometric angle in Present
// and the viewer — a view only, the Diagram is untouched.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IsometricStage, ISOMETRIC_TRANSFORM } from '@/components/present/IsometricStage';
import { PresentMode } from '@/components/present/PresentMode';
import type { FlowDocumentJSON, FlowNode } from '@/lib/flowchart-types';

describe('IsometricStage', () => {
  it('tilts its content when on', () => {
    const html = renderToStaticMarkup(createElement(IsometricStage, { enabled: true } as Parameters<typeof IsometricStage>[0], 'canvas'));
    expect(ISOMETRIC_TRANSFORM).toContain('rotateX(');
    expect(ISOMETRIC_TRANSFORM).toContain('rotateZ(-45deg)');
    expect(html).toContain('data-isometric="true"');
    expect(html).toContain(`transform:${ISOMETRIC_TRANSFORM}`);
  });

  it('leaves its content flat when off', () => {
    const html = renderToStaticMarkup(createElement(IsometricStage, { enabled: false } as Parameters<typeof IsometricStage>[0], 'canvas'));
    expect(html).toContain('data-isometric="false"');
    expect(html).not.toContain('rotateX(');
  });
});

describe('Present mode', () => {
  it('offers an Isometric toggle, off to start', () => {
    const document: FlowDocumentJSON = { nodes: [{ id: 'a', type: 'process', title: 'A', position: { x: 0, y: 0 } } as FlowNode], edges: [] };
    const html = renderToStaticMarkup(createElement(PresentMode, { document, name: 'D', onExit: () => {} }));
    expect(html).toMatch(/aria-label="Isometric view"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*aria-label="Isometric view"/);
  });
});
