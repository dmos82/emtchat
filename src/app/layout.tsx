'use client';

// Import polyfills first - before any other imports
import '@/lib/polyfills';

// import type { Metadata } from 'next';
import { Inter, Livvic, M_PLUS_2 } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toast';
import { AuthProvider } from '@/context/AuthContext';
import { PersonaProvider } from '@/contexts/PersonaContext';
import { SearchModeProvider } from '@/contexts/SearchModeContext';
// import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
// import { pdfjs } from 'react-pdf'; // pdfjs likely not needed directly here if worker setup is removed
// import { SessionProvider } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/ErrorBoundary';
import { TooltipProvider } from '@/components/ui/tooltip';
// TODO: SettingsProvider import commented out - file not found
// import { SettingsProvider } from '@/contexts/SettingsContext';
// import { SpeedInsights } from "@vercel/speed-insights/next"
import { Header } from '@/components/layout/Header';
import { AuthenticatedIMContainer } from '@/components/im';
import { HelpProvider } from '@/contexts/HelpContext';
import { HelpPanel } from '@/components/help/HelpPanel';
// No PdfWorkerSetup import here anymore

const inter = Inter({ subsets: ['latin'] });
const livvic = Livvic({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '900'],
  variable: '--font-livvic'
});
const mPlus2 = M_PLUS_2({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-mplus2'
});

// Metadata must be in a separate file or accessed via route segment config
// when using 'use client' directive
// export const metadata: Metadata = {
//   title: 'EMTChat - Client Portal',
//   description: 'Chat with your EMTChat documents.',
// };

// Marketing routes that have their own layout (no app header/IM)
const MARKETING_ROUTES = ['/', '/features', '/pricing', '/signup', '/contact', '/about', '/privacy', '/terms', '/hipaa', '/docs', '/careers'];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // Check if we're on a marketing page
  const isMarketingPage = MARKETING_ROUTES.includes(pathname) || pathname.startsWith('/auth');

  // Global cleanup: Remove stale Radix UI portal elements on route changes
  // This prevents dialog overlays from persisting after navigation
  useEffect(() => {
    // Clean up any stale portal elements when route changes
    if (typeof document !== 'undefined') {
      const stalePortals = document.querySelectorAll('[data-radix-portal]');
      stalePortals.forEach(portal => {
        // Only remove if the portal doesn't have an active dialog inside
        const hasOpenDialog = portal.querySelector('[data-state="open"]');
        if (!hasOpenDialog) {
          portal.remove();
        }
      });
    }
  }, [pathname]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>EMTChat - Client Portal</title>
        <meta name="description" content="EMTChat - Healthcare Knowledge Base for Emergency Medical Technicians" />

        {/* Mobile Optimization */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#1a1a1a" />

        {/* Touch Icons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/emtchat-logo.png" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} ${livvic.variable} ${mPlus2.variable}`}>
        {/* TODO: SettingsProvider commented out - implementation not found */}
        {/* <SettingsProvider> */}
          <AuthProvider>
            <SearchModeProvider>
              <PersonaProvider>
                <ThemeProvider
                  attribute="class"
                  defaultTheme="system"
                  enableSystem
                  disableTransitionOnChange
                >
                  <HelpProvider>
                    <ErrorBoundary>
                      {/* IM Popup System - Only on app pages, not marketing */}
                      {/* This ensures voice/video calls don't drop when navigating between pages */}
                      {!isMarketingPage && <AuthenticatedIMContainer />}
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={pathname}
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.4, ease: 'easeInOut' }}
                        >
                          <div vaul-drawer-wrapper="" className="bg-background">
                            <div className="relative flex min-h-screen w-full flex-col">
                              {/* Only show app header on non-marketing pages */}
                              {!isMarketingPage && <Header />}
                              <main>
                                {children}
                              </main>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </ErrorBoundary>
                    <Toaster />
                    {/* Help Mode Panel - global floating help */}
                    <HelpPanel />
                  </HelpProvider>
                </ThemeProvider>
              </PersonaProvider>
            </SearchModeProvider>
          </AuthProvider>
        {/* </SettingsProvider> */}
        {/* <SpeedInsights /> */}
      </body>
    </html>
  );
}
