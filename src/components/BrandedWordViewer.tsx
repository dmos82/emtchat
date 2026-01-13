'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';
import Image from 'next/image';
import {
  X,
  Loader2,
  ZoomIn,
  ZoomOut,
  DownloadIcon,
  FileText,
  Printer,
  Search,
  ChevronUp,
  ChevronDown,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useToast } from '@/components/ui/use-toast';

interface BrandedWordViewerProps {
  fileUrl: string;
  title?: string;
  documentId?: string;
  documentType?: 'user' | 'system'; // Type of document for correct download endpoint
  onClose: () => void;
  showDownload?: boolean;
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
  embedded?: boolean; // If true, renders without fixed positioning (for use inside ResizablePopup)
}

const BrandedWordViewer: React.FC<BrandedWordViewerProps> = ({
  fileUrl,
  title = 'Document',
  documentId,
  documentType = 'user',
  onClose,
  showDownload = true,
  onLoadSuccess,
  onLoadError,
  embedded = false,
}) => {
  const { toast } = useToast();
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [logoLoaded, setLogoLoaded] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<number>(0);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if this is a legacy .doc file
  const extension = title.split('.').pop()?.toLowerCase();
  const isLegacyDoc = extension === 'doc';

  // Fetch and parse Word document
  useEffect(() => {
    if (isLegacyDoc) {
      setLoading(false);
      setError(new Error('Legacy .doc format cannot be previewed in browser. Please download the file to view.'));
      return;
    }

    const fetchAndParseWord = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('accessToken');
        const response = await fetch(fileUrl, {
          credentials: 'include',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load document: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        setDocxBuffer(arrayBuffer.slice(0));  // Store buffer for Save to My Docs

        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Title'] => h1.doc-title:fresh",
              "p[style-name='Subtitle'] => h2.doc-subtitle:fresh",
              "b => strong",
              "i => em",
              "u => u",
              "strike => s",
              "comment-reference => sup.comment-ref",
            ],
            convertImage: mammoth.images.imgElement(function(image) {
              return image.read("base64").then(function(imageBuffer) {
                return {
                  src: "data:" + image.contentType + ";base64," + imageBuffer
                };
              });
            })
          }
        );

        setHtmlContent(result.value);

        // Collect any warnings
        if (result.messages.length > 0) {
          setWarnings(result.messages.map((m) => m.message));
        }

        if (onLoadSuccess) {
          onLoadSuccess();
        }
      } catch (err) {
        console.error('[BrandedWordViewer] Error parsing Word file:', err);
        const error = err instanceof Error ? err : new Error('Failed to parse Word document');
        setError(error);
        if (onLoadError) {
          onLoadError(error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseWord();
  }, [fileUrl, isLegacyDoc, onLoadSuccess, onLoadError]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in search
      if (showSearch && document.activeElement === searchInputRef.current) {
        if (e.key === 'Escape') {
          setShowSearch(false);
          setSearchQuery('');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            handlePreviousSearch();
          } else {
            handleNextSearch();
          }
        }
        return;
      }

      if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else {
          onClose();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showSearch]);

  const handleZoomIn = useCallback(() => {
    setScale(prevScale => Math.min(prevScale + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
  }, []);

  // Handle download
  const handleDownload = useCallback(async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      let response: Response;

      if (documentId) {
        // Use the correct stream endpoint based on document type
        // Stream endpoints work for both system and user documents
        const endpoint = documentType === 'system'
          ? `/api/system-kb/stream/${documentId}`
          : `/api/documents/stream/${documentId}`;
        response = await fetchWithAuth(endpoint);
      } else {
        // Fetch directly with token using the fileUrl
        const token = localStorage.getItem('accessToken');
        response = await fetch(fileUrl, {
          credentials: 'include',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
      }

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = title || 'document.docx';
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('[BrandedWordViewer] Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [fileUrl, title, documentId, documentType, isDownloading]);

  // Save to My Docs - upload the document to user's document storage
  const handleSaveToMyDocs = useCallback(async () => {
    if (!docxBuffer || isSaving) return;

    setIsSaving(true);
    try {
      const contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      // Step 1: Get presigned URL
      const presignedResponse = await fetchWithAuth('/api/documents/get-presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: title || 'document.docx',
          contentType,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, key, documentId: newDocId } = await presignedResponse.json();

      // Step 2: Upload to S3
      const blob = new Blob([docxBuffer], { type: contentType });
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType },
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
          filename: title || 'document.docx',
          contentType,
        }),
      });

      if (!processResponse.ok) {
        throw new Error('Failed to process uploaded file');
      }

      toast({
        title: 'Saved to My Docs',
        description: `${title || 'document.docx'} has been saved to your documents.`,
      });
    } catch (error) {
      console.error('[BrandedWordViewer] Save to My Docs error:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save document',
      });
    } finally {
      setIsSaving(false);
    }
  }, [docxBuffer, title, isSaving, toast]);

  // Handle print
  const handlePrint = useCallback(() => {
    if (!contentRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 24px; margin-top: 24px; margin-bottom: 12px; }
            h2 { font-size: 20px; margin-top: 20px; margin-bottom: 10px; }
            h3 { font-size: 16px; margin-top: 16px; margin-bottom: 8px; }
            p { margin-bottom: 12px; }
            table { border-collapse: collapse; width: 100%; margin: 16px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            img { max-width: 100%; height: auto; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          ${contentRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [title]);

  // Search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (!query || !contentRef.current) {
      setSearchResults(0);
      setCurrentSearchIndex(0);
      // Remove existing highlights
      const content = contentRef.current;
      if (content) {
        content.innerHTML = content.innerHTML.replace(
          /<mark class="search-highlight[^"]*">(.*?)<\/mark>/gi,
          '$1'
        );
      }
      return;
    }

    // Remove existing highlights first
    const content = contentRef.current;
    content.innerHTML = content.innerHTML.replace(
      /<mark class="search-highlight[^"]*">(.*?)<\/mark>/gi,
      '$1'
    );

    // Add new highlights
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    let matchCount = 0;

    const walker = document.createTreeWalker(
      content,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    textNodes.forEach((node) => {
      if (node.textContent && regex.test(node.textContent)) {
        const span = document.createElement('span');
        span.innerHTML = node.textContent.replace(regex, (match) => {
          matchCount++;
          return `<mark class="search-highlight search-highlight-${matchCount}">${match}</mark>`;
        });
        node.parentNode?.replaceChild(span, node);
      }
    });

    setSearchResults(matchCount);
    setCurrentSearchIndex(matchCount > 0 ? 1 : 0);

    // Scroll to first result
    if (matchCount > 0) {
      const firstHighlight = content.querySelector('.search-highlight-1');
      firstHighlight?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleNextSearch = useCallback(() => {
    if (searchResults === 0 || !contentRef.current) return;

    const nextIndex = currentSearchIndex >= searchResults ? 1 : currentSearchIndex + 1;
    setCurrentSearchIndex(nextIndex);

    const highlight = contentRef.current.querySelector(`.search-highlight-${nextIndex}`);
    highlight?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchResults, currentSearchIndex]);

  const handlePreviousSearch = useCallback(() => {
    if (searchResults === 0 || !contentRef.current) return;

    const prevIndex = currentSearchIndex <= 1 ? searchResults : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);

    const highlight = contentRef.current.querySelector(`.search-highlight-${prevIndex}`);
    highlight?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchResults, currentSearchIndex]);

  // Content container - used in both embedded and non-embedded modes
  const contentContainer = (
    <div className={cn(
      "bg-white flex flex-col overflow-hidden",
      embedded ? "h-full w-full" : "rounded-lg shadow-xl w-full max-w-5xl h-[90vh]"
    )}>
      {/* Branded Toolbar */}
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
                <FileText className="h-5 w-5 text-blue-500" />
              )}
            </div>

            {/* Document Title */}
            <span className="text-sm font-medium truncate max-w-[200px] md:max-w-md" title={title}>
              {title}
            </span>

            {/* Word badge */}
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
              DOCX
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {/* Search Toggle */}
            <button
              onClick={() => {
                setShowSearch(!showSearch);
                if (!showSearch) {
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }
              }}
              className={cn(
                "px-1.5 py-0.5 rounded text-xs flex items-center",
                showSearch
                  ? "bg-amber-600 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              title="Search (Ctrl+F)"
            >
              <Search className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Search</span>
            </button>

            {/* Zoom Controls */}
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Zoom Out</span>
            </button>

            <button
              onClick={handleResetZoom}
              className="text-xs text-gray-500 hover:text-gray-700 px-1"
              title="Reset zoom"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 2}
              className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Zoom In</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              title="Print (Ctrl+P)"
            >
              <Printer className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Save to My Docs - only show for system docs */}
            {documentType === 'system' && (
              <button
                onClick={handleSaveToMyDocs}
                disabled={loading || !!error || isSaving}
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

            {/* Download Button */}
            {showDownload && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download"
              >
                {isDownloading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <DownloadIcon className="h-3 w-3 mr-1" />
                )}
                <span className="hidden sm:inline">
                  {isDownloading ? 'Downloading...' : 'Download'}
                </span>
              </button>
            )}

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

        {/* Search Bar */}
        {showSearch && (
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search in document..."
              className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {searchResults > 0 && (
              <>
                <span className="text-xs text-gray-500">
                  {currentSearchIndex} of {searchResults}
                </span>
                <button
                  onClick={handlePreviousSearch}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Previous (Shift+Enter)"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNextSearch}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Next (Enter)"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
                handleSearch('');
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Warnings Banner */}
        {warnings.length > 0 && !loading && !error && (
          <div className="px-4 py-1.5 bg-yellow-50 border-b border-yellow-200 text-yellow-700 text-xs">
            <span className="font-medium">Note:</span> Some formatting may not display correctly.
          </div>
        )}

        {/* Document Viewer Area */}
        <div className="flex-1 bg-gray-100 overflow-auto">
          {/* Loading State */}
          {loading && (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="mt-4 text-gray-500 text-sm">Loading document...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="h-full flex flex-col items-center justify-center p-4">
              <div className="bg-red-50 text-red-600 p-4 rounded-lg max-w-md text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <p className="font-medium">Failed to load document</p>
                <p className="text-sm mt-2">{error.message}</p>
                {isLegacyDoc && (
                  <button
                    onClick={handleDownload}
                    className="mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
                  >
                    Download to View
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Document Content */}
          {!loading && !error && htmlContent && (
            <div className="flex justify-center py-4">
              <div
                className="bg-white shadow-lg mx-4"
                style={{
                  width: `${210 * scale}mm`, // A4 width
                  minHeight: `${297 * scale}mm`, // A4 height
                  padding: `${25 * scale}mm`,
                  transform: `scale(1)`,
                  transformOrigin: 'top center',
                }}
              >
                <article
                  ref={contentRef}
                  className="word-document prose prose-sm max-w-none"
                  style={{
                    fontSize: `${scale}rem`,
                  }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
          <span>Word Document Viewer</span>
          <div className="flex items-center space-x-4">
            <span>Ctrl+F to search</span>
            <span>Ctrl+P to print</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
  );

  // Global styles for Word document rendering
  const globalStyles = (
    <style jsx global>{`
      .word-document {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
      }
      .word-document h1 {
        font-size: 1.75em;
        font-weight: bold;
        margin-top: 0.75em;
        margin-bottom: 0.5em;
        color: #1a1a1a;
        border-bottom: 1px solid #e5e5e5;
        padding-bottom: 0.25em;
      }
      .word-document h1.doc-title {
        font-size: 2em;
        text-align: center;
        border-bottom: none;
      }
      .word-document h2 {
        font-size: 1.4em;
        font-weight: bold;
        margin-top: 0.75em;
        margin-bottom: 0.4em;
        color: #2a2a2a;
      }
      .word-document h2.doc-subtitle {
        text-align: center;
        color: #666;
        font-weight: normal;
      }
      .word-document h3 {
        font-size: 1.17em;
        font-weight: bold;
        margin-top: 0.75em;
        margin-bottom: 0.35em;
        color: #3a3a3a;
      }
      .word-document p {
        margin-bottom: 0.75em;
      }
      .word-document ul, .word-document ol {
        margin-left: 1.5em;
        margin-bottom: 0.75em;
      }
      .word-document li {
        margin-bottom: 0.25em;
      }
      .word-document table {
        border-collapse: collapse;
        margin: 1em 0;
        width: 100%;
      }
      .word-document th, .word-document td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
      }
      .word-document th {
        background-color: #f8f8f8;
        font-weight: 600;
      }
      .word-document tr:nth-child(even) {
        background-color: #fafafa;
      }
      .word-document img {
        max-width: 100%;
        height: auto;
        margin: 1em 0;
      }
      .word-document a {
        color: #0066cc;
        text-decoration: underline;
      }
      .word-document blockquote {
        border-left: 4px solid #ddd;
        margin: 1em 0;
        padding-left: 1em;
        color: #666;
      }
      .word-document code {
        background-color: #f4f4f4;
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
      }
      .word-document pre {
        background-color: #f4f4f4;
        padding: 1em;
        border-radius: 4px;
        overflow-x: auto;
      }
      .search-highlight {
        background-color: #fef08a;
        padding: 0 2px;
        border-radius: 2px;
      }
      .search-highlight-${currentSearchIndex} {
        background-color: #f97316;
        color: white;
      }
    `}</style>
  );

  // If embedded, return just the content without fixed positioning wrapper
  if (embedded) {
    return (
      <>
        {contentContainer}
        {globalStyles}
      </>
    );
  }

  // Non-embedded: wrap in fixed overlay
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      {contentContainer}
      {globalStyles}
    </div>
  );
};

export default BrandedWordViewer;
