import type { JSX } from 'react';
import { parseNarration, type NarrationInline } from '@/lib/lesson/narration';

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

// Renders parseNarration output as React nodes only (never raw HTML).
// inline: first paragraph only, inside a <span> (callouts, change lines).
export function NarrationText({
  source,
  inline,
}: {
  source: string;
  inline?: boolean;
}): JSX.Element {
  const paragraphs = parseNarration(source);
  if (inline) {
    return <span>{(paragraphs[0] ?? []).map(renderInline)}</span>;
  }
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line [&:not(:first-child)]:mt-2">
          {p.map(renderInline)}
        </p>
      ))}
    </>
  );
}
