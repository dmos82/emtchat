/**
 * IntegrationsSettings
 *
 * Manages third-party integrations like Gmail, Outlook for email sync.
 * Shows connection status, allows connect/disconnect, and sync configuration.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, RefreshCw, Unlink, ChevronDown, Clock, AlertCircle, CheckCircle, Loader2, Key, Copy, ExternalLink } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useToast } from '@/components/ui/use-toast';

interface OAuthConnection {
  id: string;  // Backend returns 'id' not '_id'
  provider: 'gmail' | 'outlook';
  email: string;
  status: 'active' | 'expired' | 'revoked' | 'error';
  statusMessage?: string;
  lastSyncAt?: string;
  createdAt: string;
}

interface SyncConfig {
  id: string;
  enabled: boolean;
  syncIntervalHours: number;
  includeFolders: string[];
  excludeFolders: string[];
  maxEmailsPerSync: number;
  syncAllEmails: boolean;
  batchSize: number;
  includeAttachments: boolean;
  attachmentMaxSizeMB: number;
  lastSyncAt?: string;
  nextScheduledSync?: string;
  // New fields for advanced filtering
  dateRangeStart?: string;
  dateRangeEnd?: string;
  queryFilter?: string;
  syncStats?: {
    totalSynced: number;
    lastBatchCount: number;
    totalErrors: number;
  };
  syncProgress?: {
    isActive: boolean;
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    statusMessage?: string;
    totalEmailsFound: number;
    emailsProcessed: number;
    emailsSkipped: number;
    emailsFailed: number;
    currentBatch: number;
    estimatedBatches: number;
    startedAt?: string;
    lastUpdateAt?: string;
  };
}

interface SyncStatus {
  isRunning: boolean;
  enabled: boolean;
  lastSyncAt?: string;
  nextScheduledSync?: string;
  consecutiveFailures: number;
  lastError?: string;
  emailCount: {
    total: number;
    pending: number;
    failed: number;
    completed: number;
  };
  continuousSync?: {
    isActive: boolean;
    status: string;
    statusMessage?: string;
    totalEmailsFound: number;
    emailsProcessed: number;
    emailsSkipped: number;
    emailsFailed: number;
    currentBatch: number;
    estimatedBatches: number;
    progressPercentage: number;
    startedAt?: string;
    lastUpdateAt?: string;
  } | null;
}

export const IntegrationsSettings: React.FC = () => {
  const { toast } = useToast();
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Check if user is authenticated
  const getToken = () => localStorage.getItem('accessToken');

  // Fetch connections on mount
  const fetchConnections = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetchWithAuth('/api/oauth/connections');

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConnections(data.connections);
        }
      }
    } catch (error: unknown) {
      console.error('Failed to fetch connections:', error);
      // Don't show error toast on initial load - connections may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Handle connect click - now accepts per-user OAuth credentials
  const handleConnect = async (
    provider: 'gmail' | 'outlook',
    credentials?: { clientId: string; clientSecret: string }
  ) => {
    const token = getToken();
    if (!token || connecting) return;

    setConnecting(true);
    try {
      // Build request body with credentials if provided
      const body = credentials
        ? JSON.stringify({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
          })
        : undefined;

      const response = await fetchWithAuth(`/api/oauth/${provider}/initiate`, {
        method: 'POST',
        body,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.authUrl) {
          // Redirect to OAuth provider
          window.location.href = data.authUrl;
        } else {
          toast({
            title: 'Connection failed',
            description: data.error || 'Failed to initiate connection',
            variant: 'destructive',
          });
          setConnecting(false);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Connection failed',
          description: error.error || 'Failed to connect',
          variant: 'destructive',
        });
        setConnecting(false);
      }
    } catch (error: unknown) {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async (connectionId: string) => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetchWithAuth(`/api/oauth/connections/${connectionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: 'Disconnected',
            description: 'Successfully disconnected from Gmail',
          });
          setConnections(prev => prev.filter(c => c.id !== connectionId));
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Disconnect failed',
          description: error.error || 'Failed to disconnect',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'Disconnect failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect',
        variant: 'destructive',
      });
    }
  };

  const gmailConnection = connections.find(c => c.provider === 'gmail');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-muted h-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Connected Services</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Connect your email accounts to sync emails as RAG sources.
        </p>
      </div>

      {/* Gmail Connection Card */}
      <GmailConnectionCard
        connection={gmailConnection}
        onConnect={(credentials) => handleConnect('gmail', credentials)}
        onDisconnect={handleDisconnect}
        connecting={connecting}
      />

      {/* Future: Outlook connection card */}
      <Card className="opacity-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mail className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-base">Microsoft Outlook</CardTitle>
                <CardDescription className="text-xs">Coming soon</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              Connect
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
};

