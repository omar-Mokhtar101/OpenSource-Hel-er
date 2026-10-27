import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Toaster } from 'sonner';
import './globals.css';
import { QueryProvider } from '@/components/query-provider';
import { SupabaseConfigProvider } from '@/components/supabase-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { SITE_DESCRIPTION, SITE_NAME, appUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(appUrl()),
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <ThemeProvider>
          <SupabaseConfigProvider
            url={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}
            anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}
          >
            <QueryProvider>
              {children}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: 'var(--canvas-subtle)',
                    color: 'var(--fg-default)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '10px',
                    fontSize: '13px',
                  },
                }}
              />
            </QueryProvider>
          </SupabaseConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
