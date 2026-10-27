'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExperienceLevel, Profile } from '@osh/contracts';
import { Check } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CvUpload } from '@/components/cv-upload';
import { TagInput } from '@/components/tag-input';
import { Button } from '@/components/ui/button';
import { Meter, Skeleton } from '@/components/ui/card';
import { Label, Textarea } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { LANGUAGES, LEVELS, SKILL_SUGGESTIONS } from '@/lib/constants';
import { useProfile } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export default function SettingsProfilePage() {
  const queryClient = useQueryClient();
  const profile = useProfile();
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);

  // Hydrate once, during render, so a click cannot race the effect that
  // previously reset the form back to the saved profile.
  if (profile.data && !hydrated.current) {
    hydrated.current = true;
    setLevel(profile.data.experienceLevel);
    setLanguages(profile.data.languages);
    setSkills(profile.data.skills);
    setDescription(profile.data.description ?? '');
  }

  const save = useMutation({
    mutationFn: () =>
      apiFetch<Profile>('/profile', {
        method: 'PUT',
        body: { experienceLevel: level, languages, skills, description },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setDirty(false);
      toast.success('Profile saved');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function update<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setDirty(true);
  }

  if (profile.isLoading || !profile.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[780px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-fg">Developer profile</h1>
          <p className="mt-1 text-[12px] text-fg-muted">
            Recommendations use the level and languages. Skills help the guide.
          </p>
        </div>
        <div className="w-[180px]">
          <Meter value={profile.data.completeness} max={100} label="Complete" />
        </div>
      </div>

      <section className="mt-7">
        <Label>Experience level</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {LEVELS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => update(setLevel, item.value)}
              className={cn(
                'rounded-sm border px-3 py-3 text-left transition-colors',
                level === item.value
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border hover:border-border-strong',
              )}
            >
              <p className="text-[13px] font-medium text-fg">{item.label}</p>
              <p className="mt-1 text-[10px] leading-4 text-fg-subtle">{item.help}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <Label hint={`${languages.length}/8`}>Preferred languages</Label>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((language) => {
            const active = languages.includes(language);
            return (
              <button
                key={language}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  update(
                    setLanguages,
                    active
                      ? languages.filter((item) => item !== language)
                      : languages.length >= 8
                        ? languages
                        : [...languages, language],
                  )
                }
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                  active
                    ? 'border-accent bg-accent-subtle text-accent'
                    : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
                )}
              >
                {language}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7">
        <Label hint={`${skills.length}/12`}>Skills</Label>
        <TagInput value={skills} onChange={(value) => update(setSkills, value)} max={12} suggestions={SKILL_SUGGESTIONS} />
        <p className="mt-2 text-[11px] text-fg-subtle">
          Type any skill and press Enter. New skills are saved with your profile and used when matching
          issues and explaining the repository.
        </p>
      </section>

      <section className="mt-7">
        <Label htmlFor="about" hint={`${description.length}/280`}>
          About you
        </Label>
        <Textarea
          id="about"
          value={description}
          maxLength={280}
          rows={3}
          onChange={(event) => update(setDescription, event.target.value)}
          placeholder="What are you learning right now?"
        />
      </section>

      <section className="mt-7">
        <Label>CV</Label>
        <CvUpload
          onApply={(extracted, extractedLevel) => {
            update(setSkills, [...new Set([...skills, ...extracted])].slice(0, 12));
            if (extractedLevel) update(setLevel, extractedLevel);
          }}
        />
        <p className="mt-1.5 text-[11px] text-fg-subtle">
          Applying a CV only fills the form. Review it, then save.
        </p>
      </section>

      <div className="sticky bottom-4 mt-8 flex items-center justify-between gap-3 rounded-md border border-border bg-canvas-subtle px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <span className="text-[11px] text-fg-subtle">
          {dirty ? 'You have unsaved changes' : (
            <span className="inline-flex items-center gap-1 text-success"><Check size={12} /> Saved</span>
          )}
        </span>
        <Button type="button" onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
          Save profile
        </Button>
      </div>
    </div>
  );
}
