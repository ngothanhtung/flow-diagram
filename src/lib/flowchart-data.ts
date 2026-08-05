import type {
  FlowDocumentJSON,
  FlowEdge,
  FlowNode,
  NodeIcon,
  NodeShape,
  NodeType,
} from './flowchart-types';

const LAYER = {
  client: { color: '#dbeafe', background: '#082f49' },
  service: { color: '#d1fae5', background: '#022c22' },
  data: { color: '#fef3c7', background: '#451a03' },
} as const;

function architectureNode(
  id: string,
  title: string,
  description: string,
  x: number,
  y: number,
  icon: NodeIcon,
  layer: keyof typeof LAYER,
  options: {
    type?: NodeType;
    shape?: NodeShape;
    width?: number;
  } = {},
): FlowNode {
  const palette = LAYER[layer];
  return {
    id,
    type: options.type ?? 'process',
    title,
    description,
    position: { x, y },
    width: options.width ?? 166,
    height: 82,
    shape: 'rounded',
    color: palette.color,
    backgroundColor: palette.background,
    borderColor: palette.color,
    borderWidth: 1.5,
    shadow: 'soft',
    icon,
    iconSize: 21,
    iconPosition: 'left',
    fontSize: 12,
    textAlign: 'left',
    connectionPoints: { input: 'left', output: 'right' },
  };
}

function architectureEdge(
  id: string,
  from: string,
  to: string,
  options: Omit<Partial<FlowEdge>, 'id' | 'from' | 'to'> = {},
): FlowEdge {
  return {
    id,
    from,
    to,
    effect: 'flow',
    animationSpeed: 0.9,
    width: 1,
    effectSize: 1.5,
    ...options,
  };
}

// A minimal three-tier example: Client → Server → Database.
export const initialDocument: FlowDocumentJSON = {
  nodes: [
    architectureNode('client', 'Client', 'Web & mobile', 100, 210, 'lucide:user', 'client', { type: 'start' }),
    architectureNode('server', 'Server', 'Application logic', 400, 210, 'code', 'service'),
    architectureNode('database', 'Database', 'Persistent storage', 700, 210, 'database', 'data'),
  ],
  edges: [
    architectureEdge('e01', 'client', 'server', { label: 'request', effect: 'pulse' }),
    architectureEdge('e02', 'server', 'database', { label: 'query', effect: 'flow' }),
  ],
};
