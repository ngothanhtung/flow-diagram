'use client';

import type { User } from 'firebase/auth';
import { ArrowLeftIcon, Boxes, Database, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from '@/components/ui/sidebar';

const navItems = [
  { title: 'Diagrams', url: '/admin/diagrams', icon: Database },
  { title: 'Templates', url: '/admin/templates', icon: LayoutTemplate },
];

export function AppSidebar({ user, ...props }: { user: User } & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' render={<Link href='/' />}>
              <div className='grid size-8 shrink-0 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
                <Boxes size={16} className='text-sky-600 dark:text-sky-300' />
              </div>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>X Flow Tool</span>
                <span className='truncate text-xs text-sidebar-foreground/60'>Admin</span>
              </div>
              <ArrowLeftIcon className='ml-auto size-3.5 text-sidebar-foreground/40' />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className='gap-1'>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton tooltip={item.title} isActive={pathname.startsWith(item.url)} className='h-10' render={<Link href={item.url} />}>
                    <item.icon size={16} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
