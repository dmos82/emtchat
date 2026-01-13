'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Image from 'next/image';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Table,
  AlertCircle,
  Loader2,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useToast } from '@/components/ui/use-toast';

interface ExcelViewerProps {
  url: string;
  fileName: string;
  documentId: string;
  documentType?: 'user' | 'system';
  onClose: () => void;
  embedded?: boolean; // If true, renders without fixed positioning (for use inside ResizablePopup)
}

interface SheetData {
  name: string;
  data: (string | number | boolean | null)[][];
  headers: string[];
}

export function ExcelViewer({ url, fileName, documentId, documentType = 'user', onClose, embedded = false }: ExcelViewerProps) {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [workbookBuffer, setWorkbookBuffer] = useState<ArrayBuffer | null>(null);

  // Fetch and parse Excel file
  useEffect(() => {
    const fetchExcel = async () => {
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

        const arrayBuffer = await response.arrayBuffer();
        // Store buffer for Save to My Docs
        setWorkbookBuffer(arrayBuffer.slice(0));
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const parsedSheets: SheetData[] = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
            worksheet,
            { header: 1, defval: null }
          );

          // First row as headers
          const headers = (jsonData[0] || []).map((cell, idx) =>
            cell !== null ? String(cell) : `Column ${idx + 1}`
          );

          // Rest as data
          const data = jsonData.slice(1);

          return {
            name: sheetName,
            headers,
            data,
          };
        });

        setSheets(parsedSheets);
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExcel();
  }, [url]);

  // Download
  const handleDownload = useCallback(async () => {
    try {
      // Use the correct stream endpoint based on document type
      const endpoint = documentType === 'system'
        ? `/api/system-kb/stream/${documentId}`
        : `/api/documents/stream/${documentId}`;
      const response = await fetchWithAuth(endpoint);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
    }
  }, [documentId, documentType, fileName]);

  // Save to My Docs - upload the file to user's document storage
  const handleSaveToMyDocs = useCallback(async () => {
    if (!workbookBuffer || isSaving) return;

    setIsSaving(true);
    try {
      const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      // Step 1: Get presigned URL
      const presignedResponse = await fetchWithAuth('/api/documents/get-presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileName,
          contentType,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, key, documentId: newDocId } = await presignedResponse.json();

      // Step 2: Upload to S3
      const blob = new Blob([workbookBuffer], { type: contentType });
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
          filename: fileName,
          contentType,
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
      console.error('[ExcelViewer] Save to My Docs error:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save document',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workbookBuffer, fileName, isSaving, toast]);

  // Sort handler
  const handleSort = useCallback(
    (columnIndex: number) => {
      if (sortColumn === columnIndex) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(columnIndex);
        setSortDirection('asc');
      }
    },
    [sortColumn]
  );

  // Get sorted data
  const getSortedData = useCallback(
    (data: (string | number | boolean | null)[][]) => {
      if (sortColumn === null) return data;

      return [...data].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Handle null values
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
        if (bVal === null) return sortDirection === 'asc' ? -1 : 1;

        // Compare based on type
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    },
    [sortColumn, sortDirection]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'ArrowLeft' && activeSheet > 0) {
        setActiveSheet((prev) => prev - 1);
      }
      if (e.key === 'ArrowRight' && activeSheet < sheets.length - 1) {
        setActiveSheet((prev) => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activeSheet, sheets.length]);

  const currentSheet = sheets[activeSheet];
  const sortedData = currentSheet ? getSortedData(currentSheet.data) : [];

  // Content container - Light theme with EMTChat branding to match PDF viewer
  const contentContainer = (
    <div className={cn(
      "bg-white flex flex-col overflow-hidden",
      embedded ? "h-full w-full" : "rounded-lg shadow-xl w-full max-w-6xl h-[90vh]"
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
              <Table className="h-5 w-5 text-amber-500" />
            )}
          </div>

          {/* Document Title */}
          <span className="text-sm font-medium truncate max-w-[200px] md:max-w-md" title={fileName}>
            {fileName}
          </span>

          {/* Excel badge */}
          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
            XLSX
          </span>

          {/* File stats */}
          {currentSheet && (
            <span className="text-xs text-gray-500 hidden sm:inline">
              {currentSheet.data.length} rows × {currentSheet.headers.length} columns
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Save to My Docs - only show for system docs */}
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

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveSheet((prev) => Math.max(0, prev - 1))}
            disabled={activeSheet === 0}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>

          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={cn(
                "px-3 py-1 rounded text-sm whitespace-nowrap transition",
                index === activeSheet
                  ? 'bg-amber-500 text-white'
                  : 'text-gray-600 hover:bg-gray-200'
              )}
            >
              {sheet.name}
            </button>
          ))}

          <button
            onClick={() => setActiveSheet((prev) => Math.min(sheets.length - 1, prev + 1))}
            disabled={activeSheet === sheets.length - 1}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-gray-100">
        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="mt-4 text-gray-500 text-sm">Loading spreadsheet...</p>
          </div>
        )}

        {error && (
          <div className="h-full flex flex-col items-center justify-center p-4">
            <div className="bg-red-50 text-red-600 p-4 rounded-lg max-w-md text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <p className="font-medium">Failed to load spreadsheet</p>
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

        {!isLoading && !error && currentSheet && (
          <div className="p-4">
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 border-b border-gray-200 w-12">
                        #
                      </th>
                      {currentSheet.headers.map((header, idx) => (
                        <th
                          key={idx}
                          onClick={() => handleSort(idx)}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 border-b border-gray-200 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                        >
                          <div className="flex items-center gap-2">
                            {header}
                            {sortColumn === idx && (
                              <span className="text-amber-500">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-xs text-gray-400 border-b border-gray-100">
                          {rowIdx + 1}
                        </td>
                        {currentSheet.headers.map((_, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100 whitespace-nowrap"
                          >
                            {row[colIdx] !== null && row[colIdx] !== undefined
                              ? String(row[colIdx])
                              : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sortedData.length === 0 && (
                <div className="text-center py-8 text-gray-500">This sheet is empty</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
        <span>Excel Spreadsheet Viewer</span>
        <div className="flex items-center space-x-4">
          <span>Click headers to sort</span>
          <span>Arrow keys for sheets</span>
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

export default ExcelViewer;
