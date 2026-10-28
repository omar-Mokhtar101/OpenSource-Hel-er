'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Bell,
  BookOpen,
  Bookmark,
  ChevronDown,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  MessageSquare,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { useSupabase } from '@/components/supabase-provider';
import { Avatar } from '@/components/ui/card';
import { useMe, useNotifications } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/saved', label: 'Saved', icon: Bookmark },
  { href: '/community', label: 'Community', icon: Users },
  { href: '/requests', label: 'Requests', icon: MessageSquare },
  { href: '/learn', label: 'Learn', icon: BookOpen },
  { href: '/achievements', label: 'Achievements', icon: Sparkles },
];

const ADMIN = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/ai', label: 'AI settings', icon: Shield },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useSupabase();
  const { data: me, error } = useMe();
  const { data: notifications } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (error && 'status' in error && (error as { status?: number }).status === 401) {
      router.push('/login');
    }
  }, [error, router]);

  useEffect(() => setMobileOpen(false), [pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const title = titleFor(pathname);
  const unread = notifications?.unreadCount ?? 0;

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="app-grid">
        <aside className="sticky top-0 hidden h-screen border-r border-border bg-canvas-subtle md:flex md:flex-col">
          <div className="flex h-14 items-center px-5">
            <Logo size={18} />
          </div>
          <nav aria-label="Primary" className="flex-1 px-3 py-3">
            <ul className="space-y-0.5">
              {NAV.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
            {me?.role === 'ADMIN' ? (
              <>
                <p className="mb-1 mt-5 px-2 font-mono text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
                  Admin
                </p>
                <ul className="space-y-0.5">
                  {ADMIN.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} active={isActive(pathname, item.href)} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="my-4 h-px bg-border-muted" />
            <ul className="space-y-0.5">
              <li>
                <NavLink
                  item={{ href: '/notifications', label: 'Notifications', icon: Bell }}
                  active={isActive(pathname, '/notifications')}
                  badge={unread}
                />
              </li>
              <li>
                <NavLink
                  item={{ href: '/settings/profile', label: 'Settings', icon: Settings }}
                  active={pathname.startsWith('/settings')}
                />
              </li>
            </ul>
          </nav>
          <div className="border-t border-border-muted p-3">
            {me ? (
              <Link
                href="/settings/profile"
                className="flex items-center gap-2.5 rounded-sm p-2 hover:bg-canvas"
              >
                <Avatar name={me.name} src={me.avatarUrl} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-fg">{me.name}</p>
                  <p className="truncate text-[10px] text-fg-subtle">
                    {me.role === 'DEVELOPER' ? 'Developer' : me.role === 'MAINTAINER' ? 'Maintainer' : 'Admin'}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="h-12 animate-pulse rounded-sm bg-border-muted" />
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-canvas/90 px-4 backdrop-blur sm:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
                className="rounded-sm p-1.5 text-fg-muted hover:bg-canvas-subtle md:hidden"
              >
                <Menu size={20} />
              </button>
              <span className="text-[13px] font-medium text-fg">{title}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/notifications"
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
                className="relative rounded-sm p-2 text-fg-muted transition-colors hover:bg-canvas-subtle hover:text-fg"
              >
                <Bell size={18} strokeWidth={1.75} />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                ) : null}
              </Link>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-sm p-1 hover:bg-canvas-subtle"
                    aria-label="Account menu"
                  >
                    {me ? <Avatar name={me.name} src={me.avatarUrl} size={28} /> : <span className="h-7 w-7" />}
                    <ChevronDown size={13} className="text-fg-subtle" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-[190px] rounded-md border border-border bg-canvas-subtle p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                  >
                    <MenuItem href="/settings/profile">Profile and skills</MenuItem>
                    <MenuItem href="/settings/account">Account</MenuItem>
                    <MenuItem href="/settings/notifications">Notifications</MenuItem>
                    <MenuItem href="/settings/appearance">Appearance</MenuItem>
                    <DropdownMenu.Separator className="my-1 h-px bg-border-muted" />
                    <DropdownMenu.Item
                      onSelect={signOut}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-[12px] text-danger outline-none hover:bg-canvas"
                    >
                      <LogOut size={14} /> Sign out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </header>

          <main id="main" className="mx-auto w-full max-w-content px-4 py-6 sm:px-8 sm:py-8">
            {children}
          </main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-[var(--canvas-overlay)] md:hidden">
          <div className="h-full w-[80%] max-w-[300px] border-r border-border bg-canvas-subtle p-4">
            <div className="mb-5 flex items-center justify-between">
              <Logo size={18} />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="rounded-sm p-1 text-fg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <nav aria-label="Mobile primary">
              <ul className="space-y-1">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={isActive(pathname, item.href)} />
                  </li>
                ))}
                <li>
                  <NavLink
                    item={{ href: '/notifications', label: 'Notifications', icon: Bell }}
                    active={isActive(pathname, '/notifications')}
                    badge={unread}
                  />
                </li>
                <li>
                  <NavLink
                    item={{ href: '/settings/profile', label: 'Settings', icon: Settings }}
                    active={pathname.startsWith('/settings')}
                  />
                </li>
              </ul>
            </nav>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Mobile bottom navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-border bg-canvas-subtle md:hidden"
      >
        {[NAV[0], NAV[1], { href: '/discover?tab=guide', label: 'Guide', icon: Sparkles }, NAV[4]].map(
          (item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px]',
                isActive(pathname, item.href.split('?')[0] ?? item.href) ? 'text-accent' : 'text-fg-subtle',
              )}
            >
              <item.icon size={18} strokeWidth={1.75} />
              {item.label}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}

function NavLink({
  item,
  active,
  badge,
}: {
  item: { href: string; label: string; icon: typeof Compass };
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex h-9 items-center gap-2.5 rounded-sm border-l-2 border-transparent px-2.5 text-[13px] transition-colors',
        active
          ? 'border-accent bg-accent-subtle text-fg'
          : 'text-fg-muted hover:bg-canvas hover:text-fg',
      )}
    >
      <item.icon size={17} strokeWidth={1.75} className={active ? 'text-accent' : ''} />
      <span className="flex-1">{item.label}</span>
      {badge ? (
        <span className="rounded-full bg-accent px-1.5 text-[9px] font-medium text-white">{badge}</span>
      ) : null}
    </Link>
  );
}

function MenuItem({ href, children }: { href: string; children: ReactNode }) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="block cursor-pointer rounded-sm px-2.5 py-2 text-[12px] text-fg-muted outline-none hover:bg-canvas hover:text-fg"
      >
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function titleFor(pathname: string): string {
  if (pathname.startsWith('/discover')) return 'Discover';
  if (pathname.startsWith('/issues')) return 'Issue';
  if (pathname.startsWith('/progress')) return 'Progress';
  if (pathname.startsWith('/saved')) return 'Saved';
  if (pathname.startsWith('/notifications')) return 'Notifications';
  if (pathname.startsWith('/achievements')) return 'Achievements';
  if (pathname.startsWith('/community')) return 'Community';
  if (pathname.startsWith('/requests')) return 'Requests';
  if (pathname.startsWith('/admin/ai')) return 'AI settings';
  if (pathname.startsWith('/admin')) return 'Admin';
  if (pathname.startsWith('/settings/profile')) return 'Profile';
  if (pathname.startsWith('/settings/account')) return 'Account';
  if (pathname.startsWith('/settings/notifications')) return 'Notifications';
  if (pathname.startsWith('/settings/appearance')) return 'Appearance';
  return 'OpenPath';
}
