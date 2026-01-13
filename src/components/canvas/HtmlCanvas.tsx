'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, ExternalLink, Code, Eye, Maximize2, MousePointer2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

// HTML skeleton loader for enterprise-quality loading state
const HtmlSkeletonLoader: React.FC = () => (
  <div className="h-full w-full p-6 bg-card">
    {/* Header skeleton */}
    <div className="mb-6 space-y-3">
      <div
        className="h-8 w-64 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
        style={{ animationDelay: '0s' }}
      />
      <div
        className="h-4 w-96 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
        style={{ animationDelay: '0.1s' }}
      />
    </div>

    {/* Card grid skeleton */}
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 rounded-lg bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>

    {/* Content skeleton */}
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-4 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
          style={{
            width: `${85 - i * 10}%`,
            animationDelay: `${0.3 + i * 0.05}s`,
          }}
        />
      ))}
    </div>

    {/* Button skeleton */}
    <div className="mt-6 flex gap-3">
      <div
        className="h-10 w-24 rounded-md bg-gradient-to-r from-blue-800/50 via-blue-700/30 to-blue-800/50 animate-shimmer"
        style={{ animationDelay: '0.5s' }}
      />
      <div
        className="h-10 w-24 rounded-md bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
        style={{ animationDelay: '0.55s' }}
      />
    </div>
  </div>
);

interface HtmlCanvasProps {
  content: string;
  isStreaming: boolean;
  onOpenInBrowser: () => void;
}

