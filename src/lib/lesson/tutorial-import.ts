// Converts one lesson of the sibling project system-design-tutorials
// (`backend/data/lessons/<id>.json`) into a Lesson (spec §10). Pure: the
// caller reads the files and supplies translation and metric formatting.
//
// The source draws a fresh isometric scene for every step. Here a Lesson
// is one Diagram whose Elements appear and disappear per Lesson step, so:
//  - the ground plane (x, y) becomes the 2D plan, `position = (x·S, y·S)`
//    (tutorial-layout.ts picks S and clears any overlap that is left);
//  - an entity that looks different in some steps (label, colour, tags,
//    place…) becomes one Element per distinct look — a *variant* — shown
//    through `presence` (plus `visible` overrides for gaps) only in its
//    own steps; a link does the same, attached to whichever variant of its
//    ends is shown;
//  - a link's flows become its Effect: the most common flow is the base,
//    a step with another flow or with none overrides `effect` (`none`
//    keeps a quiet line static).

import type { EdgeEffect, EdgeMarker, FlowDocumentJSON, FlowEdge, FlowNode, NodeIcon, NodeShape } from '../flowchart-types';
import { type CalloutKind, type ElementOverride, type ElementPresence, type LessonChapter, type LessonDocumentJSON, type LessonLevel, type LessonStep, LESSON_CHAPTERS, LESSON_LEVELS, toLessonDocument } from './lesson-types';
import { GRID, cardSize, placeScene, snapCenter, snapSize, textSize, type PlacementInput, type Point, type Size } from './tutorial-layout';

export interface TutorialImportOptions {
  /** EN source text → its translation; return the input when there is none. Default: identity. */
  translate?: (text: string) => string;
  /** Label of a metric id (`METRIC_DEFS[id].label`, translated). */
  metricLabel: (id: string) => string;
  /** A metric value as shown; `''` when there is none (null, undefined, '—'). */
  formatMetric: (id: string, value: unknown) => string;
}

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const finite = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// ---------------------------------------------------------------------------
// Narration

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', larr: '←', harr: '↔', uarr: '↑', darr: '↓',
  mdash: '—', ndash: '–', hellip: '…', times: '×', middot: '·', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  le: '≤', ge: '≥', ne: '≠', asymp: '≈', plusmn: '±', deg: '°', micro: 'µ', bull: '•', check: '✓',
};

function decodeEntities(source: string): string {
  return source.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

// Sentinels for breaks, so whitespace in the markup can be collapsed first.
const LINE = '\u0000';
const PARAGRAPH = '\u0001';

const MARKERS: Record<string, string> = { b: '**', strong: '**', em: '*', i: '*', code: '`' };

function tableToText(html: string): string {
  const rows: string[][] = [];
  let header: string[] | null = null;
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(t[hd])[^>]*>([\s\S]*?)<\/\1>/gi)];
    const values = cells.map((cell) => inlineText(cell[2]));
    if (header === null && cells.some((cell) => cell[1].toLowerCase() === 'th')) header = values;
    else rows.push(values);
  }
  return rows
    .map(([first = '', ...rest]) => {
      const details = rest.map((value, index) => (header?.[index + 1] ? `${header[index + 1]}: ${value}` : value)).filter((value) => value.trim() !== '');
      return `• ${[first, details.join('; ')].filter(Boolean).join(' — ')}`;
    })
    .join(LINE);
}

function inlineText(html: string): string {
  return convertHtml(html).replace(new RegExp(`[${LINE}${PARAGRAPH}]+`, 'g'), ' ').trim();
}

