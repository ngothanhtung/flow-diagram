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
    icon?: NodeIcon;
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
    shape: options.shape ?? 'rounded',
    color: paint.color,
    backgroundColor: paint.background,
    borderColor: paint.color,
    borderWidth: 1.5,
    shadow: 'soft',
    icon: options.icon ?? 'cog',
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
