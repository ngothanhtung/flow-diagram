'use client';

import type { User } from 'firebase/auth';
import { LogOut, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOutUser } from '@/lib/firebase/auth';

function initials(user: User) {
  const value = user.displayName || user.email || 'User';
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function UserMenu({ user }: { user: User }) {
  const signOut = async () => {
    try {
      await signOutUser();
      toast.success('Đã đăng xuất');
    } catch {
      toast.error('Không thể đăng xuất lúc này');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon-lg" className="rounded-full border-white/10 bg-black/25" />}
      >
        <Avatar size="sm">
          {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName ?? 'User'} />}
          <AvatarFallback className="bg-cyan-300/10 text-[9px] font-bold text-cyan-200">{initials(user)}</AvatarFallback>
        </Avatar>
        <span className="sr-only">Tài khoản</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border-white/8 bg-zinc-950/95 p-1.5 backdrop-blur-xl">
        <DropdownMenuLabel className="flex items-center gap-2 px-2 py-2">
          <span className="grid size-8 place-items-center rounded-lg bg-white/5"><UserRound className="size-4 text-cyan-300" /></span>
          <span className="min-w-0">
            <span className="block truncate text-xs text-zinc-200">{user.displayName || 'Flowgram user'}</span>
            <span className="block truncate text-[10px] font-normal text-zinc-500">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/8" />
        <DropdownMenuItem variant="destructive" onClick={signOut} className="px-2 py-2">
          <LogOut /> Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
