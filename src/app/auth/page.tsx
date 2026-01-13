'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import LoginForm from '@/components/auth/LoginForm';

export default function AuthPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Check app's theme setting from localStorage first
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
      // Use saved app preference
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Fall back to system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDarkMode(mediaQuery.matches);
    }

    // Listen for theme changes in localStorage (from other tabs or settings)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        setIsDarkMode(e.newValue === 'dark');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Background Image - switches based on dark/light mode */}
      <div className="absolute inset-0 z-0">
        <Image
          src={isDarkMode ? '/emtchat-bg-dark.png' : '/emtchat-bg-light.png'}
          alt="EMT Response Scene"
          fill
          priority
          className="object-cover"
          quality={90}
        />
        {/* Overlay for better text readability */}
        <div
          className={`absolute inset-0 ${
            isDarkMode
              ? 'bg-black/40'
              : 'bg-black/30'
          }`}
        />
      </div>

      {/* Login content - centered on mobile, offset right on desktop */}
      <div className="relative z-10 w-full max-w-[550px] flex flex-col items-center justify-center mx-auto md:mx-0 md:ml-[50%] p-4">
        <LoginForm />
      </div>
    </div>
  );
}
