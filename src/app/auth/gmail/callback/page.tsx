'use client';

/**
 * Gmail OAuth Callback Page
 *
 * Handles the OAuth callback from Google after user grants permission.
 * Exchanges the authorization code for tokens via the backend.
 */

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type CallbackStatus = 'processing' | 'success' | 'error';

function GmailCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [message, setMessage] = useState('Processing your Gmail connection...');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // Handle OAuth errors from Google
      if (error) {
        setStatus('error');
        setMessage(getErrorMessage(error));
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setStatus('error');
        setMessage('Invalid callback: missing authorization code or state');
        return;
      }

      // Check for auth token
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Give it a moment for auth to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryToken = localStorage.getItem('accessToken');
        if (!retryToken) {
          setStatus('error');
          setMessage('Please log in to connect your Gmail account');
          return;
        }
      }

      try {
        // Exchange code for tokens via backend
        const response = await fetchWithAuth('/api/oauth/gmail/callback', {
          method: 'POST',
          body: JSON.stringify({ code, state }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          setEmail(data.email);
          setMessage('Gmail connected successfully!');

          // Redirect to main app after 3 seconds (settings is modal-based)
          setTimeout(() => {
            router.push('/chat');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to connect Gmail');
        }
      } catch (err: unknown) {
        setStatus('error');
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect Gmail';
        setMessage(errorMessage);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'access_denied':
        return 'You denied access to your Gmail account. Please try again if you want to connect.';
      case 'invalid_scope':
        return 'The requested permissions are not available. Please contact support.';
      default:
        return `OAuth error: ${error}`;
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-12 w-12 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="bg-red-50 p-4 rounded-full">
                <Mail className="h-8 w-8 text-red-500" />
              </div>
              <div className="absolute -bottom-1 -right-1">
                {getIcon()}
              </div>
            </div>
          </div>
          <CardTitle>
            {status === 'processing' && 'Connecting Gmail...'}
            {status === 'success' && 'Gmail Connected!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'success' && email && (
            <p className="text-sm text-muted-foreground">
              Connected as <strong>{email}</strong>
            </p>
          )}

          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              Redirecting to settings...
            </p>
          )}

          {status === 'error' && (
            <div className="space-y-2">
              <Button
                variant="default"
                onClick={() => router.push('/chat')}
              >
                Go to App
              </Button>
              <Button
                variant="outline"
                className="ml-2"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GmailCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <GmailCallbackContent />
    </Suspense>
  );
}
