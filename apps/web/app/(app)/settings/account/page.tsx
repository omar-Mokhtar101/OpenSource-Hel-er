'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Me } from '@osh/contracts';
import { Github, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSupabase } from '@/components/supabase-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FieldError, Helper, Input, Label, Textarea } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { useMe } from '@/lib/hooks';
import { oauthCallbackUrl } from '@/lib/public-url';

export default function SettingsAccountPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const me = useMe();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!me.data || initialized) return;
    setName(me.data.name);
    setUsername(me.data.username ?? '');
    setBio(me.data.bio ?? '');
    setAvatarUrl(me.data.avatarUrl ?? '');
    setInitialized(true);
  }, [me.data, initialized]);

  const saveProfile = useMutation({
    mutationFn: () =>
      apiFetch<Me>('/me', {
        method: 'PATCH',
        body: {
          name,
          username: username || null,
          bio: bio || null,
          avatarUrl: avatarUrl || null,
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
      toast.success('Account updated');
      setError(null);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const updatePassword = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setPassword('');
      toast.success('Password updated');
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const disconnect = useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/github', { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('GitHub disconnected');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiFetch('/me', { method: 'DELETE' }),
    onSuccess: async () => {
      await supabase.auth.signOut();
      router.push('/');
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  async function connectGithub() {
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: {
        scopes: 'read:user user:email public_repo',
        redirectTo: oauthCallbackUrl('/settings/account'),
      },
    });
    if (linkError) toast.error(linkError.message);
  }

  if (me.isLoading || !me.data) return <Skeleton className="h-80 w-full" />;
  const data = me.data;

  return (
    <div className="max-w-[720px] space-y-8">
      <section>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-fg">Account</h1>
        <p className="mt-1 text-[12px] text-fg-muted">Name, username and password.</p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveProfile.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                maxLength={32}
              />
              <Helper>Lowercase letters, numbers and hyphens.</Helper>
            </div>
          </div>
          <div>
            <Label htmlFor="bio" hint={`${bio.length}/280`}>Bio</Label>
            <Textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={2} />
          </div>
          <div>
            <Label htmlFor="avatar">Avatar URL</Label>
            <Input
              id="avatar"
              type="url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://avatars.githubusercontent.com/..."
            />
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <Button type="submit" loading={saveProfile.isPending}>
            Save changes
          </Button>
        </form>
      </section>

      <section className="border-t border-border pt-7">
        <h2 className="text-[16px] font-semibold text-fg">Password</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => updatePassword.mutate()}
            disabled={password.length < 8}
            loading={updatePassword.isPending}
          >
            Update password
          </Button>
        </div>
      </section>

      <section className="border-t border-border pt-7">
        <h2 className="text-[16px] font-semibold text-fg">GitHub</h2>
        <p className="mt-1 text-[12px] text-fg-muted">
          The provider token is encrypted on the server and only used by the GitHub client.
        </p>
        <div className="mt-3 flex items-center justify-between gap-4 rounded-md border border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-fg">
              <Github size={18} />
            </span>
            <div>
              <p className="text-[12px] font-medium text-fg">
                {data.github.connected ? `Connected as @${data.github.login}` : 'Not connected'}
              </p>
              <p className="text-[10px] text-fg-subtle">
                {data.github.connected
                  ? 'Discovery uses your token when available.'
                  : 'Discovery falls back to public GitHub search.'}
              </p>
            </div>
          </div>
          {data.github.connected ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => disconnect.mutate()}>
              Disconnect
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={connectGithub}>
              Connect GitHub
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-md border border-danger/30 p-4">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-danger">
          <ShieldAlert size={16} /> Danger zone
        </h2>
        <p className="mt-1 text-[12px] text-fg-muted">
          Deleting your account removes your profile, CVs, selections, chats and outreach. This cannot be undone.
        </p>
        <Button type="button" variant="danger" size="sm" className="mt-3" onClick={() => setDeleteOpen(true)}>
          Delete account
        </Button>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title="Delete your account?"
          description="Type your username to confirm. The worker deletes Supabase auth, CV files and all owned rows."
        >
          <Input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={data.username ?? data.email}
            aria-label="Confirm account deletion"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={confirm !== (data.username ?? data.email)}
              onClick={() => deleteAccount.mutate()}
              loading={deleteAccount.isPending}
            >
              Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
