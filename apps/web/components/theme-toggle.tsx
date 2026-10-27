'use client';

import { Github, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'github', icon: Github, label: 'GitHub Dark' },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className={compact ? 'h-8 w-8' : 'h-8 w-[118px]'} aria-hidden />;

  if (compact) {
    const current = theme === 'github' ? 'github' : resolvedTheme === 'dark' ? 'dark' : 'light';
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'github' : 'light';
    const Icon = current === 'github' ? Github : current === 'dark' ? Moon : Sun;
    return (
      <button
        type="button"
        aria-label={`Theme: ${current}. Switch to ${next}.`}
        title={`Theme: ${current} — click for ${next}`}
        onClick={() => setTheme(next)}
        className="rounded-sm p-1.5 text-fg-muted transition-colors hover:bg-canvas-subtle hover:text-fg"
      >
        <Icon size={18} strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center rounded-sm border border-border p-0.5"
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-label={item.label}
          aria-pressed={theme === item.value}
          title={item.label}
          onClick={() => setTheme(item.value)}
          className={cn(
            'rounded-[4px] p-1.5 text-fg-subtle transition-colors hover:text-fg',
            theme === item.value && 'bg-accent-subtle text-accent',
          )}
        >
          <item.icon size={15} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
