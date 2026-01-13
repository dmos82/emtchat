'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { login } = useAuth();

  // Theme detection for logo switching
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      console.log('[LoginForm] handleLogin triggered for:', { username });

      await login(username, password);
      const loginSuccess = true;

      if (loginSuccess) {
        console.log('[LoginForm] AuthContext login successful. Redirecting to /');
        // Use full page reload instead of client-side navigation
        // This ensures all components reinitialize properly, especially on iOS
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      } else {
        console.log('[LoginForm] AuthContext login failed.');
        setError('Invalid username or password.');
        setPassword('');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('[LoginForm] Error during login attempt:', error);
      setError('An error occurred. Please try again.');
      setPassword('');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* EMTChat Logo */}
      <div className="mb-8">
        <div
          className="overflow-hidden"
          style={{
            width: '180px',
            height: '180px',
            filter: 'drop-shadow(0 0 20px rgba(234, 162, 33, 0.4))'
          }}
        >
          <img
            src={isDarkMode ? '/emtchat-logo-dark.png' : '/emtchat-logo.png'}
            alt="EMTChat Logo"
            className="object-contain w-full h-full"
          />
        </div>
      </div>

      <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
        {/* Username input */}
        <input
          id="login-username"
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          disabled={isSubmitting}
          autoComplete="off"
          className="w-full h-12 px-4 bg-black/40 backdrop-blur-sm border border-white/50 rounded-lg text-white placeholder-white/70 focus:outline-none focus:border-white focus:bg-black/50 transition-all text-base"
        />

        {/* Password input */}
        <input
          id="login-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          disabled={isSubmitting}
          autoComplete="new-password"
          className="w-full h-12 px-4 bg-black/40 backdrop-blur-sm border border-white/50 rounded-lg text-white placeholder-white/70 focus:outline-none focus:border-white focus:bg-black/50 transition-all text-base"
        />

        {error && (
          <p className="text-sm font-medium text-red-400 text-center">{error}</p>
        )}

        {/* LOGIN button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 rounded-lg transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 font-bold text-xl text-white"
          style={{
            backgroundColor: '#2563eb',
          }}
        >
          {isSubmitting ? 'LOGGING IN...' : 'LOGIN'}
        </button>
      </form>
    </div>
  );
}

export default LoginForm;
