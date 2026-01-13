'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2, RefreshCw, Sparkles, Maximize2, Download, FileText, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Diagram skeleton loader for enterprise-quality loading state
const DiagramSkeletonLoader: React.FC = () => (
  <div className="h-full w-full p-6 flex items-center justify-center">
    <div className="w-full max-w-2xl">
      {/* Flowchart skeleton */}
      <div className="flex flex-col items-center gap-4">
        {/* Top node */}
        <div
          className="h-12 w-40 rounded-lg bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
          style={{ animationDelay: '0s' }}
        />
        {/* Arrow */}
        <div className="h-8 w-0.5 bg-gradient-to-b from-muted via-muted-foreground/20 to-muted animate-shimmer" />
        {/* Decision node */}
        <div
          className="h-16 w-32 rotate-45 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
          style={{ animationDelay: '0.1s' }}
        />
        {/* Branch arrows */}
        <div className="flex items-start justify-center gap-24 w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-0.5 bg-gradient-to-b from-muted via-muted-foreground/20 to-muted animate-shimmer" />
            <div
              className="h-12 w-32 rounded-lg bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
              style={{ animationDelay: '0.2s' }}
            />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-0.5 bg-gradient-to-b from-muted via-muted-foreground/20 to-muted animate-shimmer" />
            <div
              className="h-12 w-32 rounded-lg bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
        </div>
        {/* Merge arrows */}
        <div className="flex items-start justify-center gap-24 w-full">
          <div className="h-8 w-0.5 bg-gradient-to-b from-muted via-muted-foreground/20 to-muted animate-shimmer" />
          <div className="h-8 w-0.5 bg-gradient-to-b from-muted via-muted-foreground/20 to-muted animate-shimmer" />
        </div>
        {/* Final node */}
        <div
          className="h-12 w-40 rounded-full bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
          style={{ animationDelay: '0.4s' }}
        />
      </div>
    </div>
  </div>
);

interface DiagramCanvasProps {
  content: string;
  isStreaming: boolean;
  title?: string;
}

