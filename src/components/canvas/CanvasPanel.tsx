'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { X, Copy, Download, Code, FileText, GitBranch, Globe, Loader2, ExternalLink, Table, BarChart3, Image, Save, Check, Sparkles, FileDown, FolderPlus, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CodeCanvas } from './CodeCanvas';
import { DocumentCanvas, markdownToHtml } from './DocumentCanvas';
import { DiagramCanvas } from './DiagramCanvas';
import { HtmlCanvas } from './HtmlCanvas';
import { ChartCanvas } from './ChartCanvas';
import { TableCanvas } from './TableCanvas';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getApiBaseUrl } from '@/lib/config';

// Create a full HTML document from markdown content for opening in browser
function createDocumentHtml(markdownContent: string, title: string): string {
  const bodyHtml = markdownToHtml(markdownContent);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      color: #333;
      background: #fff;
    }
    h1 { font-size: 2rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid #eee; padding-bottom: 0.25rem; }
    h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; }
    p { margin: 0.75rem 0; }
    ul, ol { margin: 0.75rem 0; padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
    code { background: #f4f4f4; padding: 0.125rem 0.375rem; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 1rem 0; padding-left: 1rem; color: #666; font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f4f4f4; font-weight: 600; }
    hr { border: none; border-top: 1px solid #eee; margin: 2rem 0; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    @media print {
      body { max-width: none; padding: 1rem; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

export type CanvasType = 'code' | 'document' | 'diagram' | 'html' | 'chart' | 'table' | null;

// Detect if content contains tabular data (pipe-delimited tables)
function detectTableData(content: string): boolean {
  if (!content) return false;
  const lines = content.split('\n');
  let pipeLineCount = 0;

  for (const line of lines) {
    // Check for lines with multiple pipe characters (table rows)
    const pipeCount = (line.match(/\|/g) || []).length;
    if (pipeCount >= 2) {
      pipeLineCount++;
      // If we have at least 3 lines with pipes, it's likely a table
      if (pipeLineCount >= 3) return true;
    }
  }
  return false;
}

// Check if line is a markdown table separator (|---|---|)
function isTableSeparator(line: string): boolean {
  return /^[\s|:-]+$/.test(line) && line.includes('|') && line.includes('-');
}

// Parse a single table row into cells
function parseTableRow(line: string): string[] | null {
  // Skip empty lines
  if (!line.trim()) return null;

  // Must have pipes
  if (!line.includes('|')) return null;

  // Skip separator lines - but return special marker
  if (isTableSeparator(line)) return null;

  // Split by pipe and clean up each cell
  const cells = line
    .split('|')
    .map(cell => cell.trim())
    .filter((cell, index, arr) => {
      // Remove empty first/last cells from lines like "| data | data |"
      if (index === 0 && cell === '') return false;
      if (index === arr.length - 1 && cell === '') return false;
      return true;
    });

  return cells.length > 0 ? cells : null;
}

// Find the largest table in the content (most rows with consistent column count)
function findLargestTable(content: string): string[][] {
  const lines = content.split('\n');
  const tables: string[][][] = [];
  let currentTable: string[][] = [];
  let currentColumnCount = 0;

  for (const line of lines) {
    // Check if this is a separator line - don't break the table for separators
    if (isTableSeparator(line)) {
      // Separator lines are part of tables, just skip them
      continue;
    }

    const cells = parseTableRow(line);

    if (cells) {
      // If this row has a different column count, it might be a new table
      if (currentTable.length > 0 && Math.abs(cells.length - currentColumnCount) > 2) {
        // Allow some variance in column count (AI sometimes adds/removes columns)
        // Only treat as new table if column count differs by more than 2
        if (currentTable.length >= 2) {
          tables.push(currentTable);
        }
        currentTable = [];
      }

      currentTable.push(cells);
      currentColumnCount = cells.length;
    } else if (currentTable.length > 0 && !line.includes('|')) {
      // Non-table line (no pipes at all) - end of current table
      if (currentTable.length >= 2) {
        tables.push(currentTable);
      }
      currentTable = [];
      currentColumnCount = 0;
    }
  }

  // Don't forget the last table
  if (currentTable.length >= 2) {
    tables.push(currentTable);
  }

  // Return the largest table (most rows)
  if (tables.length === 0) return [];
  return tables.reduce((a, b) => a.length > b.length ? a : b);
}

// Parse pipe-delimited table content to CSV
function parseTableToCSV(content: string): string {
  const table = findLargestTable(content);

  if (table.length === 0) return '';

  const csvRows: string[] = [];

  for (const row of table) {
    // Escape CSV: wrap in quotes if contains comma, quote, or newline
    const csvCells = row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    csvRows.push(csvCells.join(','));
  }

  return csvRows.join('\n');
}

interface CanvasPanelProps {
  type: CanvasType;
  content: string;
  language?: string;
  title?: string;
  isStreaming: boolean;
  onClose: () => void;
  chatId?: string | null;
  onSave?: (data: { type: CanvasType; content: string; title: string; language?: string }) => Promise<void>;
}

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  type,
  content,
  language,
  title,
  isStreaming,
  onClose,
  chatId,
  onSave,
}) => {
  // Save button state
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Save to My Docs state
  const [isSavingToMyDocs, setIsSavingToMyDocs] = useState(false);
  const [justSavedToMyDocs, setJustSavedToMyDocs] = useState(false);

  // Detect if content has tabular data
  const hasTableData = useMemo(() => detectTableData(content), [content]);

  // Handle save to chat
  const handleSave = useCallback(async () => {
    if (!onSave || !chatId || !type || !content) return;

    setIsSaving(true);
    try {
      await onSave({
        type,
        content,
        title: title || 'Untitled',
        language,
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save canvas:', err);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, chatId, type, content, title, language]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [content]);

  // Save to My Docs (upload to RAG pipeline)
  const handleSaveToMyDocs = useCallback(async () => {
    if (!content || isSavingToMyDocs) return;

    setIsSavingToMyDocs(true);
    try {
      // Determine file extension and mime type based on canvas type
      let extension = 'txt';
      let mimeType = 'text/plain';
      let blob: Blob;

      if (type === 'code') {
        extension = language || 'txt';
        mimeType = 'text/plain';
        blob = new Blob([content], { type: mimeType });
      } else if (type === 'diagram') {
        extension = 'mmd';
        mimeType = 'text/plain';
        blob = new Blob([content], { type: mimeType });
      } else if (type === 'html') {
        // Convert HTML to PDF for My Docs (PDF is supported, HTML is not)
        extension = 'pdf';
        mimeType = 'application/pdf';

        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;

        // Create an off-screen container to render the HTML
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.width = '800px';
        container.style.background = '#ffffff';
        container.style.padding = '40px';
        container.innerHTML = content;
        document.body.appendChild(container);

        await new Promise(resolve => setTimeout(resolve, 300));

        const canvas = await html2canvas(container, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          width: 800,
        });

        document.body.removeChild(container);

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width / 2;
        const imgHeight = canvas.height / 2;

        const LETTER_WIDTH = 612;
        const LETTER_HEIGHT = 792;
        const margin = 36;
        const contentWidth = LETTER_WIDTH - (margin * 2);
        const scale = contentWidth / imgWidth;
        const scaledHeight = imgHeight * scale;
        const pageContentHeight = LETTER_HEIGHT - (margin * 2);
        const numPages = Math.ceil(scaledHeight / pageContentHeight);

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'letter',
        });

        for (let page = 0; page < numPages; page++) {
          if (page > 0) pdf.addPage();
          const srcY = (page * pageContentHeight) / scale;
          const srcHeight = Math.min(pageContentHeight / scale, imgHeight - srcY);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = srcHeight;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            const img = document.createElement('img');
            img.src = imgData;
            await new Promise(resolve => { img.onload = resolve; });
            ctx.drawImage(img, 0, srcY, imgWidth, srcHeight, 0, 0, imgWidth, srcHeight);
            const pageImgData = pageCanvas.toDataURL('image/png');
            pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, srcHeight * scale);
          }
        }

        blob = pdf.output('blob');
      } else if (type === 'document') {
        extension = 'md';
        mimeType = 'text/markdown';
        blob = new Blob([content], { type: mimeType });
      } else if (type === 'chart') {
        extension = 'json';
        mimeType = 'application/json';
        blob = new Blob([content], { type: mimeType });
      } else {
        blob = new Blob([content], { type: mimeType });
      }

      const fileName = `${title || 'canvas'}.${extension}`;
      const fileSize = blob.size;

      // Step 1: Get presigned URL
      const presignedResponse = await fetchWithAuth('/api/documents/get-presigned-url', {
        method: 'POST',
        body: JSON.stringify({
          fileName,
          fileType: mimeType,
          fileSize,
        }),
      });

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json().catch(() => ({ message: 'Failed to get upload URL' }));
        throw new Error(errorData.message || `Failed to get upload URL: ${presignedResponse.status}`);
      }

      const { presignedUrl, s3Key } = await presignedResponse.json();

      // Step 2: Upload to S3
      let uploadUrl = presignedUrl;
      if (presignedUrl.startsWith('/')) {
        const apiBaseUrl = getApiBaseUrl();
        uploadUrl = `${apiBaseUrl}${presignedUrl}`;
      }

      const s3Response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
        mode: 'cors',
        credentials: uploadUrl.includes('localhost') || uploadUrl.includes('/api/files/local/') ? 'include' : 'omit',
      });

      if (!s3Response.ok) {
        throw new Error(`Upload failed: ${s3Response.status} ${s3Response.statusText}`);
      }

      // Step 3: Notify backend to process the uploaded file
      const processResponse = await fetchWithAuth('/api/documents/process-uploaded-file', {
        method: 'POST',
        body: JSON.stringify({
          s3Key,
          fileName,
          fileType: mimeType,
          fileSize,
        }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({ message: 'Processing failed' }));
        throw new Error(errorData.message || `Processing failed: ${processResponse.status}`);
      }

      // Success!
      setJustSavedToMyDocs(true);
      setTimeout(() => setJustSavedToMyDocs(false), 2000);
      console.log(`[CanvasPanel] Successfully saved "${fileName}" to My Docs`);
    } catch (err) {
      console.error('Failed to save to My Docs:', err);
      alert(`Failed to save to My Docs: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSavingToMyDocs(false);
    }
  }, [content, type, language, title, isSavingToMyDocs]);

  // Download as CSV (for tables)
  const handleDownloadCSV = useCallback(() => {
    const csvContent = parseTableToCSV(content);
    const filename = `${title || 'data'}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, title]);

  // Download chart as PNG image
  const handleDownloadChartPNG = useCallback(() => {
    // Find the canvas element rendered by Chart.js
    const chartCanvas = document.querySelector('.chart-canvas-container canvas') as HTMLCanvasElement;
    if (!chartCanvas) {
      console.error('Chart canvas not found');
      return;
    }

    const url = chartCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'chart'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [title]);

  // Download chart data as CSV (for Excel)
  const handleDownloadChartCSV = useCallback(() => {
    if (!content) return;

    try {
      const data = JSON.parse(content);
      const labels = data.labels || [];
      const datasets = data.datasets || [];

      // Build CSV rows
      const csvRows: string[] = [];

      // Header row: Label, Dataset1, Dataset2, ...
      const headerRow = ['Label', ...datasets.map((ds: { label: string }) => ds.label || 'Value')];
      csvRows.push(headerRow.join(','));

      // Data rows
      for (let i = 0; i < labels.length; i++) {
        const row = [
          labels[i],
          ...datasets.map((ds: { data: number[] }) => ds.data[i] ?? '')
        ];
        // Escape values that contain commas
        const escapedRow = row.map(val => {
          const str = String(val);
          if (str.includes(',') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvRows.push(escapedRow.join(','));
      }

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'chart-data'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export chart CSV:', err);
    }
  }, [content, title]);

  // Download as Excel (for tables) - calls backend API
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const handleDownloadExcel = useCallback(async () => {
    if (!content || isDownloadingExcel) return;

    setIsDownloadingExcel(true);
    try {
      const response = await fetchWithAuth('/api/export/download', {
        method: 'POST',
        body: JSON.stringify({
          content,
          title: title || 'Data Export',
          format: 'xlsx',
        }),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'data'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download Excel:', err);
      alert('Failed to download Excel file. Please try again.');
    } finally {
      setIsDownloadingExcel(false);
    }
  }, [content, title, isDownloadingExcel]);

  const handleDownload = useCallback(() => {
    let extension = 'txt';
    let mimeType = 'text/plain';

    if (type === 'code') {
      extension = language || 'txt';
    } else if (type === 'diagram') {
      extension = 'mmd';
    } else if (type === 'html') {
      extension = 'html';
      mimeType = 'text/html';
    } else if (type === 'document') {
      extension = 'md';
    } else if (type === 'chart') {
      extension = 'json';
      mimeType = 'application/json';
    }

    const filename = `${title || 'canvas'}.${extension}`;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, type, language, title]);

  // PDF download for HTML content - converts rendered HTML to PDF
  const [isGeneratingHtmlPdf, setIsGeneratingHtmlPdf] = useState(false);
  const handleDownloadHtmlAsPdf = useCallback(async () => {
    if (!content || type !== 'html' || isGeneratingHtmlPdf) return;

    setIsGeneratingHtmlPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Create an off-screen container to render the HTML
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '800px';
      container.style.background = '#ffffff';
      container.style.padding = '40px';
      container.innerHTML = content;
      document.body.appendChild(container);

      // Wait for fonts and rendering
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture with html2canvas at high resolution
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        width: 800,
      });

      // Remove the temporary container
      document.body.removeChild(container);

      // Create PDF from canvas
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width / 2;
      const imgHeight = canvas.height / 2;

      // Standard Letter page size in points
      const LETTER_WIDTH = 612;
      const LETTER_HEIGHT = 792;
      const margin = 36; // 0.5 inch margins
      const contentWidth = LETTER_WIDTH - (margin * 2);

      // Scale image to fit page width
      const scale = contentWidth / imgWidth;
      const scaledHeight = imgHeight * scale;

      // Calculate number of pages needed
      const pageContentHeight = LETTER_HEIGHT - (margin * 2);
      const numPages = Math.ceil(scaledHeight / pageContentHeight);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter',
      });

      // Add pages as needed
      for (let page = 0; page < numPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        // Calculate the portion of the image to show on this page
        const srcY = (page * pageContentHeight) / scale;
        const srcHeight = Math.min(pageContentHeight / scale, imgHeight - srcY);

        // Create a canvas for just this page's content
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = srcHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          const img = document.createElement('img');
          img.src = imgData;
          await new Promise(resolve => { img.onload = resolve; });
          ctx.drawImage(img, 0, srcY, imgWidth, srcHeight, 0, 0, imgWidth, srcHeight);
          const pageImgData = pageCanvas.toDataURL('image/png');
          pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, srcHeight * scale);
        }
      }

      pdf.save(`${(title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (error) {
      console.error('HTML to PDF conversion failed:', error);
      alert('PDF generation failed. Please try again.');
    } finally {
      setIsGeneratingHtmlPdf(false);
    }
  }, [content, type, title, isGeneratingHtmlPdf]);

  // PDF download for diagrams - scales to fit standard page
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const handleDownloadPdf = useCallback(async () => {
    if (!content || type !== 'diagram' || isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    try {
      // Dynamically import mermaid, jsPDF, and html2canvas
      const mermaid = (await import('mermaid')).default;
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Initialize mermaid with light theme for better PDF readability
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'Arial, sans-serif',
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
        },
        themeVariables: {
          primaryColor: '#fbbf24',
          primaryTextColor: '#1f2937',
          primaryBorderColor: '#d97706',
          lineColor: '#4b5563',
          secondaryColor: '#f3f4f6',
          tertiaryColor: '#ffffff',
          background: '#ffffff',
          mainBkg: '#fef3c7',
          nodeBorder: '#d97706',
        },
      });

      // Render mermaid to SVG
      const { svg } = await mermaid.render(`pdf-diagram-${Date.now()}`, content);

      // Create an off-screen container to render the diagram
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.background = '#ffffff';
      container.style.padding = '40px';
      container.innerHTML = `
        <div style="font-family: Arial, sans-serif; margin-bottom: 24px;">
          <h1 style="font-size: 28px; color: #1f2937; margin: 0 0 8px 0; font-weight: 600;">${title || 'Diagram'}</h1>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        <div class="mermaid-svg">${svg}</div>
      `;
      document.body.appendChild(container);

      // Wait for fonts and rendering
      await new Promise(resolve => setTimeout(resolve, 150));

      // Capture with html2canvas at high resolution
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      // Remove the temporary container
      document.body.removeChild(container);

      // Create PDF from canvas - scale to fit A4/Letter page
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width / 2; // Account for scale: 2
      const imgHeight = canvas.height / 2;

      // Standard page sizes in points (72 dpi)
      const A4_WIDTH = 595;
      const A4_HEIGHT = 842;
      const LETTER_WIDTH = 612;
      const LETTER_HEIGHT = 792;

      // Determine orientation based on aspect ratio
      const aspectRatio = imgWidth / imgHeight;
      const isLandscape = aspectRatio > 1.2; // More than 20% wider than tall

      // Use Letter size for US compatibility
      const pageWidth = isLandscape ? LETTER_HEIGHT : LETTER_WIDTH;
      const pageHeight = isLandscape ? LETTER_WIDTH : LETTER_HEIGHT;

      // Calculate margins (0.75 inch = 54 points)
      const margin = 54;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      // Scale image to fit within content area while preserving aspect ratio
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;

      const widthRatio = contentWidth / imgWidth;
      const heightRatio = contentHeight / imgHeight;
      const scaleRatio = Math.min(widthRatio, heightRatio, 1); // Don't scale up

      finalWidth = imgWidth * scaleRatio;
      finalHeight = imgHeight * scaleRatio;

      // Center the image on the page
      const xOffset = (pageWidth - finalWidth) / 2;
      const yOffset = (pageHeight - finalHeight) / 2;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'letter',
      });

      // Add the image centered
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

      pdf.save(`${(title || 'diagram').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF generation failed. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [content, type, title, isGeneratingPdf]);

  // SVG download for diagrams - vector graphics, infinitely scalable
  const handleDownloadSvg = useCallback(async () => {
    if (!content || type !== 'diagram') return;

    try {
      const mermaid = (await import('mermaid')).default;

      // Sanitize Mermaid content - fix common issues that cause parse errors
      let sanitizedContent = content
        // Replace curly quotes with straight quotes, then escape them
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'");

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
      let nodeCounter = 0;
      sanitizedContent = sanitizedContent.replace(
        /(-->|---)(\s*)([A-Za-z][A-Za-z0-9\s]+?)(\s*)($|\n|-->|---|;)/g,
        (match, arrow, space1, target, space2, ending) => {
          const trimmedTarget = target.trim();
          if (!trimmedTarget.includes(' ') || trimmedTarget.includes('[') || trimmedTarget.includes('{')) {
            return match;
          }
          if (subgraphNames.includes(trimmedTarget)) {
            const nodeId = `subref_${nodeCounter++}`;
            return `${arrow}${space1}${nodeId}[${trimmedTarget}]${space2}${ending}`;
          }
          const nodeId = `node_${nodeCounter++}`;
          return `${arrow}${space1}${nodeId}[${trimmedTarget}]${space2}${ending}`;
        }
      );

      // Escape quotes inside node labels [...] by replacing with HTML entities
      sanitizedContent = sanitizedContent.replace(/\[([^\]]*)\]/g, (match, innerContent) => {
        const escaped = innerContent
          .replace(/"/g, '#quot;')
          .replace(/'/g, '#apos;');
        return `[${escaped}]`;
      });

      // Also handle content inside braces {...} for decision nodes
      sanitizedContent = sanitizedContent.replace(/\{([^}]*)\}/g, (match, innerContent) => {
        const escaped = innerContent
          .replace(/"/g, '#quot;')
          .replace(/'/g, '#apos;');
        return `{${escaped}}`;
      });

      // Initialize mermaid with a clean light theme for better readability
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'Arial, sans-serif',
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
        },
        themeVariables: {
          primaryColor: '#fbbf24',
          primaryTextColor: '#1f2937',
          primaryBorderColor: '#d97706',
          lineColor: '#4b5563',
          secondaryColor: '#f3f4f6',
          tertiaryColor: '#ffffff',
          background: '#ffffff',
          mainBkg: '#fef3c7',
          nodeBorder: '#d97706',
        },
      });

      // Render mermaid to SVG - download as-is to preserve foreignObject text
      const { svg } = await mermaid.render(`svg-diagram-${Date.now()}`, sanitizedContent);

      // Download the raw SVG directly (don't modify it - breaks foreignObject text)
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${(title || 'diagram').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('SVG generation failed:', error);
      alert('SVG generation failed. Please try again.');
    }
  }, [content, type, title]);

  const handleOpenInBrowser = useCallback(async () => {
    console.log('[CanvasPanel] handleOpenInBrowser called, type:', type, 'content length:', content?.length);
    if (!content) {
      console.log('[CanvasPanel] No content, returning');
      return;
    }
    if (type !== 'html' && type !== 'document') {
      console.log('[CanvasPanel] Type not html/document, returning');
      return;
    }

    let htmlContent: string;

    if (type === 'html') {
      // HTML content is already ready
      htmlContent = content;
    } else {
      // Document - convert markdown to styled HTML
      htmlContent = createDocumentHtml(content, title || 'Document');
    }

    // For HTML with scripts (like Chart.js), use backend endpoint
    // This gives the page a proper origin so CDN scripts can load
    if (type === 'html') {
      try {
        const token = localStorage.getItem('accessToken');
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ||
                          process.env.NEXT_PUBLIC_API_URL ||
                          'http://localhost:4001';

        console.log('[CanvasPanel] Posting HTML to backend:', apiBaseUrl);
        const response = await fetch(`${apiBaseUrl}/api/chats/html-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ html: htmlContent, title: title || 'Report' }),
        });

        console.log('[CanvasPanel] Backend response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[CanvasPanel] Backend returned URL:', data.url);
          // Open the report served from backend (has proper origin, CDN works)
          window.open(`${apiBaseUrl}${data.url}`, '_blank');
          return;
        } else {
          // Fallback to document.write if backend fails
          const errorText = await response.text();
          console.warn('[CanvasPanel] Backend report storage failed:', response.status, errorText);
        }
      } catch (error) {
        console.error('[CanvasPanel] Error storing report:', error);
      }
      // Fallback to document.write
      console.warn('[CanvasPanel] Using document.write fallback');
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      }
    } else {
      // Use blob URL for documents (markdown->HTML, no external scripts)
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }, [content, type, title]);

  const getIcon = () => {
    switch (type) {
      case 'code':
        return <Code className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'diagram':
        return <GitBranch className="h-4 w-4" />;
      case 'html':
        return <Globe className="h-4 w-4" />;
      case 'chart':
        return <BarChart3 className="h-4 w-4" />;
      case 'table':
        return <FileSpreadsheet className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'code':
        return language ? language.toUpperCase() : 'Code';
      case 'document':
        return 'Document';
      case 'diagram':
        return 'Diagram';
      case 'html':
        return 'HTML';
      case 'chart':
        return 'Chart';
      case 'table':
        return 'Spreadsheet';
      default:
        return '';
    }
  };

  // Always render the same structure to prevent flash from remounting
  return (
    <div className="flex h-full flex-col bg-card canvas-no-flash" data-canvas-panel>
      {/* Header - always visible but content changes */}
      <div className={cn(
        "flex items-center justify-between border-b border-border bg-muted px-3 py-2",
        !type && "invisible h-0 overflow-hidden border-0 p-0"
      )}>
        <div className="flex items-center gap-2">
          <span className={cn(
            "flex items-center justify-center rounded p-1",
            type === 'code' && "bg-blue-500/10 text-blue-500",
            type === 'document' && "bg-green-500/10 text-green-500",
            type === 'diagram' && "bg-purple-500/10 text-purple-500",
            type === 'html' && "bg-orange-500/10 text-orange-500",
            type === 'chart' && "bg-amber-500/10 text-amber-500",
            type === 'table' && "bg-emerald-500/10 text-emerald-500"
          )}>
            {getIcon()}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight text-gray-200">
              {title || 'Untitled'}
            </span>
            <span className="text-xs text-gray-400">
              {getTypeLabel()}
            </span>
          </div>
          {isStreaming && (
            <div className="ml-2 flex items-center gap-1 text-xs text-amber-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>AI is writing...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Save to chat button */}
          {chatId && onSave && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 gap-1 px-2 text-xs text-gray-300 hover:text-white hover:bg-gray-700",
                justSaved && "text-green-500"
              )}
              onClick={handleSave}
              title="Save to chat"
              disabled={!content || isStreaming || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : justSaved ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {justSaved ? 'Saved' : 'Save'}
            </Button>
          )}
          {/* Open in browser - for HTML and Documents */}
          {(type === 'html' || type === 'document') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-gray-300 hover:text-white hover:bg-gray-700"
              onClick={handleOpenInBrowser}
              title={type === 'document' ? "Open formatted document in browser" : "Open in browser"}
              disabled={!content || isStreaming}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Button>
          )}
          {/* CSV Export button - shows when tabular data detected or type="table" */}
          {(hasTableData || type === 'table') && type !== 'chart' && type !== 'diagram' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-green-500 hover:text-green-400 hover:bg-gray-700"
              onClick={handleDownloadCSV}
              title="Download as CSV (spreadsheet)"
              disabled={!content || isStreaming}
            >
              <Table className="h-3.5 w-3.5" />
              CSV
            </Button>
          )}
          {/* Excel Export button - shows when tabular data detected or type="table" */}
          {(hasTableData || type === 'table') && type !== 'chart' && type !== 'diagram' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-blue-500 hover:text-blue-400 hover:bg-gray-700"
              onClick={handleDownloadExcel}
              title="Download as Excel (.xlsx)"
              disabled={!content || isStreaming || isDownloadingExcel}
            >
              {isDownloadingExcel ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Excel
            </Button>
          )}
          {/* Chart export buttons */}
          {type === 'chart' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-700"
                onClick={handleDownloadChartPNG}
                title="Download as PNG image"
                disabled={!content || isStreaming}
              >
                <Image className="h-3.5 w-3.5" />
                PNG
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-green-500 hover:text-green-400 hover:bg-gray-700"
                onClick={handleDownloadChartCSV}
                title="Download data as CSV (for Excel)"
                disabled={!content || isStreaming}
              >
                <Table className="h-3.5 w-3.5" />
                CSV
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
            onClick={handleCopy}
            title="Copy to clipboard"
            disabled={!content}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 gap-0.5 px-1.5 text-gray-300 hover:text-white hover:bg-gray-700",
                  (isSavingToMyDocs || justSavedToMyDocs) && "text-green-500"
                )}
                title="Download or Save"
                disabled={!content || isSavingToMyDocs}
              >
                {isSavingToMyDocs ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : justSavedToMyDocs ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {type === 'html' ? (
                <>
                  <DropdownMenuItem
                    onClick={handleDownloadHtmlAsPdf}
                    className="cursor-pointer"
                    disabled={isGeneratingHtmlPdf}
                  >
                    {isGeneratingHtmlPdf ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    Download as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                    <Download className="h-4 w-4 mr-2" />
                    Download as HTML
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSaveToMyDocs} className="cursor-pointer" disabled={isSavingToMyDocs}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Save to My Docs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {type === 'diagram' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 p-0 px-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 gap-1"
              onClick={handleDownloadSvg}
              title="Download as SVG (vector, zoomable)"
              disabled={!content}
            >
              <Image className="h-3.5 w-3.5" />
              <span className="text-xs">SVG</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
            onClick={onClose}
            title="Close canvas"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content area - relative positioning for absolute skeleton layers in children */}
      <div className="flex-1 overflow-auto bg-card canvas-no-flash relative" data-canvas-content>
        {/* Empty state */}
        {!type && !isStreaming && (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Code className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">AI Canvas</h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Ask me to create code, documents, or diagrams and they&apos;ll appear here in real-time.
            </p>
            <p className="mt-4 text-xs text-muted-foreground/70">
              Try: &quot;Write a Python function to sort an array&quot;
            </p>
          </div>
        )}
        {/* Canvas content */}
        {type === 'code' && (
          <CodeCanvas content={content} language={language} isStreaming={isStreaming} />
        )}
        {type === 'document' && (
          <DocumentCanvas content={content} isStreaming={isStreaming} />
        )}
        {type === 'diagram' && (
          <DiagramCanvas content={content} isStreaming={isStreaming} title={title || 'Diagram'} />
        )}
        {type === 'html' && (
          <HtmlCanvas content={content} isStreaming={isStreaming} onOpenInBrowser={handleOpenInBrowser} />
        )}
        {type === 'chart' && (
          <ChartCanvas content={content} isStreaming={isStreaming} />
        )}
        {type === 'table' && (
          <TableCanvas content={content} isStreaming={isStreaming} />
        )}
      </div>
    </div>
  );
};
