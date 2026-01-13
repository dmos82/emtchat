'use client';

import React, { useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { cn } from '@/lib/utils';
import { AlertCircle, BarChart3, Sparkles } from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartCanvasProps {
  content: string;
  isStreaming: boolean;
}

interface ChartData {
  chartType?: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  title?: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
  }[];
}

// Default color palette for charts
const DEFAULT_COLORS = [
  'rgba(59, 130, 246, 0.7)',   // Blue
  'rgba(16, 185, 129, 0.7)',   // Green
  'rgba(249, 115, 22, 0.7)',   // Orange
  'rgba(139, 92, 246, 0.7)',   // Purple
  'rgba(236, 72, 153, 0.7)',   // Pink
  'rgba(245, 158, 11, 0.7)',   // Amber
  'rgba(6, 182, 212, 0.7)',    // Cyan
  'rgba(239, 68, 68, 0.7)',    // Red
];

const DEFAULT_BORDER_COLORS = [
  'rgba(59, 130, 246, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(249, 115, 22, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(6, 182, 212, 1)',
  'rgba(239, 68, 68, 1)',
];

// Chart skeleton loader for enterprise-quality loading state
const ChartSkeletonLoader: React.FC = () => (
  <div className="h-full w-full p-6 flex flex-col">
    {/* Title skeleton */}
    <div className="flex items-center gap-3 mb-6">
      <div className="h-6 w-6 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
      <div className="h-5 w-40 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
    </div>

    {/* Chart area skeleton */}
    <div className="flex-1 flex items-end justify-around gap-4 pb-8 border-b border-muted">
      {/* Bar chart skeleton with varying heights */}
      {[65, 85, 45, 70, 90, 55, 75].map((height, i) => (
        <div
          key={i}
          className="flex-1 max-w-16 rounded-t bg-gradient-to-t from-blue-900/50 via-blue-800/30 to-transparent animate-shimmer"
          style={{
            height: `${height}%`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>

    {/* X-axis labels skeleton */}
    <div className="flex justify-around gap-4 pt-3">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className="h-3 w-12 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>

    {/* Legend skeleton */}
    <div className="flex justify-center gap-6 mt-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
          <div
            className="h-3 w-16 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        </div>
      ))}
    </div>
  </div>
);

function parseChartData(content: string): ChartData | null {
  if (!content || content.trim() === '') return null;

  try {
    // Try to parse as JSON
    const data = JSON.parse(content);

    // Validate required fields
    if (!data.labels || !Array.isArray(data.labels)) {
      return null;
    }
    if (!data.datasets || !Array.isArray(data.datasets)) {
      return null;
    }

    // Apply default colors if not provided
    data.datasets = data.datasets.map((dataset: ChartData['datasets'][0], index: number) => {
      const colorIndex = index % DEFAULT_COLORS.length;

      // For pie/doughnut, we need an array of colors (one per data point)
      const isPieType = data.chartType === 'pie' || data.chartType === 'doughnut';

      return {
        ...dataset,
        backgroundColor: dataset.backgroundColor || (isPieType
          ? data.labels.map((_: string, i: number) => DEFAULT_COLORS[i % DEFAULT_COLORS.length])
          : DEFAULT_COLORS[colorIndex]),
        borderColor: dataset.borderColor || (isPieType
          ? data.labels.map((_: string, i: number) => DEFAULT_BORDER_COLORS[i % DEFAULT_BORDER_COLORS.length])
          : DEFAULT_BORDER_COLORS[colorIndex]),
        borderWidth: dataset.borderWidth ?? 2,
      };
    });

    return data as ChartData;
  } catch {
    return null;
  }
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  content,
  isStreaming,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => parseChartData(content), [content]);

  // Common chart options
  const commonOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgb(156, 163, 175)', // text-gray-400
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
        },
      },
      title: {
        display: !!chartData?.title,
        text: chartData?.title || '',
        color: 'rgb(229, 231, 235)', // text-gray-200
        font: {
          size: 16,
          weight: 'bold' as const,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'rgb(255, 255, 255)',
        bodyColor: 'rgb(229, 231, 235)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
    scales: chartData?.chartType === 'pie' || chartData?.chartType === 'doughnut' ? undefined : {
      x: {
        ticks: {
          color: 'rgb(156, 163, 175)',
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
      },
      y: {
        ticks: {
          color: 'rgb(156, 163, 175)',
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
      },
    },
  }), [chartData?.title, chartData?.chartType]);

  // Determine which layer to show - show skeleton immediately when streaming with no data
  const showSkeleton = isStreaming && !chartData;
  const showError = !isStreaming && !chartData && content;
  const showChart = !!chartData;

  const chartJsData = chartData ? {
    labels: chartData.labels,
    datasets: chartData.datasets,
  } : { labels: [], datasets: [] };

  const chartType = chartData?.chartType || 'bar';

  // Always render the same DOM structure - use CSS to show/hide layers
  return (
    <div className="h-full w-full bg-card relative">
      {/* Layer 1: Skeleton (when streaming with no valid data, after delay) */}
      <div
        className={cn(
          "absolute inset-0 bg-card transition-opacity duration-150 z-10",
          showSkeleton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2 px-6 pt-4 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />
          <span className="text-sm animate-pulse">AI is generating chart...</span>
        </div>
        <ChartSkeletonLoader />
      </div>

      {/* Layer 2: Error state (invalid data) */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center p-6 transition-opacity duration-100",
          showError ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
          <div className="mb-2 text-red-400">Invalid chart data</div>
          <div className="text-xs max-w-md">
            Chart content must be valid JSON with &quot;labels&quot; and &quot;datasets&quot; arrays.
          </div>
          {content && (
            <pre className="mt-4 p-2 bg-muted rounded text-xs text-left overflow-auto max-h-32">
              {content.slice(0, 500)}{content.length > 500 ? '...' : ''}
            </pre>
          )}
        </div>
      </div>

      {/* Layer 3: Chart (when we have valid data) */}
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 p-6 chart-canvas-container transition-opacity duration-100",
          showChart ? "opacity-100" : "opacity-0 pointer-events-none",
          isStreaming && "animate-pulse-subtle"
        )}
      >
        <div className="h-full w-full min-h-[300px]">
          {chartType === 'bar' && chartData && (
            <Bar data={chartJsData} options={commonOptions} />
          )}
          {chartType === 'line' && chartData && (
            <Line data={chartJsData} options={commonOptions} />
          )}
          {chartType === 'area' && chartData && (
            <Line
              data={{
                ...chartJsData,
                datasets: chartJsData.datasets.map(ds => ({ ...ds, fill: true })),
              }}
              options={commonOptions}
            />
          )}
          {chartType === 'pie' && chartData && (
            <Pie data={chartJsData} options={commonOptions} />
          )}
          {chartType === 'doughnut' && chartData && (
            <Doughnut data={chartJsData} options={commonOptions} />
          )}
        </div>
        {isStreaming && (
          <div className="mt-2 text-center text-xs text-amber-500">
            Chart may update as AI continues...
          </div>
        )}
      </div>
    </div>
  );
};
