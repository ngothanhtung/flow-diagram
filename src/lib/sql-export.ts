// Turns the table nodes of a diagram into CREATE TABLE statements.
//
// Deliberately plain ANSI-ish SQL: data types are whatever the user typed,
// so the output suits whichever database they had in mind rather than
// pretending to target one dialect.

import type { FlowDocumentJSON, FlowEdge, FlowNode, TableColumn } from './flowchart-types';

/** Unquoted identifiers are the readable case; anything else gets quotes. */
const PLAIN_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function quoteIdentifier(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '""';
  return PLAIN_IDENTIFIER.test(trimmed) ? trimmed : `"${trimmed.replace(/"/g, '""')}"`;
}

/** `schema.table`, with each part quoted only when it needs to be. */
function tableRef(node: FlowNode) {
  const name = quoteIdentifier(node.title || 'untitled');
  const schema = node.table?.schema?.trim();
  return schema ? `${quoteIdentifier(schema)}.${name}` : name;
}

/** Bare table name — used to build constraint and index names. */
function bareName(node: FlowNode) {
  return (node.title || 'untitled').trim().replace(/[^a-zA-Z0-9_]+/g, '_');
}

function columnLine(column: TableColumn) {
  const parts = [quoteIdentifier(column.name), column.dataType.trim() || 'text'];
  // A primary key is NOT NULL by definition, so saying it twice is noise.
  if (!column.nullable && !column.primaryKey) parts.push('NOT NULL');
  if (column.defaultValue?.trim()) parts.push(`DEFAULT ${column.defaultValue.trim()}`);
  if (column.unique && !column.primaryKey) parts.push('UNIQUE');
  return parts.join(' ');
}

/**
 * Which end of a relationship holds the foreign key.
 *
 * The line's direction says nothing about that — a user can draw
 * parent→child or child→parent — so this reads the columns instead:
 * an explicit `foreignKey` flag wins, otherwise the end pointing at a
 * primary key is the child. Falling back to the `from` end keeps the
 * output deterministic when a diagram marks neither.
 */
function resolveForeignKey(edge: FlowEdge, fromNode: FlowNode, toNode: FlowNode) {
  const fromColumn = fromNode.table?.columns.find((column) => column.name === edge.fromColumn);
  const toColumn = toNode.table?.columns.find((column) => column.name === edge.toColumn);
  if (!fromColumn || !toColumn) return null;

  const childIsFrom = fromColumn.foreignKey && !toColumn.foreignKey ? true : toColumn.foreignKey && !fromColumn.foreignKey ? false : toColumn.primaryKey && !fromColumn.primaryKey ? true : fromColumn.primaryKey && !toColumn.primaryKey ? false : true;

  return childIsFrom
    ? { child: fromNode, childColumn: fromColumn, parent: toNode, parentColumn: toColumn }
    : { child: toNode, childColumn: toColumn, parent: fromNode, parentColumn: fromColumn };
}

export interface SqlExportResult {
  sql: string;
  tableCount: number;
  foreignKeyCount: number;
}

/**
 * Builds the DDL for every table node in the document, followed by its
 * indexes and then the foreign keys (as ALTER TABLE, so the statements
 * can run top to bottom whatever order the tables were drawn in).
 */
export function buildCreateTableSql(document: FlowDocumentJSON): SqlExportResult {
  const tables = document.nodes.filter((node) => node.table && node.table.columns.length > 0);
  if (tables.length === 0) {
    return { sql: '-- No database tables in this diagram yet.\n-- Draw one with the Table tool, or convert a block in the inspector.\n', tableCount: 0, foreignKeyCount: 0 };
  }

  const statements: string[] = [];

  for (const node of tables) {
    const columns = node.table!.columns;
    const lines = columns.map((column) => `  ${columnLine(column)}`);
    const primaryKeys = columns.filter((column) => column.primaryKey);
    if (primaryKeys.length > 0) {
      lines.push(`  CONSTRAINT ${quoteIdentifier(`pk_${bareName(node)}`)} PRIMARY KEY (${primaryKeys.map((column) => quoteIdentifier(column.name)).join(', ')})`);
    }
    statements.push(`CREATE TABLE ${tableRef(node)} (\n${lines.join(',\n')}\n);`);
  }

  const indexes = tables.flatMap((node) =>
    (node.table?.columns ?? [])
      .filter((column) => column.index && !column.primaryKey)
      .map((column) => `CREATE INDEX ${quoteIdentifier(`idx_${bareName(node)}_${column.name}`)} ON ${tableRef(node)} (${quoteIdentifier(column.name)});`),
  );
  if (indexes.length > 0) statements.push(indexes.join('\n'));

  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  const foreignKeys: string[] = [];
  for (const edge of document.edges) {
    if (!edge.fromColumn || !edge.toColumn) continue;
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (!fromNode?.table || !toNode?.table) continue;
    const relation = resolveForeignKey(edge, fromNode, toNode);
    if (!relation) continue;
    foreignKeys.push(
      `ALTER TABLE ${tableRef(relation.child)} ADD CONSTRAINT ${quoteIdentifier(`fk_${bareName(relation.child)}_${relation.childColumn.name}`)} ` +
        `FOREIGN KEY (${quoteIdentifier(relation.childColumn.name)}) REFERENCES ${tableRef(relation.parent)} (${quoteIdentifier(relation.parentColumn.name)});`,
    );
  }
  if (foreignKeys.length > 0) statements.push(foreignKeys.join('\n'));

  return {
    sql: `${statements.join('\n\n')}\n`,
    tableCount: tables.length,
    foreignKeyCount: foreignKeys.length,
  };
}
