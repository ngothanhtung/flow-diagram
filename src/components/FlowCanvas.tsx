'use client';

import { Grid2x2, Magnet, Maximize2, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ConnectionSide,
  ExecutionState,
  FlowDocumentJSON,
  FlowPoint,
  NodeShape,
} from '@/lib/flowchart-types';
import { screenToData } from '@/lib/coords';
import { resolveNodeStyle, SHAPES } from '@/lib/node-style';
import type { ViewTransform } from '@/lib/view-transform';
import { AnimatedEdge } from './AnimatedEdge';
import { FlowNodeCard } from './FlowNodeCard';
import { GhostEdge } from './GhostEdge';
import { buildEdgeGeometry, nodePortAnchor } from './edge-geometry';

interface LinkState {
  fromId: string;
  fromSide: ConnectionSide;
  /** Current pointer position in canvas coords — used to draw the ghost. */
  toX: number;
  toY: number;
}

interface ReconnectState {
  edgeId: string;
  endpoint: 'from' | 'to';
  /** The opposite endpoint cannot be selected, preventing self-links. */
  fixedNodeId: string;
  pointer: { x: number; y: number };
}

interface PanState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startTransform: ViewTransform;
  moved: boolean;
}

interface BendDragState {
  edgeId: string;
  pointIndex: number;
  points: FlowPoint[];
}

interface FlowCanvasProps {
  document: FlowDocumentJSON;
  activeNodeIds?: string[];
  /** Null animates every edge; an array animates only those edge ids. */
  runningEdgeIds?: string[] | null;
  nodeExecutionStates?: Record<string, ExecutionState>;
  edgeExecutionStates?: Record<string, ExecutionState>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onNodeMove: (id: string, position: { x: number; y: number }) => void;
  onNodeResize: (
    id: string,
    geometry: {
      position: { x: number; y: number };
      width: number;
      height: number;
    },
  ) => void;
  onNodeDragStart: (id: string) => void;
  onNodeDragEnd: () => void;
  onConnect: (
    fromId: string,
    toId: string,
    fromSide?: ConnectionSide,
    toSide?: ConnectionSide,
  ) => void;
  /** True when any node is currently being moved. Used to pause the edge animation. */
  isDragging: boolean;
  /**
   * When set, the canvas is currently drawing a link from this node.
   * Used to highlight valid in-ports on every other node.
   */
  linkingFromId: string | null;
  onLinkStart: (fromId: string) => void;
  onLinkMove: (toX: number, toY: number) => void;
  onLinkEnd: (toId: string | null) => void;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string | null) => void;
  onEdgeReconnect: (
    edgeId: string,
    endpoint: 'from' | 'to',
    nodeId: string,
    side: ConnectionSide,
  ) => void;
  onEdgeUpdate: (
    edgeId: string,
    patch: { bendPoints?: FlowPoint[] },
  ) => void;
  /** Shape currently armed by the dock. When set, the canvas draws. */
  activeShape: NodeShape | null;
  /** Called when the user finishes drawing a shape on the canvas. */
  onShapeDrawn: (
    shape: NodeShape,
    position: { x: number; y: number },
    width: number,
    height: number,
  ) => void;
}

const MIN_ZOOM_RATIO = 0.25;
const MAX_ZOOM_RATIO = 4;
const ZOOM_BUTTON_FACTOR = 1.2;
const GRID_SIZE = 40;

