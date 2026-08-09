'use client';

// Body of a database-table card: a name header plus one row per column.
// Rendered inside FlowNodeCard's existing <foreignObject>, so the table
// inherits the card's silhouette, ports, dragging, resizing and execution
// states without any of that being duplicated here.

import { TABLE_HEADER_HEIGHT, TABLE_ROW_HEIGHT } from '@/lib/node-style';
import type { TableColumn, TableSpec } from '@/lib/flowchart-types';

/**
 * Short badges after a column name, in a fixed order so rows line up.
 * Nullability is flagged the sparse way round — most columns are NOT
 * NULL, so marking the exceptions keeps the card readable instead of
 * stamping "NN" down almost every row.
 */
function columnFlags(column: TableColumn) {
  const flags: string[] = [];
  if (column.unique && !column.primaryKey) flags.push('U');
  if (column.index) flags.push('IX');
  if (column.nullable) flags.push('NULL');
  return flags;
}

export function TableCardBody({ title, table, foreground, fontSize }: { title: string; table: TableSpec; foreground: string; fontSize: number }) {
  const columns = table.columns ?? [];
  // Rows are sized off the shared constants, so the card's computed
  // height always matches what actually gets painted.
  const rowFont = Math.max(9, Math.min(13, fontSize - 2));
  const headerFont = Math.max(11, Math.min(16, fontSize));

  return (
    <div className='flex h-full w-full flex-col overflow-hidden select-none' style={{ color: foreground }}>
      <div
        className='flex shrink-0 items-center gap-1.5 px-2.5'
        style={{
          height: TABLE_HEADER_HEIGHT,
          background: `${foreground}1a`,
          borderBottom: `1px solid ${foreground}3d`,
        }}
      >
        <span className='truncate font-semibold tracking-tight' style={{ fontSize: headerFont }}>
          {title}
        </span>
        {table.schema && (
          <span className='shrink-0 truncate' style={{ fontSize: Math.max(8, rowFont - 2), color: `${foreground}8c` }}>
            {table.schema}
          </span>
        )}
      </div>

      <div className='flex min-h-0 flex-1 flex-col'>
        {columns.length === 0 ? (
          <div className='flex h-full items-center px-2.5' style={{ fontSize: rowFont, color: `${foreground}80` }}>
            No columns yet
          </div>
        ) : (
          columns.map((column) => {
            const flags = columnFlags(column);
            return (
              <div key={column.id} className='flex shrink-0 items-center gap-1.5 px-2.5' style={{ height: TABLE_ROW_HEIGHT, fontSize: rowFont }}>
                {/* Fixed-width key slot keeps every column name left-aligned
                    whether or not the row carries a key badge. */}
                <span className='shrink-0 text-center font-semibold' style={{ width: 16, color: column.primaryKey ? '#fbbf24' : column.foreignKey ? '#67e8f9' : `${foreground}3d` }}>
                  {column.primaryKey ? 'PK' : column.foreignKey ? 'FK' : '·'}
                </span>
                <span className='min-w-0 flex-1 truncate' style={{ fontWeight: column.primaryKey ? 600 : 400 }}>
                  {column.name}
                </span>
                {flags.length > 0 && (
                  <span className='shrink-0 font-semibold' style={{ fontSize: Math.max(7, rowFont - 3), color: `${foreground}80` }}>
                    {flags.join(' ')}
                  </span>
                )}
                <span className='shrink-0 truncate' style={{ maxWidth: '42%', color: `${foreground}a6` }}>
                  {column.dataType}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
