// The app's notifications: shadcn's Toast (`components/ui/toast`, Base UI's
// toast manager), shown bottom-right by the <Toaster /> in the root layout.
// Call sites keep a short shape — toast.success(title, { description }) —
// and this turns it into `toast.add`.
import type { ReactNode } from 'react';
import { toast as manager } from '@/components/ui/toast';

export interface ToastOptions {
  description?: ReactNode;
  /** Milliseconds before it closes; Infinity keeps it until the person closes it. */
  duration?: number;
  /** One button; clicking it runs `onClick` and closes the toast. */
  action?: { label: string; onClick: () => void };
}

type ToastType = 'success' | 'error' | 'warning' | 'info' | undefined;

function show(type: ToastType, title: ReactNode, options: ToastOptions = {}): string {
  const { description, duration, action } = options;
  let id = '';
  id = manager.add({
    type,
    title,
    description,
    ...(duration !== undefined ? { timeout: Number.isFinite(duration) ? duration : 0 } : {}),
    ...(action
      ? {
          actionProps: {
            children: action.label,
            onClick: () => {
              action.onClick();
              manager.close(id);
            },
          },
        }
      : {}),
  });
  return id;
}

/** `toast(title)` is a plain notice; `.success` / `.error` / `.warning` / `.info` add the status icon. */
export const toast = Object.assign((title: ReactNode, options?: ToastOptions) => show(undefined, title, options), {
  success: (title: ReactNode, options?: ToastOptions) => show('success', title, options),
  error: (title: ReactNode, options?: ToastOptions) => show('error', title, options),
  warning: (title: ReactNode, options?: ToastOptions) => show('warning', title, options),
  info: (title: ReactNode, options?: ToastOptions) => show('info', title, options),
  dismiss: (id: string) => manager.close(id),
});
