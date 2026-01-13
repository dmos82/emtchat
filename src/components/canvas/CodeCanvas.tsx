'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Code2, Sparkles } from 'lucide-react';

interface CodeCanvasProps {
  content: string;
  language?: string;
  isStreaming: boolean;
}

// Simple syntax highlighting for common patterns
function highlightCode(code: string, language?: string): string {
  if (!code) return '';

  // Escape HTML first
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Basic syntax highlighting patterns
  // Comments
  highlighted = highlighted.replace(
    /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)/gm,
    '<span class="text-gray-500">$1</span>'
  );

  // Strings
  highlighted = highlighted.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
    '<span class="text-green-400">$1</span>'
  );

  // Keywords (common across languages)
  const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return',
    'import', 'export', 'from', 'class', 'extends', 'new', 'this', 'async', 'await',
    'def', 'self', 'True', 'False', 'None', 'print', 'range', 'in', 'not', 'and', 'or',
    'public', 'private', 'protected', 'static', 'void', 'int', 'string', 'bool'];
  const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  highlighted = highlighted.replace(keywordPattern, '<span class="text-purple-400">$1</span>');

  // Numbers
  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="text-amber-400">$1</span>'
  );

  // Function calls
  highlighted = highlighted.replace(
    /\b([a-zA-Z_]\w*)\s*\(/g,
    '<span class="text-blue-400">$1</span>('
  );

  return highlighted;
}

// Code skeleton loader
const CodeSkeletonLoader: React.FC = () => (
  <div className="p-4 pl-14 space-y-2">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div
        key={i}
        className="h-4 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
        style={{
          width: `${Math.random() * 40 + 40}%`,
          animationDelay: `${i * 0.1}s`,
        }}
      />
    ))}
  </div>
);

// Typing cursor for code
const CodeCursor: React.FC = () => (
  <span className="inline-flex items-center ml-0.5">
    <span className="relative flex h-4 w-0.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-sm bg-amber-400 opacity-75" />
      <span className="relative inline-flex h-4 w-0.5 rounded-sm bg-amber-500" />
    </span>
  </span>
);

export const CodeCanvas: React.FC<CodeCanvasProps> = ({
  content,
  language,
  isStreaming,
}) => {
  const containerRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const lines = content ? content.split('\n') : [];
  const highlightedContent = highlightCode(content, language);

  // Show skeleton immediately when streaming with no content
  const hasContent = !!content;
  const showSkeleton = isStreaming && !hasContent;

  // Always render the SAME DOM structure - use CSS to show/hide
  // This prevents React remounting which causes the flash
  return (
    <div className="relative h-full w-full bg-card">
      {/* Skeleton layer - shown immediately when streaming with no content */}
      <div
        className={cn(
          "absolute inset-0 bg-card transition-opacity duration-100 z-10",
          showSkeleton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2 px-4 pt-4 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />
          <span className="text-sm animate-pulse">Generating {language || 'code'}...</span>
        </div>
        <CodeSkeletonLoader />
        {/* Line numbers gutter placeholder */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-card border-r border-border">
          <div className="px-2 py-4 pt-12 text-right font-mono text-xs text-muted-foreground">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="leading-6 animate-pulse">{i}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Content layer - always rendered, fades in when content arrives */}
      <div
        className={cn(
          "h-full w-full transition-opacity duration-100",
          hasContent ? "opacity-100" : "opacity-0"
        )}
      >
        <pre
          ref={containerRef}
          className="h-full w-full overflow-auto p-4 pl-14 font-mono text-sm leading-6 text-foreground"
        >
          <code
            className="block"
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
          {isStreaming && hasContent && <CodeCursor />}
        </pre>

        {/* Line numbers gutter */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-card border-r border-border">
          <div className="px-2 py-4 text-right font-mono text-xs text-muted-foreground">
            {lines.map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