export function FlowCanvas({
  document,
  activeNodeIds = [],
  runningEdgeIds = null,
  nodeExecutionStates,
  edgeExecutionStates,
  selectedNodeId,
  onSelectNode,
  onNodeMove,
  onNodeResize,
  onNodeDragStart,
  onNodeDragEnd,
  onConnect,
  isDragging,
  linkingFromId,
  onLinkStart,
  onLinkMove,
  onLinkEnd,
  selectedEdgeId,
  onSelectEdge,
  onEdgeReconnect,
  onEdgeUpdate,
  activeShape,
  onShapeDrawn,
}: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [viewOverride, setViewOverride] = useState<ViewTransform | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<PanState | null>(null);
  const suppressCanvasClickRef = useRef(false);
  // Pointer-tracking state for links, endpoint reconnects and shape drawing.
  const [link, setLink] = useState<LinkState | null>(null);
  const [reconnect, setReconnect] = useState<ReconnectState | null>(null);
  const [bendDrag, setBendDrag] = useState<BendDragState | null>(null);

  // Figma-style draw gesture. `drawStart` is captured on the first
  // pointerdown when a shape is armed; `drawCurrent` follows the
  // pointer until release. The rect is stored normalised (min/max +
  // width/height) so flipping the drag direction never produces
  // negative dimensions.
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Track the container's pixel size so the viewBox can be set to
  // match. Without this, a container smaller than the data extent
  // would clip the chart.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setContainerSize({ width: r.width, height: r.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dataViewBox = useMemo(() => computeDataViewBox(document), [document]);
  const viewBox = useMemo(
    () =>
      containerSize
        ? { x: 0, y: 0, width: containerSize.width, height: containerSize.height }
        : dataViewBox,
    [containerSize, dataViewBox],
  );

  /**
   * viewTransform maps data coords → viewBox (container pixel) coords.
   * The chart fits the container with padding so nodes near the bbox
   * edge don't touch the canvas border.
   */
  const fitTransform = useMemo<ViewTransform>(() => {
    if (!containerSize) return { x: 0, y: 0, scale: 1 };
    const PAD = 60;
    const drawW = Math.max(1, containerSize.width - PAD * 2);
    const drawH = Math.max(1, containerSize.height - PAD * 2);
    const scale = Math.min(
      drawW / Math.max(1, dataViewBox.width),
      drawH / Math.max(1, dataViewBox.height),
    );
    const drawnW = dataViewBox.width * scale;
    const drawnH = dataViewBox.height * scale;
    const offsetX = (containerSize.width - drawnW) / 2;
    const offsetY = (containerSize.height - drawnH) / 2;
    return {
      x: offsetX - dataViewBox.x * scale,
      y: offsetY - dataViewBox.y * scale,
      scale,
    };
  }, [containerSize, dataViewBox]);
  const viewTransform = viewOverride ?? fitTransform;
  const zoomRatio = fitTransform.scale > 0
    ? viewTransform.scale / fitTransform.scale
    : 1;

  const zoomAt = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      if (!containerSize) return;
      const focus = anchor ?? {
        x: containerSize.width / 2,
        y: containerSize.height / 2,
      };
      setViewOverride((currentOverride) => {
        const current = currentOverride ?? fitTransform;
        const minScale = fitTransform.scale * MIN_ZOOM_RATIO;
        const maxScale = fitTransform.scale * MAX_ZOOM_RATIO;
        const nextScale = Math.max(
          minScale,
          Math.min(maxScale, current.scale * factor),
        );
        if (Math.abs(nextScale - current.scale) < 0.0001) return current;
        const dataX = (focus.x - current.x) / current.scale;
        const dataY = (focus.y - current.y) / current.scale;
        return {
          x: focus.x - dataX * nextScale,
          y: focus.y - dataY * nextScale,
          scale: nextScale,
        };
      });
    },
    [containerSize, fitTransform],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      zoomAt(Math.exp(-delta * 0.0015), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [zoomAt],
  );

  const snapPoint = useCallback(
    (point: { x: number; y: number }) => snapEnabled
      ? {
          x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
        }
      : point,
    [snapEnabled],
  );

  const handlePanPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const isMiddleButton = event.button === 1;
      const isEmptyCanvas = event.button === 0 && event.target === event.currentTarget;
      if (
        (!isMiddleButton && !isEmptyCanvas) ||
        link !== null ||
        reconnect !== null
        || bendDrag !== null
      ) {
        return;
      }

      // When a shape is armed and the user pointerdowns on empty
      // canvas, start a Figma-style draw instead of panning. We
      // capture the data-space start so a later pointermove (handled
      // by the window-level effect) can render the live preview.
      if (activeShape && isEmptyCanvas && svgRef.current) {
        event.preventDefault();
        event.stopPropagation();
        const p = screenToData(svgRef.current, event.clientX, event.clientY, viewTransform);
        const snapped = snapPoint(p);
        setDrawStart(snapped);
        setDrawCurrent(snapped);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      suppressCanvasClickRef.current = false;
      panRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startTransform: viewTransform,
        moved: false,
      };
      setViewOverride(viewTransform);
      setIsPanning(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* Pointer capture is unavailable in some test environments. */
      }
    },
    [activeShape, bendDrag, link, reconnect, snapPoint, viewTransform],
  );

  const handlePanPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const dx = event.clientX - pan.startClientX;
      const dy = event.clientY - pan.startClientY;
      if (!pan.moved && Math.hypot(dx, dy) >= 3) {
        pan.moved = true;
        suppressCanvasClickRef.current = true;
      }
      setViewOverride({
        ...pan.startTransform,
        x: pan.startTransform.x + dx,
        y: pan.startTransform.y + dy,
      });
    },
    [],
  );

  const finishPan = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* Pointer capture may already have been released. */
      }
      panRef.current = null;
      setIsPanning(false);
    },
    [],
  );

  const handleNodeMove = useCallback(
    (id: string, position: { x: number; y: number }) => {
      onNodeMove(id, snapPoint(position));
    },
    [onNodeMove, snapPoint],
  );

  const nodesById = useMemo(
    () => new Map(document.nodes.map((n) => [n.id, n])),
    [document],
  );
  const performanceMode = document.nodes.length > 20 || document.edges.length > 28;
  const visibleNodeIds = useMemo(() => {
    if (!performanceMode || !containerSize) {
      return new Set(document.nodes.map((node) => node.id));
    }
    const margin = 100;
    return new Set(
      document.nodes
        .filter((node) => {
          const style = resolveNodeStyle(node);
          const halfWidth = (style.width * viewTransform.scale) / 2;
          const halfHeight = (style.height * viewTransform.scale) / 2;
          const x = node.position.x * viewTransform.scale + viewTransform.x;
          const y = node.position.y * viewTransform.scale + viewTransform.y;
          return x + halfWidth >= -margin &&
            x - halfWidth <= containerSize.width + margin &&
            y + halfHeight >= -margin &&
            y - halfHeight <= containerSize.height + margin;
        })
        .map((node) => node.id),
    );
  }, [containerSize, document.nodes, performanceMode, viewTransform]);
  const visibleEdges = useMemo(() => {
    if (!performanceMode || !containerSize) return document.edges;
    return document.edges.filter((edge) => {
      if (edge.id === selectedEdgeId) return true;
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      if (!from || !to) return false;
      if (visibleNodeIds.has(from.id) || visibleNodeIds.has(to.id)) return true;
      const geometry = buildEdgeGeometry(edge, from, to);
      const points = [geometry.start, geometry.mid, geometry.end].map((point) => ({
        x: point.x * viewTransform.scale + viewTransform.x,
        y: point.y * viewTransform.scale + viewTransform.y,
      }));
      const margin = 80;
      const minX = Math.min(...points.map((point) => point.x));
      const maxX = Math.max(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      const maxY = Math.max(...points.map((point) => point.y));
      return maxX >= -margin &&
        minX <= containerSize.width + margin &&
        maxY >= -margin &&
        minY <= containerSize.height + margin;
    });
  }, [
    containerSize,
    document.edges,
    nodesById,
    performanceMode,
    selectedEdgeId,
    viewTransform,
    visibleNodeIds,
  ]);
  const active = useMemo(() => new Set(activeNodeIds), [activeNodeIds]);
  const runningEdges = useMemo(
    () => runningEdgeIds === null ? null : new Set(runningEdgeIds),
    [runningEdgeIds],
  );
  const selectedEdgeRoute = useMemo(() => {
    const edge = document.edges.find((item) => item.id === selectedEdgeId);
    if (!edge) return null;
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) return null;
    return {
      edge,
      from,
      to,
      geometry: buildEdgeGeometry(edge, from, to),
      color: edge.color ?? resolveNodeStyle(from).foreground,
    };
  }, [document.edges, nodesById, selectedEdgeId]);

  // The source is also stored in a ref so pointerup can finish a link
  // synchronously, without waiting for parent state to re-render.
  const linkSourceRef = useRef<{
    nodeId: string;
    side: ConnectionSide;
  } | null>(null);

  const finishLink = useCallback(
    (targetId: string | null, targetSide?: ConnectionSide) => {
      const source = linkSourceRef.current;
      if (source && targetId && source.nodeId !== targetId && targetSide) {
        onConnect(source.nodeId, targetId, source.side, targetSide);
      }
      linkSourceRef.current = null;
      setLink(null);
      // Parent state is only used for UI highlighting now.
      onLinkEnd(null);
    },
    [onConnect, onLinkEnd],
  );

  // Listen for pointermove/up at the window level while a link is
  // being drawn — the pointer can leave the SVG during the gesture
  // and we still want the ghost to follow it.
  useEffect(() => {
    if (!link) return;
    const onMove = (e: PointerEvent) => {
      if (!svgRef.current) return;
      const p = screenToData(svgRef.current, e.clientX, e.clientY, viewTransform);
      setLink((prev) => (prev ? { ...prev, toX: p.x, toY: p.y } : prev));
      onLinkMove(p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      // Hit-test for an in-port using elementFromPoint. We accept the
      // first ancestor that is one of our four port elements.
      const target = globalThis.document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const portEl = target?.closest('[data-port]') as HTMLElement | null;
      const targetId = portEl?.getAttribute('data-node-id') ?? null;
      const targetSide = portEl?.getAttribute('data-side') as ConnectionSide | null;
      finishLink(targetId, targetSide ?? undefined);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [finishLink, link, onLinkMove, viewTransform]);

  // Reconnect either endpoint of a selected line. The document is only
  // mutated after a valid port drop, so cancelling never damages the edge.
  useEffect(() => {
    if (!reconnect) return;
    const onMove = (event: PointerEvent) => {
      if (!svgRef.current) return;
      const pointer = screenToData(
        svgRef.current,
        event.clientX,
        event.clientY,
        viewTransform,
      );
      setReconnect((current) => current ? { ...current, pointer } : current);
    };
    const onUp = (event: PointerEvent) => {
      const target = globalThis.document.elementFromPoint(
        event.clientX,
        event.clientY,
      ) as HTMLElement | null;
      const port = target?.closest('[data-port]') as HTMLElement | null;
      const nodeId = port?.getAttribute('data-node-id') ?? null;
      const side = port?.getAttribute('data-side') as ConnectionSide | null;
      if (nodeId && side && nodeId !== reconnect.fixedNodeId) {
        onEdgeReconnect(reconnect.edgeId, reconnect.endpoint, nodeId, side);
      }
      setReconnect(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [onEdgeReconnect, reconnect, viewTransform]);

  // Bend handles update the persisted waypoint on every move so the line,
  // markers and animated effects remain locked to the pointer.
  useEffect(() => {
    if (!bendDrag) return;
    const onMove = (event: PointerEvent) => {
      if (!svgRef.current) return;
      const point = snapPoint(screenToData(
        svgRef.current,
        event.clientX,
        event.clientY,
        viewTransform,
      ));
      setBendDrag((current) => {
        if (!current) return current;
        const points = current.points.map((item, index) =>
          index === current.pointIndex ? point : item,
        );
        onEdgeUpdate(current.edgeId, { bendPoints: points });
        return { ...current, points };
      });
    };
    const onUp = () => setBendDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [bendDrag, onEdgeUpdate, snapPoint, viewTransform]);

  // While a shape is being drawn, follow the pointer at the window
  // level so the user can leave the SVG and still see the preview.
  useEffect(() => {
    if (drawStart === null) return;
    const onMove = (e: PointerEvent) => {
      if (!svgRef.current) return;
      const p = screenToData(svgRef.current, e.clientX, e.clientY, viewTransform);
      setDrawCurrent(snapPoint(p));
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [drawStart, snapPoint, viewTransform]);

  // Pointerup anywhere on the window finalises the draw. If the user
  // barely moved we fall back to a default-sized shape so a single
  // click still produces a usable block.
  useEffect(() => {
    if (drawStart === null || activeShape === null) return;
    const onUp = () => {
      const start = drawStart;
      const end = drawCurrent ?? start;
      const minX = Math.min(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxX = Math.max(start.x, end.x);
      const maxY = Math.max(start.y, end.y);
      const dragged = Math.hypot(maxX - minX, maxY - minY) >= 4;
      const width = dragged ? Math.max(40, maxX - minX) : 190;
      const height = dragged ? Math.max(40, maxY - minY) : 86;
      onShapeDrawn(activeShape, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, width, height);
      setDrawStart(null);
      setDrawCurrent(null);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [activeShape, drawCurrent, drawStart, onShapeDrawn]);

  const handlePortPointerDown = (nodeId: string, side: ConnectionSide) => {
    const node = nodesById.get(nodeId);
    if (!node || !svgRef.current) return;
    const outputAnchor = nodePortAnchor(node, side);
    linkSourceRef.current = { nodeId, side };
    onLinkStart(nodeId);
    setLink({
      fromId: nodeId,
      fromSide: side,
      toX: node.position.x + outputAnchor.x * 1.8,
      toY: node.position.y + outputAnchor.y * 1.8,
    });
  };

  const handlePortPointerUp = (nodeId: string, side: ConnectionSide) => {
    // Complete reconnect here, before the event bubbles to window. React may
    // synchronously re-render the port and remove the window listener during
    // that same pointerup, so relying on the global listener alone is racy.
    if (reconnect) {
      if (nodeId !== reconnect.fixedNodeId) {
        onEdgeReconnect(
          reconnect.edgeId,
          reconnect.endpoint,
          nodeId,
          side,
        );
      }
      setReconnect(null);
      return;
    }
    // This fires when the user releases the pointer ON a port. The
    // window-level listener above handles the generic case; this
    // exists for in-port drops that land on a different node's port.
    finishLink(nodeId, side);
  };

  return (
    <div
      ref={containerRef}
      data-flowgram-canvas
      className="relative h-full w-full overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-white/10"
      onWheel={handleWheel}
      onPointerDown={(e) => {
        // Clicking the canvas background clears the selection. We
        // let the SVG itself handle the click so e.target is the SVG
        // root, not the wrapping div.
        if (e.target === e.currentTarget) {
          onSelectNode(null);
          onSelectEdge(null);
        }
      }}
    >
      {gridVisible && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: `${Math.max(12, GRID_SIZE * viewTransform.scale)}px ${Math.max(12, GRID_SIZE * viewTransform.scale)}px`,
            backgroundPosition: `${viewTransform.x}px ${viewTransform.y}px`,
          }}
        />
      )}

      <div
        className="absolute right-4 bottom-4 z-20 flex items-center overflow-hidden rounded-xl bg-zinc-900/92 text-zinc-300 ring-1 ring-white/12 shadow-[0_14px_40px_rgba(0,0,0,.48),0_0_24px_rgba(34,211,238,.08)] backdrop-blur-xl"
        role="group"
        aria-label="Canvas zoom controls"
      >
        <button
          type="button"
          onClick={() => zoomAt(1 / ZOOM_BUTTON_FACTOR)}
          disabled={zoomRatio <= MIN_ZOOM_RATIO + 0.001}
          className="grid h-10 w-10 place-items-center transition hover:bg-white/8 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus size={15} />
        </button>
        <output
          className="grid h-10 min-w-14 place-items-center border-x border-white/8 px-2 font-mono text-[10px] font-semibold text-cyan-100"
          aria-live="polite"
          aria-label={`Zoom ${Math.round(zoomRatio * 100)} percent`}
        >
          {Math.round(zoomRatio * 100)}%
        </output>
        <button
          type="button"
          onClick={() => zoomAt(ZOOM_BUTTON_FACTOR)}
          disabled={zoomRatio >= MAX_ZOOM_RATIO - 0.001}
          className="grid h-10 w-10 place-items-center transition hover:bg-white/8 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={() => setViewOverride(null)}
          className="inline-flex h-10 items-center gap-1.5 border-l border-white/8 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition hover:bg-cyan-400/8 hover:text-cyan-200"
          aria-label="Fit diagram to view"
          title="Fit diagram to view"
        >
          <Maximize2 size={13} /> Fit
        </button>
        <button
          type="button"
          onClick={() => setSnapEnabled((enabled) => !enabled)}
          aria-pressed={snapEnabled}
          className={[
            'inline-flex h-10 items-center gap-1.5 border-l border-white/8 px-3 text-[9px] font-bold uppercase tracking-[0.14em] transition',
            snapEnabled
              ? 'bg-cyan-400/10 text-cyan-200'
              : 'text-zinc-600 hover:bg-white/6 hover:text-zinc-300',
          ].join(' ')}
          aria-label={`${snapEnabled ? 'Disable' : 'Enable'} snap to grid`}
          title={`Snap to ${GRID_SIZE}px grid: ${snapEnabled ? 'on' : 'off'}`}
        >
          <Magnet size={13} /> Snap
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              snapEnabled
                ? 'bg-cyan-300 shadow-[0_0_7px_rgba(103,232,249,.8)]'
                : 'bg-zinc-700',
            ].join(' ')}
          />
        </button>
        <button
          type="button"
          onClick={() => setGridVisible((visible) => !visible)}
          aria-pressed={gridVisible}
          className={[
            'inline-flex h-10 items-center gap-1.5 border-l border-white/8 px-3 text-[9px] font-bold uppercase tracking-[0.14em] transition',
            gridVisible
              ? 'bg-cyan-400/10 text-cyan-200'
              : 'text-zinc-600 hover:bg-white/6 hover:text-zinc-300',
          ].join(' ')}
          aria-label={`${gridVisible ? 'Hide' : 'Show'} grid`}
          title={`${gridVisible ? 'Hide' : 'Show'} grid`}
        >
          <Grid2x2 size={13} /> Grid
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              gridVisible
                ? 'bg-cyan-300 shadow-[0_0_7px_rgba(103,232,249,.8)]'
                : 'bg-zinc-700',
            ].join(' ')}
          />
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className={[
          'relative h-full w-full touch-none',
          activeShape !== null
            ? 'cursor-crosshair'
            : isPanning
              ? 'cursor-grabbing'
              : 'cursor-grab',
        ].join(' ')}
        preserveAspectRatio="none"
        onPointerDownCapture={handlePanPointerDown}
        onPointerMoveCapture={handlePanPointerMove}
        onPointerUpCapture={finishPan}
        onPointerCancelCapture={finishPan}
        onClick={(e) => {
          if (suppressCanvasClickRef.current) {
            suppressCanvasClickRef.current = false;
            return;
          }
          if (e.target === e.currentTarget) {
            onSelectNode(null);
            onSelectEdge(null);
          }
        }}
      >
        {/* Wrapping group: maps data coords into the viewBox (= the
            container's pixel size) so the chart fills the canvas
            uniformly regardless of aspect ratio. */}
        <g
          transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}
        >
        {visibleEdges.map((edge) => {
          const from = nodesById.get(edge.from);
          const to = nodesById.get(edge.to);
          if (!from || !to) return null;
          const edgeColor = edge.color ?? resolveNodeStyle(from).foreground;
          return (
            <AnimatedEdge
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              paused={
                isDragging ||
                link !== null ||
                reconnect !== null ||
                bendDrag !== null ||
                (runningEdges !== null && !runningEdges.has(edge.id))
              }
              interactive
              selected={selectedEdgeId === edge.id}
              onClick={(id) => onSelectEdge(id)}
              color={edgeColor}
              effectColor={edge.effectColor}
              performanceMode={performanceMode}
              executionState={edgeExecutionStates?.[edge.id] ?? 'normal'}
            />
          );
        })}

        {reconnect && selectedEdgeRoute && (
          <ReconnectPreview
            fixed={
              reconnect.endpoint === 'from'
                ? selectedEdgeRoute.geometry.end
                : selectedEdgeRoute.geometry.start
            }
            pointer={reconnect.pointer}
            color={selectedEdgeRoute.color}
            scale={viewTransform.scale}
          />
        )}

        {/* Ghost edge while drawing a new link. */}
        {link && nodesById.get(link.fromId) && (
          <GhostEdge
            fromX={nodesById.get(link.fromId)!.position.x}
            fromY={nodesById.get(link.fromId)!.position.y}
            toX={link.toX}
            toY={link.toY}
            fromShape={nodesById.get(link.fromId)!.shape}
            fromSide={
              link.fromSide
            }
            fromAnchor={nodePortAnchor(
              nodesById.get(link.fromId)!,
              link.fromSide,
            )}
            color={resolveNodeStyle(nodesById.get(link.fromId)!).foreground}
          />
        )}

        {document.nodes.filter((node) => visibleNodeIds.has(node.id)).map((node) => (
          <FlowNodeCard
            key={node.id}
            node={node}
            performanceMode={performanceMode}
            isActive={active.has(node.id)}
            executionState={nodeExecutionStates?.[node.id] ?? 'normal'}
            isSelected={selectedNodeId === node.id}
            linkTargetFromId={
              reconnect?.fixedNodeId ?? link?.fromId ?? linkingFromId
            }
            viewTransform={viewTransform}
            onSelect={onSelectNode}
            onMove={handleNodeMove}
            onResize={onNodeResize}
            onDragStart={onNodeDragStart}
            onDragEnd={onNodeDragEnd}
            onPortPointerDown={handlePortPointerDown}
            onPortPointerUp={handlePortPointerUp}
            registerSvgRef={() => {
              // We rely on the parent SVG ref for coord conversion;
              // individual node refs aren't needed at the canvas level.
            }}
          />
        ))}

        {selectedEdgeRoute && (
          <>
            {selectedEdgeRoute.geometry.points?.slice(1, -1).map((point, index) => (
              <BendHandle
                key={`${selectedEdgeRoute.edge.id}-bend-${index}`}
                index={index}
                point={point}
                color={selectedEdgeRoute.color}
                scale={viewTransform.scale}
                active={bendDrag?.pointIndex === index}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const points = selectedEdgeRoute.geometry.points!.slice(1, -1);
                  onEdgeUpdate(selectedEdgeRoute.edge.id, { bendPoints: points });
                  setBendDrag({
                    edgeId: selectedEdgeRoute.edge.id,
                    pointIndex: index,
                    points,
                  });
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const points = selectedEdgeRoute.geometry.points!
                    .slice(1, -1)
                    .filter((_, pointIndex) => pointIndex !== index);
                  onEdgeUpdate(selectedEdgeRoute.edge.id, {
                    bendPoints: points.length ? points : undefined,
                  });
                }}
              />
            ))}
            <EndpointHandle
              label="A"
              point={selectedEdgeRoute.geometry.start}
              color={selectedEdgeRoute.color}
              scale={viewTransform.scale}
              active={reconnect?.endpoint === 'from'}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setReconnect({
                  edgeId: selectedEdgeRoute.edge.id,
                  endpoint: 'from',
                  fixedNodeId: selectedEdgeRoute.edge.to,
                  pointer: selectedEdgeRoute.geometry.start,
                });
              }}
            />
            <EndpointHandle
              label="B"
              point={selectedEdgeRoute.geometry.end}
              color={selectedEdgeRoute.color}
              scale={viewTransform.scale}
              active={reconnect?.endpoint === 'to'}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setReconnect({
                  edgeId: selectedEdgeRoute.edge.id,
                  endpoint: 'to',
                  fixedNodeId: selectedEdgeRoute.edge.from,
                  pointer: selectedEdgeRoute.geometry.end,
                });
              }}
            />
          </>
        )}

        {/* Figma-style shape-draw preview. The preview uses the same
            SHAPES path table as the final node so the user sees the
            exact silhouette they will get. We render the silhouette
            scaled to the drag rectangle, with a cyan dashed stroke
            and a translucent fill — Figma's draw affordance. */}
        {activeShape && drawStart && drawCurrent && (
          <DrawPreview
            shape={activeShape}
            start={drawStart}
            current={drawCurrent}
          />
        )}
        </g>
      </svg>
    </div>
  );
}

