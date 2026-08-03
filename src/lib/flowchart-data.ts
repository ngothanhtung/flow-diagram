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
  edge: { color: '#e0e7ff', background: '#1e1b4b' },
  web: { color: '#ede9fe', background: '#2e1065' },
  service: { color: '#d1fae5', background: '#022c22' },
  data: { color: '#fef3c7', background: '#451a03' },
  external: { color: '#ffe4e6', background: '#4c0519' },
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
    shape: options.shape ?? 'rounded',
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
    width: 2,
    ...options,
  };
}

// A production-style SaaS architecture arranged left-to-right by layer:
// clients → edge/network → web/API → domain services → data/external systems.
export const initialDocument: FlowDocumentJSON = {
  nodes: [
    architectureNode('web-client', 'Web Client', 'React / Next.js', 100, 130, 'code', 'client', { type: 'start' }),
    architectureNode('mobile-app', 'Mobile App', 'iOS & Android', 100, 300, 'lucide:user', 'client'),
    architectureNode('admin-portal', 'Admin Portal', 'Operations console', 100, 470, 'tabler:settings', 'client'),

    architectureNode('dns', 'DNS', 'Managed DNS routing', 360, 130, 'tabler:world', 'edge', { shape: 'pill' }),
    architectureNode('cdn', 'CDN', 'Static assets & edge cache', 360, 300, 'cloud', 'edge', { shape: 'cloud' }),
    architectureNode('waf', 'Web Application Firewall', 'DDoS & threat protection', 360, 470, 'lucide:webhook', 'edge', { width: 190 }),

    architectureNode('load-balancer', 'Load Balancer', 'TLS termination', 635, 210, 'tabler:route', 'web', { shape: 'hexagon' }),
    architectureNode('api-gateway', 'API Gateway', 'Routing & rate limits', 635, 430, 'lucide:webhook', 'web', { shape: 'hexagon' }),

    architectureNode('web-server-a', 'Web Server A', 'SSR & web endpoints', 910, 120, 'code', 'web', { shape: 'server' }),
    architectureNode('web-server-b', 'Web Server B', 'SSR & web endpoints', 910, 280, 'code', 'web', { shape: 'server' }),
    architectureNode('auth-service', 'Auth Service', 'OIDC, JWT & sessions', 910, 500, 'tabler:robot', 'service', { shape: 'component' }),

    architectureNode('user-service', 'User Service', 'Profiles & accounts', 1190, 90, 'lucide:user', 'service', { shape: 'component' }),
    architectureNode('catalog-service', 'Catalog Service', 'Products & inventory', 1190, 235, 'database', 'service', { shape: 'component' }),
    architectureNode('order-service', 'Order Service', 'Order orchestration', 1190, 380, 'lucide:workflow', 'service', { shape: 'component' }),
    architectureNode('payment-service', 'Payment Service', 'Billing workflow', 1190, 525, 'send', 'service', { shape: 'component' }),
    architectureNode('notification-service', 'Notification Service', 'Email, SMS & push', 1190, 670, 'bell', 'service', { width: 184, shape: 'component' }),

    architectureNode('redis-cache', 'Redis Cache', 'Sessions & hot data', 1490, 80, 'database', 'data', { shape: 'database' }),
    architectureNode('message-queue', 'Message Queue', 'Async event bus', 1490, 225, 'tabler:route', 'data', { shape: 'queue' }),
    architectureNode('search-engine', 'Search Engine', 'Full-text search', 1490, 370, 'sparkles', 'data'),
    architectureNode('primary-db', 'Primary Database', 'PostgreSQL writer', 1490, 515, 'database', 'data', { shape: 'database' }),
    architectureNode('read-replica', 'Read Replica', 'PostgreSQL reader', 1490, 660, 'database', 'data', { shape: 'database' }),

    architectureNode('object-storage', 'Object Storage', 'Media & documents', 1790, 70, 'cloud', 'external', { shape: 'cloud' }),
    architectureNode('cloud-functions', 'Cloud Functions', 'Background compute', 1790, 205, 'lucide:zap', 'external', { shape: 'cloud' }),
    architectureNode('payment-provider', 'Payment Provider', 'Stripe / Adyen', 1790, 340, 'send', 'external'),
    architectureNode('email-provider', 'Email Provider', 'SES / SendGrid', 1790, 475, 'mail', 'external'),
    architectureNode('monitoring', 'Monitoring', 'Metrics & alerts', 1790, 610, 'bell', 'external', { shape: 'server' }),
    architectureNode('central-logs', 'Centralized Logs', 'Searchable app logs', 1790, 745, 'code', 'external', { shape: 'server' }),
    architectureNode('data-warehouse', 'Data Warehouse', 'Analytics & BI', 1790, 880, 'database', 'external', { shape: 'database' }),
  ],
  edges: [
    architectureEdge('e01', 'web-client', 'dns', { label: 'HTTPS', effect: 'pulse' }),
    architectureEdge('e02', 'mobile-app', 'dns', { label: 'API', effect: 'dots' }),
    architectureEdge('e03', 'admin-portal', 'dns', { effect: 'scanner' }),
    architectureEdge('e04', 'dns', 'cdn', { label: 'resolve', effect: 'comet' }),
    architectureEdge('e05', 'cdn', 'waf', { label: 'miss', effect: 'traffic' }),
    architectureEdge('e06', 'waf', 'load-balancer', { effect: 'flow', animationSpeed: 1.2 }),
    architectureEdge('e07', 'load-balancer', 'web-server-a', { label: '50%', effect: 'dots' }),
    architectureEdge('e08', 'load-balancer', 'web-server-b', { label: '50%', effect: 'dots' }),
    architectureEdge('e09', 'web-server-a', 'api-gateway', { effect: 'flow' }),
    architectureEdge('e10', 'web-server-b', 'api-gateway', { effect: 'flow' }),
    architectureEdge('e11', 'api-gateway', 'auth-service', { label: 'verify', effect: 'scanner' }),
    architectureEdge('e12', 'api-gateway', 'user-service', { label: '/users', effect: 'wave' }),
    architectureEdge('e13', 'api-gateway', 'catalog-service', { label: '/catalog', effect: 'wave' }),
    architectureEdge('e14', 'api-gateway', 'order-service', { label: '/orders', effect: 'wave' }),
    architectureEdge('e15', 'api-gateway', 'payment-service', { label: '/pay', effect: 'wave' }),
    architectureEdge('e16', 'auth-service', 'redis-cache', { label: 'session', effect: 'bidirectional' }),
    architectureEdge('e17', 'auth-service', 'primary-db', { label: 'identity', effect: 'scanner' }),
    architectureEdge('e18', 'user-service', 'redis-cache', { effect: 'bidirectional' }),
    architectureEdge('e19', 'user-service', 'primary-db', { effect: 'flow' }),
    architectureEdge('e20', 'catalog-service', 'search-engine', { label: 'index', effect: 'traffic' }),
    architectureEdge('e21', 'catalog-service', 'read-replica', { label: 'read', effect: 'flow' }),
    architectureEdge('e22', 'catalog-service', 'object-storage', { label: 'media', effect: 'comet' }),
    architectureEdge('e23', 'order-service', 'primary-db', { label: 'write', effect: 'scanner' }),
    architectureEdge('e24', 'order-service', 'message-queue', { label: 'events', effect: 'comet' }),
    architectureEdge('e25', 'order-service', 'payment-service', { label: 'charge', effect: 'pulse' }),
    architectureEdge('e26', 'payment-service', 'payment-provider', { label: 'secure API', effect: 'glow' }),
    architectureEdge('e27', 'payment-service', 'message-queue', { label: 'result', effect: 'traffic' }),
    architectureEdge('e28', 'message-queue', 'notification-service', { label: 'consume', effect: 'dash' }),
    architectureEdge('e29', 'message-queue', 'cloud-functions', { label: 'trigger', effect: 'comet' }),
    architectureEdge('e30', 'notification-service', 'email-provider', { label: 'deliver', effect: 'dots' }),
    architectureEdge('e31', 'primary-db', 'read-replica', { label: 'replicate', effect: 'flow', animationSpeed: 1.4 }),
    architectureEdge('e32', 'read-replica', 'data-warehouse', { label: 'ETL', effect: 'traffic' }),
    architectureEdge('e33', 'web-server-b', 'central-logs', { label: 'logs', effect: 'dots', width: 1.5 }),
    architectureEdge('e34', 'order-service', 'monitoring', { label: 'metrics', effect: 'wave', width: 1.5 }),
    architectureEdge('e35', 'cloud-functions', 'object-storage', { label: 'process', effect: 'bidirectional' }),
  ],
};
