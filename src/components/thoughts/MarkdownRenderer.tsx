"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// ─── Custom component map ─────────────────────────────────────────────────────

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-text-primary mt-5 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-text-primary mt-4 mb-2 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-text-primary mt-3 mb-1.5 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-text-secondary leading-relaxed mb-3 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-sm text-text-secondary mb-3 space-y-1 pl-1">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-sm text-text-secondary mb-3 space-y-1 pl-1">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-text-secondary leading-relaxed">{children}</li>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <code className="block bg-surface-3 border border-border rounded-lg p-3.5 text-xs font-mono text-text-primary overflow-x-auto mb-3 whitespace-pre">
        {children}
      </code>
    ) : (
      <code
        className="bg-surface-3 text-accent rounded px-1.5 py-0.5 text-xs font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="mb-0">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/40 pl-4 my-3 text-sm text-text-muted italic">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-text-primary">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-text-secondary">{children}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-accent hover:text-accent-dim underline underline-offset-2 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? ""}
      alt={alt ?? ""}
      className="my-3 h-auto max-w-full rounded-lg border border-border"
      loading="lazy"
    />
  ),
  hr: () => <hr className="border-border my-5" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-2 border-b border-border">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-medium text-text-secondary uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-border text-text-secondary">
      {children}
    </td>
  ),
};

// ─── Component ───────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
