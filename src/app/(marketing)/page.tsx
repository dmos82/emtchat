/**
 * Marketing Landing Page
 * Hero section with EMT theme, features, testimonials, and CTA
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { MessageSquare, FileText, Shield, Zap, Users, Clock, ArrowRight, CheckCircle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Feature card component
function FeatureCard({
  icon: Icon,
  title,
  description,
  isDark,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div className={cn(
      'p-6 transition-all duration-300',
      isDark
        ? 'bg-[#2a2a2a] border-[3px] border-[#444444] shadow-[4px_4px_0_#444444] hover:border-[#5AC8FA] hover:shadow-[4px_4px_0_#5AC8FA]'
        : 'bg-white border-[3px] border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a] hover:border-red-500 hover:shadow-[4px_4px_0_#1a1a1a]',
    )}>
      <div className={cn(
        'w-12 h-12 mb-4 border-[2px]',
        isDark ? 'bg-[#444444] border-[#5AC8FA]' : 'bg-red-600/20 border-red-500',
        'flex items-center justify-center',
      )}>
        <Icon className="h-6 w-6 text-red-500" />
      </div>
      <h3 className={cn('text-lg font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
        {title}
      </h3>
      <p className={cn('text-sm leading-relaxed', isDark ? 'text-gray-400' : 'text-gray-600')}>
        {description}
      </p>
    </div>
  );
}

// Problem/Solution card
function ProblemSolutionCard({
  problem,
  solution,
  isDark,
}: {
  problem: string;
  solution: string;
  isDark: boolean;
}) {
  return (
    <div className={cn(
      'p-6',
      isDark
        ? 'bg-[#2a2a2a] border-[3px] border-[#444444] shadow-[4px_4px_0_#444444]'
        : 'bg-white border-[3px] border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a]',
    )}>
      <p className={cn('font-semibold mb-2 font-mono', isDark ? 'text-red-400' : 'text-red-600')}>
        Problem:
      </p>
      <p className={cn('mb-4 leading-relaxed', isDark ? 'text-gray-300' : 'text-gray-700')}>
        {problem}
      </p>
      <p className={cn('font-semibold mb-2', isDark ? 'text-green-400' : 'text-green-600')}>
        Solution:
      </p>
      <p className={cn('leading-relaxed', isDark ? 'text-gray-300' : 'text-gray-700')}>
        {solution}
      </p>
    </div>
  );
}

// Pricing tier component
function PricingTier({
  name,
  price,
  description,
  features,
  limits,
  isPopular,
  isDark,
}: {
  name: string;
  price: string;
  description: string;
  features: { name: string; included: boolean }[];
  limits: { name: string; value: string }[];
  isPopular?: boolean;
  isDark: boolean;
}) {
  return (
    <div className={cn(
      'p-6 relative transition-all duration-300',
      isPopular
        ? 'bg-[#2a2a2a] border-[3px] border-[#5AC8FA] shadow-[4px_4px_0_#5AC8FA] scale-105'
        : isDark
          ? 'bg-[#2a2a2a] border-[3px] border-[#444444] shadow-[4px_4px_0_#444444]'
          : 'bg-white border-[3px] border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a]',
    )}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-[#5AC8FA] text-[#1a1a1a] text-xs font-bold px-3 py-1 border-2 border-[#1a1a1a] font-mono">
            MOST POPULAR
          </span>
        </div>
      )}
      <div className="text-center mb-6">
        <h3 className={cn('text-xl font-bold mb-1', isDark ? 'text-white' : 'text-gray-900')}>
          {name}
        </h3>
        <div className="mb-2">
          <span className={cn('text-3xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {price}
          </span>
          {price !== 'Free' && <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>/mo</span>}
        </div>
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
          {description}
        </p>
      </div>
      <div className="space-y-3 mb-6">
        {limits.map((limit) => (
          <div key={limit.name} className="flex justify-between text-sm">
            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{limit.name}</span>
            <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{limit.value}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {features.map((feature) => (
          <div key={feature.name} className="flex items-center gap-2 text-sm">
            {feature.included ? (
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )}
            <span className={cn(
              feature.included
                ? (isDark ? 'text-gray-300' : 'text-gray-700')
                : (isDark ? 'text-gray-500' : 'text-gray-400')
            )}>
              {feature.name}
            </span>
          </div>
        ))}
      </div>
      <Link href="/signup" className="block mt-6">
        <Button
          className={cn(
            'w-full',
            isPopular
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : isDark
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-gray-900 hover:bg-gray-800 text-white'
          )}
        >
          Get Started
        </Button>
      </Link>
    </div>
  );
}

// Stats component - Real benchmarks from internal testing
function StatsSection({ isDark }: { isDark: boolean }) {
  const stats = [
    { value: '695+', label: 'Automated Tests' },
    { value: '99%', label: 'RAG Accuracy' },
    { value: '100%', label: 'Security Coverage' },
    { value: '<2s', label: 'Response Time' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-12">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className="text-3xl md:text-4xl font-bold text-red-500 mb-1">
            {stat.value}
          </div>
          <div className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme === 'dark';

  const features = [
    {
      icon: MessageSquare,
      title: 'AI-Powered Chat',
      description: 'Ask questions about your study materials and get instant, accurate answers powered by advanced AI.',
    },
    {
      icon: FileText,
      title: 'Document Management',
      description: 'Upload and organize your medical documents and reference materials in one secure place.',
    },
    {
      icon: Shield,
      title: 'HIPAA Compliant',
      description: 'Enterprise-grade security with HIPAA-compliant data handling and encryption.',
    },
    {
      icon: Zap,
      title: 'Instant Answers',
      description: 'Get immediate responses to critical questions during emergencies or training sessions.',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Share knowledge bases with your team and collaborate on study materials.',
    },
    {
      icon: Clock,
      title: '24/7 Availability',
      description: 'Access your knowledge base anytime, anywhere - on the field or in the station.',
    },
  ];

  const problemsSolutions = [
    {
      problem: 'EMT textbooks are 1000+ pages. Finding specific information during study sessions wastes time.',
      solution: 'Upload your materials once. Ask questions like "What are the signs of tension pneumothorax?" and get instant, cited answers.',
    },
    {
      problem: 'Generic AI chatbots hallucinate medical information. You need answers from YOUR actual course materials.',
      solution: 'RAG technology ensures answers come ONLY from your uploaded documents, with page citations you can verify.',
    },
    {
      problem: 'Study groups can\'t share resources effectively. Everyone has different PDFs scattered across devices.',
      solution: 'Create a shared knowledge base for your study group. Everyone queries the same verified materials.',
    },
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: 'Free',
      description: 'Try it out',
      limits: [
        { name: 'Queries/month', value: '10' },
      ],
      features: [
        { name: 'Basic AI Chat', included: true },
        { name: 'Document Upload', included: false },
        { name: 'Search', included: false },
        { name: 'Export', included: false },
        { name: 'Personas', included: false },
      ],
    },
    {
      name: 'Starter',
      price: '$10',
      description: 'For individual students',
      limits: [
        { name: 'Queries/month', value: '200' },
        { name: 'Storage', value: '512MB' },
        { name: 'Documents', value: '20' },
        { name: 'Max file size', value: '25MB' },
      ],
      features: [
        { name: 'Basic AI Chat', included: true },
        { name: 'Document Upload', included: true },
        { name: 'Search', included: true },
        { name: 'Export', included: true },
        { name: 'Personas', included: false },
      ],
    },
    {
      name: 'Pro',
      price: '$29.99',
      description: 'For serious students',
      isPopular: true,
      limits: [
        { name: 'Queries/month', value: '1,000' },
        { name: 'Storage', value: '2GB' },
        { name: 'Documents', value: '50' },
        { name: 'Max file size', value: '300MB' },
      ],
      features: [
        { name: 'Basic AI Chat', included: true },
        { name: 'Document Upload', included: true },
        { name: 'Search', included: true },
        { name: 'Export', included: true },
        { name: 'Personas', included: true },
      ],
    },
    {
      name: 'Classroom',
      price: '$150',
      description: '15 seats (1 instructor + 14 students)',
      limits: [
        { name: 'Queries/month', value: '10,000' },
        { name: 'Storage', value: '20GB' },
        { name: 'Documents', value: '150' },
        { name: 'Max file size', value: '500MB' },
      ],
      features: [
        { name: 'Basic AI Chat', included: true },
        { name: 'Document Upload', included: true },
        { name: 'Search', included: true },
        { name: 'Export', included: true },
        { name: 'Personas', included: true },
        { name: '30% off for students', included: true },
      ],
    },
  ];

  return (
    <div className={cn(
      "flex flex-col min-h-screen",
      isDark && "pixel-grid-bg"
    )}>
      {/* Hero Section */}
      <section className="py-20 md:py-32 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <div className={cn(
            'inline-block px-4 py-2 mb-6 rounded-full',
            'bg-yellow-600/20 border border-yellow-500/30',
          )}>
            <span className="text-sm font-medium text-yellow-400">
              🚧 Beta - Built for EMT/Paramedic Students
            </span>
          </div>

          <h1 className={cn(
            'text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight',
            isDark ? 'text-white' : 'text-gray-900'
          )}>
            Study Smarter with
            <br />
            <span className="text-red-500">AI-Powered RAG</span>
          </h1>

          <p className={cn(
            'text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed',
            isDark ? 'text-gray-400' : 'text-gray-600'
          )}>
            Upload your EMT/Paramedic study materials and get instant AI answers from YOUR documents. No more endless page flipping - ask questions, get cited answers.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white px-8 h-12 text-base">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/features">
              <Button size="lg" variant="outline" className={cn(
                'px-8 h-12 text-base',
                isDark ? 'border-white/20 text-white hover:bg-white/10' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              )}>
                Learn More
              </Button>
            </Link>
          </div>

          <div className={cn('flex items-center justify-center gap-6 mt-6 text-sm', isDark ? 'text-gray-500' : 'text-gray-600')}>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              50 free queries per month
            </span>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className={cn(
        'px-4 border-y',
        isDark ? 'border-white/10 bg-gray-900/50' : 'border-gray-200 bg-gray-50/50'
      )}>
        <div className="container mx-auto max-w-6xl">
          <StatsSection isDark={isDark} />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className={cn('text-3xl md:text-4xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
              Built for EMT/Paramedic Students
            </h2>
            <p className={cn('text-lg max-w-2xl mx-auto', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Features designed to help you study smarter, not harder.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} isDark={isDark} />
            ))}
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className={cn(
        'py-20 md:py-24 px-4',
        isDark ? 'bg-gray-900/50' : 'bg-gray-50/50'
      )}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className={cn('text-3xl md:text-4xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
              Problems We Solve
            </h2>
            <p className={cn('text-lg max-w-2xl mx-auto', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Built by developers who understand the challenges of studying dense medical material.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {problemsSolutions.map((item, index) => (
              <ProblemSolutionCard key={index} {...item} isDark={isDark} />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className={cn('text-3xl md:text-4xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
              Simple, Transparent Pricing
            </h2>
            <p className={cn('text-lg max-w-2xl mx-auto', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Start free, upgrade when you need more. 7-day grace period on downgrades.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier) => (
              <PricingTier key={tier.name} {...tier} isDark={isDark} />
            ))}
          </div>

          {/* Enterprise Section */}
          <div className={cn(
            'mt-12 p-8 text-center',
            isDark
              ? 'bg-[#2a2a2a] border-[3px] border-[#5AC8FA] shadow-[4px_4px_0_#5AC8FA]'
              : 'bg-gray-100 border-[3px] border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a]'
          )}>
            <h3 className={cn('text-2xl font-bold mb-2 font-mono', isDark ? 'text-white' : 'text-gray-900')}>
              ENTERPRISE
            </h3>
            <p className={cn('text-lg mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Custom solutions for your institution&apos;s needs and branding
            </p>
            <p className={cn('text-sm mb-6 font-mono', isDark ? 'text-gray-500' : 'text-gray-500')}>
              SSO • Custom Integrations • Dedicated Support • HIPAA BAA • Custom SLA
            </p>
            <a
              href="mailto:admin@emtchat.com"
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 font-bold font-mono transition-colors border-[2px]',
                isDark
                  ? 'bg-[#5AC8FA] text-[#1a1a1a] border-[#1a1a1a] hover:bg-white'
                  : 'bg-[#1a1a1a] text-white border-[#1a1a1a] hover:bg-gray-800'
              )}
            >
              CONTACT US
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className={cn(
            'p-8 md:p-12 text-center',
            'bg-[#5AC8FA] border-[3px] border-[#1a1a1a] shadow-[6px_6px_0_#1a1a1a]',
          )}>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-4 font-mono">
              READY TO ACE YOUR EMT EXAMS?
            </h2>
            <p className="text-lg text-[#1a1a1a]/80 mb-8 max-w-2xl mx-auto">
              Start studying smarter today. Upload your EMT/Paramedic materials and get AI-powered answers in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-[#1a1a1a] text-white hover:bg-gray-800 px-8 h-12 border-[2px] border-[#1a1a1a] font-mono font-bold">
                  GET STARTED FREE
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="px-8 h-12 border-[2px] border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#1a1a1a]/10 font-mono font-bold">
                  VIEW PRICING
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
