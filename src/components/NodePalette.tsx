'use client';

// Left rail palette. The user pointer-downs on a tile, drags it
// across the canvas, and releases over the canvas to drop a new
// node there. We track the drag with window-level pointer listeners
// so the gesture survives the cursor leaving the palette bounds.

import { useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Cog,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import type { NodePreset, NodeType } from '@/lib/flowchart-types';

const ITEMS: Array<NodePreset & { iconView: LucideIcon }> = [
  { id: 'start', type: 'start', label: 'Start', iconView: CircleDashed },
  { id: 'process', type: 'process', label: 'Process', iconView: Cog },
  { id: 'decision', type: 'decision', label: 'Decision', shape: 'diamond', icon: 'play', iconView: GitBranch },
  { id: 'output', type: 'output', label: 'Output', iconView: CheckCircle2 },
];

interface NodePaletteProps {
  /** Called when the user starts dragging a tile. */
  onDragStart: (preset: NodePreset, e: React.PointerEvent) => void;
  /** Called on every pointermove while a palette tile is being dragged. */
  onDragMove: (preset: NodePreset, e: React.PointerEvent) => void;
  /** Called on pointerup — `dropped` is true if the pointer was released over the canvas. */
  onDragEnd: (preset: NodePreset, e: React.PointerEvent, dropped: boolean) => void;
  /** Type currently being dragged, if any — used to highlight the active tile. */
  draggingPreset: NodePreset | null;
}

export function NodePalette({
  onDragStart,
  onDragMove,
  onDragEnd,
  draggingPreset,
}: NodePaletteProps) {
  // Track which tile is pressed down so we can attach a single
  // window-level move/up listener instead of one per tile.
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="flex w-20 flex-col items-center gap-2 overflow-y-auto rounded-2xl bg-zinc-900/70 p-2 ring-1 ring-white/10 backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Nodes
      </div>
      {ITEMS.map((preset) => {
        const Icon = preset.iconView;
        return (
        <button
          key={preset.id}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setActive(preset.id);
            onDragStart(preset, e);
            const onMove = (ev: PointerEvent) => onDragMove(preset, ev as unknown as React.PointerEvent);
            const onUp = (ev: PointerEvent) => {
              // Hit-test: was the pointer released over the canvas? The
              // canvas root is identified by the [data-flowgram-canvas]
              // attribute. elementFromPoint is reliable for native
              // pointer events fired by the browser, so we don't have
              // to thread React synthetic events across the gesture.
              const target = globalThis.document.elementFromPoint(ev.clientX, ev.clientY);
              const dropped = !!target?.closest('[data-flowgram-canvas]');
              onDragEnd(preset, ev as unknown as React.PointerEvent, dropped);
              setActive(null);
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              window.removeEventListener('pointercancel', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
          }}
          className={[
            'group flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-xl ring-1 transition',
            tintFor(preset.type),
            active === preset.id || draggingPreset?.id === preset.id
              ? 'scale-95 ring-2'
              : 'hover:scale-[1.04]',
          ].join(' ')}
          title={`Add ${preset.label}`}
        >
          <Icon size={18} />
          <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
            {preset.label}
          </span>
        </button>
      );})}

      <p className="mt-2 border-t border-white/8 pt-3 text-center text-[9px] leading-relaxed text-zinc-500">
        Drag a node, then choose its shape in Inspector
      </p>
    </div>
  );
}

function tintFor(type: NodeType): string {
  switch (type) {
    case 'start': return 'bg-sky-500/15 text-sky-300 ring-sky-400/40';
    case 'process': return 'bg-indigo-500/15 text-indigo-300 ring-indigo-400/40';
    case 'decision': return 'bg-amber-500/15 text-amber-300 ring-amber-400/40';
    case 'output': return 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/40';
    case 'logo': return 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/40';
    case 'group': return 'bg-violet-500/15 text-violet-300 ring-violet-400/40';
    case 'text': return 'bg-sky-500/15 text-sky-300 ring-sky-400/40';
    case 'icon': return 'bg-sky-500/15 text-sky-300 ring-sky-400/40';
    case 'legend': return 'bg-sky-500/15 text-sky-300 ring-sky-400/40';
  }
}
