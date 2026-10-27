'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DiscoveryFilters,
  RecommendationResponse,
  SavedItem,
} from '@osh/contracts';
import { Compass, RotateCw, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PipelineStages } from '@/components/pipeline-stages';
import { RecommendationCard } from '@/components/recommendation-card';
import { Button } from '@/components/ui/button';
import { EmptyState, Pill, Skeleton } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { apiFetch, ApiError, errorMessage } from '@/lib/api-client';
import { LANGUAGES } from '@/lib/constants';
import { useProfile } from '@/lib/hooks';

const LABELS = ['good first issue', 'help wanted', 'documentation', 'bug', 'enhancement'];

export default function DiscoverPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [filters, setFilters] = useState<DiscoveryFilters>({
    language: undefined,
    label: 'good first issue',
    activityDays: 180,
  });
  const [org, setOrg] = useState('');
  const [repo, setRepo] = useState('');
  const [lastError, setLastError] = useState<unknown>(null);
  const autoRan = useRef(false);

  const latest = useQuery({
    queryKey: ['recommendations', 'latest'],
    queryFn: () => apiFetch<RecommendationResponse>('/discovery/recommendations/latest'),
    retry: false,
  });

  const find = useMutation({
    mutationFn: (regenerate: boolean) =>
      apiFetch<RecommendationResponse>(
        regenerate ? '/discovery/recommendations/regenerate' : '/discovery/recommendations',
        { method: 'POST', body: { ...filters, org: org || undefined, repo: repo || undefined } },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['recommendations', 'latest'], data);
      setLastError(null);
      if (data.fallback) {
        toast.message('Ranked by rules — the AI is unavailable. These still match your stack.');
      }
    },
    onError: (error) => {
      setLastError(error);
      if (!(error instanceof ApiError && error.status === 409)) toast.error(errorMessage(error));
    },
  });

  const save = useMutation({
    mutationFn: (issueId: string) =>
      apiFetch<SavedItem>('/saved/items', { method: 'POST', body: { issueId } }),
    onSuccess: () => {
      toast.success('Saved to “Later”');
      queryClient.invalidateQueries({ queryKey: ['saved-lists'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const ignore = useMutation({
    mutationFn: (issueId: string) =>
      apiFetch<{ ok: true }>('/discovery/ignore', { method: 'POST', body: { issueId } }),
    onSuccess: () => {
      toast.success('Ignored. It will not be recommended again.');
      const current = queryClient.getQueryData<RecommendationResponse>(['recommendations', 'latest']);
      if (current) {
        queryClient.setQueryData(['recommendations', 'latest'], {
          ...current,
          recommendations: current.recommendations.filter(
            (item) => item.issue.id !== ignore.variables,
          ),
        });
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const data = find.data ?? latest.data;
  const hasSet = Boolean(data?.recommendations.length);
  const loading = find.isPending;
  const auto = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('auto') === '1';

  useEffect(() => {
    if (!auto || autoRan.current || latest.isLoading || find.isPending) return;
    if (data || !profile?.complete) return;
    autoRan.current = true;
    find.mutate(false);
  }, [auto, data, find, latest.isLoading, profile?.complete]);

  const profileIncomplete =
    lastError instanceof ApiError && lastError.code === 'PROFILE_INCOMPLETE'
      ? lastError.message
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-fg">Your next contribution</h1>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            Three issues chosen for your level and stack.
          </p>
        </div>
        <Link
          href="/settings/profile"
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[11px] text-fg-muted hover:border-border-strong hover:text-fg"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Profile {profile?.completeness ?? 0}%
          {profile && profile.completeness < 100 ? ' · Add skills' : ''}
        </Link>
      </div>

      <div className="sticky top-14 z-20 -mx-4 mt-6 border-b border-border bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal size={15} className="text-fg-subtle" />
          <Select
            aria-label="Language"
            value={filters.language ?? ''}
            onChange={(event) =>
              setFilters((current) => ({ ...current, language: event.target.value || undefined }))
            }
            className="h-8 w-auto min-w-[130px] text-[12px]"
          >
            <option value="">Any language</option>
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Label"
            value={filters.label ?? ''}
            onChange={(event) =>
              setFilters((current) => ({ ...current, label: event.target.value || undefined }))
            }
            className="h-8 w-auto min-w-[150px] text-[12px]"
          >
            <option value="">Any label</option>
            {LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Activity"
            value={filters.activityDays ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                activityDays: event.target.value ? Number(event.target.value) : undefined,
              }))
            }
            className="h-8 w-auto min-w-[130px] text-[12px]"
          >
            <option value="30">Active in 30 days</option>
            <option value="90">Active in 90 days</option>
            <option value="180">Active in 180 days</option>
          </Select>
          <Input
            aria-label="Organization"
            placeholder="Organization"
            value={org}
            onChange={(event) => setOrg(event.target.value)}
            className="h-8 w-[140px] text-[12px]"
          />
          <Input
            aria-label="Repository"
            placeholder="owner/repo"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            className="h-8 w-[150px] text-[12px]"
          />
          {filters.language || filters.label !== 'good first issue' || org || repo ? (
            <button
              type="button"
              className="text-[11px] text-fg-subtle hover:text-fg"
              onClick={() => {
                setFilters({ label: 'good first issue', activityDays: 180 });
                setOrg('');
                setRepo('');
              }}
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {loading ? <PipelineStages /> : null}
          {!loading && data?.fallback ? (
            <p className="max-w-[62ch] rounded-sm border border-attention/30 bg-attention/10 px-3 py-2 text-[12px] text-attention">
              Ranked by rules — the AI is unavailable. These still match your stack.
            </p>
          ) : null}
          {!loading && hasSet ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
              {data?.recommendations.length} issues · generated {new Date(data!.generatedAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => find.mutate(hasSet)}
            loading={loading}
            className="gap-2"
          >
            {hasSet ? <RotateCw size={14} /> : <Search size={14} />}
            {hasSet ? 'Regenerate' : 'Find issues'}
          </Button>
        </div>
      </div>
      {hasSet ? (
        <p className="mt-2 text-right text-[11px] text-fg-subtle">New set. Ignored issues stay ignored.</p>
      ) : null}

      {profileIncomplete ? (
        <div className="mt-6">
          <EmptyState
            icon={<Compass size={24} />}
            title="Finish your profile first"
            description={profileIncomplete}
            action={<Link href="/onboarding" className="text-[12px] text-accent hover:underline">Complete profile</Link>}
          />
        </div>
      ) : null}

      {!profileIncomplete && lastError && !loading ? (
        <div className="mt-6 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-[12px] text-danger">
          {errorMessage(lastError)}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <div className="mb-4 rounded-sm border border-border bg-canvas-subtle px-4 py-3">
            <p className="text-[13px] font-medium text-fg">Finding your three best matches…</p>
            <p className="mt-1 text-[11px] text-fg-muted">
              Searching GitHub, reading the issues, then ranking them against your level, languages and
              skills. The first search can take around ten seconds.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-md border border-border p-5">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="mt-4 h-3 w-28" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-4/5" />
                <Skeleton className="mt-5 h-16 w-full" />
                <Skeleton className="mt-4 h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && data && data.recommendations.length > 0 ? (
        <div className="mt-6 grid items-stretch gap-3 lg:grid-cols-3">
          {data.recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.issue.id}
              recommendation={recommendation}
              onSave={() => save.mutate(recommendation.issue.id)}
              onIgnore={() => ignore.mutate(recommendation.issue.id)}
            />
          ))}
        </div>
      ) : null}

      {!loading && !data && !profileIncomplete && !lastError ? (
        <div className="mt-6">
          <EmptyState
            icon={<Compass size={24} />}
            title="Nothing here yet"
            description="Pick a language or leave the filters broad, then find your first three issues."
            action={
              <Button type="button" onClick={() => find.mutate(false)}>
                Find issues
              </Button>
            }
          />
        </div>
      ) : null}

      {!loading && data && data.recommendations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Compass size={24} />}
            title="No suitable issues in this slice."
            description="Widen the activity window or drop the label filter."
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setFilters({ activityDays: 365 });
                  setOrg('');
                  setRepo('');
                  setLastError(null);
                  find.mutate(false);
                }}
              >
                Broaden filters
              </Button>
            }
          />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
        <Pill>Free plan</Pill>
        GitHub search is cached for 15 minutes to respect the rate limit.
      </div>
    </div>
  );
}
