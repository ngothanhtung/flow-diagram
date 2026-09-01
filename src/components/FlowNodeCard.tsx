'use client';

import { createElement, useEffect, useRef } from 'react';
import { screenToData } from '@/lib/coords';
import { NODE_FADE_DURATION_MS } from '@/lib/execution-timing';
import { NODE_FONT_FAMILIES, NODE_FONT_WEIGHTS } from '@/lib/node-fonts';
import { useResolvedIcon } from '@/lib/icon-library';
import type { ConnectionSide, ExecutionState, FlowNode, NodeShape } from '@/lib/flowchart-types';
import { GROUP_HEADER_HEIGHT, TEXT_PADDING, nodeOutline, nodeSizeLimits, resolveNodeStyle } from '@/lib/node-style';
import { NodeEffectLayer, nodeMotionStyle, resolveEffectKnobs } from './node-effect-layer';
import { TableCardBody } from './TableCardBody';
import type { ViewTransform } from '@/lib/view-transform';
import { NODE_BOUNDING_RADIUS } from './edge-geometry';

interface FlowNodeCardProps {
  node: FlowNode;
  /** Reduce costly SVG filters/entry motion on large diagrams. */
  performanceMode?: boolean;
  /** Static run mode: freeze this node's own motion/decoration effect. */
  effectsPaused?: boolean;
  executionState?: ExecutionState;
  isActive?: boolean;
  isSelected?: boolean;
  /** Corner resize handles. Off while several nodes are selected: with a
   *  multi-selection there is no single box those handles would resize,
   *  and they'd sit on top of the neighbours' rings. */
  showResizeHandles?: boolean;
  /** Viewer mode: no dragging, no ports — the node renders inert. */
  readOnly?: boolean;
  /**
   * If set, this node is a valid drop target for a pending link from
   * the given source id. The in port renders a pulsing ring so the
   * user can see where to release.
   */
  linkTargetFromId?: string | null;
  /**
   * Viewport → data coord mapping. Needed to convert pointer events
   * (in screen pixels) into the chart's logical coordinate system.
   */
  viewTransform: ViewTransform;
  /** `additive` is a shift-click: add to / remove from the selection
   *  instead of replacing it. */
  onSelect: (id: string, additive: boolean) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onResize: (
    id: string,
    geometry: {
      position: { x: number; y: number };
      width: number;
      height: number;
    },
  ) => void;
  onDragStart: (id: string) => void;
  /** Drag finished. The id lets the canvas resolve what the node was
   *  dropped on — that is how group membership is assigned. */
  onDragEnd: (id: string) => void;
  onPortPointerDown: (nodeId: string, side: ConnectionSide, e: React.PointerEvent<SVGElement>) => void;
  onPortPointerUp: (nodeId: string, side: ConnectionSide, e: React.PointerEvent<SVGElement>) => void;
  registerSvgRef: (el: SVGGElement | null) => void;
}

const PORT_HIT_R = 18;
const BASE_SIZE = NODE_BOUNDING_RADIUS * 2;

type ResizeDirection = 'nw' | 'ne' | 'se' | 'sw';

const RESIZE_HANDLES: Array<{
  direction: ResizeDirection;
  x: number;
  y: number;
  cursor: string;
}> = [
  { direction: 'nw', x: -1, y: -1, cursor: 'nwse-resize' },
  { direction: 'ne', x: 1, y: -1, cursor: 'nesw-resize' },
  { direction: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
  { direction: 'sw', x: -1, y: 1, cursor: 'nesw-resize' },
];

const CONNECTION_SIDES: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];

