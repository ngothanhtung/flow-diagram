'use client';

import { Check, Copy, Globe, Link2, LoaderCircle, LockKeyhole, Share2, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadAccessList } from '@/lib/firebase/access';
import { setDiagramPublic } from '@/lib/firebase/diagrams';
import { loadAccessIndex, updateCollaborators } from '@/lib/firebase/sharing';
import type { AccessList } from '@/lib/access-list';
import { ACCESS_LEVEL_LABELS, ACCESS_LEVELS, isPending, validateInvite, type AccessIndex, type AccessLevel } from '@/lib/sharing';

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: string;
  /** The Owner — the only person this dialog is ever shown to. */
  owner: { uid: string; email: string | null };
  isPublic: boolean;
  /** Called once a Public toggle has been applied in Firestore. */
  onPublicChange: (isPublic: boolean) => void;
  /** Called with the Collaborator count after every change. */
  onCollaboratorsChange?: (count: number) => void;
  /** The Editor passes its dirty flag, so the Public section can say the
   *  link doesn't show the unsaved canvas yet. */
  unsavedChanges?: boolean;
}

/**
 * Share (PRD v0.3 §4.2) — the Owner's one place for who can open a
 * Diagram: Collaborators by email on top, the Public link below. Used from
 * the Editor's File menu and the Diagrams list.
 *
 * Every change is written immediately — there is nothing to Save here. In
 * particular the Public toggle publishes the **last saved** content right
 * away (v0.2 waited for the next Save, with no cue that it was waiting).
 * No email is ever sent: the Owner sends the link themselves.
 */
