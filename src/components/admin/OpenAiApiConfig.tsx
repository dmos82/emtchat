'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Info, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OpenAiApiConfigProps {
  // Add props if needed
}

interface OpenAiConfig {
  apiKeySource: 'database' | 'environment_fallback' | 'not_set';
  isApiKeySetInDB: boolean;
  activeApiKeyMasked: string | null;
  activeOpenAIModelId: string | null;
  activeChatModelId: string;
  allowedModels: string[];
}

const OpenAiApiConfig: React.FC<OpenAiApiConfigProps> = () => {
  // State variables
  const [apiKeyInputValue, setApiKeyInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [currentConfig, setCurrentConfig] = useState<OpenAiConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [detectedModels, setDetectedModels] = useState<string[]>([]);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { toast } = useToast();

  // Model descriptions for tooltips and recommendations
  const modelInfo: Record<string, { desc: string; best?: string; cost: 'low' | 'medium' | 'high' | 'premium' }> = {
    // GPT-5.2 Series
    'gpt-5.2': { desc: 'Balanced flagship model for general tasks', cost: 'high' },
    'gpt-5.2-thinking': { desc: 'Best for coding, canvas, and structured work. Superior reasoning.', best: 'canvas', cost: 'high' },
    'gpt-5.2-instant': { desc: 'Fastest GPT-5.2 variant for quick responses', cost: 'medium' },
    'gpt-5.2-pro': { desc: 'Most accurate with lowest hallucination rate', cost: 'premium' },
    // GPT-5.1 Series
    'gpt-5.1': { desc: 'Previous flagship model, reliable and capable', cost: 'high' },
    'gpt-5.1-thinking': { desc: 'Strong reasoning for coding and planning', best: 'canvas', cost: 'high' },
    'gpt-5.1-instant': { desc: 'Fast responses for simple queries', cost: 'medium' },
    'gpt-5.1-chat-latest': { desc: 'Latest GPT-5.1 chat-optimized model', cost: 'high' },
    // GPT-5 Series
    'gpt-5': { desc: 'Original GPT-5 model', cost: 'high' },
    'gpt-5-pro': { desc: 'Professional tier with enhanced accuracy', cost: 'premium' },
    'gpt-5-codex': { desc: 'Specialized for code generation', best: 'canvas', cost: 'high' },
    'gpt-5-chat-latest': { desc: 'Latest GPT-5 chat model', cost: 'high' },
    'gpt-5-search-api': { desc: 'Model with web search capabilities', cost: 'high' },
    // GPT-4o Series
    'gpt-4o': { desc: 'Multimodal flagship - text, images, audio', cost: 'medium' },
    'gpt-4o-mini': { desc: 'Best cost/performance ratio. Great for most tasks.', cost: 'low' },
    // GPT-4.1 Series
    'gpt-4.1': { desc: 'Specialized for coding tasks', best: 'canvas', cost: 'medium' },
    'gpt-4.1-mini': { desc: 'Improved instruction-following', cost: 'low' },
    // GPT-4 Turbo
    'gpt-4-turbo': { desc: 'Fast GPT-4 with 128k context', cost: 'medium' },
    // Audio models
    'gpt-audio': { desc: 'Audio processing and generation', cost: 'medium' },
    'gpt-audio-mini': { desc: 'Lightweight audio processing', cost: 'low' },
    // Legacy
    'gpt-3.5-turbo': { desc: 'Legacy model - not recommended for new work', cost: 'low' },
  };

  // Helper to get model description
  const getModelInfo = (modelId: string) => {
    // Direct match
    if (modelInfo[modelId]) return modelInfo[modelId];
    // Pattern match for dated versions
    if (modelId.includes('thinking')) return { desc: 'Reasoning model for structured work', best: 'canvas', cost: 'high' as const };
    if (modelId.includes('instant')) return { desc: 'Fast response model', cost: 'medium' as const };
    if (modelId.includes('pro')) return { desc: 'Professional tier with enhanced accuracy', cost: 'premium' as const };
    if (modelId.includes('mini')) return { desc: 'Cost-effective smaller model', cost: 'low' as const };
    if (modelId.includes('audio')) return { desc: 'Audio processing model', cost: 'medium' as const };
    if (modelId.includes('search')) return { desc: 'Model with web search capabilities', cost: 'high' as const };
    if (modelId.includes('codex')) return { desc: 'Code generation specialist', best: 'canvas', cost: 'high' as const };
    if (modelId.includes('image')) return { desc: 'Image generation model', cost: 'medium' as const };
    if (modelId.startsWith('gpt-5')) return { desc: 'GPT-5 series model', cost: 'high' as const };
    if (modelId.startsWith('gpt-4')) return { desc: 'GPT-4 series model', cost: 'medium' as const };
    return { desc: 'OpenAI model', cost: 'medium' as const };
  };

  // List of OpenAI models (tested and verified for chat completions)
  // Updated: December 2025 - Tested GPT-5.2 series
  // NOTE: Only models that return content with max_completion_tokens are included
  const defaultModels = [
    // GPT-5.2 Series (LATEST - December 2025) - VERIFIED WORKING
    'gpt-5.2',
    'gpt-5.2-2025-12-11',

    // GPT-5 Series - Only chat-latest works
    'gpt-5-chat-latest',

    // GPT-4.1 Series (Coding specialized) - VERIFIED WORKING
    'gpt-4.1',
    'gpt-4.1-mini',

    // GPT-4o Series (RECOMMENDED for cost-efficiency) - VERIFIED WORKING
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4o-2024-11-20',
    'gpt-4o-2024-08-06',
    'gpt-4o-mini-2024-07-18',

    // GPT-4 Turbo
    'gpt-4-turbo',
    'gpt-4-turbo-2024-04-09',

    // GPT-3.5 (Legacy - not recommended)
    'gpt-3.5-turbo',
  ];

  // Fetch initial configuration
  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      setMessage(null);
      setApiError(null);

      try {
        console.log('[OpenAiApiConfig] Attempting to fetch config from:', '/api/admin/settings/openai-config');
        const response = await fetchWithAuth('/api/admin/settings/openai-config', {
          method: 'GET',
        });

        console.log('[OpenAiApiConfig] Fetch response status:', response.status);

        if (!response.ok) {
          let errorData;
          let errorText;
          try {
            errorData = await response.json();
            console.log('[OpenAiApiConfig] Error response data:', errorData);
          } catch (e) {
            try {
              errorText = await response.text();
              console.log('[OpenAiApiConfig] Error response text:', errorText);
            } catch (textError) {
              errorText = 'No response body available';
            }
            errorData = { message: errorText || 'Failed to parse error response' };
          }

          setApiError(`API Error ${response.status}: ${errorData.message || 'Unknown error'}`);
          throw new Error(errorData.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        console.log('[OpenAiApiConfig] API response data:', data);

        if (data.success) {
          setCurrentConfig(data);
          if (data.activeChatModelId) {
            setSelectedModel(data.activeChatModelId);
          }
          console.log('[OpenAiApiConfig] Loaded configuration:', data);

          // If previous message was an error, show success
          if (message && message.type === 'error') {
            setMessage({
              type: 'success',
              text: 'Successfully loaded OpenAI configuration.',
            });
          }
        } else {
          setApiError(`API returned non-success response: ${data.message || 'Unknown error'}`);
          throw new Error(data.message || 'Invalid response format from API');
        }
      } catch (error: unknown) {
        console.error('[OpenAiApiConfig] Failed to fetch OpenAI config:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        // Don't overwrite API error if it's already set
        if (!apiError) {
          setApiError(errorMessage);
        }

        setMessage({
          type: 'error',
          text: `Failed to load OpenAI configuration: ${errorMessage}`,
        });

        // Create a default config with reasonable fallbacks so UI doesn't break
        setCurrentConfig({
          apiKeySource: 'not_set',
          isApiKeySetInDB: false,
          activeApiKeyMasked: null,
          activeOpenAIModelId: null,
          activeChatModelId: 'gpt-4o-mini',
          allowedModels: defaultModels,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Handle Save Configuration
  const handleSaveConfig = async () => {
    if (!selectedModel) {
      toast({
        title: 'Validation Error',
        description: 'Please select a model',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setApiError(null);

    try {
      const payload = {
        modelId: selectedModel,
        apiKey: apiKeyInputValue.trim() || undefined, // Only send if non-empty
      };

      const response = await fetchWithAuth('/api/admin/settings/openai-config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json().catch(() => ({}));
        } catch (e) {
          errorData = {};
        }

        setApiError(`API Error ${response.status}: ${errorData.message || 'Unknown error'}`);
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Clear API key input after successful save
        setApiKeyInputValue('');

        // Show success message
        setMessage({
          type: 'success',
          text: 'OpenAI configuration updated successfully.',
        });

        toast({
          title: 'Success',
          description: 'OpenAI configuration updated successfully.',
        });

        // Refetch the config to show updated settings
        fetchConfig();
      } else {
        setApiError(`API returned non-success response: ${data.message || 'Unknown error'}`);
        throw new Error(data.message || 'Failed to update OpenAI configuration');
      }
    } catch (error: unknown) {
      console.error('[OpenAiApiConfig] Failed to save OpenAI config:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Don't overwrite API error if it's already set
      if (!apiError) {
        setApiError(errorMessage);
      }

      setMessage({
        type: 'error',
        text: `Failed to save OpenAI configuration: ${errorMessage}`,
      });

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Revert to System Default
  const handleRevertToDefault = async () => {
    setIsReverting(true);
    setMessage(null);

    try {
      const response = await fetchWithAuth('/api/admin/settings/openai-api-key', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || 'API key reverted to system default.',
        });

        // Clear API key input
        setApiKeyInputValue('');

        // Refetch the config to show updated settings
        fetchConfig();
      } else {
        throw new Error(data.message || 'Failed to revert API key');
      }
    } catch (error: unknown) {
      console.error('[OpenAiApiConfig] Failed to revert API key:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessage({
        type: 'error',
        text: `Failed to revert to system default: ${errorMessage}`,
      });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsReverting(false);
    }
  };

  // Handle Refresh Available Models from OpenAI API
  const handleRefreshModels = async () => {
    setIsRefreshingModels(true);
    setMessage(null);

    try {
      const response = await fetchWithAuth('/api/admin/settings/available-models', {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.models) {
        const modelIds = data.models.map((m: { id: string }) => m.id);
        setDetectedModels(modelIds);

        toast({
          title: 'Models Refreshed',
          description: `Found ${modelIds.length} available models from OpenAI`,
        });

        setMessage({
          type: 'success',
          text: `Detected ${modelIds.length} models from OpenAI. New models available in dropdown.`,
        });
      } else {
        throw new Error(data.message || 'Failed to fetch models');
      }
    } catch (error: unknown) {
      console.error('[OpenAiApiConfig] Failed to refresh models:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessage({
        type: 'error',
        text: `Failed to refresh models: ${errorMessage}`,
      });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingModels(false);
    }
  };

  // Fetch configuration function (for reuse)
  const fetchConfig = async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await fetchWithAuth('/api/admin/settings/openai-config', {
        method: 'GET',
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json().catch(() => ({}));
        } catch (e) {
          errorData = {};
        }

        setApiError(`API Error ${response.status}: ${errorData.message || 'Unknown error'}`);
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setCurrentConfig(data);
        if (data.activeChatModelId) {
          setSelectedModel(data.activeChatModelId);
        }
      } else {
        setApiError(`API returned non-success response: ${data.message || 'Unknown error'}`);
        throw new Error('Invalid response format');
      }
    } catch (error: unknown) {
      console.error('[OpenAiApiConfig] Refetch error:', error);
      // Don't show toast here as this is a refetch

      // Create a default config with reasonable fallbacks
      if (!currentConfig) {
        setCurrentConfig({
          apiKeySource: 'not_set',
          isApiKeySetInDB: false,
          activeApiKeyMasked: null,
          activeOpenAIModelId: null,
          activeChatModelId: 'gpt-4o-mini',
          allowedModels: defaultModels,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm mt-6">
      <h2 className="text-xl font-semibold">OpenAI API Configuration</h2>
      <p className="text-sm text-muted-foreground">
        Manage the OpenAI API key and model settings used for chat interactions. You can use your
        own API key or the system default.
      </p>

      {/* Error Display */}
      {apiError && (
        <Alert variant="destructive" className="mt-2">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs overflow-auto max-h-24">
            <strong>API Error:</strong> {apiError}
          </AlertDescription>
        </Alert>
      )}

      {/* Current Status Display */}
      <div className="space-y-1 mt-4">
        <div className="text-sm font-medium">
          Current API Key Status:{' '}
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-40" />
          ) : !currentConfig ? (
            <span className="text-destructive">Not available</span>
          ) : currentConfig.isApiKeySetInDB ? (
            <span className="text-green-600">
              Custom Key Set{' '}
              {currentConfig.activeApiKeyMasked && `(ends in ${currentConfig.activeApiKeyMasked})`}
            </span>
          ) : currentConfig.apiKeySource === 'environment_fallback' ? (
            <span className="text-amber-600">Using System Default Key (from environment)</span>
          ) : (
            <span className="text-destructive">No API Key Available</span>
          )}
        </div>

        <div className="text-sm font-medium">
          Current Model:{' '}
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-32" />
          ) : !currentConfig ? (
            <span className="text-destructive">Not available</span>
          ) : (
            <span className="text-blue-600">
              {currentConfig.activeChatModelId || 'System Default'}
            </span>
          )}
        </div>
      </div>

      {/* Form Section */}
      <div className="space-y-6 mt-6">
        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">
            Set Custom OpenAI API Key (Optional - leave blank to use system default)
          </Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKeyInputValue}
            onChange={e => setApiKeyInputValue(e.target.value)}
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            disabled={isLoading || isSaving || isReverting}
          />
          <p className="text-xs text-muted-foreground">
            Your API key is stored securely in the database and is never exposed in client-side
            code.
          </p>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="model">Preferred OpenAI Model</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshModels}
              disabled={isLoading || isSaving || isReverting || isRefreshingModels}
              className="h-7 text-xs"
            >
              {isRefreshingModels ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Detecting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1 h-3 w-3" /> Detect New Models
                </>
              )}
            </Button>
          </div>
          <Select
            value={selectedModel}
            onValueChange={setSelectedModel}
            disabled={isLoading || isSaving || isReverting}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {/* Show detected models first if available */}
              {detectedModels.length > 0 && (
                <>
                  <SelectItem disabled value="detected-header" className="text-xs font-semibold text-muted-foreground">
                    — Detected from OpenAI API (Chat-Compatible Only) —
                  </SelectItem>
                  {detectedModels.slice(0, 30).map(model => {
                    const info = getModelInfo(model);
                    return (
                      <SelectItem key={`detected-${model}`} value={model} className="py-2">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {model} ✨
                            {info.best === 'canvas' && ' 🧠'}
                          </span>
                          <span className="text-xs text-muted-foreground">{info.desc}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                  <SelectItem disabled value="default-header" className="text-xs font-semibold text-muted-foreground mt-2">
                    — Recommended Models —
                  </SelectItem>
                </>
              )}
              {(currentConfig?.allowedModels || defaultModels)
                .filter(model => model !== 'gpt-3.5-turbo-0125')
                .map(model => {
                  const info = getModelInfo(model);
                  const costBadge = info.cost === 'low' ? '💚' : info.cost === 'medium' ? '💛' : info.cost === 'high' ? '🔶' : '💎';
                  return (
                    <SelectItem key={model} value={model} className="py-2">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {model}
                          {info.best === 'canvas' && ' 🧠'}
                          {model.includes('5.2') && ' 🆕'}
                          {' '}{costBadge}
                        </span>
                        <span className="text-xs text-muted-foreground">{info.desc}</span>
                      </div>
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            🧠 Best for Canvas | 🆕 Latest | 💚 Low cost | 💛 Medium | 🔶 High | 💎 Premium
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <Button onClick={handleSaveConfig} disabled={isLoading || isSaving || isReverting}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>

          {currentConfig?.isApiKeySetInDB && (
            <Button
              variant="outline"
              onClick={handleRevertToDefault}
              disabled={isLoading || isSaving || isReverting}
            >
              {isReverting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reverting...
                </>
              ) : (
                'Revert to System Default'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Message Display Area */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className="mt-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default OpenAiApiConfig;
