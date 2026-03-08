import { useState, useEffect } from 'react';
import type { Commit, CommitDetails } from '@/api/commitApi';

// Mock commits data
const MOCK_COMMITS: Commit[] = [
  {
    sha: 'a1b2c3d4e5f6789012345678901234567890abcd',
    message: 'feat: Add user authentication flow with OAuth2 support',
    author: { name: 'Sarah Chen', email: 'sarah@example.com', avatar_url: 'https://i.pravatar.cc/150?u=sarah' },
    committed_at: '2024-02-15T10:30:00Z',
    overall_risk_score: 0.72,
    risk_label: 'HIGH',
    files_changed: 8,
    additions: 245,
    deletions: 34,
    analyzed: true,
  },
  {
    sha: 'b2c3d4e5f67890123456789012345678901bcde',
    message: 'fix: Resolve memory leak in data processing module',
    author: { name: 'Alex Kim', email: 'alex@example.com', avatar_url: 'https://i.pravatar.cc/150?u=alex' },
    committed_at: '2024-02-15T09:15:00Z',
    overall_risk_score: 0.45,
    risk_label: 'MEDIUM',
    files_changed: 3,
    additions: 67,
    deletions: 89,
    analyzed: true,
  },
  {
    sha: 'c3d4e5f678901234567890123456789012cdef',
    message: 'refactor: Simplify API response handlers',
    author: { name: 'Jordan Lee', email: 'jordan@example.com', avatar_url: 'https://i.pravatar.cc/150?u=jordan' },
    committed_at: '2024-02-14T16:45:00Z',
    overall_risk_score: 0.28,
    risk_label: 'LOW',
    files_changed: 5,
    additions: 112,
    deletions: 156,
    analyzed: true,
  },
  {
    sha: 'd4e5f6789012345678901234567890123defg',
    message: 'feat: Implement real-time notification system',
    author: { name: 'Morgan Taylor', email: 'morgan@example.com', avatar_url: 'https://i.pravatar.cc/150?u=morgan' },
    committed_at: '2024-02-14T14:20:00Z',
    overall_risk_score: 0.61,
    risk_label: 'HIGH',
    files_changed: 12,
    additions: 534,
    deletions: 23,
    analyzed: true,
  },
  {
    sha: 'e5f67890123456789012345678901234efgh',
    message: 'docs: Update API documentation and examples',
    author: { name: 'Casey Davis', email: 'casey@example.com', avatar_url: 'https://i.pravatar.cc/150?u=casey' },
    committed_at: '2024-02-14T11:00:00Z',
    overall_risk_score: 0.12,
    risk_label: 'LOW',
    files_changed: 4,
    additions: 189,
    deletions: 45,
    analyzed: true,
  },
  {
    sha: 'f6789012345678901234567890123456fghi',
    message: 'security: Patch SQL injection vulnerability in search',
    author: { name: 'Riley Johnson', email: 'riley@example.com', avatar_url: 'https://i.pravatar.cc/150?u=riley' },
    committed_at: '2024-02-13T15:30:00Z',
    overall_risk_score: 0.89,
    risk_label: 'CRITICAL',
    files_changed: 2,
    additions: 34,
    deletions: 12,
    analyzed: true,
  },
];

const MOCK_COMMIT_DETAILS: CommitDetails = {
  sha: 'a1b2c3d4e5f6789012345678901234567890abcd',
  message: 'feat: Add user authentication flow with OAuth2 support',
  author: { name: 'Sarah Chen', email: 'sarah@example.com', avatar_url: 'https://i.pravatar.cc/150?u=sarah' },
  committed_at: '2024-02-15T10:30:00Z',
  overall_risk_score: 0.72,
  risk_label: 'HIGH',
  files_changed: 8,
  additions: 245,
  deletions: 34,
  analyzed: true,
  risk_scores: {
    correctness: 0.65,
    security: 0.82,
    maintainability: 0.45,
    integration: 0.71,
  },
  risk_reasons: [
    'Authentication logic modified without corresponding test updates',
    'Sensitive token handling detected in new code paths',
    'High cyclomatic complexity in auth validation function',
    'Multiple external API integrations added',
  ],
  patch: `@@ -1,15 +1,45 @@
 import { useState, useCallback } from 'react';
+import { OAuth2Client } from './oauth';
+import { TokenManager } from './tokens';

 export function useAuth() {
-  const [user, setUser] = useState(null);
+  const [user, setUser] = useState<User | null>(null);
+  const [isLoading, setIsLoading] = useState(false);
+  const oauth = new OAuth2Client();
+
+  const authenticate = useCallback(async (provider: string) => {
+    setIsLoading(true);
+    try {
+      const token = await oauth.authorize(provider);
+      const userData = await TokenManager.validate(token);
+      setUser(userData);
+    } catch (error) {
+      console.error('Auth failed:', error);
+      throw error;
+    } finally {
+      setIsLoading(false);
+    }
+  }, []);

   return {
     user,
-    login: () => {},
-    logout: () => {}
+    isLoading,
+    authenticate,
+    logout: () => setUser(null)
   };
 }`,
  files: [
    { filename: 'src/hooks/useAuth.ts', status: 'modified', additions: 45, deletions: 12, patch: '...', risk_contribution: 0.35 },
    { filename: 'src/lib/oauth.ts', status: 'added', additions: 120, deletions: 0, patch: '...', risk_contribution: 0.28 },
    { filename: 'src/lib/tokens.ts', status: 'added', additions: 67, deletions: 0, patch: '...', risk_contribution: 0.22 },
    { filename: 'src/types/auth.ts', status: 'added', additions: 13, deletions: 0, patch: '...', risk_contribution: 0.05 },
  ],
};

export function useCommits(repoId?: string) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCommits = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        setCommits(MOCK_COMMITS);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch commits'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommits();
  }, [repoId]);

  const getCommitDetails = async (sha: string): Promise<CommitDetails | null> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (sha === MOCK_COMMIT_DETAILS.sha) {
      return MOCK_COMMIT_DETAILS;
    }
    // Return mock details with modified sha
    return { ...MOCK_COMMIT_DETAILS, sha };
  };

  return { commits, isLoading, error, getCommitDetails };
}
