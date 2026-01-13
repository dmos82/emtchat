'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Sparkles } from 'lucide-react';

interface DocumentCanvasProps {
  content: string;
  isStreaming: boolean;
}

// Simple markdown to HTML converter - exported for use in CanvasPanel
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // Escape HTML except for our markdown conversions
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^######\s(.+)$/gm, '<h6 class="text-sm font-semibold mt-4 mb-2">$1</h6>');
  html = html.replace(/^#####\s(.+)$/gm, '<h5 class="text-base font-semibold mt-4 mb-2">$1</h5>');
  html = html.replace(/^####\s(.+)$/gm, '<h4 class="text-lg font-semibold mt-4 mb-2">$1</h4>');
  html = html.replace(/^###\s(.+)$/gm, '<h3 class="text-xl font-semibold mt-5 mb-3">$1</h3>');
  html = html.replace(/^##\s(.+)$/gm, '<h2 class="text-2xl font-bold mt-6 mb-3 border-b pb-2">$1</h2>');
  html = html.replace(/^#\s(.+)$/gm, '<h1 class="text-3xl font-bold mt-6 mb-4">$1</h1>');

  // Bold and Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del class="text-muted-foreground">$1</del>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Unordered lists
  html = html.replace(/^\s*[-*+]\s(.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc list-inside my-3 space-y-1">$&</ul>');

  // Ordered lists
  html = html.replace(/^\s*\d+\.\s(.+)$/gm, '<li class="ml-4">$1</li>');

  // Checkboxes
  html = html.replace(
    /\[x\]/gi,
    '<span class="inline-flex items-center justify-center w-4 h-4 mr-2 border rounded bg-primary text-primary-foreground text-xs">✓</span>'
  );
  html = html.replace(
    /\[\s?\]/g,
    '<span class="inline-flex items-center justify-center w-4 h-4 mr-2 border rounded bg-background"></span>'
  );

  // Blockquotes
  html = html.replace(
    /^&gt;\s(.+)$/gm,
    '<blockquote class="border-l-4 border-muted-foreground/30 pl-4 my-3 italic text-muted-foreground">$1</blockquote>'
  );

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="my-6 border-t border-muted" />');

  // Links (simple pattern)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Paragraphs - wrap lines that aren't already wrapped
  const lines = html.split('\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return line;
    return `<p class="my-2">${line}</p>`;
  }).join('\n');

  // Clean up empty paragraphs
  html = html.replace(/<p class="my-2"><\/p>/g, '');

  return html;
}

// Skeleton shimmer component for loading state
const SkeletonLoader: React.FC = () => (
  <div className="animate-pulse space-y-4 p-6">
    {/* Title skeleton */}
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
      <div className="h-7 w-48 rounded-md bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
    </div>
    {/* Content skeleton lines */}
    <div className="space-y-3 pt-4">
      <div className="h-4 w-full rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" style={{ animationDelay: '0.1s' }} />
      <div className="h-4 w-11/12 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" style={{ animationDelay: '0.2s' }} />
      <div className="h-4 w-4/5 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" style={{ animationDelay: '0.3s' }} />
      <div className="h-4 w-9/12 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" style={{ animationDelay: '0.4s' }} />
    </div>
    {/* Second paragraph skeleton */}
    <div className="space-y-3 pt-2">
      <div className="h-4 w-full rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" style={{ animationDelay: '0.5s' }} />
      <div className="h-4 w-10/12 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" style={{ animationDelay: '0.6s' }} />
      <div className="h-4 w-7/12 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" style={{ animationDelay: '0.7s' }} />
    </div>
  </div>
);

// Animated typing cursor
const TypingCursor: React.FC = () => (
  <span className="inline-flex items-center ml-1">
    <span className="relative flex h-5 w-0.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex h-5 w-0.5 rounded-full bg-amber-500" />
    </span>
  </span>
);

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  content,
  isStreaming,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  // Convert markdown content to HTML
  const htmlContent = useMemo(() => markdownToHtml(content || ''), [content]);

  const hasContent = !!content?.trim();

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto bg-card"
    >
      {/* Skeleton while streaming with no content */}
      {isStreaming && !hasContent && <SkeletonLoader />}

      {/* Document content */}
      {hasContent && (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">AI Generated Document</h1>
            {isStreaming && (
              <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />
            )}
          </div>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
          {isStreaming && <TypingCursor />}
        </div>
      )}
    </div>
  );
};
