import { describe, expect, it } from 'vitest';
import { contentBounds, EXPORT_MARGIN, exportPixelSize, exportScope, imageFilename, MARKER_EXTENT, samplePathPoints } from './image-export';
import type { FlowDocumentJSON, FlowNode } from './flowchart-types';

const block = (id: string, x: number, y: number, extra: Partial<FlowNode> = {}): FlowNode => ({ id, type: 'process', title: id, position: { x, y }, width: 100, height: 80, ...extra });

describe('contentBounds', () => {
  it('is null for an empty Diagram', () => {
    expect(contentBounds({ nodes: [], edges: [] })).toBeNull();
  });

  it('wraps a single Block with the margin on every side', () => {
    const box = contentBounds({ nodes: [block('a', 0, 0)], edges: [] }, 10);
    // 100×80 centred on the origin, plus half a border of slack.
    expect(box!.x).toBeLessThanOrEqual(-60);
    expect(box!.x).toBeGreaterThanOrEqual(-62);
    expect(box!.y).toBeLessThanOrEqual(-50);
    expect(box!.x + box!.width).toBeGreaterThanOrEqual(60);
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(50);
    expect(box!.width).toBeLessThanOrEqual(124);
  });

  it('uses EXPORT_MARGIN by default and returns whole units', () => {
    const box = contentBounds({ nodes: [block('a', 0.3, 0.7)], edges: [] })!;
    expect(box.x).toBeLessThanOrEqual(0.3 - 50 - EXPORT_MARGIN);
    for (const value of Object.values(box)) expect(Number.isInteger(value)).toBe(true);
  });

  it('includes an Element far outside any viewport', () => {
    const box = contentBounds({ nodes: [block('a', 0, 0), block('far', 9000, -4000)], edges: [] }, 0)!;
    expect(box.x + box.width).toBeGreaterThanOrEqual(9050);
    expect(box.y).toBeLessThanOrEqual(-4030);
  });

  it('includes a rotated Element’s corners', () => {
    const straight = contentBounds({ nodes: [block('a', 0, 0, { width: 300 })], edges: [] }, 0)!;
    const tilted = contentBounds({ nodes: [block('a', 0, 0, { width: 300, rotation: 90 })], edges: [] }, 0)!;
    expect(straight.height).toBeLessThan(90);
    expect(tilted.height).toBeGreaterThanOrEqual(300);
  });

  it('reaches a Line label that hangs off the route', () => {
    const doc: FlowDocumentJSON = {
      nodes: [block('a', 0, 0), block('b', 400, 0)],
      edges: [{ id: 'e', from: 'a', to: 'b', fromSide: 'right', toSide: 'left', routing: 'straight', label: 'a fairly long label', labelPosition: 'bottom', labelFontSize: 20 }],
    };
    const withoutLabel = contentBounds({ ...doc, edges: [{ ...doc.edges[0], label: undefined }] }, 0)!;
    const withLabel = contentBounds(doc, 0)!;
    // Blocks reach y≈+41; a bottom label sits 26 below the line plus half its chip.
    expect(withoutLabel.y + withoutLabel.height).toBeLessThanOrEqual(42);
    expect(withLabel.y + withLabel.height).toBeGreaterThan(withoutLabel.y + withoutLabel.height);
    expect(withLabel.x + withLabel.width).toBeGreaterThan(0);
  });

  it('reaches an end marker, and a Line style can supply it', () => {
    // A marker grows the box around the endpoint it sits on — with 20-wide
    // Blocks, sideways past the Blocks themselves.
    const base: FlowDocumentJSON = {
      nodes: [block('a', 0, 0), block('b', 0, 400)],
      edges: [{ id: 'e', from: 'a', to: 'b', fromSide: 'bottom', toSide: 'top', routing: 'straight' }],
    };
    const plain = contentBounds(base, 0)!;
    expect(plain.width).toBeLessThanOrEqual(104);
    const marked = contentBounds({ ...base, nodes: [block('a', 0, 0, { width: 20 }), block('b', 0, 400, { width: 20 })], edges: [{ ...base.edges[0], endMarker: 'arrow' }] }, 0)!;
    expect(marked.width).toBeGreaterThanOrEqual(MARKER_EXTENT * 2);
    const styled = contentBounds(
      {
        nodes: [block('a', 0, 0, { width: 20 }), block('b', 0, 400, { width: 20 })],
        edges: [{ ...base.edges[0], styleRef: 's' }],
        settings: { edgeStyles: [{ id: 's', name: 'Arrowed', endMarker: 'arrow' }] },
      },
      0,
    )!;
    expect(styled.width).toBe(marked.width);
  });

  it('follows a curved route’s bulge, not just its endpoints', () => {
    const doc: FlowDocumentJSON = {
      nodes: [block('a', 0, 0), block('b', 300, 0)],
      // Both ports face up, so the curve bows well above the Blocks.
      edges: [{ id: 'e', from: 'a', to: 'b', fromSide: 'top', toSide: 'top', routing: 'curved' }],
    };
    const box = contentBounds(doc, 0)!;
    expect(box.y).toBeLessThan(-40 - 30);
  });

  it('includes a Free line’s markers', () => {
    const line: FlowNode = { id: 'l', type: 'line', title: '', position: { x: 0, y: 0 }, width: 200, height: 0, endMarker: 'arrow' };
    const box = contentBounds({ nodes: [line], edges: [] }, 0)!;
    expect(box.x + box.width).toBeGreaterThanOrEqual(100 + MARKER_EXTENT);
    expect(box.height).toBeGreaterThanOrEqual(MARKER_EXTENT * 2);
  });
});

