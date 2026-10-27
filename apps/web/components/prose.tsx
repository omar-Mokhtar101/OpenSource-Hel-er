import { cn } from '@/lib/utils';

function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={index}
              className="rounded-sm border border-border-muted bg-canvas px-1 py-0.5 font-mono text-[0.92em] text-fg"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={index} className="font-semibold text-fg">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export function Prose({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  function flushList() {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-3 list-disc space-y-1 pl-5">
        {list.map((item, index) => (
          <li key={index}>
            <Inline text={item} />
          </li>
        ))}
      </ul>,
    );
    list = [];
  }

  function flushCode() {
    if (!code) return;
    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        className="my-3 overflow-auto rounded-sm border border-border bg-canvas p-3 font-mono text-[11px] leading-5 text-fg"
      >
        <code>{code.join('\n')}</code>
      </pre>,
    );
    code = null;
  }

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (code) flushCode();
      else {
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!trimmed) {
      flushList();
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      list.push(trimmed.slice(2));
      continue;
    }
    flushList();
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={index} className="mt-4 text-[13px] font-semibold text-fg">
          <Inline text={trimmed.slice(4)} />
        </h4>,
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3 key={index} className="mt-5 text-[15px] font-semibold text-fg">
          <Inline text={trimmed.slice(3)} />
        </h3>,
      );
    } else if (trimmed.startsWith('# ')) {
      blocks.push(
        <h3 key={index} className="mt-5 text-[16px] font-semibold text-fg">
          <Inline text={trimmed.slice(2)} />
        </h3>,
      );
    } else {
      blocks.push(
        <p key={index} className="my-2.5">
          <Inline text={trimmed} />
        </p>,
      );
    }
  }
  flushList();
  flushCode();
  return <div className={cn('text-[13px] leading-6 text-fg-muted', className)}>{blocks}</div>;
}
