'use client';

import { SECTION_TITLE_CLASS } from '@/components/inspector/fields';

// Small field primitives shared by the Lesson side panel and the Lesson
// info dialog. Text fields keep a local draft (so the box never echoes a
// normalised value mid-typing) and write on every change; the parent keys
// them by `historyRevision` + context so undo/redo and switching Lesson
// steps always show the stored text.

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const FIELD_CLASS = 'border-border bg-muted/30 text-[11px] text-foreground focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15';

export function FieldLabel({ children }: { children: string }) {
  return <Label className='mb-1 block text-[9px] text-muted-foreground'>{children}</Label>;
}

export function TextField({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; mono?: boolean }) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(event.target.value);
        }}
        className={`h-8 ${FIELD_CLASS} ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

/** A bare input (no label) with a local draft that writes on every change.
 *  `type='number'` is passed through for the Minutes box. */
export function DraftInput({ value, onChange, className, ...rest }: { value: string; onChange: (value: string) => void; className?: string } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'defaultValue'>) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      {...rest}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(event.target.value);
      }}
      className={className}
    />
  );
}

/** `transform` maps the typed text to what is stored (the draft stays raw). */
export function TextAreaField({ label, value, onChange, placeholder, rows = 3, hint, transform, className }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; hint?: string; transform?: (text: string) => string; className?: string }) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <Textarea
        aria-label={label || undefined}
        value={draft}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(transform ? transform(event.target.value) : event.target.value);
        }}
        className={`min-h-0 resize-y ${FIELD_CLASS} md:text-[11px] ${className ?? ''}`}
      />
      {hint && <p className='mt-1 text-[9px] leading-relaxed text-muted-foreground'>{hint}</p>}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/** Base UI's SelectValue shows the raw value unless the root knows the
 *  items, so options go to both. Values must be non-empty strings. */
export function LabeledSelect({ label, value, options, onChange, hideLabel }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; hideLabel?: boolean }) {
  return (
    <div className='min-w-0'>
      {!hideLabel && <FieldLabel>{label}</FieldLabel>}
      <Select items={options} value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger aria-label={label} className='h-8 w-full border-border bg-muted/30 text-[11px]'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className='border-border bg-popover'>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className='mt-2 flex items-center justify-between gap-3'>
      <span className='text-[11px] text-foreground'>{label}</span>
      <button
        type='button'
        role='switch'
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={['relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 transition outline-none focus-visible:ring-2 focus-visible:ring-ring', checked ? 'bg-emerald-500 ring-emerald-500/60' : 'bg-muted ring-border'].join(' ')}
      >
        <span className={['inline-block size-4 rounded-full bg-background shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5'].join(' ')} />
      </button>
    </div>
  );
}

/** A section heading in the Lesson panel — the same look as the Inspector's sections: a hairline above, small uppercase name. */
export function PanelHeading({ children }: { children: string }) {
  return <h3 className={`mt-5 mb-2 border-t border-border pt-3 first:mt-0 first:border-t-0 first:pt-0 ${SECTION_TITLE_CLASS}`}>{children}</h3>;
}