function convertHtml(html: string): string {
  let out = '';
  // Open elements; `close` is the marker to write when one closes (null for plain tags and for any marker opened inside another).
  const open: { tag: string; close: string | null }[] = [];
  const lists: { ordered: boolean; count: number }[] = [];
  const markerOpen = () => open.some((entry) => entry.close !== null);
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|[^<]+|</g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(html))) {
    const [whole, closing, rawTag, attributes] = match;
    if (whole.startsWith('<!--')) continue;
    if (rawTag === undefined) {
      out += decodeEntities(whole.replace(/\s+/g, ' '));
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (tag === 'table' && !closing) {
      const end = html.toLowerCase().indexOf('</table>', token.lastIndex);
      const stop = end < 0 ? html.length : end + '</table>'.length;
      out += PARAGRAPH + tableToText(html.slice(match.index, stop)) + PARAGRAPH;
      token.lastIndex = stop;
      continue;
    }
    if (closing) {
      const index = open.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) {
        for (const entry of open.splice(index).reverse()) if (entry.close) out += entry.close;
      }
      if (tag === 'ul' || tag === 'ol') {
        lists.pop();
        out += PARAGRAPH;
      } else if (tag === 'p' || tag === 'div') out += PARAGRAPH;
      continue;
    }
    if (tag === 'br') {
      out += LINE;
      continue;
    }
    if (tag === 'p' || tag === 'div') {
      out += PARAGRAPH;
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      lists.push({ ordered: tag === 'ol', count: 0 });
      out += PARAGRAPH;
      continue;
    }
    if (tag === 'li') {
      const current = lists.at(-1);
      if (current) current.count += 1;
      out += `${LINE}${current?.ordered ? `${current.count}. ` : '• '}`;
      continue;
    }
    let marker: string | null = null;
    if (tag === 'span' && /class\s*=\s*["'][^"']*\bterm\b/i.test(attributes)) marker = '[[';
    else if (Object.hasOwn(MARKERS, tag)) marker = MARKERS[tag];
    if (marker === null) {
      if (!/\/\s*$/.test(attributes)) open.push({ tag, close: null });
      continue;
    }
    if (markerOpen()) {
      open.push({ tag, close: null });
      continue;
    }
    out += marker;
    open.push({ tag, close: marker === '[[' ? ']]' : marker });
  }
  for (const entry of open.reverse()) if (entry.close) out += entry.close;
  return out;
}

/**
 * Source HTML → Narration markup: `<span class="term">` → `[[…]]`, `<b>`/
 * `<strong>` → `**…**`, `<em>`/`<i>` → `*…*`, `<code>` → `` `…` ``; list
 * items become `•` lines, a table one `•` line per row; any other tag is
 * dropped and entities are decoded. A marker inside another one is left
 * out (Narration markup doesn't nest).
 */
export function narrationFromHtml(html: string): string {
  const converted = convertHtml(html);
  const paragraphs = converted
    .split(PARAGRAPH)
    .map((paragraph) =>
      paragraph
        .split(LINE)
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean);
  return paragraphs.join('\n\n');
}

// ---------------------------------------------------------------------------
// Looks: what one entity shows in one step

type Paint = { color: `#${string}`; backgroundColor: `#${string}`; borderColor: `#${string}` };

const PAINTS: Record<string, Paint> = {
  blue: { color: '#91caff', backgroundColor: '#0b2a5b', borderColor: '#4096ff' },
  purple: { color: '#d3adf7', backgroundColor: '#22075e', borderColor: '#9254de' },
  green: { color: '#b7eb8f', backgroundColor: '#0f2e05', borderColor: '#73d13d' },
  orange: { color: '#ffd591', backgroundColor: '#4d2000', borderColor: '#fa8c16' },
  yellow: { color: '#fffb8f', backgroundColor: '#3d3300', borderColor: '#d4b106' },
  slab: { color: '#d9d9d9', backgroundColor: '#262626', borderColor: '#8c8c8c' },
  store: { color: '#87e8de', backgroundColor: '#002329', borderColor: '#36cfc9' },
  crowd: { color: '#e5e7eb', backgroundColor: '#1f2937', borderColor: '#9ca3af' },
  ghost: { color: '#bfbfbf', backgroundColor: '#141414', borderColor: '#8c8c8c' },
  dead: { color: '#8c8c8c', backgroundColor: '#1f1f1f', borderColor: '#ff4d4f' },
};
const HOT_BORDER = '#ff4d4f';
// Frames (zones, panels, the ring) are drawn faint and carry no text of
// their own: a frame's wash is translucent, so text on it can't read well on
// both a light and a dark canvas. Their words are free text objects in a
// mid slate, legible on either.
const FRAME_PAINT: Paint = { color: '#6b7a90', backgroundColor: '#64748b', borderColor: '#64748b' };
const PANEL_PAINT = FRAME_PAINT;
const FRAME_OPACITY = 0.45;
const TEXT_INK = '#6b7a90';
const LABEL_SIZE = 12;
const PANEL_TEXT_SIZE = 13;
const LINE_INK = '#64748b';

function paintOf(value: unknown, fallback: Paint): Paint {
  if (typeof value === 'string' && Object.hasOwn(PAINTS, value)) return PAINTS[value];
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
    const dark = (offset: number) => Math.round(parseInt(value.slice(offset, offset + 2), 16) * 0.2).toString(16).padStart(2, '0');
    return { color: value as `#${string}`, backgroundColor: `#${dark(1)}${dark(3)}${dark(5)}`, borderColor: value as `#${string}` };
  }
  return fallback;
}

/** Source glyph → Lucide icon. A glyph not listed falls back to a server. */
export const GLYPH_ICONS: Record<string, string> = {
  server: 'Server', database: 'Database', creditCard: 'CreditCard', zap: 'Zap', cart: 'ShoppingCart', globe: 'Globe',
  balancer: 'Split', file: 'File', user: 'User', users: 'Users', video: 'Video', package: 'Package', shield: 'Shield',
  chart: 'ChartColumn', cpu: 'Cpu', network: 'Network', signpost: 'Signpost', listOrdered: 'ListOrdered', route: 'Route',
  workflow: 'Workflow', message: 'MessageSquare', car: 'Car', chartLine: 'ChartLine', box: 'Box', keyhole: 'LockKeyhole',
  ticket: 'Ticket', radio: 'Radio', gauge: 'Gauge', flask: 'FlaskConical', waves: 'WavesHorizontal', mail: 'Mail',
  plane: 'Plane', hotel: 'Hotel', wifi: 'Wifi', gift: 'Gift', braces: 'Braces', scroll: 'Scroll', activity: 'Activity',
  layers: 'Layers', hash: 'Hash', boxes: 'Boxes', inbox: 'Inbox', bell: 'Bell', key: 'Key', unplug: 'Unplug',
  gitBranch: 'GitBranch', hammer: 'Hammer', idCard: 'IdCard', share: 'Share2', clock: 'Clock', search: 'Search',
  clipboard: 'Clipboard', settings: 'Settings', skull: 'Skull', toggle: 'ToggleRight', refresh: 'RefreshCw',
  lock: 'Lock', smartphone: 'Smartphone', laptop: 'Laptop', alert: 'TriangleAlert', timer: 'Timer',
};

function iconOf(glyph: unknown, fallback: NodeIcon | null = 'lucide:Server'): NodeIcon | null {
  if (glyph === undefined) return fallback;
  if (typeof glyph !== 'string' || glyph === '') return null;
  return `lucide:${Object.hasOwn(GLYPH_ICONS, glyph) ? GLYPH_ICONS[glyph] : 'Server'}`;
}

const TAG_MARKS: Record<string, string> = { alert: '⚠ ', check: '✓ ' };
const PANEL_MARKS: Record<string, string> = { '!': '⚠ ', '=': '→ ', '#': '# ' };

type LookKind = 'card' | 'zone' | 'frame' | 'ring' | 'panel';

interface Look {
  kind: LookKind;
  title: string;
  description: string;
  icon: NodeIcon | null;
  shape: NodeShape;
  paint: Paint;
  dashed: boolean;
  hot: boolean;
  opacity?: number;
  /** Centre in source units. */
  ux: number;
  uy: number;
  /** Footprint in source units, when the source gives one. */
  foot?: { w: number; h: number };
  lines?: string[];
  /** A ring's key or virtual node: this glyph as a small coloured text object. */
  dot?: string;
}

// ---------------------------------------------------------------------------
// Flows

interface FlowLook {
  effect: EdgeEffect;
  color: `#${string}`;
  speed?: number;
  size?: number;
}

/** One kind of traffic per source flow kind; `req` is a flow without one. */
const FLOW_LOOKS: Record<string, FlowLook> = {
  req: { effect: 'comet', color: '#ffbb96' },
  write: { effect: 'dots', color: '#d3adf7', size: 1.6 },
  msg: { effect: 'convoy', color: '#ffe58f' },
  mine: { effect: 'chase', color: '#87e8de' },
  heavy: { effect: 'pulse', color: '#ff9c6e', size: 1.6 },
  ping: { effect: 'heartbeat', color: '#b7eb8f' },
  poison: { effect: 'blink', color: '#ff85c0' },
  slow: { effect: 'ants', color: '#ffd591', speed: 0.5 },
  kill: { effect: 'laser', color: '#ff4d4f' },
  empty: { effect: 'morse', color: '#bfbfbf' },
  push: { effect: 'meteor', color: '#95de64' },
};
const TRAVELLING: ReadonlySet<EdgeEffect> = new Set<EdgeEffect>(['comet', 'pulse', 'dots', 'laser', 'meteor', 'convoy', 'chase']);

interface FlowOnLink {
  kind: string;
  bounce: boolean;
  reverse: boolean;
  speed?: number;
  rate?: number;
}

function flowKind(flow: Raw): string {
  const kind = text(flow.kind);
  if (kind && Object.hasOwn(FLOW_LOOKS, kind)) return kind;
  const pattern = list(flow.pattern).find((entry): entry is string => typeof entry === 'string' && entry !== 'req' && Object.hasOwn(FLOW_LOOKS, entry));
  return pattern ?? 'req';
}

/** Which way each link of a step's flows is travelled, and by what. The first flow on a link wins. */
function flowsOnLinks(flows: unknown, links: Raw): Map<string, FlowOnLink> {
  const result = new Map<string, FlowOnLink>();
  const ends = (id: string): [string, string] | null => {
    const link = links[id];
    return isRecord(link) ? [text(link.from), text(link.to)] : null;
  };
  for (const flow of list(flows)) {
    if (!isRecord(flow)) continue;
    const routes: unknown[][] = Array.isArray(flow.route)
      ? [flow.route]
      : list(flow.routes).map((route) => (Array.isArray(route) ? route : isRecord(route) ? list(route.path) : []));
    for (const route of routes) {
      // A branch hop lists alternatives; `weights` (one per alternative) can leave one out entirely.
      const weights = list(flow.weights);
      const hops = route.map((hop) =>
        (Array.isArray(hop) ? hop : [hop]).filter((id, index, all): id is string => typeof id === 'string' && ends(id) !== null && !(all.length > 1 && weights.length === all.length && weights[index] === 0)),
      );
      let at: Set<string> | null = null;
      hops.forEach((alternatives, index) => {
        const next = new Set<string>();
        for (const id of alternatives) {
          const [from, to] = ends(id) as [string, string];
          let reverse: boolean;
          if (at === null) {
            const following = new Set((hops[index + 1] ?? []).flatMap((other) => ends(other) ?? []));
            reverse = following.has(from) && !following.has(to);
          } else reverse = !at.has(from) && at.has(to);
          next.add(reverse ? from : to);
          if (!result.has(id)) result.set(id, { kind: flowKind(flow), bounce: flow.bounce === true, reverse, speed: finite(flow.speed), rate: finite(flow.rate) });
        }
        at = next;
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Variants

interface Variant<T> {
  id: string;
  sourceId: string;
  value: T;
  steps: number[];
}

/** Groups an element's per-step values by signature; the first variant keeps the source id. */
function collectVariants<T>(perStep: Map<string, Map<number, T>>, ids: { claim: (wanted: string) => string }, signature: (value: T) => string): Variant<T>[] {
  const variants: Variant<T>[] = [];
  for (const [sourceId, steps] of perStep) {
    const bySignature = new Map<string, Variant<T>>();
    for (const [step, value] of [...steps].sort((a, b) => a[0] - b[0])) {
      const key = signature(value);
      let variant = bySignature.get(key);
      if (!variant) {
        variant = { id: ids.claim(bySignature.size === 0 ? sourceId : `${sourceId}-${bySignature.size + 1}`), sourceId, value, steps: [] };
        bySignature.set(key, variant);
        variants.push(variant);
      }
      variant.steps.push(step);
    }
  }
  return variants;
}

function idRegistry(reserved: Iterable<string>) {
  const taken = new Set<string>();
  const reservedSet = new Set(reserved);
  return {
    claim(wanted: string): string {
      let id = wanted;
      let n = 2;
      while (taken.has(id) || (id !== wanted && reservedSet.has(id))) id = `${wanted}~${n++}`;
      taken.add(id);
      return id;
    },
  };
}

// ---------------------------------------------------------------------------

const CALLOUTS: Record<string, CalloutKind> = { insight: 'insight', tip: 'tip', warn: 'warning', warning: 'warning', next: 'tip' };
const GAP = 40;
const PANEL_GAP = 80;
const FRAME_PADDING = 28;
/** A frame's smallest side (`nodeSizeLimits`). */
const FRAME_MIN = 120;

/** Converts one tutorials lesson; see the top of this file. Never throws on odd input — what can't be read is left out. */
export function convertTutorialLesson(raw: unknown, options: TutorialImportOptions): LessonDocumentJSON {
  const source: Raw = isRecord(raw) ? raw : {};
  const tr = options.translate ?? ((value: string) => value);
  // A translation keyed without the line's leading sign/marker ("+ ", "! "…).
  const trLine = (value: string): string => {
    const whole = tr(value);
    if (whole !== value) return whole;
    const match = /^(\s*[+~\-−!=#]\s+)([\s\S]+)$/.exec(value);
    if (!match) return value;
    const rest = tr(match[2]);
    return rest === match[2] ? value : match[1] + rest;
  };
  const labelOf = (value: unknown): string => {
    if (typeof value === 'string') return tr(value).replace(/\s*\n\s*/g, ' ');
    const parts = list(value).filter((part): part is string => typeof part === 'string');
    if (parts.length === 0) return '';
    const joined = tr(parts.join('\n'));
    return (joined !== parts.join('\n') ? joined.split('\n') : parts.map((part) => tr(part))).join(' ').trim();
  };

  const rawSteps = list(source.steps).filter(isRecord);
  const stepIds = rawSteps.map((_, index) => `s${index + 1}`);
  const scenes = rawSteps.map((step) => (isRecord(step.scene) ? step.scene : {}));
  const entitiesOf = (index: number): Raw => (isRecord(scenes[index].entities) ? (scenes[index].entities as Raw) : {});
  const linksOf = (index: number): Raw => (isRecord(scenes[index].links) ? (scenes[index].links as Raw) : {});

  // ---- Looks per entity per step -----------------------------------------
  const tagsText = (value: unknown): string[] =>
    list(value)
      .map((tag) => {
        if (typeof tag === 'string') return tr(tag);
        if (!isRecord(tag) || !text(tag.text)) return '';
        return (TAG_MARKS[text(tag.icon)] ?? '') + tr(text(tag.text));
      })
      .filter(Boolean);

  const lookOf = (entity: Raw, others: Raw[]): Look | null => {
    const type = text(entity.type);
    const x = finite(entity.x) ?? 0;
    const y = finite(entity.y) ?? 0;
    const base = { title: '', description: '', icon: null, shape: 'rounded' as NodeShape, dashed: false, hot: false };
    // Sub title, tags and load in one line; with no label of its own, the first of them names the card.
    const named = (label: unknown, extra: string[] = []) => {
      const parts = [text(entity.sub) ? tr(text(entity.sub)) : '', ...tagsText(entity.tags), ...extra].filter(Boolean);
      const title = labelOf(label);
      return title || parts.length === 0 ? { title, description: parts.join(' · ') } : { title: parts[0], description: parts.slice(1).join(' · ') };
    };
    const cpu = finite(entity.cpu);
    const load = cpu !== undefined && cpu > 0 ? [`CPU ${Math.round(cpu * 100)}%`] : [];
    const dead = (finite(entity.dead) ?? 0) >= 0.5;
    const hot = !dead && (finite(entity.heat) ?? 0) >= 0.5;
    const dim = entity.dim === true || (finite(entity.dim) ?? 0) > 0 ? 0.45 : undefined;
    switch (type) {
      case 'block': {
        const s = finite(entity.s);
        return { ...base, kind: 'card', ...named(entity.label, load), icon: iconOf(entity.glyph), paint: dead ? PAINTS.dead : paintOf(entity.color, PAINTS.blue), dashed: dead, hot, opacity: dim, ux: x, uy: y, foot: s !== undefined ? { w: s, h: s * 0.6 } : undefined };
      }
      case 'db': {
        const r = finite(entity.r);
        return { ...base, kind: 'card', shape: 'database', ...named(entity.label, load), icon: iconOf(entity.glyph, 'lucide:Database'), paint: dead ? PAINTS.dead : paintOf(entity.color, PAINTS.store), dashed: dead, hot, opacity: dim, ux: x, uy: y, foot: r !== undefined ? { w: 2 * r, h: 1.2 * r } : undefined };
      }
      case 'device':
        return { ...base, kind: 'card', ...named(entity.label), icon: entity.form === 'phone' ? 'lucide:Smartphone' : 'lucide:Laptop', paint: PAINTS.slab, opacity: finite(entity.opacity) !== undefined && (entity.opacity as number) < 1 ? (entity.opacity as number) : undefined, ux: x, uy: y };
      case 'crowd': {
        const [x0, x1, y0, y1] = [finite(entity.x0) ?? 0, finite(entity.x1) ?? 0, finite(entity.y0) ?? 0, finite(entity.y1) ?? 0];
        return { ...base, kind: 'card', title: labelOf(entity.label), icon: 'lucide:Users', paint: PAINTS.crowd, dashed: true, ux: (x0 + x1) / 2, uy: (y0 + y1) / 2 };
      }
      case 'queue': {
        const n = Math.max(1, Math.min(8, Math.round(finite(entity.n) ?? 3)));
        return { ...base, kind: 'card', shape: 'queue', title: Array.from({ length: n }, () => '▮').join(' '), paint: paintOf(entity.color, PAINTS.slab), ux: x, uy: y };
      }
      case 'ghost': {
        const s = finite(entity.s) ?? 4;
        const holds = others.some((other) => other !== entity && Math.abs((finite(other.x) ?? Infinity) - x) < s / 2 && Math.abs((finite(other.y) ?? Infinity) - y) < s / 2);
        return { ...base, kind: holds ? 'frame' : 'card', title: labelOf(entity.label), paint: PAINTS.ghost, dashed: true, opacity: holds ? undefined : 0.75, ux: x, uy: y, foot: { w: s, h: holds ? s : s * 0.6 } };
      }
      case 'zone': {
        const [x0, x1, y0, y1] = [finite(entity.x0) ?? 0, finite(entity.x1) ?? 0, finite(entity.y0) ?? 0, finite(entity.y1) ?? 0];
        return { ...base, kind: 'zone', title: labelOf(entity.label), paint: FRAME_PAINT, dashed: true, ux: (x0 + x1) / 2, uy: (y0 + y1) / 2, foot: { w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) } };
      }
      case 'ring': {
        const r = finite(entity.r) ?? 8;
        return { ...base, kind: 'ring', shape: 'circle', title: labelOf(entity.label), paint: FRAME_PAINT, ux: x, uy: y, foot: { w: 2 * r, h: 2 * r } };
      }
      case 'panel':
        // Upper case, as the source shows it, so the first line reads as the panel's heading.
        return { ...base, kind: 'panel', title: tr(text(entity.title)).toUpperCase(), paint: PANEL_PAINT, ux: x, uy: y, lines: panelLines(entity) };
      default:
        return null;
    }
  };

  const panelLines = (entity: Raw): string[] => {
    const lines = list(entity.lines)
      .filter((line): line is string => typeof line === 'string')
      .map((line) => {
        const translated = trLine(line);
        const mark = /^([!=#]) /.exec(translated);
        return mark ? PANEL_MARKS[mark[1]] + translated.slice(2) : translated;
      });
    const bars = list(entity.bars).filter(isRecord);
    if (bars.length > 0) {
      const labels = bars.map((bar) => tr(text(bar.label)));
      const width = Math.max(...labels.map((label) => label.length));
      bars.forEach((bar, index) => {
        const filled = Math.max(0, Math.min(12, Math.round((finite(bar.to) ?? 0) * 12)));
        lines.push(`${labels[index].padEnd(width)}  ${'█'.repeat(filled)}${'░'.repeat(12 - filled)}  ${tr(text(bar.note))}`.trimEnd());
      });
    }
    if (entity.chart === 'hockey') {
      // Latency against load: flat, then a steep climb; ▲ marks the current load.
      const curve = '▁▁▁▁▁▁▁▁▁▂▂▃▄▆█';
      const marker = Math.max(0, Math.min(1, finite(entity.marker) ?? 0));
      const at = Math.min(curve.length - 1, Math.round(marker * (curve.length - 1)));
      lines.push(curve, `${' '.repeat(at)}▲ ${Math.round(marker * 100)}%`);
    }
    return lines;
  };

  const entityLooks = new Map<string, Map<number, Look>>();
  // A ring's keys sit on it in the colour of the server that owns them (the
  // last server at or before the key's angle); virtual nodes ("mark") too.
  const ringDots = (ringId: string, ring: Raw, step: number) => {
    const r = finite(ring.r) ?? 8;
    const cx = finite(ring.x) ?? 0;
    const cy = finite(ring.y) ?? 0;
    const servers = list(ring.nodes).filter(isRecord).map((node) => ({ a: finite(node.a) ?? 0, paint: paintOf(node.color, PAINTS.slab), mark: node.mark === true }));
    const sorted = [...servers].sort((a, b) => a.a - b.a);
    const moved = new Set(list(ring.moved));
    const add = (id: string, angle: number, glyph: string, paint: Paint) => {
      const radians = (angle * Math.PI) / 180;
      if (!entityLooks.has(id)) entityLooks.set(id, new Map());
      entityLooks.get(id)!.set(step, { kind: 'card', title: '', description: '', icon: null, shape: 'rounded', paint, dashed: false, hot: false, ux: cx + r * Math.cos(radians), uy: cy + r * Math.sin(radians), dot: glyph });
    };
    for (const key of list(ring.keys)) {
      const angle = finite(key);
      if (angle === undefined || sorted.length === 0) continue;
      const owner = [...sorted].reverse().find((server) => server.a <= angle) ?? sorted.at(-1)!;
      add(`${ringId}-key-${angle}`, angle, moved.has(key) ? '◉' : '●', owner.paint);
    }
    for (const server of servers) if (server.mark) add(`${ringId}-vnode-${server.a}`, server.a, '◆', server.paint);
  };
  rawSteps.forEach((_, index) => {
    const entities = entitiesOf(index);
    const all = Object.values(entities).filter(isRecord);
    for (const [id, entity] of Object.entries(entities)) {
      if (!isRecord(entity)) continue;
      const look = lookOf(entity, all);
      if (!look) continue;
      if (!entityLooks.has(id)) entityLooks.set(id, new Map());
      entityLooks.get(id)!.set(index, look);
      if (look.kind === 'ring') ringDots(id, entity, index);
    }
  });

  // ---- Link ends that are points, not entities, get an anchor ------------
  type Ref = string | number;
  const asPoint = (value: unknown): [Ref, Ref] | null => (Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'string' || finite(part) !== undefined) ? [value[0] as Ref, value[1] as Ref] : null);
  const unitOf = (ref: Ref, axis: 'ux' | 'uy', step: number): number | undefined => {
    if (typeof ref === 'number') return ref;
    const look = entityLooks.get(ref)?.get(step);
    return look ? look[axis] : undefined;
  };
  const anchorLooks = new Map<string, Map<number, Look>>();
  const linkEnd = (link: Raw, end: 'from' | 'to', step: number, linkId: string): string | null => {
    const ref = link[end];
    if (typeof ref === 'string' && entityLooks.get(ref)?.has(step)) return ref;
    const pts = list(link.pts);
    const point = asPoint(end === 'from' ? pts[0] : pts.at(-1));
    if (!point) return null;
    const ux = unitOf(point[0], 'ux', step);
    const uy = unitOf(point[1], 'uy', step);
    if (ux === undefined || uy === undefined) return null;
    const id = `${linkId}-${end}`;
    if (!anchorLooks.has(id)) anchorLooks.set(id, new Map());
    anchorLooks.get(id)!.set(step, { kind: 'card', title: '', description: '', icon: null, shape: 'rounded', paint: PAINTS.slab, dashed: false, hot: false, ux, uy });
    return id;
  };

  interface LinkLook {
    from: string;
    to: string;
    raw: Raw;
    label: string;
  }
  const linkLooks = new Map<string, Map<number, LinkLook>>();
  rawSteps.forEach((_, index) => {
    for (const [id, link] of Object.entries(linksOf(index))) {
      if (!isRecord(link)) continue;
      const from = linkEnd(link, 'from', index, id);
      const to = linkEnd(link, 'to', index, id);
      if (!from || !to || from === to) continue;
      if (!linkLooks.has(id)) linkLooks.set(id, new Map());
      linkLooks.get(id)!.set(index, { from, to, raw: link, label: text(link.label) ? tr(text(link.label)) : '' });
    }
  });

  // ---- Variants ------------------------------------------------------------
  const ids = idRegistry([...entityLooks.keys(), ...anchorLooks.keys(), ...linkLooks.keys()]);
  const nodeVariants = collectVariants(new Map([...entityLooks, ...anchorLooks]), ids, (look) => JSON.stringify(look));
  const variantAt = new Map<string, Map<number, Variant<Look>>>();
  for (const variant of nodeVariants) {
    if (!variantAt.has(variant.sourceId)) variantAt.set(variant.sourceId, new Map());
    for (const step of variant.steps) variantAt.get(variant.sourceId)!.set(step, variant);
  }
  const linkPerStep = new Map<string, Map<number, LinkLook & { fromVariant: string; toVariant: string }>>();
  for (const [id, steps] of linkLooks) {
    const resolved = new Map<number, LinkLook & { fromVariant: string; toVariant: string }>();
    for (const [step, look] of steps) {
      resolved.set(step, { ...look, fromVariant: variantAt.get(look.from)!.get(step)!.id, toVariant: variantAt.get(look.to)!.get(step)!.id });
    }
    linkPerStep.set(id, resolved);
  }
  const edgeVariants = collectVariants(linkPerStep, ids, (look) =>
    JSON.stringify([look.fromVariant, look.toVariant, look.label, look.raw.heads, look.raw.style, look.raw.fail, look.raw.labelAt, look.raw.labelTone, look.raw.pts]),
  );

  // ---- Layout ----------------------------------------------------------------
  const cardContent = (look: Look, scale: number): Size => {
    return cardSize({
      title: look.title,
      description: look.description,
      hasIcon: look.icon !== null,
      extraHeight: look.shape === 'database' ? 24 : 0,
      minWidth: look.foot ? look.foot.w * scale : undefined,
      minHeight: look.foot ? look.foot.h * scale : undefined,
    });
  };
  const isAnchor = (variant: Variant<Look>) => anchorLooks.has(variant.sourceId);
  // Every box is whole grid cells, so its edges land on grid lines.
  const sizeOf = (variant: Variant<Look>, scale: number): Size => snapSize(isAnchor(variant) || variant.value.dot ? { width: 28, height: 28 } : cardContent(variant.value, scale));

  // A placement is one spot an entity occupies; its variants there share it.
  const placementKey = (variant: Variant<Look>) => `${variant.sourceId}@${variant.value.ux},${variant.value.uy}`;
  const placements = new Map<string, { variants: Variant<Look>[]; ux: number; uy: number; steps: Set<number> }>();
  const ringLabels = nodeVariants.filter((variant) => variant.value.kind === 'ring' && variant.value.title);
  for (const variant of nodeVariants) {
    if (variant.value.kind !== 'card') continue;
    const key = placementKey(variant);
    const entry = placements.get(key) ?? { variants: [], ux: variant.value.ux, uy: variant.value.uy, steps: new Set<number>() };
    entry.variants.push(variant);
    variant.steps.forEach((step) => entry.steps.add(step));
    placements.set(key, entry);
  }
  const ringLabelLines = (variant: Variant<Look>) => [variant.value.title];
  const items: PlacementInput[] = [
    ...[...placements].map(([key, entry]) => ({
      key,
      ux: entry.ux,
      uy: entry.uy,
      steps: entry.steps,
      // Ring dots may sit close to each other and to the servers on the ring.
      ...(entry.variants.every((variant) => variant.value.dot) ? { gap: 6 } : {}),
      size: (scale: number) =>
        entry.variants.reduce<Size>((max, variant) => {
          const size = sizeOf(variant, scale);
          return { width: Math.max(max.width, size.width), height: Math.max(max.height, size.height) };
        }, { width: 0, height: 0 }),
    })),
    ...ringLabels.map((variant) => ({ key: `label:${variant.id}`, ux: variant.value.ux, uy: variant.value.uy, steps: new Set(variant.steps), size: () => snapSize(textSize(ringLabelLines(variant), 13)) })),
  ];
  const { scale, positions } = placeScene(items, { minScale: 16, maxScale: 46, gap: GAP, grid: GRID });
  const positionOf = (variant: Variant<Look>): Point => positions.get(placementKey(variant)) ?? snapCenter({ x: variant.value.ux * scale, y: variant.value.uy * scale }, sizeOf(variant, scale));

  const nodes: FlowNode[] = [];
  // Text that belongs to a frame (a panel's lines, a ring's label) shares its range, so it enters with it.
  const companions: { id: string; steps: number[] }[] = [];
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  const box = (id: string, center: Point, size: Size) => boxes.set(id, { x: center.x, y: center.y, width: size.width, height: size.height });

  // Frames first so they paint behind everything.
  const cardVariants = nodeVariants.filter((variant) => variant.value.kind === 'card');
  // Every variant at one placement takes the placement's (largest) box: the
  // block keeps one size across Lesson steps and all its edges stay on the grid.
  const placementSize = (variant: Variant<Look>): Size =>
    (placements.get(placementKey(variant))?.variants ?? [variant]).reduce<Size>((max, other) => {
      const size = sizeOf(other, scale);
      return { width: Math.max(max.width, size.width), height: Math.max(max.height, size.height) };
    }, { width: 0, height: 0 });
  for (const variant of cardVariants) box(variant.id, positionOf(variant), placementSize(variant));
  const parents = new Map<string, string>();
  const frameLabels = new Map<string, { id: string; position: Point; size: Size }>();
  const frames = nodeVariants.filter((variant) => variant.value.kind === 'zone' || variant.value.kind === 'frame');
  // Inner frames first, so a member joins the smallest frame around it.
  frames.sort((a, b) => (a.value.foot!.w * a.value.foot!.h) - (b.value.foot!.w * b.value.foot!.h));
  for (const frame of frames) {
    const look = frame.value;
    const half = { w: look.foot!.w / 2, h: look.foot!.h / 2 };
    let left = (look.ux - half.w) * scale;
    let right = (look.ux + half.w) * scale;
    let top = (look.uy - half.h) * scale;
    let bottom = (look.uy + half.h) * scale;
    const label = look.title ? snapSize(textSize([look.title], LABEL_SIZE)) : null;
    const header = label ? label.height : 0;
    const frameSteps = new Set(frame.steps);
    for (const member of [...cardVariants, ...frames]) {
      if (member === frame || parents.has(member.id) || !member.steps.every((step) => frameSteps.has(step))) continue;
      if (Math.abs(member.value.ux - look.ux) > half.w || Math.abs(member.value.uy - look.uy) > half.h) continue;
      const memberBox = boxes.get(member.id);
      if (!memberBox) continue;
      parents.set(member.id, frame.id);
      left = Math.min(left, memberBox.x - memberBox.width / 2 - FRAME_PADDING);
      right = Math.max(right, memberBox.x + memberBox.width / 2 + FRAME_PADDING);
      top = Math.min(top, memberBox.y - memberBox.height / 2 - FRAME_PADDING - header);
      bottom = Math.max(bottom, memberBox.y + memberBox.height / 2 + FRAME_PADDING);
    }
    if (label) right = Math.max(right, left + label.width);
    // Outward onto the grid, so the frame still holds every member.
    left = Math.floor(left / GRID) * GRID;
    top = Math.floor(top / GRID) * GRID;
    right = Math.ceil(right / GRID) * GRID;
    bottom = Math.ceil(bottom / GRID) * GRID;
    const size = { width: Math.max(FRAME_MIN, right - left), height: Math.max(FRAME_MIN, bottom - top) };
    const center = { x: left + size.width / 2, y: top + size.height / 2 };
    box(frame.id, center, size);
    if (label) {
      // Top left inside the frame; if a card shown with it is in the way, top right, then just above the frame.
      const insideY = top + label.height / 2;
      const leftX = left + label.width / 2;
      const candidates: Point[] = [
        { x: leftX, y: insideY },
        { x: left + size.width - label.width / 2, y: insideY },
        { x: leftX, y: top - label.height / 2 },
      ];
      const clear = (point: Point) =>
        cardVariants.every((card) => {
          const other = boxes.get(card.id);
          if (!other || !card.steps.some((step) => frameSteps.has(step))) return true;
          return Math.abs(other.x - point.x) >= (other.width + label.width) / 2 || Math.abs(other.y - point.y) >= (other.height + label.height) / 2;
        });
      const position = candidates.find(clear) ?? candidates[0];
      frameLabels.set(frame.id, { id: ids.claim(`${frame.id}-label`), position: snapCenter(position, label), size: label });
    }
  }
  // Paint order: outer frames before inner ones.
  frames.reverse();

  // Panels: a column to the right of the scene.
  const sceneBoxes = [...boxes.values()];
  for (const variant of nodeVariants.filter((v) => v.value.kind === 'ring')) {
    const diameter = Math.ceil((variant.value.foot!.w * scale) / GRID) * GRID;
    const ringSize = { width: diameter, height: diameter };
    box(variant.id, snapCenter({ x: variant.value.ux * scale, y: variant.value.uy * scale }, ringSize), ringSize);
    sceneBoxes.push(boxes.get(variant.id)!);
  }
  const sceneRight = Math.max(0, ...sceneBoxes.map((b) => b.x + b.width / 2));
  const sceneTop = Math.min(0, ...sceneBoxes.map((b) => b.y - b.height / 2));
  const panels = nodeVariants.filter((variant) => variant.value.kind === 'panel');
  const panelSize = (variant: Variant<Look>) => {
    const lines = [variant.value.title, ...(variant.value.lines ?? [])].filter((line, index) => index > 0 || line !== '');
    const text = textSize(lines, PANEL_TEXT_SIZE);
    // Whole cells with room around the text; the text box is the panel's own box.
    const outer = snapSize({ width: Math.max(FRAME_MIN, text.width + 24), height: Math.max(FRAME_MIN, text.height + 20) });
    return { inner: outer, outer };
  };
  const slots: { sources: Set<string>; steps: Set<number>; height: number }[] = [];
  const slotOf = new Map<string, number>();
  for (const panel of panels) {
    let index = slotOf.get(panel.sourceId);
    if (index === undefined) {
      index = slots.findIndex((slot) => !panel.steps.some((step) => slot.steps.has(step)));
      if (index < 0) index = slots.push({ sources: new Set(), steps: new Set(), height: 0 }) - 1;
      slotOf.set(panel.sourceId, index);
    }
    const slot = slots[index];
    slot.sources.add(panel.sourceId);
    panel.steps.forEach((step) => slot.steps.add(step));
    slot.height = Math.max(slot.height, panelSize(panel).outer.height);
  }
  const slotTop = (index: number) => sceneTop + slots.slice(0, index).reduce((sum, slot) => sum + slot.height + GAP, 0);
  const panelText = new Map<string, { id: string; lines: string[]; size: Size; center: Point }>();
  for (const panel of panels) {
    const { inner, outer } = panelSize(panel);
    const panelLeft = Math.ceil((sceneRight + PANEL_GAP) / GRID) * GRID;
    const center = { x: panelLeft + outer.width / 2, y: slotTop(slotOf.get(panel.sourceId)!) + outer.height / 2 };
    box(panel.id, center, outer);
    const lines = [panel.value.title, ...(panel.value.lines ?? [])].filter((line, index) => index > 0 || line !== '');
    panelText.set(panel.id, { id: ids.claim(`${panel.id}-text`), lines, size: inner, center });
  }

  // ---- Nodes -----------------------------------------------------------------
  const geometry = (id: string) => {
    const b = boxes.get(id)!;
    return { position: { x: b.x, y: b.y }, width: b.width, height: b.height };
  };
  const frameNode = (variant: Variant<Look>, extra: Partial<FlowNode> = {}): FlowNode => ({
    id: variant.id,
    type: 'group',
    title: '',
    ...geometry(variant.id),
    ...variant.value.paint,
    borderWidth: 1.5,
    ...(variant.value.dashed ? { borderStyle: 'dashed' as const } : {}),
    fill: 'flat',
    opacity: FRAME_OPACITY,
    ...(parents.has(variant.id) ? { parentId: parents.get(variant.id) } : {}),
    ...extra,
  });
  for (const frame of frames) {
    nodes.push(frameNode(frame));
    const label = frameLabels.get(frame.id);
    if (!label) continue;
    companions.push({ id: label.id, steps: frame.steps });
    nodes.push({ id: label.id, type: 'text', title: frame.value.title, position: label.position, width: label.size.width, height: label.size.height, fontSize: LABEL_SIZE, fontWeight: 'semibold', textAlign: 'left', color: TEXT_INK, parentId: frame.id });
  }
  for (const ring of nodeVariants.filter((v) => v.value.kind === 'ring')) {
    nodes.push(frameNode(ring, { shape: 'circle', borderWidth: 2, borderStyle: 'solid' }));
    if (ring.value.title) {
      const size = snapSize(textSize(ringLabelLines(ring), 13));
      const center = positions.get(`label:${ring.id}`)!;
      const id = ids.claim(`${ring.id}-label`);
      companions.push({ id, steps: ring.steps });
      nodes.push({ id, type: 'text', title: ring.value.title, position: center, width: size.width, height: size.height, fontSize: 13, color: TEXT_INK });
    }
  }
  for (const panel of panels) {
    nodes.push(frameNode(panel, { borderStyle: 'solid', borderWidth: 1 }));
    const label = panelText.get(panel.id)!;
    companions.push({ id: label.id, steps: panel.steps });
    nodes.push({ id: label.id, type: 'text', title: label.lines.join('\n'), position: label.center, width: label.size.width, height: label.size.height, fontSize: PANEL_TEXT_SIZE, fontWeight: 'medium', textAlign: 'left', color: TEXT_INK, parentId: panel.id });
  }
  for (const variant of cardVariants) {
    const look = variant.value;
    if (isAnchor(variant)) {
      nodes.push({ id: variant.id, type: 'text', title: '', ...geometry(variant.id) });
      continue;
    }
    if (look.dot) {
      nodes.push({ id: variant.id, type: 'text', title: look.dot, ...geometry(variant.id), fontSize: 20, color: look.paint.borderColor });
      continue;
    }
    nodes.push({
      id: variant.id,
      type: 'process',
      title: look.title,
      ...(look.description ? { description: look.description } : {}),
      ...geometry(variant.id),
      shape: look.shape,
      icon: look.icon,
      // tutorial-layout sizes a card for the icon beside the text.
      ...(look.icon !== null ? { iconPosition: 'left' as const } : {}),
      ...look.paint,
      ...(look.hot ? { borderColor: HOT_BORDER } : {}),
      borderWidth: look.hot ? 2.5 : 1.5,
      ...(look.dashed ? { borderStyle: 'dashed' as const } : {}),
      ...(look.opacity !== undefined ? { opacity: look.opacity } : {}),
      fill: 'flat',
      shadow: 'none',
      ...(parents.has(variant.id) ? { parentId: parents.get(variant.id) } : {}),
    });
  }

  // ---- Edges -----------------------------------------------------------------
  const flowsByStep = rawSteps.map((_, index) => flowsOnLinks(scenes[index].flows, linksOf(index)));
  /** A waypoint in pixels. A bare number equal to an end's own source coordinate follows that end where layout put it. */
  const pointAt = (value: unknown, step: number, ends: readonly string[] = []): Point | null => {
    if (typeof value === 'string') {
      const variant = variantAt.get(value)?.get(step);
      return variant ? boxes.get(variant.id) ?? null : null;
    }
    const point = asPoint(value);
    if (!point) return null;
    const axis = (ref: Ref, key: 'x' | 'y') => {
      if (typeof ref === 'number') {
        const unit = key === 'x' ? 'ux' : 'uy';
        const end = ends.map((id) => variantAt.get(id)?.get(step)).find((variant) => variant && Math.abs(variant.value[unit] - ref) < 0.01);
        const b = end ? boxes.get(end.id) : undefined;
        // A free bend lands on the half grid, where box centres fall.
        return b ? b[key] : Math.round((ref * scale) / (GRID / 2)) * (GRID / 2);
      }
      const variant = variantAt.get(ref)?.get(step);
      const b = variant ? boxes.get(variant.id) : undefined;
      return b ? b[key] : undefined;
    };
    const x = axis(point[0], 'x');
    const y = axis(point[1], 'y');
    return x === undefined || y === undefined ? null : { x: Math.round(x), y: Math.round(y) };
  };
  const sideToward = (from: Point, to: Point): 'top' | 'right' | 'bottom' | 'left' =>
    Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? (to.x >= from.x ? 'right' : 'left') : to.y >= from.y ? 'bottom' : 'top';
  const TONES: Record<string, { labelColor: `#${string}`; labelBackground: `#${string}` }> = {
    amber: { labelColor: '#ffe58f', labelBackground: '#613400' },
    red: { labelColor: '#ffa39e', labelBackground: '#5c0011' },
    green: { labelColor: '#b7eb8f', labelBackground: '#092b00' },
  };

  const edges: FlowEdge[] = [];
  const stepOverrides = new Map<number, Record<string, ElementOverride>>();
  const override = (step: number, id: string, value: ElementOverride) => {
    const forStep = stepOverrides.get(step) ?? {};
    forStep[id] = { ...forStep[id], ...value };
    stepOverrides.set(step, forStep);
  };
  for (const variant of edgeVariants) {
    const look = variant.value;
    const link = look.raw;
    const firstStep = variant.steps[0];
    const heads = text(link.heads);
    const style = text(link.style);
    const fail = finite(link.fail) ?? 0;
    const marker = (on: boolean): EdgeMarker => (on ? 'arrow' : 'none');
    const edge: FlowEdge = {
      id: variant.id,
      from: look.fromVariant,
      to: look.toVariant,
      ...(look.label ? { label: look.label } : {}),
      startMarker: marker(heads === 'both'),
      endMarker: style === 'cut' ? 'cross' : marker(heads === 'both' || heads === 'end'),
      color: style === 'cut' || fail >= 0.5 ? '#ff7875' : fail > 0 ? '#ffa940' : style === 'off' ? '#475569' : LINE_INK,
      width: 2,
      ...(style === 'dashed' || style === 'cut' ? { lineStyle: 'dashed' as const } : style === 'off' || style === 'beat' ? { lineStyle: 'dotted' as const } : {}),
    };
    const labelAt = finite(link.labelAt);
    if (look.label && labelAt !== undefined) edge.labelOffset = Math.max(0, Math.min(1, labelAt));
    if (look.label && Object.hasOwn(TONES, text(link.labelTone))) Object.assign(edge, TONES[text(link.labelTone)]);

    // Route: the source's waypoints become ports (and bends when there is more than one corner).
    const pts = list(link.pts).map((value) => pointAt(value, firstStep, [look.from, look.to]));
    const start = boxes.get(look.fromVariant)!;
    const end = boxes.get(look.toVariant)!;
    const inner = pts.slice(1, -1).filter((point): point is Point => point !== null);
    if (inner.length > 0) {
      edge.fromSide = sideToward(start, inner[0]);
      edge.toSide = sideToward(end, inner.at(-1)!);
      const corner = inner[0];
      const isElbow = inner.length === 1 && (Math.abs(corner.x - start.x) < 1 || Math.abs(corner.y - start.y) < 1) && (Math.abs(corner.x - end.x) < 1 || Math.abs(corner.y - end.y) < 1);
      if (!isElbow) edge.bendPoints = inner;
    }

    // Effect: the most common flow is the base; other steps override.
    const flows = variant.steps.map((step) => ({ step, flow: flowsByStep[step].get(variant.sourceId) }));
    const counts = new Map<string, number>();
    for (const { flow } of flows) if (flow) counts.set(flow.kind, (counts.get(flow.kind) ?? 0) + 1);
    const baseKind = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (baseKind === undefined) edge.effect = 'none';
    else {
      const flowLook = FLOW_LOOKS[baseKind];
      const baseFlow = flows.find(({ flow }) => flow?.kind === baseKind)!.flow!;
      edge.effect = flowLook.effect;
      edge.effectColor = flowLook.color;
      edge.glowIntensity = 1;
      edge.glowColor = 'auto';
      if (baseFlow.bounce) edge.direction = 'both';
      else if (baseFlow.reverse) edge.direction = 'reverse';
      const speed = (flowLook.speed ?? 1) * (baseFlow.speed ?? 1);
      if (speed !== 1) edge.animationSpeed = Math.round(Math.max(0.25, Math.min(3, speed)) * 100) / 100;
      if (flowLook.size) edge.effectSize = flowLook.size;
      if (TRAVELLING.has(flowLook.effect) && baseFlow.rate !== undefined) edge.effectCount = Math.max(1, Math.min(6, Math.round(baseFlow.rate * 1.5)));
      for (const { step, flow } of flows) {
        const effect: EdgeEffect = flow ? FLOW_LOOKS[flow.kind].effect : 'none';
        if (effect !== edge.effect) override(step, variant.id, { effect });
      }
    }
    edges.push(edge);
  }

  // ---- Presence and visibility -----------------------------------------------
  const presence: Record<string, ElementPresence> = {};
  const visibility = (id: string, steps: readonly number[]) => {
    const shown = new Set(steps);
    const first = Math.min(...steps);
    const last = Math.max(...steps);
    const range: ElementPresence = {};
    if (first > 0) range.from = stepIds[first];
    if (last < stepIds.length - 1) range.until = stepIds[last + 1];
    if (range.from || range.until) presence[id] = range;
    for (let step = first + 1; step <= last; step += 1) {
      if (!shown.has(step)) override(step, id, { visible: false });
      // Back after a gap: stress it the way an entering Element is.
      else if (!shown.has(step - 1)) override(step, id, { emphasis: true });
    }
  };
  for (const variant of nodeVariants) visibility(variant.id, variant.steps);
  for (const companion of companions) visibility(companion.id, companion.steps);
  for (const variant of edgeVariants) visibility(variant.id, variant.steps);

  // ---- Lesson content --------------------------------------------------------
  const metricIds = list(source.metrics).filter((id): id is string => typeof id === 'string');
  const uniqueMetricIds = [...new Set(metricIds)];
  const steps: LessonStep[] = rawSteps.map((step, index) => {
    const metrics: Record<string, string> = {};
    const values = isRecord(step.metrics) ? step.metrics : {};
    for (const id of uniqueMetricIds) {
      const formatted = options.formatMetric(id, values[id]);
      if (formatted) metrics[id] = tr(formatted);
    }
    const chapter = text(step.chapter);
    const callout = isRecord(step.callout) && Object.hasOwn(CALLOUTS, text(step.callout.kind)) ? { kind: CALLOUTS[text(step.callout.kind)], text: narrationFromHtml(tr(text(step.callout.text))) } : undefined;
    return {
      id: stepIds[index],
      short: tr(text(step.short)),
      title: tr(text(step.title)),
      ...(Object.hasOwn(LESSON_CHAPTERS, chapter) ? { chapter: chapter as LessonChapter } : {}),
      body: list(step.body)
        .filter((paragraph): paragraph is string => typeof paragraph === 'string')
        .map((paragraph) => narrationFromHtml(tr(paragraph)))
        .filter(Boolean)
        .join('\n\n'),
      ...(callout ? { callout } : {}),
      changes: list(step.changes)
        .filter((line): line is string => typeof line === 'string')
        .map((line) => narrationFromHtml(trLine(line)).replace(/^−\s*/, '- ')),
      metrics,
      overrides: stepOverrides.get(index) ?? {},
    };
  });

  const level = text(source.level);
  const minutes = finite(source.minutes);
  const diagram: FlowDocumentJSON = { nodes, edges };
  return toLessonDocument(diagram, {
    meta: {
      title: tr(text(source.title)),
      summary: tr(text(source.summary)),
      ...(minutes !== undefined && minutes > 0 ? { minutes } : {}),
      ...((LESSON_LEVELS as readonly string[]).includes(level) ? { level: level as LessonLevel } : {}),
      metrics: uniqueMetricIds.map((id) => ({ id, label: options.metricLabel(id) })),
      goals: list(source.goals)
        .filter(isRecord)
        .flatMap((goal) => {
          const step = finite(goal.step);
          return step !== undefined && stepIds[step] ? [{ text: tr(text(goal.text)), step: stepIds[step] }] : [];
        }),
    },
    presence,
    steps,
  });
}
