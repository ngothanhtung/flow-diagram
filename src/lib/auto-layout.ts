import { buildEdgeGeometry, facingSides, nodePortAnchor } from '@/components/edge-geometry';
import { edgeLabelBox, resolveEdgeLabelStyle } from './edge-label-style';
import { resolveEdgeStyle, edgeStylesOf } from './edge-style';
import type { ConnectionSide, FlowDocumentJSON, FlowEdge, FlowNode, FlowPoint } from './flowchart-types';
import { endpointsOfLine } from './line-geometry';
import { networkSimplex, type SimplexEdge } from './network-simplex';
import { GROUP_HEADER_HEIGHT, GROUP_MIN_SIZE, GROUP_PADDING, resolveNodeStyle } from './node-style';
import { descendantIds, groupGeometryFor } from './node-tree';

/**
 * Auto-layout — the "arrange this Diagram" command (PRD v0.3 §4.3), also
 * how Mermaid import and the Starters place what they build.
 *
 * A layered (Sugiyama) layout, done properly enough that the result reads
 * better than a hand arrangement rather than merely tidier:
 *
 * 1. **Ranks.** Back edges are found by a DFS that visits Elements in
 *    replay order (`sortOrder`), so the flow the author meant is the one
 *    kept; ranks are longest-path, with sources pulled down next to what
 *    they feed so they don't trail a long Line behind them. A *shared
 *    service* — a sink called from ranks two or more apart that the
 *    replay lists before one of its callers (an auth service, a log
 *    store) — sits under its earliest caller instead of at the bottom,
 *    and the deeper calls run upwards.
 * 2. **Lanes.** A Line spanning several ranks gets a dummy slot in every
 *    rank it passes, so it travels in a lane of its own instead of
 *    through the Blocks in between. A back edge (a loop) gets a lane
 *    glued beside both its ends and runs port-to-port on the side, so it
 *    never shares a port point — or a route — with the forward flow.
 * 3. **Order.** Median sweeps plus adjacent transposition, best result
 *    kept, starting from the user's own order so ties keep their picture.
 * 4. **Across coordinate.** Network simplex (`network-simplex.ts`), the
 *    method `dot` uses: every Line pulls its two ends into line, lanes pull
 *    hardest. 1-in/1-out chains and lanes are merged into rigid columns
 *    first, so they are *exactly* straight rather than nearly.
 * 5. **Routes.** Every horizontal jog of every Line is given a track in
 *    the gap between two ranks, ordered so verticals don't cut across
 *    other jogs, and the gap grows to fit its tracks and labels. A Line
 *    only gets `bendPoints` when the app's own router would draw it
 *    differently from the planned route; otherwise it keeps the plain
 *    port-to-port form a user can drag around freely.
 * 6. **Search.** Steps 3–5 run as whole passes. A Frame's inside is
 *    ordered before its surroundings exist, so later passes try other
 *    orders for the terminals on each Frame's border, and restart from a
 *    couple of other starting orders, keeping whichever pass draws the
 *    fewest crossings (counted on the routes as drawn, rounded corners
 *    included). The pass count is fixed, so the result never depends on
 *    how fast the machine is.
 *
 * **Frames** are laid out bottom-up: a Frame's members are arranged inside
 * it first, the Frame is fitted around them, then placed as one rigid
 * block among its siblings. A Line that crosses a Frame's border enters
 * through a *terminal* on the Frame's top or bottom edge, and the
 * terminal gets a lane inside the Frame like any long Line — that's what
 * keeps a Line from a Block outside to a Block deep inside from crossing
 * the Blocks it passes.
 *
 * **Scenery** — Text, Icon and Free line — never moves. A Frame that holds
 * any scenery stays where it is too, contents and all: moving it would
 * either leave the scenery behind outside it or move scenery the user
 * placed. The laid-out part is shifted, as one piece, the smallest
 * distance that keeps it clear of everything that stays put.
 *
 * Pure: takes a document, returns a new one. The store applies it as one
 * write, so the whole layout is one undo step.
 */

export type LayoutDirection = 'TB' | 'LR';

export interface AutoLayoutOptions {
  direction: LayoutDirection;
  /** Lay out only these Elements (Frames take their contents). Empty or
   *  absent = the whole Diagram. */
  selection?: readonly string[];
  /** Put the top-left of the laid-out block here instead of where the
   *  laid-out Elements were. Used by the importer, whose nodes have no
   *  position yet. */
  origin?: FlowPoint;
}

export interface AutoLayoutResult {
  document: FlowDocumentJSON;
  /** Elements whose position or size changed. */
  movedNodeIds: string[];
}

// --- Fixed spacing ----------------------------------------------------------
// One set of numbers, no options (PRD: "Khoảng cách cố định").

/** Across the flow, between two Elements in the same rank. */
const NODE_GAP = 48;
/** Across the flow, between an Element and a Line lane passing it. */
const LANE_GAP = 24;
/** Between two neighbouring lanes. */
const LANE_LANE_GAP = 14;
/** A loop leaves its side port and runs this far out before turning. */
const SIDE_LEAD = 28;
/** Down the flow, the least gap between two ranks. */
const RANK_GAP = 72;
/** Distance between two parallel jogs in one gap. */
const TRACK_SPACING = 14;
/** How close a jog may come to the ranks on either side of its gap. */
const TRACK_MARGIN = 24;
/** Breathing room around a Line label sitting in a gap. */
const LABEL_MARGIN = 28;
/** How far the laid-out block keeps from Elements that stay put. */
const OBSTACLE_MARGIN = 16;
/** Granularity of the search for a clear spot. */
const PLACEMENT_STEP = 20;
const PLACEMENT_RINGS = 120;
const ORDER_ITERATIONS = 24;
/** How many ranks apart a sink's callers must be before it counts as a
 *  shared service (see `rankContainer`). */
const SHARED_SINK_SPREAD = 2;
/** Extra whole passes spent searching Frame border orders. */
const PASS_BUDGET = 20;
/** Restarting the order search from other starting orders is only worth
 *  its time on Diagrams up to this many Elements. */
const RESTART_LIMIT = 50;

type PortSide = 'in' | 'out' | 'side';

interface AlongAcross {
  along: number;
  across: number;
}

interface Axes {
  direction: LayoutDirection;
  toScreen(point: AlongAcross): FlowPoint;
  fromScreen(point: FlowPoint): AlongAcross;
  screenSide(side: PortSide): ConnectionSide;
}

function axesFor(direction: LayoutDirection): Axes {
  const tb = direction === 'TB';
  return {
    direction,
    toScreen: (point) => (tb ? { x: point.across, y: point.along } : { x: point.along, y: point.across }),
    fromScreen: (point) => (tb ? { along: point.y, across: point.x } : { along: point.x, across: point.y }),
    screenSide: (side) => (side === 'in' ? (tb ? 'top' : 'left') : side === 'out' ? (tb ? 'bottom' : 'right') : tb ? 'right' : 'bottom'),
  };
}

const SCENERY = new Set(['text', 'icon', 'line']);

// --- The container tree -----------------------------------------------------

/** One level of the layout: the units laid out side by side, either the
 *  top level (the whole Diagram, or one parent's share of a selection) or
 *  the inside of a Frame. */
interface Container {
  id: string;
  frame?: FlowNode;
  units: string[];
  depth: number;
  /** Original edges whose lowest common container is this one. */
  arcs: Array<{ edge: FlowEdge; from: string; to: string }>;
  rank: Map<string, number>;
  reversed: Set<string>;
  pieces: Map<string, Piece>;
  /** Terminal id → kind, for a Frame's interior. */
  terminals: Map<string, 'in' | 'out'>;
  geometry?: LevelGeometry;
}

interface Endpoint {
  unit: string;
  side: PortSide;
  /** When `unit` is a Frame the Line continues inside: which terminal. */
  term?: string;
}

/** One Line's passage through one level. `tail` is always the end with
 *  the smaller rank. */
interface Piece {
  key: string;
  tail: Endpoint;
  head: Endpoint;
  scheme: 'normal' | 'side';
  label?: { along: number; across: number };
}

interface EdgePlan {
  edge: FlowEdge;
  /** The pieces this Line is made of, in order from its source to its
   *  target; `forward` says whether that order runs tail → head. */
  steps: Array<{ container: Container; piece: string; forward: boolean }>;
  fromSide: PortSide;
  toSide: PortSide;
}

interface LevelGeometry {
  /** Centre of every item (unit, dummy, terminal), local coordinates. */
  centre: Map<string, AlongAcross>;
  /** Each piece's route, tail → head, local coordinates. */
  routes: Map<string, AlongAcross[]>;
  /** Extent of the level — for a Frame, its whole box. */
  box: { alongMin: number; alongMax: number; acrossMin: number; acrossMax: number };
  /** The order the border terminals ended up in, per terminal rank. */
  terminalOrder: Map<number, string[]>;
}

/** Fixed border-terminal orders, per container id and terminal rank. */
type TerminalOrders = Map<string, Map<number, string[]>>;

// --- Entry points -----------------------------------------------------------

function isMovableKind(node: FlowNode) {
  return !SCENERY.has(node.type);
}

/** Frames holding scenery stay put — see the module comment. */
function pinnedFrames(doc: FlowDocumentJSON): Set<string> {
  const pinned = new Set<string>();
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  for (const node of doc.nodes) {
    if (node.type !== 'group') continue;
    for (const id of descendantIds(doc.nodes, node.id)) {
      const member = byId.get(id);
      if (member && SCENERY.has(member.type)) {
        pinned.add(node.id);
        break;
      }
    }
  }
  return pinned;
}

