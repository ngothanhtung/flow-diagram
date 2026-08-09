import { initialDocument } from './flowchart-data';
import type {
  EdgeEffect,
  EdgeMarker,
  FlowDocumentJSON,
  FlowEdge,
  FlowNode,
  NodeIcon,
  NodeShape,
  NodeType,
  TableColumn,
} from './flowchart-types';
import { TABLE_DEFAULT_WIDTH, tableCardHeight } from './node-style';

export type DiagramTemplateId =
  | 'client-server-database'
  | 'hrm'
  | 'crm'
  | 'software-architecture'
  | 'ecommerce'
  | 'cicd'
  | 'database-schema'
  | 'blank';

export interface DiagramTemplate {
  id: DiagramTemplateId;
  name: string;
  category: string;
  description: string;
  document: FlowDocumentJSON;
}

type Theme = 'blue' | 'indigo' | 'green' | 'amber' | 'rose' | 'violet';

const THEMES: Record<Theme, { color: `#${string}`; background: `#${string}` }> = {
  blue: { color: '#dbeafe', background: '#082f49' },
  indigo: { color: '#e0e7ff', background: '#1e1b4b' },
  green: { color: '#d1fae5', background: '#022c22' },
  amber: { color: '#fef3c7', background: '#451a03' },
  rose: { color: '#ffe4e6', background: '#4c0519' },
  violet: { color: '#ede9fe', background: '#2e1065' },
};

function node(
  id: string,
  title: string,
  description: string,
  x: number,
  y: number,
  theme: Theme,
  options: {
    type?: NodeType;
    shape?: NodeShape;
    icon?: NodeIcon | null;
    width?: number;
  } = {},
): FlowNode {
  const paint = THEMES[theme];
  return {
    id,
    type: options.type ?? 'process',
    title,
    description,
    position: { x, y },
    width: options.width ?? 174,
    height: 84,
    // Every template block uses the same silhouette so a template reads as
    // one consistent system rather than a shape showcase; `options.shape`
    // is intentionally ignored.
    shape: 'rounded',
    color: paint.color,
    backgroundColor: paint.background,
    borderColor: paint.color,
    borderWidth: 1.5,
    shadow: 'soft',
    icon: options.icon === null ? null : (options.icon ?? 'cog'),
    iconSize: 20,
    iconPosition: 'left',
    fontSize: 12,
    textAlign: 'left',
    connectionPoints: { input: 'left', output: 'right' },
  };
}

function edge(
  id: string,
  from: string,
  to: string,
  label?: string,
  effect: EdgeEffect = 'flow',
) {
  return { id, from, to, label, effect, animationSpeed: 0.9, width: 1, effectSize: 1.5 } as const;
}

/**
 * Table factory for the ERD template. Columns are written compactly as
 * `name type` plus optional flag letters — `p` primary key, `f` foreign
 * key, `u` unique, `i` indexed, `n` nullable — so a whole schema stays
 * readable in source.
 */
function tableNode(id: string, title: string, x: number, y: number, theme: Theme, specs: string[]): FlowNode {
  const paint = THEMES[theme];
  const columns: TableColumn[] = specs.map((spec, index) => {
    const [name, dataType, flags = ''] = spec.split('|');
    return {
      id: `${id}-c${index + 1}`,
      name,
      dataType,
      primaryKey: flags.includes('p') || undefined,
      foreignKey: flags.includes('f') || undefined,
      unique: flags.includes('u') || undefined,
      index: flags.includes('i') || undefined,
      nullable: flags.includes('n') || undefined,
    };
  });
  return {
    id,
    type: 'process',
    title,
    position: { x, y },
    width: TABLE_DEFAULT_WIDTH,
    height: tableCardHeight(columns.length),
    shape: 'rounded',
    color: paint.color,
    backgroundColor: paint.background,
    borderColor: paint.color,
    borderWidth: 1.5,
    shadow: 'soft',
    icon: null,
    fontSize: 13,
    connectionPoints: { input: 'left', output: 'right' },
    table: { columns },
  };
}

