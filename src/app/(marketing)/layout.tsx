/**
 * Marketing Layout
 * Public pages layout with EMT-themed backgrounds and marketing header/footer
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function MarketingHeader() {
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full',
      'backdrop-blur-xl backdrop-saturate-150',
      'bg-white/70 dark:bg-black/50',
      'border-b border-white/20 dark:border-white/10',
    )}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">EMT</span>
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              EMTChat
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
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
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Sun className="h-5 w-5 hidden dark:block text-gray-300" />
              <Moon className="h-5 w-5 block dark:hidden text-gray-600" />
            </button>

            {/* Auth buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
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
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex gap-3">
              <Link href="/auth/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/register" className="flex-1">
                <Button size="sm" className="w-full bg-red-600 hover:bg-red-700">
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
  const currentYear = new Date().getFullYear();

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
      'w-full mt-auto',
      'backdrop-blur-xl backdrop-saturate-150',
      'bg-white/50 dark:bg-black/30',
      'border-t border-white/20 dark:border-white/10',
    )}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">EMT</span>
              </div>
              <span className="font-bold text-lg text-gray-900 dark:text-white">
                EMTChat
              </span>
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI-powered knowledge base for Emergency Medical Technicians.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              Product
            </h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              Company
            </h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              Legal
            </h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
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
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* EMT-themed background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/emtchat-bg-light.png)',
        }}
      />
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat hidden dark:block"
        style={{
          backgroundImage: 'url(/emtchat-bg-dark.png)',
        }}
      />

      {/* Background overlay for readability */}
      <div className="fixed inset-0 z-0 bg-white/30 dark:bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <MarketingHeader />
        <main className="flex-1">
          {children}
        </main>
        <MarketingFooter />
      </div>
    </div>
  );
}
