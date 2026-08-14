'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Ban,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  Cloud,
  Code,
  Copy,
  Crown,
  CreditCard,
  Database,
  Download,
  Flag,
  Globe,
  LayoutGrid,
  LayoutTemplate,
  LoaderCircle,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Palette,
  PlayCircle,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Square,
  Trophy,
  Type,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { NodeIcon } from '@/lib/flowchart-types';
import {
  getCachedLogoCatalog,
  loadLogoCatalog,
  type LogoCatalog,
  type LogoType,
} from '@/lib/logo-catalog';

const COLUMNS = 5;

const SPONSORS = [
  {
    slug: 'lndev-ui',
    badge: 'sponsored' as const,
    url: 'https://www.lndevui.com/?utm_source=logos.lndev.me&utm_medium=referral&utm_campaign=sponsored-card',
  },
  {
    slug: 'claude',
    badge: 'oss' as const,
    url: 'https://claude.com/?utm_source=logos.lndev.me&utm_medium=referral&utm_campaign=oss-card',
  },
];

const SPONSOR_BY_SLUG = new Map(SPONSORS.map((s) => [s.slug, s]));

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  ai: Sparkles,
  cloud: Cloud,
  corp: Building2,
  'corp-2': Building2,
  'corp-3': Building2,
  db: Database,
  design: Palette,
  dev: Wrench,
  flags: Flag,
  fw: LayoutTemplate,
  lang: Code,
  media: PlayCircle,
  mkt: BarChart3,
  os: Monitor,
  other: MoreHorizontal,
  pay: CreditCard,
  'pay-2': CreditCard,
  prod: Briefcase,
  'prod-2': Briefcase,
  sec: Shield,
  shop: ShoppingBag,
  social: MessageCircle,
  sport: Trophy,
  web: Globe,
};

function logoIcon(slug: string): NodeIcon {
  return `logo:${slug}`;
}

function parseLogoIcon(icon: NodeIcon | null): string | null {
  return icon?.startsWith('logo:') ? icon.slice('logo:'.length) : null;
}

interface LogoPickerProps {
  value: NodeIcon | null;
  onChange: (icon: NodeIcon | null, name?: string) => void;
  className?: string;
}