/** Elements the command would lay out for this selection (or the whole
 *  Diagram) — what the UI uses to decide whether to offer it. */
export function layoutableNodeIds(doc: FlowDocumentJSON, selection?: readonly string[]): string[] {
  const pinned = pinnedFrames(doc);
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  const fixed = new Set<string>();
  for (const id of pinned) {
    fixed.add(id);
    for (const inner of descendantIds(doc.nodes, id)) fixed.add(inner);
  }
  const candidates = selection && selection.length > 0 ? selection.map((id) => byId.get(id)).filter((node): node is FlowNode => Boolean(node)) : doc.nodes;
  return candidates.filter((node) => isMovableKind(node) && !fixed.has(node.id)).map((node) => node.id);
}

/**
 * What the command arranges for a given selection: the selection itself
 * when it is two or more Elements (or a single Frame — its contents),
 * otherwise the whole Diagram (`[]`). A lone clicked Block is not a
 * request to arrange one Block.
 */
export function autoLayoutScope(doc: FlowDocumentJSON, selectedIds: readonly string[]): string[] {
  if (selectedIds.length >= 2) return [...selectedIds];
  if (selectedIds.length === 1 && doc.nodes.find((node) => node.id === selectedIds[0])?.type === 'group') return [...selectedIds];
  return [];
}

/** Whether the command has anything to arrange for this selection. */
export function canAutoLayout(doc: FlowDocumentJSON, selectedIds: readonly string[]): boolean {
  const scope = autoLayoutScope(doc, selectedIds);
  const ids = layoutableNodeIds(doc, scope);
  if (scope.length === 0) return ids.length > 0;
  return ids.length >= 2 || ids.some((id) => doc.nodes.some((node) => node.parentId === id));
}

