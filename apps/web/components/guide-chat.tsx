'use client';

import type { ChatMessage, GuideConversation, GuideReply } from '@osh/contracts';
import { AlertTriangle, Send, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Prose } from '@/components/prose';
import { Button } from '@/components/ui/button';
import { Meter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { apiFetch, ApiError, errorMessage } from '@/lib/api-client';

const SUGGESTIONS = [
  'Explain this repository',
  'What should I read first?',
  'How do I run the tests?',
  'What does this error mean?',
];

export function GuideChat({
  issueId,
  conversation,
  issueTitle,
}: {
  issueId: string;
  conversation: GuideConversation | undefined;
  issueTitle: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [limit, setLimit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [lastAsked, setLastAsked] = useState<string | null>(null);
  const [usage, setUsage] = useState({ used: 0, max: 20_000 });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversation) return;
    setMessages(conversation.messages);
    setUsage({
      used: conversation.usage.tokensUsedThisMonth,
      max: conversation.usage.maxTokensPerUser,
    });
  }, [conversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, thinking]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || thinking) return;
    setError(null);
    setRequestId(null);
    setLimit(false);
    setDraft('');
    setLastAsked(trimmed);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: trimmed,
      guardrailOutcome: null,
      tokens: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setThinking(true);
    try {
      const reply = await apiFetch<GuideReply>(
        `/guide/conversations/${encodeURIComponent(issueId)}/messages`,
        { method: 'POST', body: { content: trimmed } },
      );
      setMessages((current) => [...current, reply.message]);
      setUsage({ used: reply.usage.tokensUsedThisMonth, max: reply.usage.maxTokensPerUser });
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 429 || caught.code.startsWith('AI_'))) {
        setLimit(caught.status === 429);
      }
      if (caught instanceof ApiError) setRequestId(caught.requestId ?? null);
      setError(errorMessage(caught));
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
    } finally {
      setThinking(false);
    }
  }

  const overBudget = usage.max > 0 && usage.used >= usage.max;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <div className="min-h-[380px] space-y-5">
          {messages.length === 0 ? (
            <div className="rounded-md border border-border bg-canvas-subtle p-5">
              <div className="flex items-center gap-2 text-accent">
                <Shield size={16} />
                <p className="text-[13px] font-medium text-fg">How the guide works</p>
              </div>
              <p className="mt-2 max-w-[62ch] text-[13px] leading-6 text-fg-muted">
                I explain the issue, the repository and the concepts it needs. I suggest investigation
                steps and documentation. I never write the fix for you.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted hover:border-border-strong hover:text-fg"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === 'USER' ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[78ch] rounded-md border border-border bg-canvas-subtle px-4 py-3 text-[13px] leading-6 text-fg">
                  {message.content}
                </div>
              </div>
            ) : message.guardrailOutcome === 'REFUSED' ? (
              <div key={message.id} className="rounded-md border border-border border-l-2 border-l-attention bg-canvas-subtle p-4">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                  <Shield size={15} className="text-attention" />
                  I can&apos;t write the fix for you — but I can get you there.
                </p>
                <Prose text={stripHeading(message.content)} className="mt-3" />
              </div>
            ) : (
              <div key={message.id}>
                <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-fg-subtle">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-subtle text-[9px] text-accent">
                    G
                  </span>
                  Guide
                </p>
                <div className="max-w-[68ch]">
                  <Prose text={message.content} className="text-fg" />
                  {message.guardrailOutcome === 'STRIPPED' ? (
                    <p className="mt-2 text-[11px] text-fg-subtle">
                      I removed a code block from that answer. Ask me for the next step instead.
                    </p>
                  ) : null}
                </div>
              </div>
            ),
          )}

          {thinking ? (
            <p className="flex items-center gap-2 text-[12px] text-fg-subtle" aria-live="polite">
              <span className="flex gap-1">
                <span className="h-1 w-1 animate-bounce rounded-full bg-fg-subtle" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-fg-subtle [animation-delay:120ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-fg-subtle [animation-delay:240ms]" />
              </span>
              Reading the issue and the repository…
            </p>
          ) : null}
          <div ref={endRef} />
        </div>

        {limit || overBudget ? (
          <div className="mt-4 flex items-center gap-2 rounded-sm border border-attention/30 bg-attention/10 px-3 py-2 text-[12px] text-attention">
            <AlertTriangle size={14} />
            You&apos;ve reached this month&apos;s AI limit. It resets on the 1st.
          </div>
        ) : null}
        {error && !limit ? (
          <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12px] text-danger">
            <p>{error}</p>
            {requestId ? (
              <p className="mt-1 font-mono text-[10px] text-danger/80">Request {requestId}</p>
            ) : null}
            <div className="mt-2 flex items-center gap-3">
              {lastAsked ? (
                <button
                  type="button"
                  onClick={() => void send(lastAsked)}
                  className="text-[11px] font-medium underline"
                >
                  Retry
                </button>
              ) : null}
              <span className="text-[10px] text-danger/80">
                Logs: docker compose logs api
              </span>
            </div>
          </div>
        ) : null}

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="rounded-md border border-border bg-canvas focus-within:border-accent">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              placeholder={`Ask about “${issueTitle.slice(0, 60)}…”`}
              className="min-h-[64px] border-0 bg-transparent focus:border-0"
              maxLength={2000}
              disabled={overBudget}
              aria-label="Message the guide"
            />
            <div className="flex items-center justify-between border-t border-border-muted px-3 py-2">
              <span className="font-mono text-[10px] text-fg-subtle">
                {usage.used.toLocaleString()} / {usage.max.toLocaleString()} tokens this month
              </span>
              <Button type="submit" size="sm" disabled={!draft.trim() || overBudget} loading={thinking}>
                <Send size={13} /> Send
              </Button>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-fg-subtle">
            Enter sends · Shift+Enter adds a line. The guide never writes implementation code.
          </p>
        </form>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-md border border-border bg-canvas-subtle p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-fg-subtle">Context</p>
          <p className="mt-2 line-clamp-3 text-[12px] font-medium text-fg">{issueTitle}</p>
          <div className="mt-4">
            <Meter value={usage.used} max={usage.max} label="AI tokens" />
          </div>
          <p className="mt-4 text-[11px] leading-5 text-fg-subtle">
            The guide uses the issue, the README and your onboarding notes. It refuses complete
            solutions and code.
          </p>
        </div>
      </aside>
    </div>
  );
}

function stripHeading(content: string): string {
  return content.replace(/^I can't write the fix for you — but I can get you there\.\n*/i, '');
}
