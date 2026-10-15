import { describe, expect, it } from 'vitest';
import { FRAGMENT_KIND, FRAGMENT_VERSION, PASTE_OFFSET, buildFragment, insertFragment, mergeEdgeStyles, parseFragment, serializeFragment, type DiagramFragment } from './clipboard-fragment';
import type { EdgeStyleClass, FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';

function block(id: string, x: number, y: number, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, type: 'process', title: id.toUpperCase(), position: { x, y }, width: 120, height: 60, ...extra };
}

function line(id: string, from: string, to: string, extra: Partial<FlowEdge> = {}): FlowEdge {
  return { id, from, to, ...extra };
}

const ASYNC: EdgeStyleClass = { id: 'async', name: 'Async / event', color: '#a78bfa', width: 2, lineStyle: 'dashed', endMarker: 'arrow', effect: 'dots' };
const PRIMARY: EdgeStyleClass = { id: 'primary', name: 'Primary flow', color: '#38bdf8', width: 2.5 };

/** A frame holding a nested frame, lines inside and leaving it, and two loose blocks. */
function source(): FlowDocumentJSON {
  return {
    nodes: [
      block('frame', 400, 300, { type: 'group', width: 800, height: 400, sortOrder: 1 }),
      block('inner', 300, 300, { type: 'group', width: 300, height: 200, parentId: 'frame', sortOrder: 2 }),
      block('m1', 250, 300, { parentId: 'inner', sortOrder: 3 }),
      block('m2', 600, 300, { parentId: 'frame', sortOrder: 4 }),
      block('a', 1200, 100, { sortOrder: 5 }),
      block('b', 1400, 100, { sortOrder: 5 }),
      block('c', 1600, 100, { sortOrder: 6 }),
    ],
    edges: [
      line('inside', 'm1', 'm2', { styleRef: 'async' }),
      line('leaving', 'm2', 'a', { styleRef: 'primary' }),
      line('ab', 'a', 'b', { styleRef: 'async' }),
      line('bc', 'b', 'c'),
    ],
    settings: { runMode: 'concurrent', edgeStyles: [PRIMARY, ASYNC] },
  };
}

const empty = (): FlowDocumentJSON => ({ nodes: [], edges: [] });
const byId = (doc: FlowDocumentJSON, id: string) => doc.nodes.find((node) => node.id === id)!;

