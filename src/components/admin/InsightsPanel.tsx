'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  FileText,
  MessageSquare,
  Users,
  AlertCircle,
  Sparkles,
  Lightbulb,
  Check,
  X,
  Play,
  Wand2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import KnowledgeGapsPanel from './KnowledgeGapsPanel';

// Types
interface ActivityMetrics {
  logins: number;
  queries: number;
  uniqueUsers: number;
  failedLogins: number;
  totalQueries?: number;
  filteredCasual?: number;
  filteredRateLimited?: number;
}

interface KnowledgeGapSummary {
  question: string;
  count: number;
  avgScore: number;
}

interface Alert {
  _id: string;
  severity: 'critical' | 'warning';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface PromptSuggestion {
  _id: string;
  title: string;
  description: string;
  suggestedText: string;
  category: 'tone' | 'format' | 'scope' | 'constraints' | 'examples' | 'domain' | 'behavior';
  sourceQueries: string[];
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  reviewedBy?: { username: string } | null;
  reviewedAt?: string | null;
  appliedAt?: string | null;
  metrics?: {
    gapCountBefore: number;
    avgScoreBefore: number;
    effectivenessScore?: number | null;
  };
}

interface SuggestionStats {
  pending: number;
  approved: number;
  rejected: number;
  applied: number;
  avgEffectiveness: number | null;
}

interface InsightsReport {
  generatedAt: string;
  cached: boolean;
  activity: {
    today: ActivityMetrics;
    week: ActivityMetrics;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
  knowledgeGaps: {
    total: number;
    new: number;
    topGaps: KnowledgeGapSummary[];
    recommendations: string[];
  };
  alerts: Alert[];
  aiSummary: string;
}

const InsightsPanel: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [report, setReport] = useState<InsightsReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Prompt suggestions state
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [suggestionStats, setSuggestionStats] = useState<SuggestionStats | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [suggestionFilter, setSuggestionFilter] = useState<string>('pending');
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState<boolean>(true);

