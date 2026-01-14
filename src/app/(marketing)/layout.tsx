/**
 * Marketing Layout
 * Public pages layout with EMT-themed backgrounds, parallax effects, and marketing header/footer
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function MarketingHeader() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme === 'dark';

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full',
      'backdrop-blur-xl backdrop-saturate-150',
      isDark ? 'bg-gray-900/90 border-white/10' : 'bg-white/90 border-gray-200',
      'border-b',
    )}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <img
              src={isDark ? '/emtchat-logo-dark.png' : '/emtchat-logo-light.png'}
              alt="EMTChat"
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors',
                  isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
              )}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Auth buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/auth">
                <Button variant="ghost" size="sm" className={cn(
                  isDark ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}>
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn(
                'md:hidden p-2 rounded-lg',
                isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-900'
              )}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className={cn(
          'md:hidden border-t',
          isDark ? 'border-white/10 bg-gray-900/95' : 'border-gray-200 bg-white/95'
        )}>
          <div className="container mx-auto px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'block text-sm font-medium',
                  isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className={cn(
              'pt-3 border-t flex gap-3',
              isDark ? 'border-white/10' : 'border-gray-200'
            )}>
              <Link href="/auth" className="flex-1">
                <Button variant="outline" size="sm" className={cn(
                  'w-full',
                  isDark ? 'border-white/20 text-white hover:bg-white/10' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                )}>
                  Sign In
                </Button>
              </Link>
              <Link href="/signup" className="flex-1">
                <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MarketingFooter() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme === 'dark';

  const footerLinks = {
    product: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/docs', label: 'Documentation' },
    ],
    company: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/careers', label: 'Careers' },
    ],
    legal: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/hipaa', label: 'HIPAA Compliance' },
    ],
  };

  return (
    <footer className={cn(
      'w-full mt-auto border-t',
      isDark ? 'bg-gray-900/95 border-white/10' : 'bg-gray-50/95 border-gray-200'
    )}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <img
                src={isDark ? '/emtchat-logo-dark.png' : '/emtchat-logo-light.png'}
                alt="EMTChat"
                className="h-10 w-auto"
              />
            </Link>
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
              AI-powered knowledge base for Emergency Medical Technicians.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className={cn('font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
              Product
            </h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      'text-sm transition-colors',
                      isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className={cn('font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
              Company
            </h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      'text-sm transition-colors',
                      isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className={cn('font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
              Legal
            </h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      'text-sm transition-colors',
                      isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className={cn('mt-8 pt-8 border-t', isDark ? 'border-white/10' : 'border-gray-200')}>
          <p className={cn('text-center text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
            © {currentYear} EMTChat. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Enable scrolling on body for marketing pages
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflow = 'auto';

    return () => {
      // Reset when leaving marketing pages
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDark = !mounted || resolvedTheme === 'dark';

  return (
    <>
      {/* Fixed backgrounds - pointer-events-none so they don't block scrolling */}
      <div
        className={cn(
          'fixed inset-0 bg-cover bg-center bg-no-repeat will-change-transform pointer-events-none',
          isDark ? 'bg-gray-950' : 'bg-gray-100'
        )}
        style={{
          backgroundImage: isDark ? 'url(/emtchat-bg-dark.png)' : 'url(/emtchat-bg-light.png)',
          transform: `translateY(${scrollY * 0.3}px)`,
        }}
      />
      <div className={cn(
        'fixed inset-0 bg-gradient-to-b pointer-events-none',
        isDark
          ? 'from-gray-950/70 via-gray-950/80 to-gray-950/95'
          : 'from-white/60 via-white/70 to-white/90'
      )} />

      {/* Scrollable content */}
      <div className={cn('relative min-h-screen flex flex-col', isDark ? 'text-white' : 'text-gray-900')}>
        <MarketingHeader />
        <main className="flex-1">
          {children}
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
