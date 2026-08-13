'use client';

import { motion } from 'framer-motion';
import { Hand, Image as ImageIcon, ListOrdered, Play, RadioTower, Repeat2, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { useEditorStore } from '@/lib/editor-store';
import type { RunMode } from '@/lib/flowchart-types';

const RUN_MODES = [
  { value: 'sequential', label: 'Sequential', Icon: ListOrdered },
  { value: 'concurrent', label: 'Concurrent', Icon: RadioTower },
  { value: 'manual', label: 'Manual', Icon: Hand },
  { value: 'static', label: 'Static', Icon: ImageIcon },
] as const satisfies ReadonlyArray<{ value: RunMode; label: string; Icon: typeof Hand }>;

export interface RunControlsProps {
  runMode: RunMode;
  repeatEnabled: boolean;
  /** Disables the manual-mode Next button (e.g. nothing to step through). */
  advanceDisabled: boolean;
  onSelectMode: (mode: RunMode) => void;
  onAdvance: () => void;
  onToggleRepeat: () => void;
  onReplay: () => void;
}

/**
 * Presentational run cluster — mode picker + Next / Repeat / Replay.
 * Shared by the editor header (store-wired via `PlaybackControls`) and
 * the read-only viewer (local run state), so the two surfaces cannot
 * drift apart visually.
 */
export function RunControls({ runMode, repeatEnabled, advanceDisabled, onSelectMode, onAdvance, onToggleRepeat, onReplay }: RunControlsProps) {
  return (
    <>
      <ButtonGroup aria-label='Execution mode'>
        {RUN_MODES.map((mode) => (
          <Button
            key={mode.value}
            variant='toolbar'
            size='lg'
            onClick={() => onSelectMode(mode.value)}
            aria-pressed={runMode === mode.value}
            className={runMode === mode.value ? 'bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/15 hover:text-cyan-100 dark:bg-cyan-400/15 dark:hover:bg-cyan-400/15' : 'text-zinc-500'}
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
          onClick={onAdvance}
          disabled={advanceDisabled}
          title='Run the next step'
          className='inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-500/90 px-3 text-xs font-semibold text-emerald-950 shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40'
        >
          <SkipForward size={14} />
          Next
        </motion.button>
      )}
      {/* Static has no run cursor to repeat or replay — nothing ever
          moves, so both controls would either do nothing or, for Replay,
          trigger a pointless canvas remount (it works by bumping the
          canvas's `key`). */}
      {runMode !== 'static' && (
        <>
          <Button
            variant='toolbar'
            size='lg'
            disabled={runMode !== 'sequential'}
            onClick={onToggleRepeat}
            aria-pressed={repeatEnabled}
            title='Automatically replay after the sequential run completes'
            className={repeatEnabled && runMode === 'sequential' ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/15 hover:text-emerald-100 dark:bg-emerald-400/15 dark:hover:bg-emerald-400/15' : 'text-zinc-500'}
          >
            <Repeat2 size={13} className={repeatEnabled && runMode === 'sequential' ? 'text-emerald-300' : ''} />
            Repeat
          </Button>
          <Button variant='toolbar' size='lg' onClick={onReplay}>
            <Play size={14} />
            Replay
          </Button>
        </>
      )}
    </>
  );
}

/** Store-wired run cluster used by every editing surface's header. */
export function PlaybackControls({ runMode, repeatEnabled, stepCount }: { runMode: RunMode; repeatEnabled: boolean; stepCount: number }) {
  const { applySettings, replay, advanceStep } = useEditorStore();

  return (
    <RunControls
      runMode={runMode}
      repeatEnabled={repeatEnabled}
      advanceDisabled={stepCount === 0}
      onSelectMode={(mode) => {
        applySettings({ runMode: mode });
        replay();
      }}
      onAdvance={advanceStep}
      onToggleRepeat={() => applySettings({ repeatEnabled: !repeatEnabled })}
      onReplay={replay}
    />
  );
}