  // Fetch insights report
  const fetchInsights = useCallback(async (forceRefresh: boolean = false) => {
    if (!user || user.role !== 'admin') return;

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const endpoint = forceRefresh ? '/api/admin/insights?refresh=true' : '/api/admin/insights';
      const response = await fetchWithAuth(endpoint, { method: 'GET' });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        throw new Error(data.message || 'Invalid response structure.');
      }
    } catch (err) {
      console.error('[InsightsPanel] Error fetching insights:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errorMessage);
      toast({
        title: 'Error Fetching Insights',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Handle export
  const handleExport = async (type: 'audit' | 'gaps' | 'all', format: 'json' | 'csv', days: number = 7) => {
    try {
      const response = await fetchWithAuth(
        `/api/admin/insights/export?type=${type}&format=${format}&days=${days}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emtchat-${type}-${days}days.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export Successful',
        description: `Downloaded ${type} data as ${format.toUpperCase()}.`,
      });
    } catch (err) {
      console.error('[InsightsPanel] Export error:', err);
      toast({
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Could not export data.',
        variant: 'destructive',
      });
    }
  };

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetchWithAuth(`/api/admin/insights/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }

      // Refresh to get updated alerts
      fetchInsights();

      toast({
        title: 'Alert Acknowledged',
        description: 'The alert has been acknowledged.',
      });
    } catch (err) {
      console.error('[InsightsPanel] Error acknowledging alert:', err);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert.',
        variant: 'destructive',
      });
    }
  };

  // Fetch prompt suggestions
  const fetchSuggestions = useCallback(async (filter: string = 'pending') => {
    if (!user || user.role !== 'admin') return;

    setSuggestionsLoading(true);
    try {
      const statusParam = filter === 'all' ? '' : `status=${filter}`;
      const [suggestionsRes, statsRes] = await Promise.all([
        fetchWithAuth(`/api/admin/prompt-suggestions?${statusParam}`, { method: 'GET' }),
        fetchWithAuth('/api/admin/prompt-suggestions/stats', { method: 'GET' }),
      ]);

      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        if (data.success) {
          setSuggestions(data.suggestions || []);
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setSuggestionStats(statsData.stats || null);
        }
      }
    } catch (err) {
      console.error('[InsightsPanel] Error fetching suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [user]);

  // Fetch suggestions on mount and when filter changes
  useEffect(() => {
    fetchSuggestions(suggestionFilter);
  }, [fetchSuggestions, suggestionFilter]);

  // Handle filter change
  const handleFilterChange = (value: string) => {
    setSuggestionFilter(value);
  };

  // Generate suggestions from knowledge gaps
  const generateSuggestions = async () => {
    setIsGenerating(true);
    try {
      const response = await fetchWithAuth('/api/admin/prompt-suggestions/generate', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate suggestions' }));
        throw new Error(errorData.message);
      }

      const data = await response.json();
      toast({
        title: 'Suggestions Generated',
        description: `Generated ${data.generated} new suggestions from knowledge gaps.`,
      });

      // Refresh suggestions list - switch to pending to show new ones
      setSuggestionFilter('pending');
      fetchSuggestions('pending');
    } catch (err) {
      console.error('[InsightsPanel] Error generating suggestions:', err);
      toast({
        title: 'Generation Failed',
        description: err instanceof Error ? err.message : 'Could not generate suggestions.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Review (approve/reject) a suggestion
  const handleReviewSuggestion = async (suggestionId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      const response = await fetchWithAuth(`/api/admin/prompt-suggestions/${suggestionId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to review suggestion');
      }

      toast({
        title: status === 'approved' ? 'Suggestion Approved' : 'Suggestion Rejected',
        description: status === 'approved'
          ? 'The suggestion has been approved. You can now apply it to the system prompt.'
          : 'The suggestion has been rejected.',
      });

      fetchSuggestions(suggestionFilter);
    } catch (err) {
      console.error('[InsightsPanel] Error reviewing suggestion:', err);
      toast({
        title: 'Error',
        description: 'Failed to review suggestion.',
        variant: 'destructive',
      });
    }
  };

  // Apply an approved suggestion to the system prompt
  const handleApplySuggestion = async (suggestionId: string) => {
    try {
      const response = await fetchWithAuth(`/api/admin/prompt-suggestions/${suggestionId}/apply`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to apply suggestion' }));
        throw new Error(errorData.message);
      }

      toast({
        title: 'Suggestion Applied',
        description: 'The suggestion has been added to the system prompt. Check Settings to view the updated prompt.',
      });

      fetchSuggestions(suggestionFilter);
    } catch (err) {
      console.error('[InsightsPanel] Error applying suggestion:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to apply suggestion.',
        variant: 'destructive',
      });
    }
  };

  // Render trend icon
  const renderTrendIcon = (trend: 'up' | 'down' | 'stable', percentage: number) => {
    switch (trend) {
      case 'up':
        return (
          <span className="flex items-center text-green-600 dark:text-green-400 text-sm">
            <TrendingUp className="h-4 w-4 mr-1" />
            {percentage > 0 ? `+${percentage}%` : ''}
          </span>
        );
      case 'down':
        return (
          <span className="flex items-center text-red-600 dark:text-red-400 text-sm">
            <TrendingDown className="h-4 w-4 mr-1" />
            {percentage > 0 ? `-${percentage}%` : ''}
          </span>
        );
      default:
        return (
          <span className="flex items-center text-muted-foreground text-sm">
            <Minus className="h-4 w-4 mr-1" />
            Stable
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading insights...</span>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => fetchInsights()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No insights data available.</p>
      </div>
    );
  }

  const unacknowledgedAlerts = report.alerts.filter((a) => !a.acknowledged);

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Insights</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(report.generatedAt).toLocaleString()}
            {report.cached && ' (cached)'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInsights(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Audit Logs</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleExport('audit', 'csv', 7)}>
                <FileText className="h-4 w-4 mr-2" />
                Last 7 days (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('audit', 'csv', 30)}>
                <FileText className="h-4 w-4 mr-2" />
                Last 30 days (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('audit', 'json', 7)}>
                <FileText className="h-4 w-4 mr-2" />
                Last 7 days (JSON)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Export Knowledge Gaps</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleExport('gaps', 'csv', 90)}>
                <FileText className="h-4 w-4 mr-2" />
                All gaps (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('gaps', 'json', 90)}>
                <FileText className="h-4 w-4 mr-2" />
                All gaps (JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Activity Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <MessageSquare className="h-4 w-4 mr-1" />
              Business Queries Today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{report.activity.today.queries}</span>
              {renderTrendIcon(report.activity.trend, report.activity.trendPercentage)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {report.activity.week.queries} this week
              {report.activity.today.totalQueries && report.activity.today.totalQueries > report.activity.today.queries && (
                <span className="ml-1">
                  ({report.activity.today.totalQueries - report.activity.today.queries} filtered)
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              Active Users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{report.activity.today.uniqueUsers}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {report.activity.week.uniqueUsers} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1" />
              New Knowledge Gaps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{report.knowledgeGaps.new}</span>
              {report.knowledgeGaps.new > 0 && (
                <Badge variant="secondary">{report.knowledgeGaps.total} total</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Questions needing answers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-lg">
            <Sparkles className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{report.aiSummary}</p>
        </CardContent>
      </Card>

      {/* Knowledge Gaps - Full Management Panel */}
      <Card>
        <CardContent className="pt-6">
          <KnowledgeGapsPanel />
        </CardContent>
      </Card>

      {/* Prompt Suggestions Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center">
                <Lightbulb className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400" />
                Prompt Improvement Suggestions
                {suggestionStats?.pending && suggestionStats.pending > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {suggestionStats.pending} pending
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                AI-generated suggestions to improve the system prompt based on knowledge gaps
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSuggestionsCollapsed(!suggestionsCollapsed)}
              >
                {suggestionsCollapsed ? 'Show' : 'Hide'}
              </Button>
              {!suggestionsCollapsed && (
                <>
                  <Select value={suggestionFilter} onValueChange={handleFilterChange}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="applied">Applied</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateSuggestions}
                    disabled={isGenerating || report?.knowledgeGaps.total === 0}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Generate
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        {!suggestionsCollapsed && (
        <CardContent>
          {suggestionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No {suggestionFilter !== 'all' ? suggestionFilter : ''} suggestions{suggestionFilter !== 'all' ? '' : ' yet'}.</p>
              {suggestionFilter === 'pending' || suggestionFilter === 'all' ? (
                <p className="text-sm">
                  Click &quot;Generate&quot; to analyze knowledge gaps and get AI-powered improvement recommendations.
                </p>
              ) : (
                <p className="text-sm">
                  Try changing the filter to see other suggestions.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion._id}
                  className={`border rounded-lg p-4 ${
                    suggestion.status === 'approved'
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                      : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{suggestion.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.category}
                        </Badge>
                        <Badge
                          variant={
                            suggestion.priority === 'high'
                              ? 'destructive'
                              : suggestion.priority === 'medium'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {suggestion.priority}
                        </Badge>
                        <Badge
                          variant={suggestion.status === 'approved' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {suggestion.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {suggestion.description}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        <span>Confidence: {suggestion.confidence}%</span>
                        <span className="mx-2">•</span>
                        <span>Based on {suggestion.metrics?.gapCountBefore || 0} knowledge gaps</span>
                        {suggestion.metrics?.avgScoreBefore && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Avg score: {Math.round(suggestion.metrics.avgScoreBefore * 100)}%</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {suggestion.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleReviewSuggestion(suggestion._id, 'approved')}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleReviewSuggestion(suggestion._id, 'rejected')}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      {suggestion.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApplySuggestion(suggestion._id)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Apply to Prompt
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expandable suggested text */}
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs p-0 h-auto"
                      onClick={() =>
                        setExpandedSuggestion(
                          expandedSuggestion === suggestion._id ? null : suggestion._id
                        )
                      }
                    >
                      {expandedSuggestion === suggestion._id ? 'Hide' : 'Show'} suggested text
                    </Button>
                    {expandedSuggestion === suggestion._id && (
                      <div className="mt-2 p-3 bg-muted rounded-md">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {suggestion.suggestedText}
                        </pre>
                        {suggestion.sourceQueries.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-1">Related queries:</p>
                            <ul className="text-xs text-muted-foreground">
                              {suggestion.sourceQueries.slice(0, 3).map((query, idx) => (
                                <li key={idx} className="truncate">• {query}</li>
                              ))}
                              {suggestion.sourceQueries.length > 3 && (
                                <li className="text-muted-foreground/70">
                                  +{suggestion.sourceQueries.length - 3} more
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        )}
      </Card>

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            Recent Alerts
            {unacknowledgedAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unacknowledgedAlerts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.alerts.length === 0 ? (
            <div className="flex items-center text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>No alerts. Everything looks good!</span>
            </div>
          ) : (
            <div className="space-y-3">
              {report.alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert._id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    alert.acknowledged
                      ? 'bg-muted/50 border-muted'
                      : alert.severity === 'critical'
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {alert.severity === 'critical' ? (
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    )}
                    <div>
                      <p className={`text-sm ${alert.acknowledged ? 'text-muted-foreground' : ''}`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAcknowledgeAlert(alert._id)}
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InsightsPanel;
