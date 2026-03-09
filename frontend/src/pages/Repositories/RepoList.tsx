import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Star, GitFork, Clock, Search, Filter, Lock, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useRepositories } from '@/hooks/useRepositories';
import { RiskBadge, RiskScoreBar } from '@/components/common/RiskBadge';
import { PageLoader } from '@/components/common/Loader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRelativeTime, formatNumber } from '@/utils/formatters';

// Language colour dots
const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-400',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-400',
  Go: 'bg-cyan-400',
  Rust: 'bg-orange-400',
  Java: 'bg-red-400',
  'C#': 'bg-purple-400',
  'C++': 'bg-pink-400',
  Ruby: 'bg-rose-500',
  PHP: 'bg-indigo-400',
};

export default function RepoList() {
  const { repositories, isLoading, error, refetch } = useRepositories();
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter]   = useState('all');

  const langs = ['all', ...Array.from(new Set(repositories.map(r => r.language).filter(Boolean) as string[]))];

  const filtered = repositories.filter(repo => {
    const matchSearch =
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchLang = langFilter === 'all' || repo.language === langFilter;
    return matchSearch && matchLang;
  });

  if (isLoading) {
    return <MainLayout title="Repositories"><PageLoader /></MainLayout>;
  }

  return (
    <MainLayout title="Repositories">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Repositories</h1>
            <p className="text-muted-foreground">{repositories.length} repositories connected</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search repositories…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-64 bg-secondary/50 pl-10 border-border"
              />
            </div>
            {/* Language filter */}
            <div className="flex items-center gap-1 flex-wrap">
              {langs.slice(0, 6).map(l => (
                <button
                  key={l}
                  onClick={() => setLangFilter(l)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                    langFilter === l
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {l === 'all' ? 'All' : l}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" className="border-border" onClick={refetch} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error} — showing cached data if available.</span>
          </div>
        )}

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((repo, index) => (
            <Link
              key={repo.id}
              to={`/repos/${encodeURIComponent(repo.full_name)}`}
              className={cn(
                'glass-card group rounded-xl p-5 transition-all hover:border-primary/30 hover:shadow-glow animate-slide-up',
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Card header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[140px]">
                        {repo.name}
                      </h3>
                      {repo.private && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                    {repo.language && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn('h-2.5 w-2.5 rounded-full', LANG_COLORS[repo.language] ?? 'bg-primary')} />
                        <span className="text-xs text-muted-foreground">{repo.language}</span>
                      </div>
                    )}
                  </div>
                </div>
                <RiskBadge score={repo.average_risk_score} size="sm" />
              </div>

              {/* Description */}
              {repo.description && (
                <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{repo.description}</p>
              )}

              {/* Topics / tags */}
              {repo.topics && repo.topics.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {repo.topics.slice(0, 4).map(t => (
                    <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {t}
                    </span>
                  ))}
                  {repo.topics.length > 4 && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      +{repo.topics.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Risk bar */}
              <div className="mb-3">
                <RiskScoreBar score={repo.average_risk_score} label="Average Risk" />
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" />{formatNumber(repo.stars_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="h-3.5 w-3.5" />{formatNumber(repo.forks_count)}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {repo.last_analyzed_at ? formatRelativeTime(repo.last_analyzed_at) : 'Never analyzed'}
                </span>
              </div>

              {/* Bottom risk counts */}
              <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{repo.total_commits_analyzed}</span> analyzed
                </span>
                {repo.high_risk_commits_count > 0 && (
                  <span className="text-risk-high font-medium">{repo.high_risk_commits_count} high risk</span>
                )}
                {repo.medium_risk_commits_count > 0 && (
                  <span className="text-risk-medium font-medium">{repo.medium_risk_commits_count} medium</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && !isLoading && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="text-center">
              <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No repositories found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Connect your GitHub account to see repositories'}
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
