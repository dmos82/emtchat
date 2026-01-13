'use client';

import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface TableCanvasProps {
  content: string;
  isStreaming: boolean;
}

// Check if line is a markdown table separator (|---|---|)
function isTableSeparator(line: string): boolean {
  return /^[\s|:-]+$/.test(line) && line.includes('|') && line.includes('-');
}

// Parse a single table row into cells
function parseTableRow(line: string): string[] | null {
  if (!line.trim()) return null;
  if (!line.includes('|')) return null;
  if (isTableSeparator(line)) return null;

  const cells = line
    .split('|')
    .map(cell => cell.trim())
    .filter((cell, index, arr) => {
      if (index === 0 && cell === '') return false;
      if (index === arr.length - 1 && cell === '') return false;
      return true;
    });

  return cells.length > 0 ? cells : null;
}

// Find the largest table in the content
function findLargestTable(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split('\n');
  const tables: { headers: string[]; rows: string[][] }[] = [];
  let currentTable: string[][] = [];
  let currentColumnCount = 0;

  for (const line of lines) {
    if (isTableSeparator(line)) continue;

    const cells = parseTableRow(line);

    if (cells) {
      if (currentTable.length > 0 && Math.abs(cells.length - currentColumnCount) > 2) {
        if (currentTable.length >= 2) {
          tables.push({
            headers: currentTable[0],
            rows: currentTable.slice(1),
          });
        }
        currentTable = [];
      }

      currentTable.push(cells);
      currentColumnCount = cells.length;
    } else if (currentTable.length > 0 && !line.includes('|')) {
      if (currentTable.length >= 2) {
        tables.push({
          headers: currentTable[0],
          rows: currentTable.slice(1),
        });
      }
      currentTable = [];
      currentColumnCount = 0;
    }
  }

  if (currentTable.length >= 2) {
    tables.push({
      headers: currentTable[0],
      rows: currentTable.slice(1),
    });
  }

  if (tables.length === 0) {
    return { headers: [], rows: [] };
  }

  return tables.reduce((a, b) => (a.rows.length > b.rows.length ? a : b));
}

export function TableCanvas({ content, isStreaming }: TableCanvasProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const tableData = useMemo(() => findLargestTable(content), [content]);

  const sortedRows = useMemo(() => {
    if (sortColumn === null) return tableData.rows;

    return [...tableData.rows].sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

      // Try numeric comparison first
      const aNum = parseFloat(aVal.replace(/[,$%]/g, ''));
      const bNum = parseFloat(bVal.replace(/[,$%]/g, ''));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Fall back to string comparison
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [tableData.rows, sortColumn, sortDirection]);

  const handleSort = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
  };

  if (tableData.headers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {isStreaming ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Generating table...</span>
          </div>
        ) : (
          <span>No table data found</span>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 bg-gray-950">
      <table className="min-w-full border-collapse">
        <thead className="sticky top-0 bg-gray-900 z-10">
          <tr>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 border-b border-gray-700 w-12">
              #
            </th>
            {tableData.headers.map((header, idx) => (
              <th
                key={idx}
                onClick={() => handleSort(idx)}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-300 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>{header}</span>
                  {sortColumn === idx && (
                    sortDirection === 'asc' ? (
                      <ChevronUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-emerald-400" />
                    )
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="hover:bg-gray-900/50 transition-colors"
            >
              <td className="px-2 py-2 text-xs text-gray-600 border-b border-gray-800">
                {rowIdx + 1}
              </td>
              {tableData.headers.map((_, colIdx) => (
                <td
                  key={colIdx}
                  className="px-4 py-2 text-sm text-gray-300 border-b border-gray-800"
                >
                  {row[colIdx] || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Row count */}
      <div className="mt-4 text-center text-xs text-gray-500">
        {sortedRows.length} rows × {tableData.headers.length} columns
        {isStreaming && (
          <span className="ml-2 text-amber-500">• Streaming...</span>
        )}
      </div>
    </div>
  );
}

export default TableCanvas;
