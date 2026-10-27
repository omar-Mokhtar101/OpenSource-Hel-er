'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { ExperienceLevel } from '@osh/contracts';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { CvUpload } from '@/components/cv-upload';
import { Logo } from '@/components/logo';
import { useSupabase } from '@/components/supabase-provider';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/tag-input';
import { Pill } from '@/components/ui/card';
import { FieldError, Helper, Label, Textarea } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { LANGUAGES, LEVELS, LEVEL_LABEL, SKILL_SUGGESTIONS } from '@/lib/constants';
import { useMe, useProfile } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: me } = useMe();
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hydrated = useRef(false);

  // Hydrate once, during render: the old effect raced the first click and
  // could wipe a language or skill the user had just selected.
  if (profile && !hydrated.current) {
    hydrated.current = true;
    setLevel(profile.experienceLevel);
    setLanguages(profile.languages);
    setSkills(profile.skills);
    setDescription(profile.description ?? '');
  }

  async function saveStepOne() {
    setError(null);
    if (!level || languages.length === 0) {
      setError('Pick a level and one language to continue.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/profile', {
        method: 'PUT',
        body: { experienceLevel: level, languages, skills },
      });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      setStep(1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function saveStepTwo() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/profile', { method: 'PUT', body: { description } });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      setStep(2);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-[640px] items-center justify-between px-6">
        <Logo size={18} />
        <button type="button" onClick={signOut} className="text-[12px] text-fg-muted hover:text-fg">
          Sign out
        </button>
      </header>
      <main className="mx-auto w-full max-w-[560px] px-6 pb-24">
        <div className="mb-10 flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index <= step ? 'bg-accent' : 'bg-border',
              )}
            />
          ))}
        </div>

        {step === 0 ? (
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">Step 1 of 3</p>
            <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-fg">
              What do you work with?
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-fg-muted">
              This decides which issues are worth ranking. You can change it later.
            </p>

            <div className="mt-8">
              <Label>Experience level</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {LEVELS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setLevel(item.value)}
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
            </div>

            <div className="mt-7">
              <Label hint={`${languages.length}/8`}>Languages</Label>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((language) => {
                  const active = languages.includes(language);
                  return (
                    <button
                      key={language}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setLanguages((current) =>
                          active
                            ? current.filter((item) => item !== language)
                            : current.length >= 8
                              ? current
                              : [...current, language],
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
              {me?.github.connected ? (
                <Helper>Imported from your GitHub. Edit anything.</Helper>
              ) : null}
            </div>

            <div className="mt-7">
              <Label hint={`${skills.length}/12`}>Skills</Label>
              <TagInput value={skills} onChange={setSkills} max={12} suggestions={SKILL_SUGGESTIONS} />
              <Helper>Type any skill and press Enter. New skills count for matching.</Helper>
            </div>

            {error ? <div className="mt-4"><FieldError>{error}</FieldError></div> : null}
            <div className="mt-8 flex items-center gap-3">
              <Button type="button" size="lg" onClick={saveStepOne} loading={saving}>
                Continue <ArrowRight size={15} />
              </Button>
              {!level || languages.length === 0 ? (
                <span className="text-[11px] text-fg-subtle">Pick a level and one language to continue.</span>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">Step 2 of 3</p>
            <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-fg">
              Tell us about you
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-fg-muted">
              A short description and, if you want, a CV. The CV is optional.
            </p>
            <div className="mt-8">
              <Label htmlFor="description" hint={`${description.length}/280`}>
                What are you learning right now?
              </Label>
              <Textarea
                id="description"
                maxLength={280}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="I build small React apps and want my first merged PR."
              />
            </div>
            <div className="mt-7">
              <Label>CV</Label>
              <CvUpload
                onApply={(extracted, extractedLevel) => {
                  setSkills((current) => [...new Set([...current, ...extracted])].slice(0, 12));
                  if (extractedLevel) setLevel(extractedLevel);
                }}
              />
            </div>
            {error ? <div className="mt-4"><FieldError>{error}</FieldError></div> : null}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft size={15} /> Back
              </Button>
              <Button type="button" size="lg" onClick={saveStepTwo} loading={saving}>
                Continue <ArrowRight size={15} />
              </Button>
              <button type="button" onClick={() => setStep(2)} className="text-[12px] text-fg-muted hover:text-fg">
                Skip for now
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">Step 3 of 3</p>
            <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-fg">You&apos;re set</h1>
            <div className="mt-6 rounded-md border border-border bg-canvas-subtle p-5">
              <div className="flex items-center gap-2 text-success">
                <Check size={16} />
                <p className="text-[13px] font-medium">Profile ready for recommendations</p>
              </div>
              <dl className="mt-4 space-y-3 text-[12px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Level</dt>
                  <dd className="text-fg">{level ? LEVEL_LABEL[level] : 'Not set'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Languages</dt>
                  <dd className="flex flex-wrap justify-end gap-1">
                    {languages.map((language) => (
                      <Pill key={language}>{language}</Pill>
                    ))}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Skills</dt>
                  <dd className="text-fg">{skills.length || 'None yet'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">CV</dt>
                  <dd className="text-fg">Optional</dd>
                </div>
              </dl>
            </div>
            <p className="mt-5 text-[12px] text-fg-muted">You can change all of this later in Settings.</p>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/discover?auto=1"
                className="inline-flex h-11 items-center gap-2 rounded-sm bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-hover"
              >
                Find my first issue <ArrowRight size={15} />
              </Link>
              <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                Edit
              </Button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
