// Turns the off-screen export render (`ExportScene`) into a standalone SVG
// that needs nothing from the page: no stylesheet, no web font, no
// `/logos/*.svg` request and no HTML. Browser-only — it measures layout.
//
// Why each step exists:
//
// * **No `<foreignObject>` in the output.** Every Block's title, every Table,
//   Frame title, Text and Icon renders as HTML inside a foreignObject. Design
//   tools and non-browser renderers drop foreignObject (the text simply
//   vanishes), and WebKit taints a canvas that has drawn one. So each one is
//   laid out by the browser in an unrotated measuring box and re-emitted as
//   native `<rect>` / `<text>` / `<svg>` at the measured positions, in the
//   foreignObject's own coordinate system — the node's rotation still
//   applies because the result replaces the foreignObject in place.
// * **Computed styles inlined, classes dropped.** Tailwind classes and CSS
//   custom properties (`var(--font-…)`) mean nothing outside the page.
//   `currentColor`, `oklch()`/`lab()` and `#rrggbbaa` are normalised to
//   `#rrggbb` + an opacity attribute, the form every SVG consumer reads.
// * **CSS `drop-shadow()` becomes an SVG `<filter>`**, `vector-effect` is
//   dropped (strokes scale with the picture, so the 2× PNG is a true 2×), and
//   `dominant-baseline` is folded into each label's `y`.
// * **Logos are inlined** as nested `<svg>` (ids prefixed so two logos can't
//   collide), or as a data-URI `<image>` when a logo carries its own
//   stylesheet. **Fonts are embedded** as data-URI `@font-face` rules — only
//   the faces (weight × unicode-range subset) the picture actually uses.

const SVG_NS = 'http://www.w3.org/2000/svg';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
/** Containers whose children are geometry for something else, not paint. */
const NON_RENDERED = new Set(['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'filter', 'marker', 'symbol']);
const STRIP_ATTRIBUTES = ['class', 'style', 'vector-effect', 'pointer-events', 'role', 'tabindex', 'aria-label', 'aria-hidden', 'focusable'];

interface Rgba {
  hex: string;
  alpha: number;
}

interface FlattenContext {
  defs: SVGDefsElement;
  nextId: (prefix: string) => string;
  color: (css: string) => Rgba | null;
  ascent: (font: string) => number;
  textWidth: (font: string, text: string) => number;
  measureHost: HTMLDivElement;
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

const round = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Colour

/** A colour parser backed by a 1×1 canvas, so any syntax the browser
 *  understands (oklch, lab, color-mix, named…) comes out as sRGB. */
function createColorParser(): (css: string) => Rgba | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const cache = new Map<string, Rgba | null>();
  const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
  return (css) => {
    const key = css.trim();
    if (cache.has(key)) return cache.get(key)!;
    let result: Rgba | null = null;
    const rgb = key.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i);
    const short = key.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!key || key === 'none') result = null;
    else if (key === 'transparent') result = { hex: '#000000', alpha: 0 };
    else if (rgb) {
      const alpha = rgb[4] === undefined ? 1 : rgb[5] ? Number(rgb[4]) / 100 : Number(rgb[4]);
      result = { hex: hex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3])), alpha };
    } else if (short) {
      let digits = short[1];
      if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join('');
      result = { hex: `#${digits.slice(0, 6).toLowerCase()}`, alpha: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1 };
    } else {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#000';
      context.fillStyle = key;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      result = { hex: hex(r, g, b), alpha: Math.round((a / 255) * 1000) / 1000 };
    }
    cache.set(key, result);
    return result;
  };
}

/** Writes a paint attribute (`fill`, `stroke`, `stop-color`, `flood-color`)
 *  as `#rrggbb`, folding any alpha into its opacity attribute. */
