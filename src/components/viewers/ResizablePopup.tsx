'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResizablePopupProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
}

export function ResizablePopup({
  children,
  isOpen,
  onClose,
  title,
  initialWidth = 900,
  initialHeight = 700,
  minWidth = 400,
  minHeight = 300,
  maxWidth,
  maxHeight,
  className,
}: ResizablePopupProps) {
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });
  const startPosition = useRef({ x: 0, y: 0 });

  // Initialize position to center on mount and detect mobile
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // On mobile, use full screen
      if (mobile) {
        setSize({ width: window.innerWidth, height: window.innerHeight });
        setPosition({ x: 0, y: 0 });
      } else {
        const effectiveMaxWidth = maxWidth || window.innerWidth - 40;
        const effectiveMaxHeight = maxHeight || window.innerHeight - 40;
        const width = Math.min(initialWidth, effectiveMaxWidth);
        const height = Math.min(initialHeight, effectiveMaxHeight);
        setSize({ width, height });
        setPosition({
          x: (window.innerWidth - width) / 2,
          y: (window.innerHeight - height) / 2,
        });
      }
    }
    return () => setMounted(false);
  }, [initialWidth, initialHeight, maxWidth, maxHeight]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...size };
    startPosition.current = { ...position };
  }, [size, position]);

  // Handle drag (move window)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    e.preventDefault();
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startPosition.current = { ...position };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeDirection) {
        const deltaX = e.clientX - startPos.current.x;
        const deltaY = e.clientY - startPos.current.y;

        let newWidth = startSize.current.width;
        let newHeight = startSize.current.height;
        let newX = startPosition.current.x;
        let newY = startPosition.current.y;

        const effectiveMaxWidth = maxWidth || window.innerWidth - 40;
        const effectiveMaxHeight = maxHeight || window.innerHeight - 40;

        // Handle resize based on direction
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(minWidth, Math.min(startSize.current.width + deltaX, effectiveMaxWidth));
        }
        if (resizeDirection.includes('w')) {
          const widthDelta = Math.min(deltaX, startSize.current.width - minWidth);
          newWidth = Math.max(minWidth, startSize.current.width - widthDelta);
          newX = startPosition.current.x + (startSize.current.width - newWidth);
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(minHeight, Math.min(startSize.current.height + deltaY, effectiveMaxHeight));
        }
        if (resizeDirection.includes('n')) {
          const heightDelta = Math.min(deltaY, startSize.current.height - minHeight);
          newHeight = Math.max(minHeight, startSize.current.height - heightDelta);
          newY = startPosition.current.y + (startSize.current.height - newHeight);
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }

      if (isDragging) {
        const deltaX = e.clientX - startPos.current.x;
        const deltaY = e.clientY - startPos.current.y;

        // Keep window within viewport bounds
        const newX = Math.max(0, Math.min(startPosition.current.x + deltaX, window.innerWidth - size.width));
        const newY = Math.max(0, Math.min(startPosition.current.y + deltaY, window.innerHeight - 50));

        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsDragging(false);
      setResizeDirection(null);
    };

    if (isResizing || isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isResizing ? `${resizeDirection}-resize` : 'move';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, isDragging, resizeDirection, size.width, minWidth, minHeight, maxWidth, maxHeight]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen || !mounted) return null;

  const popupContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Popup Window */}
      <div
        ref={popupRef}
        className={cn(
          "absolute bg-gray-900 shadow-2xl overflow-hidden flex flex-col",
          isMobile ? "inset-0" : "rounded-lg border border-gray-700",
          className
        )}
        style={isMobile ? undefined : {
          width: size.width,
          height: size.height,
          left: position.x,
          top: position.y,
        }}
      >
        {/* Title Bar - Draggable on desktop, static on mobile */}
        {title && (
          <div
            className={cn(
              "flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700 select-none flex-shrink-0",
              isMobile ? "py-3" : "py-2 cursor-move"
            )}
            onMouseDown={isMobile ? undefined : handleDragStart}
          >
            <span className={cn(
              "font-medium text-gray-200 truncate",
              isMobile ? "text-base" : "text-sm"
            )}>{title}</span>
            <button
              onClick={onClose}
              className={cn(
                "rounded transition-colors",
                isMobile
                  ? "px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium flex items-center gap-1.5"
                  : "p-1 hover:bg-gray-700 text-gray-400 hover:text-white"
              )}
              aria-label="Close viewer"
            >
              <X className="w-4 h-4" />
              {isMobile && <span>Close</span>}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* Resize Handles - Hidden on mobile */}
        {!isMobile && (
          <>
            {/* Corners */}
            <div
              className="resize-handle absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
            <div
              className="resize-handle absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div
              className="resize-handle absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div
              className="resize-handle absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            />

            {/* Edges */}
            <div
              className="resize-handle absolute top-0 left-3 right-3 h-1 cursor-n-resize"
              onMouseDown={(e) => handleResizeStart(e, 'n')}
            />
            <div
              className="resize-handle absolute bottom-0 left-3 right-3 h-1 cursor-s-resize"
              onMouseDown={(e) => handleResizeStart(e, 's')}
            />
            <div
              className="resize-handle absolute left-0 top-3 bottom-3 w-1 cursor-w-resize"
              onMouseDown={(e) => handleResizeStart(e, 'w')}
            />
            <div
              className="resize-handle absolute right-0 top-3 bottom-3 w-1 cursor-e-resize"
              onMouseDown={(e) => handleResizeStart(e, 'e')}
            />
          </>
        )}
      </div>
    </div>
  );

  return createPortal(popupContent, document.body);
}

export default ResizablePopup;
