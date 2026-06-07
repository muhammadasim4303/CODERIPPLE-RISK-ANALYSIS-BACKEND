import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Github, Zap, Shield, GitBranch, BarChart3,
  Network, Waves, ArrowRight, CheckCircle2, Star, ChevronRight,
  AlertTriangle, Code2, Layers, Search,
} from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/* ─── data ───────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <Shield className="h-5 w-5" />,
    color: 'text-risk-low',
    bg: 'bg-risk-low/10',
    title: 'Security Vulnerability Scanner',
    desc: 'Automatically detects exposed API keys, disabled CSRF guards, and injection risks — before they hit production.',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'text-primary',
    bg: 'bg-primary/10',
    title: 'AI-Powered Risk Scoring',
    desc: 'Every commit is scored 0–100 using an ML model trained on real-world code patterns. Know your blast radius instantly.',
  },
  {
    icon: <Network className="h-5 w-5" />,
    color: 'text-risk-medium',
    bg: 'bg-risk-medium/10',
    title: 'Dependency Graph Analysis',
    desc: 'Visualise how a single function change cascades across your entire codebase with an interactive ripple graph.',
  },
  {
    icon: <Waves className="h-5 w-5" />,
    color: 'text-risk-high',
    bg: 'bg-risk-high/10',
    title: 'Change Impact Analysis',
    desc: 'Track direct and indirect impact of every commit — see affected functions, ripple depth, and impacted files at a glance.',
  },
  {
    icon: <GitBranch className="h-5 w-5" />,
    color: 'text-primary',
    bg: 'bg-primary/10',
    title: 'Multi-Repo Support',
    desc: 'Analyse any public or private GitHub repository. All your risk data is persisted and searchable across sessions.',
  },
  {
    icon: <Code2 className="h-5 w-5" />,
    color: 'text-risk-low',
    bg: 'bg-risk-low/10',
    title: 'Function-Level Diff Insights',
    desc: 'Go beyond file diffs. See similarity scores, change types (Logic Change / Refactor / Format Only) per function.',
  },
];

const STEPS = [
  { icon: <Github className="h-5 w-5" />, step: '01', title: 'Connect GitHub', desc: 'Authorise CodeRipple with a single click. We request minimal, read-only scopes.' },
  { icon: <Search className="h-5 w-5" />, step: '02', title: 'Select a Repository', desc: 'Browse your repos and pick the one you want to analyse.' },
  { icon: <Layers className="h-5 w-5" />, step: '03', title: 'Analyse Commits', desc: 'Run instant AI risk analysis on any commit or pull request.' },
  { icon: <AlertTriangle className="h-5 w-5" />, step: '04', title: 'Act on Insights', desc: 'Receive actionable risk scores, security flags, and dependency graphs.' },
];

const STATS = [
  { value: '100+', label: 'Risk Rules' },
  { value: '<2s', label: 'Avg Analysis Time' },
  { value: '6', label: 'Analysis Modes' },
  { value: '∞', label: 'Repos Supported' },
];

/* ─── component ───────────────────────────────────────────── */
export default function Homepage() {
  useDocumentTitle('Home');
  const navigate = useNavigate();
  const { loginWithGitHub, user, authProvider } = useAuth();
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');

  const handleGitHub = async () => {
    setGithubLoading(true);
    setGithubError('');
    try {
      await loginWithGitHub();
    } catch (err: any) {
      setGithubError(err?.message ?? 'GitHub integration failed. Please try again.');
      setGithubLoading(false);
    }
  };

  return (
    <MainLayout title="Home">
      <div className="relative">

        {/* ── HERO ── */}
        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-4xl px-6 text-center">

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary animate-slide-up">
              <Star className="h-3.5 w-3.5 fill-primary" />
              AI-Powered Code Risk Intelligence
            </div>

            <h1 className="mb-6 text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight animate-slide-up [animation-delay:80ms]">
              Know the risk of every{' '}
              <span className="gradient-text">commit</span>{' '}
              before it ships
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed animate-slide-up [animation-delay:160ms]">
              CodeRipple analyses your GitHub commits with AI — scoring security vulnerabilities,
              logic changes, and dependency ripple effects in under 2 seconds.
            </p>

            <div
              id="integrate"
              className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up [animation-delay:240ms]"
            >
              <Button
                onClick={handleGitHub}
                disabled={githubLoading || authProvider === 'github'}
                size="lg"
                className={cn(
                  "h-11 px-8 gap-3 text-base font-semibold shadow-lg transition-all duration-300",
                  authProvider === 'github'
                    ? "bg-secondary text-muted-foreground border border-border cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 glow-primary hover:scale-105"
                )}
              >
                <Github className="h-5 w-5" />
                {authProvider === 'github'
                  ? 'Integrated with GitHub'
                  : (githubLoading ? 'Connecting to GitHub…' : 'Integrate with GitHub')}
                {authProvider !== 'github' && !githubLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/dashboard')}
                className="h-11 px-8 gap-2 border-border bg-secondary/50 hover:bg-secondary text-foreground text-base"
              >
                View Dashboard
              </Button>
            </div>

            {githubError && (
              <p className="mt-4 text-sm text-destructive">{githubError}</p>
            )}

            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up [animation-delay:320ms]">
              {STATS.map((s) => (
                <div key={s.label} className="glass-card rounded-2xl p-5">
                  <div className="text-3xl font-extrabold gradient-text">{s.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-24 border-y border-border/50 bg-secondary/20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Everything you need to ship with{' '}
                <span className="gradient-text">confidence</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-base">
                A complete toolkit for understanding, measuring, and reducing code-change risk.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="glass-card rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-slide-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-lg', f.bg, f.color)}>
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-24">
          <div className="mx-auto max-w-3xl px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Up and running in{' '}
                <span className="gradient-text">60 seconds</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-base">
                No complex setup. No CI/CD changes. Just connect, select, and analyse.
              </p>
            </div>

            <div className="space-y-4">
              {STEPS.map((s, i) => (
                <div
                  key={s.step}
                  className="glass-card rounded-2xl p-5 flex items-center gap-5 animate-slide-up hover:shadow-lg transition-all duration-300"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 text-primary">
                      {s.icon}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{s.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-0.5">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── GITHUB INTEGRATION CTA ── */}
        <section className="py-20 border-y border-border/50 bg-secondary/20">
          <div className="mx-auto max-w-md px-6 text-center">

            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 ring-1 ring-primary/20">
              <Github className="h-10 w-10 text-primary" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Connect your GitHub account
            </h2>
            <p className="text-muted-foreground mb-4 text-base leading-relaxed">
              We request the minimum required scopes —{' '}
              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">repo</code>,{' '}
              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">read:user</code>,{' '}
              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">user:email</code>.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6 text-sm text-muted-foreground">
              {['No credit card required', 'Read-only access', 'Revoke any time'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-risk-low" />
                  {t}
                </span>
              ))}
            </div>

            <Button
              onClick={handleGitHub}
              disabled={githubLoading || authProvider === 'github'}
              size="lg"
              className={cn(
                "w-full h-11 gap-3 text-base font-semibold shadow-lg transition-all duration-300",
                authProvider === 'github'
                  ? "bg-secondary text-muted-foreground border border-border cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 glow-primary hover:scale-105"
              )}
            >
              <Github className="h-5 w-5" />
              {authProvider === 'github'
                ? 'Integrated with GitHub'
                : (githubLoading ? 'Redirecting to GitHub…' : 'Integrate with GitHub')}
              {authProvider !== 'github' && !githubLoading && <ArrowRight className="h-4 w-4" />}
            </Button>

            {githubError && (
              <p className="mt-3 text-sm text-destructive">{githubError}</p>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </section>

      </div>

      {/* ── FOOTER ── */}
      <footer className="relative border-t border-border/50 bg-card/50 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold"><span className="gradient-text">CodeRipple</span></p>
                <p className="text-[11px] text-muted-foreground">AI Commit Risk Analyzer</p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
              <a href="#integrate" className="hover:text-foreground transition-colors">Integrate</a>
              <button onClick={() => navigate('/dashboard')} className="hover:text-foreground transition-colors">
                Dashboard
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} CodeRipple. All rights reserved.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {['Risk Scoring', 'Security Scanner', 'Dependency Graphs', 'Change Impact', 'Ripple Analysis', 'Multi-Repo'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </footer>

    </MainLayout>
  );
}