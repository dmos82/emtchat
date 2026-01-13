'use client';

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  Hash,
  Loader2,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useToast } from '@/components/ui/use-toast';

// Markdown component renderers with proper types - Light theme to match PDF viewer
const markdownComponents: Components = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-3xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-3">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-xl font-medium text-gray-700 mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="text-gray-700 mb-4 leading-relaxed">{children}</p>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-600 hover:text-amber-700 underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }: { className?: string; children?: ReactNode }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm">
        {children}
      </code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-sm">
      {children}
    </pre>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc list-inside mb-4 text-gray-700">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal list-inside mb-4 text-gray-700">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="mb-1">{children}</li>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-4 border-amber-500 pl-4 italic text-gray-500 my-4">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full border border-gray-200">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border border-gray-200 px-4 py-2 bg-gray-50 text-gray-800 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border border-gray-200 px-4 py-2 text-gray-700">{children}</td>
  ),
  hr: () => <hr className="border-gray-200 my-6" />,
};

interface TextViewerProps {
  url: string;
  fileName: string;
  documentId?: string;
  documentType?: 'user' | 'system';
  onClose: () => void;
  embedded?: boolean; // If true, renders without fixed positioning (for use inside ResizablePopup)
}

export function TextViewer({ url, fileName, documentId, documentType = 'user', onClose, embedded = false }: TextViewerProps) {
  const { toast } = useToast();
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Determine if markdown
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const isMarkdown = ['md', 'markdown'].includes(extension);

  // Fetch content
  useEffect(() => {
    const fetchContent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = localStorage.getItem('accessToken');
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.statusText}`);
        }

        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error('Error fetching text file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [url]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [content]);

  // Download - create blob from content (already fetched with auth)
  const handleDownload = useCallback(() => {
    if (!content) return;

    const blob = new Blob([content], { type: 'text/plain' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, [content, fileName]);

  // Save to My Docs - upload the file to user's document storage
  const handleSaveToMyDocs = useCallback(async () => {
    if (!content || isSaving) return;

    setIsSaving(true);
    try {
      // Step 1: Get presigned URL
      const presignedResponse = await fetchWithAuth('/api/documents/get-presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileName,
          contentType: 'text/plain',
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, key, documentId: newDocId } = await presignedResponse.json();

      // Step 2: Upload to S3
      const blob = new Blob([content], { type: 'text/plain' });
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'text/plain' },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Notify backend to process the uploaded file
      const processResponse = await fetchWithAuth('/api/documents/process-uploaded-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: newDocId,
          key,
          filename: fileName,
          contentType: 'text/plain',
        }),
      });

      if (!processResponse.ok) {
        throw new Error('Failed to process uploaded file');
      }

      toast({
        title: 'Saved to My Docs',
        description: `${fileName} has been saved to your documents.`,
      });
    } catch (error) {
      console.error('[TextViewer] Save to My Docs error:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save document',
      });
    } finally {
      setIsSaving(false);
    }
  }, [content, fileName, isSaving, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !window.getSelection()?.toString()) {
        // Copy all if nothing selected
        handleCopy();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleCopy]);

  // Line count
  const lines = content.split('\n');
  const lineCount = lines.length;

  // Content container - used in both embedded and non-embedded modes
  // Light theme with EMTChat branding to match PDF viewer
  const contentContainer = (
    <div className={cn(
      "bg-white flex flex-col overflow-hidden",
      embedded ? "h-full w-full" : "rounded-lg shadow-xl w-full max-w-5xl h-[90vh]"
    )}>
      {/* Branded Toolbar - matching PDF viewer style */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* EMTChat Logo */}
          <div className="h-6 flex items-center">
            <Image
              src="/emtchat-logo.png"
              alt="EMTChat Logo"
              width={24}
              height={24}
              className={cn('h-6 w-auto', !logoLoaded && 'hidden')}
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoLoaded(false)}
            />
            {!logoLoaded && (
              <FileText className="h-5 w-5 text-amber-500" />
            )}
          </div>

          {/* Document Title */}
          <span className="text-sm font-medium truncate max-w-[200px] md:max-w-md" title={fileName}>
            {fileName}
          </span>

          {/* File type badge */}
          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium">
            {isMarkdown ? 'MD' : 'TXT'}
          </span>

          {/* File stats */}
          {!isLoading && !error && (
            <span className="text-xs text-gray-500 hidden sm:inline">
              {lineCount} lines • {(content.length / 1024).toFixed(1)} KB
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Toggle line numbers (text only) */}
          {!isMarkdown && (
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={cn(
                "px-1.5 py-0.5 rounded text-xs flex items-center",
                showLineNumbers
                  ? "bg-amber-600 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              title="Toggle line numbers"
            >
              <Hash className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Lines</span>
            </button>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            disabled={isLoading || !!error}
            className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-3 w-3 mr-1 text-green-300" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Save to My Docs - only show for system docs or when viewing external files */}
          {documentType === 'system' && (
            <button
              onClick={handleSaveToMyDocs}
              disabled={isLoading || !!error || isSaving}
              className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save to My Documents"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save to My Docs'}</span>
            </button>
          )}

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={isLoading || !!error}
            className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download"
          >
            <Download className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="bg-white text-gray-500 border border-gray-200 hover:bg-gray-100 px-1.5 py-0.5 rounded text-xs flex items-center"
            aria-label="Close viewer"
          >
            <X className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-gray-100">
        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="mt-4 text-gray-500 text-sm">Loading document...</p>
          </div>
        )}

        {error && (
          <div className="h-full flex flex-col items-center justify-center p-4">
            <div className="bg-red-50 text-red-600 p-4 rounded-lg max-w-md text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <p className="font-medium">Failed to load document</p>
              <p className="text-sm mt-2">{error}</p>
              <button
                onClick={handleDownload}
                className="mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
              >
                Download Instead
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex justify-center py-4">
            <div
              className="bg-white shadow-lg mx-4 p-6 max-w-4xl w-full"
              style={{ minHeight: '400px' }}
            >
              {isMarkdown ? (
                // Markdown rendering
                <article className="prose prose-sm sm:prose-base max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {content}
                  </ReactMarkdown>
                </article>
              ) : (
                // Plain text with optional line numbers
                <div className="font-mono text-sm">
                  <table className="w-full">
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {showLineNumbers && (
                            <td className="select-none text-right pr-4 text-gray-400 w-12 align-top border-r border-gray-200">
                              {index + 1}
                            </td>
                          )}
                          <td className={cn(
                            "text-gray-700 whitespace-pre-wrap break-all",
                            showLineNumbers && "pl-4"
                          )}>
                            {line || '\u00A0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
        <span>{isMarkdown ? 'Markdown Document' : 'Plain Text Document'}</span>
        <div className="flex items-center space-x-4">
          <span>Ctrl+C to copy</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );

  // If embedded, return just the content without fixed positioning wrapper
  if (embedded) {
    return contentContainer;
  }

  // Non-embedded: wrap in fixed overlay (matching PDF viewer style)
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      {contentContainer}
    </div>
  );
}

export default TextViewer;
