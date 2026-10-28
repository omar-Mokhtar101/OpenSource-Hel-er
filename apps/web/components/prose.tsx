import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * Markdown rendered for GitHub issue bodies, README/CONTRIBUTING content and AI
 * answers. Raw HTML is not rendered (react-markdown ignores it), so untrusted
 * issue text cannot inject markup.
 */
const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-6 text-[18px] font-semibold tracking-[-0.02em] text-fg first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.01em] text-fg first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-4 text-[14px] font-semibold text-fg first:mt-0">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-4 text-[13px] font-semibold text-fg first:mt-0">{children}</h5>
  ),
  p: ({ children }) => <p className="my-2.5 break-words">{children}</p>,
  a: ({ href, children }) => {
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  em: ({ children }) => <em className="italic text-fg">{children}</em>,
  del: ({ children }) => <del className="text-fg-subtle">{children}</del>,
  ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1 pl-5 marker:text-fg-subtle">{children}</ul>,
  ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1 pl-5 marker:text-fg-subtle">{children}</ol>,
  li: ({ children }) => <li className="break-words pl-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border-strong pl-3 text-fg-muted">{children}</blockquote>
  ),
  hr: () => <hr className="my-5 border-border-muted" />,
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-sm border border-border bg-canvas-subtle p-3 font-mono text-[11.5px] leading-5 text-fg">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const fenced = typeof className === 'string' && className.startsWith('language-');
    if (fenced) return <code className="font-mono">{children}</code>;
    return (
      <code className="rounded-sm border border-border-muted bg-canvas-subtle px-1 py-0.5 font-mono text-[0.92em] text-fg">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-canvas-subtle text-left">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-2.5 py-1.5 font-semibold text-fg">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2.5 py-1.5 align-top">{children}</td>,
  img: ({ src, alt }) => (
    <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} className="my-3 max-w-full rounded-sm border border-border" />
  ),
  input: ({ type, checked }) =>
    type === 'checkbox' ? <input type="checkbox" checked={checked} readOnly className="mr-1.5 align-middle" /> : null,
};

export function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('text-[13px] leading-6 text-fg-muted', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
