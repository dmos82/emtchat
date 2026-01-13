'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize,
  Move,
  ImageIcon,
  Loader2,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useToast } from '@/components/ui/use-toast';

interface ImageViewerProps {
  url: string;
  fileName: string;
  documentId?: string;
  documentType?: 'user' | 'system';
  onClose: () => void;
  embedded?: boolean;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export function ImageViewer({ url, fileName, documentId, documentType = 'user', onClose, embedded = false }: ImageViewerProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  // Zoom in
  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  // Zoom out
  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  // Rotate 90 degrees
  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Reset to fit
  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Download - use blob URL instead of direct URL for auth
  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [blobUrl, fileName]);

  // Save to My Docs - upload the image to user's document storage
  const handleSaveToMyDocs = useCallback(async () => {
    if (!imageBlob || isSaving) return;

    setIsSaving(true);
    try {
      const contentType = imageBlob.type || 'image/png';

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
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: imageBlob,
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
      console.error('[ImageViewer] Save to My Docs error:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save document',
      });
    } finally {
      setIsSaving(false);
    }
  }, [imageBlob, fileName, isSaving, toast]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return; // Only allow panning when zoomed in
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [zoom, position]
  );

  // Handle drag move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case 'r':
          e.preventDefault();
          rotate();
          break;
        case '0':
          e.preventDefault();
          resetView();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, rotate, resetView, onClose]);

  // Fetch image with authentication and create blob URL
  useEffect(() => {
    const fetchImage = async () => {
      try {
        setIsLoading(true);
        setError(false);

        const token = localStorage.getItem('accessToken');
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.statusText}`);
        }

        const blob = await response.blob();
        setImageBlob(blob);  // Store blob for Save to My Docs
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (err) {
        console.error('Error fetching image:', err);
        setError(true);
        setIsLoading(false);
      }
    };

    fetchImage();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [url]);

  // Handle image load
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    const img = e.target as HTMLImageElement;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  // Handle image error
  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setError(true);
  }, []);

  // Calculate cursor style
  const cursorStyle = zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default';

  // Get file extension for badge
  const extension = fileName.split('.').pop()?.toUpperCase() || 'IMG';

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
              <ImageIcon className="h-5 w-5 text-amber-500" />
            )}
          </div>

          {/* Document Title */}
          <span className="text-sm font-medium truncate max-w-[200px] md:max-w-md" title={fileName}>
            {fileName}
          </span>

          {/* Image badge */}
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
            {extension}
          </span>

          {/* Image dimensions */}
          {naturalSize.width > 0 && (
            <span className="text-xs text-gray-500 hidden sm:inline">
              {naturalSize.width} × {naturalSize.height} px
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom out (-)"
          >
            <ZoomOut className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Out</span>
          </button>

          <span className="text-xs text-gray-500 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom in (+)"
          >
            <ZoomIn className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">In</span>
          </button>

          {/* Rotate */}
          <button
            onClick={rotate}
            className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center"
            title="Rotate (R)"
          >
            <RotateCw className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Rotate</span>
          </button>

          {/* Reset */}
          <button
            onClick={resetView}
            className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs flex items-center"
            title="Reset view (0)"
          >
            <Maximize className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Save to My Docs - only show for system docs */}
          {documentType === 'system' && (
            <button
              onClick={handleSaveToMyDocs}
              disabled={isLoading || error || isSaving}
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
            disabled={isLoading || error}
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

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center bg-gray-100"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: cursorStyle }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="mt-4 text-gray-500 text-sm">Loading image...</p>
          </div>
        )}

        {error ? (
          <div className="text-center p-4">
            <div className="bg-red-50 text-red-600 p-4 rounded-lg max-w-md">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <p className="font-medium">Failed to load image</p>
              <button
                onClick={handleDownload}
                className="mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
              >
                Download Instead
              </button>
            </div>
          </div>
        ) : (
          blobUrl && (
            <div className="p-4">
              <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                <img
                  ref={imageRef}
                  src={blobUrl}
                  alt={fileName}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  className="max-w-full max-h-full select-none transition-transform duration-100"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    opacity: isLoading ? 0 : 1,
                  }}
                  draggable={false}
                />
              </div>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
        <span>Image Viewer</span>
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1">
            <Move className="w-3 h-3" />
            Drag when zoomed
          </span>
          <span>Scroll to zoom</span>
          <span>R to rotate</span>
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

export default ImageViewer;
