'use client';

import { Layers3 } from 'lucide-react';
import type {
  DiagramTemplate,
  DiagramTemplateId,
} from '@/lib/diagram-templates';

interface ModelSwitcherProps {
  templates: DiagramTemplate[];
  value: DiagramTemplateId;
  onChange: (id: DiagramTemplateId) => void;
}

export function ModelSwitcher({ templates, value, onChange }: ModelSwitcherProps) {
  const current = templates.find((template) => template.id === value) ?? templates[0];

  return (
    <label className="group flex min-w-72 items-center gap-3 rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/10 transition hover:ring-sky-400/30">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/25">
        <Layers3 size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Model library · {current.category}
        </span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as DiagramTemplateId)}
          className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent pr-5 text-xs font-semibold text-zinc-100 outline-none"
          aria-label="Choose diagram model"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id} className="bg-zinc-900">
              {template.name} · {template.document.nodes.length} blocks
            </option>
          ))}
        </select>
        <span className="block truncate text-[10px] text-zinc-500">
          {current.description}
        </span>
      </span>
    </label>
  );
}
