import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Star, GitFork, Clock, Search, Filter, Lock, Plus, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useGithubRepos, useCreateGithubRepo } from '@/hooks/useGithubApi';
import { PageLoader } from '@/components/common/Loader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/formatters';
import { toast } from 'sonner';

export default function RepoList() {
  const [page, setPage] = useState(1);
  const { data: repos, isLoading, error } = useGithubRepos(page);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRepo, setNewRepo] = useState({ name: '', description: '', private: false, auto_init: true });
  const createRepo = useCreateGithubRepo();

  const filteredRepos = (repos || []).filter(
    (repo: any) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRepo = async () => {
    if (!newRepo.name.trim()) return;
    try {
      await createRepo.mutateAsync(newRepo);
      toast.success('Repository created successfully!');
      setCreateDialogOpen(false);
      setNewRepo({ name: '', description: '', private: false, auto_init: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create repository');
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Repositories">
        <PageLoader />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title="Repositories">
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
          <div className="text-center">
            <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Failed to load repositories</h3>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Repositories">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Repositories</h1>
            <p className="text-muted-foreground">
              {filteredRepos.length} repositories found
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 bg-secondary/50 pl-10 border-border"
              />
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                  New Repo
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Create New Repository</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Repository Name</Label>
                    <Input
                      placeholder="my-awesome-project"
                      value={newRepo.name}
                      onChange={(e) => setNewRepo((p) => ({ ...p, name: e.target.value }))}
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Description (optional)</Label>
                    <Textarea
                      placeholder="A short description of your project"
                      value={newRepo.description}
                      onChange={(e) => setNewRepo((p) => ({ ...p, description: e.target.value }))}
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Private Repository</Label>
                      <p className="text-xs text-muted-foreground">Only you can see this repository</p>
                    </div>
                    <Switch
                      checked={newRepo.private}
                      onCheckedChange={(v) => setNewRepo((p) => ({ ...p, private: v }))}
                    />
                  </div>
                  <Button
                    onClick={handleCreateRepo}
                    disabled={createRepo.isPending || !newRepo.name.trim()}
                    className="w-full bg-primary text-primary-foreground"
                  >
                    {createRepo.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Create Repository
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Repository Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRepos.map((repo: any, index: number) => (
            <Link
              key={repo.id}
              to={`/repos/${repo.owner.login}/${repo.name}`}
              className={cn(
                'glass-card group rounded-xl p-5 transition-all hover:border-primary/30 hover:shadow-glow animate-slide-up',
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {repo.name}
                      </h3>
                      {repo.private && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    {repo.language && (
                      <span className="text-xs text-muted-foreground">{repo.language}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {repo.description && (
                <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                  {repo.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" />
                    {repo.stargazers_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="h-3.5 w-3.5" />
                    {repo.forks_count}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatRelativeTime(repo.updated_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {filteredRepos.length === 0 && !isLoading && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="text-center">
              <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No repositories found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Create a repository to get started'}
              </p>
            </div>
          </div>
        )}

        {/* Pagination */}
        {(repos || []).length >= 30 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-border"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              className="border-border"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