export const HtmlCanvas: React.FC<HtmlCanvasProps> = ({
  content,
  isStreaming,
  onOpenInBrowser,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showSource, setShowSource] = useState(false);
  const [userToggledView, setUserToggledView] = useState(false); // Track if user manually toggled
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Auto-show source during streaming to prevent iframe reload flash
  // Switch to preview automatically when streaming ends (unless user toggled manually)
  useEffect(() => {
    if (isStreaming && !userToggledView) {
      setShowSource(true); // Show source during streaming
    } else if (!isStreaming && !userToggledView && content.trim()) {
      setShowSource(false); // Switch to preview when done
    }
  }, [isStreaming, userToggledView, content]);

  // Reset user toggle when new streaming starts
  useEffect(() => {
    if (isStreaming) {
      setUserToggledView(false);
    }
  }, [isStreaming]);

  // Track the previous blob URL for cleanup
  const prevBlobUrlRef = useRef<string | null>(null);
  // Track streaming state for cleanup logic
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  // Fix incomplete HTML - AI sometimes outputs partial HTML without DOCTYPE/head
  const fixIncompleteHtml = useCallback((html: string): string => {
    const trimmed = html.trim();

    // If it already starts with DOCTYPE or html tag, it's complete
    if (trimmed.toLowerCase().startsWith('<!doctype') ||
        trimmed.toLowerCase().startsWith('<html')) {
      return trimmed;
    }

    // Check if code references any canvas by ID (e.g., getElementById('gameCanvas'), getElementById('pongCanvas'))
    // Extract the canvas ID if found
    const canvasIdMatch = trimmed.match(/getElementById\(['"]([^'"]+Canvas)['"]\)/i) ||
                          trimmed.match(/getElementById\(['"]([^'"]*canvas)['"]\)/i);
    const canvasId = canvasIdMatch ? canvasIdMatch[1] : null;
    const hasCanvasRef = !!canvasId;

    // Check if there's an actual <canvas> opening tag with that ID
    const hasCanvasElement = canvasId
      ? new RegExp(`<canvas[^>]*id=['"]${canvasId}['"]`, 'i').test(trimmed)
      : /<canvas\s/i.test(trimmed);

    // Extract title if there's one in the content
    const titleMatch = trimmed.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'HTML Content';

    // Wrap incomplete HTML in a proper document structure
    console.log('[HtmlCanvas] Fixing incomplete HTML - wrapping in document structure');
    console.log('[HtmlCanvas] canvasId:', canvasId, 'hasCanvasRef:', hasCanvasRef, 'hasCanvasElement:', hasCanvasElement);

    // Clean up any stray closing tags from malformed AI output
    let cleanedContent = trimmed
      .replace(/<\/body>\s*<\/html>\s*<\/canvas>\s*$/i, '')  // Remove </body></html></canvas> at end
      .replace(/<\/body>\s*<\/html>\s*$/i, '')               // Remove </body></html> at end
      .replace(/<\/canvas>\s*$/i, '');                        // Remove stray </canvas> at end

    // Generate canvas element with the correct ID
    const canvasElement = hasCanvasRef && !hasCanvasElement
      ? `<canvas id="${canvasId}" width="800" height="600"></canvas>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ${hasCanvasRef ? 'background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh;' : 'background: #f5f5f5; padding: 20px;'}
    }
    .controls { color: #888; font-size: 14px; margin: 10px 0; text-align: center; }
    canvas { border: 2px solid #333; display: block; margin: 0 auto; }
  </style>
</head>
<body>
  ${canvasElement}
  ${cleanedContent}
</body>
</html>`;
  }, []);

  // Create blob URL for iframe src - ONLY when streaming ends to prevent flash
  // During streaming, we show source code view instead of iframe
  useEffect(() => {
    // Only create/update blob URL when NOT streaming and we have content
    if (isStreaming) {
      return; // Don't update during streaming - prevents iframe reload flash
    }

    if (!content.trim()) {
      // Clean up and clear
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = null;
      }
      setBlobUrl(null);
      return;
    }

    // Clean up previous blob URL
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
    }

    // Fix incomplete HTML before creating blob
    console.log('[HtmlCanvas] Original content length:', content.length);
    console.log('[HtmlCanvas] Content starts with:', content.substring(0, 100));
    const fixedContent = fixIncompleteHtml(content);
    console.log('[HtmlCanvas] Fixed content length:', fixedContent.length);
    console.log('[HtmlCanvas] Fixed starts with:', fixedContent.substring(0, 100));
    const blob = new Blob([fixedContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    prevBlobUrlRef.current = url;
    setBlobUrl(url);
    console.log('[HtmlCanvas] Blob URL created:', url);

    return () => {
      // IMPORTANT: Don't revoke blob URL if streaming is starting
      // This prevents the preview from disappearing when a new message starts
      // The URL will be cleaned up when content changes or component unmounts
      if (isStreamingRef.current) {
        return; // Keep the blob URL - we'll need it after streaming ends
      }
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = null;
      }
    };
  }, [content, isStreaming, fixIncompleteHtml]);

  // Auto-scroll source view during streaming
  const sourceRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (isStreaming && showSource && sourceRef.current) {
      sourceRef.current.scrollTop = sourceRef.current.scrollHeight;
    }
  }, [content, isStreaming, showSource]);

  const hasContent = !!content.trim();

  // Always render the same DOM structure - use CSS to show/hide
  return (
    <div className="flex h-full flex-col bg-card relative">
      {/* Skeleton layer - shown immediately when streaming with no content */}
      <div
        className={cn(
          "absolute inset-0 z-10 bg-card transition-opacity duration-100",
          isStreaming && !hasContent ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border">
          <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />
          <span className="text-sm text-muted-foreground animate-pulse">AI is generating HTML...</span>
        </div>
        <HtmlSkeletonLoader />
      </div>

      {/* Main content layer */}
      <div
        className={cn(
          "flex h-full flex-col transition-opacity duration-100",
          hasContent ? "opacity-100" : "opacity-0"
        )}
      >
        {/* View Toggle */}
        <div className="flex items-center justify-between border-b bg-muted px-3 py-1.5">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={!showSource ? 'secondary' : 'ghost'}
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => {
                setShowSource(false);
                setUserToggledView(true);
              }}
              disabled={isStreaming} // Disable preview during streaming to prevent flash
              title={isStreaming ? 'Preview available when generation completes' : 'Show preview'}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              size="sm"
              variant={showSource ? 'secondary' : 'ghost'}
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => {
                setShowSource(true);
                setUserToggledView(true);
              }}
            >
              <Code className="h-3.5 w-3.5" />
              Source
            </Button>
          </div>
          {isStreaming && (
            <div className="flex items-center gap-1 text-xs text-amber-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Streaming...</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {showSource ? (
            <div className="h-full flex flex-col bg-card">
              {/* Polished streaming header */}
              {isStreaming && (
                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-500/20">
                  <div className="relative">
                    <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Building your page...</span>
                    <span className="text-xs text-muted-foreground">AI is writing the HTML structure</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                </div>
              )}
              {/* Code display with subtle styling */}
              <pre
                ref={sourceRef}
                className={cn(
                  "flex-1 overflow-auto p-4 font-mono text-sm",
                  "whitespace-pre-wrap break-words",
                  isStreaming
                    ? "bg-gradient-to-b from-card to-muted/30 text-muted-foreground"
                    : "bg-card text-foreground"
                )}
              >
                <code className={cn(
                  isStreaming && "opacity-80"
                )}>{content}</code>
                {isStreaming && (
                  <span className="inline-block h-4 w-0.5 animate-pulse bg-amber-500 ml-0.5 rounded-full" />
                )}
              </pre>
              {/* Footer hint during streaming */}
              {isStreaming && (
                <div className="px-4 py-2 bg-muted/50 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview will appear when generation completes</span>
                </div>
              )}
            </div>
          ) : (
            <div className="relative h-full w-full bg-card">
              {blobUrl ? (
                <>
                  <iframe
                    ref={iframeRef}
                    src={blobUrl}
                    className={cn(
                      "h-full w-full border-0 transition-all",
                      isFocused && "ring-2 ring-blue-500 ring-inset"
                    )}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                    title="HTML Preview"
                    onFocus={() => {
                      setIsFocused(true);
                      setHasInteracted(true);
                    }}
                    onBlur={() => setIsFocused(false)}
                    onClick={() => {
                      iframeRef.current?.focus();
                      setHasInteracted(true);
                    }}
                    tabIndex={0}
                  />
                  {/* Click to interact overlay for games/interactive content */}
                  {!hasInteracted && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer"
                      onClick={() => {
                        iframeRef.current?.focus();
                        setHasInteracted(true);
                      }}
                    >
                      <div className="text-center text-white">
                        <MousePointer2 className="h-8 w-8 mx-auto mb-2 animate-bounce" />
                        <p className="text-lg font-medium">Click to Interact</p>
                        <p className="text-sm text-white/70 mt-1">Enable keyboard controls</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <span className="text-sm">No content to preview</span>
                </div>
              )}
              {isStreaming && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating preview...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Open in Browser button */}
        {!isStreaming && hasContent && (
          <div className="flex items-center justify-between border-t border-border bg-muted px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {isFocused ? 'Keyboard active' : 'Click preview for keyboard controls'}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={onOpenInBrowser}
            >
              <Maximize2 className="h-4 w-4" />
              Open Full Screen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
