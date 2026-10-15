'use client';

import { resolveDocumentStyles } from '@/lib/edge-style';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import type { Box } from '@/lib/image-export';
import { resolveNodeStyle } from '@/lib/node-style';
import { sortByTreeDepth } from '@/lib/node-tree';
import type { ViewTransform } from '@/lib/view-transform';
import { AnimatedEdge } from '../AnimatedEdge';
import { FlowNodeCard } from '../FlowNodeCard';

const IDENTITY: ViewTransform = { x: 0, y: 0, scale: 1 };
const noop = () => undefined;

/**
 * The Diagram exactly as the canvas paints it in run mode `static`, and
 * nothing else: no grid, no docks, no culling, no selection, no ports or
 * handles, no Replay state and no Effects. It is mounted off-screen by
 * `renderDiagramSvg` purely to be measured and serialised — never shown.
 *
 * It renders the canvas's own `AnimatedEdge` / `FlowNodeCard`, so the
 * picture can't drift from the canvas, and mirrors `FlowCanvas`'s loop:
 * Line styles resolved once up front, Lines under Elements, Frames
 * painted shallowest first. It does not mount `FlowCanvas` itself because
 * everything that component adds — viewport, culling, gestures, chrome —
 * is precisely what an export must not have.
 */
export function ExportScene({ document: rawDocument, box, background }: { document: FlowDocumentJSON; box: Box; background: string | null }) {
  const document = resolveDocumentStyles(rawDocument);
  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width={box.width} height={box.height} viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}>
      {background && <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={background} />}
      {document.edges.map((edge) => {
        const from = nodesById.get(edge.from);
        const to = nodesById.get(edge.to);
        if (!from || !to) return null;
        return <AnimatedEdge key={edge.id} edge={edge} from={from} to={to} paused color={edge.color ?? resolveNodeStyle(from).foreground} effectColor={edge.effectColor} executionState='normal' flattenEffect />;
      })}
      {sortByTreeDepth(document.nodes).map((node) => (
        <FlowNodeCard
          key={node.id}
          // An Element's own Effect is dropped, not paused: a paused Effect
          // still paints its decoration, and the picture has none.
          node={{ ...node, effect: 'none' }}
          effectsPaused
          executionState='normal'
          readOnly
          viewTransform={IDENTITY}
          onSelect={noop}
          onMove={noop}
          onResize={noop}
          onLineEndpointMove={noop}
          onDragStart={noop}
          onDragEnd={noop}
          onPortPointerDown={noop}
          onPortPointerUp={noop}
          registerSvgRef={noop}
        />
      ))}
    </svg>
  );
}
