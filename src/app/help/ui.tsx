import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

/** Shared layout primitives for the /help and /help/vi user-guide pages,
 *  matching the visual system of /guide. */

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className='scroll-mt-20 border-t border-border py-8 first:border-t-0 first:pt-0'>
      <h2 className='text-lg font-semibold text-foreground'>{title}</h2>
      <div className='mt-3 space-y-4 text-sm leading-relaxed text-muted-foreground'>{children}</div>
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className='overflow-x-auto rounded-lg ring-1 ring-border'>
      <table className='w-full border-collapse text-xs'>
        <thead>
          <tr className='bg-accent text-left text-muted-foreground'>
            {head.map((h) => (
              <th key={h} className='px-3 py-2 font-semibold'>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className='border-t border-border'>
              {row.map((cell, j) => (
                <td key={j} className={['px-3 py-2 align-top', j === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'].join(' ')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pill({ children }: { children: string }) {
  return <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground'>{children}</code>;
}

export function Kbd({ children }: { children: string }) {
  return <kbd className='rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground'>{children}</kbd>;
}

const HEADER_LINK = 'inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-foreground ring-1 ring-border transition hover:bg-accent';

/** Full-page frame: header with language switch, sticky TOC, content column. */
export function HelpShell({
  title,
  tagline,
  languageSwitch,
  authoringGuideLabel,
  backLabel,
  toc,
  children,
}: {
  title: string;
  tagline: string;
  /** Link to the same page in the other language. */
  languageSwitch: { href: string; label: string };
  authoringGuideLabel: string;
  backLabel: string;
  toc: ReadonlyArray<readonly [string, string]>;
  children: React.ReactNode;
}) {
  return (
    <div className='min-h-screen bg-background text-foreground'>
      <header className='flex items-center justify-between border-b border-border px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <BookOpen size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>{title}</h1>
            <p className='text-xs text-muted-foreground'>{tagline}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Link href={languageSwitch.href} className={HEADER_LINK}>
            {languageSwitch.label}
          </Link>
          <Link href='/guide' className={HEADER_LINK}>
            {authoringGuideLabel}
          </Link>
          <Link href='/' className={HEADER_LINK}>
            {backLabel}
          </Link>
          <ThemeToggle variant='toolbar' size='icon' />
        </div>
      </header>

      <div className='mx-auto flex max-w-5xl gap-10 px-6 py-10'>
        <nav className='sticky top-10 hidden h-fit w-48 shrink-0 flex-col gap-1 text-xs md:flex'>
          {toc.map(([id, label]) => (
            <a key={id} href={`#${id}`} className='rounded-md px-2 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground'>
              {label}
            </a>
          ))}
        </nav>

        <main className='min-w-0 flex-1'>{children}</main>
      </div>
    </div>
  );
}
