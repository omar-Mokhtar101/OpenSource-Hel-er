'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export function TagInput({
  value,
  onChange,
  max,
  suggestions,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState('');

  function commit() {
    const cleaned = draft.trim().slice(0, 60);
    if (!cleaned) return;
    if (value.some((entry) => entry.toLowerCase() === cleaned.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, cleaned].slice(0, max));
    setDraft('');
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-border bg-canvas p-2">
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-fg"
          >
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onChange(value.filter((entry) => entry !== item))}
              className="text-fg-subtle hover:text-danger"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {value.length < max ? (
          <span className="flex items-center gap-1">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ',') return;
                event.preventDefault();
                commit();
              }}
              maxLength={60}
              placeholder="Type any skill, press Enter"
              aria-label="Add a skill"
              className="h-6 w-44 border-0 bg-transparent p-0 text-[11px] focus:border-0"
            />
            {draft.trim() ? (
              <button
                type="button"
                onClick={commit}
                className="rounded-sm px-1 text-[10px] text-accent hover:underline"
              >
                Add
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {suggestions
          .filter((suggestion) => !value.includes(suggestion))
          .slice(0, 8)
          .map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onChange([...value, suggestion].slice(0, max))}
              className="inline-flex items-center gap-0.5 rounded-full border border-border-muted px-2 py-0.5 text-[10px] text-fg-subtle hover:border-border-strong hover:text-fg"
            >
              <Plus size={9} /> {suggestion}
            </button>
          ))}
      </div>
    </div>
  );
}
