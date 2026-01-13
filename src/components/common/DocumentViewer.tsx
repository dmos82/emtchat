'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import BrandedPdfViewer from '@/components/BrandedPdfViewer';
import BrandedWordViewer from '@/components/BrandedWordViewer';
import ExcelViewer from '@/components/viewers/ExcelViewer';
import { TextViewer } from '@/components/viewers/TextViewer';
import ResizablePopup from '@/components/viewers/ResizablePopup';
import { getApiBaseUrl } from '@/lib/config';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface DocumentViewerProps {
  documentId: string;
  filename: string;
  type: 'user' | 'system';
  onClose: () => void;
}

export function DocumentViewer({ documentId, filename, type, onClose }: DocumentViewerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [displayFileName, setDisplayFileName] = useState<string>(filename);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'word' | 'excel' | 'text' | 'other'>('pdf');
  const [mounted, setMounted] = useState(false);

  // Track mount state for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setFileUrl(null);

    const fetchDocument = async () => {
      if (!user) {
        if (isMounted) {
          setError(new Error('User not authenticated.'));
          setIsLoading(false);
        }
        return;
      }

      if (!documentId) {
        if (isMounted) {
          setError(new Error('Document ID is missing.'));
          setIsLoading(false);
        }
        return;
      }

      // Determine file type from filename
      const fileName = filename.toLowerCase();
      const isPdf = fileName.endsWith('.pdf');
      const isImage =
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.png') ||
        fileName.endsWith('.gif') ||
        fileName.endsWith('.bmp') ||
        fileName.endsWith('.webp') ||
        fileName.endsWith('.tiff') ||
        fileName.endsWith('.tif');
      const isWord = fileName.endsWith('.docx') || fileName.endsWith('.doc');
      const isExcel =
        fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.xlsm');
      const isText = fileName.endsWith('.txt') || fileName.endsWith('.md');

      // For text files, we can preview them - set the type and build the stream URL
      if (isText) {
        if (isMounted) {
          setFileType('text');
          // Build the stream URL for the Text viewer
          const apiUrl = getApiBaseUrl();
          const streamEndpoint = type === 'system'
            ? `${apiUrl}/api/system-kb/stream/${documentId}`
            : `${apiUrl}/api/documents/stream/${documentId}`;
          setFileUrl(streamEndpoint);
          setDisplayFileName(filename);
          setIsLoading(false);
        }
        return;
      }

      // For Excel files, we can preview them - set the type and build the stream URL
      if (isExcel) {
        if (isMounted) {
          setFileType('excel');
          // Build the stream URL for the Excel viewer
          const apiUrl = getApiBaseUrl();
          const streamEndpoint = type === 'system'
            ? `${apiUrl}/api/system-kb/stream/${documentId}`
            : `${apiUrl}/api/documents/stream/${documentId}`;
          setFileUrl(streamEndpoint);
          setDisplayFileName(filename);
          setIsLoading(false);
        }
        return;
      }

      // For Word files, we can preview them - set the type and build the stream URL
      if (isWord) {
        if (isMounted) {
          setFileType('word');
          // Build the stream URL for the Word viewer
          const apiUrl = getApiBaseUrl();
          const streamEndpoint = type === 'system'
            ? `${apiUrl}/api/system-kb/stream/${documentId}`
            : `${apiUrl}/api/documents/stream/${documentId}`;
          setFileUrl(streamEndpoint);
          setDisplayFileName(filename);
          setIsLoading(false);
        }
        return;
      }

      // Use streaming endpoints to bypass S3 CORS issues
      let endpoint;
      if (type === 'system') {
        endpoint = `/api/system-kb/stream/${documentId}`;
      } else if (type === 'user') {
        endpoint = `/api/documents/stream/${documentId}`;
      } else {
        if (isMounted) {
          setError(new Error(`Unknown document type: ${type}`));
          setIsLoading(false);
        }
        return;
      }

      try {
        console.log('[DocumentViewer] Streaming document from:', endpoint);
        const response = await fetchWithAuth(endpoint, { method: 'GET' });

        if (!response.ok) {
          let errorText = '';
          try {
            const errorData = await response.json();
            errorText = errorData.message || JSON.stringify(errorData);
          } catch {
            errorText = await response.text().catch(() => 'Unknown error');
          }
          console.error(
            '[DocumentViewer] Fetch failed:',
            response.status,
            errorText.substring(0, 150)
          );
          throw new Error(`Failed to fetch document (${response.status}): ${errorText}`);
        }

        // Stream returns the file directly as blob - create object URL
        const blob = await response.blob();
        console.log('[DocumentViewer] Received blob. Type:', blob.type, 'Size:', blob.size);

        if (blob.size === 0) {
          throw new Error('Received empty file from server');
        }

        const objectUrl = URL.createObjectURL(blob);
        const actualFileName = filename || 'document';

        if (isMounted) {
          setFileUrl(objectUrl);
          setDisplayFileName(actualFileName);
          setFileType(isPdf ? 'pdf' : isImage ? 'image' : 'other');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[DocumentViewer] Error fetching document:', err);
        if (isMounted) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    };

    fetchDocument();

    return () => {
      isMounted = false;
    };
  }, [documentId, type, user, filename]);

  const handleDownload = async () => {
    if (!fileUrl) {
      // For files that don't have a URL yet, stream it and download
      let endpoint;
      if (type === 'system') {
        endpoint = `/api/system-kb/stream/${documentId}`;
      } else {
        endpoint = `/api/documents/stream/${documentId}`;
      }

      try {
        const response = await fetchWithAuth(endpoint, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status}`);
        }

        // Get the blob directly from stream
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);

        // Create download link
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename || 'document';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Revoke the blob URL after download
        URL.revokeObjectURL(downloadUrl);

        toast({
          title: 'Download Started',
          description: `Downloading ${filename || 'document'}...`,
        });
      } catch (error) {
        console.error('[DocumentViewer] Download error:', error);
        toast({
          variant: 'destructive',
          title: 'Download Failed',
          description: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      }
    } else {
      // Use existing URL for download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = displayFileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download Started',
        description: `Downloading ${displayFileName}...`,
      });
    }
  };

  if (isLoading) {
    if (!mounted) return null;
    return createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
          <p className="mt-4 text-center text-gray-700">Loading document...</p>
        </div>
      </div>,
      document.body
    );
  }

  if (error) {
    if (!mounted) return null;
    return createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg">
          <div className="text-red-600 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-center mb-2">Error Loading Document</h3>
          <p className="text-gray-700 text-center mb-4">{error.message}</p>
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Handle different file types
  if (fileType === 'other') {
    // For Excel, text files, etc. - show download option
    if (!mounted) return null;
    return createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4">Document Preview</h3>
            <p className="text-gray-700 mb-4">This file type cannot be previewed in the browser.</p>
            <p className="text-sm text-gray-600 mb-6">
              <strong>File:</strong> {displayFileName}
            </p>
            <div className="flex justify-center space-x-4">
              <Button onClick={handleDownload} className="flex items-center">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (fileType === 'image' && fileUrl) {
    // Image viewer
    if (!mounted) return null;
    return createPortal(
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] w-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {displayFileName}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>

          {/* Image Content */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            <img
              src={fileUrl}
              alt={displayFileName}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              onError={e => {
                console.error('Image failed to load:', e);
                toast({
                  variant: 'destructive',
                  title: 'Image Load Error',
                  description:
                    'Failed to load the image. It may be corrupted or the link has expired.',
                });
              }}
            />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (fileType === 'word' && fileUrl) {
    // Word viewer - wrap in ResizablePopup for draggable/resizable window
    if (!mounted) return null;
    return (
      <ResizablePopup
        isOpen={true}
        onClose={onClose}
        title={displayFileName}
        initialWidth={1000}
        initialHeight={700}
        minWidth={500}
        minHeight={400}
      >
        <BrandedWordViewer
          fileUrl={fileUrl}
          title={displayFileName}
          documentId={documentId}
          documentType={type}
          onClose={onClose}
          showDownload={true}
          embedded={true}
          onLoadError={(error: Error) => {
            console.error('[DocumentViewer] Word load error:', error.message);
            setError(error);
          }}
        />
      </ResizablePopup>
    );
  }

  if (fileType === 'excel' && fileUrl) {
    // Excel viewer - wrap in ResizablePopup for draggable/resizable window
    if (!mounted) return null;
    return (
      <ResizablePopup
        isOpen={true}
        onClose={onClose}
        title={displayFileName}
        initialWidth={1000}
        initialHeight={700}
        minWidth={500}
        minHeight={400}
      >
        <ExcelViewer
          url={fileUrl}
          fileName={displayFileName}
          documentId={documentId}
          documentType={type}
          onClose={onClose}
          embedded={true}
        />
      </ResizablePopup>
    );
  }

  if (fileType === 'text' && fileUrl) {
    // Text/Markdown viewer - wrap in ResizablePopup for draggable/resizable window
    if (!mounted) return null;
    return (
      <ResizablePopup
        isOpen={true}
        onClose={onClose}
        title={displayFileName}
        initialWidth={900}
        initialHeight={700}
        minWidth={400}
        minHeight={300}
      >
        <TextViewer
          url={fileUrl}
          fileName={displayFileName}
          documentId={documentId}
          documentType={type}
          onClose={onClose}
          embedded={true}
        />
      </ResizablePopup>
    );
  }

  if (fileType === 'pdf' && fileUrl) {
    // PDF viewer - wrap in ResizablePopup for draggable/resizable window
    if (!mounted) return null;
    return (
      <ResizablePopup
        isOpen={true}
        onClose={onClose}
        title={displayFileName}
        initialWidth={1000}
        initialHeight={800}
        minWidth={500}
        minHeight={400}
      >
        <BrandedPdfViewer
          fileUrl={fileUrl}
          title={displayFileName}
          onClose={onClose}
          initialPageNumber={1}
          showDownload={true}
          embedded={true}
          onLoadError={(error: Error) => {
            console.error('[DocumentViewer] PDF load error:', error.message);
            setError(error);
          }}
        />
      </ResizablePopup>
    );
  }

  // Fallback
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8">
        <p className="text-center text-gray-700">No document to display.</p>
        <div className="flex justify-center mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