function setPaint(target: Element, attribute: string, value: string, context: FlattenContext) {
  if (value.startsWith('url(')) {
    const id = value.match(/#([^"')]+)/)?.[1];
    if (id) target.setAttribute(attribute, `url(#${id})`);
    return;
  }
  const color = context.color(value);
  const opacityAttribute = attribute === 'fill' ? 'fill-opacity' : attribute === 'stroke' ? 'stroke-opacity' : attribute === 'stop-color' ? 'stop-opacity' : 'flood-opacity';
  if (!color || color.alpha === 0) {
    if (attribute === 'fill' || attribute === 'stroke') target.setAttribute(attribute, 'none');
    else {
      target.setAttribute(attribute, color?.hex ?? '#000000');
      target.setAttribute(opacityAttribute, '0');
    }
    return;
  }
  target.setAttribute(attribute, color.hex);
  if (color.alpha < 1) {
    const existing = Number(target.getAttribute(opacityAttribute) ?? '1');
    target.setAttribute(opacityAttribute, String(round((Number.isFinite(existing) ? existing : 1) * color.alpha * 1000) / 1000));
  }
}

const isPaintless = (css: string, context: FlattenContext) => {
  if (!css || css === 'none') return true;
  if (css.startsWith('url(')) return false;
  const color = context.color(css);
  return !color || color.alpha === 0;
};

// ---------------------------------------------------------------------------
// Fonts and text

/** Drops next/font's metric-matched `"X Fallback"` faces (they point at a
 *  local Arial/Times the picture can't count on) from a computed family. */
function cleanFontFamily(family: string) {
  return family
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/ Fallback["']?$/.test(part))
    .join(', ');
}

function cssFont(style: CSSStyleDeclaration) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function applyTextTransform(text: string, transform: string) {
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') return text.replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
  return text;
}

function textAttributes(target: SVGTextElement, style: CSSStyleDeclaration) {
  target.setAttribute('font-family', cleanFontFamily(style.fontFamily));
  target.setAttribute('font-size', String(round(parseFloat(style.fontSize))));
  target.setAttribute('font-weight', style.fontWeight);
  if (style.fontStyle !== 'normal') target.setAttribute('font-style', style.fontStyle);
  if (style.letterSpacing !== 'normal' && parseFloat(style.letterSpacing) !== 0) target.setAttribute('letter-spacing', String(round(parseFloat(style.letterSpacing))));
  target.setAttributeNS(XML_NS, 'xml:space', 'preserve');
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
function graphemes(text: string): Array<{ segment: string; index: number }> {
  if (segmenter) return [...segmenter.segment(text)].map(({ segment, index }) => ({ segment, index }));
  const out: Array<{ segment: string; index: number }> = [];
  let index = 0;
  for (const segment of text) {
    out.push({ segment, index });
    index += segment.length;
  }
  return out;
}

/**
 * One HTML text node → one `<text>` per laid-out line. Each grapheme's box
 * is read from a Range, so wrapping, alignment, collapsed whitespace and
 * letter-spacing are exactly the browser's; a line's baseline is its box
 * top plus the font's ascent (the same metric the box was built from).
 */
function convertText(node: Text, parent: HTMLElement, style: CSSStyleDeclaration, origin: DOMRect, out: SVGElement, context: FlattenContext) {
  const data = node.data;
  if (!data.trim()) return;
  const range = document.createRange();
  type Glyph = { text: string; left: number; right: number; top: number; height: number };
  const lines: Glyph[][] = [];
  for (const { segment, index } of graphemes(data)) {
    if (segment === '\n' || segment === '\r') continue;
    range.setStart(node, index);
    range.setEnd(node, index + segment.length);
    const rect = [...range.getClientRects()].find((box) => box.width > 0 || box.height > 0);
    if (!rect || rect.width === 0) continue; // collapsed whitespace
    const glyph = { text: segment, left: rect.left, right: rect.right, top: rect.top, height: rect.height };
    const line = lines.at(-1);
    if (line && Math.abs(line[0].top - rect.top) < rect.height / 2) line.push(glyph);
    else lines.push([glyph]);
  }
  range.detach();
  if (lines.length === 0) return;

  const font = cssFont(style);
  // `truncate`: the browser draws "…" in place of what overflows. The
  // overflowing glyphs are still laid out (just clipped), so cut where the
  // ellipsis would start and add it.
  const truncated = style.textOverflow === 'ellipsis' && parent.scrollWidth > parent.clientWidth + 0.5;
  if (truncated) {
    const box = parent.getBoundingClientRect();
    const limit = box.right - parseFloat(getComputedStyle(parent).paddingRight) - context.textWidth(font, '…');
    const line = lines[0];
    const kept = line.filter((glyph) => glyph.right <= limit + 0.5);
    lines.splice(0, lines.length, [...kept, { ...line[0], text: '…', left: kept.at(-1)?.right ?? line[0].left }]);
  }

  const color = style.color;
  const ascent = context.ascent(font);
  for (const line of lines) {
    const content = applyTextTransform(line.map((glyph) => glyph.text).join('').replace(/\s+$/, ''), style.textTransform);
    if (!content.trim()) continue;
    const text = el('text', { x: round(line[0].left - origin.left), y: round(line[0].top - origin.top + ascent) });
    textAttributes(text, style);
    setPaint(text, 'fill', color, context);
    text.textContent = content;
    out.appendChild(text);
  }
}

// ---------------------------------------------------------------------------
// HTML → SVG

function clipRect(context: FlattenContext, x: number, y: number, width: number, height: number, radius = 0) {
  const id = context.nextId('clip');
  const clip = el('clipPath', { id });
  clip.appendChild(el('rect', { x: round(x), y: round(y), width: round(width), height: round(height), ...(radius > 0 ? { rx: round(radius) } : {}) }));
  context.defs.appendChild(clip);
  return `url(#${id})`;
}

function inlineSvgIcon(source: SVGSVGElement, box: { x: number; y: number; width: number; height: number }, color: string, out: SVGElement, context: FlattenContext) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('class');
  clone.setAttribute('x', String(round(box.x)));
  clone.setAttribute('y', String(round(box.y)));
  clone.setAttribute('width', String(round(box.width)));
  clone.setAttribute('height', String(round(box.height)));
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    node.removeAttribute('class');
    for (const attribute of ['fill', 'stroke']) {
      if (node.getAttribute(attribute)?.toLowerCase() === 'currentcolor') setPaint(node, attribute, color, context);
    }
  }
  out.appendChild(clone);
}

function paintBox(style: CSSStyleDeclaration, box: { x: number; y: number; width: number; height: number }, out: SVGElement, context: FlattenContext) {
  const radius = Math.min(parseFloat(style.borderTopLeftRadius) || 0, box.width / 2, box.height / 2);
  if (!isPaintless(style.backgroundColor, context)) {
    const rect = el('rect', { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
    if (radius > 0) rect.setAttribute('rx', String(round(radius)));
    setPaint(rect, 'fill', style.backgroundColor, context);
    out.appendChild(rect);
  }
  const sides = (['Top', 'Right', 'Bottom', 'Left'] as const).map((side) => ({
    side,
    width: style[`border${side}Style`] === 'none' ? 0 : parseFloat(style[`border${side}Width`]) || 0,
    color: style[`border${side}Color`],
  }));
  const drawn = sides.filter((side) => side.width > 0 && !isPaintless(side.color, context));
  if (drawn.length === 0) return;
  const uniform = drawn.length === 4 && drawn.every((side) => side.width === drawn[0].width && side.color === drawn[0].color);
  if (uniform) {
    const width = drawn[0].width;
    const rect = el('rect', { x: round(box.x + width / 2), y: round(box.y + width / 2), width: round(box.width - width), height: round(box.height - width), fill: 'none', 'stroke-width': round(width) });
    if (radius > 0) rect.setAttribute('rx', String(round(Math.max(0, radius - width / 2))));
    setPaint(rect, 'stroke', drawn[0].color, context);
    out.appendChild(rect);
    return;
  }
  for (const { side, width, color } of drawn) {
    const rect =
      side === 'Top'
        ? el('rect', { x: box.x, y: box.y, width: box.width, height: width })
        : side === 'Bottom'
          ? el('rect', { x: box.x, y: box.y + box.height - width, width: box.width, height: width })
          : side === 'Left'
            ? el('rect', { x: box.x, y: box.y, width, height: box.height })
            : el('rect', { x: box.x + box.width - width, y: box.y, width, height: box.height });
    setPaint(rect, 'fill', color, context);
    out.appendChild(rect);
  }
}

function convertElement(node: Element, origin: DOMRect, out: SVGElement, context: FlattenContext) {
  const style = getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden') return;
  const rect = node.getBoundingClientRect();
  const box = { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
  let target = out;
  const opacity = parseFloat(style.opacity);
  if (opacity < 1) {
    if (opacity <= 0) return;
    target = el('g', { opacity: round(opacity) });
    out.appendChild(target);
  }
  if (node instanceof SVGSVGElement) {
    inlineSvgIcon(node, box, style.color, target, context);
    return;
  }
  if (node instanceof HTMLImageElement) {
    // Resolved to the logo's own markup later (`inlineLogos`).
    target.appendChild(el('image', { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height), preserveAspectRatio: 'xMidYMid meet', 'data-export-src': node.src }));
    return;
  }
  paintBox(style, box, target, context);
  let childTarget: SVGElement = target;
  if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
    childTarget = el('g', { 'clip-path': clipRect(context, box.x, box.y, box.width, box.height) });
    target.appendChild(childTarget);
  }
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) convertText(child as Text, node as HTMLElement, style, origin, childTarget, context);
    else if (child.nodeType === Node.ELEMENT_NODE) convertElement(child as Element, origin, childTarget, context);
  }
  if (childTarget !== target && childTarget.childNodes.length === 0) childTarget.remove();
}

