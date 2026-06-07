import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, ShieldCheck, FileText, Scale } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function TermsOfService() {
  useDocumentTitle('Terms of Service');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const content = (
    <div className="mx-auto max-w-4xl space-y-8 py-4 animate-slide-up">
      {/* Header card */}
      <div className="glass-card rounded-2xl p-8 bg-gradient-to-br from-primary/5 via-secondary/30 to-background border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary font-medium">
            <Scale className="h-3 w-3" />
            Legal Agreement
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Last updated: June 7, 2026</p>
        </div>
        <div className="h-16 w-16 bg-primary/15 rounded-2xl flex items-center justify-center text-primary shrink-0">
          <FileText className="h-8 w-8" />
        </div>
      </div>

      {/* Main body card */}
      <div className="glass-card rounded-2xl p-8 space-y-8 border border-border/40 bg-card/40 backdrop-blur-md">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary font-mono">1</span>
            Acceptance of Terms
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Welcome to CodeRipple. By accessing, connecting your GitHub repositories, or using our AI-powered code analysis tools (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these terms, please do not use our Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary font-mono">2</span>
            Description of Service
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            CodeRipple provides automated git commit analysis, risk scoring, change impact metrics, and dependency ripple graphs using machine learning models. The insights provided are for analysis and informational purposes. We do not guarantee the detection of all errors or security flaws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary font-mono">3</span>
            GitHub Integration & Data Scopes
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            To use the Service, you must authorize access via GitHub OAuth. We request minimal scopes (<code className="bg-secondary px-1.5 py-0.5 rounded text-xs">repo</code>, <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">read:user</code>, <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">user:email</code>). You are responsible for ensuring that you have the appropriate permissions to connect repositories to CodeRipple.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary font-mono">4</span>
            User Responsibilities & Code Security
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You agree not to use the Service to analyze malicious code or for any illegal activities. CodeRipple processes code metadata and changes to compute scores. You retain all ownership and intellectual property rights to your repositories.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary font-mono">5</span>
            Termination & Data Wiping
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You may stop using the Service and delete your account at any time. Clicking the "Delete Account" button in your Settings page and completing the double-confirmation process will permanently delete all records of your repositories, commits risk assessment, change impact details, and user profiles from both Firebase and Supabase.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary font-mono">6</span>
            Disclaimer of Warranties
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES OF ANY KIND. CODERIPPLE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary font-mono">7</span>
            Limitation of Liability
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            IN NO EVENT SHALL CODERIPPLE OR ITS PROVIDERS BE LIABLE FOR ANY DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF BUSINESS PROFITS, BUSINESS INTERRUPTION, LOSS OF DATA OR CODE) ARISING OUT OF THE USE OF OR INABILITY TO USE THE SERVICE.
          </p>
        </section>
      </div>

      {/* Footer support text */}
      <div className="flex justify-center gap-2 items-center text-xs text-muted-foreground pt-4">
        <ShieldCheck className="h-4 w-4 text-risk-low" />
        <span>Secured, audited, and open-source compliance standards.</span>
      </div>
    </div>
  );

  // If authenticated, wrap in MainLayout
  if (isAuthenticated) {
    return <MainLayout title="Terms of Service">{content}</MainLayout>;
  }

  // If not authenticated, render with public clean wrapper
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Public Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-lg">CodeRipple</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/login')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Button>
        </div>
      </header>

      {/* Public main container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
        {content}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CodeRipple. All rights reserved.
      </footer>
    </div>
  );
}
