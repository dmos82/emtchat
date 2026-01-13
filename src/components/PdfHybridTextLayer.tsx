'use client';

/**
 * PdfHybridTextLayer - Accurate text selection for OCR'd PDFs
 *
 * PROBLEM: OCR coordinates (from Textract at upload time) don't match PDF.js rendering coordinates.
 * - Textract renders PDF at 300 DPI then OCRs the image
 * - PDF.js renders PDF at different resolution with potential margin differences
 * - Direct coordinate mapping results in misaligned selection boxes
 *
 * SOLUTION: Use PDF.js positions + OCR text (hybrid approach)
 * - PDF.js gives us accurate text positions (from the same rendering engine)
 * - OCR gives us readable text (for garbled Type 3 fonts)
 * - We render invisible text at PDF.js positions but with OCR content
 *
 * This is how iOS Live Text works:
 * 1. Render image/PDF as-is
 * 2. Get text positions from rendering engine
 * 3. Get text content from OCR
 * 4. User selection uses rendering positions, copy uses OCR text
 */

import React, { useEffect, useState, useRef } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import * as pdfjsLib from 'pdfjs-dist';

// Enable PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface TextItem {
  str: string;
  transform: number[];  // [scaleX, skewX, skewY, scaleY, x, y]
  width: number;
  height: number;
}

interface PdfHybridTextLayerProps {
  documentId: string;
  fileUrl: string;
  pageNumber: number;
  scale: number;
  containerWidth: number;
  containerHeight: number;
  enabled?: boolean;
  onOcrStatusChange?: (hasOcr: boolean) => void;
  debug?: boolean;
}

export const PdfHybridTextLayer: React.FC<PdfHybridTextLayerProps> = ({
  documentId,
  fileUrl,
  pageNumber,
  scale,
  containerWidth,
  containerHeight,
  enabled = true,
  onOcrStatusChange,
  debug = false,
}) => {
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [pdfTextItems, setPdfTextItems] = useState<TextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch OCR text content for this page
  useEffect(() => {
    if (!documentId || !enabled) {
      setLoading(false);
      return;
    }

    const fetchOcrText = async () => {
      try {
        const response = await fetchWithAuth(`/api/documents/${documentId}/ocr-geometry`);
        if (!response.ok) {
          onOcrStatusChange?.(false);
          return;
        }

        const data = await response.json();
        if (data.success && data.hasOcrGeometry) {
          // Get text for this page
          const pageData = data.ocrGeometry.pages?.find((p: { pageNumber: number }) => p.pageNumber === pageNumber);
          if (pageData?.words?.length) {
            // Join words into text for this page
            const pageText = pageData.words.map((w: { text: string }) => w.text).join(' ');
            setOcrText(pageText);
            onOcrStatusChange?.(true);
          } else {
            onOcrStatusChange?.(false);
          }
        } else {
          onOcrStatusChange?.(false);
        }
      } catch (err) {
        console.error('[PdfHybridTextLayer] Error fetching OCR text:', err);
        onOcrStatusChange?.(false);
      }
    };

    fetchOcrText();
  }, [documentId, pageNumber, enabled, onOcrStatusChange]);

  // Get PDF.js text positions
  useEffect(() => {
    if (!fileUrl || !enabled) {
      setLoading(false);
      return;
    }

    const loadPdfTextPositions = async () => {
      setLoading(true);
      try {
        // Fetch the PDF and get text content with positions
        const token = localStorage.getItem('accessToken');
        const response = await fetch(fileUrl, {
          credentials: 'include',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch PDF');
        }

        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(pageNumber);

        // Get viewport at scale 1.0 first
        const viewport = page.getViewport({ scale: 1.0 });
        setPageViewport({ width: viewport.width, height: viewport.height });

        // Get text content with positions
        const textContent = await page.getTextContent();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: TextItem[] = textContent.items
          .filter((item: any) => 'str' in item && item.str)
          .map((item: any) => ({
            str: item.str,
            transform: item.transform,
            width: item.width,
            height: item.height,
          }));

        setPdfTextItems(items);
        console.log('[PdfHybridTextLayer] Loaded', items.length, 'text items from PDF.js');

      } catch (err) {
        console.error('[PdfHybridTextLayer] Error loading PDF text:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPdfTextPositions();
  }, [fileUrl, pageNumber, enabled]);

  // If no OCR text or still loading, don't render
  if (!enabled || loading || !ocrText || !pdfTextItems.length || !pageViewport) {
    return null;
  }

  // Calculate scale factor from viewport to container
  const scaleX = containerWidth / pageViewport.width;
  const scaleY = containerHeight / pageViewport.height;

  // Render text items at PDF.js positions but with OCR text
  // This is the key insight: PDF.js positions are accurate, OCR text is readable
  const renderTextItems = () => {
    // For now, just use PDF.js positions and let native selection work
    // The text might still be garbled but positions are accurate
    // TODO: Advanced matching of OCR words to PDF.js positions

    return pdfTextItems.map((item, index) => {
      // PDF transform: [scaleX, skewX, skewY, scaleY, x, y]
      // x, y are in PDF coordinate space (origin at bottom-left)
      const [, , , , x, y] = item.transform;

      // Convert PDF coordinates to screen coordinates
      // PDF origin is bottom-left, screen origin is top-left
      const screenX = x * scaleX;
      const screenY = containerHeight - (y * scaleY); // Flip Y axis

      // Scale the width and height
      const width = item.width * scaleX;
      const height = Math.abs(item.transform[0]) * scaleY; // Font size is in transform[0]

      // Adjust Y to account for text baseline
      const adjustedY = screenY - height;

      if (debug) {
        console.log(`[PdfHybridTextLayer] Item ${index}: "${item.str}" at (${screenX.toFixed(1)}, ${adjustedY.toFixed(1)})`);
      }

      return (
        <span
          key={`text-${pageNumber}-${index}`}
          style={{
            position: 'absolute',
            left: `${screenX}px`,
            top: `${adjustedY}px`,
            width: `${Math.max(width, 10)}px`,
            height: `${Math.max(height, 10)}px`,
            fontSize: `${Math.max(height * 0.9, 8)}px`,
            lineHeight: `${Math.max(height, 10)}px`,
            fontFamily: 'sans-serif',
            color: debug ? 'red' : 'transparent',
            background: debug ? 'rgba(255, 255, 0, 0.3)' : 'transparent',
            border: debug ? '1px solid blue' : 'none',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            cursor: 'text',
            whiteSpace: 'pre',
            overflow: 'hidden',
          }}
        >
          {item.str}
        </span>
      );
    });
  };

  return (
    <div
      className="pdf-hybrid-text-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        pointerEvents: 'auto',
        zIndex: 10,
        border: debug ? '2px solid green' : 'none',
      }}
    >
      {renderTextItems()}

      <style jsx>{`
        .pdf-hybrid-text-layer span::selection {
          background: rgba(0, 100, 255, 0.3);
          color: transparent;
        }
        .pdf-hybrid-text-layer span::-moz-selection {
          background: rgba(0, 100, 255, 0.3);
          color: transparent;
        }
      `}</style>
    </div>
  );
};

export default PdfHybridTextLayer;