/** One-to-many relationship drawn parent → child, with crow's foot ends. */
function relation(id: string, from: string, fromColumn: string, to: string, toColumn: string, endMarker: EdgeMarker = 'crow-many'): FlowEdge {
  return {
    id,
    from,
    to,
    fromColumn,
    toColumn,
    label: `${fromColumn} → ${toColumn}`,
    routing: 'orthogonal',
    startMarker: 'crow-one',
    endMarker,
    effect: 'flow',
    width: 1,
    effectSize: 1.2,
    animationSpeed: 0.9,
  };
}

// --- Database schema (ERD) ------------------------------------------------
const databaseSchemaDocument: FlowDocumentJSON = {
  nodes: [
    tableNode('db-users', 'users', 120, 160, 'blue', ['id|uuid|p', 'email|varchar(255)|ui', 'full_name|varchar(120)', 'password_hash|varchar(255)', 'created_at|timestamptz']),
    tableNode('db-products', 'products', 120, 470, 'violet', ['id|uuid|p', 'sku|varchar(64)|ui', 'name|varchar(200)', 'price_cents|integer', 'stock|integer', 'archived_at|timestamptz|n']),
    tableNode('db-orders', 'orders', 500, 200, 'green', ['id|bigserial|p', 'user_id|uuid|fi', 'status|varchar(24)|i', 'total_cents|integer', 'placed_at|timestamptz', 'shipped_at|timestamptz|n']),
    tableNode('db-order-items', 'order_items', 880, 420, 'amber', ['id|bigserial|p', 'order_id|bigint|fi', 'product_id|uuid|fi', 'quantity|integer', 'unit_price_cents|integer']),
    tableNode('db-payments', 'payments', 880, 150, 'rose', ['id|uuid|p', 'order_id|bigint|fui', 'provider|varchar(32)', 'amount_cents|integer', 'paid_at|timestamptz|n']),
  ],
  edges: [
    relation('db-r1', 'db-users', 'id', 'db-orders', 'user_id'),
    relation('db-r2', 'db-orders', 'id', 'db-order-items', 'order_id'),
    relation('db-r3', 'db-products', 'id', 'db-order-items', 'product_id'),
    // A payment belongs to exactly one order, so the child end is "one".
    relation('db-r4', 'db-orders', 'id', 'db-payments', 'order_id', 'crow-zero-one'),
  ],
};

// --- HRM (Hiring → Onboarding → Ongoing People Ops) -----------------------
const hrmDocument: FlowDocumentJSON = {
  nodes: [
    node('hrm-req', 'Job Requisition', 'Hiring manager request', 90, 210, 'blue', { type: 'start', icon: 'lucide:user' }),
    node('hrm-posting', 'Job Posting', 'Careers site & boards', 360, 210, 'violet', { shape: 'component', icon: 'tabler:world' }),
    node('hrm-applicants', 'Applicant Tracking', 'Resumes & screening', 630, 100, 'violet', { shape: 'component', icon: 'lucide:webhook' }),
    node('hrm-interview', 'Interviews', 'Panel scheduling', 630, 320, 'green', { shape: 'component', icon: 'bell' }),
    node('hrm-decision', 'Hiring Decision', 'Go / no-go', 900, 210, 'amber', { type: 'decision', shape: 'diamond', icon: 'play' }),
    node('hrm-offer', 'Offer & E-sign', 'Compensation & contract', 1170, 100, 'amber', { shape: 'document', icon: 'send' }),
    node('hrm-onboarding', 'Onboarding', 'Equipment & orientation', 1170, 320, 'green', { icon: 'flag' }),
    node('hrm-hris', 'HRIS', 'Employee master record', 1440, 210, 'indigo', { shape: 'database', icon: 'database' }),
    node('hrm-payroll', 'Payroll', 'Salary & benefits run', 1710, 80, 'rose', { icon: 'send' }),
    node('hrm-attendance', 'Time & Attendance', 'Leave & timesheets', 1710, 220, 'rose', { icon: 'tabler:player-play' }),
    node('hrm-performance', 'Performance Reviews', 'Goals & feedback cycles', 1710, 360, 'rose', { icon: 'sparkles' }),
    node('hrm-offboarding', 'Offboarding', 'Exit & final settlement', 1440, 470, 'blue', { type: 'output', icon: 'tabler:circle-x' }),
  ],
  edges: [
    edge('hrm-e1', 'hrm-req', 'hrm-posting', 'approved', 'pulse'),
    edge('hrm-e2', 'hrm-posting', 'hrm-applicants', 'candidates', 'dots'),
    edge('hrm-e3', 'hrm-applicants', 'hrm-interview', 'shortlist', 'comet'),
    edge('hrm-e4', 'hrm-interview', 'hrm-decision', 'feedback'),
    edge('hrm-e5', 'hrm-decision', 'hrm-offer', 'yes', 'flow'),
    edge('hrm-e6', 'hrm-decision', 'hrm-applicants', 'no', 'wave'),
    edge('hrm-e7', 'hrm-offer', 'hrm-onboarding', 'accepted', 'comet'),
    edge('hrm-e8', 'hrm-onboarding', 'hrm-hris', 'record'),
    edge('hrm-e9', 'hrm-hris', 'hrm-payroll', 'sync', 'traffic'),
    edge('hrm-e10', 'hrm-hris', 'hrm-attendance', 'sync', 'traffic'),
    edge('hrm-e11', 'hrm-hris', 'hrm-performance', 'sync', 'traffic'),
    edge('hrm-e12', 'hrm-hris', 'hrm-offboarding', 'exit', 'scanner'),
  ],
};

