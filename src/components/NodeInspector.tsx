'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  Copy,
  PanelLeft,
  PanelTop,
  RotateCcw,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type {
  ConnectionSide,
  FlowNode,
} from '@/lib/flowchart-types';
import {
  COLORS,
  ICONS,
  SHAPES,
  resolveNodeStyle,
  type NodeColor,
  type NodeIcon,
  type NodeShape,
} from '@/lib/node-style';
import { NODE_FONT_FAMILIES, NODE_FONT_OPTIONS } from '@/lib/node-fonts';

interface NodeInspectorProps {
  node: FlowNode | null;
  onUpdate: (id: string, patch: Partial<Omit<FlowNode, 'id'>>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const COLOR_HEX: Record<NodeColor, string> = {
  sky: '#0ea5e9',
  indigo: '#6366f1',
  amber: '#f59e0b',
  emerald: '#10b981',
  rose: '#f43f5e',
  violet: '#8b5cf6',
};

const SIDES: {
  value: ConnectionSide;
  label: string;
  Icon: typeof ArrowUp;
}[] = [
  { value: 'top', label: 'Top', Icon: ArrowUp },
  { value: 'right', label: 'Right', Icon: ArrowRight },
  { value: 'bottom', label: 'Bottom', Icon: ArrowDown },
  { value: 'left', label: 'Left', Icon: ArrowLeft },
];

const ICON_GROUPS = [
  {
    label: 'Lucide',
    icons: (Object.keys(ICONS) as NodeIcon[]).filter(
      (key) => !key.startsWith('tabler:'),
    ),
  },
  {
    label: 'Tabler',
    icons: (Object.keys(ICONS) as NodeIcon[]).filter((key) =>
      key.startsWith('tabler:'),
    ),
  },
];

export function NodeInspector({
  node,
  onUpdate,
  onDuplicate,
  onDelete,
  onClose,
}: NodeInspectorProps) {
  // Local draft so the user can type without every keystroke mutating
  // the document. Commit on blur, Enter, or type change.
  const [title, setTitle] = useState(node?.title ?? '');
  const [description, setDescription] = useState(node?.description ?? '');
  const [shapeQuery, setShapeQuery] = useState('');

  if (!node) {
    return (
      <div className="rounded-xl bg-zinc-900/70 p-4 ring-1 ring-white/10">
        <h2 className="text-sm font-semibold">Inspector</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Click a node to inspect and edit it. Drag from a node&apos;s
          output port to another node&apos;s input port to connect them.
        </p>
      </div>
    );
  }

  const style = resolveNodeStyle(node);
  const currentShape: NodeShape = style.shape;
  const currentIcon: NodeIcon | null = style.icon;
  const filteredShapes = (Object.keys(SHAPES) as NodeShape[]).filter((shape) =>
    SHAPES[shape].label.toLowerCase().includes(shapeQuery.trim().toLowerCase()),
  );
  const connectionPoints = node.connectionPoints ?? {
    input: 'left' as const,
    output: 'right' as const,
  };

  return (
    <div className="rounded-xl bg-zinc-900/70 p-4 ring-1 ring-sky-400/30">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Inspector</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          close
        </button>
      </div>

      <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {node.id}
      </p>

      <SectionLabel>Geometry</SectionLabel>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
        Drag one of the 4 corner handles, or enter an exact size below.
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <NumberField
          label="X"
          value={Math.round(node.position.x)}
          onChange={(x) =>
            onUpdate(node.id, { position: { ...node.position, x } })
          }
        />
        <NumberField
          label="Y"
          value={Math.round(node.position.y)}
          onChange={(y) =>
            onUpdate(node.id, { position: { ...node.position, y } })
          }
        />
        <NumberField
          label="Width"
          value={style.width}
          min={72}
          max={320}
          onChange={(width) => onUpdate(node.id, { width })}
        />
        <NumberField
          label="Height"
          value={style.height}
          min={72}
          max={240}
          onChange={(height) => onUpdate(node.id, { height })}
        />
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {[
          { label: 'Compact', width: 96, height: 72 },
          { label: 'Square', width: 112, height: 112 },
          { label: 'Wide', width: 180, height: 96 },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
              onUpdate(node.id, {
                width: preset.width,
                height: preset.height,
              })
            }
            className="rounded-md bg-white/5 px-1 py-1 text-[9px] text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-zinc-100"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <RangeField
        label="Rotation"
        value={style.rotation}
        min={-180}
        max={180}
        suffix="°"
        onChange={(rotation) => onUpdate(node.id, { rotation })}
      />
      <NumberField
        label="Sort order · 0 = auto"
        value={node.sortOrder ?? 0}
        min={0}
        step={1}
        onChange={(sortOrder) =>
          onUpdate(node.id, { sortOrder: sortOrder > 0 ? sortOrder : undefined })
        }
      />

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Title
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title !== node.title) onUpdate(node.id, { title });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="mt-1 w-full rounded-md bg-zinc-800/80 px-2 py-1 text-sm text-zinc-100 ring-1 ring-white/10 outline-none focus:ring-sky-400/60"
      />

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Sub title
      </label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => {
          if (description !== (node.description ?? '')) {
            onUpdate(node.id, { description });
          }
        }}
        rows={2}
        className="mt-1 w-full resize-none rounded-md bg-zinc-800/80 px-2 py-1 text-xs text-zinc-100 ring-1 ring-white/10 outline-none focus:ring-sky-400/60"
      />

      <SectionLabel>Typography</SectionLabel>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {NODE_FONT_OPTIONS.map((option) => {
          const selected = style.fontFamily === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onUpdate(node.id, { fontFamily: option.value })}
              aria-pressed={selected}
              className={[
                'min-w-0 rounded-lg px-2.5 py-2 text-left ring-1 transition',
                selected
                  ? 'bg-sky-400/12 text-sky-100 ring-sky-400/55'
                  : 'bg-white/4 text-zinc-300 ring-white/10 hover:bg-white/8 hover:ring-white/20',
              ].join(' ')}
            >
              <span
                className="block truncate text-[11px] font-semibold"
                style={{ fontFamily: NODE_FONT_FAMILIES[option.value] }}
              >
                {option.character}
              </span>
              <span className="mt-0.5 block truncate text-[8px] text-zinc-500">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <NumberField
          label="Font size"
          value={style.fontSize}
          min={10}
          max={28}
          onChange={(fontSize) => onUpdate(node.id, { fontSize })}
        />
        <label className="rounded-md bg-white/5 px-2 py-1.5 ring-1 ring-white/10">
          <span className="block text-[9px] text-zinc-500">Weight</span>
          <select
            value={style.fontWeight}
            onChange={(event) =>
              onUpdate(node.id, {
                fontWeight: event.target.value as FlowNode['fontWeight'],
              })
            }
            className="mt-0.5 w-full bg-transparent text-[11px] text-zinc-200 outline-none"
          >
            <option value="normal">Normal</option>
            <option value="medium">Medium</option>
            <option value="semibold">Semibold</option>
            <option value="bold">Bold</option>
          </select>
        </label>
      </div>
      <SegmentedButtons
        label="Alignment"
        value={style.textAlign}
        options={[
          { value: 'left', label: 'Left', Icon: AlignLeft },
          { value: 'center', label: 'Center', Icon: AlignCenter },
          { value: 'right', label: 'Right', Icon: AlignRight },
        ]}
        onChange={(textAlign) => onUpdate(node.id, { textAlign })}
      />

      {/* --- Shape ------------------------------------------------- */}
      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Shape
      </label>
      <label className="mt-1.5 flex items-center gap-2 rounded-lg bg-black/25 px-2.5 py-2 ring-1 ring-white/10 focus-within:ring-violet-400/70">
        <Search size={15} className="shrink-0 text-zinc-500" />
        <input
          value={shapeQuery}
          onChange={(event) => setShapeQuery(event.target.value)}
          placeholder="Search for a shape"
          className="min-w-0 flex-1 bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </label>
      <div className="mt-2 grid max-h-64 grid-cols-5 gap-1.5 overflow-y-auto rounded-xl bg-black/20 p-1.5 ring-1 ring-white/8">
        {filteredShapes.map((shapeKey) => {
          const spec = SHAPES[shapeKey];
          const isActive = currentShape === shapeKey;
          return (
            <button
              key={shapeKey}
              type="button"
              onClick={() => onUpdate(node.id, { shape: shapeKey })}
              title={spec.label}
              aria-pressed={isActive}
              className={[
                'group grid h-12 place-items-center rounded-lg transition',
                isActive
                  ? 'bg-violet-500 text-white shadow-[0_5px_16px_rgba(139,92,246,.3)] ring-1 ring-violet-300/70'
                  : 'bg-white/4 text-zinc-300 ring-1 ring-white/8 hover:bg-white/10 hover:text-white hover:ring-white/20',
              ].join(' ')}
            >
              <ShapeThumb
                shape={shapeKey}
                fill={isActive ? '#6d28d9' : style.background}
                stroke={isActive ? '#ffffff' : style.foreground}
              />
            </button>
          );
        })}
        {filteredShapes.length === 0 && (
          <p className="col-span-5 px-2 py-5 text-center text-[10px] text-zinc-500">
            No matching shapes
          </p>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-zinc-500">
        Selected: <span className="text-zinc-300">{SHAPES[currentShape].label}</span>
        <span className="float-right">{filteredShapes.length} shapes</span>
      </p>

      {/* --- Color ------------------------------------------------- */}
      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Color preset
      </label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(Object.keys(COLORS) as NodeColor[]).map((colorKey) => {
          const isActive =
            style.foreground === COLORS[colorKey].foreground &&
            style.background === COLORS[colorKey].background;
          return (
            <button
              key={colorKey}
              type="button"
              onClick={() =>
                onUpdate(node.id, {
                  color: COLORS[colorKey].foreground,
                  backgroundColor: COLORS[colorKey].background,
                })
              }
              title={colorKey}
              className={[
                'relative h-7 w-7 overflow-hidden rounded-full ring-1 ring-white/15 transition',
                isActive ? 'ring-2 ring-sky-300' : 'hover:scale-110',
              ].join(' ')}
              style={{ background: COLORS[colorKey].background }}
            >
              <span
                className="absolute inset-[7px] rounded-full"
                style={{ background: COLOR_HEX[colorKey] }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <ColorField
          label="Text / icon"
          value={style.foreground}
          onChange={(color) => onUpdate(node.id, { color })}
        />
        <ColorField
          label="Background"
          value={style.background}
          onChange={(backgroundColor) =>
            onUpdate(node.id, { backgroundColor })
          }
        />
        <ColorField
          label="Border"
          value={style.borderColor}
          onChange={(borderColor) => onUpdate(node.id, { borderColor })}
        />
        <NumberField
          label="Border width"
          value={style.borderWidth}
          min={0}
          max={8}
          step={0.5}
          onChange={(borderWidth) => onUpdate(node.id, { borderWidth })}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <SelectField
          label="Border style"
          value={style.borderStyle}
          options={['solid', 'dashed', 'dotted']}
          onChange={(borderStyle) => onUpdate(node.id, { borderStyle })}
        />
        <SelectField
          label="Shadow"
          value={style.shadow}
          options={['none', 'soft', 'glow']}
          onChange={(shadow) => onUpdate(node.id, { shadow })}
        />
      </div>
      <RangeField
        label="Opacity"
        value={Math.round(style.opacity * 100)}
        min={20}
        max={100}
        suffix="%"
        onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })}
      />

      {/* --- Icon -------------------------------------------------- */}
      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Icon
      </label>
      <button
        type="button"
        onClick={() => onUpdate(node.id, { icon: null })}
        aria-pressed={currentIcon === null}
        className={[
          'mt-1.5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition',
          currentIcon === null
            ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/60'
            : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-zinc-200',
        ].join(' ')}
      >
        <Ban size={14} /> No icon
      </button>
      {ICON_GROUPS.map((group) => (
        <div key={group.label} className="mt-1.5">
          <p className="mb-1 text-[10px] text-zinc-500">{group.label}</p>
          <div className="grid grid-cols-7 gap-1">
            {group.icons.map((iconKey) => {
              const Icon = ICONS[iconKey];
              const isActive = currentIcon === iconKey;
              return (
                <button
                  key={iconKey}
                  type="button"
                  onClick={() => onUpdate(node.id, { icon: iconKey })}
                  title={iconKey.replace(/^(lucide|tabler):/, '')}
                  aria-label={`Use ${iconKey} icon`}
                  className={[
                    'flex h-8 items-center justify-center rounded-md transition',
                    isActive
                      ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/60'
                      : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10',
                  ].join(' ')}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {currentIcon !== null && (
        <>
          <RangeField
            label="Icon size"
            value={style.iconSize}
            min={12}
            max={48}
            suffix="px"
            onChange={(iconSize) => onUpdate(node.id, { iconSize })}
          />
          <SegmentedButtons
            label="Icon position"
            value={style.iconPosition}
            options={[
              { value: 'top', label: 'Top', Icon: PanelTop },
              { value: 'left', label: 'Left', Icon: PanelLeft },
            ]}
            onChange={(iconPosition) => onUpdate(node.id, { iconPosition })}
          />
        </>
      )}

      <div className="mt-3 flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Connection points
        </label>
        <button
          type="button"
          onClick={() =>
            onUpdate(node.id, {
              connectionPoints: { input: 'left', output: 'right' },
            })
          }
          title="Reset connection points"
          className="rounded p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
        >
          <RotateCcw size={12} />
        </button>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
        All four ports are active. These defaults are only used by older or
        template lines that do not yet store a specific side.
      </p>
      <ConnectionSidePicker
        label="Default input"
        value={connectionPoints.input}
        onChange={(input) =>
          onUpdate(node.id, {
            connectionPoints:
              input === connectionPoints.output
                ? {
                    input,
                    output: connectionPoints.input,
                  }
                : { ...connectionPoints, input },
          })
        }
      />
      <ConnectionSidePicker
        label="Default output"
        value={connectionPoints.output}
        onChange={(output) =>
          onUpdate(node.id, {
            connectionPoints:
              output === connectionPoints.input
                ? {
                    input: connectionPoints.output,
                    output,
                  }
                : { ...connectionPoints, output },
          })
        }
      />
      <RangeField
        label="Point size"
        value={style.portSize}
        min={4}
        max={14}
        suffix="px"
        onChange={(portSize) => onUpdate(node.id, { portSize })}
      />

      <SectionLabel>Actions</SectionLabel>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onDuplicate(node.id)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 hover:bg-white/10"
        >
          <Copy size={12} /> Duplicate
        </button>
        <button
          type="button"
          onClick={() =>
            onUpdate(node.id, {
              width: undefined,
              height: undefined,
              rotation: undefined,
              sortOrder: undefined,
              shape: undefined,
              color: undefined,
              backgroundColor: undefined,
              borderColor: undefined,
              borderWidth: undefined,
              borderStyle: undefined,
              opacity: undefined,
              shadow: undefined,
              icon: undefined,
              iconSize: undefined,
              iconPosition: undefined,
              fontSize: undefined,
              fontFamily: undefined,
              fontWeight: undefined,
              textAlign: undefined,
              portSize: undefined,
              connectionPoints: undefined,
            })
          }
          className="inline-flex items-center justify-center gap-1 rounded-md bg-white/5 px-2 py-1.5 text-[10px] font-semibold text-zinc-300 ring-1 ring-white/10 hover:bg-white/10"
        >
          <RotateCcw size={11} /> Reset
        </button>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/80">
        {children}
      </span>
      <span className="h-px flex-1 bg-white/8" />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-md bg-white/5 px-2 py-1.5 ring-1 ring-white/10 focus-within:ring-sky-400/50">
      <span className="block text-[9px] text-zinc-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          if (!Number.isNaN(event.target.valueAsNumber)) {
            onChange(event.target.valueAsNumber);
          }
        }}
        className="mt-0.5 w-full bg-transparent font-mono text-[11px] text-zinc-200 outline-none"
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-2 block">
      <span className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-zinc-300">{value}{suffix}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="mt-1 h-1.5 w-full cursor-pointer accent-sky-400"
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="rounded-md bg-white/5 px-2 py-1.5 ring-1 ring-white/10">
      <span className="block text-[9px] text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-0.5 w-full bg-transparent text-[11px] capitalize text-zinc-200 outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function SegmentedButtons<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; Icon: LucideIcon }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-[70px_1fr] items-center gap-2">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <div className="flex gap-1">
        {options.map(({ value: option, label: optionLabel, Icon }) => (
          <button
            key={option}
            type="button"
            title={optionLabel}
            onClick={() => onChange(option)}
            className={[
              'grid h-7 flex-1 place-items-center rounded-md ring-1 transition',
              value === option
                ? 'bg-sky-500/20 text-sky-100 ring-sky-400/60'
                : 'bg-white/5 text-zinc-500 ring-white/10 hover:text-zinc-200',
            ].join(' ')}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: `#${string}`;
  onChange: (value: `#${string}`) => void;
}) {
  return (
    <label className="rounded-md bg-white/5 p-2 ring-1 ring-white/10">
      <span className="block text-[10px] text-zinc-500">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value as `#${string}`)}
          className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-[10px] uppercase text-zinc-300">
          {value}
        </span>
      </span>
    </label>
  );
}

function ConnectionSidePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ConnectionSide;
  onChange: (value: ConnectionSide) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-[52px_1fr] items-center gap-2">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <div className="grid grid-cols-4 gap-1">
        {SIDES.map(({ value: side, label: sideLabel, Icon }) => (
          <button
            key={side}
            type="button"
            onClick={() => onChange(side)}
            title={sideLabel}
            aria-label={`${label} connection on ${sideLabel}`}
            className={[
              'grid h-7 place-items-center rounded-md transition',
              value === side
                ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/60'
                : 'bg-white/5 text-zinc-500 ring-1 ring-white/10 hover:text-zinc-200',
            ].join(' ')}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Preview uses the same production contour as the canvas node. */
function ShapeThumb({
  shape,
  fill,
  stroke,
}: {
  shape: NodeShape;
  fill: string;
  stroke: string;
}) {
  const detail = (() => {
    switch (shape) {
      case 'database':
        return <path d="M -56 -34 C -56 -19 56 -19 56 -34 M -56 2 C -56 17 56 17 56 2" />;
      case 'server':
        return <path d="M -56 -19 H 56 M -56 19 H 56" />;
      case 'queue':
        return <path d="M -56 -46 H 46 V 56 M -34 -16 H 34 M -34 0 H 34 M -34 16 H 34" />;
      case 'component':
        return <path d="M -46 -19 H -26 V -8 H -46 Z M -46 8 H -26 V 19 H -46 Z" />;
      case 'predefined-process':
        return <path d="M -38 -56 V 56 M 38 -56 V 56" />;
      case 'internal-storage':
        return <path d="M -38 -56 V 56 M -56 -37 H 56" />;
      case 'note':
        return <path d="M 23 -56 V -23 H 56" />;
      case 'multi-document':
        return <path d="M -44 -56 H 56 V 28 C 28 14 -14 42 -44 30" />;
      case 'delay':
        return <path d="M 27 -56 C 6 -42 6 42 27 56" />;
      case 'circle-x':
        return <path d="M -34 -34 L 34 34 M 34 -34 L -34 34" />;
      case 'circle-plus':
        return <path d="M 0 -40 V 40 M -40 0 H 40" />;
      default:
        return null;
    }
  })();

  return (
    <svg width={30} height={30} viewBox="-68 -68 136 136" aria-hidden="true">
      <path
        d={SHAPES[shape].d}
        fill={fill}
        stroke={stroke}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {detail && (
        <g fill="none" stroke={stroke} strokeWidth={4} opacity={0.9}>
          {detail}
        </g>
      )}
    </svg>
  );
}
