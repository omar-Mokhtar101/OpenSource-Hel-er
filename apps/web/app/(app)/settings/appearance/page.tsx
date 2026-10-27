import { ThemeToggle } from '@/components/theme-toggle';

export default function AppearancePage() {
  return (
    <div className="max-w-[600px]">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-fg">Appearance</h1>
      <p className="mt-1 text-[12px] text-fg-muted">
        Default is GitHub Dark. All themes use the same tokens and pass a contrast check.
      </p>
      <div className="mt-6 flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <p className="text-[13px] text-fg">Theme</p>
          <p className="text-[11px] text-fg-subtle">GitHub Dark, light, dark or follow the system.</p>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
