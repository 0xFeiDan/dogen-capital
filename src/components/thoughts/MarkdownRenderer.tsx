"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CSSProperties } from "react";
import type { Components } from "react-markdown";

function parseImageAlt(rawAlt = "") {
  const parts = rawAlt.split("|").map((part) => part.trim()).filter(Boolean);
  const [label = "", ...tokens] = parts;
  const style: CSSProperties = {};

  function setDimension(key: "width" | "height", value: string) {
    if (/^\d{1,4}$/.test(value)) {
      style[key] = `${Math.min(Number(value), 1600)}px`;
    } else if (/^\d{1,3}%$/.test(value)) {
      const percent = Math.max(1, Math.min(Number(value.slice(0, -1)), 100));
      style[key] = `${percent}%`;
    }
  }

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const percent = lower.match(/^(\d{1,3})%$/);
    const width = lower.match(/^w(?:idth)?=(\d{1,4}|\d{1,3}%)$/);
    const height = lower.match(/^h(?:eight)?=(\d{1,4}|\d{1,3}%)$/);
    const box = lower.match(/^(\d{1,4})x(\d{1,4})$/);

    if (percent) setDimension("width", `${percent[1]}%`);
    if (width) setDimension("width", width[1]);
    if (height) setDimension("height", height[1]);
    if (box) {
      setDimension("width", box[1]);
      setDimension("height", box[2]);
    }
  }

  if (style.width || style.height) {
    style.objectFit = "contain";
  }

  return {
    alt: label || rawAlt,
    style,
  };
}

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
  img: ({ src, alt }) => {
    const parsed = parseImageAlt(alt ?? "");

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src ?? ""}
        alt={parsed.alt}
        className="my-3 h-auto max-w-full rounded-lg border border-border"
        loading="lazy"
        style={parsed.style}
      />
    );
  },
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
