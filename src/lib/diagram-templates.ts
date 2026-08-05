import { initialDocument } from './flowchart-data';
import type {
  EdgeEffect,
  FlowDocumentJSON,
  FlowNode,
  NodeIcon,
  NodeShape,
  NodeType,
} from './flowchart-types';

export type DiagramTemplateId =
  | 'software-architecture'
  | 'erp'
  | 'crm'
  | 'ecommerce'
  | 'data-pipeline'
  | 'cicd'
  | 'network'
  | 'flowx-architecture'
  | 'flowx-example'
  | 'crm-customer-journey'
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
    height?: number;
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
    height: options.height ?? 84,
    shape: options.shape ?? 'rounded',
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
  return { id, from, to, label, effect, animationSpeed: 0.9, width: 2 } as const;
}

const erpDocument: FlowDocumentJSON = {
  nodes: [
    node('erp-portal', 'Employee Portal', 'Unified workspace', 100, 250, 'blue', { type: 'start', icon: 'lucide:user' }),
    node('erp-crm', 'CRM', 'Leads & customers', 390, 70, 'violet', { shape: 'component', icon: 'lucide:user' }),
    node('erp-sales', 'Sales', 'Quotes & orders', 390, 210, 'violet', { shape: 'component', icon: 'send' }),
    node('erp-hr', 'Human Resources', 'People & attendance', 390, 350, 'violet', { shape: 'component', icon: 'tabler:robot' }),
    node('erp-procurement', 'Procurement', 'Purchase requests', 680, 70, 'green', { shape: 'component', icon: 'lucide:workflow' }),
    node('erp-inventory', 'Inventory', 'Stock & movements', 680, 210, 'green', { shape: 'component', icon: 'database' }),
    node('erp-payroll', 'Payroll', 'Salary & benefits', 680, 350, 'green', { shape: 'component', icon: 'send' }),
    node('erp-approval', 'Manager Approval', 'Policy & budget check', 970, 70, 'amber', { type: 'decision', shape: 'diamond', icon: 'play' }),
    node('erp-warehouse', 'Warehouse', 'Fulfillment & logistics', 970, 210, 'amber', { shape: 'server', icon: 'tabler:route' }),
    node('erp-accounting', 'Finance & Accounting', 'GL, AP, AR & tax', 970, 350, 'amber', { shape: 'component', icon: 'tabler:settings', width: 190 }),
    node('erp-supplier', 'Supplier Portal', 'Vendors & tenders', 1260, 70, 'rose', { icon: 'tabler:world' }),
    node('erp-bank', 'Banking Gateway', 'Payments & settlement', 1260, 350, 'rose', { icon: 'send' }),
    node('erp-db', 'ERP Database', 'Master transactional data', 1260, 210, 'indigo', { shape: 'database', icon: 'database' }),
    node('erp-bi', 'BI & Reporting', 'KPIs and dashboards', 1550, 210, 'blue', { type: 'output', icon: 'sparkles' }),
  ],
  edges: [
    edge('erp-e1', 'erp-portal', 'erp-crm', 'customers', 'dots'),
    edge('erp-e2', 'erp-portal', 'erp-sales', 'orders'),
    edge('erp-e3', 'erp-portal', 'erp-hr', 'employees', 'wave'),
    edge('erp-e4', 'erp-crm', 'erp-sales', 'opportunity', 'comet'),
    edge('erp-e5', 'erp-sales', 'erp-inventory', 'reserve'),
    edge('erp-e6', 'erp-sales', 'erp-accounting', 'invoice', 'scanner'),
    edge('erp-e7', 'erp-hr', 'erp-payroll', 'timesheet'),
    edge('erp-e8', 'erp-procurement', 'erp-approval', 'request', 'pulse'),
    edge('erp-e9', 'erp-approval', 'erp-supplier', 'approved', 'comet'),
    edge('erp-e10', 'erp-supplier', 'erp-inventory', 'goods', 'traffic'),
    edge('erp-e11', 'erp-inventory', 'erp-warehouse', 'pick / pack'),
    edge('erp-e12', 'erp-payroll', 'erp-accounting', 'journal'),
    edge('erp-e13', 'erp-accounting', 'erp-bank', 'payment', 'glow'),
    edge('erp-e14', 'erp-crm', 'erp-db'),
    edge('erp-e15', 'erp-inventory', 'erp-db'),
    edge('erp-e16', 'erp-accounting', 'erp-db'),
    edge('erp-e17', 'erp-db', 'erp-bi', 'analytics', 'traffic'),
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

const dataPipelineDocument: FlowDocumentJSON = {
  nodes: [
    node('dp-apps', 'Applications', 'Transactional events', 90, 80, 'blue', { type: 'start', icon: 'code' }),
    node('dp-saas', 'SaaS Sources', 'CRM, ads & support', 90, 250, 'blue', { icon: 'cloud' }),
    node('dp-files', 'Files & APIs', 'Batch inputs', 90, 420, 'blue', { icon: 'code' }),
    node('dp-stream', 'Streaming Ingest', 'Kafka / Kinesis', 390, 120, 'violet', { shape: 'queue', icon: 'tabler:route' }),
    node('dp-batch', 'Batch Ingest', 'Scheduled connectors', 390, 370, 'violet', { shape: 'server', icon: 'lucide:webhook' }),
    node('dp-lake', 'Data Lake', 'Raw immutable zone', 700, 120, 'indigo', { shape: 'cloud', icon: 'cloud' }),
    node('dp-transform', 'Transform', 'dbt / Spark jobs', 700, 370, 'green', { shape: 'component', icon: 'cog' }),
    node('dp-quality', 'Data Quality', 'Tests & lineage', 1010, 120, 'amber', { type: 'decision', shape: 'diamond', icon: 'play' }),
    node('dp-warehouse', 'Data Warehouse', 'Curated models', 1010, 370, 'amber', { shape: 'database', icon: 'database' }),
    node('dp-bi', 'BI Dashboards', 'Metrics & reporting', 1320, 80, 'rose', { type: 'output', icon: 'sparkles' }),
    node('dp-ml', 'ML Platform', 'Features & models', 1320, 250, 'rose', { type: 'output', icon: 'tabler:robot' }),
    node('dp-reverse', 'Reverse ETL', 'Activate destinations', 1320, 420, 'rose', { type: 'output', icon: 'send' }),
  ],
  edges: [
    edge('dp-e1', 'dp-apps', 'dp-stream', 'events', 'traffic'),
    edge('dp-e2', 'dp-saas', 'dp-batch', 'sync', 'dots'),
    edge('dp-e3', 'dp-files', 'dp-batch', 'load'),
    edge('dp-e4', 'dp-stream', 'dp-lake', 'raw', 'comet'),
    edge('dp-e5', 'dp-batch', 'dp-lake', 'raw'),
    edge('dp-e6', 'dp-lake', 'dp-transform', 'process', 'scanner'),
    edge('dp-e7', 'dp-transform', 'dp-quality', 'validate', 'pulse'),
    edge('dp-e8', 'dp-quality', 'dp-warehouse', 'passed', 'flow'),
    edge('dp-e9', 'dp-warehouse', 'dp-bi', 'semantic layer', 'wave'),
    edge('dp-e10', 'dp-warehouse', 'dp-ml', 'features', 'traffic'),
    edge('dp-e11', 'dp-warehouse', 'dp-reverse', 'audiences', 'comet'),
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

// --- FlowX Architecture (Simplified) --------------------------------------
// 5 horizontal layers: Trigger → Flow → Capability → Policy → Runtime,
// with a side FlowX Platform panel and a footer Infrastructure strip.
const flowxArchDocument: FlowDocumentJSON = {
  nodes: [
    // 1. TRIGGER layer
    node('fx-trig-http', 'HTTP API', 'REST endpoints', 360, 200, 'blue', { shape: 'rounded', icon: 'tabler:world' }),
    node('fx-trig-event', 'Event / Kafka', 'Message topic', 590, 200, 'blue', { shape: 'rounded', icon: 'tabler:route' }),
    node('fx-trig-cron', 'Scheduler / Cron', 'Time-based', 820, 200, 'blue', { shape: 'rounded', icon: 'tabler:player-play' }),
    node('fx-trig-webhook', 'Webhook', 'Callback URL', 1050, 200, 'blue', { shape: 'rounded', icon: 'lucide:webhook' }),
    node('fx-trig-stream', 'Stream', 'Realtime feed', 1280, 200, 'blue', { shape: 'rounded', icon: 'tabler:route' }),
    node('fx-trig-ai', 'AI Agent', 'Autonomous trigger', 1510, 200, 'blue', { shape: 'rounded', icon: 'tabler:robot', width: 180 }),

    // 2. FLOW layer — Step 1 → Step 2 → Decision → Step 3A / 3B → Step 4
    node('fx-flow-s1', 'Step 1', 'Validate input', 360, 410, 'green', { shape: 'rounded', icon: 'tabler:player-play' }),
    node('fx-flow-s2', 'Step 2', 'Enrich context', 670, 410, 'green', { shape: 'rounded', icon: 'cog' }),
    node('fx-flow-dec', 'Decision', 'Route outcome', 980, 410, 'green', { shape: 'diamond', icon: 'play' }),
    node('fx-flow-s3a', 'Step 3A', 'Happy path', 1290, 340, 'green', { shape: 'rounded', icon: 'tabler:flag' }),
    node('fx-flow-s3b', 'Step 3B', 'Compensating path', 1290, 480, 'green', { shape: 'rounded', icon: 'lucide:workflow' }),
    node('fx-flow-s4', 'Step 4', 'Finalize result', 1600, 410, 'green', { shape: 'rounded', icon: 'flag' }),

    // 3. CAPABILITY layer
    node('fx-cap-pay', 'Payment', 'Charge & refund', 360, 620, 'amber', { shape: 'component', icon: 'send' }),
    node('fx-cap-inv', 'Inventory', 'Stock & movements', 590, 620, 'amber', { shape: 'component', icon: 'database' }),
    node('fx-cap-notif', 'Notification', 'Email/SMS/push', 820, 620, 'amber', { shape: 'component', icon: 'bell' }),
    node('fx-cap-user', 'User', 'Profile & identity', 1050, 620, 'amber', { shape: 'component', icon: 'lucide:user' }),
    node('fx-cap-ellipsis', '…', '…', 1280, 620, 'amber', { shape: 'component', icon: null }),
    node('fx-cap-custom', 'Custom Capability', 'Reusable block', 1510, 620, 'amber', { shape: 'component', icon: 'sparkles' }),

    // 4. POLICY layer
    node('fx-pol-retry', 'Retry', 'Exponential backoff', 360, 830, 'rose', { shape: 'pill', icon: 'tabler:refresh' }),
    node('fx-pol-auth', 'Authorization', 'Roles & scopes', 590, 830, 'rose', { shape: 'pill', icon: 'tabler:shield' }),
    node('fx-pol-timeout', 'Timeout', 'Deadline guard', 820, 830, 'rose', { shape: 'pill', icon: 'tabler:player-play' }),
    node('fx-pol-cache', 'Cache', 'Memoize results', 1050, 830, 'rose', { shape: 'pill', icon: 'database' }),
    node('fx-pol-cb', 'Circuit Breaker', 'Fail-fast on outage', 1280, 830, 'rose', { shape: 'pill', icon: 'lucide:zap' }),
    node('fx-pol-more', '…', '…', 1510, 830, 'rose', { shape: 'pill', icon: null }),

    // 5. RUNTIME layer
    node('fx-rt-exec', 'Execute', 'Run the flow', 360, 1040, 'indigo', { shape: 'rounded', icon: 'lucide:rocket' }),
    node('fx-rt-mon', 'Monitor', 'Health & alerts', 590, 1040, 'indigo', { shape: 'rounded', icon: 'bell' }),
    node('fx-rt-scale', 'Scale', 'Auto-scale workers', 820, 1040, 'indigo', { shape: 'rounded', icon: 'lucide:workflow' }),
    node('fx-rt-log', 'Log & Trace', 'OpenTelemetry', 1050, 1040, 'indigo', { shape: 'rounded', icon: 'code' }),
    node('fx-rt-met', 'Metrics', 'SLO & KPIs', 1280, 1040, 'indigo', { shape: 'rounded', icon: 'sparkles' }),

    // FlowX Platform side panel
    node('fx-platform', 'FlowX Platform', 'Compiler / Plugin / Observability / Dashboard', 1830, 540, 'violet', { shape: 'rectangle', icon: 'tabler:box', width: 240, height: 220 }),
    node('fx-compiler', 'Compiler', 'Optimize Flow', 1830, 280, 'blue', { shape: 'rounded', icon: 'code', width: 220 }),
    node('fx-plugin', 'Plugin System', 'Extensible', 1830, 410, 'green', { shape: 'rounded', icon: 'tabler:puzzle', width: 220 }),
    node('fx-obs', 'Observability', 'End-to-End', 1830, 670, 'amber', { shape: 'rounded', icon: 'lucide:webhook', width: 220 }),
    node('fx-dash', 'Dashboard', 'Visualize', 1830, 800, 'rose', { shape: 'rounded', icon: 'sparkles', width: 220 }),

    // Infrastructure footer
    node('fx-inf-cloud', 'Cloud / On-Prem', 'Hosted runtime', 360, 1230, 'blue', { shape: 'cloud', icon: 'cloud' }),
    node('fx-inf-k8s', 'Kubernetes / Docker', 'Container orchestration', 700, 1230, 'blue', { shape: 'hexagon', icon: 'lucide:webhook' }),
    node('fx-inf-db', 'Database', 'State store', 1050, 1230, 'blue', { shape: 'database', icon: 'database' }),
    node('fx-inf-mq', 'Message Broker', 'Async events', 1380, 1230, 'blue', { shape: 'queue', icon: 'tabler:route' }),
    node('fx-inf-store', 'Storage', 'Blob / files', 1680, 1230, 'blue', { shape: 'cloud', icon: 'cloud' }),
  ],
  edges: [
    // Triggers all fan into Flow start
    edge('fx-te1', 'fx-trig-http', 'fx-flow-s1', undefined, 'flow'),
    edge('fx-te2', 'fx-trig-event', 'fx-flow-s1', undefined, 'flow'),
    edge('fx-te3', 'fx-trig-cron', 'fx-flow-s1', undefined, 'flow'),
    edge('fx-te4', 'fx-trig-webhook', 'fx-flow-s1', undefined, 'flow'),
    edge('fx-te5', 'fx-trig-stream', 'fx-flow-s1', undefined, 'flow'),
    edge('fx-te6', 'fx-trig-ai', 'fx-flow-s1', undefined, 'flow'),
    // Flow chain
    edge('fx-fe1', 'fx-flow-s1', 'fx-flow-s2', undefined, 'flow'),
    edge('fx-fe2', 'fx-flow-s2', 'fx-flow-dec', undefined, 'flow'),
    edge('fx-fe3', 'fx-flow-dec', 'fx-flow-s3a', 'yes', 'flow'),
    edge('fx-fe4', 'fx-flow-dec', 'fx-flow-s3b', 'no', 'flow'),
    edge('fx-fe5', 'fx-flow-s3a', 'fx-flow-s4', undefined, 'flow'),
    edge('fx-fe6', 'fx-flow-s3b', 'fx-flow-s4', undefined, 'flow'),
    // Flow uses capabilities
    edge('fx-fc1', 'fx-flow-s2', 'fx-cap-pay', undefined, 'wave'),
    edge('fx-fc2', 'fx-flow-s3a', 'fx-cap-inv', undefined, 'wave'),
    edge('fx-fc3', 'fx-flow-s3b', 'fx-cap-notif', undefined, 'wave'),
    edge('fx-fc4', 'fx-flow-s4', 'fx-cap-user', undefined, 'wave'),
    // Capabilities consume policies
    edge('fx-cp1', 'fx-cap-pay', 'fx-pol-retry', undefined, 'dash'),
    edge('fx-cp2', 'fx-cap-inv', 'fx-pol-auth', undefined, 'dash'),
    edge('fx-cp3', 'fx-cap-notif', 'fx-pol-timeout', undefined, 'dash'),
    edge('fx-cp4', 'fx-cap-user', 'fx-pol-cache', undefined, 'dash'),
    // Policies connect to runtime
    edge('fx-pr1', 'fx-pol-retry', 'fx-rt-exec', undefined, 'comet'),
    edge('fx-pr2', 'fx-pol-auth', 'fx-rt-exec', undefined, 'comet'),
    edge('fx-pr3', 'fx-pol-timeout', 'fx-rt-exec', undefined, 'comet'),
    edge('fx-pr4', 'fx-pol-cache', 'fx-rt-mon', undefined, 'comet'),
    edge('fx-pr5', 'fx-pol-cb', 'fx-rt-exec', undefined, 'comet'),
    // Runtime is grounded in infrastructure
    edge('fx-ri1', 'fx-rt-exec', 'fx-inf-cloud', undefined, 'glow'),
    edge('fx-ri2', 'fx-rt-mon', 'fx-inf-k8s', undefined, 'glow'),
    edge('fx-ri3', 'fx-rt-scale', 'fx-inf-k8s', undefined, 'glow'),
    edge('fx-ri4', 'fx-rt-log', 'fx-inf-db', undefined, 'glow'),
    edge('fx-ri5', 'fx-rt-met', 'fx-inf-mq', undefined, 'glow'),
    // FlowX Platform hooks the layers
    edge('fx-pt1', 'fx-platform', 'fx-trig-ai', undefined, 'dash'),
    edge('fx-pt2', 'fx-compiler', 'fx-flow-dec', undefined, 'dash'),
    edge('fx-pt3', 'fx-plugin', 'fx-cap-custom', undefined, 'dash'),
    edge('fx-pt4', 'fx-obs', 'fx-rt-mon', undefined, 'dash'),
    edge('fx-pt5', 'fx-dash', 'fx-rt-met', undefined, 'dash'),
  ],
};

// --- FlowX Example Usage (OrderFlow) --------------------------------------
const flowxExampleDocument: FlowDocumentJSON = {
  nodes: [
    // Scenario block (left)
    node('fxex-scenario', 'Scenario', 'When a new order is created (via API or Event), process, reserve inventory, charge payment and send confirmation.', 90, 200, 'blue', { shape: 'rectangle', icon: 'lucide:user', width: 220, height: 160 }),

    // Define Flow (Code First) — left code panel
    node('fxex-define', '1. Define Flow (Code First)', 'FlowBuilder.New("OrderFlow")\n  .Trigger(HttpPost("/orders"))\n  .OrTrigger(Event("order.created"))\n  .Step<ValidateOrder>() …', 90, 430, 'violet', { shape: 'document', icon: 'code', width: 220, height: 200 }),
    node('fxex-register', '2. Register Capabilities', 'services.AddCapability<ValidateOrder>()…\n// FlowX discovers and registers everything', 90, 690, 'green', { shape: 'document', icon: 'cog', width: 220, height: 150 }),
    node('fxex-run', '3. Run', 'app.Run();', 90, 900, 'amber', { shape: 'rounded', icon: 'tabler:player-play', width: 220 }),

    // Top legend: Trigger → Flow → Capability → Policy → Runtime
    node('fxex-leg-trig', 'Trigger', 'How the flow is started', 470, 90, 'blue', { shape: 'rounded', icon: 'lucide:webhook', width: 180 }),
    node('fxex-leg-flow', 'Flow', 'Business workflow orchestration', 720, 90, 'green', { shape: 'component', icon: 'lucide:workflow', width: 180 }),
    node('fxex-leg-cap', 'Capability', 'Reusable business building blocks', 970, 90, 'amber', { shape: 'component', icon: 'tabler:puzzle', width: 180 }),
    node('fxex-leg-pol', 'Policy', 'Rules applied automatically', 1220, 90, 'rose', { shape: 'pill', icon: 'tabler:shield', width: 180 }),
    node('fxex-leg-rt', 'Runtime', 'Execute, monitor and scale', 1470, 90, 'indigo', { shape: 'rounded', icon: 'lucide:rocket', width: 180 }),

    // Triggers block (left of OrderFlow)
    node('fxex-trig-http', 'HTTP API', 'POST /orders', 360, 290, 'blue', { shape: 'rounded', icon: 'tabler:world' }),
    node('fxex-trig-event', 'Event', 'order.created', 360, 410, 'blue', { shape: 'rounded', icon: 'tabler:route' }),
    node('fxex-trig-sched', 'Schedule (Cron)', 'nightly', 360, 530, 'blue', { shape: 'rounded', icon: 'tabler:player-play' }),
    node('fxex-trig-stream', 'Stream', 'realtime', 360, 650, 'blue', { shape: 'rounded', icon: 'tabler:route' }),
    node('fxex-trig-ai', 'AI Agent', 'autonomous', 360, 770, 'blue', { shape: 'rounded', icon: 'tabler:robot' }),

    // OrderFlow sequence
    node('fxex-validate', 'Validate Order', 'Capability', 640, 460, 'green', { shape: 'rounded', icon: 'tabler:circle-check' }),
    node('fxex-reserve', 'Reserve Inventory', 'Capability', 880, 460, 'amber', { shape: 'component', icon: 'database' }),
    node('fxex-charge', 'Process Payment', 'Capability', 1120, 460, 'amber', { shape: 'component', icon: 'send' }),
    node('fxex-email', 'Send Confirmation Email', 'Capability', 1380, 460, 'green', { shape: 'rounded', icon: 'mail' }),

    // OnError branch
    node('fxex-err', 'Send Failure Notification', 'OnError', 1010, 680, 'rose', { shape: 'rounded', icon: 'bell' }),

    // Policy column
    node('fxex-pol-retry', 'Retry (3 times)', 'auto-applied', 1490, 290, 'rose', { shape: 'pill', icon: 'tabler:refresh' }),
    node('fxex-pol-timeout', 'Timeout (30s)', 'auto-applied', 1490, 400, 'rose', { shape: 'pill', icon: 'tabler:player-play' }),
    node('fxex-pol-auth', 'Authorization', 'Order.Create', 1490, 510, 'rose', { shape: 'pill', icon: 'tabler:shield' }),
    node('fxex-pol-cb', 'Circuit Breaker', 'fail-fast', 1490, 620, 'rose', { shape: 'pill', icon: 'lucide:zap' }),
    node('fxex-pol-log', 'Logging & Tracing', 'auto-applied', 1490, 730, 'rose', { shape: 'pill', icon: 'code' }),

    // Runtime column
    node('fxex-rt-exec', 'Execute', 'run flow', 1730, 290, 'indigo', { shape: 'rounded', icon: 'tabler:player-play' }),
    node('fxex-rt-mon', 'Monitor', 'health', 1730, 400, 'indigo', { shape: 'rounded', icon: 'bell' }),
    node('fxex-rt-scale', 'Scale', 'auto-scale', 1730, 510, 'indigo', { shape: 'rounded', icon: 'lucide:workflow' }),
    node('fxex-rt-persist', 'Persist', 'state', 1730, 620, 'indigo', { shape: 'rounded', icon: 'database' }),
    node('fxex-rt-obs', 'Observe', 'metrics', 1730, 730, 'indigo', { shape: 'rounded', icon: 'lucide:webhook' }),

    // How it works (example runtime flow)
    node('fxex-how', 'How it works (example runtime flow)', '1. Request arrives → 2. Flow triggered → 3. Steps executed → 4. Policies enforced → 5. Result', 90, 1060, 'blue', { shape: 'rectangle', icon: 'sparkles', width: 1880, height: 90 }),

    // Benefits
    node('fxex-ben', 'Benefits', 'Unified programming model · Focus on business flow · Policies applied consistently · High performance & scalable · Easy to test, monitor and operate', 90, 1220, 'green', { shape: 'rectangle', icon: 'flag', width: 1880, height: 90 }),
  ],
  edges: [
    // Top legend left → right
    edge('fxex-lg1', 'fxex-leg-trig', 'fxex-leg-flow', undefined, 'flow'),
    edge('fxex-lg2', 'fxex-leg-flow', 'fxex-leg-cap', undefined, 'flow'),
    edge('fxex-lg3', 'fxex-leg-cap', 'fxex-leg-pol', undefined, 'flow'),
    edge('fxex-lg4', 'fxex-leg-pol', 'fxex-leg-rt', undefined, 'flow'),

    // Triggers all feed Validate
    edge('fxex-t1', 'fxex-trig-http', 'fxex-validate', undefined, 'flow'),
    edge('fxex-t2', 'fxex-trig-event', 'fxex-validate', undefined, 'flow'),
    edge('fxex-t3', 'fxex-trig-sched', 'fxex-validate', undefined, 'flow'),
    edge('fxex-t4', 'fxex-trig-stream', 'fxex-validate', undefined, 'flow'),
    edge('fxex-t5', 'fxex-trig-ai', 'fxex-validate', undefined, 'flow'),

    // OrderFlow sequence
    edge('fxex-o1', 'fxex-validate', 'fxex-reserve', undefined, 'flow'),
    edge('fxex-o2', 'fxex-reserve', 'fxex-charge', undefined, 'flow'),
    edge('fxex-o3', 'fxex-charge', 'fxex-email', undefined, 'flow'),

    // OnError branch from each step
    edge('fxex-oe1', 'fxex-validate', 'fxex-err', 'OnError', 'dash'),
    edge('fxex-oe2', 'fxex-reserve', 'fxex-err', 'OnError', 'dash'),
    edge('fxex-oe3', 'fxex-charge', 'fxex-err', 'OnError', 'dash'),

    // Policies attach to the pipeline (flow → policy)
    edge('fxex-pf1', 'fxex-validate', 'fxex-pol-auth', undefined, 'wave'),
    edge('fxex-pf2', 'fxex-reserve', 'fxex-pol-retry', undefined, 'wave'),
    edge('fxex-pf3', 'fxex-charge', 'fxex-pol-timeout', undefined, 'wave'),
    edge('fxex-pf4', 'fxex-email', 'fxex-pol-log', undefined, 'wave'),

    // Policy → Runtime
    edge('fxex-pr1', 'fxex-pol-retry', 'fxex-rt-exec', undefined, 'comet'),
    edge('fxex-pr2', 'fxex-pol-timeout', 'fxex-rt-exec', undefined, 'comet'),
    edge('fxex-pr3', 'fxex-pol-auth', 'fxex-rt-exec', undefined, 'comet'),
    edge('fxex-pr4', 'fxex-pol-cb', 'fxex-rt-scale', undefined, 'comet'),
    edge('fxex-pr5', 'fxex-pol-log', 'fxex-rt-mon', undefined, 'comet'),
  ],
};

// --- CRM Sample – Complex Business Flows (Customer Journey) ----------------
const crmJourneyDocument: FlowDocumentJSON = {
  nodes: [
    // Triggers column (left)
    node('crmj-trig-web', 'Web / API', 'Web form, Mobile app', 90, 110, 'blue', { shape: 'rounded', icon: 'tabler:world' }),
    node('crmj-trig-email', 'Email', 'Inbound email', 90, 220, 'blue', { shape: 'rounded', icon: 'mail' }),
    node('crmj-trig-phone', 'Phone Call', 'Inbound / Outbound', 90, 330, 'blue', { shape: 'rounded', icon: 'bell' }),
    node('crmj-trig-social', 'Social Media', 'DM, Comment, Mention', 90, 440, 'blue', { shape: 'rounded', icon: 'tabler:sparkles' }),
    node('crmj-trig-chat', 'Live Chat', 'Website widget', 90, 550, 'blue', { shape: 'rounded', icon: 'tabler:message-circle' }),
    node('crmj-trig-camp', 'Campaign', 'Email, Ads', 90, 660, 'blue', { shape: 'rounded', icon: 'send' }),
    node('crmj-trig-partner', 'Partner / System', 'Third-party', 90, 770, 'blue', { shape: 'rounded', icon: 'tabler:settings' }),
    node('crmj-trig-sched', 'Scheduler', 'Reminder, Follow-up', 90, 880, 'blue', { shape: 'rounded', icon: 'tabler:player-play' }),
    node('crmj-trig-ai', 'AI Agent', 'AI-based recommendation', 90, 990, 'blue', { shape: 'rounded', icon: 'tabler:robot' }),

    // 1. Lead Management column
    node('crmj-lead-captured', 'New Lead Captured', 'Lead enters system', 380, 200, 'blue', { shape: 'rounded', icon: 'lucide:user' }),
    node('crmj-enrich', 'Enrich Lead', 'Data, Company, Social', 380, 340, 'blue', { shape: 'rounded', icon: 'sparkles' }),
    node('crmj-score', 'Lead Scoring', 'Fit & engagement', 380, 480, 'amber', { shape: 'diamond', icon: 'play' }),
    node('crmj-nurture', 'Nurture Campaign', 'Email, Content', 380, 640, 'indigo', { shape: 'rounded', icon: 'mail' }),
    node('crmj-rescore', 'Re-score Lead', 'Re-evaluate', 380, 780, 'amber', { shape: 'rounded', icon: 'play' }),

    // 2. Engagement column
    node('crmj-assign', 'Assign to Owner', 'Sales rep', 700, 200, 'blue', { shape: 'rounded', icon: 'lucide:user' }),
    node('crmj-engage', 'Engage', 'Call, Email, Meeting', 700, 340, 'green', { shape: 'rounded', icon: 'bell' }),
    node('crmj-track', 'Track Interaction', 'Log activity', 700, 480, 'green', { shape: 'rounded', icon: 'code' }),
    node('crmj-interested', 'Interested?', 'Decision', 700, 640, 'amber', { shape: 'diamond', icon: 'play' }),

    // 3. Opportunity column
    node('crmj-opp', 'Create Opportunity (Deal)', 'Pipeline entry', 1030, 200, 'blue', { shape: 'rounded', icon: 'send' }),
    node('crmj-define', 'Define Needs & Solution', 'Discovery', 1030, 340, 'green', { shape: 'rounded', icon: 'lucide:workflow' }),
    node('crmj-proposal', 'Proposal / Quote', 'Pricing & terms', 1030, 480, 'green', { shape: 'document', icon: 'send' }),
    node('crmj-neg', 'Negotiation', 'Final terms', 1030, 620, 'green', { shape: 'rounded', icon: 'lucide:webhook' }),
    node('crmj-won', 'Won?', 'Decision', 1030, 760, 'amber', { shape: 'diamond', icon: 'play' }),
    node('crmj-lost', 'Closed Lost', 'End of opportunity', 1030, 900, 'rose', { shape: 'rounded', icon: 'tabler:circle-x' }),

    // 4. Delivery column
    node('crmj-order', 'Create Order', 'Sales order', 1360, 200, 'blue', { shape: 'rounded', icon: 'lucide:workflow' }),
    node('crmj-check', 'Check Inventory', 'Stock check', 1360, 340, 'amber', { shape: 'document', icon: 'database' }),
    node('crmj-stock', 'In Stock?', 'Decision', 1360, 460, 'amber', { shape: 'diamond', icon: 'play' }),
    node('crmj-proc', 'Procurement', 'Request / PO', 1500, 580, 'amber', { shape: 'component', icon: 'send' }),
    node('crmj-fulfill', 'Fulfillment', 'Ship / Deliver', 1360, 700, 'green', { shape: 'component', icon: 'lucide:rocket' }),
    node('crmj-onboard', 'Onboard Customer', 'Setup / Training', 1360, 840, 'green', { shape: 'rounded', icon: 'lucide:user' }),

    // 5. Loyalty column
    node('crmj-success', 'Customer Success', 'Check-in', 1700, 200, 'blue', { shape: 'rounded', icon: 'lucide:user' }),
    node('crmj-feedback', 'Collect Feedback', 'NPS, surveys', 1700, 340, 'green', { shape: 'rounded', icon: 'mail' }),
    node('crmj-issue', 'Issue?', 'Decision', 1700, 460, 'amber', { shape: 'diamond', icon: 'play' }),
    node('crmj-ticket', 'Support / Ticket', 'Resolve', 1840, 580, 'rose', { shape: 'rounded', icon: 'bell' }),
    node('crmj-upsell', 'Upsell / Cross-sell', 'Recommendation', 1700, 720, 'green', { shape: 'rounded', icon: 'sparkles' }),
    node('crmj-renewal', 'Renewal / Loyalty', 'Contract, Reward', 1700, 860, 'green', { shape: 'rounded', icon: 'flag' }),

    // Cross-cutting bars (Automation, Notifications, Approval, Audit)
    node('crmj-auto', 'Automation', 'Workflows, Auto-Assignment', 380, 940, 'rose', { shape: 'pill', icon: 'cog', width: 280 }),
    node('crmj-notif', 'Notifications', 'Email, SMS, In-App', 700, 940, 'rose', { shape: 'pill', icon: 'bell', width: 280 }),
    node('crmj-approval', 'Approval', 'Manager, Discount, Contract', 1030, 940, 'rose', { shape: 'pill', icon: 'tabler:shield', width: 280 }),
    node('crmj-audit', 'Audit & Compliance', 'Logs, Tracking, GDPR', 1360, 940, 'rose', { shape: 'pill', icon: 'lucide:webhook', width: 280 }),

    // Outcomes column (right)
    node('crmj-out-360', 'Customer 360° View', 'Unified customer profile', 2000, 110, 'blue', { shape: 'database', icon: 'database' }),
    node('crmj-out-bi', 'Analytics & Dashboard', 'Reports, KPIs, Forecasting', 2000, 220, 'blue', { shape: 'rounded', icon: 'sparkles' }),
    node('crmj-out-email', 'Email / SMS', 'Notifications, Campaigns', 2000, 330, 'blue', { shape: 'rounded', icon: 'mail' }),
    node('crmj-out-cal', 'Calendar / Reminder', 'Tasks, Follow-ups', 2000, 440, 'blue', { shape: 'rounded', icon: 'tabler:player-play' }),
    node('crmj-out-pay', 'Payment / Billing', 'Invoices, Subscriptions', 2000, 550, 'blue', { shape: 'rounded', icon: 'send' }),
    node('crmj-out-erp', 'ERP / Inventory', 'Sync orders, stock', 2000, 660, 'blue', { shape: 'rounded', icon: 'cog' }),
    node('crmj-out-support', 'Support System', 'Tickets, Knowledge base', 2000, 770, 'blue', { shape: 'rounded', icon: 'bell' }),
    node('crmj-out-dw', 'Data Warehouse', 'BI & Advanced Analytics', 2000, 880, 'blue', { shape: 'database', icon: 'database' }),
    node('crmj-out-ai', 'AI / ML Services', 'Prediction, Recommendation', 2000, 990, 'blue', { shape: 'rounded', icon: 'tabler:robot' }),

    // Capabilities (reusable building blocks) — bottom-left grid
    node('crmj-cap-lead', 'Lead Service', 'Reusable', 90, 1100, 'amber', { shape: 'component', icon: 'lucide:user' }),
    node('crmj-cap-contact', 'Contact Service', 'Reusable', 290, 1100, 'amber', { shape: 'component', icon: 'lucide:user' }),
    node('crmj-cap-account', 'Account Service', 'Reusable', 490, 1100, 'amber', { shape: 'component', icon: 'sparkles' }),
    node('crmj-cap-opp', 'Opportunity Service', 'Reusable', 690, 1100, 'amber', { shape: 'component', icon: 'send' }),
    node('crmj-cap-product', 'Product Service', 'Reusable', 890, 1100, 'amber', { shape: 'component', icon: 'database' }),
    node('crmj-cap-activity', 'Activity Service', 'Reusable', 90, 1200, 'amber', { shape: 'component', icon: 'bell' }),
    node('crmj-cap-email', 'Email Service', 'Reusable', 290, 1200, 'amber', { shape: 'component', icon: 'mail' }),
    node('crmj-cap-camp', 'Campaign Service', 'Reusable', 490, 1200, 'amber', { shape: 'component', icon: 'send' }),
    node('crmj-cap-task', 'Task Service', 'Reusable', 690, 1200, 'amber', { shape: 'component', icon: 'tabler:circle-check' }),
    node('crmj-cap-doc', 'Document Service', 'Reusable', 890, 1200, 'amber', { shape: 'component', icon: 'tabler:code' }),
    node('crmj-cap-pricing', 'Pricing Service', 'Reusable', 90, 1300, 'amber', { shape: 'component', icon: 'send' }),
    node('crmj-cap-order', 'Order Service', 'Reusable', 290, 1300, 'amber', { shape: 'component', icon: 'lucide:workflow' }),
    node('crmj-cap-inv', 'Inventory Service', 'Reusable', 490, 1300, 'amber', { shape: 'component', icon: 'database' }),
    node('crmj-cap-pay', 'Payment Service', 'Reusable', 690, 1300, 'amber', { shape: 'component', icon: 'send' }),
    node('crmj-cap-an', 'Analytics Service', 'Reusable', 890, 1300, 'amber', { shape: 'component', icon: 'sparkles' }),

    // Policies (cross-cutting rules) — bottom-middle grid
    node('crmj-pol-auth', 'Authorization', 'Roles, Permissions', 1090, 1100, 'rose', { shape: 'pill', icon: 'tabler:shield' }),
    node('crmj-pol-val', 'Validation', 'Business Rules', 1290, 1100, 'rose', { shape: 'pill', icon: 'tabler:circle-check' }),
    node('crmj-pol-sec', 'Security', 'Auth, 2FA', 1490, 1100, 'rose', { shape: 'pill', icon: 'tabler:shield' }),
    node('crmj-pol-rate', 'Rate Limit', 'API, System', 1690, 1100, 'rose', { shape: 'pill', icon: 'lucide:zap' }),
    node('crmj-pol-priv', 'Data Privacy', 'GDPR, Consent', 1090, 1200, 'rose', { shape: 'pill', icon: 'tabler:shield' }),
    node('crmj-pol-audit', 'Audit Policy', 'Track & Trace', 1290, 1200, 'rose', { shape: 'pill', icon: 'code' }),
    node('crmj-pol-ret', 'Retention Policy', 'Data Lifecycle', 1490, 1200, 'rose', { shape: 'pill', icon: 'database' }),
    node('crmj-pol-app', 'Approval Policy', 'Threshold Rules', 1690, 1200, 'rose', { shape: 'pill', icon: 'tabler:shield' }),

    // Runtime — bottom-right grid
    node('crmj-rt-engine', 'Workflow Engine', 'Orchestration', 1090, 1300, 'indigo', { shape: 'rounded', icon: 'lucide:workflow' }),
    node('crmj-rt-rule', 'Rule Engine', 'Business Rules', 1290, 1300, 'indigo', { shape: 'rounded', icon: 'cog' }),
    node('crmj-rt-bus', 'Event Bus', 'Messaging', 1490, 1300, 'indigo', { shape: 'queue', icon: 'tabler:route' }),
    node('crmj-rt-sched', 'Scheduler', 'Jobs, Delays', 1690, 1300, 'indigo', { shape: 'rounded', icon: 'tabler:player-play' }),
    node('crmj-rt-mon', 'Monitoring', 'Health, Alerts', 1090, 1400, 'indigo', { shape: 'rounded', icon: 'bell' }),
    node('crmj-rt-log', 'Logging', 'Centralized Logs', 1290, 1400, 'indigo', { shape: 'rounded', icon: 'code' }),
    node('crmj-rt-trace', 'Tracing', 'Distributed Tracing', 1490, 1400, 'indigo', { shape: 'rounded', icon: 'lucide:webhook' }),
    node('crmj-rt-scale', 'Scaling', 'Auto Scale', 1690, 1400, 'indigo', { shape: 'rounded', icon: 'lucide:workflow' }),

    // Infrastructure footer
    node('crmj-inf-k8s', 'Kubernetes', 'Container Orchestration', 90, 1500, 'blue', { shape: 'hexagon', icon: 'lucide:webhook', width: 200 }),
    node('crmj-inf-microsvc', 'Microservices', 'Independent Services', 310, 1500, 'blue', { shape: 'component', icon: 'cog', width: 200 }),
    node('crmj-inf-db', 'Database', 'SQL / NoSQL', 530, 1500, 'blue', { shape: 'database', icon: 'database', width: 200 }),
    node('crmj-inf-cache', 'Redis Cache', 'Caching Layer', 750, 1500, 'blue', { shape: 'database', icon: 'database', width: 200 }),
    node('crmj-inf-mq', 'Message Broker', 'Kafka / RabbitMQ', 970, 1500, 'blue', { shape: 'queue', icon: 'tabler:route', width: 200 }),
    node('crmj-inf-store', 'Storage', 'S3 / Blob', 1190, 1500, 'blue', { shape: 'cloud', icon: 'cloud', width: 200 }),
    node('crmj-inf-cdn', 'CDN', 'Global Delivery', 1410, 1500, 'blue', { shape: 'cloud', icon: 'cloud', width: 200 }),
    node('crmj-inf-cicd', 'CI / CD', 'DevOps Pipeline', 1630, 1500, 'blue', { shape: 'rounded', icon: 'lucide:rocket', width: 200 }),
  ],
  edges: [
    // Triggers → Lead captured
    edge('crmj-t1', 'crmj-trig-web', 'crmj-lead-captured', undefined, 'flow'),
    edge('crmj-t2', 'crmj-trig-email', 'crmj-lead-captured', undefined, 'flow'),
    edge('crmj-t3', 'crmj-trig-phone', 'crmj-lead-captured', undefined, 'flow'),
    edge('crmj-t4', 'crmj-trig-social', 'crmj-lead-captured', undefined, 'flow'),
    edge('crmj-t5', 'crmj-trig-chat', 'crmj-lead-captured', undefined, 'flow'),
    edge('crmj-t6', 'crmj-trig-camp', 'crmj-lead-captured', undefined, 'flow'),
    edge('crmj-t7', 'crmj-trig-partner', 'crmj-lead-captured', undefined, 'flow'),
    edge('crmj-t8', 'crmj-trig-sched', 'crmj-lead-captured', undefined, 'flow'),
    edge('crmj-t9', 'crmj-trig-ai', 'crmj-lead-captured', undefined, 'flow'),

    // 1. Lead management chain
    edge('crmj-l1', 'crmj-lead-captured', 'crmj-enrich', undefined, 'flow'),
    edge('crmj-l2', 'crmj-enrich', 'crmj-score', undefined, 'flow'),
    edge('crmj-l3', 'crmj-score', 'crmj-assign', 'qualified', 'flow'),
    edge('crmj-l4', 'crmj-score', 'crmj-nurture', 'no', 'flow'),
    edge('crmj-l5', 'crmj-nurture', 'crmj-rescore', undefined, 'flow'),
    edge('crmj-l6', 'crmj-rescore', 'crmj-score', undefined, 'flow'),

    // 2. Engagement chain
    edge('crmj-e1', 'crmj-assign', 'crmj-engage', undefined, 'flow'),
    edge('crmj-e2', 'crmj-engage', 'crmj-track', undefined, 'flow'),
    edge('crmj-e3', 'crmj-track', 'crmj-interested', undefined, 'flow'),
    edge('crmj-e4', 'crmj-interested', 'crmj-opp', 'yes', 'flow'),
    edge('crmj-e5', 'crmj-interested', 'crmj-nurture', 'no', 'flow'),

    // 3. Opportunity chain
    edge('crmj-op1', 'crmj-opp', 'crmj-define', undefined, 'flow'),
    edge('crmj-op2', 'crmj-define', 'crmj-proposal', undefined, 'flow'),
    edge('crmj-op3', 'crmj-proposal', 'crmj-neg', undefined, 'flow'),
    edge('crmj-op4', 'crmj-neg', 'crmj-won', undefined, 'flow'),
    edge('crmj-op5', 'crmj-won', 'crmj-order', 'yes', 'flow'),
    edge('crmj-op6', 'crmj-won', 'crmj-lost', 'no', 'flow'),

    // 4. Delivery chain
    edge('crmj-d1', 'crmj-order', 'crmj-check', undefined, 'flow'),
    edge('crmj-d2', 'crmj-check', 'crmj-stock', undefined, 'flow'),
    edge('crmj-d3', 'crmj-stock', 'crmj-fulfill', 'yes', 'flow'),
    edge('crmj-d4', 'crmj-stock', 'crmj-proc', 'no', 'flow'),
    edge('crmj-d5', 'crmj-proc', 'crmj-fulfill', undefined, 'flow'),
    edge('crmj-d6', 'crmj-fulfill', 'crmj-onboard', undefined, 'flow'),

    // 5. Loyalty chain
    edge('crmj-ly1', 'crmj-onboard', 'crmj-success', undefined, 'flow'),
    edge('crmj-ly2', 'crmj-success', 'crmj-feedback', undefined, 'flow'),
    edge('crmj-ly3', 'crmj-feedback', 'crmj-issue', undefined, 'flow'),
    edge('crmj-ly4', 'crmj-issue', 'crmj-ticket', 'yes', 'flow'),
    edge('crmj-ly5', 'crmj-issue', 'crmj-upsell', 'no', 'flow'),
    edge('crmj-ly6', 'crmj-upsell', 'crmj-renewal', undefined, 'flow'),

    // Cross-cutting bar injections
    edge('crmj-x1', 'crmj-auto', 'crmj-score', undefined, 'wave'),
    edge('crmj-x2', 'crmj-notif', 'crmj-engage', undefined, 'wave'),
    edge('crmj-x3', 'crmj-approval', 'crmj-proposal', undefined, 'wave'),
    edge('crmj-x4', 'crmj-audit', 'crmj-onboard', undefined, 'wave'),
  ],
};

const networkDocument: FlowDocumentJSON = {
  nodes: [
    node('net-users', 'Remote Users', 'Employees & partners', 90, 100, 'blue', { type: 'start', icon: 'lucide:user' }),
    node('net-internet', 'Internet', 'Public network', 90, 330, 'blue', { type: 'start', shape: 'cloud', icon: 'tabler:world' }),
    node('net-vpn', 'VPN Gateway', 'Secure remote access', 380, 100, 'violet', { shape: 'hexagon', icon: 'lucide:webhook' }),
    node('net-dns', 'DNS', 'Public name resolution', 380, 330, 'violet', { shape: 'pill', icon: 'tabler:world' }),
    node('net-firewall', 'Firewall / WAF', 'Traffic inspection', 670, 215, 'rose', { shape: 'hexagon', icon: 'lucide:webhook' }),
    node('net-lb', 'Load Balancer', 'L7 routing', 960, 80, 'indigo', { shape: 'hexagon', icon: 'tabler:route' }),
    node('net-bastion', 'Bastion Host', 'Admin access', 960, 350, 'amber', { shape: 'server', icon: 'code' }),
    node('net-web', 'Web Subnet', 'Public web tier', 1250, 80, 'green', { shape: 'server', icon: 'code' }),
    node('net-app', 'Application Subnet', 'Private services', 1250, 215, 'green', { shape: 'component', icon: 'lucide:workflow', width: 190 }),
    node('net-db', 'Database Subnet', 'Isolated data tier', 1250, 350, 'amber', { shape: 'database', icon: 'database', width: 190 }),
    node('net-nat', 'NAT Gateway', 'Outbound traffic', 1540, 80, 'violet', { shape: 'hexagon', icon: 'tabler:route' }),
    node('net-monitor', 'Network Monitoring', 'Flow logs & alerts', 1540, 350, 'blue', { type: 'output', shape: 'server', icon: 'bell', width: 190 }),
  ],
  edges: [
    edge('net-e1', 'net-users', 'net-vpn', 'encrypted', 'glow'),
    edge('net-e2', 'net-internet', 'net-dns', 'DNS', 'dots'),
    edge('net-e3', 'net-dns', 'net-firewall', 'HTTPS', 'traffic'),
    edge('net-e4', 'net-vpn', 'net-firewall', 'private route'),
    edge('net-e5', 'net-firewall', 'net-lb', 'allowed', 'scanner'),
    edge('net-e6', 'net-firewall', 'net-bastion', 'admin'),
    edge('net-e7', 'net-lb', 'net-web', 'balance', 'dots'),
    edge('net-e8', 'net-web', 'net-app', 'API'),
    edge('net-e9', 'net-app', 'net-db', 'SQL', 'pulse'),
    edge('net-e10', 'net-web', 'net-nat', 'egress'),
    edge('net-e11', 'net-db', 'net-monitor', 'flow logs', 'wave'),
    edge('net-e12', 'net-firewall', 'net-monitor', 'security logs', 'dots'),
  ],
};

export const diagramTemplates: DiagramTemplate[] = [
  {
    id: 'software-architecture',
    name: 'Software Architecture',
    category: 'Technology',
    description: 'Cloud-native services, data stores and infrastructure.',
    document: initialDocument,
  },
  {
    id: 'erp',
    name: 'ERP System',
    category: 'Enterprise',
    description: 'Sales, finance, HR, procurement and warehouse modules.',
    document: erpDocument,
  },
  {
    id: 'crm',
    name: 'CRM Lifecycle',
    category: 'Enterprise',
    description: 'Lead capture, qualification, pipeline and customer success.',
    document: crmDocument,
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Platform',
    category: 'Product',
    description: 'Storefront, checkout, orders, fulfillment and analytics.',
    document: ecommerceDocument,
  },
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    category: 'Data',
    description: 'Batch and streaming ingestion through warehouse activation.',
    document: dataPipelineDocument,
  },
  {
    id: 'cicd',
    name: 'CI/CD Pipeline',
    category: 'DevOps',
    description: 'Build, test, security gates, deployment and observability.',
    document: cicdDocument,
  },
  {
    id: 'network',
    name: 'Network Topology',
    category: 'Infrastructure',
    description: 'Gateways, security layers, subnets and network monitoring.',
    document: networkDocument,
  },
  {
    id: 'flowx-architecture',
    name: 'FlowX Architecture (Simplified)',
    category: 'Flow Platform',
    description: 'Trigger, Flow, Capability, Policy, Runtime and FlowX Platform.',
    document: flowxArchDocument,
  },
  {
    id: 'flowx-example',
    name: 'FlowX – Example Usage',
    category: 'Flow Platform',
    description: 'Code-first OrderFlow: triggers, steps, policies and runtime.',
    document: flowxExampleDocument,
  },
  {
    id: 'crm-customer-journey',
    name: 'CRM Sample – Customer Journey',
    category: 'Enterprise',
    description: 'Lead → Engagement → Opportunity → Delivery → Loyalty with capabilities, policies, runtime and infrastructure.',
    document: crmJourneyDocument,
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
