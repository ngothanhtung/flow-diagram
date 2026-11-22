// Sizing and placement for `tutorial-import.ts`: how big a converted
// Element has to be for its text to show unclipped, and where it goes in 2D
// so no two Elements shown in the same Lesson step overlap. Pure, no DOM —
// every card uses the default node font (Geist Mono), a monospace face, so
// a string's rendered width is a character count times the advance.

export interface Size {
  width: number;
  height: number;
}

/**
 * The editor's default snap grid. A converted lesson is laid out on it:
 * every box's edges sit on grid lines (top-left on the grid, width and height
 * whole cells), so it looks tidy and an author's snapped drag never jumps it.
 */
export const GRID = 40;

/** Rounds a size up to whole grid cells. */
export function snapSize(size: Size, grid = GRID): Size {
  return { width: Math.max(grid, Math.ceil(size.width / grid) * grid), height: Math.max(grid, Math.ceil(size.height / grid) * grid) };
}

/** The centre of a box of `size` (whole cells) whose top-left is the grid point nearest to where `center` puts it. */
export function snapCenter(center: { x: number; y: number }, size: Size, grid = GRID): { x: number; y: number } {
  return {
    x: Math.round((center.x - size.width / 2) / grid) * grid + size.width / 2,
    y: Math.round((center.y - size.height / 2) / grid) * grid + size.height / 2,
  };
}

export interface Point {
  x: number;
  y: number;
}

// What FlowNodeCard paints for a block (see its body branch): title at 14px
// `leading-tight`, sub title at 10px with a 4px top margin, a 45px icon
// badge with a 12px gap, padding `max(10, min(w, h) * 0.13)` (+8 sideways).
const TITLE_SIZE = 14;
const DESCRIPTION_SIZE = 10;
const LINE_HEIGHT = 1.25;
const ICON_BADGE = 45;
const ICON_GAP = 12;
const ADVANCE = 0.6;
/** Headroom for glyphs that fall back to another font and for rounding. */
const SLACK = 1.06;

/** Card limits from `nodeSizeLimits` for an ordinary card. */
export const CARD_MIN = 72;
export const CARD_MAX_WIDTH = 320;
export const CARD_MAX_HEIGHT = 240;

function charWidth(char: string, fontSize: number): number {
  const code = char.codePointAt(0) ?? 0;
  // CJK, emoji and the like run about twice as wide as a monospace cell.
  return (code >= 0x2e80 ? 1.1 : ADVANCE) * fontSize;
}

export function textWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) width += charWidth(char, fontSize);
  return width * SLACK;
}

/** Lines a browser's greedy wrap gives `text` at `maxWidth`, and whether any single word overflows it. */
function wrap(text: string, fontSize: number, maxWidth: number): { lines: number; overflow: boolean } {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: 0, overflow: false };
  const space = textWidth(' ', fontSize);
  let lines = 1;
  let current = 0;
  let overflow = false;
  for (const word of words) {
    const width = textWidth(word, fontSize);
    if (width > maxWidth) overflow = true;
    if (current === 0) current = width;
    else if (current + space + width <= maxWidth) current += space + width;
    else {
      lines += 1;
      current = width;
    }
  }
  return { lines, overflow };
}

export interface CardContent {
  title: string;
  description: string;
  hasIcon: boolean;
  /** Extra height the silhouette needs (a database's cap). */
  extraHeight?: number;
  /** The smallest box, e.g. from the source's footprint. */
  minWidth?: number;
  minHeight?: number;
}

/**
 * The box a block needs to show its icon, title and sub title without
 * clipping: the narrowest width (from 176px, in 4px steps) at which the
 * title fits on one line (up to 232px) — else on two — and the sub title
 * takes at most four, with no word wider than the text column.
 */
export function cardSize(content: CardContent): Size {
  const { title, description, hasIcon } = content;
  const minWidth = Math.min(CARD_MAX_WIDTH, Math.max(CARD_MIN, content.minWidth ?? CARD_MIN));
  const minHeight = Math.min(CARD_MAX_HEIGHT, Math.max(CARD_MIN, content.minHeight ?? CARD_MIN));
  if (!title.trim() && !description.trim() && !hasIcon) return { width: Math.round(minWidth), height: Math.round(minHeight) };

  const measure = (width: number, titleLines: number) => {
    let padding = 10;
    let height = 0;
    let fits = false;
    for (let pass = 0; pass < 4; pass += 1) {
      const column = width - 2 * (padding + 8) - (hasIcon ? ICON_BADGE + ICON_GAP : 0);
      const titleWrap = wrap(title, TITLE_SIZE, column);
      const descriptionWrap = wrap(description, DESCRIPTION_SIZE, column);
      const textHeight = titleWrap.lines * TITLE_SIZE * LINE_HEIGHT + (descriptionWrap.lines > 0 ? 4 + descriptionWrap.lines * DESCRIPTION_SIZE * LINE_HEIGHT : 0);
      height = 2 * padding + Math.max(hasIcon ? ICON_BADGE : 0, textHeight) + 8 + (content.extraHeight ?? 0);
      fits = column > 24 && titleWrap.lines <= titleLines && descriptionWrap.lines <= 4 && !titleWrap.overflow && !descriptionWrap.overflow;
      padding = Math.max(10, Math.min(width, height) * 0.13);
    }
    return { height, fits };
  };

  // A one-line title up to a medium width, else two lines up to the widest card.
  const narrowest = (titleLines: number, widest: number) => {
    for (let width = Math.max(176, minWidth); width <= widest; width += 4) if (measure(width, titleLines).fits) return width;
    return null;
  };
  const chosen = narrowest(1, 232) ?? narrowest(2, CARD_MAX_WIDTH) ?? CARD_MAX_WIDTH;
  const height = Math.max(minHeight, measure(chosen, 2).height);
  return { width: Math.ceil(chosen), height: Math.ceil(Math.min(CARD_MAX_HEIGHT, height)) };
}

