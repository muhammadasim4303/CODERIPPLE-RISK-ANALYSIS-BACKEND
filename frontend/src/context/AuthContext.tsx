/**
 * AuthContext — Supabase authentication.
 * Exposes the same API shape as the original mock so all pages continue to work.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SBUser } from '@supabase/supabase-js';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sbUserToUser(sbUser: SBUser): User {
  const meta = sbUser.user_metadata ?? {};
  return {
    id: sbUser.id,
    username: meta.user_name ?? meta.preferred_username ?? meta.name ?? sbUser.email?.split('@')[0] ?? 'user',
    email: sbUser.email ?? '',
    avatar_url: meta.avatar_url ?? meta.picture ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${sbUser.id}`,
  };
}

async function saveGitHubToken(userId: string, providerToken: string) {
  await supabase
    .from('github_tokens')
    .upsert({
      user_id: userId,
      access_token: providerToken,
      token_type: 'bearer',
      scope: 'repo,user',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(sbUserToUser(session.user));
        // Save token if available on initial load
        if (session.provider_token) {
          saveGitHubToken(session.user.id, session.provider_token);
        }
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? sbUserToUser(session.user) : null);
      setIsLoading(false);

      // Save fresh GitHub token on every login
      if (session?.provider_token && session?.user) {
        saveGitHubToken(session.user.id, session.provider_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email?: string, password?: string) => {
    if (!email || !password) throw new Error('Email and password required');
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) throw error;
  };

  const signup = async (email: string, password: string, username: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, user_name: username } },
    });
    setIsLoading(false);
    if (error) throw error;
  };

  const loginWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'repo read:user user:email',
      },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoading,
      login, signup, loginWithGitHub, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}