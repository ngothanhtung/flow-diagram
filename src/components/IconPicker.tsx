'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { Ban, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getIconLibrarySnapshot,
  loadIconLibrary,
  parseNodeIcon,
  subscribeIconLibrary,
  useResolvedIcon,
  type IconLibraryId,
} from '@/lib/icon-library';
import type { NodeIcon } from '@/lib/flowchart-types';

const LIBRARIES: { id: IconLibraryId; label: string }[] = [
  { id: 'lucide', label: 'Lucide' },
  { id: 'tabler', label: 'Tabler' },
];

const COLUMNS = 7;
const CELL_SIZE = 40;

function iconDisplayName(name: string) {
  return name.replace(/^Icon/, '');
}

interface IconPickerProps {
  value: NodeIcon | null;
  onChange: (icon: NodeIcon | null) => void;
  className?: string;
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<IconLibraryId>(() =>
    value && !value.startsWith('logo:') ? parseNodeIcon(value).library : 'lucide',
  );

  const CurrentIcon = useResolvedIcon(value);

  // Icon catalogs load once the dialog is first opened,
  // so switching tabs and typing a search query never blocks on a fetch again.
  const [loaded, setLoaded] = useState<Record<IconLibraryId, boolean>>({
    lucide: false,
    tabler: false,
  });

  useEffect(() => {
    if (!open) return;
    for (const library of LIBRARIES) {
      void loadIconLibrary(library.id).then(() => {
        setLoaded((prev) => ({ ...prev, [library.id]: true }));
      });
    }
  }, [open]);

  const activeSnapshot = useIconSnapshot(tab, open);

  const iconNames = useMemo(() => {
    if (!activeSnapshot) return [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return activeSnapshot.names;
    return activeSnapshot.names.filter((name) => name.toLowerCase().includes(keyword));
  }, [activeSnapshot, search]);

  const rows = Math.ceil(iconNames.length / COLUMNS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CELL_SIZE,
    overscan: 8,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setSearch('');
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
        {CurrentIcon ? (
          <CurrentIcon size={15} />
        ) : value?.startsWith('logo:') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/logos/${value.slice('logo:'.length)}.svg`} alt="" className="size-4 object-contain" />
        ) : (
          <Ban size={14} className="text-muted-foreground" />
        )}
        {value ? (value.startsWith('logo:') ? 'Logo' : iconDisplayName(parseNodeIcon(value).name)) : 'No icon'}
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] gap-0 overflow-hidden border border-border bg-popover/96 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-sm">Choose icon</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-5 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search icons..."
              className="h-9 border-border bg-muted/20 pl-9"
              autoFocus
            />
          </div>

          <Button
            variant="outline"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            aria-pressed={value === null}
            className={[
              'h-9 w-full gap-2 text-[10px] font-semibold uppercase tracking-wider',
              value === null
                ? 'border-sky-400/60 bg-sky-500/20 text-sky-700 dark:text-sky-100'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}
          >
            <Ban size={14} /> No icon
          </Button>

          <Tabs value={tab} onValueChange={(next) => setTab(next as IconLibraryId)}>
            <TabsList className="w-full">
              {LIBRARIES.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="gap-1.5">
                  {item.label}
                  {!loaded[item.id] && <LoaderCircle size={11} className="animate-spin" />}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div ref={scrollRef} className="mt-3 h-[360px] overflow-y-auto px-5 pb-5">
          {!activeSnapshot ? (
            <div className="grid h-full place-items-center">
              <LoaderCircle className="size-5 animate-spin text-cyan-600 dark:text-cyan-300" />
            </div>
          ) : iconNames.length === 0 ? (
            <p className="mt-8 text-center text-xs text-muted-foreground">No icons found</p>
          ) : (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.key}
                  className="absolute top-0 left-0 grid w-full"
                  style={{
                    gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
                    gap: 6,
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {iconNames
                    .slice(virtualRow.index * COLUMNS, virtualRow.index * COLUMNS + COLUMNS)
                    .map((name) => {
                      const Icon = activeSnapshot.components[name];
                      const isActive = value === `${tab}:${name}`;
                      return (
                        <Button
                          key={name}
                          variant="outline"
                          size="icon-sm"
                          onClick={() => {
                            onChange(`${tab}:${name}` as NodeIcon);
                            setOpen(false);
                          }}
                          title={iconDisplayName(name)}
                          aria-label={`Use ${name} icon`}
                          className={[
                            'h-9 w-full rounded-md',
                            isActive
                              ? 'border-sky-400/60 bg-sky-500/20 text-sky-700 dark:text-sky-100'
                              : 'border-border bg-muted/30 text-muted-foreground hover:bg-accent',
                          ].join(' ')}
                        >
                          <Icon size={15} />
                        </Button>
                      );
                    })}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useIconSnapshot(library: IconLibraryId, open: boolean) {
  useEffect(() => {
    if (open) void loadIconLibrary(library);
  }, [library, open]);

  return useSyncExternalStore(
    (callback) => subscribeIconLibrary(library, callback),
    () => getIconLibrarySnapshot(library),
    () => null,
  );
}
