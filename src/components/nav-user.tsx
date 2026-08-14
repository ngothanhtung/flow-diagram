'use client';

import type { User } from 'firebase/auth';
import { ChevronsUpDownIcon, LogOutIcon, UserRoundIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { signOutUser } from '@/lib/firebase/auth';

function initials(user: User) {
  const value = user.displayName || user.email || 'User';
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function NavUser({ user }: { user: User }) {
  const { isMobile } = useSidebar();

  const signOut = async () => {
    try {
      await signOutUser();
      toast.success('Signed out');
    } catch {
      toast.error('Could not sign out right now');
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size='lg' className='aria-expanded:bg-sidebar-accent' />}>
            <Avatar>
              {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName ?? 'User'} />}
              <AvatarFallback>{initials(user)}</AvatarFallback>
            </Avatar>
            <div className='grid flex-1 text-left text-sm leading-tight'>
              <span className='truncate font-medium'>{user.displayName || 'X Flow Tool user'}</span>
              <span className='truncate text-xs'>{user.email}</span>
            </div>
            <ChevronsUpDownIcon className='ml-auto size-4' />
          </DropdownMenuTrigger>
          <DropdownMenuContent className='w-64' side={isMobile ? 'bottom' : 'right'} align='end' sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className='flex items-center gap-2 px-1 py-1.5'>
                <span className='grid size-8 place-items-center rounded-lg bg-accent'>
                  <UserRoundIcon className='size-4 text-cyan-600 dark:text-cyan-300' />
                </span>
                <span className='min-w-0'>
                  <span className='block truncate text-xs text-foreground'>{user.displayName || 'X Flow Tool user'}</span>
                  <span className='block truncate text-[10px] font-normal text-muted-foreground'>{user.email}</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant='destructive' onClick={() => void signOut()}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
