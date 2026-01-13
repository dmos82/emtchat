'use client';

/**
 * FormFillerViewer Component
 *
 * A PDF viewer with form filling capabilities.
 * Detects AcroForm fields and renders interactive overlays for filling.
 */

import '@/lib/polyfills';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import Image from 'next/image';
import {
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileEdit,
  Download,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PdfSelectionOverlay } from '@/components/PdfSelectionOverlay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Use locally-copied worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface FormField {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'signature' | 'unknown';
  value?: string | boolean | string[];
  options?: string[];
  required?: boolean;
  readOnly?: boolean;
  page: number;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface FormFieldsResponse {
  success: boolean;
  documentId: string;
  fileName: string;
  hasFormFields: boolean;
  fieldCount: number;
  fields: FormField[];
  pageCount: number;
}

interface FormFillerViewerProps {
  documentId: string;
  fileUrl: string;
  title?: string;
  onClose: () => void;
  embedded?: boolean;
}

const FormFillerViewer: React.FC<FormFillerViewerProps> = ({
  documentId,
  fileUrl,
  title = 'Form',
  onClose,
  embedded = false,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // PDF state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);

  // Form state
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [hasFormFields, setHasFormFields] = useState<boolean>(false);
  const [isFormMode, setIsFormMode] = useState<boolean>(false);
  const [isLoadingFields, setIsLoadingFields] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // OCR overlay state for garbled PDFs (like ICBC docs with Type 3 fonts)
  const [hasOcrGeometry, setHasOcrGeometry] = useState<boolean>(false);

  // Fetch PDF blob
  useEffect(() => {
    let isMounted = true;

    const fetchPdf = async () => {
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
          throw new Error(`Failed to load PDF (${response.status})`);
        }

        const blob = await response.blob();
        if (isMounted) {
          const objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      } catch (err) {
        console.error('[FormFillerViewer] Error fetching PDF:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load PDF'));
          setLoading(false);
        }
      }
    };

    fetchPdf();

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileUrl]);

  // Fetch form fields
  useEffect(() => {
    const fetchFormFields = async () => {
      if (!documentId) return;

      setIsLoadingFields(true);
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/forms/${documentId}/fields`, {
          credentials: 'include',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        if (!response.ok) {
          console.warn('[FormFillerViewer] Could not fetch form fields');
          return;
        }

        const data: FormFieldsResponse = await response.json();

        if (data.success && data.hasFormFields) {
          setFormFields(data.fields);
          setHasFormFields(true);

          // Initialize form values from existing field values
          const initialValues: Record<string, string | boolean> = {};
          data.fields.forEach(field => {
            if (field.value !== undefined) {
              if (typeof field.value === 'boolean') {
                initialValues[field.name] = field.value;
              } else if (Array.isArray(field.value)) {
                initialValues[field.name] = field.value[0] || '';
              } else {
                initialValues[field.name] = field.value;
              }
            } else {
              // Set default empty values based on type
              initialValues[field.name] = field.type === 'checkbox' ? false : '';
            }
          });
          setFormValues(initialValues);
        }
      } catch (err) {
        console.error('[FormFillerViewer] Error fetching form fields:', err);
      } finally {
        setIsLoadingFields(false);
      }
    };

    fetchFormFields();
  }, [documentId]);

  // Handle document load success
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }, []);

  // Handle page render success - get page dimensions
  const onPageLoadSuccess = useCallback((page: { width: number; height: number }) => {
    setPageWidth(page.width);
    setPageHeight(page.height);
  }, []);

  // Handle document load error
  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('[FormFillerViewer] PDF load error:', error.message);
    setError(error);
    setLoading(false);
    setNumPages(null);
  }, []);

  // Navigation
  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (numPages && currentPage < numPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, numPages]);

  // Zoom
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  }, []);

  // Form value change handler
  const handleFieldChange = useCallback((fieldName: string, value: string | boolean) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  // Reset form
  const handleResetForm = useCallback(() => {
    const initialValues: Record<string, string | boolean> = {};
    formFields.forEach(field => {
      initialValues[field.name] = field.type === 'checkbox' ? false : '';
    });
    setFormValues(initialValues);
  }, [formFields]);

  // Download filled form
  const handleDownloadFilled = useCallback(async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/forms/${documentId}/fill`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          values: formValues,
          flatten: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate filled PDF (${response.status})`);
      }

      // Get filename from content-disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'filled_form.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Form Downloaded',
        description: `Saved as ${filename}`,
      });
    } catch (err) {
      console.error('[FormFillerViewer] Error downloading filled form:', err);
      toast({
        title: 'Download Failed',
        description: err instanceof Error ? err.message : 'Failed to download filled form',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [documentId, formValues, isDownloading, toast]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        handlePreviousPage();
      } else if (e.key === 'Escape') {
        if (isFormMode) {
          setIsFormMode(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, onClose, isFormMode, handleNextPage, handlePreviousPage]);

  // Get fields for current page
  const currentPageFields = useMemo(() => {
    return formFields.filter(field => field.page === currentPage - 1);
  }, [formFields, currentPage]);

  // Render form field overlay
  const renderFieldOverlay = (field: FormField) => {
    if (!field.rect || field.readOnly) return null;

    // Calculate position based on PDF coordinates
    // PDF coordinates have origin at bottom-left, we need top-left
    const scaledX = field.rect.x * scale;
    const scaledY = (pageHeight - field.rect.y - field.rect.height) * scale;
    const scaledWidth = field.rect.width * scale;
    const scaledHeight = field.rect.height * scale;

    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${scaledX}px`,
      top: `${scaledY}px`,
      width: `${scaledWidth}px`,
      height: `${scaledHeight}px`,
      zIndex: 10,
    };

    const value = formValues[field.name];

    switch (field.type) {
      case 'text':
        return (
          <Input
            key={field.name}
            style={style}
            className="bg-yellow-50/80 border-yellow-400 text-sm px-1 py-0"
            value={typeof value === 'string' ? value : ''}
            onChange={e => handleFieldChange(field.name, e.target.value)}
            placeholder={field.name}
          />
        );

      case 'checkbox':
        return (
          <div
            key={field.name}
            style={style}
            className="flex items-center justify-center bg-yellow-50/80 rounded border border-yellow-400"
          >
            <input
              type="checkbox"
              checked={typeof value === 'boolean' ? value : false}
              onChange={e => handleFieldChange(field.name, e.target.checked)}
              className="h-4 w-4 accent-yellow-600 cursor-pointer"
            />
          </div>
        );

      case 'dropdown':
        return (
          <Select
            key={field.name}
            value={typeof value === 'string' ? value : ''}
            onValueChange={val => handleFieldChange(field.name, val)}
          >
            <SelectTrigger
              style={{ ...style, position: 'absolute' }}
              className="bg-yellow-50/80 border-yellow-400 text-sm h-auto"
            >
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  // Wrapper classes
  const wrapperClasses = embedded
    ? 'flex flex-col w-full h-full bg-neutral-900'
    : 'fixed inset-0 z-50 flex flex-col bg-neutral-900/95';

  return (
    <div className={wrapperClasses} ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-neutral-800 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <Image
            src="/goldkey-logo.svg"
            alt="Logo"
            width={32}
            height={32}
            className="rounded"
            priority
          />
          <span className="text-white font-medium truncate max-w-[200px]">{title}</span>
          {hasFormFields && (
            <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">
              Fillable Form
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Form mode toggle */}
          {hasFormFields && (
            <Button
              variant={isFormMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsFormMode(!isFormMode)}
              disabled={isLoadingFields}
              className="gap-1"
            >
              <FileEdit className="h-4 w-4" />
              {isFormMode ? 'View Mode' : 'Fill Form'}
            </Button>
          )}

          {/* Download filled form */}
          {isFormMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetForm}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadFilled}
                disabled={isDownloading}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download Filled
              </Button>
            </>
          )}

          {/* Close button */}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5 text-white" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {loading && !blobUrl && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-white mb-4" />
            <p className="text-white/70">Loading PDF...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-red-400 mb-2">Failed to load PDF</p>
            <p className="text-white/50 text-sm">{error.message}</p>
          </div>
        )}

        {blobUrl && (
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            }
          >
            {/* Container for Page + Overlay alignment */}
            <div
              ref={pageContainerRef}
              className="relative shadow-2xl"
              style={{ display: 'inline-block' }}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                onLoadSuccess={onPageLoadSuccess}
                renderAnnotationLayer={!isFormMode}
                renderTextLayer={!hasOcrGeometry}
              />

              {/* OCR Selection Overlay for garbled PDFs - positioned exactly over Page canvas */}
              {documentId && pageWidth > 0 && pageHeight > 0 && (
                <PdfSelectionOverlay
                  documentId={documentId}
                  pageNumber={currentPage}
                  scale={scale}
                  containerWidth={pageWidth * scale}
                  containerHeight={pageHeight * scale}
                  enabled={true}
                  onOcrStatusChange={setHasOcrGeometry}
                  debug={false}  // Set true to diagnose alignment issues
                />
              )}

              {/* Form field overlays */}
              {isFormMode && pageHeight > 0 && (
                <div
                  className="absolute inset-0 pointer-events-auto"
                  style={{ width: pageWidth * scale, height: pageHeight * scale }}
                >
                  {currentPageFields.map(field => renderFieldOverlay(field))}
                </div>
              )}
            </div>
          </Document>
        )}
      </div>

      {/* Footer with controls */}
      <div className="flex items-center justify-between p-3 bg-neutral-800 border-t border-neutral-700">
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </Button>
          <span className="text-white text-sm min-w-[80px] text-center">
            {currentPage} / {numPages || '...'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={!numPages || currentPage >= numPages}
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </Button>
        </div>

        {/* Form fields on current page */}
        {isFormMode && (
          <div className="text-white/50 text-sm">
            {currentPageFields.length} field{currentPageFields.length !== 1 ? 's' : ''} on this page
          </div>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-5 w-5 text-white" />
          </Button>
          <span className="text-white text-sm min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={scale >= 3}>
            <ZoomIn className="h-5 w-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FormFillerViewer;
