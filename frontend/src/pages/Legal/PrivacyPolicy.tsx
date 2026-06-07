import { useAuth } from '@/context/AuthContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Shield, Eye, Lock } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function PrivacyPolicy() {
  useDocumentTitle('Privacy Policy');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const content = (
    <div className="mx-auto max-w-4xl space-y-8 py-4 animate-slide-up">
      {/* Header card */}
      <div className="glass-card rounded-2xl p-8 bg-gradient-to-br from-risk-low/5 via-secondary/30 to-background border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-risk-low/10 px-3 py-1 text-xs text-risk-low font-medium">
            <Lock className="h-3 w-3" />
            Security & Trust
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: June 7, 2026</p>
        </div>
        <div className="h-16 w-16 bg-risk-low/15 rounded-2xl flex items-center justify-center text-risk-low shrink-0">
          <Eye className="h-8 w-8" />
        </div>
      </div>

      {/* Main body card */}
      <div className="glass-card rounded-2xl p-8 space-y-8 border border-border/40 bg-card/40 backdrop-blur-md">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-risk-low/10 text-xs text-risk-low font-mono">1</span>
            Information We Collect
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-2">
            CodeRipple operates as a client-centric AI risk analyzer. When you connect via GitHub, we securely retrieve:
          </p>
          <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
            <li>Basic profile information (GitHub avatar, email, username).</li>
            <li>GitHub personal access tokens (encrypted and stored to authorize commit fetching).</li>
            <li>Commit metadata, diff patches, file structures, and code statements strictly for the execution of risk evaluations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-risk-low/10 text-xs text-risk-low font-mono">2</span>
            How We Use Your Data
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your data is used solely to generate AI risk assessment metrics, correctness classifications, vulnerability detection reports, and dependency graphs. We do not sell, rent, or distribute your repository contents or commit metadata to third-party advertisers. All LLM and API parsing runs locally or via secure API calls.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-risk-low/10 text-xs text-risk-low font-mono">3</span>
            Data Storage and Security
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We store authentication details, access tokens, and repository settings in Supabase. Commit analytics summaries, change impact results, and vulnerability logs are stored securely in Firebase Firestore. We employ industry-standard encryption protocols (SSL/TLS) to safeguard your connection tokens.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-risk-low/10 text-xs text-risk-low font-mono">4</span>
            Your Rights and Control (Right to be Forgotten)
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We respect your privacy. You have complete control over your data:
          </p>
          <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
            <li><strong>Access:</strong> You can view all analyzed repositories and stats from your dashboard.</li>
            <li><strong>Wiping:</strong> In your Settings, you can choose to "Delete Account." This executes a complete purge of all profiles, OAuth tokens, and issues inside Supabase, alongside your collection data, repository records, and commit risk ratings inside Firebase.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-risk-low/10 text-xs text-risk-low font-mono">5</span>
            Changes to this Policy
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We may update our Privacy Policy from time to time. We will notify you of any material changes by updating the "Last updated" date of this document and providing notice within the Service dashboard.
          </p>
        </section>
      </div>

      {/* Footer support text */}
      <div className="flex justify-center gap-2 items-center text-xs text-muted-foreground pt-4">
        <Shield className="h-4 w-4 text-primary" />
        <span>Enterprise grade encryption and end-to-end user privacy controls.</span>
      </div>
    </div>
  );

  // If authenticated, wrap in MainLayout
  if (isAuthenticated) {
    return <MainLayout title="Privacy Policy">{content}</MainLayout>;
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