export function LogoPicker({ value, onChange, className }: LogoPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<LogoCatalog | null>(getCachedLogoCatalog);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<LogoType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeSlug = parseLogoIcon(value);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadLogoCatalog()
      .then((data) => {
        setCatalog(data);
        setError(false);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const keyword = search.trim().toLowerCase();

  const matchesSearch = useCallback(
    (logo: LogoCatalog['logos'][number]) => {
      if (!keyword) return true;
      return (
        logo.id.toLowerCase().includes(keyword) ||
        logo.name.toLowerCase().includes(keyword)
      );
    },
    [keyword],
  );

  const filteredLogos = useMemo(() => {
    if (!catalog) return [];
    return catalog.logos.filter((logo) => {
      const matchesType = typeFilter === 'all' || logo.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || logo.categories.includes(categoryFilter);
      return matchesType && matchesCategory && matchesSearch(logo);
    });
  }, [catalog, typeFilter, categoryFilter, matchesSearch]);

  const typeCounts = useMemo(() => {
    if (!catalog) return { all: 0, icon: 0, wordmark: 0 };
    const all = catalog.logos.filter(
      (logo) =>
        (categoryFilter === 'all' || logo.categories.includes(categoryFilter)) &&
        matchesSearch(logo),
    ).length;
    const icon = catalog.logos.filter(
      (logo) =>
        logo.type === 'icon' &&
        (categoryFilter === 'all' || logo.categories.includes(categoryFilter)) &&
        matchesSearch(logo),
    ).length;
    const wordmark = catalog.logos.filter(
      (logo) =>
        logo.type === 'wordmark' &&
        (categoryFilter === 'all' || logo.categories.includes(categoryFilter)) &&
        matchesSearch(logo),
    ).length;
    return { all, icon, wordmark };
  }, [catalog, categoryFilter, matchesSearch]);

  const allCategoryCount = useMemo(() => {
    if (!catalog) return 0;
    return catalog.logos.filter(
      (logo) =>
        (typeFilter === 'all' || logo.type === typeFilter) && matchesSearch(logo),
    ).length;
  }, [catalog, typeFilter, matchesSearch]);

  const categoryCounts = useMemo(() => {
    if (!catalog) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const logo of catalog.logos) {
      if (typeFilter !== 'all' && logo.type !== typeFilter) continue;
      if (!matchesSearch(logo)) continue;
      for (const categoryId of logo.categories) {
        counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
      }
    }
    return counts;
  }, [catalog, typeFilter, matchesSearch]);

  const rows = Math.ceil(filteredLogos.length / COLUMNS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    if (!gridRef.current) return;
    const el = gridRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setGridWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [filteredLogos.length]);

  const cellHeight = useMemo(() => {
    if (gridWidth <= 0) return 96;
    const cellWidth = (gridWidth - (COLUMNS - 1) * 1) / COLUMNS;
    return Math.max(60, cellWidth / 1.25);
  }, [gridWidth]);

  const rowVirtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => cellHeight,
    gap: 1,
    overscan: 6,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [cellHeight, rowVirtualizer]);

  const handleCopySvg = async (slug: string) => {
    try {
      const res = await fetch(`/logos/${slug}.svg`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedId(slug);
      setTimeout(() => setCopiedId((current) => (current === slug ? null : current)), 1500);
    } catch {
      // Ignore copy failures.
    }
  };

  const handleDownloadSvg = (slug: string) => {
    const link = document.createElement('a');
    link.href = `/logos/${slug}.svg`;
    link.download = `${slug}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentLabel = activeSlug ?? 'No logo';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch('');
          setTypeFilter('all');
          setCategoryFilter('all');
          setCopiedId(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              'h-9 w-full justify-start gap-2 border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground hover:bg-accent',
              className,
            )}
          />
        }
      >
        {activeSlug ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/logos/${activeSlug}.svg`}
            alt={activeSlug}
            className="size-4 object-contain"
          />
        ) : (
          <Ban size={14} className="text-muted-foreground" />
        )}
        <span className="truncate">{currentLabel}</span>
      </DialogTrigger>

      <DialogContent className="flex h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-none! flex-col gap-0 overflow-hidden rounded-xl border-border bg-popover p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-sm">Choose logo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar filters */}
          <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/50">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3.5 text-xs font-semibold text-foreground">
              <LayoutGrid size={14} className="text-muted-foreground" />
              Filters
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <FilterSection title="Type">
                <FilterItem
                  label="All"
                  count={typeCounts.all}
                  active={typeFilter === 'all'}
                  onClick={() => setTypeFilter('all')}
                  icon={LayoutGrid}
                />
                <FilterItem
                  label="Icons"
                  count={typeCounts.icon}
                  active={typeFilter === 'icon'}
                  onClick={() => setTypeFilter('icon')}
                  icon={Square}
                />
                <FilterItem
                  label="Wordmarks"
                  count={typeCounts.wordmark}
                  active={typeFilter === 'wordmark'}
                  onClick={() => setTypeFilter('wordmark')}
                  icon={Type}
                />
              </FilterSection>

              <FilterSection title="Categories">
                <FilterItem
                  label="All categories"
                  count={allCategoryCount}
                  active={categoryFilter === 'all'}
                  onClick={() => setCategoryFilter('all')}
                  icon={LayoutGrid}
                />
                {catalog?.categories
                  .filter((category) => category.id !== 'other')
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map((category) => {
                    const count = categoryCounts.get(category.id) ?? 0;
                    const Icon = CATEGORY_ICONS[category.id];
                    return (
                      <FilterItem
                        key={category.id}
                        label={category.label}
                        count={count}
                        active={categoryFilter === category.id}
                        disabled={count === 0}
                        onClick={() =>
                          setCategoryFilter((current) =>
                            current === category.id ? 'all' : category.id,
                          )
                        }
                        icon={Icon}
                      />
                    );
                  })}
                {(() => {
                  const other = catalog?.categories.find((category) => category.id === 'other');
                  if (!other) return null;
                  const count = categoryCounts.get('other') ?? 0;
                  return (
                    <FilterItem
                      label={other.label}
                      count={count}
                      active={categoryFilter === 'other'}
                      disabled={count === 0}
                      onClick={() =>
                        setCategoryFilter((current) =>
                          current === 'other' ? 'all' : 'other',
                        )
                      }
                      icon={MoreHorizontal}
                    />
                  );
                })()}
              </FilterSection>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Search logos — try "react", "stripe", "figma"...'
                  className="h-9 border-border bg-muted/20 pl-9 text-sm"
                  autoFocus
                />
              </div>
              {keyword && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearch('')}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="grid h-full place-items-center">
                  <LoaderCircle className="size-5 animate-spin text-cyan-600 dark:text-cyan-300" />
                </div>
              ) : error ? (
                <p className="mt-8 text-center text-xs text-rose-600 dark:text-rose-300">
                  Could not load logo catalog.
                  <br />
                  Run <code className="text-muted-foreground">npm run build:logos</code> first.
                </p>
              ) : filteredLogos.length === 0 ? (
                <p className="mt-8 text-center text-xs text-muted-foreground">No logos found</p>
              ) : (
                <div
                  ref={gridRef}
                  className="relative w-full bg-muted/10"
                  style={{ height: rowVirtualizer.getTotalSize() }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                      key={virtualRow.key}
                      className="absolute top-0 left-0 grid w-full grid-cols-5 gap-px"
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {filteredLogos
                        .slice(
                          virtualRow.index * COLUMNS,
                          virtualRow.index * COLUMNS + COLUMNS,
                        )
                        .map((logo) => {
                          const isActive = activeSlug === logo.id;
                          const sponsor = SPONSOR_BY_SLUG.get(logo.id);
                          return (
                            <div
                              key={logo.id}
                              className={cn(
                                'group relative flex h-full flex-col items-center justify-center gap-3 overflow-hidden bg-zinc-950 px-4 pt-6 pb-8 transition',
                                isActive && 'ring-1 ring-inset ring-sky-400/60',
                              )}
                            >
                              <button
                                onClick={() => {
                                  onChange(logoIcon(logo.id), logo.name);
                                  setOpen(false);
                                }}
                                className="flex h-full w-full flex-col items-center justify-center gap-3"
                                title={logo.name}
                                aria-label={`Use ${logo.name} logo`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/logos/${logo.id}.svg`}
                                  alt={logo.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="max-h-11 max-w-[60%] object-contain transition-transform group-hover:scale-105"
                                />
                                <span className="max-w-[90%] truncate font-mono text-[0.6875rem] text-zinc-400">
                                  {logo.name}
                                </span>
                              </button>

                              {sponsor && (
                                <SponsorBadge
                                  badge={sponsor.badge}
                                  url={sponsor.url}
                                />
                              )}

                              {/* Hover actions */}
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 pb-3.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDownloadSvg(logo.id);
                                  }}
                                  title="Download SVG"
                                  className="inline-flex h-7.5 items-center gap-1 rounded-full border border-white/10 bg-zinc-950/95 px-3 text-[11px] font-medium text-zinc-200 shadow-md backdrop-blur-sm hover:bg-zinc-800"
                                >
                                  <Download size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleCopySvg(logo.id);
                                  }}
                                  title="Copy SVG"
                                  className="inline-flex h-7.5 items-center gap-1 rounded-full border border-white/10 bg-zinc-950/95 px-3 text-[11px] font-medium text-zinc-200 shadow-md backdrop-blur-sm hover:bg-zinc-800"
                                >
                                  {copiedId === logo.id ? (
                                    <Check size={13} className="text-green-400" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterItem({
  label,
  count,
  active,
  onClick,
  icon: Icon,
  disabled,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  disabled?: boolean;
}) {
  const isDisabled = disabled && !active;
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition',
        active
          ? 'bg-accent text-accent-foreground'
          : isDisabled
            ? 'cursor-not-allowed text-muted-foreground/60'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {Icon && <Icon size={14} className="shrink-0" />}
        <span className={cn('truncate', isDisabled && 'text-muted-foreground/60')}>{label}</span>
      </span>
      <span
        className={cn(
          'shrink-0 font-mono text-xs tabular-nums',
          isDisabled ? 'text-muted-foreground/50' : 'text-muted-foreground',
        )}
      >
        {count.toLocaleString('en-US')}
      </span>
    </button>
  );
}

function SponsorBadge({ badge, url }: { badge: 'sponsored' | 'oss'; url?: string }) {
  const content =
    badge === 'oss' ? (
      <span className="text-[10px] font-semibold tracking-wide">OSS</span>
    ) : (
      <>
        <Crown size={10} />
        <span className="text-[10px] font-semibold tracking-wide">Sponsored</span>
      </>
    );

  const badgeClass =
    'absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[#451a03] shadow-sm bg-gradient-to-br from-[#fde68a] to-[#f59e0b]';

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        title={badge === 'oss' ? 'Open source project' : 'Sponsor'}
        className={cn(badgeClass, 'hover:opacity-90')}
      >
        {content}
      </a>
    );
  }

  return <span className={badgeClass}>{content}</span>;
}
