import type { ExecutionState, FlowDocumentJSON } from '@/lib/flowchart-types';
import { isometricScene, type IsoLine, type IsoPoint } from '@/lib/isometric';

const pts = (points: IsoPoint[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

/** The arrowhead at a line's last point, pointing along its last segment (on screen, so it stays a clean triangle). */
function arrowHead(line: IsoLine): string | null {
  const end = line.points.at(-1);
  const before = [...line.points].reverse().find((p) => end && (p.x !== end.x || p.y !== end.y));
  if (!end || !before) return null;
  const angle = Math.atan2(end.y - before.y, end.x - before.x);
  const size = 7 + line.width * 1.5;
  const back = (spread: number) => ({ x: end.x - size * Math.cos(angle + spread), y: end.y - size * Math.sin(angle + spread) });
  return pts([end, back(0.45), back(-0.45)]);
}

/**
 * The Diagram in isometric: boxes with depth on a tilted floor, lines on the
 * floor, labels upright. Plain SVG — no foreignObject, no transforms — so the
 * same markup serves the screen and the exported image. Read-only; the run
 * shows through `nodeStates` / `edgeStates` like on the flat canvas.
 */
export function IsometricDiagram({
  document,
  nodeStates,
  edgeStates,
  background,
  size,
}: {
  document: FlowDocumentJSON;
  nodeStates?: Record<string, ExecutionState>;
  edgeStates?: Record<string, ExecutionState>;
  /** A solid backdrop (export); none on screen, where the page shows through. */
  background?: string | null;
  /** Fixed pixel size (export); otherwise it fills its box. */
  size?: { width: number; height: number };
}) {
  const scene = isometricScene(document, { nodeStates, edgeStates });
  const { bounds } = scene;
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      width={size ? size.width : '100%'}
      height={size ? size.height : '100%'}
      preserveAspectRatio='xMidYMid meet'
      role='img'
      aria-label='Isometric view of the diagram'
      data-isometric='true'
    >
      {background && <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill={background} />}

      {/* Group frames: flat tiles on the floor, under everything. */}
      {scene.tiles.map((tile) => (
        <g key={tile.id} opacity={tile.opacity}>
          <polygon points={pts(tile.points)} fill={tile.fill} fillOpacity={0.35} stroke={tile.stroke} strokeWidth={1.5} strokeDasharray='8 5' />
          {tile.title && (
            <text x={tile.label.x} y={tile.label.y + 4} fill={tile.color} fontSize={12} fontWeight={600} fontFamily='ui-sans-serif, system-ui, sans-serif'>
              {tile.title}
            </text>
          )}
        </g>
      ))}

      {/* Lines lie on the floor, so the boxes stand on top of their ends. */}
      {scene.lines.map((line) => {
        const head = line.arrow ? arrowHead(line) : null;
        return (
          <g key={line.id} opacity={line.opacity}>
            <polyline data-line={line.id} points={pts(line.points)} fill='none' stroke={line.color} strokeWidth={line.width} strokeDasharray={line.dashed ? '8 6' : undefined} strokeLinejoin='round' strokeLinecap='round' />
            {head && <polygon data-arrow={line.id} points={head} fill={line.color} />}
          </g>
        );
      })}

      {scene.boxes.map((box) => (
        <g key={box.id} data-box={box.id} data-active={box.active ? 'true' : undefined} opacity={box.opacity}>
          {/* The two faces toward the viewer, the block's colour shaded down; then the lit top. */}
          <polygon data-face='front' points={pts(box.front)} fill={box.fill} stroke={box.stroke} strokeWidth={1} strokeLinejoin='round' />
          <polygon points={pts(box.front)} fill='#000' fillOpacity={0.42} pointerEvents='none' />
          <polygon data-face='right' points={pts(box.right)} fill={box.fill} stroke={box.stroke} strokeWidth={1} strokeLinejoin='round' />
          <polygon points={pts(box.right)} fill='#000' fillOpacity={0.24} pointerEvents='none' />
          <polygon
            data-face='top'
            points={pts(box.top)}
            fill={box.fill}
            stroke={box.stroke}
            strokeWidth={box.strokeWidth}
            strokeLinejoin='round'
            style={box.active ? { filter: `drop-shadow(0 0 8px ${box.stroke})` } : undefined}
          />
          <text x={box.label.x} y={box.label.y + (box.subtitle ? -2 : box.fontSize * 0.35)} textAnchor='middle' fill={box.color} fontSize={box.fontSize} fontWeight={box.fontWeight} fontFamily={box.fontFamily}>
            {box.title}
          </text>
          {box.subtitle && (
            <text x={box.label.x} y={box.label.y + box.fontSize * 0.9} textAnchor='middle' fill={box.color} fillOpacity={0.7} fontSize={Math.max(9, box.fontSize - 4)} fontFamily={box.fontFamily}>
              {box.subtitle}
            </text>
          )}
        </g>
      ))}

      {/* Line labels after the boxes, so a box never hides one. */}
      {scene.lines
        .filter((line) => line.label)
        .map((line) => (
          <text key={`${line.id}-label`} x={line.labelAt.x} y={line.labelAt.y - 6} textAnchor='middle' fill={line.color} opacity={line.opacity} fontSize={11} fontWeight={700} fontFamily='ui-monospace, monospace'>
            {line.label}
          </text>
        ))}

      {scene.labels.map((label) => (
        <text key={label.id} x={label.at.x} y={label.at.y} textAnchor='middle' fill={label.color} opacity={label.opacity} fontSize={label.fontSize} fontWeight={label.fontWeight} fontFamily={label.fontFamily}>
          {label.text}
        </text>
      ))}
    </svg>
  );
}
