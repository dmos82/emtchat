/**
 * Marketing Landing Page
 * Hero section with EMT theme, features, testimonials, and CTA
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, FileText, Shield, Zap, Users, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Feature card component
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className={cn(
      'rounded-2xl p-6',
      'bg-gray-900/80 backdrop-blur-sm',
      'border border-white/10',
      'hover:border-red-500/30 hover:bg-gray-900/90',
      'transition-all duration-300',
    )}>
      <div className={cn(
        'w-12 h-12 rounded-xl mb-4',
        'bg-red-600/20',
        'flex items-center justify-center',
      )}>
        <Icon className="h-6 w-6 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-400 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// Testimonial card
function TestimonialCard({
  quote,
  author,
  role,
}: {
  quote: string;
  author: string;
  role: string;
}) {
  return (
    <div className={cn(
      'rounded-2xl p-6',
      'bg-gray-900/80 backdrop-blur-sm',
      'border border-white/10',
    )}>
      <p className="text-gray-300 italic mb-4 leading-relaxed">
        &ldquo;{quote}&rdquo;
      </p>
      <div>
        <p className="font-semibold text-white">{author}</p>
        <p className="text-sm text-gray-500">{role}</p>
      </div>
    </div>
  );
}

// Stats component
function StatsSection() {
  const stats = [
    { value: '500+', label: 'EMS Departments' },
    { value: '50K+', label: 'Queries Answered' },
    { value: '99.9%', label: 'Uptime' },
    { value: '<2s', label: 'Response Time' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-12">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className="text-3xl md:text-4xl font-bold text-red-500 mb-1">
            {stat.value}
          </div>
          <div className="text-sm text-gray-400">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const features = [
    {
      icon: MessageSquare,
      title: 'AI-Powered Chat',
      description: 'Ask questions about your medical protocols and get instant, accurate answers powered by advanced AI.',
    },
    {
      icon: FileText,
      title: 'Document Management',
      description: 'Upload and organize your medical documents, protocols, and reference materials in one secure place.',
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
      description: 'Share knowledge bases with your team and collaborate on protocols and procedures.',
    },
    {
      icon: Clock,
      title: '24/7 Availability',
      description: 'Access your knowledge base anytime, anywhere - on the field or in the station.',
    },
  ];

  const testimonials = [
    {
      quote: 'EMTChat has transformed how our department accesses protocols. Response times are faster and more accurate.',
      author: 'Sarah Mitchell',
      role: 'Paramedic Supervisor, Metro Fire Department',
    },
    {
      quote: 'The AI understands medical terminology perfectly. Its like having a senior EMT always available to answer questions.',
      author: 'James Rodriguez',
      role: 'EMT-B, City Ambulance Services',
    },
    {
      quote: 'Training new EMTs has never been easier. They can look up any protocol instantly and learn on the job.',
      author: 'Dr. Emily Chen',
      role: 'Medical Director, Regional EMS',
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="py-20 md:py-32 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <div className={cn(
            'inline-block px-4 py-2 mb-6 rounded-full',
            'bg-red-600/20 border border-red-500/30',
          )}>
            <span className="text-sm font-medium text-red-400">
              Trusted by 500+ EMS Departments
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Your AI-Powered
            <br />
            <span className="text-red-500">Medical Knowledge Base</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            EMTChat helps Emergency Medical Technicians access protocols, procedures, and medical knowledge instantly using AI-powered document chat.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white px-8 h-12 text-base">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/features">
              <Button size="lg" variant="outline" className="px-8 h-12 text-base border-white/20 text-white hover:bg-white/10">
                Learn More
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
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
      <section className="px-4 border-y border-white/10 bg-gray-900/50">
        <div className="container mx-auto max-w-6xl">
          <StatsSection />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need for EMS Excellence
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Powerful features designed specifically for emergency medical professionals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 md:py-24 px-4 bg-gray-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by EMS Professionals
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              See what emergency medical professionals are saying about EMTChat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <TestimonialCard key={testimonial.author} {...testimonial} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className={cn(
            'rounded-3xl p-8 md:p-12 text-center',
            'bg-gradient-to-br from-red-600 to-red-800',
            'border border-red-500/30',
          )}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your EMS Operations?
            </h2>
            <p className="text-lg text-red-100 mb-8 max-w-2xl mx-auto">
              Join hundreds of EMS departments already using EMTChat to improve response times and protocol adherence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-white text-red-600 hover:bg-gray-100 px-8 h-12">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="px-8 h-12 border-white/30 text-white hover:bg-white/10">
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
