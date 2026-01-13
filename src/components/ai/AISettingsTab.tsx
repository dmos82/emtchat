'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
  Loader2,
  Cloud,
  Server,
  Combine,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  HardDrive,
  Download,
  Trash2,
  Database,
  FileText,
  Play,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type AIMode = 'cloud' | 'local' | 'hybrid';

interface LocalConfig {
  ollamaBaseUrl: string;
  chatModel: string;
  embeddingModel: string;
  temperature: number;
  maxTokens: number;
}

interface OllamaModel {
  name: string;
  size: string;
  family: string;
  parameterSize: string;
  category: 'chat' | 'code' | 'embedding' | 'vision' | 'unknown';
  recommended: boolean;
}

interface AIPreferences {
  aiMode: AIMode;
  localConfig: LocalConfig;
  fallbackEnabled: boolean;
}

interface OllamaStatus {
  status: 'healthy' | 'unhealthy';
  version?: string;
  modelsCount?: number;
  error?: string;
}

interface SyncStatus {
  systemKB: {
    total: number;
    synced: number;
    pending: number;
    failed: number;
    lastSyncAt?: string;
  };
  userDocs: {
    total: number;
    synced: number;
    pending: number;
    failed: number;
    lastSyncAt?: string;
  };
  localStorageUsed: string;
  chromaDBStatus: 'connected' | 'disconnected' | 'unknown';
  isSyncing: boolean;
}