const crmDocument: FlowDocumentJSON = {
  nodes: [
    node('crm-lead', 'Lead Sources', 'Web, ads & events', 100, 210, 'blue', { type: 'start', icon: 'tabler:world' }),
    node('crm-capture', 'Lead Capture', 'Forms & enrichment', 370, 210, 'violet', { shape: 'component', icon: 'lucide:webhook' }),
    node('crm-score', 'Lead Scoring', 'Fit & engagement', 640, 100, 'amber', { type: 'decision', shape: 'diamond', icon: 'sparkles' }),
    node('crm-nurture', 'Nurture', 'Automated sequences', 640, 320, 'indigo', { icon: 'mail' }),
    node('crm-pipeline', 'Sales Pipeline', 'Stages & forecasting', 920, 100, 'green', { shape: 'component', icon: 'lucide:workflow' }),
    node('crm-activity', 'Activities', 'Calls, tasks & meetings', 920, 320, 'green', { shape: 'component', icon: 'bell' }),
    node('crm-proposal', 'Proposal', 'Quote & negotiation', 1200, 100, 'amber', { shape: 'document', icon: 'send' }),
    node('crm-customer', 'Customer 360', 'Account relationship', 1200, 320, 'blue', { shape: 'database', icon: 'database' }),
    node('crm-won', 'Closed Won', 'Onboarding handoff', 1480, 100, 'green', { type: 'output', icon: 'flag' }),
    node('crm-support', 'Customer Success', 'Support & retention', 1480, 320, 'rose', { icon: 'lucide:user' }),
  ],
  edges: [
    edge('crm-e1', 'crm-lead', 'crm-capture', 'new lead', 'dots'),
    edge('crm-e2', 'crm-capture', 'crm-score', 'evaluate', 'scanner'),
    edge('crm-e3', 'crm-score', 'crm-pipeline', 'qualified', 'comet'),
    edge('crm-e4', 'crm-score', 'crm-nurture', 'not ready', 'wave'),
    edge('crm-e5', 'crm-nurture', 'crm-score', 're-score', 'bidirectional'),
    edge('crm-e6', 'crm-pipeline', 'crm-activity'),
    edge('crm-e7', 'crm-pipeline', 'crm-proposal', 'opportunity'),
    edge('crm-e8', 'crm-proposal', 'crm-won', 'signed', 'pulse'),
    edge('crm-e9', 'crm-won', 'crm-customer', 'activate'),
    edge('crm-e10', 'crm-customer', 'crm-support', 'health', 'traffic'),
  ],
};

