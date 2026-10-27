'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { CvFile, ExperienceLevel } from '@osh/contracts';
import { CV_MAX_BYTES } from '@osh/contracts';
import { CheckCircle2, FileUp, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/input';
import { Pill } from '@/components/ui/card';
import { apiFetch, apiUpload, errorMessage } from '@/lib/api-client';
import { LEVEL_LABEL } from '@/lib/constants';

const CV_LIMIT_MB = Math.round(CV_MAX_BYTES / (1024 * 1024));

export function CvUpload({
  onApply,
}: {
  onApply?: (skills: string[], level: ExperienceLevel | null) => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<CvFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ file: CvFile | null }>('/cv')
      .then((result) => {
        if (active) setFile(result.file);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!file || !['PENDING', 'PROCESSING'].includes(file.status)) return;
    const timer = setInterval(async () => {
      try {
        const result = await apiFetch<{ file: CvFile | null }>('/cv');
        setFile(result.file);
        if (result.file?.status === 'COMPLETED') {
          toast.success('CV extraction finished');
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
      } catch {
        // Keep polling; a transient 503 should not hide the last status.
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [file, queryClient]);

  async function upload(selected: File | undefined) {
    if (!selected) return;
    setError(null);
    if (selected.size > CV_MAX_BYTES) {
      setError(`That file is ${(selected.size / 1024 / 1024).toFixed(1)} MB. The limit is ${CV_LIMIT_MB} MB.`);
      return;
    }
    if (!/\.(pdf|docx)$/i.test(selected.name)) {
      setError('Only PDF and DOCX are supported.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', selected);
      const result = await apiUpload<{ file: CvFile }>('/cv', form);
      setFile(result.file);
      toast.success('CV uploaded. Reading it now.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setUploading(false);
    }
  }

  async function retry() {
    if (!file) return;
    setUploading(true);
    try {
      const result = await apiFetch<{ file: CvFile }>(`/cv/${file.id}/retry`, { method: 'POST' });
      setFile(result.file);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setUploading(false);
    }
  }

  const extraction = file?.extraction;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files[0]);
        }}
        className={`rounded-md border border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-subtle' : 'border-border'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        {file && ['PENDING', 'PROCESSING'].includes(file.status) ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={22} className="animate-spin text-accent" />
            <p className="text-[13px] font-medium text-fg">Reading your CV… this takes ~20 seconds</p>
            <p className="text-[11px] text-fg-subtle">You can continue in the background.</p>
          </div>
        ) : file?.status === 'COMPLETED' ? (
          <div className="text-left">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 size={16} />
              <p className="text-[13px] font-medium">
                {extraction?.skills.length ?? 0} skills found
              </p>
            </div>
            {extraction?.experienceLevel ? (
              <p className="mt-1 text-[11px] text-fg-muted">
                Suggested level: {LEVEL_LABEL[extraction.experienceLevel]}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {extraction?.skills.slice(0, 12).map((skill) => (
                <Pill key={skill}>{skill}</Pill>
              ))}
            </div>
            {extraction?.source === 'RULES' ? (
              <p className="mt-2 text-[10px] text-attention">
                The AI was unavailable, so these were extracted with local rules.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {onApply && extraction ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApply(extraction.skills, extraction.experienceLevel)}
                >
                  Apply to profile
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                Replace file
              </Button>
            </div>
          </div>
        ) : file?.status === 'FAILED' ? (
          <div className="flex flex-col items-center gap-2 text-attention">
            <ShieldAlert size={20} />
            <p className="text-[12px]">{file.error ?? 'We could not read that file.'}</p>
            <Button type="button" size="sm" variant="secondary" onClick={retry} loading={uploading}>
              <RefreshCw size={13} /> Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileUp size={22} className="text-fg-subtle" />
            <p className="text-[13px] font-medium text-fg">Drop your CV or browse</p>
            <p className="text-[11px] text-fg-subtle">PDF or DOCX · up to {CV_LIMIT_MB} MB</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => inputRef.current?.click()}
              loading={uploading}
            >
              Choose file
            </Button>
          </div>
        )}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