/** A free text object showing `lines` (pre-wrapped, 1.35 line height, 6px padding). */
export function textSize(lines: readonly string[], fontSize: number): Size {
  const widest = Math.max(0, ...lines.map((line) => textWidth(line, fontSize)));
  return { width: Math.ceil(Math.max(24, widest + 12 + 4)), height: Math.ceil(Math.max(24, lines.length * fontSize * 1.35 + 12 + 4)) };
}

export interface PlacementInput {
  key: string;
  /** Centre in source units. */
  ux: number;
  uy: number;
  /** Pixel size at a given scale (some sizes follow the source footprint). */
  size: (scale: number) => Size;
  /** Lesson step indexes the placement is shown in. */
  steps: ReadonlySet<number>;
  /** Clear space this one needs; a pair keeps the smaller of their two. Default: the options' gap. */
  gap?: number;
}

export interface PlacementOptions {
  minScale: number;
  maxScale: number;
  /** Clear space kept between two Elements shown together. */
  gap: number;
  /** Snap every placement's top-left to this grid (sizes must already be whole cells). */
  grid?: number;
}

function sharesStep(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  for (const step of a) if (b.has(step)) return true;
  return false;
}

/**
 * Projects the source plan to pixels (`position = (x·S, y·S)`) with the
 * smallest scale S in range at which no two placements shown in the same
 * step overlap (with `gap` between them). When no scale in range manages
 * that, it takes the one with the fewest overlaps and pushes the remaining
 * pairs apart along their shallower axis until they clear — deterministic,
 * so a re-run gives the same file.
 */
export function placeScene(items: readonly PlacementInput[], options: PlacementOptions): { scale: number; positions: Map<string, Point> } {
  const pairs: [number, number][] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) if (sharesStep(items[i].steps, items[j].steps)) pairs.push([i, j]);
  }
  const gapOf = (i: number, j: number) => Math.min(items[i].gap ?? options.gap, items[j].gap ?? options.gap);
  const overlap = (i: number, j: number, a: Point, b: Point, sa: Size, sb: Size): { x: number; y: number } | null => {
    const gap = gapOf(i, j);
    const x = (sa.width + sb.width) / 2 + gap - Math.abs(a.x - b.x);
    const y = (sa.height + sb.height) / 2 + gap - Math.abs(a.y - b.y);
    return x > 0 && y > 0 ? { x, y } : null;
  };
  const project = (scale: number) => items.map((item) => ({ x: item.ux * scale, y: item.uy * scale }));

  let best = { scale: options.maxScale, count: Number.POSITIVE_INFINITY };
  for (let scale = options.minScale; scale <= options.maxScale; scale += 1) {
    const points = project(scale);
    const sizes = items.map((item) => item.size(scale));
    const count = pairs.filter(([i, j]) => overlap(i, j, points[i], points[j], sizes[i], sizes[j])).length;
    if (count < best.count) best = { scale, count };
    if (count === 0) break;
  }

  const scale = best.scale;
  const points = project(scale);
  const sizes = items.map((item) => item.size(scale));
  for (let pass = 0; pass < 500 && best.count > 0; pass += 1) {
    let moved = false;
    for (const [i, j] of pairs) {
      const push = overlap(i, j, points[i], points[j], sizes[i], sizes[j]);
      if (!push) continue;
      moved = true;
      // Items on one source row stay a row (pushed sideways), one column stays a column.
      const sameRow = items[i].uy === items[j].uy;
      const sameColumn = items[i].ux === items[j].ux;
      if (sameRow || (!sameColumn && push.x <= push.y)) {
        const direction = points[j].x > points[i].x || (points[j].x === points[i].x && j > i) ? 1 : -1;
        points[i].x -= (direction * (push.x + 1)) / 2;
        points[j].x += (direction * (push.x + 1)) / 2;
      } else {
        const direction = points[j].y > points[i].y || (points[j].y === points[i].y && j > i) ? 1 : -1;
        points[i].y -= (direction * (push.y + 1)) / 2;
        points[j].y += (direction * (push.y + 1)) / 2;
      }
    }
    if (!moved) break;
  }
  if (options.grid) {
    const grid = options.grid;
    // Onto the grid, then any pair the rounding brought too close is pushed
    // apart in whole cells (only the later one moves, so others stay put).
    points.forEach((point, index) => Object.assign(point, snapCenter(point, sizes[index], grid)));
    for (let pass = 0; pass < 500; pass += 1) {
      let moved = false;
      for (const [i, j] of pairs) {
        const push = overlap(i, j, points[i], points[j], sizes[i], sizes[j]);
        if (!push) continue;
        moved = true;
        const sameRow = items[i].uy === items[j].uy;
        const sameColumn = items[i].ux === items[j].ux;
        if (sameRow || (!sameColumn && push.x <= push.y)) points[j].x += (points[j].x >= points[i].x ? 1 : -1) * Math.ceil(push.x / grid) * grid;
        else points[j].y += (points[j].y >= points[i].y ? 1 : -1) * Math.ceil(push.y / grid) * grid;
      }
      if (!moved) break;
    }
    return { scale, positions: new Map(items.map((item, index) => [item.key, { x: points[index].x, y: points[index].y }])) };
  }
  return { scale, positions: new Map(items.map((item, index) => [item.key, { x: Math.round(points[index].x), y: Math.round(points[index].y) }])) };
}