const ecommerceDocument: FlowDocumentJSON = {
  nodes: [
    node('ec-shopper', 'Shopper', 'Web & mobile', 90, 230, 'blue', { type: 'start', icon: 'lucide:user' }),
    node('ec-storefront', 'Storefront', 'Product experience', 360, 100, 'violet', { shape: 'server', icon: 'code' }),
    node('ec-checkout', 'Checkout', 'Cart & promotions', 360, 360, 'violet', { shape: 'component', icon: 'send' }),
    node('ec-catalog', 'Catalog', 'Products & pricing', 650, 100, 'green', { shape: 'component', icon: 'database' }),
    node('ec-orders', 'Order Service', 'Order lifecycle', 650, 360, 'green', { shape: 'component', icon: 'lucide:workflow' }),
    node('ec-search', 'Search & Recommendations', 'Discovery & ranking', 940, 100, 'indigo', { icon: 'sparkles', width: 205 }),
    node('ec-payment', 'Payment Service', 'Authorize & capture', 940, 360, 'amber', { shape: 'component', icon: 'send' }),
    node('ec-inventory', 'Inventory', 'Availability', 1230, 100, 'amber', { shape: 'database', icon: 'database' }),
    node('ec-queue', 'Event Bus', 'Order events', 1230, 360, 'indigo', { shape: 'queue', icon: 'tabler:route' }),
    node('ec-shipping', 'Shipping', 'Carrier orchestration', 1520, 100, 'rose', { icon: 'tabler:world' }),
    node('ec-notify', 'Notifications', 'Email, SMS & push', 1520, 360, 'rose', { icon: 'bell' }),
    node('ec-analytics', 'Commerce Analytics', 'Revenue & behavior', 1810, 230, 'blue', { type: 'output', icon: 'sparkles', width: 190 }),
  ],
  edges: [
    edge('ec-e1', 'ec-shopper', 'ec-storefront', 'browse', 'dots'),
    edge('ec-e2', 'ec-shopper', 'ec-checkout', 'buy', 'pulse'),
    edge('ec-e3', 'ec-storefront', 'ec-catalog'),
    edge('ec-e4', 'ec-storefront', 'ec-search', 'query', 'wave'),
    edge('ec-e5', 'ec-checkout', 'ec-orders', 'place order', 'comet'),
    edge('ec-e6', 'ec-orders', 'ec-payment', 'charge', 'glow'),
    edge('ec-e7', 'ec-catalog', 'ec-inventory', 'stock'),
    edge('ec-e8', 'ec-orders', 'ec-queue', 'publish', 'traffic'),
    edge('ec-e9', 'ec-queue', 'ec-shipping', 'fulfill', 'dash'),
    edge('ec-e10', 'ec-queue', 'ec-notify', 'status', 'dots'),
    edge('ec-e11', 'ec-inventory', 'ec-analytics', 'inventory'),
    edge('ec-e12', 'ec-queue', 'ec-analytics', 'events', 'traffic'),
  ],
};

