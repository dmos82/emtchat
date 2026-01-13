'use client';

/**
 * PdfSelectionOverlay - Custom text selection for OCR'd PDFs
 *
 * This component enables text selection in garbled PDFs (like ICBC docs with Type 3 fonts)
 * by overlaying invisible text spans positioned using OCR bounding boxes.
 *
 * How it works:
 * 1. Fetches OCR geometry (word bounding boxes) from backend
 * 2. Renders invisible text spans at the exact positions
 * 3. Browser's native text selection works on these spans
 * 4. User can select and copy text like normal
 *
 * This is the same approach used by iOS Live Text and Google Lens.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

// Types matching stored OcrGeometry (transformed in documentProcessor.ts)
interface OcrWord {
  text: string;
  x: number;      // 0-1 relative position from left
  y: number;      // 0-1 relative position from top
  width: number;  // 0-1 relative width
  height: number; // 0-1 relative height
  confidence: number;
}

interface OcrPage {
  pageNumber: number;
  width: number;   // Page width in points
  height: number;  // Page height in points
  words: OcrWord[];
}

interface OcrGeometry {
  pages: OcrPage[];
  extractedAt: string;
  provider: 'textract' | 'tesseract' | 'vision';
}

interface PdfSelectionOverlayProps {
  documentId: string;
  pageNumber: number;
  scale: number;
  containerWidth: number;
  containerHeight: number;
  enabled?: boolean;
  onOcrStatusChange?: (hasOcr: boolean) => void;
  debug?: boolean; // Show visible boxes to diagnose alignment
  // Calibration offsets to fix coordinate misalignment
  xOffset?: number;  // Horizontal offset in pixels
  yOffset?: number;  // Vertical offset in pixels
  xScale?: number;   // Horizontal scale adjustment (1.0 = no change)
  yScale?: number;   // Vertical scale adjustment (1.0 = no change)
}

export const PdfSelectionOverlay: React.FC<PdfSelectionOverlayProps> = ({
  documentId,
  pageNumber,
  scale,
  containerWidth,
  containerHeight,
  enabled = true,
  onOcrStatusChange,
  debug = false, // Set to true to see visible boxes
  xOffset = 0,
  yOffset = 0,
  xScale = 1.0,
  yScale = 1.0,
}) => {
  const [ocrGeometry, setOcrGeometry] = useState<OcrGeometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fetch OCR geometry when document changes
  useEffect(() => {
    console.log('[PdfSelectionOverlay] useEffect triggered', { documentId, enabled });

    if (!documentId || !enabled) {
      console.log('[PdfSelectionOverlay] Skipping fetch - documentId:', documentId, 'enabled:', enabled);
      setLoading(false);
      return;
    }

    const fetchOcrGeometry = async () => {
      console.log('[PdfSelectionOverlay] Fetching OCR geometry for:', documentId);
      setLoading(true);
      setError(null);

      try {
        const response = await fetchWithAuth(`/api/documents/${documentId}/ocr-geometry`);

        if (!response.ok) {
          throw new Error('Failed to fetch OCR geometry');
        }

        const data = await response.json();
        console.log('[PdfSelectionOverlay] Response:', { success: data.success, hasOcrGeometry: data.hasOcrGeometry });

        if (data.success && data.hasOcrGeometry) {
          console.log('[PdfSelectionOverlay] OCR geometry loaded:', {
            pages: data.ocrGeometry.pages?.length,
            firstPageWords: data.ocrGeometry.pages?.[0]?.words?.length,
            sampleWord: data.ocrGeometry.pages?.[0]?.words?.[0],
          });
          setOcrGeometry(data.ocrGeometry);
          onOcrStatusChange?.(true);
        } else {
          // No OCR geometry - native text selection should work
          setOcrGeometry(null);
          onOcrStatusChange?.(false);
        }
      } catch (err) {
        console.error('[PdfSelectionOverlay] Error fetching OCR geometry:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        onOcrStatusChange?.(false);
      } finally {
        setLoading(false);
      }
    };

    fetchOcrGeometry();
  }, [documentId, enabled, onOcrStatusChange]);

  // Get current page data
  const currentPageData = ocrGeometry?.pages.find(p => p.pageNumber === pageNumber);

  // If no OCR geometry or loading, don't render overlay
  if (!enabled || loading || !ocrGeometry || !currentPageData) {
    return null;
  }

  // Calculate scaled positions for words
  const renderWords = () => {
    if (!currentPageData.words.length) return null;

    // Debug: log container dimensions once
    if (currentPageData.words.length > 0) {
      const firstWord = currentPageData.words[0];
      console.log('[PdfSelectionOverlay] Rendering with:', {
        containerWidth,
        containerHeight,
        pageDataDimensions: { width: currentPageData.width, height: currentPageData.height },
        firstWord: { text: firstWord.text, x: firstWord.x, y: firstWord.y, width: firstWord.width, height: firstWord.height },
        totalWords: currentPageData.words.length,
      });
    }

    // Filter words that have valid position data
    const validWords = currentPageData.words.filter(word =>
      word.x !== undefined && word.y !== undefined && word.width !== undefined && word.height !== undefined
    );

    return validWords.map((word, index) => {
      // Convert relative positions (0-1) to actual pixels
      // Coordinates use top-left origin
      // Apply calibration offsets and scale adjustments
      const left = (word.x * containerWidth * xScale) + xOffset;
      const top = (word.y * containerHeight * yScale) + yOffset;
      const width = word.width * containerWidth * xScale;
      const height = word.height * containerHeight * yScale;

      // Calculate font size based on word height
      // Use a slightly smaller size to ensure text fits
      const fontSize = Math.max(8, height * 0.85);

      // Expand height slightly for smoother line-based selection
      // This creates overlapping zones so selection feels more natural
      const expandedHeight = height * 1.5;
      const adjustedTop = top - (height * 0.25); // Center the expanded box

      return (
        <span
          key={`word-${pageNumber}-${index}`}
          className="ocr-word"
          style={{
            position: 'absolute',
            left: `${left}px`,
            top: `${adjustedTop}px`,
            width: `${width}px`,
            height: `${expandedHeight}px`,
            fontSize: `${fontSize}px`,
            lineHeight: `${expandedHeight}px`,
            fontFamily: 'sans-serif',
            // Debug mode: show visible text and boxes
            color: debug ? 'red' : 'transparent',
            // Allow text selection
            userSelect: 'text',
            WebkitUserSelect: 'text',
            cursor: 'text',
            // Debug mode: show background
            background: debug ? 'rgba(255, 255, 0, 0.3)' : 'transparent',
            border: debug ? '1px solid red' : 'none',
            // Ensure text is rendered for selection
            whiteSpace: 'pre',
            overflow: 'hidden',
          }}
          data-confidence={word.confidence}
          title={debug ? `${word.text} (${word.x.toFixed(3)}, ${word.y.toFixed(3)})` : undefined}
        >
          {word.text}{' '}
        </span>
      );
    });
  };

  return (
    <div
      ref={overlayRef}
      className="pdf-selection-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        // Overlay sits on top but allows text selection through
        pointerEvents: 'auto',
        zIndex: 10,
        // Debug: uncomment to see overlay bounds
        // border: '2px solid red',
      }}
    >
      {renderWords()}

      {/* CSS for selection highlighting */}
      <style jsx>{`
        .ocr-word::selection {
          background: rgba(0, 100, 255, 0.3);
          color: transparent;
        }
        .ocr-word::-moz-selection {
          background: rgba(0, 100, 255, 0.3);
          color: transparent;
        }
      `}</style>
    </div>
  );
};

// Hook for components that need to know if OCR selection is available
export const useOcrSelectionStatus = (documentId: string | undefined) => {
  const [hasOcrGeometry, setHasOcrGeometry] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!documentId) {
      setHasOcrGeometry(null);
      setLoading(false);
      return;
    }

    const checkOcrStatus = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/documents/${documentId}/ocr-geometry`);
        if (response.ok) {
          const data = await response.json();
          setHasOcrGeometry(data.hasOcrGeometry || false);
        } else {
          setHasOcrGeometry(false);
        }
      } catch {
        setHasOcrGeometry(false);
      } finally {
        setLoading(false);
      }
    };

    checkOcrStatus();
  }, [documentId]);

  return { hasOcrGeometry, loading };
};

export default PdfSelectionOverlay;
