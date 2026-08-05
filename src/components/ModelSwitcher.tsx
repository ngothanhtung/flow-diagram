'use client';

import { Layers3 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';
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
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onChange(nextValue as DiagramTemplateId);
      }}
    >
      <SelectTrigger
        aria-label="Select diagram model"
        className="group h-auto min-w-72 max-w-[34vw] gap-3 rounded-2xl border-white/10 bg-black/20 px-3.5 py-2.5 text-left hover:border-sky-400/30 hover:bg-white/[.025] focus-visible:border-sky-400/45 focus-visible:ring-sky-400/15"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/25 transition group-hover:bg-sky-400/15">
          <Layers3 size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Model library · {current.category}
          </span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-zinc-100">
            {current.name} · {current.document.nodes.length} blocks
          </span>
          <span className="mt-0.5 block truncate text-[10px] font-normal text-zinc-500">
            {current.description}
          </span>
        </span>
      </SelectTrigger>

      <SelectContent
        align="center"
        sideOffset={8}
        className="max-h-[min(520px,var(--available-height))] min-w-[360px] border border-white/10 bg-zinc-950/98 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,.68)] backdrop-blur-xl"
      >
        <SelectGroup>
          <SelectLabel className="px-2 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
            Select diagram model
          </SelectLabel>
          {templates.map((template) => (
            <SelectItem
              key={template.id}
              value={template.id}
              className="items-start gap-3 px-2.5 py-2.5 pr-9 focus:bg-sky-400/10 focus:text-zinc-100 data-selected:bg-sky-400/[.07]"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-sky-500/8 text-sky-300 ring-1 ring-sky-400/15">
                <Layers3 size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-4">
                  <span className="truncate text-xs font-semibold text-zinc-200">
                    {template.name}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-zinc-600">
                    {template.document.nodes.length} blocks
                  </span>
                </span>
                <span className="mt-1 block truncate text-[10px] font-normal text-zinc-500">
                  {template.category} · {template.description}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