/** Inherited text properties a foreignObject's HTML picks up from the SVG
 *  around it — copied onto the measuring box so layout matches. */
const INHERITED = ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'white-space', 'text-align', 'direction', 'word-break', 'overflow-wrap'];

function convertForeignObject(foreignObject: SVGForeignObjectElement, context: FlattenContext): SVGGElement {
  const x = foreignObject.x.baseVal.value;
  const y = foreignObject.y.baseVal.value;
  const width = foreignObject.width.baseVal.value;
  const height = foreignObject.height.baseVal.value;
  const out = el('g');
  const clipPath = foreignObject.getAttribute('clip-path');
  if (clipPath) out.setAttribute('clip-path', clipPath);
  // A foreignObject clips its content to its own box.
  const boxed = el('g', { 'clip-path': clipRect(context, x, y, width, height) });
  const content = el('g', { transform: `translate(${round(x)} ${round(y)})` });
  boxed.appendChild(content);
  out.appendChild(boxed);

  const host = context.measureHost;
  const inherited = getComputedStyle(foreignObject);
  host.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;overflow:hidden;`;
  for (const property of INHERITED) host.style.setProperty(property, inherited.getPropertyValue(property));
  for (const child of foreignObject.childNodes) host.appendChild(child.cloneNode(true));
  const origin = host.getBoundingClientRect();
  for (const child of host.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) convertElement(child as Element, origin, content, context);
    else if (child.nodeType === Node.TEXT_NODE) convertText(child as Text, host, getComputedStyle(host), origin, content, context);
  }
  host.replaceChildren();
  return out;
}

// ---------------------------------------------------------------------------
// Native SVG: inline what the stylesheet used to supply

function dropShadowFilter(filter: string, context: FlattenContext): string | null {
  const shadows = [...filter.matchAll(/drop-shadow\((.*?\))\s*([-\d.]+)px\s+([-\d.]+)px(?:\s+([-\d.]+)px)?\)/g)];
  if (shadows.length === 0) return null;
  const id = context.nextId('shadow');
  const node = el('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%', 'color-interpolation-filters': 'sRGB' });
  shadows.forEach((shadow, index) => {
    const drop = el('feDropShadow', { dx: shadow[2], dy: shadow[3], stdDeviation: round((Number(shadow[4] ?? 0) || 0) / 2) });
    if (index > 0) drop.setAttribute('in', `s${index - 1}`);
    drop.setAttribute('result', `s${index}`);
    setPaint(drop, 'flood-color', shadow[1], context);
    node.appendChild(drop);
  });
  context.defs.appendChild(node);
  return `url(#${id})`;
}

function insideNonRendered(node: Element, root: SVGSVGElement) {
  for (let current: Element | null = node.parentElement; current && current !== root; current = current.parentElement) {
    if (NON_RENDERED.has(current.localName)) return true;
  }
  return false;
}

/** Read every computed value first, then write — reading after a write
 *  would force a style recalculation per element. */
function inlineStyles(root: SVGSVGElement, context: FlattenContext) {
  const writes: Array<() => void> = [];
  for (const node of [root, ...root.querySelectorAll('*')]) {
    if (node.closest('[data-export-src]')) continue;
    const name = node.localName;
    const hidden = insideNonRendered(node, root);
    const style = getComputedStyle(node);
    if (!hidden && node !== root && (style.display === 'none' || parseFloat(style.opacity) === 0)) {
      writes.push(() => node.remove());
      continue;
    }
    // Invisible hit areas (transparent fill and stroke) are interaction
    // scaffolding, not picture.
    if (!hidden && SHAPES.has(name) && isPaintless(style.fill, context) && isPaintless(style.stroke, context)) {
      writes.push(() => node.remove());
      continue;
    }
    const styled = node.hasAttribute('class') || node.hasAttribute('style');
    const paints: Array<[string, string]> = [];
    for (const attribute of ['fill', 'stroke'] as const) {
      if (node.hasAttribute(attribute) || (styled && (node as HTMLElement).style?.getPropertyValue(attribute))) paints.push([attribute, style[attribute]]);
      else if (styled && name !== 'svg' && name !== 'g' && style[attribute] !== getComputedStyle(node.parentElement ?? root)[attribute]) paints.push([attribute, style[attribute]]);
    }
    if (name === 'stop') paints.push(['stop-color', style.stopColor]);
    const numeric: Array<[string, string]> = [];
    if (styled) {
      if (style.opacity !== '1') numeric.push(['opacity', style.opacity]);
      if (SHAPES.has(name)) {
        numeric.push(['stroke-width', String(round(parseFloat(style.strokeWidth)))]);
        if (style.strokeDasharray !== 'none') numeric.push(['stroke-dasharray', style.strokeDasharray.replace(/px/g, '')]);
        if (style.strokeLinecap !== 'butt') numeric.push(['stroke-linecap', style.strokeLinecap]);
        if (style.strokeLinejoin !== 'miter') numeric.push(['stroke-linejoin', style.strokeLinejoin]);
      }
    }
    const filter = !hidden && style.filter && style.filter !== 'none' ? dropShadowFilter(style.filter, context) : null;
    // Native <text> (Line labels): fonts come from classes and var()s, and
    // `dominant-baseline` isn't read by every consumer — fold it into y.
    let textY: number | null = null;
    let textContent: string | null = null;
    if (name === 'text' && !node.closest('[data-export-flat]')) {
      const text = node as SVGTextElement;
      const baseline = style.dominantBaseline;
      if (baseline && baseline !== 'auto' && baseline !== 'alphabetic') {
        const before = text.getBBox().y;
        text.setAttribute('dominant-baseline', 'alphabetic');
        text.style.dominantBaseline = 'alphabetic';
        textY = (Number(text.getAttribute('y')) || 0) + before - text.getBBox().y;
      }
      if (style.textTransform !== 'none' && text.childElementCount === 0) textContent = applyTextTransform(text.textContent ?? '', style.textTransform);
      writes.push(() => textAttributes(text, style));
    }
    writes.push(() => {
      for (const [attribute, value] of numeric) node.setAttribute(attribute, value);
      for (const [attribute, value] of paints) setPaint(node, attribute, value, context);
      if (filter) node.setAttribute('filter', filter);
      if (textY !== null) {
        node.setAttribute('y', String(round(textY)));
        node.removeAttribute('dominant-baseline');
      }
      if (textContent !== null) node.textContent = textContent;
      for (const attribute of STRIP_ATTRIBUTES) node.removeAttribute(attribute);
      for (const attribute of [...node.attributes]) if (attribute.name.startsWith('data-') && attribute.name !== 'data-export-src') node.removeAttribute(attribute.name);
    });
  }
  for (const write of writes) write();
}

// ---------------------------------------------------------------------------
// Logos

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

async function inlineLogos(root: SVGSVGElement, context: FlattenContext) {
  const cache = new Map<string, Promise<string | null>>();
  const load = (src: string) => {
    if (!cache.has(src)) cache.set(src, fetch(src).then((response) => (response.ok ? response.text() : null)).catch(() => null));
    return cache.get(src)!;
  };
  for (const image of [...root.querySelectorAll('image[data-export-src]')]) {
    const src = image.getAttribute('data-export-src')!;
    image.removeAttribute('data-export-src');
    const markup = await load(src);
    if (!markup) {
      image.remove();
      continue;
    }
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const logo = parsed.documentElement;
    const selfStyled = parsed.querySelector('parsererror, style, script, foreignObject, image') !== null || logo.localName !== 'svg';
    if (selfStyled) {
      // A logo with its own stylesheet can't be merged into ours without
      // its class names leaking; a data-URI image keeps it sealed.
      image.setAttribute('href', `data:image/svg+xml;base64,${toBase64(markup)}`);
      continue;
    }
    const prefix = `${context.nextId('logo')}-`;
    const ids = new Set([...logo.querySelectorAll('[id]')].map((node) => node.id));
    for (const node of [logo, ...logo.querySelectorAll('*')]) {
      if (node.id) node.id = prefix + node.id;
      for (const attribute of [...node.attributes]) {
        let value = attribute.value;
        if (attribute.name === 'href' || attribute.name === 'xlink:href') {
          if (value.startsWith('#') && ids.has(value.slice(1))) value = `#${prefix}${value.slice(1)}`;
        } else if (value.includes('url(#')) {
          value = value.replace(/url\(#([^)]+)\)/g, (match, id: string) => (ids.has(id) ? `url(#${prefix}${id})` : match));
        }
        if (value !== attribute.value) node.setAttribute(attribute.name, value);
      }
    }
    const nested = document.importNode(logo, true) as unknown as SVGSVGElement;
    if (!nested.hasAttribute('viewBox')) {
      const width = parseFloat(nested.getAttribute('width') ?? '');
      const height = parseFloat(nested.getAttribute('height') ?? '');
      if (width > 0 && height > 0) nested.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    for (const attribute of ['x', 'y', 'width', 'height', 'preserveAspectRatio']) nested.setAttribute(attribute, image.getAttribute(attribute) ?? '');
    image.replaceWith(nested);
  }
}

// ---------------------------------------------------------------------------
// Fonts

function parseUnicodeRange(range: string): Array<[number, number]> {
  if (!range) return [[0, 0x10ffff]];
  return range.split(',').map((part) => {
    const token = part.trim().replace(/^U\+/i, '');
    if (token.includes('?')) return [parseInt(token.replace(/\?/g, '0'), 16), parseInt(token.replace(/\?/g, 'F'), 16)];
    const [start, end] = token.split('-');
    return [parseInt(start, 16), parseInt(end ?? start, 16)];
  });
}

function weightMatches(declared: string, weight: number) {
  const parts = declared.trim().split(/\s+/).map((part) => (part === 'normal' ? 400 : part === 'bold' ? 700 : Number(part)));
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) return true;
  return parts.length === 1 ? parts[0] === weight : weight >= parts[0] && weight <= parts[1];
}

const unquote = (value: string) => value.trim().replace(/^["']|["']$/g, '');

async function embedFonts(root: SVGSVGElement, defs: SVGDefsElement) {
  // What the picture uses: family (first in each stack) → weights → code points.
  const usage = new Map<string, { weights: Set<number>; codePoints: Set<number> }>();
  for (const text of root.querySelectorAll('text')) {
    const family = unquote((text.getAttribute('font-family') ?? '').split(',')[0] ?? '');
    if (!family) continue;
    const entry = usage.get(family) ?? { weights: new Set(), codePoints: new Set() };
    entry.weights.add(Number(text.getAttribute('font-weight') ?? 400) || 400);
    for (const character of text.textContent ?? '') entry.codePoints.add(character.codePointAt(0)!);
    usage.set(family, entry);
  }
  if (usage.size === 0) return;

  const rules: string[] = [];
  const fetches: Array<Promise<void>> = [];
  for (const sheet of document.styleSheets) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const rule of cssRules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = unquote(rule.style.getPropertyValue('font-family'));
      const entry = usage.get(family);
      if (!entry) continue;
      const declaredWeight = rule.style.getPropertyValue('font-weight') || '400';
      if (![...entry.weights].some((weight) => weightMatches(declaredWeight, weight))) continue;
      const unicodeRange = rule.style.getPropertyValue('unicode-range');
      const ranges = parseUnicodeRange(unicodeRange);
      if (![...entry.codePoints].some((point) => ranges.some(([start, end]) => point >= start && point <= end))) continue;
      const url = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/)?.[1];
      if (!url || url.startsWith('data:')) continue;
      const absolute = new URL(url, sheet.href ?? document.baseURI).href;
      fetches.push(
        fetch(absolute)
          .then((response) => (response.ok ? response.arrayBuffer() : null))
          .then((buffer) => {
            if (!buffer) return;
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
            const format = absolute.endsWith('.woff2') ? 'woff2' : absolute.endsWith('.woff') ? 'woff' : 'truetype';
            const fontStyle = rule.style.getPropertyValue('font-style') || 'normal';
            rules.push(
              `@font-face{font-family:"${family}";src:url(data:font/${format};base64,${btoa(binary)}) format("${format}");font-weight:${declaredWeight};font-style:${fontStyle};${unicodeRange ? `unicode-range:${unicodeRange};` : ''}}`,
            );
          })
          .catch(() => undefined),
      );
    }
  }
  await Promise.all(fetches);
  if (rules.length === 0) return;
  const style = el('style');
  style.textContent = rules.join('\n');
  defs.insertBefore(style, defs.firstChild);
}

// ---------------------------------------------------------------------------

/**
 * Flattens a rendered, attached `<svg>` in place into a standalone
 * document. Must run while the svg is in the page (styles and layout are
 * read from it); the caller serialises it afterwards.
 */
export async function flattenSvg(root: SVGSVGElement): Promise<void> {
  const defs = el('defs');
  root.insertBefore(defs, root.firstChild);
  let counter = 0;
  const measureCanvas = document.createElement('canvas').getContext('2d')!;
  const ascents = new Map<string, number>();
  const measureHost = document.createElement('div');
  // Off-screen but laid out: `getBoundingClientRect` and Range boxes work.
  const measureFrame = document.createElement('div');
  measureFrame.style.cssText = 'position:fixed;left:-200000px;top:0;width:0;height:0;overflow:visible;pointer-events:none;';
  measureFrame.appendChild(measureHost);
  document.body.appendChild(measureFrame);
  const context: FlattenContext = {
    defs,
    nextId: (prefix) => `xft-${prefix}-${(counter += 1)}`,
    color: createColorParser(),
    ascent: (font) => {
      if (!ascents.has(font)) {
        measureCanvas.font = font;
        ascents.set(font, measureCanvas.measureText('Hg').fontBoundingBoxAscent);
      }
      return ascents.get(font)!;
    },
    textWidth: (font, text) => {
      measureCanvas.font = font;
      return measureCanvas.measureText(text).width;
    },
    measureHost,
  };
  try {
    for (const foreignObject of [...root.querySelectorAll('foreignObject')]) {
      const flat = convertForeignObject(foreignObject, context);
      flat.setAttribute('data-export-flat', '');
      foreignObject.replaceWith(flat);
    }
    inlineStyles(root, context);
    await inlineLogos(root, context);
    await embedFonts(root, defs);
    // Groups the passes above left empty (a removed hit area's wrapper…).
    for (const group of [...root.querySelectorAll('g')].reverse()) if (group.childNodes.length === 0) group.remove();
    for (const node of root.querySelectorAll('[data-export-flat]')) node.removeAttribute('data-export-flat');
  } finally {
    measureFrame.remove();
  }
}
