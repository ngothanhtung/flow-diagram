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
import {
  ArrowUpRight,
  ChevronDown,
  Minus,
  Spline,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SHAPES, type NodeShape } from '@/lib/node-style';

// Every shape exposed in the dock. We intentionally show only the
// silhouettes that read well at the dock's 18×18 icon size — UML
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
  { id: 'ellipse', label: 'Ellipse (E)' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'database', label: 'Cylinder' },
  { id: 'document', label: 'Document' },
];

const DEFAULT_SHAPE: NodeShape = 'rectangle';

interface ShapeToolbarProps {
  activeShape: NodeShape | null;
  onSelect: (shape: NodeShape | null) => void;
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const choose = (shape: NodeShape) => {
    setLastPicked(shape);
    onSelect(shape);
    setShapeMenuOpen(false);
    setMoreMenuOpen(false);
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
      className="pointer-events-auto absolute left-1/2 bottom-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-zinc-900/92 p-1.5 text-zinc-300 ring-1 ring-white/12 shadow-[0_14px_40px_rgba(0,0,0,.48),0_0_24px_rgba(34,211,238,.08)] backdrop-blur-xl"
      role="toolbar"
      aria-label="Shape drawing tools"
    >
      {/* Shape picker — arms the canvas draw tool. A small dropdown
          exposes every shape; the most common ones also appear as
          one-click buttons to the right. */}
      <DropdownMenu open={shapeMenuOpen} onOpenChange={setShapeMenuOpen}>
        <DropdownMenuTrigger
          className="group inline-flex h-9 items-center gap-1 rounded-lg pl-2.5 pr-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 transition hover:bg-white/8 data-popup-open:bg-cyan-400/12 data-popup-open:text-cyan-100"
          aria-label="Choose a shape to draw"
        >
          <ShapeIcon shape={activeShape ?? lastPicked} size={18} />
          <ChevronDown
            size={11}
            className="opacity-70 transition group-data-popup-open:rotate-180"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          sideOffset={10}
          className="w-[min(420px,90vw)] border-white/10 bg-zinc-950/98 p-3 shadow-[0_22px_70px_rgba(0,0,0,.68)] backdrop-blur-xl"
        >
          <div className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Shapes
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {QUICK_SHAPES.map((shape) => {
              const isActive = activeShape === shape.id;
              return (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => choose(shape.id)}
                  className={[
                    'flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg ring-1 transition',
                    isActive
                      ? 'bg-cyan-400/15 text-cyan-100 ring-cyan-400/40'
                      : 'text-zinc-300 ring-white/8 hover:bg-white/8 hover:text-zinc-100',
                  ].join(' ')}
                  title={shape.label}
                  aria-label={shape.label}
                >
                  <ShapeIcon shape={shape.id} size={20} />
                  <span className="text-[8px] font-semibold uppercase tracking-wider opacity-70">
                    {shape.label.split(' ')[0]}
                  </span>
                </button>
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
          <button
            key={shape.id}
            type="button"
            onClick={() => (isActive ? onSelect(null) : choose(shape.id))}
            className={[
              'flex h-9 w-9 items-center justify-center rounded-lg transition',
              isActive
                ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/40'
                : 'text-zinc-300 hover:bg-white/8 hover:text-zinc-100',
            ].join(' ')}
            title={shape.label}
            aria-label={shape.label}
          >
            <ShapeIcon shape={shape.id} size={18} />
          </button>
        );
      })}

      <Divider />

      {/* Quick-action placeholders. These match the screenshot but the
          behaviours land in a follow‑up phase. */}
      <QuickAction
        label="Connect curve (coming soon)"
        icon={<Spline size={16} />}
      />
      <QuickAction
        label="Connect sharp (coming soon)"
        icon={<Spline size={16} className="rotate-90" />}
      />
      <QuickAction
        label="Arrow (coming soon)"
        icon={<ArrowUpRight size={16} />}
      />
      <QuickAction
        label="Line (coming soon)"
        icon={<Minus size={16} className="-rotate-45" />}
      />

      <Divider />

      <DropdownMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[10px] font-semibold text-zinc-300 transition hover:bg-white/8 data-popup-open:bg-cyan-400/12 data-popup-open:text-cyan-100">
          More shapes
          <ChevronDown size={11} className="opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-[min(420px,90vw)] border-white/10 bg-zinc-950/98 p-3 shadow-[0_22px_70px_rgba(0,0,0,.68)] backdrop-blur-xl"
        >
          <div className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            All shapes
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {QUICK_SHAPES.map((shape) => {
              const isActive = activeShape === shape.id;
              return (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => choose(shape.id)}
                  className={[
                    'flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg ring-1 transition',
                    isActive
                      ? 'bg-cyan-400/15 text-cyan-100 ring-cyan-400/40'
                      : 'text-zinc-300 ring-white/8 hover:bg-white/8 hover:text-zinc-100',
                  ].join(' ')}
                  title={shape.label}
                  aria-label={shape.label}
                >
                  <ShapeIcon shape={shape.id} size={20} />
                  <span className="text-[8px] font-semibold uppercase tracking-wider opacity-70">
                    {shape.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
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
    <svg
      width={size}
      height={size}
      viewBox="-60 -60 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      className="shrink-0"
      aria-hidden="true"
    >
      {shape === 'ellipse' ? (
        <ellipse cx={0} cy={0} rx={56} ry={36} />
      ) : (
        <path d={spec.d} />
      )}
    </svg>
  );
}

function Divider() {
  return <div className="mx-0.5 h-6 w-px bg-white/10" aria-hidden="true" />;
}

function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      aria-disabled="true"
      className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg text-zinc-600 opacity-70"
    >
      {icon}
    </span>
  );
}