export function autoLayout(doc: FlowDocumentJSON, options: AutoLayoutOptions): AutoLayoutResult {
  const axes = axesFor(options.direction);
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  const docIndex = new Map(doc.nodes.map((node, index) => [node.id, index]));
  const styles = edgeStylesOf(doc.settings);

  // Which nodes may move at all.
  const fixed = new Set<string>();
  for (const id of pinnedFrames(doc)) {
    fixed.add(id);
    for (const inner of descendantIds(doc.nodes, id)) fixed.add(inner);
  }
  const movable = (node: FlowNode | undefined): node is FlowNode => Boolean(node) && isMovableKind(node!) && !fixed.has(node!.id);
  const parentOf = (node: FlowNode) => (node.parentId && byId.get(node.parentId)?.type === 'group' ? node.parentId : null);

  // --- Build the container tree.
  const containers: Container[] = [];
  const containerOfUnit = new Map<string, Container>();
  const interiorOf = new Map<string, Container>();
  const newContainer = (id: string, units: string[], depth: number, frame?: FlowNode): Container => {
    const container: Container = { id, frame, units, depth, arcs: [], rank: new Map(), reversed: new Set(), pieces: new Map(), terminals: new Map() };
    containers.push(container);
    for (const unit of units) containerOfUnit.set(unit, container);
    return container;
  };
  const addInteriors = (container: Container) => {
    for (const unitId of container.units) {
      const unit = byId.get(unitId)!;
      if (unit.type !== 'group') continue;
      const children = doc.nodes.filter((node) => node.parentId === unit.id && movable(node)).map((node) => node.id);
      if (children.length === 0) continue;
      const interior = newContainer(unit.id, children, container.depth + 1, unit);
      interiorOf.set(unit.id, interior);
      addInteriors(interior);
    }
  };

  const selection = (options.selection ?? []).filter((id) => byId.has(id));
  const topContainers: Container[] = [];
  if (selection.length === 0) {
    const units = doc.nodes.filter((node) => movable(node) && parentOf(node) === null).map((node) => node.id);
    if (units.length > 0) topContainers.push(newContainer('root', units, 0));
  } else {
    // A selected node whose ancestor Frame is also selected rides along
    // inside that Frame's own layout.
    const selected = new Set(selection.filter((id) => movable(byId.get(id))));
    const hasSelectedAncestor = (node: FlowNode) => {
      const seen = new Set<string>();
      let current = parentOf(node);
      while (current && !seen.has(current)) {
        if (selected.has(current)) return true;
        seen.add(current);
        current = parentOf(byId.get(current)!);
      }
      return false;
    };
    const groups = new Map<string, string[]>();
    for (const node of doc.nodes) {
      if (!selected.has(node.id) || hasSelectedAncestor(node)) continue;
      const key = parentOf(node) ?? '';
      groups.set(key, [...(groups.get(key) ?? []), node.id]);
    }
    for (const [parent, units] of groups) topContainers.push(newContainer(`group:${parent}`, units, 0));
  }
  for (const container of topContainers) addInteriors(container);
  if (containers.length === 0) return { document: doc, movedNodeIds: [] };

  const inForest = (id: string) => containerOfUnit.has(id);

  // --- Plan every Line.
  const chainOf = (id: string): Array<{ container: Container; unit: string }> => {
    const chain: Array<{ container: Container; unit: string }> = [];
    let unit = id;
    let container = containerOfUnit.get(id);
    while (container) {
      chain.push({ container, unit });
      if (!container.frame) break;
      unit = container.frame.id;
      container = containerOfUnit.get(unit);
    }
    return chain;
  };

  const planned: Array<{ edge: FlowEdge; s: string; t: string; sChain: ReturnType<typeof chainOf>; tChain: ReturnType<typeof chainOf>; lca: Container; uS: string; uT: string }> = [];
  const looseEdges = new Set<string>();
  for (const edge of doc.edges) {
    if (edge.from === edge.to || !byId.has(edge.from) || !byId.has(edge.to)) continue;
    const touchesForest = inForest(edge.from) || inForest(edge.to);
    if (!touchesForest) continue;
    const sChain = chainOf(edge.from);
    const tChain = chainOf(edge.to);
    const sIndex = sChain.findIndex((step) => tChain.some((other) => other.container === step.container));
    if (sIndex === -1) {
      looseEdges.add(edge.id);
      continue;
    }
    const lca = sChain[sIndex].container;
    const tIndex = tChain.findIndex((step) => step.container === lca);
    const uS = sChain[sIndex].unit;
    const uT = tChain[tIndex].unit;
    if (uS === uT) {
      looseEdges.add(edge.id);
      continue;
    }
    planned.push({ edge, s: edge.from, t: edge.to, sChain: sChain.slice(0, sIndex + 1), tChain: tChain.slice(0, tIndex + 1), lca, uS, uT });
    lca.arcs.push({ edge, from: uS, to: uT });
  }

  // --- Ranks, per container (sizes aren't needed yet).
  const orderKey = new Map<string, number>();
  const unitOrderKey = (id: string): number => {
    const cached = orderKey.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id)!;
    let key = typeof node.sortOrder === 'number' && Number.isFinite(node.sortOrder) ? node.sortOrder : Infinity;
    if (node.type === 'group') {
      for (const inner of descendantIds(doc.nodes, id)) {
        const member = byId.get(inner)!;
        if (typeof member.sortOrder === 'number' && Number.isFinite(member.sortOrder)) key = Math.min(key, member.sortOrder);
      }
    }
    orderKey.set(id, key);
    return key;
  };
  const byFlowOrder = (a: string, b: string) => {
    const ka = unitOrderKey(a);
    const kb = unitOrderKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return docIndex.get(a)! - docIndex.get(b)!;
  };

  for (const container of containers) rankContainer(container, byFlowOrder, unitOrderKey);

  // --- Pieces.
  const plans: EdgePlan[] = [];
  for (const entry of planned) {
    const { edge, s, t, sChain, tChain, lca, uS, uT } = entry;
    const reversed = lca.reversed.has(edge.id);
    const liftedS = uS !== s;
    const liftedT = uT !== t;
    let tail: Endpoint;
    let head: Endpoint;
    let scheme: Piece['scheme'] = 'normal';
    let sKind: 'in' | 'out';
    let tKind: 'in' | 'out';
    if (!reversed) {
      sKind = 'out';
      tKind = 'in';
      tail = { unit: uS, side: 'out', term: liftedS ? `out:${s}` : undefined };
      head = { unit: uT, side: 'in', term: liftedT ? `in:${t}` : undefined };
    } else if (!liftedS && !liftedT) {
      sKind = 'out';
      tKind = 'in';
      scheme = 'side';
      tail = { unit: uT, side: 'side' };
      head = { unit: uS, side: 'side' };
    } else {
      sKind = 'in';
      tKind = 'out';
      tail = { unit: uT, side: 'out', term: liftedT ? `out:${t}` : undefined };
      head = { unit: uS, side: 'in', term: liftedS ? `in:${s}` : undefined };
    }
    const label = edge.label ? labelSize(edge, axes) : undefined;
    const lcaKey = `E:${edge.id}`;
    lca.pieces.set(lcaKey, { key: lcaKey, tail, head, scheme, label });

    const steps: EdgePlan['steps'] = [];
    // Source side: from s outwards to the LCA level.
    for (let k = 0; k < sChain.length - 1; k += 1) {
      const container = sChain[k].container;
      const terminal = `T:${sKind}:${s}`;
      container.terminals.set(terminal, sKind);
      const unitEnd: Endpoint = { unit: sChain[k].unit, side: sKind, term: k > 0 ? `${sKind}:${s}` : undefined };
      const termEnd: Endpoint = { unit: terminal, side: sKind === 'out' ? 'in' : 'out' };
      if (!container.pieces.has(terminal)) {
        container.pieces.set(terminal, sKind === 'out' ? { key: terminal, tail: unitEnd, head: termEnd, scheme: 'normal' } : { key: terminal, tail: termEnd, head: unitEnd, scheme: 'normal' });
      }
      steps.push({ container, piece: terminal, forward: sKind === 'out' });
    }
    steps.push({ container: lca, piece: lcaKey, forward: scheme === 'side' ? false : !reversed });
    // Target side: from the LCA level inwards to t.
    const inner: EdgePlan['steps'] = [];
    for (let k = 0; k < tChain.length - 1; k += 1) {
      const container = tChain[k].container;
      const terminal = `T:${tKind}:${t}`;
      container.terminals.set(terminal, tKind);
      const unitEnd: Endpoint = { unit: tChain[k].unit, side: tKind, term: k > 0 ? `${tKind}:${t}` : undefined };
      const termEnd: Endpoint = { unit: terminal, side: tKind === 'out' ? 'in' : 'out' };
      if (!container.pieces.has(terminal)) {
        container.pieces.set(terminal, tKind === 'in' ? { key: terminal, tail: termEnd, head: unitEnd, scheme: 'normal' } : { key: terminal, tail: unitEnd, head: termEnd, scheme: 'normal' });
      }
      inner.unshift({ container, piece: terminal, forward: tKind === 'in' });
    }
    steps.push(...inner);
    plans.push({ edge, steps, fromSide: scheme === 'side' ? 'side' : sKind, toSide: scheme === 'side' ? 'side' : tKind });
  }

  // --- Geometry, deepest containers first.
  const unitSize = new Map<string, AlongAcross>();
  /** Port position relative to a unit's centre. */
  const portOffset = (endpoint: Endpoint): AlongAcross => {
    if (endpoint.term) {
      const interior = interiorOf.get(endpoint.unit)!;
      const terminal = `T:${endpoint.term}`;
      const geometry = interior.geometry!;
      const at = geometry.centre.get(terminal)!;
      const box = geometry.box;
      return { along: at.along - (box.alongMin + box.alongMax) / 2, across: at.across - (box.acrossMin + box.acrossMax) / 2 };
    }
    const node = byId.get(endpoint.unit)!;
    const size = unitSize.get(node.id)!;
    const sized = axes.toScreen(size);
    const anchor = nodePortAnchor({ ...node, width: sized.x, height: sized.y }, axes.screenSide(endpoint.side));
    return axes.fromScreen(anchor);
  };
  const originalHint = (id: string) => {
    const node = byId.get(id);
    return node ? axes.fromScreen(node.position).across : 0;
  };

  // --- Absolute placement, top-down.
  const absolute = new Map<string, AlongAcross>(); // node id → centre, laid-out coordinates (before the final shift)
  const routeOf = new Map<string, AlongAcross[]>(); // `${container.id}|${piece}` → absolute route
  const placeContainer = (container: Container, shift: AlongAcross) => {
    const geometry = container.geometry!;
    for (const [id, at] of geometry.centre) {
      const point = { along: at.along + shift.along, across: at.across + shift.across };
      if (container.units.includes(id)) absolute.set(id, point);
    }
    for (const [key, route] of geometry.routes) routeOf.set(`${container.id}|${key}`, route.map((point) => ({ along: point.along + shift.along, across: point.across + shift.across })));
    for (const unit of container.units) {
      const interior = interiorOf.get(unit);
      if (!interior) continue;
      const centre = absolute.get(unit)!;
      const box = interior.geometry!.box;
      placeContainer(interior, { along: centre.along - (box.alongMin + box.alongMax) / 2, across: centre.across - (box.acrossMin + box.acrossMax) / 2 });
    }
  };
  const composeRoute = (plan: EdgePlan): FlowPoint[] => {
    let points: FlowPoint[] = [];
    for (const step of plan.steps) {
      const route = routeOf.get(`${step.container.id}|${step.piece}`);
      if (!route) continue;
      const screen = (step.forward ? route : [...route].reverse()).map(axes.toScreen);
      points = points.length === 0 ? screen : [...points, ...screen.slice(1)];
    }
    return points;
  };

  /**
   * One complete pass: every level bottom-up, then a provisional
   * placement. A Frame's inside is ordered before the outside exists, so
   * the first pass can only guess which way each Line leaves it; later
   * passes order each Frame's border terminals by where their Lines
   * actually go, and the pass with the fewest real crossings is kept.
   */
  const runPass = (unitHint: (id: string) => number, terminalOrders: TerminalOrders | null) => {
    unitSize.clear();
    const ordered = [...containers].sort((a, b) => b.depth - a.depth);
    for (const container of ordered) {
      for (const unit of container.units) {
        if (unitSize.has(unit)) continue;
        const node = byId.get(unit)!;
        const style = resolveNodeStyle(node);
        unitSize.set(unit, axes.fromScreen({ x: style.width, y: style.height }));
      }
      container.geometry = layoutLevel(container, axes, unitSize, portOffset, unitHint, (id) => docIndex.get(id) ?? 0, terminalOrders?.get(container.id));
      if (container.frame) {
        const box = container.geometry.box;
        unitSize.set(container.frame.id, { along: box.alongMax - box.alongMin, across: box.acrossMax - box.acrossMin });
      }
    }
    absolute.clear();
    routeOf.clear();
    for (const top of topContainers) placeContainer(top, { along: 0, across: 0 });
    return countCrossings(
      plans.map((plan) => {
        const points = simplify(composeRoute(plan));
        const rounded = (resolveEdgeStyle(plan.edge, styles).routing ?? 'smooth-step') === 'smooth-step';
        return { points: rounded ? chamfer(points, 18) : points, ends: [plan.edge.from, plan.edge.to] as [string, string] };
      }),
    );
  };
  const currentTerminalOrders = (): TerminalOrders => new Map(containers.filter((container) => container.terminals.size > 0).map((container) => [container.id, new Map([...container.geometry!.terminalOrder].map(([rank, list]) => [rank, [...list]]))]));

  /** Order search from one starting order; returns the best it found. */
  const search = (startHint: (id: string) => number) => {
    let bestCrossings = runPass(startHint, null);
    let best: { unitHint: (id: string) => number; orders: TerminalOrders | null } = { unitHint: startHint, orders: null };
    if (bestCrossings > 0 && containers.some((container) => container.terminals.size > 1)) {
      // Search the terminal orders: swap neighbours, keep what removes real
      // crossings. A fixed budget, so the result never depends on speed.
      let orders = currentTerminalOrders();
      const positions = new Map(absolute);
      const unitHint = (id: string) => positions.get(id)?.across ?? startHint(id);
      const serialise = (value: TerminalOrders) => JSON.stringify([...value].map(([id, byRank]) => [id, [...byRank]]));
      const visited = new Set<string>([serialise(orders)]);
      let current = bestCrossings;
      let budget = PASS_BUDGET;
      let moved = true;
      // Hill-climb with sideways moves: a swap that keeps the count is taken
      // too (once per arrangement), because two swaps are sometimes needed
      // before the crossing count drops.
      while (moved && budget > 0 && bestCrossings > 0) {
        moved = false;
        for (const [containerId, ranks] of orders) {
          for (const [rank, list] of ranks) {
            // Move one terminal to any other slot (a neighbour swap is the
            // special case of moving it by one).
            for (let from = 0; from < list.length && budget > 0 && !moved; from += 1) {
              for (let to = 0; to < list.length && budget > 0 && !moved; to += 1) {
                if (to === from) continue;
                const trial: TerminalOrders = new Map([...orders].map(([id, byRank]) => [id, new Map([...byRank].map(([r, l]) => [r, [...l]]))]));
                const reordered = trial.get(containerId)!.get(rank)!;
                const [picked] = reordered.splice(from, 1);
                reordered.splice(to, 0, picked);
                const key = serialise(trial);
                if (visited.has(key)) continue;
                visited.add(key);
                budget -= 1;
                const crossings = runPass(unitHint, trial);
                if (crossings <= current) {
                  current = crossings;
                  orders = trial;
                  moved = true;
                  if (crossings < bestCrossings) {
                    bestCrossings = crossings;
                    best = { unitHint, orders: trial };
                  }
                }
              }
            }
            if (moved) break;
          }
          if (moved) break;
        }
      }
    }
  return { best, crossings: bestCrossings };
  };

  // Restarts from a few starting orders — the user's own first, so it
  // wins every tie and the result stays close to their picture.
  const starts: Array<(id: string) => number> = [originalHint, (id) => -originalHint(id), (id) => docIndex.get(id) ?? 0];
  let best = search(starts[0]);
  for (const start of starts.slice(1)) {
    if (best.crossings === 0 || containerOfUnit.size > RESTART_LIMIT) break;
    const candidate = search(start);
    if (candidate.crossings < best.crossings) best = candidate;
  }
  runPass(best.best.unitHint, best.best.orders);

  const nodes = new Map(doc.nodes.map((node) => [node.id, node]));
  const updatedEdges = new Map<string, FlowEdge>();
  const movedAll = new Set<string>();

  for (const top of topContainers) {
    // Lay out relative to a provisional origin, then decide the shift.
    placeContainer(top, { along: 0, across: 0 });
    const subtree = new Set<string>();
    const collect = (container: Container) => {
      for (const unit of container.units) {
        subtree.add(unit);
        const interior = interiorOf.get(unit);
        if (interior) collect(interior);
      }
    };
    collect(top);

    // The anchor: where the block's top-left goes.
    const box = top.geometry!.box;
    const contentTopLeft = axes.toScreen({ along: box.alongMin, across: box.acrossMin });
    const contentBottomRight = axes.toScreen({ along: box.alongMax, across: box.acrossMax });
    const contentLeft = Math.min(contentTopLeft.x, contentBottomRight.x);
    const contentTop = Math.min(contentTopLeft.y, contentBottomRight.y);
    const contentWidth = Math.abs(contentBottomRight.x - contentTopLeft.x);
    const contentHeight = Math.abs(contentBottomRight.y - contentTopLeft.y);
    const before = boxOfNodes(top.units.map((id) => byId.get(id)!));
    let target: FlowPoint;
    if (options.origin) target = { x: options.origin.x, y: options.origin.y };
    else if (top.id === 'root') target = { x: before.left, y: before.top };
    else target = { x: (before.left + before.right) / 2 - contentWidth / 2, y: (before.top + before.bottom) / 2 - contentHeight / 2 };
    const base = { x: Math.round(target.x - contentLeft), y: Math.round(target.y - contentTop) };

    // Everything that stays put is an obstacle — except the Frames this
    // block sits inside.
    const ancestors = new Set<string>();
    for (const unit of top.units) {
      let current = parentOf(byId.get(unit)!);
      while (current && !ancestors.has(current)) {
        ancestors.add(current);
        current = parentOf(byId.get(current)!);
      }
    }
    const obstacles = [...nodes.values()].filter((node) => !subtree.has(node.id) && !ancestors.has(node.id));
    const moved = [...subtree].map((id) => ({ id, centre: axes.toScreen(absolute.get(id)!), size: axes.toScreen(unitSize.get(id)!) }));
    const topBoxes = top.units.map((id) => {
      const centre = axes.toScreen(absolute.get(id)!);
      const size = axes.toScreen(unitSize.get(id)!);
      return { left: centre.x - size.x / 2, right: centre.x + size.x / 2, top: centre.y - size.y / 2, bottom: centre.y + size.y / 2 };
    });
    const routes = [...routeOf.entries()].filter(([key]) => containerInSubtree(key, top, interiorOf)).map(([, route]) => route.map(axes.toScreen));
    const offset = findClearOffset(base, topBoxes, routes, obstacles);

    for (const item of moved) {
      const node = nodes.get(item.id)!;
      const position = { x: item.centre.x + offset.x, y: item.centre.y + offset.y };
      const next: FlowNode = { ...node, position };
      if (node.type === 'group' && interiorOf.has(node.id)) {
        next.width = item.size.x;
        next.height = item.size.y;
      }
      nodes.set(item.id, next);
      movedAll.add(item.id);
    }
    for (const [key, route] of routeOf) {
      if (!containerInSubtree(key, top, interiorOf)) continue;
      routeOf.set(key, route.map((point) => ({ along: point.along + axes.fromScreen(offset).along, across: point.across + axes.fromScreen(offset).across })));
    }
  }

  // --- Lines.
  for (const plan of plans) {
    const points = composeRoute(plan);
    const fromSide = axes.screenSide(plan.fromSide);
    const toSide = axes.screenSide(plan.toSide);
    const edge = plan.edge;
    const next: FlowEdge = { ...edge, fromSide, toSide };
    delete next.bendPoints;
    const routing = resolveEdgeStyle(edge, styles).routing ?? 'smooth-step';
    if ((routing === 'smooth-step' || routing === 'orthogonal') && points.length >= 2) {
      const mine = simplify(points);
      const from = nodes.get(edge.from)!;
      const to = nodes.get(edge.to)!;
      const natural = buildEdgeGeometry({ ...next, routing }, from, to).points;
      if (!natural || !samePolyline(simplify(natural), mine)) next.bendPoints = mine.slice(1, -1).map((point) => ({ x: round(point.x), y: round(point.y) }));
    }
    updatedEdges.set(edge.id, next);
  }

  // Lines between something that moved and something that didn't: face
  // each other across the new arrangement, no stale bends.
  for (const edge of doc.edges) {
    if (updatedEdges.has(edge.id)) continue;
    const touches = movedAll.has(edge.from) || movedAll.has(edge.to);
    if (!touches || edge.from === edge.to) continue;
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) continue;
    const next: FlowEdge = { ...edge, ...facingSides(from, to) };
    delete next.bendPoints;
    updatedEdges.set(edge.id, next);
  }

  // A selection laid out inside a Frame that wasn't itself laid out: grow
  // that Frame (never shrink it) so its members stay inside.
  if (selection.length > 0) {
    const grown = [...nodes.values()].filter((node) => node.type === 'group' && !movedAll.has(node.id));
    const depthOf = (node: FlowNode) => {
      let depth = 0;
      let current = parentOf(node);
      while (current) {
        depth += 1;
        current = parentOf(nodes.get(current)!);
      }
      return depth;
    };
    grown.sort((a, b) => depthOf(b) - depthOf(a));
    for (const frame of grown) {
      const members = [...nodes.values()].filter((node) => node.parentId === frame.id);
      if (!members.some((member) => movedAll.has(member.id) || descendantIds([...nodes.values()], member.id).size > 0)) continue;
      const fit = groupGeometryFor(members);
      if (!fit) continue;
      const current = boxOfNodes([frame]);
      const left = Math.min(current.left, fit.position.x - fit.width / 2);
      const right = Math.max(current.right, fit.position.x + fit.width / 2);
      const top = Math.min(current.top, fit.position.y - fit.height / 2);
      const bottom = Math.max(current.bottom, fit.position.y + fit.height / 2);
      if (left === current.left && right === current.right && top === current.top && bottom === current.bottom) continue;
      nodes.set(frame.id, { ...frame, position: { x: (left + right) / 2, y: (top + bottom) / 2 }, width: right - left, height: bottom - top });
      movedAll.add(frame.id);
    }
  }

  const movedNodeIds = doc.nodes
    .filter((node) => {
      const next = nodes.get(node.id)!;
      return next !== node && (next.position.x !== node.position.x || next.position.y !== node.position.y || next.width !== node.width || next.height !== node.height);
    })
    .map((node) => node.id);

  return {
    document: {
      ...doc,
      nodes: doc.nodes.map((node) => nodes.get(node.id)!),
      edges: doc.edges.map((edge) => updatedEdges.get(edge.id) ?? edge),
    },
    movedNodeIds,
  };
}

