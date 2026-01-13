/**
 * Features Page
 * Detailed overview of EMTChat features and capabilities
 */

'use client';

import React from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  FileText,
  Shield,
  Zap,
  Users,
  Clock,
  Search,
  Brain,
  Lock,
  Globe,
  BarChart,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FeatureSectionProps {
  title: string;
  description: string;
  features: {
    icon: React.ElementType;
    title: string;
    description: string;
  }[];
  reversed?: boolean;
}

function FeatureSection({ title, description, features, reversed }: FeatureSectionProps) {
  return (
    <section className="py-16">
      <div className={cn(
        'container mx-auto max-w-6xl px-4',
        'flex flex-col gap-12',
        reversed ? 'lg:flex-row-reverse' : 'lg:flex-row',
      )}>
        {/* Text content */}
        <div className="lg:w-1/2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {title}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            {description}
          </p>
          <div className="space-y-6">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex-shrink-0',
                  'bg-red-100 dark:bg-red-900/30',
                  'flex items-center justify-center',
                )}>
                  <feature.icon className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual placeholder */}
        <div className="lg:w-1/2">
          <div className={cn(
            'rounded-2xl aspect-video',
            'backdrop-blur-xl backdrop-saturate-150',
            'bg-gradient-to-br from-red-100/50 to-red-200/50 dark:from-red-900/20 dark:to-red-800/20',
            'border border-white/20 dark:border-white/10',
            'flex items-center justify-center',
          )}>
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 dark:bg-red-500/30 mx-auto mb-4 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Feature visualization
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <div className="py-12">
      {/* Hero */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Powerful Features for
            <br />
            <span className="text-red-600 dark:text-red-500">EMS Professionals</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            EMTChat combines advanced AI with enterprise security to help emergency medical teams access knowledge instantly.
          </p>
        </div>
      </section>

      {/* AI Chat Section */}
      <FeatureSection
        title="Intelligent Document Chat"
        description="Have natural conversations with your medical documents. Our AI understands context, medical terminology, and provides accurate, sourced answers."
        features={[
          {
            icon: Brain,
            title: 'Advanced RAG Technology',
            description: 'Retrieval-Augmented Generation ensures answers are grounded in your actual documents, not hallucinated.',
          },
          {
            icon: Search,
            title: 'Semantic Search',
            description: 'Find information even when you don\'t know the exact words. Our AI understands meaning, not just keywords.',
          },
          {
            icon: MessageSquare,
            title: 'Natural Conversations',
            description: 'Ask follow-up questions, request clarifications, and have back-and-forth discussions naturally.',
          },
        ]}
      />

      {/* Document Management Section */}
      <FeatureSection
        title="Comprehensive Document Management"
        description="Upload, organize, and manage all your medical protocols, guidelines, and reference materials in one secure location."
        features={[
          {
            icon: FileText,
            title: 'Multiple Format Support',
            description: 'Upload PDFs, Word documents, images, and more. We extract and index text automatically.',
          },
          {
            icon: Clock,
            title: 'Version History',
            description: 'Track changes to your documents over time. Always know when protocols were updated.',
          },
          {
            icon: Globe,
            title: 'Shared Knowledge Bases',
            description: 'Create organization-wide document repositories that everyone can access.',
          },
        ]}
        reversed
      />

      {/* Security Section */}
      <FeatureSection
        title="Enterprise-Grade Security"
        description="Built from the ground up with healthcare security requirements in mind. Your data is protected at every level."
        features={[
          {
            icon: Shield,
            title: 'HIPAA Compliant',
            description: 'Full compliance with HIPAA requirements for handling protected health information.',
          },
          {
            icon: Lock,
            title: 'End-to-End Encryption',
            description: 'All data is encrypted in transit and at rest using industry-standard encryption.',
          },
          {
            icon: BarChart,
            title: 'Audit Logging',
            description: 'Complete audit trails for all document access and queries for compliance reporting.',
          },
        ]}
      />

      {/* Team Features Section */}
      <FeatureSection
        title="Built for Teams"
        description="Collaborate effectively with your team. Share knowledge, manage access, and work together seamlessly."
        features={[
          {
            icon: Users,
            title: 'Team Workspaces',
            description: 'Create shared workspaces where team members can access common documents and knowledge bases.',
          },
          {
            icon: Smartphone,
            title: 'Mobile Access',
            description: 'Access your knowledge base from any device - desktop, tablet, or mobile phone.',
          },
          {
            icon: Zap,
            title: 'Real-Time Sync',
            description: 'Changes sync instantly across all team members. Everyone always has the latest information.',
          },
        ]}
        reversed
      />

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className={cn(
            'rounded-3xl p-8 md:p-12 text-center',
            'backdrop-blur-xl backdrop-saturate-150',
            'bg-gradient-to-br from-gray-900/90 to-gray-800/90 dark:from-gray-800/90 dark:to-gray-900/90',
            'border border-white/20',
          )}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
              Join hundreds of EMS departments already using EMTChat to improve their operations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register">
                <Button size="lg" className="bg-red-600 hover:bg-red-700 px-8">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="px-8 border-white text-white hover:bg-white/10">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
