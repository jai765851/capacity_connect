import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getAppIntegrationConfig } from '../config/env';
import { supabase } from '../lib/supabaseClient';
import { authService } from '../services/authService';
import { AuthUser } from '../types/auth';

interface AuthContextValue {
  currentUser: AuthUser | null;
  session: Session | null;
  isSupabaseConfigured: boolean;
  authLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const config = getAppIntegrationConfig();
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(Boolean(supabase));
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadUserProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setCurrentUser(null);
      setProfileError(null);
      setAuthLoading(false);
      return;
    }

    const { user, error } = await authService.fetchProfileById(
      activeSession.user.id,
      activeSession.user
    );

    if (error || !user) {
      setCurrentUser(null);
      setProfileError(error ?? 'Unable to load user profile.');
    } else if (user.accountStatus === 'suspended') {
      await authService.signOut();
      setSession(null);
      setCurrentUser(null);
      setProfileError('This account has been suspended by an administrator.');
    } else {
      setCurrentUser(user);
      setProfileError(null);
    }

    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setProfileError(error.message);
        setAuthLoading(false);
        return;
      }
      setSession(data.session);
      loadUserProfile(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      loadUserProfile(nextSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadUserProfile(data.session);
  }, [loadUserProfile]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setCurrentUser(null);
    setProfileError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      session,
      isSupabaseConfigured: config.isSupabaseConfigured,
      authLoading,
      profileError,
      refreshProfile,
      signOut,
    }),
    [
      currentUser,
      session,
      config.isSupabaseConfigured,
      authLoading,
      profileError,
      refreshProfile,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
