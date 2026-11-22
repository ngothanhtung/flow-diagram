// The docked side panels share one header strip, so their headers line up
// whether or not they carry a close button.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InspectorColumn } from '@/components/editor/InspectorSidebar';
import { PanelHeader } from '@/components/PanelHeader';

const strip = (html: string) => html.match(/<div data-slot="panel-header" class="([^"]*)"/)?.[1];

describe('PanelHeader', () => {
  it('has one fixed height with or without a close button', () => {
    const plain = renderToStaticMarkup(createElement(PanelHeader, { icon: null, label: 'Narration preview' }));
    const closable = renderToStaticMarkup(createElement(PanelHeader, { icon: null, label: 'Inspector', onClose: () => {}, closeLabel: 'Close the inspector' }));
    expect(strip(plain)).toContain('h-9');
    expect(strip(plain)).toBe(strip(closable));
    expect(closable).toContain('aria-label="Close the inspector"');
  });

  it('is the strip the Inspector column uses', () => {
    const html = renderToStaticMarkup(createElement(InspectorColumn, { ariaLabel: 'Inspector', onClose: () => {} } as Parameters<typeof InspectorColumn>[0], 'x'));
    expect(html).toContain('data-slot="panel-header"');
  });
});
