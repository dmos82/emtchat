'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  primary?: boolean; // Show in collapsed card header
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface ResponsiveTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  actions?: (row: Record<string, unknown>) => React.ReactNode;
}

export function ResponsiveTable({ columns, data, actions }: ResponsiveTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const primaryColumns = columns.filter(c => c.primary);
  const secondaryColumns = columns.filter(c => !c.primary);

  const renderCell = (col: Column, row: Record<string, unknown>) => {
    if (col.render) {
      return col.render(row[col.key], row);
    }
    return String(row[col.key] ?? '');
  };

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {columns.map(col => (
                <th key={col.key} className="text-left p-3 font-medium">
                  {col.label}
                </th>
              ))}
              {actions && <th className="text-right p-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b hover:bg-muted/50">
                {columns.map(col => (
                  <td key={col.key} className="p-3">
                    {renderCell(col, row)}
                  </td>
                ))}
                {actions && (
                  <td className="p-3 text-right">
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {data.map((row, i) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleRow(i)}
              className="w-full p-3 flex items-center justify-between bg-card hover:bg-muted/50"
            >
              <div className="flex-1 text-left">
                {primaryColumns.map(col => (
                  <div key={col.key} className="font-medium">
                    {renderCell(col, row)}
                  </div>
                ))}
              </div>
              {expandedRows.has(i) ? (
                <ChevronUp className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              )}
            </button>
            {expandedRows.has(i) && (
              <div className="p-3 border-t bg-muted/30 space-y-2">
                {secondaryColumns.map(col => (
                  <div key={col.key} className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground">{col.label}</span>
                    <span className="text-right">{renderCell(col, row)}</span>
                  </div>
                ))}
                {actions && (
                  <div className="pt-2 border-t mt-2">
                    {actions(row)}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
