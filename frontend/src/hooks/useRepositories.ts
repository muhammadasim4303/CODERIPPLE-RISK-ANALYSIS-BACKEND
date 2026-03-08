import { useState, useEffect } from 'react';
import type { Repository } from '@/api/repoApi';

// Mock data for demo
const MOCK_REPOS: Repository[] = [
  {
    id: '1',
    name: 'frontend-app',
    full_name: 'org/frontend-app',
    description: 'Main web application built with React and TypeScript',
    private: false,
    language: 'TypeScript',
    stars_count: 234,
    forks_count: 45,
    open_issues_count: 12,
    default_branch: 'main',
    last_analyzed_at: '2024-02-15T10:30:00Z',
    average_risk_score: 0.42,
    total_commits_analyzed: 567,
    high_risk_commits_count: 8,
    created_at: '2023-01-15T00:00:00Z',
    updated_at: '2024-02-15T10:30:00Z',
  },
  {
    id: '2',
    name: 'payment-service',
    full_name: 'org/payment-service',
    description: 'Payment processing microservice with Stripe integration',
    private: true,
    language: 'Python',
    stars_count: 12,
    forks_count: 3,
    open_issues_count: 5,
    default_branch: 'main',
    last_analyzed_at: '2024-02-14T16:45:00Z',
    average_risk_score: 0.58,
    total_commits_analyzed: 234,
    high_risk_commits_count: 6,
    created_at: '2023-06-20T00:00:00Z',
    updated_at: '2024-02-14T16:45:00Z',
  },
  {
    id: '3',
    name: 'auth-module',
    full_name: 'org/auth-module',
    description: 'Authentication and authorization library',
    private: true,
    language: 'TypeScript',
    stars_count: 56,
    forks_count: 8,
    open_issues_count: 3,
    default_branch: 'main',
    last_analyzed_at: '2024-02-15T08:20:00Z',
    average_risk_score: 0.52,
    total_commits_analyzed: 189,
    high_risk_commits_count: 5,
    created_at: '2023-03-10T00:00:00Z',
    updated_at: '2024-02-15T08:20:00Z',
  },
  {
    id: '4',
    name: 'api-gateway',
    full_name: 'org/api-gateway',
    description: 'API gateway and routing service',
    private: false,
    language: 'Go',
    stars_count: 189,
    forks_count: 34,
    open_issues_count: 8,
    default_branch: 'main',
    last_analyzed_at: '2024-02-13T14:15:00Z',
    average_risk_score: 0.31,
    total_commits_analyzed: 456,
    high_risk_commits_count: 3,
    created_at: '2022-11-05T00:00:00Z',
    updated_at: '2024-02-13T14:15:00Z',
  },
  {
    id: '5',
    name: 'data-pipeline',
    full_name: 'org/data-pipeline',
    description: 'ETL data processing pipeline',
    private: true,
    language: 'Python',
    stars_count: 23,
    forks_count: 5,
    open_issues_count: 2,
    default_branch: 'main',
    last_analyzed_at: '2024-02-15T12:00:00Z',
    average_risk_score: 0.25,
    total_commits_analyzed: 401,
    high_risk_commits_count: 1,
    created_at: '2023-08-15T00:00:00Z',
    updated_at: '2024-02-15T12:00:00Z',
  },
];

export function useRepositories() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 400));
        setRepositories(MOCK_REPOS);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch repositories'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepos();
  }, []);

  const getRepository = (id: string) => {
    return repositories.find(r => r.id === id);
  };

  return { repositories, isLoading, error, getRepository };
}