const cicdDocument: FlowDocumentJSON = {
  nodes: [
    node('ci-dev', 'Developer', 'Commit & pull request', 90, 230, 'blue', { type: 'start', icon: 'lucide:user' }),
    node('ci-git', 'Git Repository', 'Source control', 350, 230, 'violet', { shape: 'server', icon: 'code' }),
    node('ci-build', 'Build', 'Compile & package', 620, 80, 'green', { shape: 'component', icon: 'cog' }),
    node('ci-test', 'Automated Tests', 'Unit, API & UI', 620, 230, 'green', { shape: 'component', icon: 'play' }),
    node('ci-scan', 'Security Scan', 'SAST, SCA & secrets', 620, 380, 'green', { shape: 'component', icon: 'lucide:webhook' }),
    node('ci-gate', 'Quality Gate', 'Release policy', 900, 230, 'amber', { type: 'decision', shape: 'diamond', icon: 'flag' }),
    node('ci-registry', 'Artifact Registry', 'Images & packages', 1170, 80, 'indigo', { shape: 'database', icon: 'database' }),
    node('ci-stage', 'Staging', 'Integration environment', 1170, 230, 'indigo', { shape: 'server', icon: 'cloud' }),
    node('ci-approval', 'Release Approval', 'Manual / automated', 1170, 380, 'amber', { type: 'decision', shape: 'diamond', icon: 'play' }),
    node('ci-prod', 'Production', 'Progressive delivery', 1460, 150, 'rose', { type: 'output', shape: 'cloud', icon: 'lucide:rocket' }),
    node('ci-observe', 'Observability', 'Metrics, logs & traces', 1460, 330, 'blue', { type: 'output', shape: 'server', icon: 'bell' }),
  ],
  edges: [
    edge('ci-e1', 'ci-dev', 'ci-git', 'push', 'comet'),
    edge('ci-e2', 'ci-git', 'ci-build', 'trigger'),
    edge('ci-e3', 'ci-git', 'ci-test', 'trigger'),
    edge('ci-e4', 'ci-git', 'ci-scan', 'trigger'),
    edge('ci-e5', 'ci-build', 'ci-gate', 'artifact'),
    edge('ci-e6', 'ci-test', 'ci-gate', 'results', 'pulse'),
    edge('ci-e7', 'ci-scan', 'ci-gate', 'findings', 'scanner'),
    edge('ci-e8', 'ci-gate', 'ci-registry', 'passed', 'flow'),
    edge('ci-e9', 'ci-registry', 'ci-stage', 'deploy', 'traffic'),
    edge('ci-e10', 'ci-stage', 'ci-approval', 'verify'),
    edge('ci-e11', 'ci-approval', 'ci-prod', 'promote', 'comet'),
    edge('ci-e12', 'ci-prod', 'ci-observe', 'telemetry', 'dots'),
    edge('ci-e13', 'ci-observe', 'ci-stage', 'rollback', 'bidirectional'),
  ],
};

// --- Software Architecture (production-style SaaS layout) -----------------
// Kept separate from the app's default boot document (`initialDocument`,
// now a minimal Client/Server/Database example) so this richer example
// still lives in the template library.
const ARCH_LAYER = {
  client: { color: '#dbeafe', background: '#082f49' },
  edge: { color: '#e0e7ff', background: '#1e1b4b' },
  web: { color: '#ede9fe', background: '#2e1065' },
  service: { color: '#d1fae5', background: '#022c22' },
  data: { color: '#fef3c7', background: '#451a03' },
  external: { color: '#ffe4e6', background: '#4c0519' },
} as const;

