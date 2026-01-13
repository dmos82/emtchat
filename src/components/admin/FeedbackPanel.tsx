'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trash2, ThumbsUp, ThumbsDown, TrendingUp, BarChart3, MessageSquare, RefreshCw, ChevronDown, ChevronRight, FileText, Database } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { cn } from '@/lib/utils';

interface FeedbackEntry {
  _id: string;
  feedbackText: string;
  userId: string;
  username: string;
  chatId?: string;
  createdAt: string;
}

interface VoteEntry {
  _id: string;
  messageId: string;
  voteType: 'like' | 'dislike';
  reasons?: string[];
  comment?: string;
  messageContent: string;
  userQuery: string;
  searchMode: string;
  ragSources?: string[];
  userId: { _id: string; username: string } | string;
  createdAt: string;
}

interface VoteStats {
  totalLikes: number;
  totalDislikes: number;
  likeRatio: number;
  likesInRange: number;
  dislikesInRange: number;
  topReasons: { reason: string; count: number }[];
  trends: { date: string; likes: number; dislikes: number }[];
}

const FeedbackPanel: React.FC = () => {
  // Text Feedback state
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Votes state
  const [votes, setVotes] = useState<VoteEntry[]>([]);
  const [voteStats, setVoteStats] = useState<VoteStats | null>(null);
  const [isLoadingVotes, setIsLoadingVotes] = useState(true);
  const [votesError, setVotesError] = useState<string | null>(null);
  const [voteFilter, setVoteFilter] = useState<'all' | 'like' | 'dislike'>('all');
  const [votePage, setVotePage] = useState(1);
  const [totalVotePages, setTotalVotePages] = useState(1);
  const [statsTimeRange, setStatsTimeRange] = useState(30);
  const [expandedVotes, setExpandedVotes] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  // Fetch vote statistics
  const fetchVoteStats = async () => {
    try {
      const response = await fetchWithAuth(`/api/admin/feedback/votes/stats?days=${statsTimeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vote stats');
      }
      const data = await response.json();
      if (data.success) {
        setVoteStats(data.stats);
      }
    } catch (err: any) {
      console.error('[FeedbackPanel] Error fetching vote stats:', err);
    }
  };

  // Fetch votes list
  const fetchVotes = async (page = 1, filter = voteFilter) => {
    setIsLoadingVotes(true);
    setVotesError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (filter !== 'all') {
        params.append('voteType', filter);
      }

      const response = await fetchWithAuth(`/api/admin/feedback/votes?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch votes');
      }
      const data = await response.json();
      if (data.success) {
        setVotes(data.votes);
        setTotalVotePages(data.pagination?.pages || 1);
        setVotePage(page);
      }
    } catch (err: any) {
      console.error('[FeedbackPanel] Error fetching votes:', err);
      setVotesError(err.message || 'Failed to load votes');
    } finally {
      setIsLoadingVotes(false);
    }
  };

  // Fetch text feedback data
  const fetchFeedback = async () => {
    setIsLoadingFeedback(true);
    setFeedbackError(null);

    try {
      const response = await fetchWithAuth('/api/admin/feedback', {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.feedback)) {
        setFeedback(data.feedback);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      console.error('[FeedbackPanel] Error fetching feedback:', err);
      setFeedbackError(err.message || 'Failed to load feedback');
      toast({
        title: 'Error Loading Feedback',
        description: err.message || 'Could not load feedback data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  // Delete a specific feedback entry
  const handleDeleteFeedback = async (feedbackId: string) => {
    setIsDeletingItem(feedbackId);

    try {
      const response = await fetchWithAuth(`/api/admin/feedback/${feedbackId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }

      setFeedback(prevFeedback => prevFeedback.filter(item => item._id !== feedbackId));

      toast({
        title: 'Feedback Deleted',
        description: 'The feedback entry has been deleted successfully.',
      });
    } catch (err: any) {
      console.error(`[FeedbackPanel] Error deleting feedback ${feedbackId}:`, err);
      toast({
        title: 'Error Deleting Feedback',
        description: err.message || 'Could not delete the feedback entry. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingItem(null);
    }
  };

  // Delete all feedback entries
  const handleDeleteAllFeedback = async () => {
    setIsDeletingAll(true);

    try {
      const response = await fetchWithAuth('/api/admin/feedback', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }

      setFeedback([]);

      toast({
        title: 'All Feedback Deleted',
        description: 'All feedback entries have been deleted successfully.',
      });
    } catch (err: any) {
      console.error('[FeedbackPanel] Error deleting all feedback:', err);
      toast({
        title: 'Error Deleting All Feedback',
        description: err.message || 'Could not delete all feedback entries. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchFeedback();
    fetchVoteStats();
    fetchVotes();
  }, []);

  // Refetch votes when filter changes
  useEffect(() => {
    fetchVotes(1, voteFilter);
  }, [voteFilter]);

  // Refetch stats when time range changes
  useEffect(() => {
    fetchVoteStats();
  }, [statsTimeRange]);

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get username from vote entry
  const getUsername = (vote: VoteEntry) => {
    if (typeof vote.userId === 'object' && vote.userId?.username) {
      return vote.userId.username;
    }
    return 'Unknown';
  };

  // Toggle vote expansion
  const toggleVoteExpand = (voteId: string) => {
    setExpandedVotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(voteId)) {
        newSet.delete(voteId);
      } else {
        newSet.add(voteId);
      }
      return newSet;
    });
  };

  // Reason labels for display
  const reasonLabels: Record<string, string> = {
    inaccurate: 'Inaccurate',
    not_helpful: 'Not Helpful',
    off_topic: 'Off-topic',
    other: 'Other',
  };

  // Render stats cards
  const renderStatsCards = () => {
    if (!voteStats) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Likes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{voteStats.totalLikes}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Dislikes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{voteStats.totalDislikes}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className={cn("h-5 w-5", voteStats.likeRatio >= 80 ? "text-green-500" : voteStats.likeRatio >= 60 ? "text-yellow-500" : "text-red-500")} />
              <span className="text-2xl font-bold">{voteStats.likeRatio}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last {statsTimeRange} Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <span className="text-lg">
                <span className="text-green-600">+{voteStats.likesInRange}</span>
                {' / '}
                <span className="text-red-600">-{voteStats.dislikesInRange}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render top reasons
  const renderTopReasons = () => {
    if (!voteStats || voteStats.topReasons.length === 0) {
      return null;
    }

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Dislike Reasons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {voteStats.topReasons.map((item) => (
              <div key={item.reason} className="flex items-center justify-between">
                <span className="text-sm">{reasonLabels[item.reason] || item.reason}</span>
                <span className="text-sm font-medium text-muted-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Vote Stats
          </TabsTrigger>
          <TabsTrigger value="votes" className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4" />
            Votes ({votes.length})
          </TabsTrigger>
          <TabsTrigger value="text" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Text Feedback ({feedback.length})
          </TabsTrigger>
        </TabsList>

        {/* Vote Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Vote Analytics</h3>
            <div className="flex items-center gap-2">
              <Select
                value={statsTimeRange.toString()}
                onValueChange={(val) => setStatsTimeRange(parseInt(val))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => fetchVoteStats()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {renderStatsCards()}
          {renderTopReasons()}
        </TabsContent>

        {/* Votes List Tab */}
        <TabsContent value="votes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Message Votes</h3>
            <div className="flex items-center gap-2">
              <Select
                value={voteFilter}
                onValueChange={(val: 'all' | 'like' | 'dislike') => setVoteFilter(val)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Votes</SelectItem>
                  <SelectItem value="like">Likes Only</SelectItem>
                  <SelectItem value="dislike">Dislikes Only</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => fetchVotes(votePage, voteFilter)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoadingVotes ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : votesError ? (
            <div className="p-4 text-center text-destructive">
              <p>{votesError}</p>
              <Button variant="outline" className="mt-2" onClick={() => fetchVotes()}>
                Try Again
              </Button>
            </div>
          ) : votes.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <p>No votes recorded yet.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {votes.map(vote => {
                  const isExpanded = expandedVotes.has(vote._id);
                  return (
                    <div
                      key={vote._id}
                      className={cn(
                        "border rounded-lg transition-all",
                        vote.voteType === 'dislike' ? "border-red-200 dark:border-red-900/50" : "border-green-200 dark:border-green-900/50"
                      )}
                    >
                      {/* Collapsed Header - Click to expand */}
                      <button
                        onClick={() => toggleVoteExpand(vote._id)}
                        className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {vote.voteType === 'like' ? (
                          <ThumbsUp className="h-4 w-4 shrink-0 text-green-500" />
                        ) : (
                          <ThumbsDown className="h-4 w-4 shrink-0 text-red-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            Q: {vote.userQuery}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>{getUsername(vote)}</span>
                            <span>•</span>
                            <span>{formatDate(vote.createdAt)}</span>
                            {vote.reasons && vote.reasons.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-red-500">{vote.reasons.length} reason(s)</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-muted">
                          {/* User Question */}
                          <div className="mt-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                              <MessageSquare className="h-3 w-3" />
                              User Question
                            </div>
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-sm">
                              {vote.userQuery}
                            </div>
                          </div>

                          {/* AI Response */}
                          <div>
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                              <FileText className="h-3 w-3" />
                              AI Response
                            </div>
                            <div className={cn(
                              "p-2 rounded text-sm max-h-[200px] overflow-y-auto",
                              vote.voteType === 'dislike'
                                ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50"
                                : "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50"
                            )}>
                              <div className="whitespace-pre-wrap">{vote.messageContent || 'No response content captured'}</div>
                            </div>
                          </div>

                          {/* Dislike Reasons */}
                          {vote.voteType === 'dislike' && vote.reasons && vote.reasons.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Reasons</div>
                              <div className="flex flex-wrap gap-1">
                                {vote.reasons.map(reason => (
                                  <span
                                    key={reason}
                                    className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded"
                                  >
                                    {reasonLabels[reason] || reason}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* User Comment */}
                          {vote.comment && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">User Comment</div>
                              <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded text-sm italic border border-yellow-200 dark:border-yellow-900/50">
                                "{vote.comment}"
                              </div>
                            </div>
                          )}

                          {/* RAG Sources */}
                          {vote.ragSources && vote.ragSources.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                                <Database className="h-3 w-3" />
                                RAG Sources Used ({vote.ragSources.length})
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {vote.ragSources.map((source, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs px-2 py-1 bg-muted rounded truncate max-w-[200px]"
                                    title={source}
                                  >
                                    {source}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="pt-2 border-t border-muted flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Mode: {vote.searchMode}</span>
                            <span>ID: {vote.messageId.substring(0, 8)}...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalVotePages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={votePage === 1}
                    onClick={() => fetchVotes(votePage - 1, voteFilter)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {votePage} of {totalVotePages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={votePage === totalVotePages}
                    onClick={() => fetchVotes(votePage + 1, voteFilter)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Text Feedback Tab */}
        <TabsContent value="text" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Text Feedback</h3>
            {feedback.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeletingAll || isLoadingFeedback}>
                    {isDeletingAll ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Feedback?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all
                      <strong> ({feedback.length}) </strong>
                      feedback entries from the database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingAll}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllFeedback}
                      disabled={isDeletingAll}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isDeletingAll ? 'Deleting...' : 'Confirm Delete All'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {isLoadingFeedback ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : feedbackError ? (
            <div className="p-4 text-center text-destructive">
              <p>{feedbackError}</p>
              <Button variant="outline" className="mt-2" onClick={fetchFeedback}>
                Try Again
              </Button>
            </div>
          ) : feedback.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <p>No text feedback has been submitted yet.</p>
            </div>
          ) : (
            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Feedback</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.map(item => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium max-w-md">
                        <div className="whitespace-normal break-words">{item.feedbackText}</div>
                      </TableCell>
                      <TableCell>{item.username}</TableCell>
                      <TableCell>{formatDate(item.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFeedback(item._id)}
                          disabled={isDeletingItem === item._id}
                          className="text-destructive hover:text-destructive/80"
                        >
                          {isDeletingItem === item._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedbackPanel;