function containerInSubtree(routeKey: string, top: Container, interiorOf: Map<string, Container>): boolean {
  const containerId = routeKey.slice(0, routeKey.indexOf('|'));
  const visit = (container: Container): boolean => container.id === containerId || container.units.some((unit) => {
    const interior = interiorOf.get(unit);
    return interior ? visit(interior) : false;
  });
  return visit(top);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function labelSize(edge: FlowEdge, axes: Axes): AlongAcross {
  const box = edgeLabelBox(edge.label ?? '', resolveEdgeLabelStyle(edge));
  return axes.fromScreen({ x: box.width, y: box.height });
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function boxOfNodes(nodes: FlowNode[]): Box {
  const boxes = nodes.map((node) => {
    const { width, height } = resolveNodeStyle(node);
    return { left: node.position.x - width / 2, right: node.position.x + width / 2, top: node.position.y - height / 2, bottom: node.position.y + height / 2 };
  });
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

// --- Ranking ----------------------------------------------------------------

function rankContainer(container: Container, byFlowOrder: (a: string, b: string) => number, flowKey: (id: string) => number) {
  const units = [...container.units].sort(byFlowOrder);
  const outgoing = new Map<string, Array<{ to: string; edgeId: string }>>();
  const indegree = new Map<string, number>();
  for (const unit of units) {
    outgoing.set(unit, []);
    indegree.set(unit, 0);
  }
  for (const arc of container.arcs) {
    outgoing.get(arc.from)!.push({ to: arc.to, edgeId: arc.edge.id });
    indegree.set(arc.to, (indegree.get(arc.to) ?? 0) + 1);
  }
  for (const list of outgoing.values()) list.sort((a, b) => byFlowOrder(a.to, b.to));

  // DFS for back edges, starting from the Elements nothing points at, in
  // replay order — so the loop that gets reversed is the one closing back
  // to an earlier step, not one going forward.
  const state = new Map<string, 'active' | 'done'>();
  const visit = (start: string) => {
    const stack: Array<{ id: string; index: number }> = [{ id: start, index: 0 }];
    state.set(start, 'active');
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const list = outgoing.get(frame.id)!;
      if (frame.index < list.length) {
        const { to, edgeId } = list[frame.index++];
        const seen = state.get(to);
        if (seen === 'active') container.reversed.add(edgeId);
        else if (seen === undefined) {
          state.set(to, 'active');
          stack.push({ id: to, index: 0 });
        }
      } else {
        state.set(frame.id, 'done');
        stack.pop();
      }
    }
  };
  for (const unit of units) if ((indegree.get(unit) ?? 0) === 0 && !state.has(unit)) visit(unit);
  for (const unit of units) if (!state.has(unit)) visit(unit);

  // Longest path over the now acyclic arcs.
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  for (const unit of units) {
    successors.set(unit, []);
    predecessors.set(unit, []);
  }
  for (const arc of container.arcs) {
    const [from, to] = container.reversed.has(arc.edge.id) ? [arc.to, arc.from] : [arc.from, arc.to];
    successors.get(from)!.push(to);
    predecessors.get(to)!.push(from);
  }
  const rank = container.rank;
  const pending = new Map(units.map((unit) => [unit, predecessors.get(unit)!.length]));
  const queue = units.filter((unit) => pending.get(unit) === 0);
  for (const unit of units) rank.set(unit, 0);
  const topological: string[] = [];
  while (queue.length > 0) {
    const unit = queue.shift()!;
    topological.push(unit);
    for (const next of successors.get(unit)!) {
      rank.set(next, Math.max(rank.get(next)!, rank.get(unit)! + 1));
      pending.set(next, pending.get(next)! - 1);
      if (pending.get(next) === 0) queue.push(next);
    }
  }
  // Sources sit right above the first thing they feed.
  for (const unit of [...topological].reverse()) {
    if (predecessors.get(unit)!.length > 0 || successors.get(unit)!.length === 0) continue;
    rank.set(unit, Math.min(...successors.get(unit)!.map((next) => rank.get(next)!)) - 1);
  }
  // A shared service — a sink called from far-apart depths (an auth
  // service, a log store) — sits just below its earliest caller, the way
  // people draw it, rather than at the very bottom with a Line dragged the
  // whole height of the Diagram. The deeper calls become upward Lines.
  // Only when the replay order says so: a sink that comes *before* one of
  // its callers is a service being called; one that comes after all of
  // them (a flow's "Done") is the end of the flow and stays last.
  for (const unit of units) {
    if (successors.get(unit)!.length > 0) continue;
    const callers = container.arcs.filter((arc) => !container.reversed.has(arc.edge.id) && arc.to === unit);
    if (callers.length < 2) continue;
    if (!(flowKey(unit) < Math.max(...callers.map((arc) => flowKey(arc.from))))) continue;
    const callerRanks = callers.map((arc) => rank.get(arc.from)!);
    const earliest = Math.min(...callerRanks);
    if (Math.max(...callerRanks) - earliest < SHARED_SINK_SPREAD) continue;
    rank.set(unit, earliest + 1);
    for (const arc of callers) if (rank.get(arc.from)! >= earliest + 1) container.reversed.add(arc.edge.id);
  }
  const minimum = Math.min(...units.map((unit) => rank.get(unit)!));
  for (const unit of units) rank.set(unit, rank.get(unit)! - minimum);
}

// --- One level --------------------------------------------------------------

interface Item {
  id: string;
  kind: 'unit' | 'dummy' | 'terminal';
  rank: number;
  size: AlongAcross;
  hint: number;
  index: number;
}

/** A link between two items in consecutive ranks. */
interface Segment {
  piece: string;
  upper: string;
  lower: string;
  /** Port offset across, relative to the item's centre. */
  upperPort: number;
  lowerPort: number;
}

function layoutLevel(
  container: Container,
  axes: Axes,
  unitSize: Map<string, AlongAcross>,
  portOffset: (endpoint: Endpoint) => AlongAcross,
  hintOf: (id: string) => number,
  indexOf: (id: string) => number,
  fixedTerminals: Map<number, string[]> | undefined,
): LevelGeometry {
  const items = new Map<string, Item>();
  const rankOf = (id: string) => items.get(id)!.rank;
  const maxUnitRank = Math.max(0, ...container.units.map((unit) => container.rank.get(unit) ?? 0));
  for (const unit of container.units) {
    items.set(unit, { id: unit, kind: 'unit', rank: container.rank.get(unit) ?? 0, size: unitSize.get(unit)!, hint: hintOf(unit), index: indexOf(unit) });
  }
  for (const [terminal, kind] of container.terminals) {
    const block = terminal.slice(terminal.indexOf(':', 2) + 1);
    items.set(terminal, { id: terminal, kind: 'terminal', rank: kind === 'in' ? -1 : maxUnitRank + 1, size: { along: 0, across: 0 }, hint: hintOf(block), index: indexOf(block) });
  }

  // Chains of items per piece, tail → head, plus glued lanes.
  const chains = new Map<string, string[]>();
  const glued = new Map<string, string[]>(); // anchor → glued dummies, in order
  const segments: Segment[] = [];
  const endpointPort = (endpoint: Endpoint) => (items.get(endpoint.unit)!.kind === 'terminal' ? { along: 0, across: 0 } : portOffset(endpoint));
  for (const piece of container.pieces.values()) {
    const tailRank = rankOf(piece.tail.unit);
    const headRank = rankOf(piece.head.unit);
    const tailHint = items.get(piece.tail.unit)!.hint;
    const headHint = items.get(piece.head.unit)!.hint;
    const chain: string[] = [piece.tail.unit];
    const span = headRank - tailRank;
    const addDummy = (rank: number, suffix: string) => {
      const id = `~${piece.key}~${suffix}`;
      const fraction = span === 0 ? 0 : (rank - tailRank) / span;
      items.set(id, { id, kind: 'dummy', rank, size: { along: 0, across: 0 }, hint: tailHint + (headHint - tailHint) * fraction, index: items.get(piece.tail.unit)!.index });
      chain.push(id);
      return id;
    };
    if (piece.scheme === 'side') {
      const first = addDummy(tailRank, 'g0');
      glued.set(piece.tail.unit, [...(glued.get(piece.tail.unit) ?? []), first]);
    }
    for (let rank = tailRank + 1; rank < headRank; rank += 1) addDummy(rank, String(rank));
    if (piece.scheme === 'side') {
      const last = addDummy(headRank, 'g1');
      glued.set(piece.head.unit, [...(glued.get(piece.head.unit) ?? []), last]);
    }
    chain.push(piece.head.unit);
    // A label needs room where it will sit: halfway along the route,
    // which is in whichever rank the route's middle passes — measured
    // with the ranks' own depths, since one tall Frame can hold most of
    // a Line's length.
    if (piece.label && span >= 2) {
      const dummies = chain.slice(1, -1).filter((id) => items.get(id)!.kind === 'dummy');
      const depth = (rank: number) => Math.max(0, ...container.units.filter((unit) => (container.rank.get(unit) ?? 0) === rank).map((unit) => unitSize.get(unit)!.along));
      const lengths = dummies.map((id) => depth(items.get(id)!.rank) + RANK_GAP);
      const half = lengths.reduce((total, value) => total + value, 0) / 2;
      let walked = 0;
      let middle = dummies[0];
      for (let index = 0; index < dummies.length; index += 1) {
        walked += lengths[index];
        if (walked >= half) {
          middle = dummies[index];
          break;
        }
      }
      if (middle) items.get(middle)!.size = { along: piece.label.along + 8, across: piece.label.across + 8 };
    }
    chains.set(piece.key, chain);
    const linked = piece.scheme === 'side' ? chain.slice(1, -1) : chain;
    for (let index = 1; index < linked.length; index += 1) {
      const upper = linked[index - 1];
      const lower = linked[index];
      const upperPort = index === 1 && piece.scheme === 'normal' ? endpointPort(piece.tail).across : 0;
      const lowerPort = index === linked.length - 1 && piece.scheme === 'normal' ? endpointPort(piece.head).across : 0;
      segments.push({ piece: piece.key, upper, lower, upperPort, lowerPort });
    }
  }

  // --- Ordering.
  const ranks = new Map<number, string[][]>();
  const gluedIds = new Set([...glued.values()].flat());
  for (const item of items.values()) {
    if (gluedIds.has(item.id)) continue;
    const list = ranks.get(item.rank) ?? [];
    list.push([item.id, ...(glued.get(item.id) ?? [])]);
    ranks.set(item.rank, list);
  }
  const rankKeys = [...ranks.keys()].sort((a, b) => a - b);
  for (const key of rankKeys) ranks.get(key)!.sort((a, b) => items.get(a[0])!.hint - items.get(b[0])!.hint || items.get(a[0])!.index - items.get(b[0])!.index);
  for (const [rank, fixedOrder] of fixedTerminals ?? []) {
    const groups = ranks.get(rank);
    if (!groups || groups.length !== fixedOrder.length) continue;
    ranks.set(rank, fixedOrder.map((id) => [id]));
  }

  const segmentsBetween = new Map<number, Segment[]>();
  for (const segment of segments) {
    const rank = rankOf(segment.upper);
    segmentsBetween.set(rank, [...(segmentsBetween.get(rank) ?? []), segment]);
  }
  const portFraction = (id: string, port: number) => {
    const size = items.get(id)!.size.across;
    return size <= 0 ? 0 : Math.max(-0.45, Math.min(0.45, port / size));
  };
  const positions = (order: Map<number, string[][]>) => {
    const position = new Map<string, number>();
    for (const groups of order.values()) groups.flat().forEach((id, index) => position.set(id, index));
    return position;
  };
  // Port fractions never change, so work them out once per segment.
  const fractions = new Map(segments.map((segment) => [segment, { upper: portFraction(segment.upper, segment.upperPort), lower: portFraction(segment.lower, segment.lowerPort) }]));
  const crossingsAt = (rank: number, position: Map<string, number>) => {
    const list = segmentsBetween.get(rank);
    if (!list || list.length < 2) return 0;
    const pairs = list.map((segment) => {
      const fraction = fractions.get(segment)!;
      return { upper: position.get(segment.upper)! + fraction.upper, lower: position.get(segment.lower)! + fraction.lower };
    });
    // Two segments cross when their order flips between the ranks: sort by
    // the upper end (ties by the lower end, so a shared upper end is never
    // a crossing) and count strict inversions of the lower end.
    pairs.sort((a, b) => a.upper - b.upper || a.lower - b.lower);
    return countInversions(pairs.map((pair) => pair.lower));
  };
  const totalCrossings = (order: Map<number, string[][]>) => {
    const position = positions(order);
    return rankKeys.reduce((total, rank) => total + crossingsAt(rank, position), 0);
  };
  const clone = (order: Map<number, string[][]>) => new Map([...order.entries()].map(([rank, groups]) => [rank, groups.map((group) => [...group])]));

  // Terminals ordered by where their Lines go outside stay in that order.
  const frozen = new Set<number>([...(fixedTerminals?.keys() ?? [])]);
  let order = clone(ranks);
  let best = clone(order);
  let bestCrossings = totalCrossings(order);
  for (let iteration = 0; iteration < ORDER_ITERATIONS && bestCrossings > 0; iteration += 1) {
    const downwards = iteration % 2 === 0;
    const sweep = downwards ? rankKeys.slice(1) : rankKeys.slice(0, -1).reverse();
    for (const rank of sweep) {
      if (frozen.has(rank)) continue;
      const position = positions(order);
      const reference = downwards ? segmentsBetween.get(rank - 1) ?? [] : segmentsBetween.get(rank) ?? [];
      const groups = order.get(rank)!;
      const values = groups.map((group) => {
        const found: number[] = [];
        for (const segment of reference) {
          if (downwards && group.includes(segment.lower)) found.push(position.get(segment.upper)! + portFraction(segment.upper, segment.upperPort));
          if (!downwards && group.includes(segment.upper)) found.push(position.get(segment.lower)! + portFraction(segment.lower, segment.lowerPort));
        }
        if (found.length === 0) return null;
        found.sort((a, b) => a - b);
        const middle = Math.floor(found.length / 2);
        return found.length % 2 === 1 ? found[middle] : (found[middle - 1] + found[middle]) / 2;
      });
      const sortable = groups.map((group, index) => ({ group, index, value: values[index] })).filter((entry) => entry.value !== null);
      sortable.sort((a, b) => a.value! - b.value! || a.index - b.index);
      const next: string[][] = [];
      let cursor = 0;
      groups.forEach((group, index) => {
        if (values[index] === null) next.push(group);
        else next.push(sortable[cursor++].group);
      });
      order.set(rank, next);
    }
    transpose(order, rankKeys.filter((rank) => !frozen.has(rank)), segmentsBetween, fractions, positions(order));
    const crossings = totalCrossings(order);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      best = clone(order);
    } else if (iteration % 4 === 3) order = clone(best);
  }
  order = best;
  const position = positions(order);

  // --- Across coordinates: rigid columns, then network simplex.
  const downs = new Map<string, Segment[]>();
  const ups = new Map<string, Segment[]>();
  for (const segment of segments) {
    downs.set(segment.upper, [...(downs.get(segment.upper) ?? []), segment]);
    ups.set(segment.lower, [...(ups.get(segment.lower) ?? []), segment]);
  }
  const isVirtual = (id: string) => items.get(id)!.kind !== 'unit';
  const candidates = segments
    .filter((segment) => downs.get(segment.upper)!.length === 1 && ups.get(segment.lower)!.length === 1)
    .map((segment) => ({ segment, priority: (isVirtual(segment.upper) ? 0 : 1) + (isVirtual(segment.lower) ? 0 : 1) }))
    .sort((a, b) => a.priority - b.priority || rankOf(a.segment.upper) - rankOf(b.segment.upper) || position.get(a.segment.upper)! - position.get(b.segment.upper)!);
  const accepted: Segment[] = [];
  for (const { segment } of candidates) {
    const rank = rankOf(segment.upper);
    const conflict = accepted.some((other) => rankOf(other.upper) === rank && (position.get(segment.upper)! - position.get(other.upper)!) * (position.get(segment.lower)! - position.get(other.lower)!) < 0);
    if (!conflict) accepted.push(segment);
  }

  const solve = (links: Segment[]) => {
    const below = new Map(links.map((segment) => [segment.upper, segment]));
    const hasAbove = new Set(links.map((segment) => segment.lower));
    const blockOf = new Map<string, number>();
    const shift = new Map<string, number>();
    let blocks = 0;
    for (const id of items.keys()) {
      if (hasAbove.has(id)) continue;
      let current: string | undefined = id;
      let offset = 0;
      while (current !== undefined) {
        blockOf.set(current, blocks);
        shift.set(current, offset);
        const link = below.get(current);
        if (!link) break;
        offset = offset + link.upperPort - link.lowerPort;
        current = link.lower;
      }
      blocks += 1;
    }
    const simplexEdges: SimplexEdge[] = [];
    const halfAcross = (id: string) => items.get(id)!.size.across / 2;
    const gapBetween = (a: string, b: string) => {
      const va = isVirtual(a);
      const vb = isVirtual(b);
      if (gluedIds.has(b) && (glued.get(a)?.includes(b) || gluedIds.has(a))) return gluedIds.has(a) ? LANE_LANE_GAP : SIDE_LEAD;
      if (va && vb) return LANE_LANE_GAP;
      if (va || vb) return LANE_GAP;
      return NODE_GAP;
    };
    for (const groups of order.values()) {
      const flat = groups.flat();
      for (let index = 1; index < flat.length; index += 1) {
        const a = flat[index - 1];
        const b = flat[index];
        const separation = halfAcross(a) + halfAcross(b) + gapBetween(a, b);
        simplexEdges.push({ tail: blockOf.get(a)!, head: blockOf.get(b)!, minlen: Math.ceil(separation + shift.get(a)! - shift.get(b)!), weight: 0 });
        // A loop's lane hugs the Element it leaves from.
        if (gluedIds.has(b) && glued.get(a)?.includes(b)) simplexEdges.push({ tail: blockOf.get(a)!, head: blockOf.get(b)!, minlen: Math.ceil(separation + shift.get(a)! - shift.get(b)!), weight: 4 });
      }
    }
    let auxiliary = blocks;
    for (const segment of segments) {
      const a = blockOf.get(segment.upper)!;
      const b = blockOf.get(segment.lower)!;
      if (a === b) continue;
      const weight = isVirtual(segment.upper) && isVirtual(segment.lower) ? 8 : isVirtual(segment.upper) || isVirtual(segment.lower) ? 2 : 1;
      const c = Math.round(shift.get(segment.upper)! + segment.upperPort - (shift.get(segment.lower)! + segment.lowerPort));
      simplexEdges.push({ tail: auxiliary, head: a, minlen: Math.max(0, -c), weight }, { tail: auxiliary, head: b, minlen: Math.max(0, c), weight });
      auxiliary += 1;
    }
    const values = networkSimplex(auxiliary, simplexEdges, { balance: true });
    const across = new Map<string, number>();
    for (const id of items.keys()) across.set(id, values[blockOf.get(id)!] + shift.get(id)!);
    return across;
  };
  let across: Map<string, number>;
  try {
    across = solve(accepted);
  } catch {
    across = solve([]);
  }

  // --- Tracks: every horizontal jog gets a place in its gap.
  interface Jog {
    key: string;
    piece: string;
    lo: number;
    hi: number;
    top: number;
    bottom: number;
    shareTop: string;
    shareBottom: string;
    track: number;
  }
  const portAcross = (id: string, port: number) => across.get(id)! + port;
  const jogsByGap = new Map<number, Jog[]>();
  const jogOfSegment = new Map<Segment, Jog>();
  for (const segment of segments) {
    const top = portAcross(segment.upper, segment.upperPort);
    const bottom = portAcross(segment.lower, segment.lowerPort);
    if (Math.abs(top - bottom) <= 0.5) continue;
    const jog: Jog = { key: `${segment.piece}:${segment.upper}`, piece: segment.piece, lo: Math.min(top, bottom), hi: Math.max(top, bottom), top, bottom, shareTop: `${segment.upper}@${Math.round(top)}`, shareBottom: `${segment.lower}@${Math.round(bottom)}`, track: 0 };
    const rank = rankOf(segment.upper);
    jogsByGap.set(rank, [...(jogsByGap.get(rank) ?? []), jog]);
    jogOfSegment.set(segment, jog);
  }
  const trackCount = new Map<number, number>();
  for (const [rank, jogs] of jogsByGap) trackCount.set(rank, assignTracks(jogs));

  // --- Along coordinates.
  const realRanks = rankKeys.filter((rank) => rank >= 0 && rank <= maxUnitRank);
  const band = new Map<number, number>();
  for (const rank of realRanks) band.set(rank, Math.max(0, ...order.get(rank)!.flat().map((id) => items.get(id)!.size.along)));
  const labelNeed = (rank: number) => {
    let need = 0;
    for (const segment of segmentsBetween.get(rank) ?? []) {
      const piece = container.pieces.get(segment.piece)!;
      if (!piece.label) continue;
      const span = rankOf(piece.head.unit) - rankOf(piece.tail.unit);
      if (span !== 1) continue;
      need = Math.max(need, piece.label.along + 2 * LABEL_MARGIN);
    }
    return need;
  };
  const gapSize = (rank: number) => {
    const tracks = trackCount.get(rank) ?? 0;
    return Math.max(RANK_GAP, tracks > 1 ? (tracks - 1) * TRACK_SPACING + 2 * TRACK_MARGIN : 0, labelNeed(rank));
  };
  const bandStart = new Map<number, number>();
  let cursor = 0;
  for (const rank of realRanks) {
    bandStart.set(rank, cursor);
    cursor += band.get(rank)! + gapSize(rank);
  }
  const contentEnd = realRanks.length > 0 ? bandStart.get(realRanks.at(-1)!)! + band.get(realRanks.at(-1)!)! : 0;

  const isFrame = Boolean(container.frame);
  const headerAlong = isFrame && axes.direction === 'TB' ? GROUP_HEADER_HEIGHT : 0;
  const headerAcross = isFrame && axes.direction === 'LR' ? GROUP_HEADER_HEIGHT : 0;
  const borderGap = (rank: number) => {
    const tracks = trackCount.get(rank) ?? 0;
    return Math.max(GROUP_PADDING, tracks > 0 ? (tracks - 1) * TRACK_SPACING + 2 * Math.min(TRACK_MARGIN, 14) : 0);
  };
  const topBorder = isFrame ? -(headerAlong + borderGap(-1)) : 0;
  const bottomBorder = isFrame ? contentEnd + borderGap(maxUnitRank) : contentEnd;

  const centre = new Map<string, AlongAcross>();
  for (const item of items.values()) {
    let along: number;
    if (item.kind === 'terminal') along = item.rank < 0 ? topBorder : bottomBorder;
    else along = bandStart.get(item.rank)! + band.get(item.rank)! / 2;
    centre.set(item.id, { along, across: across.get(item.id)! });
  }

  // The along position of each gap's tracks.
  const gapRange = (rank: number): [number, number] => {
    if (rank < 0) return [topBorder + headerAlong, 0];
    if (rank >= maxUnitRank) return [contentEnd, bottomBorder];
    return [bandStart.get(rank)! + band.get(rank)!, bandStart.get(rank + 1)!];
  };
  const trackAlong = new Map<Jog, number>();
  for (const [rank, jogs] of jogsByGap) {
    const [start, end] = gapRange(rank);
    const count = trackCount.get(rank)!;
    if (count === 1) {
      // One track: sit where the app's own router would put the jog —
      // halfway between the two ports — when every jog agrees on that,
      // so those Lines need no bend points at all.
      const mids = jogs.map((jog) => {
        const segment = [...jogOfSegment.entries()].find(([, value]) => value === jog)![0];
        const upper = centre.get(segment.upper)!.along + (items.get(segment.upper)!.kind === 'unit' ? items.get(segment.upper)!.size.along / 2 : 0);
        const lower = centre.get(segment.lower)!.along - (items.get(segment.lower)!.kind === 'unit' ? items.get(segment.lower)!.size.along / 2 : 0);
        return (upper + lower) / 2;
      });
      const agreed = mids.every((mid) => Math.abs(mid - mids[0]) < 0.5) && mids[0] >= start + 12 && mids[0] <= end - 12;
      const along = agreed ? mids[0] : (start + end) / 2;
      for (const jog of jogs) trackAlong.set(jog, along);
    } else {
      const middle = (start + end) / 2;
      for (const jog of jogs) trackAlong.set(jog, middle + (jog.track - (count - 1) / 2) * TRACK_SPACING);
    }
  }

  // --- Routes, tail → head.
  const routes = new Map<string, AlongAcross[]>();
  for (const piece of container.pieces.values()) {
    const chain = chains.get(piece.key)!;
    const points: AlongAcross[] = [];
    const portPoint = (endpoint: Endpoint) => {
      const at = centre.get(endpoint.unit)!;
      if (items.get(endpoint.unit)!.kind === 'terminal') return at;
      const offset = portOffset(endpoint);
      return { along: at.along + offset.along, across: at.across + offset.across };
    };
    const start = portPoint(piece.tail);
    points.push(start);
    const linked = piece.scheme === 'side' ? chain.slice(1, -1) : chain;
    if (piece.scheme === 'side') points.push({ along: start.along, across: centre.get(linked[0])!.across });
    for (const segment of segments.filter((candidate) => candidate.piece === piece.key)) {
      const jog = jogOfSegment.get(segment);
      if (!jog) continue;
      const along = trackAlong.get(jog)!;
      points.push({ along, across: jog.top }, { along, across: jog.bottom });
    }
    const end = portPoint(piece.head);
    if (piece.scheme === 'side') points.push({ along: end.along, across: centre.get(linked.at(-1)!)!.across });
    points.push(end);
    routes.set(piece.key, simplifyLocal(points));
  }

  // --- The level's box.
  let acrossMin = Infinity;
  let acrossMax = -Infinity;
  for (const item of items.values()) {
    const at = across.get(item.id)!;
    acrossMin = Math.min(acrossMin, at - item.size.across / 2);
    acrossMax = Math.max(acrossMax, at + item.size.across / 2);
  }
  let box = { alongMin: topBorder, alongMax: bottomBorder, acrossMin, acrossMax };
  if (isFrame) {
    box = { alongMin: topBorder, alongMax: bottomBorder, acrossMin: acrossMin - GROUP_PADDING - headerAcross, acrossMax: acrossMax + GROUP_PADDING };
    // A Frame has a floor on its size; grow evenly around the content.
    const growAlong = Math.max(0, GROUP_MIN_SIZE - (box.alongMax - box.alongMin)) / 2;
    const growAcross = Math.max(0, GROUP_MIN_SIZE - (box.acrossMax - box.acrossMin)) / 2;
    box = { alongMin: box.alongMin - growAlong, alongMax: box.alongMax + growAlong, acrossMin: box.acrossMin - growAcross, acrossMax: box.acrossMax + growAcross };
    // Terminals sit on the border itself.
    for (const [id, kind] of container.terminals) {
      const at = centre.get(id)!;
      centre.set(id, { along: kind === 'in' ? box.alongMin : box.alongMax, across: at.across });
    }
    for (const piece of container.pieces.values()) {
      const route = routes.get(piece.key)!;
      for (const [id, kind] of container.terminals) {
        if (piece.tail.unit === id) route[0] = { along: kind === 'in' ? box.alongMin : box.alongMax, across: route[0].across };
        if (piece.head.unit === id) route[route.length - 1] = { along: kind === 'in' ? box.alongMin : box.alongMax, across: route[route.length - 1].across };
      }
    }
  }
  const terminalOrder = new Map<number, string[]>();
  for (const rank of [-1, maxUnitRank + 1]) {
    const groups = order.get(rank);
    if (groups && groups.every((group) => items.get(group[0])!.kind === 'terminal')) terminalOrder.set(rank, groups.map((group) => group[0]));
  }
  return { centre, routes, box, terminalOrder };
}

/** Swap neighbouring groups while that removes crossings. */
function transpose(
  order: Map<number, string[][]>,
  rankKeys: number[],
  segmentsBetween: Map<number, Segment[]>,
  fractions: Map<Segment, { upper: number; lower: number }>,
  position: Map<string, number>,
) {
  const reindex = (rank: number) => order.get(rank)!.flat().forEach((id, index) => position.set(id, index));
  // For one group: where each of its segments goes in the rank above and
  // in the rank below, as positions there.
  const ends = (rank: number, group: string[]) => {
    const above: number[] = [];
    const below: number[] = [];
    for (const segment of segmentsBetween.get(rank - 1) ?? []) if (group.includes(segment.lower)) above.push(position.get(segment.upper)! + fractions.get(segment)!.upper);
    for (const segment of segmentsBetween.get(rank) ?? []) if (group.includes(segment.upper)) below.push(position.get(segment.lower)! + fractions.get(segment)!.lower);
    return { above, below };
  };
  // Crossings between two neighbours' segments with `left` on the left.
  const between = (left: { above: number[]; below: number[] }, right: { above: number[]; below: number[] }) => {
    let count = 0;
    for (const a of left.above) for (const b of right.above) if (a > b) count += 1;
    for (const a of left.below) for (const b of right.below) if (a > b) count += 1;
    return count;
  };
  let improved = true;
  let passes = 0;
  while (improved && passes < 6) {
    improved = false;
    passes += 1;
    for (const rank of rankKeys) {
      const groups = order.get(rank)!;
      for (let index = 0; index + 1 < groups.length; index += 1) {
        const first = ends(rank, groups[index]);
        const second = ends(rank, groups[index + 1]);
        if (between(second, first) < between(first, second)) {
          [groups[index], groups[index + 1]] = [groups[index + 1], groups[index]];
          reindex(rank);
          improved = true;
        }
      }
    }
  }
}

/** Pairs i < j with values[i] > values[j], by merge sort. */
function countInversions(values: number[]): number {
  if (values.length < 2) return 0;
  const middle = values.length >> 1;
  const left = values.slice(0, middle);
  const right = values.slice(middle);
  let count = countInversions(left) + countInversions(right);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < left.length && j < right.length) {
    if (right[j] < left[i]) {
      count += left.length - i;
      values[k++] = right[j++];
    } else values[k++] = left[i++];
  }
  while (i < left.length) values[k++] = left[i++];
  while (j < right.length) values[k++] = right[j++];
  return count;
}

