'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Button, type buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';

const noopSubscribe = () => () => undefined;

/** True only once the client has hydrated. `useSyncExternalStore` is the
 *  compiler-safe way to read this — it forces a re-render after hydration
 *  when the client snapshot (`true`) differs from the server one (`false`),
 *  without a setState call inside an effect. */
function useIsMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** Light/dark switch, wired to next-themes. Renders nothing until mounted
 *  — resolvedTheme is undefined on the server, so picking an icon before
 *  hydration would either flash the wrong one or mismatch the server HTML. */
export function ThemeToggle({ variant = 'ghost', size = 'icon' }: VariantProps<typeof buttonVariants>) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type='button'
      variant={variant}
      size={size}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </Button>
  );
}
