import { AuthForm } from '@/components/auth-form';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-6">
        <Logo />
        <ThemeToggle compact />
      </header>
      <div className="flex flex-1 items-center justify-center px-6 pb-20">
        <AuthForm mode="signup" next={params.next} />
      </div>
    </main>
  );
}
