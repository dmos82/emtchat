'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useAuth } from '@/hooks/useAuth';
import OpenAiApiConfig from './OpenAiApiConfig';
import ServerInfo from './ServerInfo';

interface OrphanSummary {
  namespaceCount: number;
  totalVectors: number;
  environment: string;
  namespaces: { name: string; vectorCount: number }[];
}

interface CleanupResult {
  success: boolean;
  dryRun: boolean;
  environment: string;
  indexName: string;
  totalNamespacesChecked: number;
  totalVectorsChecked: number;
  orphanedVectorsFound: number;
  orphanedVectorsDeleted: number;
  namespaceDetails: {
    namespace: string;
    vectorCount: number;
    orphanCount: number;
    deleted: boolean;
  }[];
  errors: string[];
  durationMs: number;
}

const SettingsManager: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pinecone cleanup state
  const [orphanSummary, setOrphanSummary] = useState<OrphanSummary | null>(null);
  const [isLoadingOrphans, setIsLoadingOrphans] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [lastCleanupResult, setLastCleanupResult] = useState<CleanupResult | null>(null);

  const fetchSystemPrompt = useCallback(async () => {
    if (!user || user.role !== 'admin') return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth('/api/settings/system-prompt', {
        method: 'GET',
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Failed to parse error response.' }));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (data.success && typeof data.prompt === 'string') {
        setSystemPrompt(data.prompt);
      } else {
        throw new Error(data.message || 'Invalid data structure for system prompt.');
      }
    } catch (error: any) {
      console.error('[SettingsManager] Failed to fetch system prompt:', error);
      setError(error.message);
      toast({
        title: 'Error Fetching System Prompt',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSystemPrompt();
  }, [fetchSystemPrompt]);

  // Pinecone cleanup functions
  const fetchOrphanSummary = useCallback(async () => {
    if (!user || user.role !== 'admin') return;

    setIsLoadingOrphans(true);
    try {
      const response = await fetchWithAuth('/api/admin/pinecone/orphan-summary', {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch orphan summary');
      }
      const data = await response.json();
      if (data.success) {
        setOrphanSummary(data.summary);
      }
    } catch (error: any) {
      console.error('[SettingsManager] Failed to fetch orphan summary:', error);
    } finally {
      setIsLoadingOrphans(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrphanSummary();
  }, [fetchOrphanSummary]);

  const handleScanOrphans = async () => {
    if (!user || user.role !== 'admin') return;

    setIsScanning(true);
    setLastCleanupResult(null);
    try {
      const response = await fetchWithAuth('/api/admin/pinecone/cleanup-orphans', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await response.json();
      if (data.success) {
        setLastCleanupResult(data.result);
        toast({
          title: 'Scan Complete',
          description: `Found ${data.result.orphanedVectorsFound} orphaned vectors`,
        });
      } else {
        throw new Error(data.message || 'Scan failed');
      }
    } catch (error: any) {
      console.error('[SettingsManager] Orphan scan failed:', error);
      toast({
        title: 'Scan Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteOrphans = async () => {
    if (!user || user.role !== 'admin') return;
    if (!lastCleanupResult || lastCleanupResult.orphanedVectorsFound === 0) {
      toast({
        title: 'No Orphans Found',
        description: 'Run a scan first to identify orphaned vectors',
        variant: 'destructive',
      });
      return;
    }

    // Confirm deletion
    if (!window.confirm(
      `Are you sure you want to delete ${lastCleanupResult.orphanedVectorsFound} orphaned vectors? This action cannot be undone.`
    )) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetchWithAuth('/api/admin/pinecone/cleanup-orphans', {
        method: 'POST',
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await response.json();
      if (data.success) {
        setLastCleanupResult(data.result);
        toast({
          title: 'Cleanup Complete',
          description: `Deleted ${data.result.orphanedVectorsDeleted} orphaned vectors`,
        });
        // Refresh summary
        fetchOrphanSummary();
      } else {
        throw new Error(data.message || 'Cleanup failed');
      }
    } catch (error: any) {
      console.error('[SettingsManager] Orphan cleanup failed:', error);
      toast({
        title: 'Cleanup Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveSystemPrompt = async () => {
    if (!systemPrompt.trim()) {
      toast({
        title: 'Validation Error',
        description: 'System prompt cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    if (!user || user.role !== 'admin') {
      toast({ title: 'Error', description: 'Unauthorized.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetchWithAuth('/api/settings/system-prompt', {
        method: 'PUT',
        body: JSON.stringify({ prompt: systemPrompt }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: 'Success', description: 'System prompt updated successfully.' });
        if (result.prompt) setSystemPrompt(result.prompt);
      } else {
        throw new Error(
          result.message || `Failed to save system prompt (Status: ${response.status})`
        );
      }
    } catch (error: any) {
      console.error('[SettingsManager] Error saving system prompt:', error);
      toast({ title: 'Error Saving Prompt', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Settings</h2>
        
        {/* System Prompt Section */}
        <div className="space-y-4 mb-8">
          <div>
            <Label htmlFor="system-prompt" className="text-lg font-semibold">
              System Prompt
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              This prompt is used to guide the AI's responses. It sets the context and behavior for all chat interactions.
            </p>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-destructive">
              <p>{error}</p>
              <Button variant="outline" className="mt-2" onClick={fetchSystemPrompt}>
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <Textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="Enter the system prompt..."
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveSystemPrompt}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save System Prompt'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* OpenAI API Configuration */}
        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-4">OpenAI API Configuration</h3>
          <OpenAiApiConfig />
        </div>

        {/* Server Information */}
        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-4">Server Information</h3>
          <ServerInfo />
        </div>

        {/* Pinecone Vector Maintenance */}
        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-4">Pinecone Vector Maintenance</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Scan for and remove orphaned vectors in Pinecone that no longer have corresponding documents in MongoDB.
            This can happen when documents are deleted directly from the database or when API failures occur during deletion.
          </p>

          {/* Summary Card */}
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            {isLoadingOrphans ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading Pinecone stats...</span>
              </div>
            ) : orphanSummary ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Environment:</span>
                  <span className="font-mono text-sm">{orphanSummary.environment}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Namespaces:</span>
                  <span>{orphanSummary.namespaceCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Vectors:</span>
                  <span>{orphanSummary.totalVectors.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to load Pinecone stats</p>
            )}
          </div>

          {/* Scan Result */}
          {lastCleanupResult && (
            <div className={`rounded-lg p-4 mb-4 ${
              lastCleanupResult.orphanedVectorsFound > 0
                ? 'bg-yellow-500/10 border border-yellow-500/20'
                : 'bg-green-500/10 border border-green-500/20'
            }`}>
              <div className="flex items-start gap-3">
                {lastCleanupResult.orphanedVectorsFound > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className="font-medium">
                    {lastCleanupResult.dryRun ? 'Scan Results' : 'Cleanup Results'}
                  </h4>
                  <div className="text-sm text-muted-foreground mt-1 space-y-1">
                    <p>Checked {lastCleanupResult.totalVectorsChecked.toLocaleString()} vectors across {lastCleanupResult.totalNamespacesChecked} namespaces</p>
                    <p>
                      {lastCleanupResult.dryRun
                        ? `Found ${lastCleanupResult.orphanedVectorsFound} orphaned vectors`
                        : `Deleted ${lastCleanupResult.orphanedVectorsDeleted} orphaned vectors`
                      }
                    </p>
                    <p className="text-xs">Duration: {(lastCleanupResult.durationMs / 1000).toFixed(1)}s</p>
                  </div>

                  {/* Namespace Details */}
                  {lastCleanupResult.namespaceDetails.filter(n => n.orphanCount > 0).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm cursor-pointer hover:underline">
                        Show affected namespaces
                      </summary>
                      <ul className="text-xs mt-1 space-y-1 ml-2">
                        {lastCleanupResult.namespaceDetails
                          .filter(n => n.orphanCount > 0)
                          .map((ns, idx) => (
                            <li key={idx} className="font-mono">
                              {ns.namespace}: {ns.orphanCount} orphans
                              {ns.deleted && <span className="text-green-500 ml-1">(deleted)</span>}
                            </li>
                          ))
                        }
                      </ul>
                    </details>
                  )}

                  {lastCleanupResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-500">
                      Errors: {lastCleanupResult.errors.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleScanOrphans}
              disabled={isScanning || isDeleting}
            >
              {isScanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Scan for Orphans
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              onClick={handleDeleteOrphans}
              disabled={
                isScanning ||
                isDeleting ||
                !lastCleanupResult ||
                lastCleanupResult.orphanedVectorsFound === 0
              }
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Orphans
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Recommended: Run weekly to keep your vector database clean.
            This is safe to run - it only removes vectors that reference non-existent documents.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsManager;