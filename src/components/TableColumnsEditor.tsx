'use client';

// Column list editor for a database-table node. Lives in the block
// inspector, below the usual styling controls, and only when the node
// actually carries a `table`.
//
// Edits write straight through to the document (no local draft): the
// column list is an array, so a draft copy would have to be reconciled
// on every add/remove/reorder — and the store already handles rapid
// updates fine everywhere else in the editor.

import { ArrowDown, ArrowUp, Plus, Table2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tableCardHeight } from '@/lib/node-style';
import type { FlowNode, TableColumn, TableSpec } from '@/lib/flowchart-types';

/** Offered in the data-type field's dropdown; any text is still valid. */
const COMMON_TYPES = ['uuid', 'bigserial', 'serial', 'integer', 'bigint', 'smallint', 'numeric(12,2)', 'boolean', 'varchar(255)', 'varchar(64)', 'char(3)', 'text', 'jsonb', 'date', 'time', 'timestamptz', 'timestamp', 'bytea'];

/** The flag toggles on each column row, in the order they render. */
const FLAGS = [
  { key: 'primaryKey', label: 'PK', title: 'Primary key', tone: 'text-amber-700 dark:text-amber-200 border-amber-400/50 bg-amber-400/15' },
  { key: 'foreignKey', label: 'FK', title: 'Foreign key', tone: 'text-cyan-700 dark:text-cyan-200 border-cyan-400/50 bg-cyan-400/15' },
  { key: 'unique', label: 'U', title: 'Unique', tone: 'text-violet-700 dark:text-violet-200 border-violet-400/50 bg-violet-400/15' },
  { key: 'index', label: 'IX', title: 'Indexed', tone: 'text-sky-700 dark:text-sky-200 border-sky-400/50 bg-sky-400/15' },
  { key: 'nullable', label: 'NULL', title: 'Nullable (columns are NOT NULL by default)', tone: 'text-foreground border-border bg-accent' },
] as const satisfies ReadonlyArray<{ key: keyof TableColumn; label: string; title: string; tone: string }>;

function newColumn(index: number): TableColumn {
  return { id: `c-${Date.now().toString(36)}-${index}`, name: `column_${index + 1}`, dataType: 'text' };
}

/** Starter columns shared with the table draw tool's shape. */
export function starterColumns(): TableColumn[] {
  const stamp = Date.now().toString(36);
  return [
    { id: `c-${stamp}-1`, name: 'id', dataType: 'uuid', primaryKey: true },
    { id: `c-${stamp}-2`, name: 'name', dataType: 'varchar(255)' },
    { id: `c-${stamp}-3`, name: 'created_at', dataType: 'timestamptz', defaultValue: 'now()' },
  ];
}