/**
 * Give each jog in one gap a track, top to bottom, so that a vertical
 * coming down to a jog never has to cross another jog on its way, where
 * that can be avoided. Jogs leaving the same port, or arriving at the
 * same port, may share a track (they read as one branching line).
 * Returns how many tracks were used.
 */
function assignTracks(jogs: Array<{ lo: number; hi: number; top: number; bottom: number; shareTop: string; shareBottom: string; track: number }>): number {
  const overlap = (a: (typeof jogs)[number], b: (typeof jogs)[number]) => Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > -8;
  const sharable = (a: (typeof jogs)[number], b: (typeof jogs)[number]) => a.shareTop === b.shareTop || a.shareBottom === b.shareBottom;
  const inside = (value: number, jog: (typeof jogs)[number]) => value > jog.lo + 0.5 && value < jog.hi - 0.5;
  // above.get(a) = jogs that must sit below a.
  const below = new Map(jogs.map((jog) => [jog, new Set<(typeof jogs)[number]>()]));
  for (const a of jogs) {
    for (const b of jogs) {
      if (a === b || !overlap(a, b)) continue;
      // a's vertical comes down from above through b's span: a goes higher.
      // (Not when both hang off the same pin — they share that vertical.)
      if (inside(a.top, b) && a.shareTop !== b.shareTop) below.get(a)!.add(b);
      // a's vertical leaves downwards through b's span: a goes lower.
      if (inside(a.bottom, b) && a.shareBottom !== b.shareBottom) below.get(b)!.add(a);
      // a comes down where b leaves down: a's track must be the higher one,
      // or the two verticals would run along each other between tracks.
      if (Math.abs(a.top - b.bottom) < 0.5) below.get(a)!.add(b);
    }
  }
  const indegree = new Map(jogs.map((jog) => [jog, 0]));
  for (const set of below.values()) for (const jog of set) indegree.set(jog, indegree.get(jog)! + 1);
  const remaining = new Set(jogs);
  const sequence: Array<(typeof jogs)[number]> = [];
  while (remaining.size > 0) {
    let pick: (typeof jogs)[number] | null = null;
    for (const jog of remaining) {
      if (!pick || indegree.get(jog)! < indegree.get(pick)! || (indegree.get(jog) === indegree.get(pick) && jog.lo < pick.lo)) pick = jog;
    }
    remaining.delete(pick!);
    sequence.push(pick!);
    for (const next of below.get(pick!)!) if (remaining.has(next)) indegree.set(next, indegree.get(next)! - 1);
  }
  const placed: Array<(typeof jogs)[number]> = [];
  let tracks = 0;
  for (const jog of sequence) {
    let track = 0;
    for (const other of placed) if (below.get(other)!.has(jog) && overlap(other, jog)) track = Math.max(track, other.track + 1);
    const ordered = (other: (typeof jogs)[number]) => below.get(other)!.has(jog) || below.get(jog)!.has(other);
    while (placed.some((other) => other.track === track && overlap(other, jog) && (!sharable(other, jog) || ordered(other)))) track += 1;
    jog.track = track;
    placed.push(jog);
    tracks = Math.max(tracks, track + 1);
  }
  return tracks;
}