export function ShareDialog(props: ShareDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[90vh] gap-0 overflow-y-auto border-border bg-popover/95 p-0 text-foreground backdrop-blur-xl sm:max-w-lg'>
        {/* Mounted only while open, so each opening reads the index afresh. */}
        {props.open && props.diagramId && <ShareDialogBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; index: AccessIndex | null; accessList: AccessList };

function ShareDialogBody({ diagramId, owner, isPublic, onPublicChange, onCollaboratorsChange, unsavedChanges }: ShareDialogProps) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<AccessLevel>('edit');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [publicPending, setPublicPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadAccessIndex(owner.uid, diagramId), loadAccessList()])
      .then(([index, accessList]) => {
        if (!cancelled) setLoaded({ status: 'ready', index, accessList });
      })
      .catch((error: unknown) => {
        console.error('Could not load the Collaborator list', error);
        if (!cancelled) setLoaded({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [owner.uid, diagramId]);

  const index = loaded.status === 'ready' ? loaded.index : null;
  const collaborators = index?.collaboratorEmails ?? [];

  const change = async (key: string, mutate: (current: Record<string, AccessLevel>) => Record<string, AccessLevel>, success: string) => {
    if (loaded.status !== 'ready') return false;
    setPending(key);
    try {
      const next = await updateCollaborators(owner, diagramId, mutate);
      setLoaded({ ...loaded, index: next });
      onCollaboratorsChange?.(next?.collaboratorEmails.length ?? 0);
      toast.success(success);
      return true;
    } catch (error) {
      console.error('Could not update the Collaborator list', error);
      toast.error('Could not update who can open this Diagram', { description: 'Check your connection and try again.' });
      return false;
    } finally {
      setPending(null);
    }
  };

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (loaded.status !== 'ready') return;
    const result = validateInvite(email, { ownerEmail: owner.email, collaborators: index?.collaborators ?? {}, accessList: loaded.accessList });
    if (!result.ok) {
      setInviteError(result.message);
      inputRef.current?.focus();
      return;
    }
    setInviteError(null);
    const done = await change('invite', (current) => ({ ...current, [result.email]: level }), `Shared with ${result.email} — ${ACCESS_LEVEL_LABELS[level]}`);
    if (done) setEmail('');
  };

  const togglePublic = async () => {
    const next = !isPublic;
    setPublicPending(true);
    try {
      await setDiagramPublic(owner.uid, diagramId, next);
      onPublicChange(next);
      toast.success(next ? 'Public link is on' : 'Public link is off', {
        description: next ? 'It shows the last saved version.' : 'The Public link no longer opens this Diagram.',
      });
    } catch (error) {
      console.error('Could not change the Public link', error);
      toast.error(next ? 'Could not turn the Public link on' : 'Could not turn the Public link off', { description: 'Check your connection and try again.' });
    } finally {
      setPublicPending(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const editLink = `${origin}/diagrams/${diagramId}/edit`;
  const publicLink = `${origin}/diagrams/${diagramId}/view`;

  return (
    <>
      <DialogHeader className='border-b border-border px-5 pt-5 pb-4'>
        <DialogTitle className='flex items-center gap-2 text-sm font-semibold'>
          <Share2 size={14} className='text-sky-600 dark:text-sky-300' />
          Share diagram
        </DialogTitle>
        <DialogDescription className='text-xs text-muted-foreground'>Invite people by email, or open a read-only Public link. Changes apply immediately.</DialogDescription>
      </DialogHeader>

      {/* ---- Collaborators ---------------------------------------------- */}
      <section aria-labelledby='share-collaborators' className='space-y-3 px-5 py-4'>
        <h3 id='share-collaborators' className='flex items-center gap-1.5 text-xs font-semibold text-foreground'>
          <Users size={13} className='text-muted-foreground' />
          Collaborators
        </h3>

        <form onSubmit={(event) => void invite(event)} className='flex flex-wrap items-start gap-2' noValidate>
          <div className='min-w-48 flex-1'>
            <Input
              ref={inputRef}
              type='email'
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (inviteError) setInviteError(null);
              }}
              placeholder='name@company.com'
              aria-label='Email to invite'
              aria-invalid={inviteError ? true : undefined}
              aria-describedby={inviteError ? 'share-invite-error' : undefined}
              disabled={loaded.status !== 'ready'}
              variant='toolbar'
              className='h-8 text-xs md:text-xs'
            />
          </div>
          <LevelSelect value={level} onChange={setLevel} disabled={loaded.status !== 'ready'} label='Access level for the invite' />
          <Button type='submit' variant='accent' size='sm' className='h-8' disabled={loaded.status !== 'ready' || pending !== null || !email.trim()}>
            {pending === 'invite' ? <LoaderCircle size={13} className='animate-spin' /> : <UserPlus size={13} />}
            Invite
          </Button>
        </form>
        {inviteError && (
          <p id='share-invite-error' role='alert' className='rounded-md border border-rose-400/25 bg-rose-400/8 px-2.5 py-1.5 text-[11px] leading-5 text-rose-700 dark:text-rose-200'>
            {inviteError}
          </p>
        )}

        {loaded.status === 'loading' && (
          <p className='flex items-center gap-2 py-2 text-xs text-muted-foreground'>
            <LoaderCircle size={13} className='animate-spin' /> Loading Collaborators…
          </p>
        )}
        {loaded.status === 'error' && <p className='py-2 text-xs text-rose-700 dark:text-rose-300'>Could not load the Collaborator list. Close and try again.</p>}

        {loaded.status === 'ready' && (
          <ul className='divide-y divide-border rounded-lg ring-1 ring-border' aria-label='People with access'>
            <li className='flex items-center gap-2 px-3 py-2'>
              <span className='min-w-0 flex-1 truncate text-xs text-foreground'>{owner.email ?? 'You'}</span>
              <span className='text-[11px] text-muted-foreground'>Owner (you)</span>
            </li>
            {collaborators.map((address) => (
              <li key={address} className='flex items-center gap-2 px-3 py-1.5' data-testid='collaborator-row'>
                <span className='flex min-w-0 flex-1 items-center gap-2'>
                  <span className='truncate text-xs text-foreground'>{address}</span>
                  {index && isPending(index, address) && (
                    <span
                      className='shrink-0 rounded-full bg-amber-400/12 px-1.5 py-px text-[10px] font-semibold text-amber-700 ring-1 ring-amber-400/30 dark:text-amber-200'
                      title="Pending: nobody signed in as this email has opened it yet. They may not have an account — the invite starts working once they sign up and verify this email."
                    >
                      Pending
                    </span>
                  )}
                </span>
                <LevelSelect
                  value={index?.collaborators[address] ?? 'view'}
                  disabled={pending !== null}
                  label={`Access level for ${address}`}
                  onChange={(next) => void change(address, (current) => ({ ...current, [address]: next }), `${address} — ${ACCESS_LEVEL_LABELS[next]}`)}
                />
                <Button
                  variant='ghost'
                  size='icon-xs'
                  disabled={pending !== null}
                  aria-label={`Remove ${address}`}
                  title='Remove — takes effect immediately'
                  className='text-muted-foreground hover:text-rose-700 dark:hover:text-rose-300'
                  onClick={() =>
                    void change(
                      address,
                      (current) => {
                        const next = { ...current };
                        delete next[address];
                        return next;
                      },
                      `Removed ${address}`,
                    )
                  }
                >
                  {pending === address ? <LoaderCircle size={12} className='animate-spin' /> : <X size={13} />}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className='space-y-1.5'>
          <p className='text-[11px] leading-5 text-muted-foreground'>
            No email is sent. People you invite find it under <span className='font-semibold text-foreground'>Shared with me</span> — or send them this link:
          </p>
          <CopyField value={editLink} label='Link for Collaborators' icon={<Link2 size={13} />} />
        </div>
      </section>

      {/* ---- Public link ------------------------------------------------- */}
      <section aria-labelledby='share-public' className='space-y-3 border-t border-border bg-muted/20 px-5 py-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h3 id='share-public' className='flex items-center gap-1.5 text-xs font-semibold text-foreground'>
              {isPublic ? <Globe size={13} className='text-emerald-700 dark:text-emerald-300' /> : <LockKeyhole size={13} className='text-muted-foreground' />}
              Public link
            </h3>
            <p className='mt-1 text-[11px] leading-5 text-muted-foreground'>
              {isPublic ? 'On — anyone with the link can view it read-only, without signing in.' : 'Off — only you, your Collaborators and administrators can open this Diagram.'}
            </p>
          </div>
          <button
            type='button'
            role='switch'
            aria-checked={isPublic}
            aria-label='Public link'
            disabled={publicPending}
            onClick={() => void togglePublic()}
            className={[
              'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 transition outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
              isPublic ? 'bg-emerald-500 ring-emerald-500/60' : 'bg-muted ring-border',
            ].join(' ')}
          >
            <span className={['inline-block size-4 rounded-full bg-background shadow transition-transform', isPublic ? 'translate-x-4.5' : 'translate-x-0.5'].join(' ')} />
            {publicPending && <LoaderCircle size={10} className='absolute inset-0 m-auto animate-spin text-foreground' />}
          </button>
        </div>
        {isPublic && (
          <>
            <CopyField value={publicLink} label='Public link' icon={<Globe size={13} />} />
            <p className='text-[11px] leading-5 text-muted-foreground' data-testid='public-note'>
              The Public link shows the last saved version.
              {unsavedChanges && <span className='font-semibold text-amber-700 dark:text-amber-300'> You have unsaved changes — Save to publish them.</span>}
            </p>
          </>
        )}
      </section>
    </>
  );
}

function LevelSelect({ value, onChange, disabled, label }: { value: AccessLevel; onChange: (level: AccessLevel) => void; disabled?: boolean; label: string }) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === 'edit' || next === 'view') onChange(next);
      }}
    >
      <SelectTrigger size='sm' aria-label={label} className='h-8 w-28 shrink-0 border-border bg-muted/30 text-xs'>
        <SelectValue>{(current: AccessLevel) => ACCESS_LEVEL_LABELS[current] ?? current}</SelectValue>
      </SelectTrigger>
      <SelectContent className='border-border bg-popover'>
        {ACCESS_LEVELS.map((option) => (
          <SelectItem key={option} value={option} className='text-xs'>
            {ACCESS_LEVEL_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CopyField({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy the link');
    }
  };
  return (
    <div className='flex items-center gap-2'>
      <span className='shrink-0 text-muted-foreground' aria-hidden>
        {icon}
      </span>
      <Input readOnly value={value} aria-label={label} onFocus={(event) => event.target.select()} variant='toolbar' className='h-8 font-mono text-[11px] md:text-[11px]' />
      <Button variant='toolbar' size='sm' onClick={() => void copy()} className='h-8 shrink-0'>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
