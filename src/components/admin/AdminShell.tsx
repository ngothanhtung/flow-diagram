'use client';

import { ShieldOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { isAdminUser } from '@/lib/firebase/roles';

/**
 * Gate + chrome shared by every `/admin/*` page: blocks on auth, then on
 * the `administrators` role (`users-roles/{uid}`), then renders the
 * `sidebar-07`-style shell (`AppSidebar` + `SidebarInset`) around the
 * page content. Denied/loading users never see the sidebar.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [roleStatus, setRoleStatus] = useState<'checking' | 'denied' | 'admin'>('checking');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void isAdminUser(user.uid).then((allowed) => {
      if (!cancelled) setRoleStatus(allowed ? 'admin' : 'denied');
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || roleStatus === 'checking') return <AuthLoadingScreen />;
  if (!user) return <LoginForm />;

  if (roleStatus === 'denied') {
    return (
      <div className='grid h-screen place-items-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
        <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-zinc-900/70 px-8 py-10 text-center'>
          <div className='grid size-12 place-items-center rounded-full bg-red-500/15 ring-1 ring-red-400/40'>
            <ShieldOff size={22} className='text-red-300' />
          </div>
          <div>
            <h1 className='text-sm font-semibold'>Không có quyền truy cập</h1>
            <p className='mt-1.5 text-xs leading-relaxed text-zinc-500'>Trang này chỉ dành cho người dùng có role `administrators` trong `users-roles`.</p>
          </div>
          <Button variant='toolbar' onClick={() => (window.location.href = '/')}>
            Back to editor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider className='h-svh text-zinc-100'>
      <AppSidebar user={user} />
      <SidebarInset className='h-full min-h-0 bg-zinc-950'>
        <div className='flex h-9 shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3'>
          <SidebarTrigger className='text-zinc-400 hover:bg-white/8 hover:text-zinc-100' />
          <ThemeToggle size='icon-sm' />
        </div>
        <div className='min-h-0 flex-1'>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
