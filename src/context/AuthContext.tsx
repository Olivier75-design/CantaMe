'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/site';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (redirectPath?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    // Create the account server-side, already email-confirmed (no SMTP needed),
    // then sign in to establish a browser session.
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Sign up failed' };
    } catch {
      return { error: 'Network error. Please try again.' };
    }

    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };

    // Self-heal accounts stuck as "Email not confirmed" (no SMTP configured):
    // confirm the account server-side, then retry the sign-in once.
    if (/not confirmed|confirm/i.test(error.message)) {
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (res.ok) {
          const retry = await supabase.auth.signInWithPassword({ email, password });
          if (!retry.error) return { error: null };
          return { error: retry.error.message };
        }
      } catch {
        /* fall through to original error */
      }
    }

    return { error: error.message };
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath: string = '/dashboard') => {
    const supabase = getSupabaseBrowser();
    const path = redirectPath.startsWith('/') ? redirectPath : '/dashboard';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // getSiteUrl() avoids the "null/dashboard" redirect that in-app
        // browsers produce; prefers NEXT_PUBLIC_SITE_URL when set.
        redirectTo: `${getSiteUrl()}${path}`,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