interface GmailConnectionCardProps {
  connection?: OAuthConnection;
  onConnect: (credentials?: { clientId: string; clientSecret: string }) => void;
  onDisconnect: (id: string) => void;
  connecting: boolean;
}

const GmailConnectionCard: React.FC<GmailConnectionCardProps> = ({
  connection,
  onConnect,
  onDisconnect,
  connecting,
}) => {
  const { toast } = useToast();
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // OAuth credential input state
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  // Auto-generate redirect URI based on current domain
  const redirectUri = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/auth/gmail/callback`;
    }
    return '';
  }, []);

  const getToken = () => localStorage.getItem('accessToken');

  // Copy redirect URI to clipboard
  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    toast({
      title: 'Copied!',
      description: 'Redirect URI copied to clipboard',
    });
  };

  // Handle credential form submission
  const handleCredentialSubmit = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: 'Missing credentials',
        description: 'Please enter both Client ID and Client Secret',
        variant: 'destructive',
      });
      return;
    }
    onConnect({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  };

  // Fetch sync config and status when connection exists
  useEffect(() => {
    if (!connection) return;
    const token = getToken();
    if (!token) return;

    const fetchSyncData = async () => {
      try {
        const [configRes, statusRes] = await Promise.all([
          fetchWithAuth(`/api/email-sync/config/${connection.id}`),
          fetchWithAuth(`/api/email-sync/status/${connection.id}`),
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.success) {
            setSyncConfig(configData.config);
          }
        }
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.success) {
            setSyncStatus(statusData.status);
          }
        }
      } catch (error) {
        console.error('Failed to fetch sync data:', error);
      }
    };

    fetchSyncData();

    // Poll status - more frequently during continuous sync
    const pollStatus = async () => {
      try {
        const statusRes = await fetchWithAuth(`/api/email-sync/status/${connection.id}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.success) {
            setSyncStatus(statusData.status);
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Start with 30s interval, will be updated based on sync state
    let interval = setInterval(pollStatus, 30000);

    // Check if we need faster polling (continuous sync active)
    const checkPollRate = () => {
      const isContinuousSyncing = syncStatus?.continuousSync?.isActive;
      const isRunning = syncStatus?.isRunning;

      if (isContinuousSyncing || isRunning) {
        // Poll every 3 seconds during sync
        clearInterval(interval);
        interval = setInterval(pollStatus, 3000);
      }
    };

    // Check poll rate on mount and when status changes
    checkPollRate();

    return () => clearInterval(interval);
  }, [connection, syncStatus?.continuousSync?.isActive, syncStatus?.isRunning]);

  // Trigger manual sync
  const handleSync = async () => {
    if (!connection || syncing) return;
    const token = getToken();
    if (!token) return;

    setSyncing(true);
    try {
      const response = await fetchWithAuth(`/api/email-sync/trigger/${connection.id}`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: 'Sync started',
            description: 'Email sync has been initiated',
          });
          // Refresh status after a delay
          setTimeout(async () => {
            const statusRes = await fetchWithAuth(`/api/email-sync/status/${connection.id}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.success) {
                setSyncStatus(statusData.status);
              }
            }
            setSyncing(false);
          }, 2000);
        }
      } else {
        const error = await response.json();
        if (response.status === 429) {
          toast({
            title: 'Rate limited',
            description: `Please try again in ${error.retryAfter || 60}s`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Sync failed',
            description: error.error || 'Failed to start sync',
            variant: 'destructive',
          });
        }
        setSyncing(false);
      }
    } catch (error: unknown) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to start sync',
        variant: 'destructive',
      });
      setSyncing(false);
    }
  };

  // Update sync config
  const handleUpdateConfig = async (updates: Partial<SyncConfig>) => {
    if (!connection) return;
    const token = getToken();
    if (!token) return;

    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/email-sync/config/${connection.id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSyncConfig(prev => prev ? { ...prev, ...updates } : null);
          toast({
            title: 'Settings saved',
            description: 'Sync settings have been updated',
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Save failed',
          description: error.error || 'Failed to save settings',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
    if (!connection) return null;

    switch (connection.status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
      case 'expired':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      case 'revoked':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-red-50 p-2 rounded-lg">
              <Mail className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-base">Gmail</CardTitle>
              {connection ? (
                <CardDescription className="text-xs">{connection.email}</CardDescription>
              ) : (
                <CardDescription className="text-xs">Sync emails as RAG sources</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge()}
            {connection ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDisconnect(connection.id)}
              >
                <Unlink className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowCredentialForm(!showCredentialForm)}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Connecting...
                  </>
                ) : showCredentialForm ? (
                  'Cancel'
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-1" />
                    Connect
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* OAuth Credential Input Form */}
      {!connection && showCredentialForm && (
        <CardContent className="pt-0 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
              <strong>Setup Instructions:</strong>
            </p>
            <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="h-3 w-3" /></a></li>
              <li>Create OAuth 2.0 Client ID (Web application)</li>
              <li>Add the redirect URI below to &quot;Authorized redirect URIs&quot;</li>
              <li>Copy the Client ID and Client Secret here</li>
            </ol>
          </div>

          {/* Redirect URI (read-only, copyable) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Redirect URI</Label>
            <div className="flex items-center space-x-2">
              <Input
                value={redirectUri}
                readOnly
                className="font-mono text-xs bg-muted"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyRedirectUri}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this URL to your Google Cloud Console OAuth client
            </p>
          </div>

          {/* Client ID */}
          <div className="space-y-2">
            <Label htmlFor="gmail-client-id" className="text-sm font-medium">
              Client ID
            </Label>
            <Input
              id="gmail-client-id"
              type="text"
              placeholder="your-client-id.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {/* Client Secret */}
          <div className="space-y-2">
            <Label htmlFor="gmail-client-secret" className="text-sm font-medium">
              Client Secret
            </Label>
            <Input
              id="gmail-client-secret"
              type="password"
              placeholder="GOCSPX-..."
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {/* Login Button */}
          <Button
            variant="default"
            className="w-full"
            onClick={handleCredentialSubmit}
            disabled={connecting || !clientId.trim() || !clientSecret.trim()}
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting to Google...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Login with Google
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Your credentials are encrypted and stored securely
          </p>
        </CardContent>
      )}

      {connection && (
        <>
          <Button
            variant="ghost"
            className="w-full justify-between px-6 py-2 h-auto"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-sm text-muted-foreground">
              {syncStatus?.emailCount.total || 0} emails synced
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>

          {expanded && (
            <CardContent className="pt-4 space-y-4">
              {/* Sync Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sync-enabled"
                    checked={syncConfig?.enabled ?? true}
                    onCheckedChange={(enabled) => handleUpdateConfig({ enabled })}
                    disabled={saving}
                  />
                  <Label htmlFor="sync-enabled">Auto-sync enabled</Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing || (syncStatus?.isRunning ?? false)}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncing || syncStatus?.isRunning ? 'animate-spin' : ''}`} />
                  {syncing || syncStatus?.isRunning ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>

              {/* Sync Stats */}
              {syncStatus && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground text-xs">Total</div>
                    <div className="font-medium">{syncStatus.emailCount.total}</div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground text-xs">Pending</div>
                    <div className="font-medium">{syncStatus.emailCount.pending}</div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground text-xs">Failed</div>
                    <div className="font-medium text-red-500">{syncStatus.emailCount.failed}</div>
                  </div>
                </div>
              )}

              {/* Sync Interval */}
              <div className="space-y-2">
                <Label className="text-sm">Sync Interval</Label>
                <Select
                  value={String(syncConfig?.syncIntervalHours ?? 6)}
                  onValueChange={(value) => handleUpdateConfig({ syncIntervalHours: parseInt(value) })}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Every hour</SelectItem>
                    <SelectItem value="6">Every 6 hours</SelectItem>
                    <SelectItem value="12">Every 12 hours</SelectItem>
                    <SelectItem value="24">Daily</SelectItem>
                    <SelectItem value="168">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sync All Emails Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-b">
                <div>
                  <Label className="text-sm font-medium">Sync All Emails</Label>
                  <p className="text-xs text-muted-foreground">
                    Sync your entire mailbox (recommended for 1000+ emails)
                  </p>
                </div>
                <Switch
                  checked={syncConfig?.syncAllEmails ?? false}
                  onCheckedChange={(syncAllEmails) => handleUpdateConfig({ syncAllEmails })}
                  disabled={saving}
                />
              </div>

              {/* Continuous Sync Progress */}
              {syncStatus?.continuousSync?.isActive && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-sm font-medium">Syncing emails...</span>
                    </div>
                    <Badge variant="outline">
                      {syncStatus.continuousSync.progressPercentage}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${syncStatus.continuousSync.progressPercentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {syncStatus.continuousSync.statusMessage}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-green-600">{syncStatus.continuousSync.emailsProcessed.toLocaleString()}</span> synced
                    </div>
                    <div>
                      <span className="text-gray-500">{syncStatus.continuousSync.emailsSkipped.toLocaleString()}</span> skipped
                    </div>
                    <div>
                      <span className="text-red-500">{syncStatus.continuousSync.emailsFailed.toLocaleString()}</span> failed
                    </div>
                  </div>
                </div>
              )}

              {/* Batch Size (only when syncAllEmails is enabled) */}
              {syncConfig?.syncAllEmails && (
                <div className="space-y-2">
                  <Label className="text-sm">Batch Size</Label>
                  <Select
                    value={String(syncConfig?.batchSize ?? 100)}
                    onValueChange={(value) => handleUpdateConfig({ batchSize: parseInt(value) })}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 emails per batch</SelectItem>
                      <SelectItem value="100">100 emails per batch</SelectItem>
                      <SelectItem value="200">200 emails per batch</SelectItem>
                      <SelectItem value="500">500 emails per batch</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Larger batches are faster but use more memory
                  </p>
                </div>
              )}

              {/* Max Emails (only when syncAllEmails is disabled) */}
              {!syncConfig?.syncAllEmails && (
                <div className="space-y-2">
                  <Label className="text-sm">Max Emails per Sync</Label>
                  <Select
                    value={String(syncConfig?.maxEmailsPerSync ?? 100)}
                    onValueChange={(value) => handleUpdateConfig({ maxEmailsPerSync: parseInt(value) })}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 emails</SelectItem>
                      <SelectItem value="100">100 emails</SelectItem>
                      <SelectItem value="200">200 emails</SelectItem>
                      <SelectItem value="500">500 emails</SelectItem>
                      <SelectItem value="1000">1,000 emails</SelectItem>
                      <SelectItem value="5000">5,000 emails</SelectItem>
                      <SelectItem value="10000">10,000 emails</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Query Filter */}
              <div className="space-y-2">
                <Label className="text-sm">Email Filter (Gmail Query)</Label>
                <Input
                  placeholder='e.g., "invoice" or "from:amazon.com" or "has:attachment"'
                  value={syncConfig?.queryFilter ?? ''}
                  onChange={(e) => setSyncConfig(prev => prev ? { ...prev, queryFilter: e.target.value } : null)}
                  onBlur={(e) => {
                    if (e.target.value !== (syncConfig?.queryFilter ?? '')) {
                      handleUpdateConfig({ queryFilter: e.target.value || undefined });
                    }
                  }}
                  disabled={saving}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use Gmail search syntax. Examples: &quot;invoice&quot;, &quot;from:bank@email.com&quot;, &quot;subject:receipt&quot;
                </p>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">From Date</Label>
                  <Input
                    type="date"
                    value={syncConfig?.dateRangeStart ? syncConfig.dateRangeStart.split('T')[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                      handleUpdateConfig({ dateRangeStart: value });
                    }}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">To Date</Label>
                  <Input
                    type="date"
                    value={syncConfig?.dateRangeEnd ? syncConfig.dateRangeEnd.split('T')[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                      handleUpdateConfig({ dateRangeEnd: value });
                    }}
                    disabled={saving}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Filter emails by date range. Leave empty to sync recent emails.
              </p>

              {/* Attachments Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Include Attachments</Label>
                  <p className="text-xs text-muted-foreground">
                    Process PDF and image attachments
                  </p>
                </div>
                <Switch
                  checked={syncConfig?.includeAttachments ?? true}
                  onCheckedChange={(includeAttachments) => handleUpdateConfig({ includeAttachments })}
                  disabled={saving}
                />
              </div>

              {/* Last Sync Info */}
              {syncStatus?.lastSyncAt && (
                <div className="text-xs text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Last synced: {new Date(syncStatus.lastSyncAt).toLocaleString()}
                </div>
              )}

              {/* Error display */}
              {syncStatus?.lastError && (
                <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                  Error: {syncStatus.lastError}
                </div>
              )}
            </CardContent>
          )}
        </>
      )}
    </Card>
  );
};

export default IntegrationsSettings;