export const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  content,
  isStreaming,
  title = 'Diagram',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const lastRenderedContent = useRef<string>('');

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });

  // Dark mode detection - checks class on html/body, data attributes, and system preference
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const checkDarkMode = () => {
      const htmlEl = document.documentElement;
      const bodyEl = document.body;

      // Check for explicit dark class on html or body
      const hasDarkClass = htmlEl.classList.contains('dark') || bodyEl.classList.contains('dark');
      // Check for explicit light class (takes precedence)
      const hasLightClass = htmlEl.classList.contains('light') || bodyEl.classList.contains('light');
      // Check data-theme attribute
      const dataTheme = htmlEl.getAttribute('data-theme') || bodyEl.getAttribute('data-theme');
      // Check color-scheme style
      const colorScheme = getComputedStyle(htmlEl).colorScheme;

      // Priority: explicit class > data-theme > color-scheme > system preference
      if (hasLightClass) {
        setIsDarkMode(false);
      } else if (hasDarkClass) {
        setIsDarkMode(true);
      } else if (dataTheme) {
        setIsDarkMode(dataTheme === 'dark');
      } else if (colorScheme && colorScheme !== 'normal') {
        setIsDarkMode(colorScheme === 'dark');
      } else {
        // Fall back to system preference only if no explicit theme set
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };

    checkDarkMode();

    // Listen for class/attribute changes on html and body
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

  const MIN_SCALE = 0.25;
  const MAX_SCALE = 4;
  const ZOOM_STEP = 0.1;  // Smoother zoom

  // Open diagram in full screen browser tab
  const handleOpenFullScreen = useCallback(() => {
    if (!svgContent) return;

    // EMTChat branded fullscreen template
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - EMTChat</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      background: #fbf9f6;  /* EMTChat cream */
      padding: 2rem;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .gold-bar {
      width: 4px;
      height: 28px;
      background: #f8ab1d;  /* EMTChat gold */
      border-radius: 2px;
    }
    h1 {
      color: #5c2f00;  /* Dark brown */
      font-size: 1.5rem;
      font-weight: 600;
    }
    .subtitle {
      color: #564d46;  /* Warm gray */
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .diagram-container {
      background: #fbf9f6;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 6px -1px rgba(92, 47, 0, 0.1), 0 2px 4px -1px rgba(92, 47, 0, 0.06);
      max-width: 95vw;
      overflow: auto;
      border: 2px solid #c7940a;  /* Gold border */
    }
    .diagram-container svg {
      max-width: 100%;
      height: auto;
    }
    .actions {
      margin-top: 1.5rem;
      display: flex;
      gap: 1rem;
    }
    button {
      background: #f8ab1d;  /* EMTChat gold */
      color: #5c2f00;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    button:hover {
      background: #d4a017;
      transform: translateY(-1px);
    }
    .footer {
      margin-top: 2rem;
      color: #564d46;
      font-size: 0.75rem;
    }
    @media print {
      body { background: white; padding: 1rem; }
      .diagram-container { box-shadow: none; border: 1px solid #c7940a; }
      .actions, .footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="gold-bar"></div>
    <h1>${title}</h1>
  </div>
  <p class="subtitle">Generated on ${new Date().toLocaleDateString()}</p>
  <div class="diagram-container">
    ${svgContent}
  </div>
  <div class="actions">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <p class="footer">EMTChat</p>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [svgContent, title]);

  // Download as SVG file
  const handleDownloadSvg = useCallback(() => {
    if (!svgContent) return;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svgContent, title]);

  // Download as PDF file
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const handleDownloadPdf = useCallback(async () => {
    if (!svgContent || isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    try {
      // Dynamically import jsPDF and svg2pdf.js to avoid SSR issues
      const { jsPDF } = await import('jspdf');
      await import('svg2pdf.js');

      // Parse the SVG to get dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (!svgElement) {
        throw new Error('Could not parse SVG');
      }

      // Get SVG dimensions (with fallbacks)
      let svgWidth = parseFloat(svgElement.getAttribute('width') || '800');
      let svgHeight = parseFloat(svgElement.getAttribute('height') || '600');

      // If dimensions are in other units or viewBox, try viewBox
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        if (vbWidth && vbHeight) {
          svgWidth = vbWidth;
          svgHeight = vbHeight;
        }
      }

      // Calculate PDF dimensions with padding
      const padding = 40;
      const titleHeight = 60;
      const pdfWidth = svgWidth + (padding * 2);
      const pdfHeight = svgHeight + (padding * 2) + titleHeight;

      // Create PDF in landscape or portrait based on aspect ratio
      const orientation = pdfWidth > pdfHeight ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [pdfWidth, pdfHeight],
        hotfixes: ['px_scaling'],
      });

      // Add EMTChat branded title
      pdf.setFontSize(24);
      pdf.setTextColor(92, 47, 0); // EMTChat dark brown #5c2f00
      pdf.text(title, padding, padding + 20);

      // Add subtitle with date
      pdf.setFontSize(12);
      pdf.setTextColor(86, 77, 70); // EMTChat warm gray #564d46
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, padding, padding + 40);

      // Create a temporary container with the SVG
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = svgContent;
      const tempSvg = tempContainer.querySelector('svg');

      if (tempSvg) {
        // Ensure SVG has explicit dimensions for svg2pdf
        tempSvg.setAttribute('width', String(svgWidth));
        tempSvg.setAttribute('height', String(svgHeight));

        // Add SVG to PDF
        await pdf.svg(tempSvg, {
          x: padding,
          y: padding + titleHeight,
          width: svgWidth,
          height: svgHeight,
        });
      }

      // Save the PDF
      const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback: open full screen and let user print to PDF
      handleOpenFullScreen();
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [svgContent, title, isGeneratingPdf, handleOpenFullScreen]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + ZOOM_STEP, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - ZOOM_STEP, MIN_SCALE));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Auto-fit diagram to container viewport
  // ENTERPRISE: Prioritize readability over fitting entire diagram
  const fitToView = useCallback(() => {
    if (!containerRef.current || !svgContent) return;

    // Get container dimensions
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Get SVG dimensions from the rendered content
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    // Get the actual SVG dimensions (including viewBox if present)
    let svgWidth = svgElement.clientWidth || svgElement.getBoundingClientRect().width;
    let svgHeight = svgElement.clientHeight || svgElement.getBoundingClientRect().height;

    // If SVG has viewBox, use those dimensions as they're more accurate
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
      if (vbWidth && vbHeight) {
        svgWidth = vbWidth;
        svgHeight = vbHeight;
      }
    }

    // Add padding (40px on each side for comfortable viewing)
    const padding = 40;
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    // Calculate scale to fit both dimensions
    const scaleX = availableWidth / svgWidth;
    const scaleY = availableHeight / svgHeight;

    // ENTERPRISE READABILITY: Minimum 50% zoom for readable text
    // Better to show partial diagram that's readable than entire diagram that's unreadable
    // Users can scroll/pan to see the rest, but text must always be legible
    const READABLE_MIN_SCALE = 0.5;

    // Use the smaller scale to fit, but enforce readability minimum
    const optimalScale = Math.min(scaleX, scaleY, 1.0);

    // Clamp to readable range - don't go below 50% even if diagram doesn't fit
    const clampedScale = Math.max(READABLE_MIN_SCALE, Math.min(MAX_SCALE, optimalScale));

    setScale(clampedScale);
    setPosition({ x: 0, y: 0 }); // Center the diagram
  }, [svgContent]);

  // Mouse wheel zoom (with Ctrl/Cmd key)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Only zoom when Ctrl/Cmd is held
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setScale(prev => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE));
    }
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan with left mouse button
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    positionStart.current = { ...position };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({
      x: positionStart.current.x + dx,
      y: positionStart.current.y + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Auto-fit diagram when content changes
  useEffect(() => {
    if (svgContent) {
      // Small delay to ensure SVG is rendered in DOM before measuring
      const timer = setTimeout(() => {
        fitToView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [svgContent, fitToView]);

  const renderDiagram = useCallback(async (mermaidContent: string) => {
    if (!mermaidContent.trim() || isStreaming) return;

    // Don't re-render if content hasn't changed
    if (mermaidContent === lastRenderedContent.current) return;

    setIsRendering(true);
    setError(null);

    try {
      // Sanitize Mermaid content - fix common issues that cause parse errors
      let sanitizedContent = mermaidContent
        // CRITICAL: Remove HTML-like wrapper tags that AI sometimes adds
        // These cause parse errors like "Expecting 'SEMI', 'NEWLINE'..."
        .replace(/<\/?(?:graph|mermaid|diagram|flowchart|code)>/gi, '')
        // Replace curly quotes with straight quotes, then escape them
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'");

      // ENTERPRISE LAYOUT: Convert vertical (TB/TD) flowcharts to horizontal (LR)
      // This creates wider diagrams that fit better in canvas without extreme zoom-out
      // TB = Top-Bottom, TD = Top-Down, LR = Left-Right
      sanitizedContent = sanitizedContent
        .replace(/^(flowchart|graph)\s+(TB|TD)\s*$/gm, '$1 LR')
        .replace(/^(flowchart|graph)\s+(TB|TD)\s*\n/gm, '$1 LR\n');

      // Note: Title is added to the SVG output after rendering (see below)
      // Mermaid frontmatter is unreliable across versions

      // Collect subgraph names to handle references to them
      const subgraphNames: string[] = [];
      sanitizedContent.replace(/subgraph\s+([^\n\[]+)/g, (match, name) => {
        const trimmedName = name.trim();
        if (trimmedName && !trimmedName.startsWith('[')) {
          subgraphNames.push(trimmedName);
        }
        return match;
      });

      // Fix multi-word arrow targets that aren't wrapped in brackets
      // Pattern: --> or ---> followed by words without brackets
      // This handles cases like "J --> Documentation and Communication"
      // IMPORTANT: Require preceding context (], ), }, or alphanumeric) to avoid matching
      // the --- frontmatter delimiter as an arrow
      let nodeCounter = 0;
      sanitizedContent = sanitizedContent.replace(
        /([\]})A-Za-z0-9])\s*(-->|---)(\s*)([A-Za-z][A-Za-z0-9\s]+?)(\s*)($|\n|-->|---|;)/g,
        (match, preceding, arrow, space1, target, space2, ending) => {
          const trimmedTarget = target.trim();
          // Skip if it's a single word (valid node ID) or already has brackets
          if (!trimmedTarget.includes(' ') || trimmedTarget.includes('[') || trimmedTarget.includes('{')) {
            return match;
          }
          // Skip if it's a subgraph name - create a reference node instead
          if (subgraphNames.includes(trimmedTarget)) {
            const nodeId = `subref_${nodeCounter++}`;
            return `${preceding} ${arrow}${space1}${nodeId}[${trimmedTarget}]${space2}${ending}`;
          }
          // For other multi-word targets, wrap with auto-generated ID
          const nodeId = `node_${nodeCounter++}`;
          return `${preceding} ${arrow}${space1}${nodeId}[${trimmedTarget}]${space2}${ending}`;
        }
      );

      // Escape special characters inside node labels [...]
      // Parentheses () are interpreted as stadium/rounded shapes by Mermaid
      // This causes parse errors like "Expecting 'SQE', 'DOUBLECIRCLEEND'..."
      sanitizedContent = sanitizedContent.replace(/\[([^\]]*)\]/g, (match, content) => {
        const escaped = content
          .replace(/"/g, '#quot;')
          .replace(/'/g, '#apos;')
          // Replace parentheses with alternatives to avoid shape conflicts
          .replace(/\(/g, ' - ')
          .replace(/\)/g, '')
          // Also handle colons that can cause issues
          .replace(/:/g, ' -');
        return `[${escaped}]`;
      });

      // Also handle content inside braces {...} for decision nodes
      sanitizedContent = sanitizedContent.replace(/\{([^}]*)\}/g, (match, content) => {
        const escaped = content
          .replace(/"/g, '#quot;')
          .replace(/'/g, '#apos;')
          .replace(/\(/g, ' - ')
          .replace(/\)/g, '')
          .replace(/:/g, ' -');
        return `{${escaped}}`;
      });

      // Handle edge labels |...| which can also have special characters
      sanitizedContent = sanitizedContent.replace(/\|([^|]*)\|/g, (match, content) => {
        const escaped = content
          .replace(/"/g, '')
          .replace(/'/g, '')
          .replace(/\(/g, ' - ')
          .replace(/\)/g, '')
          .replace(/:/g, ' -');
        return `|${escaped}|`;
      });

      // Handle stadium-shape nodes (...) - these can have nested parentheses that break parsing
      // Pattern: NodeID(content) where content might have () or : characters
      // Must be careful not to match subgraph or other keywords
      sanitizedContent = sanitizedContent.replace(/([A-Za-z_][A-Za-z0-9_]*)\(([^)]+)\)/g, (match, nodeId, content) => {
        // Skip mermaid keywords
        const keywords = ['subgraph', 'end', 'direction', 'click', 'style', 'linkStyle', 'classDef', 'class'];
        if (keywords.includes(nodeId.toLowerCase())) {
          return match;
        }
        // Check if content has problematic characters - if so, convert to bracket style
        if (content.includes('(') || content.includes(')') || content.includes(':')) {
          const escaped = content
            .replace(/"/g, '#quot;')
            .replace(/'/g, '#apos;')
            .replace(/\(/g, ' - ')
            .replace(/\)/g, '')
            .replace(/:/g, ' -');
          // Convert stadium to bracket style to avoid nested parenthesis issues
          return `${nodeId}[${escaped}]`;
        }
        return match;
      });

      // Handle double-parenthesis circle nodes ((...))
      sanitizedContent = sanitizedContent.replace(/([A-Za-z_][A-Za-z0-9_]*)\(\(([^)]+)\)\)/g, (match, nodeId, content) => {
        if (content.includes('(') || content.includes(')') || content.includes(':')) {
          const escaped = content
            .replace(/"/g, '#quot;')
            .replace(/'/g, '#apos;')
            .replace(/\(/g, ' - ')
            .replace(/\)/g, '')
            .replace(/:/g, ' -');
          return `${nodeId}((${escaped}))`;
        }
        return match;
      });

      // Dynamically import mermaid to avoid SSR issues
      const mermaid = (await import('mermaid')).default;

      // Initialize mermaid with EMTChat branding
      // Colors: Gold #f8ab1d, Dark Brown #5c2f00, Cream #fbf9f6
      // ENTERPRISE STANDARDS: Font 16px min (WCAG), large nodes, generous spacing
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',  // 'base' gives us full control over colors via themeVariables
        darkMode: false,
        securityLevel: 'loose',
        fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        flowchart: {
          htmlLabels: true,      // ENTERPRISE: HTML labels for better text sizing and wrapping
          curve: 'basis',
          padding: 40,           // ENTERPRISE: Large padding for 16px font readability
          nodeSpacing: 60,       // ENTERPRISE: Horizontal space (reduced for LR layout)
          rankSpacing: 80,       // ENTERPRISE: Vertical space between ranks
          defaultRenderer: 'dagre-d3',
          useMaxWidth: false,    // Don't constrain - let diagram be as wide as needed
          wrappingWidth: 180,    // ENTERPRISE: Wrap text to keep nodes compact
        },
        themeVariables: {
          // EMTChat Brand Colors
          darkMode: false,
          background: '#fbf9f6',           // Warm cream background
          primaryColor: '#f8ab1d',         // EMTChat gold
          primaryTextColor: '#5c2f00',     // Dark brown text
          primaryBorderColor: '#c7940a',   // Darker gold border
          secondaryColor: '#fef6e6',       // Light gold tint
          secondaryTextColor: '#5c2f00',
          secondaryBorderColor: '#c7940a',
          tertiaryColor: '#f5f0e8',        // Warm gray
          tertiaryTextColor: '#5c2f00',
          tertiaryBorderColor: '#d4a017',
          lineColor: '#564d46',            // Warm dark gray lines
          textColor: '#5c2f00',            // Dark brown default text
          mainBkg: '#fef6e6',              // Light gold node background
          nodeBorder: '#c7940a',
          clusterBkg: '#fbf9f6',
          clusterBorder: '#d4a017',
          titleColor: '#5c2f00',
          edgeLabelBackground: '#fbf9f6',
          // Additional EMTChat branded colors
          noteBkgColor: '#fef6e6',
          noteTextColor: '#5c2f00',
          noteBorderColor: '#c7940a',
          actorBkg: '#fef6e6',
          actorBorder: '#c7940a',
          actorTextColor: '#5c2f00',
          actorLineColor: '#564d46',
          signalColor: '#5c2f00',
          signalTextColor: '#5c2f00',
          labelBoxBkgColor: '#fef6e6',
          labelBoxBorderColor: '#c7940a',
          labelTextColor: '#5c2f00',
          loopTextColor: '#5c2f00',
          activationBorderColor: '#c7940a',
          activationBkgColor: '#fef6e6',
          sequenceNumberColor: '#ffffff',
          // ENTERPRISE STANDARDS: Font sizes per WCAG guidelines (16px minimum)
          fontSize: '16px',
        },
      });

      // Generate unique ID for this render
      const id = `mermaid-${Date.now()}`;

      // Debug logging to help diagnose parse errors
      console.log('[DiagramCanvas] Attempting to render mermaid diagram');
      console.log('[DiagramCanvas] Original content length:', mermaidContent.length);
      console.log('[DiagramCanvas] Sanitized content:', sanitizedContent.substring(0, 500) + '...');

      // Render the diagram with sanitized content
      const { svg } = await mermaid.render(id, sanitizedContent);

      // Post-process SVG to add professional title header
      let enhancedSvg = svg;
      if (title && title !== 'Diagram') {
        // Parse SVG to get dimensions and inject title
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
        const svgEl = svgDoc.querySelector('svg');

        if (svgEl) {
          // Get current dimensions
          const viewBox = svgEl.getAttribute('viewBox');
          let width = parseFloat(svgEl.getAttribute('width') || '800');
          let height = parseFloat(svgEl.getAttribute('height') || '600');

          // Parse viewBox if available
          let vbMinX = 0, vbMinY = 0, vbWidth = width, vbHeight = height;
          if (viewBox) {
            const parts = viewBox.split(' ').map(Number);
            [vbMinX, vbMinY, vbWidth, vbHeight] = parts;
          }

          // Title block height
          const titleHeight = 60;

          // Create title group with professional styling
          const titleGroup = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
          titleGroup.setAttribute('class', 'diagram-title-group');

          // Title background
          const titleBg = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
          titleBg.setAttribute('x', String(vbMinX));
          titleBg.setAttribute('y', String(vbMinY - titleHeight));
          titleBg.setAttribute('width', String(vbWidth));
          titleBg.setAttribute('height', String(titleHeight));
          titleBg.setAttribute('fill', '#fef9eb');
          titleBg.setAttribute('stroke', '#c7940a');
          titleBg.setAttribute('stroke-width', '2');
          titleGroup.appendChild(titleBg);

          // Gold accent bar
          const accentBar = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
          accentBar.setAttribute('x', String(vbMinX));
          accentBar.setAttribute('y', String(vbMinY - titleHeight));
          accentBar.setAttribute('width', '6');
          accentBar.setAttribute('height', String(titleHeight));
          accentBar.setAttribute('fill', '#f8ab1d');
          titleGroup.appendChild(accentBar);

          // Title text
          const titleText = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
          titleText.setAttribute('x', String(vbMinX + 24));
          titleText.setAttribute('y', String(vbMinY - titleHeight + 38));
          titleText.setAttribute('font-family', 'Inter, -apple-system, sans-serif');
          titleText.setAttribute('font-size', '20');
          titleText.setAttribute('font-weight', '600');
          titleText.setAttribute('fill', '#5c2f00');
          titleText.textContent = title;
          titleGroup.appendChild(titleText);

          // Insert title at the beginning
          svgEl.insertBefore(titleGroup, svgEl.firstChild);

          // Adjust viewBox to include title
          const newViewBox = `${vbMinX} ${vbMinY - titleHeight} ${vbWidth} ${vbHeight + titleHeight}`;
          svgEl.setAttribute('viewBox', newViewBox);
          svgEl.setAttribute('height', String(height + titleHeight));

          // Serialize back to string
          const serializer = new XMLSerializer();
          enhancedSvg = serializer.serializeToString(svgDoc);
        }
      }

      setSvgContent(enhancedSvg);
      lastRenderedContent.current = mermaidContent;
      console.log('[DiagramCanvas] Render successful');
    } catch (err) {
      console.error('Mermaid rendering error:', err);
      console.error('[DiagramCanvas] Failed content:', mermaidContent);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
    } finally {
      setIsRendering(false);
    }
  }, [isStreaming, title]);

  // Debounced render when content changes and not streaming
  useEffect(() => {
    if (!isStreaming && content.trim()) {
      const timer = setTimeout(() => {
        renderDiagram(content);
      }, 500); // Wait for streaming to settle

      return () => clearTimeout(timer);
    }
  }, [content, isStreaming, renderDiagram]);

  const hasContent = !!content.trim();

  // Determine which layer to show - show skeleton immediately when streaming with no content
  const showSkeleton = isStreaming && !hasContent;
  const showStreamingSource = isStreaming && hasContent;
  const showError = !isStreaming && error;
  const showRendering = !isStreaming && isRendering && !error;
  const showDiagram = !isStreaming && svgContent && !error && !isRendering;
  const showEmpty = !isStreaming && !hasContent && !svgContent;

  // Always render the same DOM structure - use CSS to show/hide layers
  // IMPORTANT: Canvas always uses light theme to match exported output
  return (
    <div className="h-full w-full bg-[#1a1a1a] relative flex flex-col">
      {/* Enterprise Header - EMTChat Branded */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#1a1512] via-[#2a2015] to-[#1a1512] border-b border-[#c7940a]/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* EMTChat Brand Mark */}
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 bg-gradient-to-b from-[#f8ab1d] via-[#d4a017] to-[#c7940a] rounded-full shadow-lg shadow-[#f8ab1d]/20" />
              <div className="flex flex-col">
                <span className="text-[10px] font-medium tracking-wider text-[#c7940a] uppercase">EMTChat</span>
                <h2 className="text-base font-semibold text-[#fef6e6] leading-tight">{title}</h2>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#a89070]">
            <span className="px-2 py-0.5 bg-[#c7940a]/10 border border-[#c7940a]/20 rounded text-[#d4a017] font-medium">
              Workflow Diagram
            </span>
            <span className="text-[#6b5a45]">•</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area with subtle frame */}
      <div className="flex-1 relative overflow-hidden">
        {/* Layer 1: Skeleton (when streaming with no content, after delay) */}
        <div
          className={cn(
            "absolute inset-0 bg-[#1a1a1a] transition-opacity duration-150 z-10",
            showSkeleton ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-2 px-6 pt-4 text-[#a89070]">
            <Sparkles className="h-4 w-4 animate-pulse text-[#f8ab1d]" />
            <span className="text-sm animate-pulse">AI is generating diagram...</span>
          </div>
          <DiagramSkeletonLoader />
        </div>

      {/* Layer 2: Streaming source code preview */}
      <div
        className={cn(
          "absolute inset-0 overflow-auto bg-gray-50 p-4 transition-opacity duration-100",
          showStreamingSource ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="mb-4 flex items-center gap-2 text-amber-600 text-sm">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="animate-pulse">Generating Mermaid diagram...</span>
        </div>
        <pre className="font-mono text-sm text-gray-600 whitespace-pre-wrap">
          {content}
          <span className="inline-flex items-center ml-0.5">
            <span className="relative flex h-4 w-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-sm bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-4 w-0.5 rounded-sm bg-amber-500" />
            </span>
          </span>
        </pre>
      </div>

      {/* Layer 3: Error state */}
      <div
        className={cn(
          "absolute inset-0 overflow-auto bg-white p-4 transition-opacity duration-100",
          showError ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="mb-4 flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Diagram Error</span>
        </div>
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <div className="mb-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => renderDiagram(content)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500 mb-2">Source:</p>
          <pre className="font-mono text-xs text-gray-600 whitespace-pre-wrap bg-gray-100 p-3 rounded">
            {content}
          </pre>
        </div>
      </div>

      {/* Layer 4: Rendering state */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-white transition-opacity duration-100",
          showRendering ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Rendering diagram...</span>
        </div>
      </div>

      {/* Layer 5: Rendered diagram with zoom/pan */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-100",
          showDiagram ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Zoomable/pannable diagram area */}
        <div
          ref={containerRef}
          className={cn(
            "absolute inset-0 overflow-hidden bg-white",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Transform container for zoom/pan */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            {/* Force light mode styling on SVG - ensures WYSIWYG with exported document */}
            <div
              className="mermaid-container inline-block"
              style={{
                fontSize: '14px',
                colorScheme: 'light',
              }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>

          <style>{`
            /* EMTChat - Enterprise Professional Diagram Styling */

            /* SVG Container - Clean white background with subtle shadow */
            .mermaid-container svg {
              background: linear-gradient(180deg, #ffffff 0%, #fdfcfa 100%) !important;
              border-radius: 12px !important;
              padding: 24px !important;
              filter: drop-shadow(0 4px 6px rgba(92, 47, 0, 0.08)) drop-shadow(0 2px 4px rgba(92, 47, 0, 0.04));
            }

            /* ENTERPRISE STANDARD: Minimum 16px font per WCAG accessibility */

            /* Diagram Title - Bold, prominent, branded - 24px for "large text" */
            .mermaid-container .titleText,
            .mermaid-container .title {
              fill: #5c2f00 !important;
              font-size: 24px !important;
              font-weight: 700 !important;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
              letter-spacing: -0.02em !important;
            }

            /* Process Nodes - Professional cards with shadows, LARGER */
            .mermaid-container .node rect {
              fill: #ffffff !important;
              stroke: #c7940a !important;
              stroke-width: 2.5px !important;
              rx: 10px !important;
              ry: 10px !important;
              filter: drop-shadow(0 4px 8px rgba(199, 148, 10, 0.2)) drop-shadow(0 2px 4px rgba(92, 47, 0, 0.1));
            }

            /* Decision Nodes (diamonds) - Emphasized with gold accent */
            .mermaid-container .node polygon {
              fill: #fef9eb !important;
              stroke: #f8ab1d !important;
              stroke-width: 3px !important;
              filter: drop-shadow(0 4px 8px rgba(248, 171, 29, 0.3)) drop-shadow(0 2px 4px rgba(92, 47, 0, 0.12));
            }

            /* Start/End Nodes (circles/ellipses) - Prominent with gold fill */
            .mermaid-container .node circle,
            .mermaid-container .node ellipse {
              fill: #f8ab1d !important;
              stroke: #c7940a !important;
              stroke-width: 2.5px !important;
              filter: drop-shadow(0 4px 8px rgba(199, 148, 10, 0.35));
            }

            /* Node Labels - ENTERPRISE: 16px minimum per WCAG */
            /* Handles both SVG text and HTML labels (foreignObject) */
            .mermaid-container .node .label,
            .mermaid-container .nodeLabel,
            .mermaid-container .label,
            .mermaid-container .node foreignObject div,
            .mermaid-container .node foreignObject span,
            .mermaid-container .labelText {
              color: #3d2400 !important;
              fill: #3d2400 !important;
              font-weight: 600 !important;
              font-size: 16px !important;
              font-family: 'Inter', -apple-system, sans-serif !important;
              line-height: 1.4 !important;
              text-align: center !important;
              white-space: normal !important;
              word-wrap: break-word !important;
            }

            /* Edge Labels - ENTERPRISE: 14px minimum (acceptable for secondary text) */
            .mermaid-container .edgeLabel {
              background-color: #ffffff !important;
              color: #5c2f00 !important;
              font-weight: 600 !important;
              font-size: 14px !important;
              padding: 4px 10px !important;
              border-radius: 6px !important;
              box-shadow: 0 2px 4px rgba(92, 47, 0, 0.12);
            }

            /* Connector Lines - Refined with proper weight */
            .mermaid-container .edgePath .path {
              stroke: #8b7355 !important;
              stroke-width: 2px !important;
            }

            /* Arrow Markers */
            .mermaid-container marker path {
              fill: #8b7355 !important;
              stroke: #8b7355 !important;
            }

            /* Subgraph/Cluster Containers */
            .mermaid-container .cluster rect {
              fill: #faf8f5 !important;
              stroke: #d4a017 !important;
              stroke-width: 2px !important;
              stroke-dasharray: 5, 3 !important;
              rx: 12px !important;
              ry: 12px !important;
            }

            /* Cluster Labels */
            .mermaid-container .cluster-label .nodeLabel {
              fill: #c7940a !important;
              font-weight: 600 !important;
              font-size: 14px !important;
            }

            /* All Text - Consistent typography */
            .mermaid-container text {
              fill: #5c2f00 !important;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            }

            /* Flowchart specific links */
            .mermaid-container .flowchart-link {
              stroke: #8b7355 !important;
            }

            /* Sequence Diagram specific styling */
            .mermaid-container .actor {
              fill: #ffffff !important;
              stroke: #c7940a !important;
              stroke-width: 2px !important;
            }
            .mermaid-container .actor-line {
              stroke: #d4a017 !important;
              stroke-width: 1.5px !important;
            }
            .mermaid-container .messageLine0,
            .mermaid-container .messageLine1 {
              stroke: #8b7355 !important;
              stroke-width: 1.5px !important;
            }
            .mermaid-container .messageText {
              fill: #5c2f00 !important;
              font-size: 12px !important;
            }
            .mermaid-container .activation0,
            .mermaid-container .activation1,
            .mermaid-container .activation2 {
              fill: #fef6e6 !important;
              stroke: #c7940a !important;
            }

            /* Notes in diagrams */
            .mermaid-container .note {
              fill: #fef9eb !important;
              stroke: #d4a017 !important;
            }
            .mermaid-container .noteText {
              fill: #5c2f00 !important;
              font-size: 12px !important;
            }
          `}</style>
        </div>

        {/* Zoom controls toolbar - adapts to light/dark mode */}
        <div
          className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg shadow-xl p-2 z-50"
          style={{
            backgroundColor: isDarkMode ? '#262626' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#404040' : '#e5e5e5'}`,
          }}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomOut}
            disabled={scale <= MIN_SCALE}
            className="h-8 w-8 p-0"
            style={{
              backgroundColor: isDarkMode ? '#262626' : '#ffffff',
              borderColor: isDarkMode ? '#525252' : '#d4d4d4',
              color: isDarkMode ? '#e5e5e5' : '#171717',
            }}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" style={{ color: isDarkMode ? '#e5e5e5' : '#171717' }} />
          </Button>
          <span
            className="text-xs font-semibold min-w-[3.5rem] text-center px-2 py-1.5 rounded"
            style={{
              backgroundColor: isDarkMode ? '#404040' : '#f5f5f5',
              color: isDarkMode ? '#e5e5e5' : '#171717',
            }}
          >
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomIn}
            disabled={scale >= MAX_SCALE}
            className="h-8 w-8 p-0"
            style={{
              backgroundColor: isDarkMode ? '#262626' : '#ffffff',
              borderColor: isDarkMode ? '#525252' : '#d4d4d4',
              color: isDarkMode ? '#e5e5e5' : '#171717',
            }}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" style={{ color: isDarkMode ? '#e5e5e5' : '#171717' }} />
          </Button>
          <div style={{ width: '1px', height: '24px', backgroundColor: isDarkMode ? '#525252' : '#e5e5e5', margin: '0 4px' }} />
          <Button
            size="sm"
            variant="outline"
            onClick={fitToView}
            className="h-8 w-8 p-0"
            style={{
              backgroundColor: isDarkMode ? '#262626' : '#ffffff',
              borderColor: isDarkMode ? '#525252' : '#d4d4d4',
              color: isDarkMode ? '#e5e5e5' : '#171717',
            }}
            title="Fit to view"
          >
            <Maximize2 className="h-4 w-4" style={{ color: isDarkMode ? '#e5e5e5' : '#171717' }} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetZoom}
            className="h-8 w-8 p-0"
            style={{
              backgroundColor: isDarkMode ? '#262626' : '#ffffff',
              borderColor: isDarkMode ? '#525252' : '#d4d4d4',
              color: isDarkMode ? '#e5e5e5' : '#171717',
            }}
            title="Reset to 100%"
          >
            <RotateCcw className="h-4 w-4" style={{ color: isDarkMode ? '#e5e5e5' : '#171717' }} />
          </Button>
        </div>

        {/* Hint for zoom - below zoom controls */}
        <div
          className="absolute top-16 right-4 text-xs px-2.5 py-1.5 rounded shadow z-50"
          style={{
            backgroundColor: isDarkMode ? '#262626' : '#ffffff',
            color: isDarkMode ? '#a3a3a3' : '#525252',
            border: `1px solid ${isDarkMode ? '#404040' : '#e5e5e5'}`,
          }}
        >
          <Move className="h-3 w-3 inline mr-1" style={{ color: isDarkMode ? '#a3a3a3' : '#525252' }} />
          Drag to pan • Ctrl+scroll to zoom
        </div>
      </div>

      {/* Layer 6: Empty state */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-white text-gray-400 transition-opacity duration-100",
          showEmpty ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <p className="text-sm">No diagram content</p>
      </div>
    </div>
    </div>
  );
};
