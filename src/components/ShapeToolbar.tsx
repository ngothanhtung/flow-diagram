'use client';

// Floating shape toolbar modelled after Figma's tool dock. The toolbar
// hosts three groups of controls:
//
//   1. A shape dropdown — click the trigger to open a grid of every
//      shape we can draw, and pick one to arm the canvas draw tool.
//   2. Quick-action icons for the line / arrow / curve tools (these
//      are placeholders for now; they stay visible so the dock matches
//      the screenshot but emit no behaviour yet).
//   3. A "More shapes" button that opens the same grid as a popover
//      anchored to the dock's right edge.
//
// When a shape is selected, the canvas picks it up via the lifted
// `activeShape` prop and arms the click‑drag draw gesture. Clicking
// the same shape again (or pressing Esc) deselects.

import { useEffect, useState } from 'react';
import { ChevronDown, Columns3, Group, List, SquareDashedBottomCode, Sticker, Table2, Type, UserSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { isShapeTool, SHAPES, type NodeShape } from '@/lib/node-style';
import type { DrawTool } from '@/lib/flowchart-types';

// Every shape exposed in the dock. We intentionally show only the
// silhouettes that read well at the dock's 16×16 icon size — UML
// component shapes (server, queue, document, …) are still drawable
// from the Inspector's shape picker but would clutter the dock.
const QUICK_SHAPES: ReadonlyArray<{ id: NodeShape; label: string }> = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'pill', label: 'Pill' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'triangle-down', label: 'Triangle Down' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'parallelogram', label: 'Parallelogram' },
  { id: 'trapezoid', label: 'Trapezoid' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'octagon', label: 'Octagon' },
  { id: 'cross', label: 'Cross' },
  { id: 'star', label: 'Star' },
  { id: 'arrow-right', label: 'Arrow' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'database', label: 'Cylinder' },
  { id: 'document', label: 'Document' },
  { id: 'note', label: 'Note' },
  { id: 'folder', label: 'Folder' },
];

// The shapes surfaced as one-click quick tools on the dock. These
// are the silhouettes users draw most often, so they sit right next
// to the shape picker instead of living inside a menu.
const QUICK_DRAW_SHAPES: ReadonlyArray<{ id: NodeShape; label: string }> = [
  { id: 'rectangle', label: 'Rectangle (R)' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'pill', label: 'Pill' },
  { id: 'diamond', label: 'Diamond' },
];

const DEFAULT_SHAPE: NodeShape = 'rectangle';

interface ShapeToolbarProps {
  activeShape: DrawTool | null;
  onSelect: (tool: DrawTool | null) => void;
}

