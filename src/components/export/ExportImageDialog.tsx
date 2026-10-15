'use client';

// "Export image" — PNG (2×) or SVG of the whole Diagram or the selection,
// on the theme's canvas colour or transparent. Opened from the File menu of
// both editors and from the Viewer's download button.

import { Download, ImageDown, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import { contentBounds, exportPixelSize, exportScope, imageFilename, type ImageBackground, type ImageFormat } from '@/lib/image-export';
import { downloadBlob, exportDiagramImage } from './render-image';

type Area = 'all' | 'selection';

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <ButtonGroup aria-label={label}>
        {options.map((option) => (
          <Button
            key={option.value}
            variant='toolbar'
            size='sm'
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={value === option.value ? 'bg-cyan-400/15 text-cyan-700 hover:bg-cyan-400/15 hover:text-cyan-700 dark:text-cyan-100 dark:hover:text-cyan-100' : 'text-muted-foreground'}
          >
            {option.label}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
}

export function ExportImageDialog({
  document,
  name,
  selectedNodeIds = [],
  open,
  onOpenChange,
}: {
  document: FlowDocumentJSON;
  /** Diagram or Template name — the default filename. */
  name: string;
  /** Offers "Selection only" when non-empty. */
  selectedNodeIds?: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [format, setFormat] = useState<ImageFormat>('png');
  const [area, setArea] = useState<Area>('all');
  const [background, setBackground] = useState<ImageBackground>('theme');
  const [busy, setBusy] = useState(false);

  const hasSelection = selectedNodeIds.length > 0;
  const effectiveArea: Area = hasSelection ? area : 'all';
  const scope = exportScope(document, effectiveArea === 'selection' ? selectedNodeIds : null);
  // Cheap (pure arithmetic over the document), so it is simply recomputed
  // while the dialog is open rather than memoised.
  const box = open ? contentBounds(scope) : null;
  const size = box ? exportPixelSize(box, format) : null;

  const handleDownload = async () => {
    if (!box) return;
    setBusy(true);
    try {
      const blob = await exportDiagramImage(scope, format, background);
      downloadBlob(blob, imageFilename(name, format, effectiveArea === 'selection'));
      onOpenChange(false);
    } catch (error) {
      console.error('Image export failed', error);
      toast.error('Could not export the image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className='border-border bg-popover/95 text-foreground backdrop-blur-xl sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-sm font-semibold'>
            <ImageDown size={14} className='text-sky-600 dark:text-sky-300' />
            Export image
          </DialogTitle>
          <DialogDescription className='text-xs text-muted-foreground'>A still picture of the diagram, as Static run mode shows it — no effects and no replay highlight. The grid is never drawn.</DialogDescription>
        </DialogHeader>

        {document.nodes.length === 0 ? (
          <p className='rounded-lg bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground ring-1 ring-border'>Diagram is empty — add something to the canvas first.</p>
        ) : (
          <div className='flex flex-col gap-3'>
            <Choice
              label='Format'
              value={format}
              onChange={setFormat}
              options={[
                { value: 'png', label: 'PNG (2×)' },
                { value: 'svg', label: 'SVG' },
              ]}
            />
            {hasSelection && (
              <Choice
                label='Area'
                value={effectiveArea}
                onChange={setArea}
                options={[
                  { value: 'all', label: 'Whole diagram' },
                  { value: 'selection', label: 'Selection only' },
                ]}
              />
            )}
            <Choice
              label='Background'
              value={background}
              onChange={setBackground}
              options={[
                { value: 'theme', label: 'Theme' },
                { value: 'transparent', label: 'Transparent' },
              ]}
            />
            <p className='font-mono text-[10px] text-muted-foreground'>
              {imageFilename(name, format, effectiveArea === 'selection')}
              {size ? ` · ${size.width} × ${size.height} px` : ''}
            </p>
          </div>
        )}

        <div className='flex justify-end gap-2'>
          <Button variant='toolbar' onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant='accent' onClick={() => void handleDownload()} disabled={!box || busy}>
            {busy ? <LoaderCircle size={13} className='animate-spin' /> : <Download size={13} />}
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