// --- Polylines ----------------------------------------------------------------

function simplifyLocal(points: AlongAcross[]): AlongAcross[] {
  const screen = simplify(points.map((point) => ({ x: point.across, y: point.along })));
  return screen.map((point) => ({ along: point.y, across: point.x }));
}

/** Drop repeated points and the middle of any three collinear ones. */
function simplify(points: FlowPoint[]): FlowPoint[] {
  const deduped: FlowPoint[] = [];
  for (const point of points) {
    const last = deduped.at(-1);
    if (!last || Math.abs(last.x - point.x) > 0.01 || Math.abs(last.y - point.y) > 0.01) deduped.push(point);
  }
  const result: FlowPoint[] = [];
  for (const point of deduped) {
    while (result.length >= 2) {
      const a = result[result.length - 2];
      const b = result[result.length - 1];
      const cross = (b.x - a.x) * (point.y - b.y) - (b.y - a.y) * (point.x - b.x);
      if (Math.abs(cross) > 0.01) break;
      result.pop();
    }
    result.push(point);
  }
  return result;
}

/**
 * The pass objective: proper crossings between different routes, plus
 * stretches where two Lines with no Element in common run along the same
 * segment — rendered with rounded corners those read as crossings, and
 * they are ambiguous anyway.
 */
function countCrossings(routes: Array<{ points: FlowPoint[]; ends: [string, string] }>): number {
  let count = 0;
  for (let i = 0; i < routes.length; i += 1) {
    for (let j = i + 1; j < routes.length; j += 1) {
      const a = routes[i].points;
      const b = routes[j].points;
      const related = routes[i].ends.some((end) => routes[j].ends.includes(end));
      for (let p = 1; p < a.length; p += 1) {
        for (let q = 1; q < b.length; q += 1) {
          const rx = a[p].x - a[p - 1].x;
          const ry = a[p].y - a[p - 1].y;
          const sx = b[q].x - b[q - 1].x;
          const sy = b[q].y - b[q - 1].y;
          const denominator = rx * sy - ry * sx;
          if (Math.abs(denominator) < 1e-9) {
            if (related) continue;
            // Collinear and overlapping by more than a couple of pixels?
            const offLine = Math.abs((b[q - 1].x - a[p - 1].x) * ry - (b[q - 1].y - a[p - 1].y) * rx) / (Math.hypot(rx, ry) || 1);
            if (offLine > 0.5) continue;
            const along = (point: FlowPoint) => (Math.abs(rx) >= Math.abs(ry) ? point.x : point.y);
            const overlap = Math.min(Math.max(along(a[p - 1]), along(a[p])), Math.max(along(b[q - 1]), along(b[q]))) - Math.max(Math.min(along(a[p - 1]), along(a[p])), Math.min(along(b[q - 1]), along(b[q])));
            if (overlap > 2) count += 1;
            continue;
          }
          const t = ((b[q - 1].x - a[p - 1].x) * sy - (b[q - 1].y - a[p - 1].y) * sx) / denominator;
          const u = ((b[q - 1].x - a[p - 1].x) * ry - (b[q - 1].y - a[p - 1].y) * rx) / denominator;
          if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) count += 1;
        }
      }
    }
  }
  return count;
}