function ShapeDecoration({ shape, color }: { shape: NodeShape; color: string }) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.25,
    opacity: 0.42,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  switch (shape) {
    case 'database':
      return (
        <>
          <path d='M -56 -34 C -56 -19 56 -19 56 -34' {...common} />
        </>
      );
    case 'server':
      return (
        <>
          <path d='M -56 -19 H 56 M -56 19 H 56' {...common} />
          {[-37, -29, 29, 37].map((x) => (
            <circle key={x} cx={x} cy={-37} r={2.3} fill={color} opacity={0.5} />
          ))}
          {[-37, -29, 29, 37].map((x) => (
            <circle key={x} cx={x} cy={37} r={2.3} fill={color} opacity={0.5} />
          ))}
        </>
      );
    case 'queue':
      return (
        <>
          <path d='M -56 -46 H 46 V 56' {...common} />
          <path d='M -46 -46 H 46 V 46 H -46 Z' {...common} />
          <path d='M -34 -16 H 34 M -34 0 H 34 M -34 16 H 34' {...common} />
        </>
      );
    case 'component':
      return (
        <>
          <rect x={-46} y={-19} width={20} height={11} rx={1.5} {...common} />
          <rect x={-46} y={8} width={20} height={11} rx={1.5} {...common} />
          <path d='M -21 -14 H -11 M -21 14 H -11' {...common} />
        </>
      );
    case 'predefined-process':
      return <path d='M -38 -56 V 56 M 38 -56 V 56' {...common} />;
    case 'internal-storage':
      return <path d='M -38 -56 V 56 M -56 -37 H 56' {...common} />;
    case 'note':
      return <path d='M 23 -56 V -23 H 56' {...common} />;
    case 'multi-document':
      return (
        <>
          <path d='M -44 -56 H 56 V 28 C 28 14 -14 42 -44 30' {...common} />
          <path d='M -50 -50 H 50' {...common} />
        </>
      );
    case 'delay':
      return <path d='M 27 -56 C 6 -42 6 42 27 56' {...common} />;
    case 'circle-x':
      return <path d='M -34 -34 L 34 34 M 34 -34 L -34 34' {...common} />;
    case 'circle-plus':
      return <path d='M 0 -40 V 40 M -40 0 H 40' {...common} />;
    default:
      return null;
  }
}

/**
 * Node card. The body is an SVG <path> whose `d` is generated per shape
 * (circle, rounded, hexagon, diamond), so the silhouette is exact and
 * ports snap to the real outline. The icon and text live inside a
 * `<foreignObject>` clipped to the same bounding box.
 */