export function ShapeToolbar({ activeShape, onSelect }: ShapeToolbarProps) {
  // The currently displayed shape in the dock trigger — when the
  // canvas finishes a draw it clears the active shape, so we keep
  // the last‑picked shape visible in the trigger until the user
  // picks something else. Updated imperatively from `choose` to
  // avoid the cascading-render anti-pattern flagged by React.
  const [lastPicked, setLastPicked] = useState<NodeShape>(DEFAULT_SHAPE);

  // Controlled open state for both popovers. We don't rely on the
  // base-ui Menu.Item `onSelect` because the children are <button>
  // elements (so the click event never bubbles to the Menu.Item
  // wrapper). Instead, each grid button calls `choose` and closes
  // its menu explicitly.
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

  const choose = (shape: NodeShape) => {
    setLastPicked(shape);
    onSelect(shape);
    setShapeMenuOpen(false);
  };

  // Esc clears the active tool — the Figma shortcut every user knows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeShape) onSelect(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeShape, onSelect]);

  return (
    <div
      // The dock is a fixed-width row of ~10 controls; on a narrow phone
      // viewport that's wider than the screen. `max-w` caps it to the
      // viewport (minus a margin) and `overflow-x-auto` turns the excess
      // into a horizontal scroll instead of clipping past the screen edge
      // (it's still centered via the translate, just scrollable within).
      className='pointer-events-auto absolute left-1/2 bottom-4 z-20 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-lg bg-popover/92 p-0.5 text-muted-foreground ring-1 ring-border shadow-[0_14px_40px_rgba(0,0,0,.28)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      role='toolbar'
      aria-label='Shape drawing tools'
    >
      {/* Shape picker — arms the canvas draw tool. A small dropdown
          exposes every shape; the most common ones also appear as
          one-click buttons to the right. */}
      <DropdownMenu open={shapeMenuOpen} onOpenChange={setShapeMenuOpen}>
        <DropdownMenuTrigger
          render={<Button variant='ghost' />}
          className='group h-7 gap-0.5 pl-2 pr-1 text-muted-foreground data-popup-open:bg-cyan-400/12 data-popup-open:text-cyan-700 dark:text-cyan-100'
          aria-label='Choose a shape to draw'
        >
          {/* Every non-shape tool (table, lane, fragment, text, icon,
              legend, lifeline) has its own button, so the shape trigger
              keeps showing the last picked silhouette while one of them
              is armed. */}
          <ShapeIcon shape={activeShape && isShapeTool(activeShape) ? activeShape : lastPicked} size={16} />
          <ChevronDown size={10} className='opacity-70 transition group-data-popup-open:rotate-180' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='center' sideOffset={10} className='w-[min(420px,90vw)] border-border bg-popover/98 p-3 shadow-[0_22px_70px_rgba(0,0,0,.4)] backdrop-blur-xl'>
          <div className='mb-2 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground'>Shapes</div>
          <div className='grid grid-cols-6 gap-1.5'>
            {QUICK_SHAPES.map((shape) => {
              const isActive = activeShape === shape.id;
              return (
                <Button
                  key={shape.id}
                  variant='ghost'
                  onClick={() => choose(shape.id)}
                  aria-pressed={isActive}
                  className={['h-12 w-12 ring-1', isActive ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-cyan-400/40' : 'text-muted-foreground ring-border'].join(' ')}
                  title={shape.label}
                  aria-label={shape.label}
                >
                  <ShapeIcon shape={shape.id} size={24} />
                </Button>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      {/* Quick-draw buttons — the shapes users reach for most often,
          surfaced as one-click toggles just like the Figma dock. */}
      {QUICK_DRAW_SHAPES.map((shape) => {
        const isActive = activeShape === shape.id;
        return (
          <Button
            key={shape.id}
            variant='ghost'
            size='icon-sm'
            onClick={() => (isActive ? onSelect(null) : choose(shape.id))}
            aria-pressed={isActive}
            className={isActive ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
            title={shape.label}
            aria-label={shape.label}
          >
            <ShapeIcon shape={shape.id} size={16} />
          </Button>
        );
      })}

      <Divider />

      {/* Database table — draws a card with a starter column list rather
          than a plain silhouette, but arms the same draw gesture. */}
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => (activeShape === 'table' ? onSelect(null) : onSelect('table'))}
        aria-pressed={activeShape === 'table'}
        className={activeShape === 'table' ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
        title='Database table'
        aria-label='Database table'
      >
        <Table2 size={16} />
      </Button>

      <Divider />

      {/* Swimlane — a group frame pre-styled as a band or column, with a
          numbered header. Drawn tall it reads as a column, wide as a
          band; the inspector then tiles the next one alongside. */}
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => (activeShape === 'lane' ? onSelect(null) : onSelect('lane'))}
        aria-pressed={activeShape === 'lane'}
        className={activeShape === 'lane' ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
        title='Swimlane'
        aria-label='Swimlane'
      >
        <Columns3 size={16} />
      </Button>

      <Divider />

      {/* Group frame — a container blocks are dropped into. Drawing one
          over existing blocks adopts them straight away. */}
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => (activeShape === 'group' ? onSelect(null) : onSelect('group'))}
        aria-pressed={activeShape === 'group'}
        className={activeShape === 'group' ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
        title='Group frame'
        aria-label='Group frame'
      >
        <Group size={16} />
      </Button>

      <Divider />

      {/* Free text — words on the canvas with no box around them. */}
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => (activeShape === 'text' ? onSelect(null) : onSelect('text'))}
        aria-pressed={activeShape === 'text'}
        className={activeShape === 'text' ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
        title='Text'
        aria-label='Text'
      >
        <Type size={16} />
      </Button>

      <Divider />

      {/* Free icon/logo — the graphic counterpart to Text: a single glyph
          or brand mark on the canvas, positioned and resized on its own,
          with no card or block around it. */}
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => (activeShape === 'icon' ? onSelect(null) : onSelect('icon'))}
        aria-pressed={activeShape === 'icon'}
        className={activeShape === 'icon' ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
        title='Icon / logo'
        aria-label='Icon / logo'
      >
        <Sticker size={16} />
      </Button>

      <Divider />

      {/* Legend — the key naming the diagram's colour and line
          vocabulary, which every reference diagram carries. */}
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => (activeShape === 'legend' ? onSelect(null) : onSelect('legend'))}
        aria-pressed={activeShape === 'legend'}
        className={activeShape === 'legend' ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
        title='Legend'
        aria-label='Legend'
      >
        <List size={16} />
      </Button>

      <Divider />

      {/* Sequence diagram: a participant's lifeline, and the alt/opt/loop
          band that frames a stretch of the exchange. */}
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => (activeShape === 'lifeline' ? onSelect(null) : onSelect('lifeline'))}
        aria-pressed={activeShape === 'lifeline'}
        className={activeShape === 'lifeline' ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
        title='Lifeline (sequence participant)'
        aria-label='Lifeline'
      >
        <UserSquare size={16} />
      </Button>

      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => (activeShape === 'fragment' ? onSelect(null) : onSelect('fragment'))}
        aria-pressed={activeShape === 'fragment'}
        className={activeShape === 'fragment' ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100 ring-1 ring-cyan-400/40' : 'text-muted-foreground'}
        title='Fragment band (alt / opt / loop)'
        aria-label='Fragment band'
      >
        <SquareDashedBottomCode size={16} />
      </Button>
    </div>
  );
}

/**
 * Renders any NodeShape as a 24-px icon by reusing the SHAPES path
 * table. The SHAPES paths are authored inside a 112×112 box
 * (NODE_BOUNDING_RADIUS = 56) so the icon viewBox maps them cleanly.
 */
function ShapeIcon({ shape, size = 18 }: { shape: NodeShape; size?: number }) {
  const spec = SHAPES[shape];
  return (
    <svg width={size} height={size} viewBox='-60 -60 120 120' fill='none' stroke='currentColor' strokeWidth={4} strokeLinejoin='round' strokeLinecap='round' vectorEffect='non-scaling-stroke' className='shrink-0' aria-hidden='true'>
      {shape === 'ellipse' ? <ellipse cx={0} cy={0} rx={56} ry={36} /> : <path d={spec.d} />}
    </svg>
  );
}

function Divider() {
  return <Separator orientation='vertical' className='self-stretch bg-border' />;
}
