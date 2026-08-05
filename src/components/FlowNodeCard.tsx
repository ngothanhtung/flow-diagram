'use client';

import { motion } from 'framer-motion';
import { createElement, useEffect, useRef } from 'react';
import { screenToData } from '@/lib/coords';
import { NODE_FADE_DURATION_MS } from '@/lib/execution-timing';
import { NODE_FONT_FAMILIES } from '@/lib/node-fonts';
import { useResolvedIcon } from '@/lib/icon-library';
import type { ConnectionSide, ExecutionState, FlowNode, NodeShape } from '@/lib/flowchart-types';
import { nodeOutline, resolveNodeStyle } from '@/lib/node-style';
import type { ViewTransform } from '@/lib/view-transform';
import { NODE_BOUNDING_RADIUS } from './edge-geometry';

interface FlowNodeCardProps {
  node: FlowNode;
  /** Reduce costly SVG filters/entry motion on large diagrams. */
  performanceMode?: boolean;
  executionState?: ExecutionState;
  isActive?: boolean;
  isSelected?: boolean;
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
  onSelect: (id: string) => void;
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
  onDragEnd: () => void;
  onPortPointerDown: (nodeId: string, side: ConnectionSide, e: React.PointerEvent<SVGElement>) => void;
  onPortPointerUp: (nodeId: string, side: ConnectionSide, e: React.PointerEvent<SVGElement>) => void;
  registerSvgRef: (el: SVGGElement | null) => void;
}

const PORT_HIT_R = 18;
const BASE_SIZE = NODE_BOUNDING_RADIUS * 2;
const MIN_WIDTH = 72;
const MAX_WIDTH = 320;
const MIN_HEIGHT = 72;
const MAX_HEIGHT = 240;

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

const FONT_WEIGHT: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

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
  executionState = 'normal',
  isActive = false,
  isSelected = false,
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
  const Icon = useResolvedIcon(style.icon);
  const { shapeSpec, foreground, background, borderColor, width, height, rotation, borderWidth, borderStyle, opacity, shadow, iconSize, iconPosition, fontSize, fontFamily, fontWeight, textAlign, portSize } = style;
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
  const neonIntensity = shadow === 'glow' ? 0.42 : shadow === 'soft' ? 0.24 : 0.12;
  const filter = performanceMode
    ? shadow === 'none'
      ? undefined
      : 'drop-shadow(0 5px 8px rgba(0,0,0,.32))'
    : shadow === 'soft'
      ? `drop-shadow(0 8px 12px rgba(0,0,0,.38)) drop-shadow(0 0 5px ${neonFaint})`
      : shadow === 'glow'
        ? `drop-shadow(0 8px 14px rgba(0,0,0,.4)) drop-shadow(0 0 5px ${neonSoft}) drop-shadow(0 0 15px ${neonFaint})`
        : undefined;
  const gradientId = `node-sheen-${node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const chargeGradientId = `node-charge-${node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
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
    if (resize.direction.includes('w')) left = Math.min(right - MIN_WIDTH, left + dx);
    if (resize.direction.includes('e')) right = Math.max(left + MIN_WIDTH, right + dx);
    if (resize.direction.includes('n')) top = Math.min(bottom - MIN_HEIGHT, top + dy);
    if (resize.direction.includes('s')) bottom = Math.max(top + MIN_HEIGHT, bottom + dy);

    const nextWidth = Math.min(MAX_WIDTH, right - left);
    const nextHeight = Math.min(MAX_HEIGHT, bottom - top);
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
    handlersRef.current.onDragEnd();
  };

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
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
      onSelect(node.id);
    }
    handlersRef.current.onDragEnd();
    dragRef.current = null;
  };

  return (
    // Outer <g> handles the entry animation via framer-motion. The
    // static inner <g> applies the position translate so framer-motion
    // (which owns the transform when initial/animate is set) doesn't
    // override the position.
    <motion.g initial={performanceMode ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }} className='group/node cursor-grab active:cursor-grabbing'>
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

        {/* Body — single <path> with per-shape `d`. The fill and stroke
          are set inline because the colour tokens are dynamic per
          node and Tailwind can't synthesize them at runtime. The
          gradient is approximated by an opacity step: a darker fill
          plus a translucent overlay would be ideal but the current
          palette maps cleanly to a single mid-tone per colour. */}
        <path
          d={outline.d}
          transform={outline.transform}
          fill='none'
          stroke={borderColor}
          strokeWidth={borderWidth + 5}
          strokeLinejoin='round'
          opacity={performanceMode ? neonIntensity * 0.45 : neonIntensity}
          pointerEvents='none'
          style={{
            filter: performanceMode ? undefined : `drop-shadow(0 0 5px ${neonSoft}) drop-shadow(0 0 14px ${neonFaint})`,
          }}
        />

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

        <path d={outline.d} transform={outline.transform} fill={`url(#${gradientId})`} fillRule='evenodd' pointerEvents='none' />

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
            style={{
              filter: performanceMode ? undefined : `drop-shadow(0 0 5px ${neonSoft})`,
            }}
          />
        )}

        <g transform={`scale(${scaleX} ${scaleY})`} pointerEvents='none'>
          <ShapeDecoration shape={style.shape} color={borderColor} />
        </g>

        {/* Icon + text inside a clipped foreignObject. The wrapper
          inherits the SVG's `color` from the parent <g> we don't
          explicitly set; instead we apply colour via inline style
          using the resolved Tailwind token. */}
        <foreignObject x={-width / 2} y={-height / 2} width={width} height={height} pointerEvents='none'>
          <div
            className='flex h-full w-full items-center justify-center select-none'
            style={{
              color: foreground,
              fontFamily: NODE_FONT_FAMILIES[fontFamily],
              flexDirection: iconPosition === 'left' ? 'row' : 'column',
              gap: Icon ? (iconPosition === 'left' ? 12 : 7) : 0,
              padding: Math.max(10, Math.min(width, height) * 0.13),
            }}
          >
            {Icon && (
              <span
                className='grid shrink-0 place-items-center rounded-xl'
                style={{
                  width: iconSize + 25,
                  height: iconSize + 25,
                  background: `${foreground}12`,
                  border: `1px solid ${foreground}38`,
                  boxShadow: performanceMode ? `inset 0 0 12px ${foreground}12` : `inset 0 0 18px ${foreground}16, 0 0 12px ${foreground}20`,
                }}
              >
                <span
                  className='inline-flex'
                  style={{
                    filter: performanceMode ? undefined : `drop-shadow(0 0 5px ${foreground}80)`,
                  }}
                >
                  {createElement(Icon, { size: iconSize, className: 'opacity-95' })}
                </span>
              </span>
            )}
            <div
              className='min-w-0'
              style={{
                textAlign,
                width: iconPosition === 'top' ? '100%' : undefined,
              }}
            >
              <div className='leading-tight tracking-tight' style={{ fontSize, fontWeight: FONT_WEIGHT[fontWeight] }}>
                {node.title}
              </div>
              {node.description && (
                <div className='mt-1 leading-tight opacity-70' style={{ fontSize: Math.max(9, fontSize - 4) }}>
                  {node.description}
                </div>
              )}
            </div>
          </div>
        </foreignObject>

        {/* Four corner resize handles. Their radius is corrected
          for canvas zoom so the hit target stays usable on large charts. */}
        {isSelected &&
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
          The selected source and target sides are stored on the edge. */}
        {CONNECTION_SIDES.map((side) => {
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
      </g>
    </motion.g>
  );
}
