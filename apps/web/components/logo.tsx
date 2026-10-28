import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({
  size = 20,
  withWordmark = true,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-2 text-fg', className)} aria-label="OpenPath home">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="text-accent">
        <path
          d="M18.06 15.5A7 7 0 1 0 8.5 5.94"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M11.4 12.6 18 6M14.4 6H18v3.6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark ? (
        <span className="text-[15px] font-medium tracking-[-0.02em] text-fg">
          Open<span className="text-fg-muted">Path</span>
        </span>
      ) : null}
    </Link>
  );
}
