'use client';

import { motion } from 'framer-motion';
import { Hand, ListOrdered, Play, RadioTower, Repeat2, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { useEditorStore } from '@/lib/editor-store';
import type { RunMode } from '@/lib/flowchart-types';

const RUN_MODES = [
  { value: 'sequential', label: 'Sequential', Icon: ListOrdered },
  { value: 'concurrent', label: 'Concurrent', Icon: RadioTower },
  { value: 'manual', label: 'Manual', Icon: Hand },
] as const satisfies ReadonlyArray<{ value: RunMode; label: string; Icon: typeof Hand }>;

/** Run mode + Next / Repeat / Replay cluster in an editor header. */
export function PlaybackControls({ runMode, repeatEnabled, stepCount }: { runMode: RunMode; repeatEnabled: boolean; stepCount: number }) {
  const { applySettings, replay, advanceStep } = useEditorStore();

  return (
    <>
      <ButtonGroup aria-label='Execution mode'>
        {RUN_MODES.map((mode) => (
          <Button
            key={mode.value}
            variant='outline'
            onClick={() => {
              applySettings({ runMode: mode.value });
              replay();
            }}
            aria-pressed={runMode === mode.value}
            className={[
              'h-9 gap-1.5 border-white/10 bg-black/25 px-3 text-xs font-semibold dark:bg-input/30 dark:hover:bg-input/50',
              runMode === mode.value ? 'bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/15 dark:bg-cyan-400/15 dark:hover:bg-cyan-400/15' : 'text-zinc-500 hover:text-zinc-200',
            ].join(' ')}
          >
            <mode.Icon size={12} /> {mode.label}
          </Button>
        ))}
      </ButtonGroup>
      {runMode === 'manual' && (
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          type='button'
          onClick={advanceStep}
          disabled={stepCount === 0}
          title='Run the next step'
          className='inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-500/90 px-3 text-xs font-semibold text-emerald-950 shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40'
        >
          <SkipForward size={14} />
          Next
        </motion.button>
      )}
      <button
        type='button'
        disabled={runMode !== 'sequential'}
        onClick={() => applySettings({ repeatEnabled: !repeatEnabled })}
        aria-pressed={repeatEnabled}
        title='Automatically replay after the sequential run completes'
        className={[
          'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition',
          repeatEnabled && runMode === 'sequential' ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/40' : 'bg-black/25 text-zinc-500 ring-white/10 hover:bg-white/6 hover:text-zinc-200',
          runMode !== 'sequential' ? 'cursor-not-allowed opacity-40 hover:bg-black/25 hover:text-zinc-500' : '',
        ].join(' ')}
      >
        <Repeat2 size={13} className={repeatEnabled && runMode === 'sequential' ? 'text-emerald-300' : ''} />
        Repeat
      </button>
      <Button variant='outline' onClick={replay} className='h-9 border-white/10 bg-black/25 text-xs font-semibold text-zinc-300 hover:bg-white/8'>
        <Play size={14} />
        Replay
      </Button>
    </>
  );
}
