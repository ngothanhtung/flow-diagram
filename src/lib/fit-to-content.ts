'use client';

// "Fit to content" for blocks, text and free icon/logo objects — shrinks
// or grows a node's box to snugly wrap what it actually renders, instead
// of leaving that entirely to a manual drag. Group frames already have
// this (`groupGeometryFor`, member-bounds based); these are the
// content-based counterpart for the three node kinds that paint their
// own text/glyph rather than containing other nodes.
//
// There's no cheap way to know a glyph's rendered extent without asking
// the browser, so text/block fitting mounts a hidden, DOM-attached
// replica of the node's content — the same Tailwind classes and inline
// styles `FlowNodeCard` renders with — measures its natural size, then
// removes it. It has to be attached to the live document: the font
// families are `var(--font-...)` custom properties that only resolve
// inside the real page cascade, not on a detached node.

import type { FlowNode } from './flowchart-types';
import { NODE_FONT_FAMILIES, NODE_FONT_WEIGHTS } from './node-fonts';
import { TEXT_PADDING, nodeSizeLimits, resolveNodeStyle } from './node-style';

function measureNaturalSize(build: (container: HTMLDivElement) => void): { width: number; height: number } {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed; top:-99999px; left:-99999px; visibility:hidden; pointer-events:none; width:max-content; height:max-content;';
  document.body.appendChild(container);
  try {
    build(container);
    const rect = container.getBoundingClientRect();
    return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
  } finally {
    document.body.removeChild(container);
  }
}

function clampSize(node: FlowNode, width: number, height: number): { width: number; height: number } {
  const limits = nodeSizeLimits(node);
  return {
    width: Math.max(limits.minWidth, Math.min(limits.maxWidth, Math.round(width))),
    height: Math.max(limits.minHeight, Math.min(limits.maxHeight, Math.round(height))),
  };
}

/**
 * Text object: the box that exactly wraps `node.title` at its current
 * font — respecting the user's own line breaks (`white-space: pre`) but
 * not auto-wrapping, so the box hugs the longest line rather than
 * whatever width it happened to be dragged to.
 */
export function fitTextNodeSize(node: FlowNode): { width: number; height: number } {
  const style = resolveNodeStyle(node);
  const limits = nodeSizeLimits(node);
  if (!node.title?.trim()) return { width: limits.defaultWidth, height: limits.defaultHeight };

  const content = measureNaturalSize((container) => {
    const el = document.createElement('div');
    el.style.fontFamily = NODE_FONT_FAMILIES[style.fontFamily];
    el.style.fontSize = `${style.fontSize}px`;
    el.style.fontWeight = String(NODE_FONT_WEIGHTS[style.fontWeight]);
    el.style.lineHeight = '1.35';
    el.style.whiteSpace = 'pre';
    el.textContent = node.title;
    container.appendChild(el);
  });

  return clampSize(node, content.width + TEXT_PADDING * 2, content.height + TEXT_PADDING * 2);
}

/**
 * Free icon/logo object: a tight square around the glyph at its current
 * `iconSize`, plus a little breathing room. The glyph itself renders at
 * a fixed size independent of the box (see `FlowNodeCard`), so there's
 * nothing to measure — the box just needs to catch up to it.
 */
export function fitIconNodeSize(node: FlowNode): { width: number; height: number } {
  const style = resolveNodeStyle(node);
  const side = style.iconSize + 16;
  return clampSize(node, side, side);
}

/**
 * Ordinary block (process/start/decision/output cards, database tables,
 * and any legacy `type: 'logo'` node): the box that wraps the icon
 * badge + title + sub title cluster `FlowNodeCard` actually lays out,
 * plus the same padding formula the card itself uses.
 *
 * `cardPadding` is normally derived from the *final* width/height
 * (`Math.min(width, height) * 0.13`) — a small self-reference that would
 * need iterating to solve exactly. Using the unpadded content size as
 * the stand-in is close enough for a one-click convenience action; the
 * result is still a plain, editable width/height afterwards.
 */
export function fitBlockNodeSize(node: FlowNode): { width: number; height: number } {
  const style = resolveNodeStyle(node);
  const limits = nodeSizeLimits(node);
  const hasIcon = style.icon !== null;
  const title = node.title ?? '';
  const description = node.description?.trim();

  if (!hasIcon && !title.trim() && !description) {
    return { width: limits.defaultWidth, height: limits.defaultHeight };
  }

  const content = measureNaturalSize((container) => {
    const cluster = document.createElement('div');
    cluster.style.display = 'flex';
    cluster.style.flexDirection = style.iconPosition === 'top' ? 'column' : 'row';
    cluster.style.alignItems = 'center';
    cluster.style.gap = hasIcon ? (style.iconPosition === 'top' ? '7px' : '12px') : '0px';

    if (hasIcon) {
      const badge = document.createElement('div');
      const size = `${style.iconSize + 25}px`;
      badge.style.width = size;
      badge.style.height = size;
      badge.style.flexShrink = '0';
      cluster.appendChild(badge);
    }

    const textStack = document.createElement('div');
    textStack.style.width = 'fit-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'leading-tight tracking-tight';
    titleEl.style.fontFamily = NODE_FONT_FAMILIES[style.fontFamily];
    titleEl.style.fontSize = `${style.fontSize}px`;
    titleEl.style.fontWeight = String(NODE_FONT_WEIGHTS[style.fontWeight]);
    titleEl.style.whiteSpace = 'pre';
    titleEl.textContent = title;
    textStack.appendChild(titleEl);

    if (description) {
      const descriptionEl = document.createElement('div');
      descriptionEl.className = 'mt-1 leading-tight';
      descriptionEl.style.fontFamily = NODE_FONT_FAMILIES[style.fontFamily];
      descriptionEl.style.fontSize = `${Math.max(9, style.fontSize - 4)}px`;
      descriptionEl.style.whiteSpace = 'pre';
      descriptionEl.textContent = description;
      textStack.appendChild(descriptionEl);
    }

    cluster.appendChild(textStack);
    container.appendChild(cluster);
  });

  const cardPadding = Math.max(10, Math.min(content.width, content.height) * 0.13);
  return clampSize(node, content.width + 2 * (cardPadding + 8), content.height + 2 * cardPadding);
}
