// Present mode: the keys a presenter (or a clicker) presses, and where they move the run.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PresentMode } from '@/components/present/PresentMode';
import type { FlowDocumentJSON, FlowNode } from '@/lib/flowchart-types';
import { presentKeyAction, presentTarget } from './present';

describe('presentKeyAction', () => {
  it('maps the keys clickers send', () => {
    for (const key of ['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter']) expect(presentKeyAction(key)).toBe('next');
    for (const key of ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']) expect(presentKeyAction(key)).toBe('back');
    expect(presentKeyAction('Home')).toBe('first');
    expect(presentKeyAction('End')).toBe('last');
    expect(presentKeyAction('Escape')).toBe('exit');
    expect(presentKeyAction('a')).toBeNull();
  });
});

describe('presentTarget', () => {
  it('moves one step either way and stops at both ends instead of wrapping', () => {
    expect(presentTarget('next', 0, 5)).toBe(1);
    expect(presentTarget('next', 4, 5)).toBe(4);
    expect(presentTarget('back', 3, 5)).toBe(2);
    expect(presentTarget('back', 0, 5)).toBe(0);
    expect(presentTarget('first', 3, 5)).toBe(0);
    expect(presentTarget('last', 0, 5)).toBe(4);
  });

  it('stays at 0 when there is nothing to run', () => {
    for (const action of ['next', 'back', 'first', 'last'] as const) expect(presentTarget(action, 0, 0)).toBe(0);
  });
});

const block = (id: string, sortOrder: number): FlowNode => ({ id, type: 'process', title: id, position: { x: sortOrder * 200, y: 0 }, sortOrder }) as FlowNode;

describe('PresentMode', () => {
  const document: FlowDocumentJSON = { nodes: [block('a', 1), block('b', 2), block('c', 3)], edges: [] };

  it('shows the Diagram with a step counter and no canvas chrome', () => {
    const html = renderToStaticMarkup(createElement(PresentMode, { document, name: 'Checkout', onExit: () => {} }));
    expect(html).toContain('aria-label="Presenting Checkout"');
    expect(html).toContain(">Step 1 / 3<");
    expect(html).toContain('aria-label="Previous step"');
    expect(html).toContain('aria-label="Next step"');
    expect(html).toContain('aria-label="Exit presentation"');
    expect(html).not.toContain('Canvas view controls');
  });

  it('starts at the first step with Previous disabled', () => {
    const html = renderToStaticMarkup(createElement(PresentMode, { document, name: 'Checkout', onExit: () => {} }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Previous step"|<button[^>]*aria-label="Previous step"[^>]*disabled=""/);
  });
});