function archNode(
  id: string,
  title: string,
  description: string,
  x: number,
  y: number,
  icon: NodeIcon,
  layer: keyof typeof ARCH_LAYER,
  options: { type?: NodeType; shape?: NodeShape; width?: number } = {},
): FlowNode {
  const palette = ARCH_LAYER[layer];
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

function archEdge(
  id: string,
  from: string,
  to: string,
  options: Omit<Partial<FlowEdge>, 'id' | 'from' | 'to'> = {},
): FlowEdge {
  return { id, from, to, effect: 'flow', animationSpeed: 0.9, width: 1, effectSize: 1.5, ...options };
}

const softwareArchitectureDocument: FlowDocumentJSON = {
  nodes: [
    archNode('web-client', 'Web Client', 'React / Next.js', 100, 130, 'code', 'client', { type: 'start' }),
    archNode('mobile-app', 'Mobile App', 'iOS & Android', 100, 300, 'lucide:user', 'client'),
    archNode('admin-portal', 'Admin Portal', 'Operations console', 100, 470, 'tabler:settings', 'client'),

    archNode('dns', 'DNS', 'Managed DNS routing', 360, 130, 'tabler:world', 'edge', { shape: 'pill' }),
    archNode('cdn', 'CDN', 'Static assets & edge cache', 360, 300, 'cloud', 'edge', { shape: 'cloud' }),
    archNode('waf', 'Web Application Firewall', 'DDoS & threat protection', 360, 470, 'lucide:webhook', 'edge', { width: 190 }),

    archNode('load-balancer', 'Load Balancer', 'TLS termination', 635, 210, 'tabler:route', 'web', { shape: 'hexagon' }),
    archNode('api-gateway', 'API Gateway', 'Routing & rate limits', 635, 430, 'lucide:webhook', 'web', { shape: 'hexagon' }),

    archNode('web-server-a', 'Web Server A', 'SSR & web endpoints', 910, 120, 'code', 'web', { shape: 'server' }),
    archNode('web-server-b', 'Web Server B', 'SSR & web endpoints', 910, 280, 'code', 'web', { shape: 'server' }),
    archNode('auth-service', 'Auth Service', 'OIDC, JWT & sessions', 910, 500, 'tabler:robot', 'service', { shape: 'component' }),

    archNode('user-service', 'User Service', 'Profiles & accounts', 1190, 90, 'lucide:user', 'service', { shape: 'component' }),
    archNode('catalog-service', 'Catalog Service', 'Products & inventory', 1190, 235, 'database', 'service', { shape: 'component' }),
    archNode('order-service', 'Order Service', 'Order orchestration', 1190, 380, 'lucide:workflow', 'service', { shape: 'component' }),
    archNode('payment-service', 'Payment Service', 'Billing workflow', 1190, 525, 'send', 'service', { shape: 'component' }),
    archNode('notification-service', 'Notification Service', 'Email, SMS & push', 1190, 670, 'bell', 'service', { width: 184, shape: 'component' }),

    archNode('redis-cache', 'Redis Cache', 'Sessions & hot data', 1490, 80, 'database', 'data', { shape: 'database' }),
    archNode('message-queue', 'Message Queue', 'Async event bus', 1490, 225, 'tabler:route', 'data', { shape: 'queue' }),
    archNode('search-engine', 'Search Engine', 'Full-text search', 1490, 370, 'sparkles', 'data'),
    archNode('primary-db', 'Primary Database', 'PostgreSQL writer', 1490, 515, 'database', 'data', { shape: 'database' }),
    archNode('read-replica', 'Read Replica', 'PostgreSQL reader', 1490, 660, 'database', 'data', { shape: 'database' }),

    archNode('object-storage', 'Object Storage', 'Media & documents', 1790, 70, 'cloud', 'external', { shape: 'cloud' }),
    archNode('cloud-functions', 'Cloud Functions', 'Background compute', 1790, 205, 'lucide:zap', 'external', { shape: 'cloud' }),
    archNode('payment-provider', 'Payment Provider', 'Stripe / Adyen', 1790, 340, 'send', 'external'),
    archNode('email-provider', 'Email Provider', 'SES / SendGrid', 1790, 475, 'mail', 'external'),
    archNode('monitoring', 'Monitoring', 'Metrics & alerts', 1790, 610, 'bell', 'external', { shape: 'server' }),
    archNode('central-logs', 'Centralized Logs', 'Searchable app logs', 1790, 745, 'code', 'external', { shape: 'server' }),
    archNode('data-warehouse', 'Data Warehouse', 'Analytics & BI', 1790, 880, 'database', 'external', { shape: 'database' }),
  ],
  edges: [
    archEdge('e01', 'web-client', 'dns', { label: 'HTTPS', effect: 'pulse' }),
    archEdge('e02', 'mobile-app', 'dns', { label: 'API', effect: 'dots' }),
    archEdge('e03', 'admin-portal', 'dns', { effect: 'scanner' }),
    archEdge('e04', 'dns', 'cdn', { label: 'resolve', effect: 'comet' }),
    archEdge('e05', 'cdn', 'waf', { label: 'miss', effect: 'traffic' }),
    archEdge('e06', 'waf', 'load-balancer', { effect: 'flow', animationSpeed: 1.2 }),
    archEdge('e07', 'load-balancer', 'web-server-a', { label: '50%', effect: 'dots' }),
    archEdge('e08', 'load-balancer', 'web-server-b', { label: '50%', effect: 'dots' }),
    archEdge('e09', 'web-server-a', 'api-gateway', { effect: 'flow' }),
    archEdge('e10', 'web-server-b', 'api-gateway', { effect: 'flow' }),
    archEdge('e11', 'api-gateway', 'auth-service', { label: 'verify', effect: 'scanner' }),
    archEdge('e12', 'api-gateway', 'user-service', { label: '/users', effect: 'wave' }),
    archEdge('e13', 'api-gateway', 'catalog-service', { label: '/catalog', effect: 'wave' }),
    archEdge('e14', 'api-gateway', 'order-service', { label: '/orders', effect: 'wave' }),
    archEdge('e15', 'api-gateway', 'payment-service', { label: '/pay', effect: 'wave' }),
    archEdge('e16', 'auth-service', 'redis-cache', { label: 'session', effect: 'bidirectional' }),
    archEdge('e17', 'auth-service', 'primary-db', { label: 'identity', effect: 'scanner' }),
    archEdge('e18', 'user-service', 'redis-cache', { effect: 'bidirectional' }),
    archEdge('e19', 'user-service', 'primary-db', { effect: 'flow' }),
    archEdge('e20', 'catalog-service', 'search-engine', { label: 'index', effect: 'traffic' }),
    archEdge('e21', 'catalog-service', 'read-replica', { label: 'read', effect: 'flow' }),
    archEdge('e22', 'catalog-service', 'object-storage', { label: 'media', effect: 'comet' }),
    archEdge('e23', 'order-service', 'primary-db', { label: 'write', effect: 'scanner' }),
    archEdge('e24', 'order-service', 'message-queue', { label: 'events', effect: 'comet' }),
    archEdge('e25', 'order-service', 'payment-service', { label: 'charge', effect: 'pulse' }),
    archEdge('e26', 'payment-service', 'payment-provider', { label: 'secure API', effect: 'glow' }),
    archEdge('e27', 'payment-service', 'message-queue', { label: 'result', effect: 'traffic' }),
    archEdge('e28', 'message-queue', 'notification-service', { label: 'consume', effect: 'dash' }),
    archEdge('e29', 'message-queue', 'cloud-functions', { label: 'trigger', effect: 'comet' }),
    archEdge('e30', 'notification-service', 'email-provider', { label: 'deliver', effect: 'dots' }),
    archEdge('e31', 'primary-db', 'read-replica', { label: 'replicate', effect: 'flow', animationSpeed: 1.4 }),
    archEdge('e32', 'read-replica', 'data-warehouse', { label: 'ETL', effect: 'traffic' }),
    archEdge('e33', 'web-server-b', 'central-logs', { label: 'logs', effect: 'dots' }),
    archEdge('e34', 'order-service', 'monitoring', { label: 'metrics', effect: 'wave' }),
    archEdge('e35', 'cloud-functions', 'object-storage', { label: 'process', effect: 'bidirectional' }),
  ],
};

export const diagramTemplates: DiagramTemplate[] = [
  {
    id: 'client-server-database',
    name: 'Client / Server / Database',
    category: 'General',
    description: 'A minimal three-tier example to start from.',
    document: initialDocument,
  },
  {
    id: 'hrm',
    name: 'HRM',
    category: 'Enterprise',
    description: 'Hiring pipeline through onboarding, payroll and reviews.',
    document: hrmDocument,
  },
  {
    id: 'crm',
    name: 'CRM Lifecycle',
    category: 'Enterprise',
    description: 'Lead capture, qualification, pipeline and customer success.',
    document: crmDocument,
  },
  {
    id: 'software-architecture',
    name: 'Software Architecture',
    category: 'Technology',
    description: 'Cloud-native services, data stores and infrastructure.',
    document: softwareArchitectureDocument,
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Platform',
    category: 'Product',
    description: 'Storefront, checkout, orders, fulfillment and analytics.',
    document: ecommerceDocument,
  },
  {
    id: 'cicd',
    name: 'CI/CD Pipeline',
    category: 'DevOps',
    description: 'Build, test, security gates, deployment and observability.',
    document: cicdDocument,
  },
  {
    id: 'database-schema',
    name: 'Database Schema',
    category: 'Technology',
    description: 'ERD tables with keys, indexes and crow’s foot relationships.',
    document: databaseSchemaDocument,
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    category: 'General',
    description: 'Start from scratch with the full block and line toolkit.',
    document: { nodes: [], edges: [] },
  },
];

export function getDiagramTemplate(id: DiagramTemplateId): DiagramTemplate {
  return diagramTemplates.find((template) => template.id === id) ?? diagramTemplates[0];
}
