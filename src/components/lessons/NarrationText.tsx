import type { JSX } from 'react';
import { parseNarration, parseNarrationBlocks, type NarrationBlock, type NarrationInline } from '@/lib/lesson/narration';

function renderInline(item: NarrationInline, key: number) {
  switch (item.kind) {
    case 'bold':
      return <strong key={key}>{item.text}</strong>;
    case 'italic':
      return <em key={key}>{item.text}</em>;
    case 'code':
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {item.text}
        </code>
      );
    case 'term':
      return (
        <span
          key={key}
          className="font-medium text-primary underline decoration-dotted underline-offset-2"
        >
          {item.text}
        </span>
      );
    default:
      return item.text;
  }
}

function renderBlock(block: NarrationBlock, key: number) {
  const spacing = "[&:not(:first-child)]:mt-2";
  switch (block.kind) {
    case "heading":
      return (
        <h4 key={key} className={`text-[0.95em] font-semibold text-foreground ${spacing}`}>
          {block.content.map(renderInline)}
        </h4>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List key={key} className={`space-y-0.5 pl-5 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-muted-foreground ${spacing}`}>
          {block.items.map((item, i) => (
            <li key={i}>{item.map(renderInline)}</li>
          ))}
        </List>
      );
    }
    case "code":
      return (
        <pre key={key} className={`overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-[0.85em] leading-relaxed ${spacing}`}>
          <code>{block.text}</code>
        </pre>
      );
    default:
      return (
        <p key={key} className={`whitespace-pre-line ${spacing}`}>
          {block.content.map(renderInline)}
        </p>
      );
  }
}

// Renders Narration as React nodes only (never raw HTML): paragraphs,
// small headings, lists and code blocks (parseNarrationBlocks).
// inline: first paragraph only, inside a <span> (change lines).
export function NarrationText({
  source,
  inline,
}: {
  source: string;
  inline?: boolean;
}): JSX.Element {
  if (inline) {
    return <span>{(parseNarration(source)[0] ?? []).map(renderInline)}</span>;
  }
  return <>{parseNarrationBlocks(source).map(renderBlock)}</>;
}