export function FlowNodeCard({
  node,
  performanceMode = false,
  effectsPaused = false,
  executionState = 'normal',
  isActive = false,
  isSelected = false,
  showResizeHandles = true,
  readOnly = false,
  linkTargetFromId = null,
  viewTransform,
  onSelect,
  onMove,
  onResize,
  onDragStart,
  onDragEnd,
  onPortPointerDown,
  onPortPointerUp,
  registerSvgRef,
}: FlowNodeCardProps) {
  const style = resolveNodeStyle(node);
  const isGroup = node.type === 'group';
  const isText = node.type === 'text';
  const isIconObject = node.type === 'icon';
  const hasGroupTitle = isGroup && !!node.title?.trim();
  const Icon = useResolvedIcon(style.icon);
  const logoSlug = style.icon?.startsWith('logo:') ? style.icon.slice('logo:'.length) : null;
  const hasIcon = Boolean(Icon || logoSlug);
  const { shapeSpec, foreground, background, borderColor, width, height, rotation, borderWidth, borderStyle, opacity, fill, shadow, iconSize, iconPosition, blockAlign, fontSize, fontFamily, fontWeight, textAlign, portSize } = style;
  const clusterAlign = blockAlign === 'left' ? 'flex-start' : blockAlign === 'right' ? 'flex-end' : 'center';
  // Horizontal padding runs wider than vertical so text never crowds the
  // rounded corners or the side ports.
  const cardPadding = Math.max(10, Math.min(width, height) * 0.13);
  const scaleX = width / BASE_SIZE;
  const scaleY = height / BASE_SIZE;
  const outline = nodeOutline(style.shape, width, height);
  const portAnchors = Object.fromEntries(
    CONNECTION_SIDES.map((side) => [
      side,
      {
        x: shapeSpec.anchors[side].x * scaleX,
        y: shapeSpec.anchors[side].y * scaleY,
      },
    ]),
  ) as Record<ConnectionSide, { x: number; y: number }>;
  const dashArray = borderStyle === 'dashed' ? `${borderWidth * 5} ${borderWidth * 3}` : borderStyle === 'dotted' ? `${borderWidth} ${borderWidth * 2.5}` : undefined;
  const neonFaint = borderColor.length === 7 ? `${borderColor}38` : borderColor;
  const neonSoft = borderColor.length === 7 ? `${borderColor}70` : borderColor;
  // `shadow` casts depth and nothing else — a plain dark drop shadow. It
  // used to add a coloured halo too, which meant a node glowed without any
  // effect being chosen. Glow now comes only from `effect: 'glow'`/'pulse'.
  const filter = shadow === 'none' ? undefined : shadow === 'glow' ? 'drop-shadow(0 10px 18px rgba(0,0,0,.5))' : 'drop-shadow(0 6px 10px rgba(0,0,0,.38))';
  const safeId = node.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  const gradientId = `node-sheen-${safeId}`;
  // Effects are entirely opt-in: with no `effect` the node paints and
  // behaves exactly as it did before the field existed.
  const effect = node.effect ?? 'none';
  const { speed: effectSpeed, intensity: effectIntensity } = resolveEffectKnobs(node.effectSpeed, node.effectIntensity);
  const effectColor = node.effectColor ?? foreground;
  const motionStyle = nodeMotionStyle(effect, effectSpeed, effectIntensity, effectsPaused);
  const chargeGradientId = `node-charge-${node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const clipId = `node-clip-${node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const cardAccent = ['server', 'component', 'predefined-process', 'internal-storage', 'folder', 'note'].includes(style.shape);

  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    target: SVGGElement;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    direction: ResizeDirection;
    startPointer: { x: number; y: number };
    startPosition: { x: number; y: number };
    startWidth: number;
    startHeight: number;
    target: SVGCircleElement;
  } | null>(null);

  // Use refs to read the latest callbacks without re-attaching listeners.
  // Captured at drag start to avoid stale-closure bugs.
  const handlersRef = useRef({ onMove, onResize, onDragStart, onDragEnd });
  useEffect(() => {
    handlersRef.current = { onMove, onResize, onDragStart, onDragEnd };
  }, [onMove, onResize, onDragStart, onDragEnd]);

  const handleResizePointerDown = (direction: ResizeDirection, e: React.PointerEvent<SVGCircleElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    resizeRef.current = {
      pointerId: e.pointerId,
      direction,
      startPointer: screenToData(svg, e.clientX, e.clientY, viewTransform),
      startPosition: node.position,
      startWidth: width,
      startHeight: height,
      target: e.currentTarget,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* harmless in non-browser test environments */
    }
    handlersRef.current.onDragStart(node.id);
  };

  const handleResizePointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const pointer = screenToData(svg, e.clientX, e.clientY, viewTransform);
    const canvasDx = pointer.x - resize.startPointer.x;
    const canvasDy = pointer.y - resize.startPointer.y;
    const radians = (rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    // Pointer delta in the node's local (rotated) coordinate system.
    const dx = canvasDx * cos + canvasDy * sin;
    const dy = -canvasDx * sin + canvasDy * cos;

    let left = -resize.startWidth / 2;
    let right = resize.startWidth / 2;
    let top = -resize.startHeight / 2;
    let bottom = resize.startHeight / 2;
    // Same limits `resolveNodeStyle` clamps to, so a handle can reach
    // exactly what the renderer is willing to draw.
    const limits = nodeSizeLimits(node);
    if (resize.direction.includes('w')) left = Math.min(right - limits.minWidth, left + dx);
    if (resize.direction.includes('e')) right = Math.max(left + limits.minWidth, right + dx);
    if (resize.direction.includes('n')) top = Math.min(bottom - limits.minHeight, top + dy);
    if (resize.direction.includes('s')) bottom = Math.max(top + limits.minHeight, bottom + dy);

    const nextWidth = Math.min(limits.maxWidth, right - left);
    const nextHeight = Math.min(limits.maxHeight, bottom - top);
    // Preserve the opposite edge when the maximum size is reached.
    if (resize.direction.includes('w')) left = right - nextWidth;
    if (resize.direction.includes('e')) right = left + nextWidth;
    if (resize.direction.includes('n')) top = bottom - nextHeight;
    if (resize.direction.includes('s')) bottom = top + nextHeight;

    const localCenterX = (left + right) / 2;
    const localCenterY = (top + bottom) / 2;
    handlersRef.current.onResize(node.id, {
      width: nextWidth,
      height: nextHeight,
      position: {
        x: resize.startPosition.x + localCenterX * cos - localCenterY * sin,
        y: resize.startPosition.y + localCenterX * sin + localCenterY * cos,
      },
    });
  };

  const handleResizePointerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* harmless */
    }
    resizeRef.current = null;
    // A resize moves the node's centre too, so it settles group
    // membership on the same rule a drag does.
    handlersRef.current.onDragEnd(node.id);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (readOnly) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    const target = e.currentTarget;
    const svg = target.ownerSVGElement;
    if (!svg) return;
    // Capture the offset in data coords so subsequent moves
    // subtract the same constant — independent of zoom.
    const start = screenToData(svg, e.clientX, e.clientY, viewTransform);
    const offsetX = start.x - node.position.x;
    const offsetY = start.y - node.position.y;
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      target,
    };
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture can throw in jsdom; harmless */
    }
    handlersRef.current.onDragStart(node.id);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    if (!drag.moved && Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) < 4) {
      return;
    }
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const cur = screenToData(svg, e.clientX, e.clientY, viewTransform);
    handlersRef.current.onMove(node.id, {
      x: cur.x - drag.offsetX,
      y: cur.y - drag.offsetY,
    });
    drag.moved = true;
  };

  const handlePointerUp = (e: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* harmless */
    }
    // If the user didn't actually move, treat it as a click to select.
    if (!drag.moved) {
      onSelect(node.id, e.shiftKey);
    }
    handlersRef.current.onDragEnd(node.id);
    dragRef.current = null;
  };

  return (
    // Outer <g> only carries the hover group and cursor; the inner <g>
    // applies the position translate. There is deliberately no entry
    // animation here — `effect: 'none'` has to mean the node never moves,
    // and a spring-in ran on every mount and every canvas re-seed.
    <g className='group/node cursor-grab active:cursor-grabbing'>
      <g
        ref={registerSvgRef}
        transform={`translate(${node.position.x} ${node.position.y}) rotate(${rotation})`}
        opacity={executionState === 'pending' ? opacity * 0.38 : opacity}
        className={executionState === 'pending' ? 'node-power-pending' : executionState === 'active' ? 'node-power-active' : undefined}
        style={
          {
            color: foreground,
            '--node-opacity': opacity,
            '--node-fade-duration': `${NODE_FADE_DURATION_MS}ms`,
          } as React.CSSProperties
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Motion effects animate this wrapper rather than the group
            above, whose transform carries the node's position — a CSS
            animation on that one would fight the translate. */}
        <g style={motionStyle}>
        <defs>
          <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor={foreground} stopOpacity={0.18} />
            <stop offset='52%' stopColor={foreground} stopOpacity={0.06} />
            <stop offset='100%' stopColor={background} stopOpacity={0} />
          </linearGradient>
          <radialGradient id={chargeGradientId} cx='50%' cy='48%' r='68%'>
            <stop offset='0%' stopColor={foreground} stopOpacity={0.2} />
            <stop offset='58%' stopColor={foreground} stopOpacity={0.05} />
            <stop offset='100%' stopColor={foreground} stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* Active halo reuses the exact node silhouette. Size scaling
          lives on the parent group so the CSS pulse can animate the
          path without replacing the shape transform. */}
        {isActive && executionState !== 'active' && (
          <g transform={outline.transform} pointerEvents='none'>
            <path
              d={outline.d}
              className={performanceMode ? 'fill-none' : 'fill-none animate-[halo_1.6s_ease-in-out_infinite]'}
              stroke={foreground}
              strokeWidth={2}
              strokeLinejoin='round'
              vectorEffect='non-scaling-stroke'
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                filter: performanceMode ? undefined : `drop-shadow(0 0 4px ${neonSoft}) drop-shadow(0 0 12px ${neonFaint})`,
              }}
            />
          </g>
        )}

        {/* Selection ring follows the exact silhouette as well. */}
        {isSelected && (
          <g transform={outline.transform} pointerEvents='none'>
            <path
              d={outline.d}
              className='fill-none'
              stroke={foreground}
              strokeWidth={2}
              strokeDasharray='4 4'
              strokeLinejoin='round'
              vectorEffect='non-scaling-stroke'
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                transform: 'scale(1.065)',
                filter: performanceMode ? undefined : `drop-shadow(0 0 4px ${neonSoft}) drop-shadow(0 0 10px ${neonFaint})`,
              }}
            />
          </g>
        )}

        {/* A group frame paints a translucent wash rather than a solid
          card body, but it now drags the same way a block does: the wash
          itself takes pointer events, so grabbing anywhere inside the
          frame (not just the border or title bar) moves it. That trades
          away click-through to edges/nodes directly under the wash — a
          deliberate choice to match block behaviour — so an edge that
          passes through a frame with nothing else on top of it is only
          reachable outside the frame's bounds. The title bar itself only
          paints when there's a title to show — an empty strip is just
          visual noise on an untitled frame. */}
        {isGroup ? (
          <>
            <defs>
              <clipPath id={clipId}>
                <path d={outline.d} transform={outline.transform} />
              </clipPath>
            </defs>
            <path d={outline.d} transform={outline.transform} fill={background} fillOpacity={0.4} fillRule='evenodd' stroke='none' pointerEvents='all' />
            {fill === 'sheen' && <path d={outline.d} transform={outline.transform} fill={`url(#${gradientId})`} fillRule='evenodd' stroke='none' pointerEvents='none' />}
            {hasGroupTitle && (
              <g clipPath={`url(#${clipId})`}>
                <rect x={-width / 2} y={-height / 2} width={width} height={GROUP_HEADER_HEIGHT} fill={borderColor} fillOpacity={0.18} pointerEvents='all' />
                <line x1={-width / 2} y1={-height / 2 + GROUP_HEADER_HEIGHT} x2={width / 2} y2={-height / 2 + GROUP_HEADER_HEIGHT} stroke={borderColor} strokeOpacity={0.35} strokeWidth={1} pointerEvents='none' />
              </g>
            )}
            <path
              d={outline.d}
              transform={outline.transform}
              fill='none'
              stroke={borderColor}
              strokeWidth={borderWidth}
              strokeDasharray={dashArray}
              strokeLinejoin='round'
              pointerEvents='stroke'
            />
            {hasGroupTitle && (
              <foreignObject x={-width / 2} y={-height / 2} width={width} height={GROUP_HEADER_HEIGHT} pointerEvents='none'>
                <div
                  className='flex h-full w-full select-none items-center truncate px-3'
                  style={{
                    color: foreground,
                    fontFamily: NODE_FONT_FAMILIES[fontFamily],
                    fontSize: Math.min(fontSize, 14),
                    fontWeight: NODE_FONT_WEIGHTS[fontWeight],
                    // Bands label from the left, columns tend to centre, so
                    // the frame's own alignment decides. Read off the raw
                    // field, not the resolved one: unset resolves to
                    // 'center' everywhere else, and every frame saved
                    // before this header was left-aligned.
                    justifyContent: node.textAlign === 'center' ? 'center' : node.textAlign === 'right' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {node.title}
                </div>
              </foreignObject>
            )}
          </>
        ) : isText ? (
          /* Free text: just words on the canvas. There is no silhouette,
             fill or border to click, so an invisible rectangle over the
             box provides the hit area for selecting and dragging, and a
             hairline appears on hover so an empty or short label is
             still findable. */
          <>
            <rect x={-width / 2} y={-height / 2} width={width} height={height} fill='transparent' pointerEvents='all' />
            {!isSelected && (
              <rect
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={height}
                fill='none'
                stroke={foreground}
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray='3 3'
                vectorEffect='non-scaling-stroke'
                pointerEvents='none'
                className='opacity-0 transition-opacity duration-150 group-hover/node:opacity-100'
              />
            )}
            <foreignObject x={-width / 2} y={-height / 2} width={width} height={height} pointerEvents='none'>
              <div
                className='flex h-full w-full select-none items-center'
                style={{
                  color: foreground,
                  fontFamily: NODE_FONT_FAMILIES[fontFamily],
                  padding: TEXT_PADDING,
                  justifyContent: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center',
                }}
              >
                <div
                  className='max-h-full w-full overflow-hidden break-words'
                  style={{
                    fontSize,
                    fontWeight: NODE_FONT_WEIGHTS[fontWeight],
                    textAlign,
                    lineHeight: 1.35,
                    // Newlines the user typed in the inspector are part of
                    // the content, so they have to survive rendering.
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {node.title}
                </div>
              </div>
            </foreignObject>
          </>
        ) : isIconObject ? (
          /* Free icon/logo: just the glyph on the canvas, the graphic
             counterpart to free text above — no card body, border or
             ports. Same invisible hit rect + hover outline pattern as
             text, since there's nothing painted to click otherwise. The
             glyph itself renders at `iconSize`, independent of the box,
             exactly like the dedicated logo block. */
          <>
            <rect x={-width / 2} y={-height / 2} width={width} height={height} fill='transparent' pointerEvents='all' />
            {!isSelected && (
              <rect
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={height}
                fill='none'
                stroke={foreground}
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray='3 3'
                vectorEffect='non-scaling-stroke'
                pointerEvents='none'
                className='opacity-0 transition-opacity duration-150 group-hover/node:opacity-100'
              />
            )}
            <foreignObject x={-width / 2} y={-height / 2} width={width} height={height} pointerEvents='none'>
              <div className='flex h-full w-full select-none items-center justify-center' style={{ color: foreground }}>
                {hasIcon ? (
                  logoSlug ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/logos/${logoSlug}.svg`} alt='' className='object-contain' style={{ width: iconSize, height: iconSize }} />
                  ) : (
                    createElement(Icon!, { size: iconSize })
                  )
                ) : (
                  <span className='text-[11px] opacity-50'>Choose an icon</span>
                )}
              </div>
            </foreignObject>
          </>
        ) : (
          <>
        {/* Body — single <path> with per-shape `d`. The fill and stroke
          are set inline because the colour tokens are dynamic per node
          and Tailwind can't synthesize them at runtime. `filter` is a
          plain depth shadow; the optional sheen overlay below is the only
          other thing painted on the body. */}
        <path
          d={outline.d}
          transform={outline.transform}
          style={{
            fill: background,
            stroke: borderColor,
            filter,
          }}
          fillRule='evenodd'
          strokeWidth={borderWidth}
          strokeDasharray={dashArray}
          strokeLinecap={borderStyle === 'dotted' ? 'round' : undefined}
          pointerEvents='all'
        />

        {/* The sheen is a soft top-to-bottom gradient over the fill.
            `fill: 'flat'` skips it entirely, leaving the plain
            backgroundColor — which is what new nodes are created with. */}
        {fill === 'sheen' && <path d={outline.d} transform={outline.transform} fill={`url(#${gradientId})`} fillRule='evenodd' pointerEvents='none' />}

        {executionState === 'active' && (
          <g pointerEvents='none'>
            <g transform={outline.transform}>
              <path d={outline.d} fill={`url(#${chargeGradientId})`} fillRule='evenodd' className='node-electric-core' />
              <path d={outline.d} fill='none' stroke={foreground} strokeWidth={1.4} strokeLinejoin='round' className='node-electric-burst' />
            </g>
          </g>
        )}

        {cardAccent && (
          <path
            d={`M ${-width / 2 + 1} ${-height / 2 + 14} V ${height / 2 - 14}`}
            stroke={foreground}
            strokeWidth={3}
            strokeLinecap='round'
            opacity={0.8}
            pointerEvents='none'
          />
        )}

        <g transform={`scale(${scaleX} ${scaleY})`} pointerEvents='none'>
          <ShapeDecoration shape={style.shape} color={borderColor} />
        </g>

        {/* Icon + text inside a clipped foreignObject. The wrapper
          inherits the SVG's `color` from the parent <g> we don't
          explicitly set; instead we apply colour via inline style
          using the resolved Tailwind token. */}
        {/* A table's header and rows are painted surfaces, so the
            rectangular foreignObject would poke square corners out past a
            rounded (or any other) silhouette. Clipping to the outline
            fixes that for every shape at once. Only tables need it:
            ordinary cards paint no background inside the foreignObject,
            and clipping them would crop text out of narrow silhouettes
            like a diamond, where overflow is intended. */}
        {node.table && (
          <defs>
            <clipPath id={clipId}>
              <path d={outline.d} transform={outline.transform} />
            </clipPath>
          </defs>
        )}
        <foreignObject x={-width / 2} y={-height / 2} width={width} height={height} pointerEvents='none' clipPath={node.table ? `url(#${clipId})` : undefined}>
          {node.table ? (
            <div className='h-full w-full' style={{ fontFamily: NODE_FONT_FAMILIES[fontFamily] }}>
              <TableCardBody title={node.title} table={node.table} foreground={foreground} fontSize={fontSize} />
            </div>
          ) : (
          <div
            className='flex h-full w-full select-none'
            style={{
              color: foreground,
              fontFamily: NODE_FONT_FAMILIES[fontFamily],
              flexDirection: iconPosition === 'top' ? 'column' : 'row',
              // Block alignment moves the whole icon + text cluster: it's
              // the main axis when the icon sits beside the text, the
              // cross axis when it sits on top.
              justifyContent: iconPosition === 'top' ? 'center' : clusterAlign,
              alignItems: iconPosition === 'top' ? clusterAlign : 'center',
              gap: hasIcon ? (iconPosition === 'top' ? 7 : 12) : 0,
              padding: `${cardPadding}px ${cardPadding + 8}px`,
            }}
          >
            {hasIcon && (
              <span
                className='grid shrink-0 place-items-center rounded-xl'
                style={{
                  // `order` rather than `row-reverse` so `justifyContent`
                  // keeps pointing at the visual left/centre either way.
                  order: iconPosition === 'right' ? 1 : 0,
                  width: iconSize + 25,
                  height: iconSize + 25,
                  background: `${foreground}12`,
                  border: `1px solid ${foreground}38`,
                  boxShadow: performanceMode ? `inset 0 0 12px ${foreground}12` : `inset 0 0 18px ${foreground}16, 0 0 12px ${foreground}20`,
                }}
              >
                {/* No `filter`/`opacity` on anything inside the
                  foreignObject: Safari paints such elements at document
                  coords instead of in the SVG, so they vanish from the
                  card. Alpha goes in the colour instead. */}
                {logoSlug ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/logos/${logoSlug}.svg`}
                    alt=''
                    className='object-contain'
                    style={{ width: iconSize, height: iconSize }}
                  />
                ) : (
                  createElement(Icon!, { size: iconSize })
                )}
              </span>
            )}
            <div
              className='min-w-0'
              style={{
                textAlign,
                // `fit-content` (not 100%) so the block shrink-wraps its
                // text and `blockAlign` has room to shift the cluster,
                // while long text still wraps at the available width.
                width: 'fit-content',
                maxWidth: '100%',
              }}
            >
              <div className='leading-tight tracking-tight' style={{ fontSize, fontWeight: NODE_FONT_WEIGHTS[fontWeight] }}>
                {node.title}
              </div>
              {node.description && (
                <div className='mt-1 leading-tight' style={{ fontSize: Math.max(9, fontSize - 4), color: `${foreground}b3` }}>
                  {node.description}
                </div>
              )}
            </div>
          </div>
          )}
        </foreignObject>
          </>
        )}

        {/* Four corner resize handles. Their radius is corrected
          for canvas zoom so the hit target stays usable on large charts.
          A multi-selection shows rings only — see `showResizeHandles`. */}
        {isSelected &&
          showResizeHandles &&
          RESIZE_HANDLES.map((handle) => (
            <circle
              key={handle.direction}
              cx={(handle.x * width) / 2}
              cy={(handle.y * height) / 2}
              r={6 / Math.max(viewTransform.scale, 0.35)}
              fill='#e0f2fe'
              stroke='#0284c7'
              strokeWidth={1.5}
              vectorEffect='non-scaling-stroke'
              pointerEvents='all'
              style={{ cursor: handle.cursor }}
              aria-label={`Resize ${handle.direction}`}
              onPointerDown={(e) => handleResizePointerDown(handle.direction, e)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
            />
          ))}

        {/* Every node exposes a bidirectional port on all four sides.
          The selected source and target sides are stored on the edge.
          Ports are editor-only — hidden entirely in read-only mode.
          Text objects and free icon/logo objects have none: a caption or
          a placed graphic is scenery rather than a step in the flow (the
          replay skips both too). Frames get the same four ports as any
          other block, so a diagram can point an edge at the group as a
          whole. */}
        {!readOnly &&
          !isText &&
          !isIconObject &&
          CONNECTION_SIDES.map((side) => {
            const anchor = portAnchors[side];
            const canReceive = !!linkTargetFromId && linkTargetFromId !== node.id;
            return (
              <g
                key={side}
                pointerEvents='all'
                data-port
                data-node-id={node.id}
                data-side={side}
                className={[canReceive ? 'cursor-copy opacity-100' : 'cursor-crosshair opacity-0 group-hover/node:opacity-100', 'transition-opacity duration-150'].join(' ')}
                style={{ touchAction: 'none' }}
                transform={`translate(${anchor.x} ${anchor.y})`}
              >
                <circle
                  r={Math.max(PORT_HIT_R, portSize + 8)}
                  className='fill-transparent'
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onPortPointerDown(node.id, side, e);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    onPortPointerUp(node.id, side, e);
                  }}
                />
                <circle
                  r={portSize}
                  className={canReceive ? 'animate-pulse' : undefined}
                  fill={background}
                  stroke={canReceive ? '#7dd3fc' : foreground}
                  strokeWidth={canReceive ? 3 : 2}
                  style={{
                    filter: performanceMode && !canReceive ? undefined : `drop-shadow(0 0 4px ${canReceive ? '#7dd3fc' : neonSoft})${performanceMode ? '' : ` drop-shadow(0 0 10px ${canReceive ? '#7dd3fc70' : neonFaint})`}`,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onPortPointerDown(node.id, side, e);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    onPortPointerUp(node.id, side, e);
                  }}
                />
                <circle
                  r={2.25}
                  fill={foreground}
                  pointerEvents='none'
                  style={{
                    filter: performanceMode ? undefined : `drop-shadow(0 0 4px ${neonSoft})`,
                  }}
                />
                {canReceive && <circle r={portSize + 7} className='fill-none stroke-sky-300' strokeWidth={2} pointerEvents='none' />}
              </g>
            );
          })}

        {/* Painted last so a halo, ring or sheen sits above the body and
            its contents. Text and free icon objects have no silhouette to
            decorate — every decoration effect traces `outline.d`, which
            for these is just its bounding rectangle, so rendering one
            here would draw exactly the border they're defined not to
            have. Motion (the `<g style={motionStyle}>` wrapper above)
            still applies. */}
        {!isText && !isIconObject && (
          <NodeEffectLayer
            d={outline.d}
            transform={outline.transform}
            effect={effect}
            color={effectColor}
            speed={effectSpeed}
            intensity={effectIntensity}
            width={width}
            height={height}
            clipId={`node-fx-${safeId}`}
            performanceMode={performanceMode}
            paused={effectsPaused}
          />
        )}
        </g>
      </g>
    </g>
  );
}