function BendHandle({
  index,
  point,
  color,
  scale,
  active,
  onPointerDown,
  onDoubleClick,
}: {
  index: number;
  point: FlowPoint;
  color: string;
  scale: number;
  active: boolean;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
  onDoubleClick: (event: React.MouseEvent<SVGGElement>) => void;
}) {
  const safeScale = Math.max(0.08, scale);
  const size = 9 / safeScale;
  return (
    <g
      transform={`translate(${point.x} ${point.y})`}
      className="cursor-move"
      pointerEvents="all"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      role="button"
      aria-label={`Move bend point ${index + 1}`}
    >
      <circle r={20 / safeScale} fill="transparent" />
      <rect
        x={-size}
        y={-size}
        width={size * 2}
        height={size * 2}
        rx={3 / safeScale}
        fill={active ? color : '#09090b'}
        stroke={color}
        strokeWidth={2 / safeScale}
        transform="rotate(45)"
      />
      <circle r={2.25 / safeScale} fill={active ? '#09090b' : color} />
    </g>
  );
}

function EndpointHandle({
  label,
  point,
  color,
  scale,
  active,
  onPointerDown,
}: {
  label: 'A' | 'B';
  point: { x: number; y: number };
  color: string;
  scale: number;
  active: boolean;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}) {
  const safeScale = Math.max(0.08, scale);
  const radius = 11 / safeScale;
  return (
    <g
      transform={`translate(${point.x} ${point.y})`}
      className="cursor-grab active:cursor-grabbing"
      pointerEvents="all"
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`Reconnect endpoint ${label}`}
    >
      <circle r={20 / safeScale} fill="transparent" />
      <circle
        r={radius + (active ? 3 : 0) / safeScale}
        fill="#09090b"
        stroke={color}
        strokeWidth={2 / safeScale}
      />
      <circle r={radius * 0.62} fill={color} opacity={active ? 0.34 : 0.18} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={9 / safeScale}
        fontWeight={800}
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

function ReconnectPreview({
  fixed,
  pointer,
  color,
  scale,
}: {
  fixed: { x: number; y: number };
  pointer: { x: number; y: number };
  color: string;
  scale: number;
}) {
  const safeScale = Math.max(0.08, scale);
  return (
    <g pointerEvents="none" style={{ color }}>
      <path
        d={`M ${fixed.x} ${fixed.y} L ${pointer.x} ${pointer.y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2 / safeScale}
        strokeDasharray={`${7 / safeScale} ${7 / safeScale}`}
        strokeLinecap="round"
        opacity={0.92}
      />
      <circle
        cx={pointer.x}
        cy={pointer.y}
        r={6 / safeScale}
        fill="currentColor"
      />
    </g>
  );
}

/**
 * Live preview rendered while the user click-drags a shape on the
 * canvas. We re-use the same SHAPES path table the final node will
 * use, scaled to the drag rectangle, so what you see is what you
 * get. The `ellipse` shape isn't path-based — it has to be drawn
 * with the SVG <ellipse> primitive.
 */
function DrawPreview({
  shape,
  start,
  current,
}: {
  shape: NodeShape;
  start: { x: number; y: number };
  current: { x: number; y: number };
}) {
  const minX = Math.min(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  const maxX = Math.max(start.x, current.x);
  const maxY = Math.max(start.y, current.y);
  const width = Math.max(8, maxX - minX);
  const height = Math.max(8, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // SHAPES paths are authored in a 112×112 box centred on the origin
  // (NODE_BOUNDING_RADIUS = 56). Scale to fit the drag rectangle.
  const scaleX = width / 112;
  const scaleY = height / 112;
  const spec = SHAPES[shape];

  return (
    <g transform={`translate(${cx} ${cy}) scale(${scaleX} ${scaleY})`} pointerEvents="none">
      {shape === 'ellipse' ? (
        <ellipse
          cx={0}
          cy={0}
          rx={56}
          ry={36}
          fill="rgba(34, 211, 238, 0.12)"
          stroke="#22d3ee"
          strokeWidth={2 / Math.max(scaleX, scaleY)}
          strokeDasharray={`${8 / Math.max(scaleX, scaleY)} ${6 / Math.max(scaleX, scaleY)}`}
        />
      ) : (
        <path
          d={spec.d}
          fill="rgba(34, 211, 238, 0.12)"
          stroke="#22d3ee"
          strokeWidth={2 / Math.max(scaleX, scaleY)}
          strokeDasharray={`${8 / Math.max(scaleX, scaleY)} ${6 / Math.max(scaleX, scaleY)}`}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

/**
 * Compute the bounding box of the document with some padding so the
 * SVG viewBox always frames the chart without manual sizing.
 */
function computeDataViewBox(doc: FlowDocumentJSON) {
  if (doc.nodes.length === 0) {
    return { x: 0, y: 0, width: 800, height: 480 };
  }
  const PAD = 120;
  const minX = Math.min(
    ...doc.nodes.map((node) =>
      node.position.x - Math.max(node.width ?? 112, node.height ?? 112) / 2,
    ),
  ) - PAD;
  const minY = Math.min(
    ...doc.nodes.map((node) =>
      node.position.y - Math.max(node.width ?? 112, node.height ?? 112) / 2,
    ),
  ) - PAD;
  const maxX = Math.max(
    ...doc.nodes.map((node) =>
      node.position.x + Math.max(node.width ?? 112, node.height ?? 112) / 2,
    ),
  ) + PAD;
  const maxY = Math.max(
    ...doc.nodes.map((node) =>
      node.position.y + Math.max(node.width ?? 112, node.height ?? 112) / 2,
    ),
  ) + PAD;
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