/** A polyline with each corner cut the way `roundedPolyline` rounds it —
 *  close enough to the drawn curve for counting crossings. */
function chamfer(points: FlowPoint[], radius: number): FlowPoint[] {
  if (points.length < 3) return points;
  const result: FlowPoint[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const before = Math.hypot(previous.x - current.x, previous.y - current.y);
    const after = Math.hypot(next.x - current.x, next.y - current.y);
    if (before < 0.001 || after < 0.001) continue;
    const a = Math.min(radius, before / 2) / before;
    const b = Math.min(radius, after / 2) / after;
    result.push({ x: current.x + (previous.x - current.x) * a, y: current.y + (previous.y - current.y) * a });
    result.push({ x: current.x + (next.x - current.x) * b, y: current.y + (next.y - current.y) * b });
  }
  result.push(points[points.length - 1]);
  return result;
}

function samePolyline(a: FlowPoint[], b: FlowPoint[]): boolean {
  return a.length === b.length && a.every((point, index) => Math.abs(point.x - b[index].x) < 0.5 && Math.abs(point.y - b[index].y) < 0.5);
}

// --- Placement among what stays put --------------------------------------------

function findClearOffset(base: FlowPoint, boxes: Box[], routes: FlowPoint[][], obstacles: FlowNode[]): FlowPoint {
  if (obstacles.length === 0) return base;
  const solid = obstacles.filter((node) => node.type !== 'line').map((node) => ({ node, box: boxOfNodes([node]) }));
  const freeLines = obstacles
    .filter((node) => node.type === 'line')
    .map((node) => {
      const { width, height } = resolveNodeStyle(node);
      return endpointsOfLine(node, width, height);
    });
  const routeBlockers = solid.filter(({ node }) => node.type !== 'group').map(({ box }) => box);
  const clear = (dx: number, dy: number) => {
    for (const box of boxes) {
      const moved = { left: box.left + dx - OBSTACLE_MARGIN, right: box.right + dx + OBSTACLE_MARGIN, top: box.top + dy - OBSTACLE_MARGIN, bottom: box.bottom + dy + OBSTACLE_MARGIN };
      for (const other of solid) if (overlaps(moved, other.box)) return false;
      for (const line of freeLines) if (segmentHitsBox(line.start, line.end, moved)) return false;
    }
    for (const route of routes) {
      for (let index = 1; index < route.length; index += 1) {
        const a = { x: route[index - 1].x + dx, y: route[index - 1].y + dy };
        const b = { x: route[index].x + dx, y: route[index].y + dy };
        for (const box of routeBlockers) if (segmentHitsBox(a, b, box)) return false;
      }
    }
    return true;
  };
  for (let ring = 0; ring <= PLACEMENT_RINGS; ring += 1) {
    const candidates: FlowPoint[] = [];
    for (let i = -ring; i <= ring; i += 1) {
      for (let j = -ring; j <= ring; j += 1) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        candidates.push({ x: i * PLACEMENT_STEP, y: j * PLACEMENT_STEP });
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || a.y - b.y || a.x - b.x);
    for (const candidate of candidates) if (clear(base.x + candidate.x, base.y + candidate.y)) return { x: base.x + candidate.x, y: base.y + candidate.y };
  }
  return base;
}

function overlaps(a: Box, b: Box) {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
}

function segmentHitsBox(a: FlowPoint, b: FlowPoint, box: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-9) return q > 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, a.x - box.left) && clip(dx, box.right - a.x) && clip(-dy, a.y - box.top) && clip(dy, box.bottom - a.y) && t1 - t0 > 1e-9;
}