describe('buildFragment', () => {
  it('takes a selected frame with its whole subtree, nested frames included', () => {
    const fragment = buildFragment(source(), ['frame'])!;
    expect(fragment.nodes.map((node) => node.id)).toEqual(['frame', 'inner', 'm1', 'm2']);
  });

  it('keeps only lines with both ends inside, and only the styles those lines use', () => {
    const fragment = buildFragment(source(), ['frame'])!;
    expect(fragment.edges.map((edge) => edge.id)).toEqual(['inside']);
    expect(fragment.edgeStyles).toEqual([ASYNC]);
  });

  it('two elements with a line between them and a line leaving them → the one line', () => {
    const fragment = buildFragment(source(), ['a', 'b'])!;
    expect(fragment.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(fragment.edges.map((edge) => edge.id)).toEqual(['ab']);
  });

  it('a selected member does not drag its frame along, and an empty or unknown selection is null', () => {
    expect(buildFragment(source(), ['m1'])!.nodes.map((node) => node.id)).toEqual(['m1']);
    expect(buildFragment(source(), [])).toBeNull();
    expect(buildFragment(source(), ['nope'])).toBeNull();
  });
});

describe('serializeFragment / parseFragment', () => {
  it('round-trips through the versioned envelope, which is itself a Diagram JSON document', () => {
    const fragment = buildFragment(source(), ['a', 'b'])!;
    const text = serializeFragment(fragment);
    const raw = JSON.parse(text);
    expect(raw.kind).toBe(FRAGMENT_KIND);
    expect(raw.version).toBe(FRAGMENT_VERSION);
    expect(raw.settings.edgeStyles).toEqual([ASYNC]);
    expect(parseFragment(text)).toEqual({ ok: true, fragment, fixes: [] });
  });

  it('repairs values outside the vocabulary instead of refusing the paste, and lists them', () => {
    const text = JSON.stringify({
      nodes: [
        { id: 'l', type: 'line', title: '', position: { x: 0, y: 0 }, width: 100, height: 40, lineStart: 'top-left' },
        { id: 'b', type: 'process', title: 'B', position: { x: 200, y: 0 }, shape: 'blob' },
      ],
      edges: [],
    });
    const result = parseFragment(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fragment.nodes[0].lineStart).toBe('nw');
    expect(result.fragment.nodes[1]).not.toHaveProperty('shape');
    expect(result.fixes).toHaveLength(2);
  });

  it('refuses an unknown element type with the valid ones', () => {
    const result = parseFragment(JSON.stringify({ nodes: [{ id: 'x', type: 'database', title: 'X', position: { x: 0, y: 0 } }], edges: [] }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('unknown type "database"') });
  });

  it('accepts a full saved document, ignoring settings other than line styles', () => {
    const result = parseFragment(JSON.stringify(source()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fragment.nodes).toHaveLength(7);
    expect(result.fragment.edgeStyles).toEqual([PRIMARY, ASYNC]);
    expect(result.fragment).not.toHaveProperty('settings');
  });

  it('accepts a bare hand-written fragment — no edge ids, empty icon title, top-level edgeStyles', () => {
    const text = JSON.stringify({
      nodes: [
        { id: 'x', type: 'process', title: 'X', position: { x: 0, y: 0 } },
        { id: 'logo', type: 'icon', title: '', position: { x: 200, y: 0 } },
      ],
      edges: [{ from: 'x', to: 'logo', styleRef: 'async' }, { from: 'x', to: 'elsewhere' }],
      edgeStyles: [ASYNC],
    });
    const result = parseFragment(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The line to a node that isn't in the fragment is dropped.
    expect(result.fragment.edges).toEqual([{ from: 'x', to: 'logo', styleRef: 'async' }]);
    expect(result.fragment.edgeStyles).toEqual([ASYNC]);
  });

  it.each([
    ['plain text', 'hello world'],
    ['empty', '   '],
    ['a JSON string', '"nodes"'],
    ['an array', '[1, 2]'],
    ['an object without nodes', '{"foo": 1}'],
    ['no elements', '{"nodes": [], "edges": []}'],
    ['a node without position', '{"nodes": [{"id": "a", "type": "process", "title": "A"}], "edges": []}'],
    ['duplicate node ids', '{"nodes": [{"id": "a", "type": "process", "title": "A", "position": {"x": 0, "y": 0}}, {"id": "a", "type": "process", "title": "B", "position": {"x": 1, "y": 1}}], "edges": []}'],
    ['a newer envelope', JSON.stringify({ kind: FRAGMENT_KIND, version: FRAGMENT_VERSION + 1, nodes: [block('a', 0, 0)], edges: [] })],
  ])('rejects %s with a message', (_label, text) => {
    const result = parseFragment(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('insertFragment', () => {
  it('re-ids every element and line and remaps parentId and from/to inside the copy', () => {
    const doc = source();
    const fragment = buildFragment(doc, ['frame'])!;
    const { doc: next, nodeIds, idMap } = insertFragment(doc, fragment, { idStamp: 't' });
    expect(nodeIds).toHaveLength(4);
    const originalIds = new Set(doc.nodes.map((node) => node.id));
    for (const id of nodeIds) expect(originalIds.has(id)).toBe(false);
    expect(new Set(next.nodes.map((node) => node.id)).size).toBe(next.nodes.length);
    expect(new Set(next.edges.map((edge) => edge.id)).size).toBe(next.edges.length);

    expect(byId(next, idMap.get('inner')!).parentId).toBe(idMap.get('frame'));
    expect(byId(next, idMap.get('m1')!).parentId).toBe(idMap.get('inner'));
    expect(byId(next, idMap.get('m2')!).parentId).toBe(idMap.get('frame'));
    const copiedLine = next.edges.at(-1)!;
    expect(copiedLine).toMatchObject({ from: idMap.get('m1'), to: idMap.get('m2'), styleRef: 'async' });
    // The original is untouched.
    expect(next.nodes.slice(0, doc.nodes.length)).toEqual(doc.nodes);
    expect(doc.nodes).toHaveLength(7);
  });

  it('pasting into the same diagram offsets the copy; pasting again offsets it again', () => {
    const doc = source();
    const fragment = buildFragment(doc, ['a'])!;
    const first = insertFragment(doc, fragment, { idStamp: '1' });
    expect(byId(first.doc, first.nodeIds[0]).position).toEqual({ x: 1200 + PASTE_OFFSET, y: 100 + PASTE_OFFSET });
    const second = insertFragment(first.doc, fragment, { idStamp: '2' });
    expect(byId(second.doc, second.nodeIds[0]).position).toEqual({ x: 1200 + 2 * PASTE_OFFSET, y: 100 + 2 * PASTE_OFFSET });
  });

  it('pasting into another diagram keeps the copied coordinates', () => {
    const fragment = buildFragment(source(), ['a', 'b'])!;
    const { doc, nodeIds } = insertFragment(empty(), fragment);
    expect(nodeIds.map((id) => byId(doc, id).position)).toEqual([
      { x: 1200, y: 100 },
      { x: 1400, y: 100 },
    ]);
    expect(doc.edges).toHaveLength(1);
  });

  it('drops a line whose ends are not both in the fragment', () => {
    const fragment: DiagramFragment = { nodes: [block('a', 0, 0), block('b', 100, 0)], edges: [line('ab', 'a', 'b'), line('ax', 'a', 'x')], edgeStyles: [] };
    expect(insertFragment(empty(), fragment).doc.edges).toHaveLength(1);
  });

  it('a top-level copy joins the frame it lands in, like a drop; a copy landing nowhere has no parent', () => {
    const doc = source();
    // m2 is inside `frame`; its offset copy is still inside it.
    const inFrame = insertFragment(doc, buildFragment(doc, ['m2'])!);
    expect(byId(inFrame.doc, inFrame.nodeIds[0]).parentId).toBe('frame');
    // Pasted into an empty diagram, the same element has no frame to join.
    const elsewhere = insertFragment(empty(), buildFragment(doc, ['m2'])!);
    expect(byId(elsewhere.doc, elsewhere.nodeIds[0])).not.toHaveProperty('parentId');
  });

  it('keeps relative Replay order and starts it after the target’s last step', () => {
    const doc = source(); // last sortOrder is 6
    const { doc: next, nodeIds } = insertFragment(doc, buildFragment(doc, ['a', 'b', 'c'])!);
    // a and b shared a step (5), c came after (6): still so, now 7/7/8.
    expect(nodeIds.map((id) => byId(next, id).sortOrder)).toEqual([7, 7, 8]);
  });

  it('gives hand-written blocks without sortOrder steps after the target’s, and leaves scenery unordered', () => {
    const fragment: DiagramFragment = { nodes: [block('x', 0, 0), { id: 't', type: 'text', title: 'Note', position: { x: 0, y: 100 } }, block('y', 200, 0)], edges: [], edgeStyles: [] };
    const doc = source();
    const { doc: next, nodeIds } = insertFragment(doc, fragment);
    expect(nodeIds.map((id) => byId(next, id).sortOrder)).toEqual([7, undefined, 8]);
  });

  it('appends titleSuffix to top-level copies only', () => {
    const doc = source();
    const { doc: next, idMap } = insertFragment(doc, buildFragment(doc, ['inner'])!, { titleSuffix: ' copy' });
    expect(byId(next, idMap.get('inner')!).title).toBe('INNER copy');
    expect(byId(next, idMap.get('m1')!).title).toBe('M1');
  });
});

describe('line style merge on paste', () => {
  const withStyles = (styles: EdgeStyleClass[]): FlowDocumentJSON => ({ nodes: [], edges: [], settings: { edgeStyles: styles } });
  const asyncFragment = (): DiagramFragment => buildFragment(source(), ['a', 'b'])!;

  it('adds a missing style so the pasted line looks identical to the original', () => {
    const { doc } = insertFragment(empty(), asyncFragment());
    expect(doc.settings?.edgeStyles).toEqual([ASYNC]);
    expect(doc.edges[0].styleRef).toBe('async');
  });

  it('reuses an identical style instead of adding a second one', () => {
    const { doc } = insertFragment(withStyles([ASYNC]), asyncFragment());
    expect(doc.settings?.edgeStyles).toEqual([ASYNC]);
    expect(doc.edges[0].styleRef).toBe('async');
  });

  it('reuses an identical style that lives under a different id', () => {
    const { doc } = insertFragment(withStyles([{ ...ASYNC, id: 'style-9' }]), asyncFragment());
    expect(doc.settings?.edgeStyles).toHaveLength(1);
    expect(doc.edges[0].styleRef).toBe('style-9');
  });

  it('an id clash with a different style gets a new id; the target’s own style is untouched', () => {
    const theirs: EdgeStyleClass = { id: 'async', name: 'Queue', color: '#ff0000' };
    const { doc } = insertFragment(withStyles([theirs]), asyncFragment());
    const styles = doc.settings!.edgeStyles!;
    expect(styles[0]).toEqual(theirs);
    expect(styles[1]).toMatchObject({ ...ASYNC, id: expect.not.stringMatching(/^async$/) });
    expect(doc.edges[0].styleRef).toBe(styles[1].id);
  });

  it('a name clash with different props gets a de-duplicated name', () => {
    const theirs: EdgeStyleClass = { id: 'other', name: 'Async / event', color: '#ff0000' };
    const { doc } = insertFragment(withStyles([theirs]), asyncFragment());
    const styles = doc.settings!.edgeStyles!;
    expect(styles.map((style) => style.name)).toEqual(['Async / event', 'Async / event (2)']);
    expect(styles[1].id).toBe('async');
    expect(doc.edges[0].styleRef).toBe('async');
  });

  it('mergeEdgeStyles numbers names past existing (2)s', () => {
    const { styles } = mergeEdgeStyles(
      [
        { id: 'a', name: 'X', color: '#111111' },
        { id: 'b', name: 'X (2)', color: '#222222' },
      ],
      [{ id: 'a', name: 'X', color: '#333333' }],
    );
    expect(styles.at(-1)).toMatchObject({ name: 'X (3)', color: '#333333' });
    expect(new Set(styles.map((style) => style.id)).size).toBe(3);
  });

  it('a reference to a style neither side defines is cleared rather than left dangling', () => {
    const fragment: DiagramFragment = { nodes: [block('a', 0, 0), block('b', 100, 0)], edges: [line('ab', 'a', 'b', { styleRef: 'ghost' })], edgeStyles: [] };
    expect(insertFragment(empty(), fragment).doc.edges[0]).not.toHaveProperty('styleRef');
    // …but it is kept when it names one of the target's own styles.
    expect(insertFragment(withStyles([PRIMARY]), { ...fragment, edges: [line('ab', 'a', 'b', { styleRef: 'primary' })] }).doc.edges[0].styleRef).toBe('primary');
  });

  it('does not touch the target’s settings when no style is added', () => {
    const target = { ...empty(), settings: { runMode: 'manual' as const } };
    const fragment = buildFragment(source(), ['b', 'c'])!; // `bc` has no style
    expect(insertFragment(target, fragment).doc.settings).toBe(target.settings);
  });
});

describe('a pasted full document', () => {
  it('adds to the canvas instead of replacing it', () => {
    const target: FlowDocumentJSON = { nodes: [block('keep', 0, 0)], edges: [], settings: { runMode: 'manual' } };
    const parsed = parseFragment(JSON.stringify(source()));
    if (!parsed.ok) throw new Error(parsed.error);
    const { doc } = insertFragment(target, parsed.fragment);
    expect(doc.nodes).toHaveLength(8);
    expect(doc.nodes[0]).toEqual(target.nodes[0]);
    expect(doc.edges).toHaveLength(4);
    expect(doc.settings?.runMode).toBe('manual');
  });
});