export function TableColumnsEditor({ node, onUpdate }: { node: FlowNode; onUpdate: (id: string, patch: Partial<Omit<FlowNode, 'id'>>) => void }) {
  const table = node.table;

  // Not a table yet — offer to make it one.
  if (!table) {
    return (
      <Button
        variant='outline'
        size='sm'
        onClick={() => {
          const columns = starterColumns();
          onUpdate(node.id, { table: { columns }, icon: null, height: tableCardHeight(columns.length), width: Math.max(node.width ?? 0, 236) });
        }}
        className='mt-1.5 w-full border-border bg-muted/30 text-[10px] text-foreground hover:bg-accent'
      >
        <Table2 size={12} /> Convert to database table
      </Button>
    );
  }

  const columns = table.columns ?? [];

  /** Write a new column list and keep the card's height in step with it. */
  const writeColumns = (next: TableColumn[], patch: Partial<TableSpec> = {}) => {
    onUpdate(node.id, { table: { ...table, ...patch, columns: next }, height: tableCardHeight(next.length) });
  };

  const patchColumn = (columnId: string, patch: Partial<TableColumn>) => {
    writeColumns(columns.map((column) => (column.id === columnId ? { ...column, ...patch } : column)));
  };

  const moveColumn = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    writeColumns(next);
  };

  return (
    <div className='mt-1.5'>
      <div className='flex items-center gap-2'>
        <Label htmlFor='table-schema' className='shrink-0 text-[9px] text-muted-foreground'>
          Schema
        </Label>
        <Input
          id='table-schema'
          value={table.schema ?? ''}
          placeholder='public (optional)'
          onChange={(event) => onUpdate(node.id, { table: { ...table, schema: event.target.value.trim() || undefined } })}
          className='h-7 border-border bg-muted/30 text-[11px]'
        />
        <Button
          variant='ghost'
          size='icon-xs'
          onClick={() => onUpdate(node.id, { table: undefined })}
          title='Remove the table (keep the block)'
          aria-label='Remove the table'
          className='shrink-0 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-200'
        >
          <X size={12} />
        </Button>
      </div>

      <datalist id='table-data-types'>
        {COMMON_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>

      <div className='mt-2 flex flex-col gap-2'>
        {columns.map((column, index) => (
          <div key={column.id} className='rounded-lg bg-muted/40 p-1.5 ring-1 ring-border'>
            <div className='flex items-center gap-1.5'>
              <Input
                value={column.name}
                aria-label={`Column ${index + 1} name`}
                onChange={(event) => patchColumn(column.id, { name: event.target.value })}
                className='h-7 border-border bg-muted/30 font-mono text-[11px]'
              />
              <Input
                value={column.dataType}
                list='table-data-types'
                aria-label={`Column ${index + 1} type`}
                onChange={(event) => patchColumn(column.id, { dataType: event.target.value })}
                className='h-7 max-w-28 border-border bg-muted/30 font-mono text-[11px] text-muted-foreground'
              />
            </div>

            <div className='mt-1.5 flex items-center gap-1'>
              {FLAGS.map((flag) => {
                const active = Boolean(column[flag.key]);
                return (
                  <Button
                    key={flag.key}
                    variant='outline'
                    size='xs'
                    aria-pressed={active}
                    title={flag.title}
                    onClick={() => patchColumn(column.id, { [flag.key]: active ? undefined : true })}
                    className={['h-6 min-w-0 flex-1 px-1 text-[9px] font-bold', active ? flag.tone : 'border-border bg-transparent text-muted-foreground hover:text-foreground'].join(' ')}
                  >
                    {flag.label}
                  </Button>
                );
              })}
              <Button variant='ghost' size='icon-xs' disabled={index === 0} onClick={() => moveColumn(index, -1)} title='Move up' aria-label='Move column up' className='text-muted-foreground hover:text-foreground'>
                <ArrowUp size={11} />
              </Button>
              <Button variant='ghost' size='icon-xs' disabled={index === columns.length - 1} onClick={() => moveColumn(index, 1)} title='Move down' aria-label='Move column down' className='text-muted-foreground hover:text-foreground'>
                <ArrowDown size={11} />
              </Button>
              <Button
                variant='ghost'
                size='icon-xs'
                onClick={() => writeColumns(columns.filter((item) => item.id !== column.id))}
                title='Delete column'
                aria-label='Delete column'
                className='text-muted-foreground hover:text-rose-600 dark:hover:text-rose-200'
              >
                <Trash2 size={11} />
              </Button>
            </div>

            <Input
              value={column.defaultValue ?? ''}
              placeholder='default value (optional)'
              aria-label={`Column ${index + 1} default`}
              onChange={(event) => patchColumn(column.id, { defaultValue: event.target.value || undefined })}
              className='mt-1.5 h-6 border-border bg-muted/30 font-mono text-[10px] text-muted-foreground'
            />
          </div>
        ))}
      </div>

      <Button variant='outline' size='sm' onClick={() => writeColumns([...columns, newColumn(columns.length)])} className='mt-2 w-full border-border bg-muted/30 text-[10px] text-foreground hover:bg-accent'>
        <Plus size={12} /> Add column
      </Button>
    </div>
  );
}