interface SyncProgress {
  phase: 'preparing' | 'downloading' | 'extracting' | 'embedding' | 'storing' | 'complete' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AISettingsTab() {
  const { toast } = useToast();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(false);

  // AI Preferences
  const [aiMode, setAiMode] = useState<AIMode>('cloud');
  const [localConfig, setLocalConfig] = useState<LocalConfig>({
    ollamaBaseUrl: 'http://localhost:11434',
    chatModel: 'llama3.2:3b',
    embeddingModel: 'nomic-embed-text',
    temperature: 0.7,
    maxTokens: 4096,
  });
  const [fallbackEnabled, setFallbackEnabled] = useState(true);

  // Ollama Status
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [chatModels, setChatModels] = useState<OllamaModel[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<OllamaModel[]>([]);

  // Local Document Sync
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isStartingSync, setIsStartingSync] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadPreferences = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/users/me/ai-preferences');
      if (response.ok) {
        const data = await response.json();
        setAiMode(data.preferences.aiMode);
        setLocalConfig(data.preferences.localConfig);
        setFallbackEnabled(data.preferences.fallbackEnabled);
        setFeatureEnabled(data.features?.localAiMode || false);
      }
    } catch (error) {
      console.error('Error loading AI preferences:', error);
    }
  }, []);

  const checkOllamaStatus = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/ai/ollama/status');
      if (response.ok) {
        const data = await response.json();
        setOllamaStatus({
          status: data.status,
          version: data.version,
          modelsCount: data.modelsCount,
          error: data.error,
        });
      }
    } catch (error) {
      setOllamaStatus({
        status: 'unhealthy',
        error: 'Failed to check Ollama status',
      });
    }
  }, []);

  const loadOllamaModels = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/ai/ollama/models');
      if (response.ok) {
        const data = await response.json();
        setChatModels(data.chatModels || []);
        setEmbeddingModels(data.embeddingModels || []);
      }
    } catch (error) {
      console.error('Error loading Ollama models:', error);
    }
  }, []);

  const loadSyncStatus = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/local-sync/status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data.data);
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadPreferences(), checkOllamaStatus(), loadOllamaModels(), loadSyncStatus()]);
      setIsLoading(false);
    };
    init();
  }, [loadPreferences, checkOllamaStatus, loadOllamaModels, loadSyncStatus]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetchWithAuth('/api/users/me/ai-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiMode,
          localConfig,
          fallbackEnabled,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Settings saved',
          description: 'Your AI preferences have been updated.',
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save settings');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save AI settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await fetchWithAuth('/api/ai/ollama/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localConfig.chatModel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Connection successful',
          description: `Response in ${data.duration}: "${data.response.substring(0, 50)}..."`,
        });
      } else {
        throw new Error(data.message || 'Test failed');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Connection test failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Ollama',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleRefreshStatus = async () => {
    await Promise.all([checkOllamaStatus(), loadOllamaModels(), loadSyncStatus()]);
    toast({
      title: 'Status refreshed',
      description: 'Ollama and sync status have been updated.',
    });
  };

  // ============================================================================
  // Sync Handlers
  // ============================================================================

  const handleStartSync = async () => {
    setIsStartingSync(true);
    try {
      const response = await fetchWithAuth('/api/local-sync/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeSystemKB: true,
          includeUserDocs: true,
          forceResync: false,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Sync started',
          description: 'Documents are being synced to local storage.',
        });

        // Start listening for progress updates via SSE
        const eventSource = new EventSource('/api/local-sync/progress');

        eventSource.onmessage = (event) => {
          const progress = JSON.parse(event.data) as SyncProgress;
          setSyncProgress(progress);

          if (progress.phase === 'complete') {
            eventSource.close();
            setSyncProgress(null);
            loadSyncStatus();
            toast({
              title: 'Sync complete',
              description: `Successfully synced ${progress.total} documents.`,
            });
          } else if (progress.phase === 'error') {
            eventSource.close();
            setSyncProgress(null);
            loadSyncStatus();
            toast({
              variant: 'destructive',
              title: 'Sync failed',
              description: progress.error || 'An error occurred during sync.',
            });
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setSyncProgress(null);
          loadSyncStatus();
        };
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start sync');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to start sync',
      });
    } finally {
      setIsStartingSync(false);
    }
  };

  const handleStopSync = async () => {
    try {
      const response = await fetchWithAuth('/api/local-sync/stop', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Sync stopped',
          description: 'Document sync has been stopped.',
        });
        setSyncProgress(null);
        await loadSyncStatus();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Stop failed',
        description: 'Failed to stop sync',
      });
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the local cache? This will remove all synced documents.')) {
      return;
    }

    setIsClearingCache(true);
    try {
      const response = await fetchWithAuth('/api/local-sync/clear', {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Cache cleared',
          description: `Removed ${data.data.deletedFiles} files, freed ${formatBytes(data.data.freedBytes)}.`,
        });
        await loadSyncStatus();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clear cache');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Clear failed',
        description: error instanceof Error ? error.message : 'Failed to clear cache',
      });
    } finally {
      setIsClearingCache(false);
    }
  };

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper to get phase label
  const getPhaseLabel = (phase: SyncProgress['phase']): string => {
    switch (phase) {
      case 'preparing':
        return 'Preparing...';
      case 'downloading':
        return 'Downloading...';
      case 'extracting':
        return 'Extracting text...';
      case 'embedding':
        return 'Creating embeddings...';
      case 'storing':
        return 'Storing vectors locally...';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      default:
        return 'Processing...';
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Feature not enabled
  if (!featureEnabled) {
    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <div>
            <p className="font-medium text-amber-600 dark:text-amber-400">Feature Not Enabled</p>
            <p className="text-sm text-muted-foreground">
              Local AI Mode is not enabled for this instance. Contact your administrator to enable
              it.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-muted/50">
          <h4 className="font-medium mb-2">Current Mode</h4>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            <span>Cloud AI (OpenAI + Pinecone)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      {/* AI Mode Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">AI Mode</h3>
        <p className="text-sm text-muted-foreground">
          Choose how you want to process AI requests.
        </p>

        <div className="grid gap-3">
          {/* Cloud Mode */}
          <button
            type="button"
            onClick={() => setAiMode('cloud')}
            className={cn(
              'flex items-start gap-4 p-4 rounded-lg border text-left transition-colors',
              aiMode === 'cloud'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            <Cloud
              className={cn('h-6 w-6 mt-0.5', aiMode === 'cloud' ? 'text-blue-500' : 'text-muted-foreground')}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Cloud</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  Default
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                OpenAI + Pinecone. Best accuracy, requires internet.
              </p>
            </div>
            {aiMode === 'cloud' && <CheckCircle2 className="h-5 w-5 text-blue-500" />}
          </button>

          {/* Local Mode */}
          <button
            type="button"
            onClick={() => setAiMode('local')}
            className={cn(
              'flex items-start gap-4 p-4 rounded-lg border text-left transition-colors',
              aiMode === 'local'
                ? 'border-green-500 bg-green-500/10'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            <Server
              className={cn('h-6 w-6 mt-0.5', aiMode === 'local' ? 'text-green-500' : 'text-muted-foreground')}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Local</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Private
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Ollama + Local Vectors. 100% local, no data leaves your machine.
              </p>
            </div>
            {aiMode === 'local' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </button>

          {/* Hybrid Mode */}
          <button
            type="button"
            onClick={() => setAiMode('hybrid')}
            className={cn(
              'flex items-start gap-4 p-4 rounded-lg border text-left transition-colors',
              aiMode === 'hybrid'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            <Combine
              className={cn('h-6 w-6 mt-0.5', aiMode === 'hybrid' ? 'text-purple-500' : 'text-muted-foreground')}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Hybrid</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  Best of Both
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Local LLM + Cloud RAG. Fast local responses with cloud search.
              </p>
            </div>
            {aiMode === 'hybrid' && <CheckCircle2 className="h-5 w-5 text-purple-500" />}
          </button>
        </div>
      </div>

      {/* Ollama Status */}
      {(aiMode === 'local' || aiMode === 'hybrid') && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Local AI Status</h3>
            <Button variant="ghost" size="sm" onClick={handleRefreshStatus}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>

          <div
            className={cn(
              'flex items-center gap-3 p-4 rounded-lg border',
              ollamaStatus?.status === 'healthy'
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-red-500/10 border-red-500/20'
            )}
          >
            {ollamaStatus?.status === 'healthy' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-600 dark:text-green-400">Ollama Connected</p>
                  <p className="text-sm text-muted-foreground">
                    Version {ollamaStatus.version} • {ollamaStatus.modelsCount} models available
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">Ollama Not Connected</p>
                  <p className="text-sm text-muted-foreground">
                    {ollamaStatus?.error || 'Please start Ollama on your machine'}
                  </p>
                </div>
              </>
            )}
          </div>

          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTestingConnection || ollamaStatus?.status !== 'healthy'}
            className="w-full"
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      )}

      {/* Model Selection */}
      {(aiMode === 'local' || aiMode === 'hybrid') && ollamaStatus?.status === 'healthy' && (
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-medium">Model Settings</h3>

          {/* Chat Model */}
          <div className="space-y-2">
            <Label htmlFor="chat-model">Chat Model</Label>
            <Select
              value={localConfig.chatModel}
              onValueChange={(value) => setLocalConfig((prev) => ({ ...prev, chatModel: value }))}
            >
              <SelectTrigger id="chat-model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {chatModels.map((model) => (
                  <SelectItem key={model.name} value={model.name}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      <span className="text-xs text-muted-foreground">({model.size})</span>
                      {model.recommended && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                          Recommended
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground">{localConfig.temperature}</span>
            </div>
            <Slider
              value={[localConfig.temperature]}
              onValueChange={(values: number[]) => setLocalConfig((prev) => ({ ...prev, temperature: values[0] }))}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Lower = more focused, Higher = more creative
            </p>
          </div>

          {/* Fallback Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div>
              <p className="font-medium">Fallback to Cloud</p>
              <p className="text-sm text-muted-foreground">
                Use cloud AI if local is unavailable
              </p>
            </div>
            <Switch checked={fallbackEnabled} onCheckedChange={setFallbackEnabled} />
          </div>
        </div>
      )}

      {/* Local Document Sync - Only for Local mode */}
      {aiMode === 'local' && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-medium">Local Document Sync</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={loadSyncStatus}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Sync your documents to local storage for 100% offline AI. Documents are re-embedded using local models.
          </p>

          {/* Sync Status Cards */}
          {syncStatus && (
            <div className="grid grid-cols-2 gap-3">
              {/* System KB */}
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">System KB</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Synced:</span>
                    <span className="text-green-600 dark:text-green-400">{syncStatus.systemKB.synced}/{syncStatus.systemKB.total}</span>
                  </div>
                  {syncStatus.systemKB.pending > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending:</span>
                      <span className="text-amber-600 dark:text-amber-400">{syncStatus.systemKB.pending}</span>
                    </div>
                  )}
                  {syncStatus.systemKB.failed > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed:</span>
                      <span className="text-red-600 dark:text-red-400">{syncStatus.systemKB.failed}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* User Docs */}
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Your Docs</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Synced:</span>
                    <span className="text-green-600 dark:text-green-400">{syncStatus.userDocs.synced}/{syncStatus.userDocs.total}</span>
                  </div>
                  {syncStatus.userDocs.pending > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending:</span>
                      <span className="text-amber-600 dark:text-amber-400">{syncStatus.userDocs.pending}</span>
                    </div>
                  )}
                  {syncStatus.userDocs.failed > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed:</span>
                      <span className="text-red-600 dark:text-red-400">{syncStatus.userDocs.failed}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Storage & Vector DB Status */}
          {syncStatus && (
            <div className="flex items-center justify-between text-sm p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>{syncStatus.localStorageUsed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(
                    syncStatus.chromaDBStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    Local vectors {syncStatus.chromaDBStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sync Progress */}
          {syncProgress && (
            <div className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {getPhaseLabel(syncProgress.phase)}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {syncProgress.current}/{syncProgress.total}
                </span>
              </div>
              {syncProgress.currentFile && (
                <p className="text-xs text-muted-foreground truncate">
                  {syncProgress.currentFile}
                </p>
              )}
              <div className="mt-2 h-2 rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {/* Sync Actions */}
          <div className="flex gap-2">
            {syncStatus?.isSyncing || syncProgress ? (
              <Button
                variant="destructive"
                onClick={handleStopSync}
                className="flex-1"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Sync
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={handleStartSync}
                disabled={isStartingSync || ollamaStatus?.status !== 'healthy'}
                className="flex-1"
              >
                {isStartingSync ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Sync Documents
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleClearCache}
              disabled={isClearingCache || syncStatus?.isSyncing}
            >
              {isClearingCache ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>

          {ollamaStatus?.status !== 'healthy' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Start Ollama to enable document sync with local embeddings.
            </p>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="pt-4 border-t">
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  );
}

export default AISettingsTab;
