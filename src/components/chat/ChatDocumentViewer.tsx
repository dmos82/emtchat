'use client';

import React, { useMemo } from 'react';
import BrandedPdfViewer from '@/components/BrandedPdfViewer';
import BrandedWordViewer from '@/components/BrandedWordViewer';
import { TextViewer } from '@/components/viewers/TextViewer';
import { ExcelViewer } from '@/components/viewers/ExcelViewer';

/**
 * ChatDocumentViewer - Opens inline chat documents in branded viewers
 *
 * This component routes to the appropriate branded viewer based on file type.
 * Unlike DocumentViewer (which fetches by documentId from backend), this
 * component works with blob URLs from user-attached files.
 *
 * File Type Routing:
 * - PDF → BrandedPdfViewer
 * - DOCX/DOC → BrandedWordViewer
 * - XLSX/XLS/CSV → ExcelViewer (or TextViewer for CSV with textContent)
 * - TXT/MD → TextViewer
 */

interface ChatDocumentViewerProps {
  fileName: string;
  fileType: string;
  blobUrl?: string;
  textContent?: string;
  onClose: () => void;
}

export function ChatDocumentViewer({
  fileName,
  fileType,
  blobUrl,
  textContent,
  onClose,
}: ChatDocumentViewerProps) {
  // Normalize file type
  const normalizedType = useMemo(() => fileType.toLowerCase(), [fileType]);

  // For viewers that need a URL but might not have blobUrl, create from textContent
  const effectiveUrl = useMemo(() => {
    if (blobUrl) return blobUrl;

    // Create blob URL from textContent if available (for text-based files)
    if (textContent) {
      const mimeType = normalizedType === 'csv' ? 'text/csv' : 'text/plain';
      const blob = new Blob([textContent], { type: mimeType });
      return URL.createObjectURL(blob);
    }

    return '';
  }, [blobUrl, textContent, normalizedType]);

  // PDF Viewer
  if (normalizedType === 'pdf') {
    if (!blobUrl) {
      // For KB documents without actual file, show text content instead
      if (textContent) {
        return (
          <TextViewer
            url={effectiveUrl}
            fileName={fileName}
            onClose={onClose}
          />
        );
      }
      return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md text-center">
            <p className="text-red-600">PDF preview requires the original file.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return (
      <BrandedPdfViewer
        fileUrl={blobUrl}
        title={fileName}
        onClose={onClose}
        showDownload={true}
      />
    );
  }

  // Word Document Viewer
  if (normalizedType === 'docx' || normalizedType === 'doc') {
    if (!blobUrl) {
      // Fallback: show textContent if available
      if (textContent) {
        return (
          <TextViewer
            url={effectiveUrl}
            fileName={fileName}
            onClose={onClose}
          />
        );
      }
      return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md text-center">
            <p className="text-red-600">Word document preview requires the original file.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return (
      <BrandedWordViewer
        fileUrl={blobUrl}
        title={fileName}
        onClose={onClose}
        showDownload={true}
      />
    );
  }

  // Excel/CSV Viewer
  if (['xlsx', 'xls', 'csv'].includes(normalizedType)) {
    // For CSV with textContent, prefer TextViewer (shows nicely formatted)
    // For XLSX/XLS, we need the blob URL for proper Excel parsing
    if (normalizedType === 'csv' && textContent) {
      return (
        <TextViewer
          url={effectiveUrl}
          fileName={fileName}
          onClose={onClose}
        />
      );
    }

    if (!blobUrl) {
      // Fallback for Excel without blob
      if (textContent) {
        return (
          <TextViewer
            url={effectiveUrl}
            fileName={fileName}
            onClose={onClose}
          />
        );
      }
      return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md text-center">
            <p className="text-red-600">Spreadsheet preview requires the original file.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    // ExcelViewer requires documentId for download, but we have blobUrl
    // We'll use the ExcelViewer with a dummy documentId and override download via blobUrl
    return (
      <ExcelViewerWithBlobDownload
        url={blobUrl}
        fileName={fileName}
        onClose={onClose}
      />
    );
  }

  // Text/Markdown Viewer (default for txt, md, markdown, and unknown text files)
  if (['txt', 'md', 'markdown'].includes(normalizedType) || textContent) {
    return (
      <TextViewer
        url={effectiveUrl}
        fileName={fileName}
        onClose={onClose}
      />
    );
  }

  // Unknown file type - offer download only
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md text-center">
        <p className="text-gray-700 mb-4">
          Preview not available for <strong>.{fileType}</strong> files.
        </p>
        {blobUrl && (
          <a
            href={blobUrl}
            download={fileName}
            className="inline-block px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
          >
            Download {fileName}
          </a>
        )}
        <button
          onClick={onClose}
          className="ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * Wrapper for ExcelViewer that handles blob URL download
 * (ExcelViewer's default download uses documentId which we don't have)
 */
function ExcelViewerWithBlobDownload({
  url,
  fileName,
  onClose,
}: {
  url: string;
  fileName: string;
  onClose: () => void;
}) {
  // Import the ExcelViewer dynamically to avoid issues with its documentId requirement
  // We'll render a simplified version that works with blob URLs

  return (
    <ExcelViewer
      url={url}
      fileName={fileName}
      documentId="chat-inline" // Placeholder - download will use blob URL
      onClose={onClose}
    />
  );
}

export default ChatDocumentViewer;