describe('exportScope', () => {
  const doc: FlowDocumentJSON = {
    nodes: [block('a', 0, 0), block('b', 200, 0), block('c', 400, 0), { id: 'f', type: 'group', title: 'F', position: { x: 0, y: 300 }, width: 300, height: 200 }, block('m', 0, 300, { parentId: 'f' })],
    edges: [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
      { id: 'am', from: 'a', to: 'm' },
    ],
    settings: { runMode: 'sequential', edgeStyles: [{ id: 's', name: 'S', color: '#f00' }] },
  };

  it('is the whole Diagram without a selection', () => {
    expect(exportScope(doc, null)).toBe(doc);
    expect(exportScope(doc, [])).toBe(doc);
  });

  it('keeps only the selected Elements and the Lines with both ends selected', () => {
    const scope = exportScope(doc, ['a', 'b']);
    expect(scope.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(scope.edges.map((edge) => edge.id)).toEqual(['ab']);
    expect(scope.settings).toBe(doc.settings);
  });

  it('brings a selected Frame’s contents', () => {
    const scope = exportScope(doc, ['f', 'a']);
    expect(scope.nodes.map((node) => node.id).sort()).toEqual(['a', 'f', 'm']);
    expect(scope.edges.map((edge) => edge.id)).toEqual(['am']);
  });

  it('is empty when the selection names nothing that exists', () => {
    expect(exportScope(doc, ['ghost']).nodes).toEqual([]);
  });

  it('crops the picture to the selection', () => {
    const whole = contentBounds(doc)!;
    const part = contentBounds(exportScope(doc, ['a', 'b']))!;
    expect(part.width).toBeLessThan(whole.width);
    expect(part.height).toBeLessThan(whole.height);
  });
});

describe('samplePathPoints', () => {
  it('reads polylines and samples curves', () => {
    expect(samplePathPoints('M 0 0 L 10 0 L 10 5')).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ]);
    const curve = samplePathPoints('M 0 0 C 0 -100, 100 -100, 100 0');
    expect(Math.min(...curve.map((point) => point.y))).toBeCloseTo(-75, 0);
  });
});

describe('exportPixelSize', () => {
  it('doubles a PNG and leaves an SVG at 1×', () => {
    expect(exportPixelSize({ x: 0, y: 0, width: 300, height: 200 }, 'png')).toEqual({ width: 600, height: 400 });
    expect(exportPixelSize({ x: 0, y: 0, width: 300, height: 200 }, 'svg')).toEqual({ width: 300, height: 200 });
  });
});

describe('imageFilename', () => {
  it('uses the Diagram name with the format’s extension', () => {
    expect(imageFilename('Checkout flow', 'png')).toBe('Checkout flow.png');
    expect(imageFilename('Checkout flow', 'svg', true)).toBe('Checkout flow-selection.svg');
  });

  it('removes characters file systems reject and keeps other scripts', () => {
    expect(imageFilename('a/b\\c:d*e?f"g<h>i|j', 'png')).toBe('a b c d e f g h i j.png');
    expect(imageFilename('Sơ đồ   thanh toán\n', 'svg')).toBe('Sơ đồ thanh toán.svg');
    expect(imageFilename('..hidden..', 'png')).toBe('hidden.png');
  });

  it('falls back to "diagram" and caps the length', () => {
    expect(imageFilename('  ', 'png')).toBe('diagram.png');
    expect(imageFilename('///', 'svg')).toBe('diagram.svg');
    expect(imageFilename('x'.repeat(300), 'png')).toBe(`${'x'.repeat(100)}.png`);
  });
});
