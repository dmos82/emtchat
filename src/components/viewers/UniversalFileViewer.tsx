'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileQuestion, Loader2 } from 'lucide-react';
import BrandedWordViewer from '@/components/BrandedWordViewer';
import FormFillerViewer from '@/components/viewers/FormFillerViewer';
import { getApiBaseUrl } from '@/lib/config';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

// Lazy load heavy viewers to improve initial bundle size
// Note: MediaPlayer removed - video/audio are auto-transcribed to DOCX
// Note: BrandedWordViewer is imported directly (not lazy) for better UX with DOCX files
const ImageViewer = lazy(() => import('./ImageViewer'));
const TextViewer = lazy(() => import('./TextViewer'));
const ExcelViewer = lazy(() => import('./ExcelViewer'));

export type FileType = 'pdf' | 'video' | 'audio' | 'image' | 'text' | 'excel' | 'word' | 'unknown';

interface UniversalFileViewerProps {
  documentId: string;
  fileName: string;
  mimeType?: string;
  documentType?: 'user' | 'system';  // Type of document (user docs vs system KB)
  isOpen: boolean;
  onClose: () => void;
}

// File type detection
export function getFileType(fileName: string, mimeType?: string): FileType {
  // 1. Check MIME type first (most reliable)
  if (mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('text/')) return 'text';
    if (
      mimeType.includes('spreadsheet') ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return 'excel';
    }
    if (
      mimeType.includes('wordprocessing') ||
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return 'word';
    }
  }

  // 2. Fallback to extension
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    // PDF
    case 'pdf':
      return 'pdf';

    // Video
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'mkv':
    case 'webm':
    case 'm4v':
    case 'flv':
    case 'wmv':
    case 'mpeg':
    case 'mpg':
      return 'video';

    // Audio
    case 'mp3':
    case 'wav':
    case 'm4a':
    case 'aac':
    case 'ogg':
    case 'flac':
      return 'audio';

    // Images
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'webp':
    case 'tiff':
    case 'tif':
      return 'image';

    // Text/Markdown
    case 'txt':
    case 'md':
    case 'markdown':
      return 'text';

    // Excel
    case 'xlsx':
    case 'xls':
      return 'excel';

    // Word
    case 'docx':
    case 'doc':
      return 'word';

    default:
      return 'unknown';
  }
}

// Get file type icon color
export function getFileTypeColor(fileType: FileType): string {
  switch (fileType) {
    case 'pdf':
      return 'text-red-500';
    case 'video':
      return 'text-purple-500';
    case 'audio':
      return 'text-green-500';
    case 'image':
      return 'text-blue-500';
    case 'text':
      return 'text-gray-400';
    case 'excel':
      return 'text-emerald-500';
    case 'word':
      return 'text-blue-600';
    default:
      return 'text-gray-500';
  }
}

// Loading fallback
function ViewerLoading() {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading viewer...</p>
      </div>
    </div>
  );
}

// Download prompt for unknown file types
function DownloadPrompt({
  fileName,
  documentId,
  onClose,
}: {
  fileName: string;
  documentId: string;
  onClose: () => void;
}) {
  const handleDownload = async () => {
    try {
      const response = await fetchWithAuth(`/api/documents/${documentId}/download`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-8 max-w-md text-center border border-gray-700">
        <FileQuestion className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Cannot Preview File</h2>
        <p className="text-gray-400 mb-2 break-all">{fileName}</p>
        <p className="text-gray-500 text-sm mb-6">
          This file type cannot be previewed in the browser. Please download the file to view it.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleDownload}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function UniversalFileViewer({
  documentId,
  fileName,
  mimeType,
  documentType = 'user',  // Default to user documents for backward compatibility
  isOpen,
  onClose,
}: UniversalFileViewerProps) {
  // Use portal to render viewer at document body level (escapes CSS containment)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  const fileType = getFileType(fileName, mimeType);
  const apiUrl = getApiBaseUrl();
  // Use correct endpoint based on document type (system KB vs user documents)
  const streamUrl = documentType === 'system'
    ? `${apiUrl}/api/system-kb/stream/${documentId}`
    : `${apiUrl}/api/documents/stream/${documentId}`;

  // Build the viewer content
  let viewerContent: React.ReactNode = null;

  switch (fileType) {
    case 'pdf':
      viewerContent = (
        <FormFillerViewer
          documentId={documentId}
          fileUrl={streamUrl}
          title={fileName}
          onClose={onClose}
        />
      );
      break;

    case 'video':
    case 'audio':
      // Videos and audio are auto-transcribed to DOCX - show download prompt
      viewerContent = <DownloadPrompt fileName={fileName} documentId={documentId} onClose={onClose} />;
      break;

    case 'image':
      viewerContent = (
        <Suspense fallback={<ViewerLoading />}>
          <ImageViewer url={streamUrl} fileName={fileName} onClose={onClose} />
        </Suspense>
      );
      break;

    case 'text':
      viewerContent = (
        <Suspense fallback={<ViewerLoading />}>
          <TextViewer url={streamUrl} fileName={fileName} onClose={onClose} />
        </Suspense>
      );
      break;

    case 'excel':
      viewerContent = (
        <Suspense fallback={<ViewerLoading />}>
          <ExcelViewer url={streamUrl} fileName={fileName} documentId={documentId} onClose={onClose} />
        </Suspense>
      );
      break;

    case 'word':
      viewerContent = (
        <BrandedWordViewer
          fileUrl={streamUrl}
          title={fileName}
          documentId={documentId}
          onClose={onClose}
        />
      );
      break;

    default:
      viewerContent = <DownloadPrompt fileName={fileName} documentId={documentId} onClose={onClose} />;
  }

  // Render via portal to document body to ensure proper fixed positioning
  return createPortal(viewerContent, document.body);
}

export default UniversalFileViewer;
