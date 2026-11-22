// The app's notifications go through shadcn's Toast (Base UI toast manager);
// this pins how the app's call shapes land in `toast.add`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast as manager } from '@/components/ui/toast';
import { toast } from './toast';

afterEach(() => vi.restoreAllMocks());

describe('toast', () => {
  it('passes a typed title and description', () => {
    const add = vi.spyOn(manager, 'add').mockReturnValue('t1');
    expect(toast.success('Diagram saved', { description: 'Checkout' })).toBe('t1');
    toast.error('Could not save');
    toast.warning('Careful');
    toast('Already arranged', { description: 'Nothing to change.' });
    expect(add.mock.calls.map(([options]) => [options.type, options.title, options.description])).toEqual([
      ['success', 'Diagram saved', 'Checkout'],
      ['error', 'Could not save', undefined],
      ['warning', 'Careful', undefined],
      [undefined, 'Already arranged', 'Nothing to change.'],
    ]);
  });

  it('keeps a toast up until closed when asked to stay (duration Infinity)', () => {
    const add = vi.spyOn(manager, 'add').mockReturnValue('t2');
    toast.error('Gone', { duration: Infinity });
    toast.success('Brief', { duration: 2000 });
    expect(add.mock.calls[0][0].timeout).toBe(0);
    expect(add.mock.calls[1][0].timeout).toBe(2000);
  });

  it('turns an action into a button that runs and then closes the toast', () => {
    const add = vi.spyOn(manager, 'add').mockReturnValue('t3');
    const close = vi.spyOn(manager, 'close').mockImplementation(() => {});
    const onClick = vi.fn();
    toast.success('Saved as a new Diagram', { action: { label: 'Open', onClick } });
    const props = add.mock.calls[0][0].actionProps!;
    expect(props.children).toBe('Open');
    (props.onClick as () => void)();
    expect(onClick).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledWith('t3');
  });
});
