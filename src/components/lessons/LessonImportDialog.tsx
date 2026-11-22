'use client';

import { FileUp, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { summarizeFixes } from '@/lib/document-validation';
import { useEditorStore } from '@/lib/editor-store';
import { normalizeLessonDocument } from '@/lib/lesson/lesson-normalize';

/**
 * Paste (or pick a file of) lesson JSON and replace the open Lesson with
 * it — one Undo step (`replaceLesson`). A plain Diagram JSON is accepted
 * too and becomes a one-step Lesson. The imported `meta.title` becomes the
 * Lesson's name (kept from the open Lesson when it has none). Errors stay in the dialog and change
 * nothing; repairs are reported in a warning toast.
 */
export function LessonImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const replaceLesson = useEditorStore((state) => state.replaceLesson);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText('');
    setError(null);
  };

  const run = (source: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (thrown) {
      setError(`That is not valid JSON: ${(thrown as Error).message}`);
      return;
    }
    const result = normalizeLessonDocument(parsed);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // The title is the Lesson's name. A source without one (a plain Diagram
    // JSON) keeps the open Lesson's, so Import never blanks the name.
    const current = useEditorStore.getState().lesson?.meta.title ?? '';
    const lesson = result.lesson.meta.title.trim() || !current ? result.lesson : { ...result.lesson, meta: { ...result.lesson.meta, title: current } };
    replaceLesson(lesson);
    reset();
    onOpenChange(false);
    if (result.fixes.length > 0) {
      toast.warning('Imported with repairs', { description: `Repaired ${result.fixes.length} invalid ${result.fixes.length === 1 ? 'value' : 'values'}: ${summarizeFixes(result.fixes)}` });
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setText(await file.text());
      setError(null);
    } catch {
      setError('Could not read that file.');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent size='workspace' className='gap-3 border border-border bg-popover'>
        <DialogHeader>
          <DialogTitle className='text-base font-semibold text-foreground'>Import lesson JSON</DialogTitle>
          <p className='mt-1 text-[11px] leading-relaxed text-muted-foreground'>
            Paste an exported lesson, or a plain diagram (it becomes a one-step lesson). It replaces this lesson; Undo brings the old one back.
          </p>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          spellCheck={false}
          aria-label='Lesson JSON'
          placeholder='{ "format": "x-flow-lesson", … }'
          className='min-h-0 flex-1 resize-none border-border bg-muted/30 font-mono text-[11px] leading-relaxed [field-sizing:fixed]'
        />
        {error && (
          <p role='alert' className='flex items-start gap-1.5 text-[11px] leading-5 text-red-700 dark:text-red-300'>
            <TriangleAlert size={13} className='mt-0.5 shrink-0' />
            {error}
          </p>
        )}
        <div className='flex items-center justify-between gap-2'>
          <input ref={fileInput} type='file' accept='.json,application/json' className='hidden' onChange={(event) => { void pickFile(event.target.files?.[0]); event.target.value = ''; }} />
          <Button variant='toolbar' size='lg' onClick={() => fileInput.current?.click()}>
            <FileUp size={13} />
            Choose file…
          </Button>
          <div className='flex gap-2'>
            <Button variant='toolbar' size='lg' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant='accent' size='lg' disabled={!text.trim()} onClick={() => run(text)}>
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
