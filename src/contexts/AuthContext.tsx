import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile, UserRole, ROLE_PERMISSIONS } from '@/types/auth';
import { AuthLoadingFallback } from '@/components/auth/AuthLoadingFallback';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: UserRole[];
  isLoading: boolean;
  isSessionVerified: boolean;
  profileLoaded: boolean;
  isAuthenticated: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;
const SESSION_VERIFY_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Deduplication: prevent concurrent fetchProfile calls
  const profileFetchInProgress = useRef(false);
  // Track if initSession already handled the first profile fetch
  const bootstrapHandledProfile = useRef(false);

  const clearState = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setIsSessionVerified(false);
    setProfileLoaded(false);
    profileFetchInProgress.current = false;
    bootstrapHandledProfile.current = false;
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    // Deduplicate: skip if already in progress
    if (profileFetchInProgress.current) {
      console.info('[Auth:TRACE] fetchProfile skipped (already in progress)');
      return;
    }
    profileFetchInProgress.current = true;
    console.info('[Auth:TRACE] fetchProfile start', userId);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('[Auth] Error fetching profile:', profileError);
        return;
      }

      if (profileData) {
        setProfile(profileData as UserProfile);
        // Fire-and-forget last_login update
        supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId)
          .then(() => {});
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('[Auth] Error fetching roles:', rolesError);
        return;
      }

      if (rolesData) {
        setRoles(rolesData.map(r => r.role as UserRole));
      }
      console.info('[Auth:TRACE] fetchProfile complete');
    } catch (error) {
      console.error('[Auth] Error in fetchProfile:', error);
    } finally {
      setProfileLoaded(true);
      profileFetchInProgress.current = false;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      profileFetchInProgress.current = false; // Allow refresh to proceed
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  const handleClearSession = useCallback(async () => {
    console.log('[Auth] Clearing session manually');
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch { /* ignore */ }
    clearState();
    setIsLoading(false);
    window.location.reload();
  }, [clearState]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    console.info('[Auth:TRACE] Bootstrap start');
    let bootstrapDone = false;

    const finishBootstrap = (label: string) => {
      if (!bootstrapDone) {
        bootstrapDone = true;
        setIsLoading(false);
        console.info(`[Auth:TRACE] Bootstrap finished: ${label}`);
      }
    };

    const timeoutId = setTimeout(() => {
      if (!bootstrapDone) {
        console.warn('[Auth:TRACE] Bootstrap timeout reached, forcing isLoading=false');
        finishBootstrap('timeout');
      }
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    // 1. Auth state listener — but DON'T fetch profile here if bootstrap will handle it
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.info('[Auth:TRACE] onAuthStateChange:', event);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Only fetch profile from listener if bootstrap already completed
          // This prevents double-fetching during initial load
          if (bootstrapDone && !bootstrapHandledProfile.current) {
            setTimeout(() => fetchProfile(currentSession.user.id), 0);
          }
        } else {
          setProfile(null);
          setRoles([]);
        }

        if (event === 'SIGNED_OUT') {
          clearState();
        }
      }
    );

    // 2. Check existing session with backend validation
    const initSession = async () => {
      try {
        console.info('[Auth:TRACE] getSession start');
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[Auth:TRACE] getSession error:', error.message);
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
          clearState();
          finishBootstrap('getSession_error');
          return;
        }

        if (!existingSession) {
          console.info('[Auth:TRACE] No session found');
          clearState();
          finishBootstrap('no_session');
          return;
        }

        // Validate session against backend
        try {
          console.info('[Auth:TRACE] getUser start');
          const { data: { user: verifiedUser }, error: userError } = await withTimeout(
            supabase.auth.getUser(),
            SESSION_VERIFY_TIMEOUT_MS,
            'getUser'
          );

          if (userError || !verifiedUser) {
            console.warn('[Auth:TRACE] Session invalid/expired:', userError?.message);
            try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
            clearState();
            finishBootstrap('stale_session_cleared');
            return;
          }

          setSession(existingSession);
          setUser(verifiedUser);
          setIsSessionVerified(true);
          console.info('[Auth:TRACE] Session verified:', verifiedUser.id);

          // Fetch profile — this is the SINGLE authoritative call
          bootstrapHandledProfile.current = true;
          try {
            await fetchProfile(verifiedUser.id);
          } catch (profileErr) {
            console.error('[Auth:TRACE] Profile fetch failed:', profileErr);
          }

          finishBootstrap('success');
        } catch (verifyErr) {
          console.warn('[Auth:TRACE] Session verification timeout:', verifyErr);
          setSession(existingSession);
          setUser(existingSession.user);
          setIsSessionVerified(true);
          bootstrapHandledProfile.current = true;
          finishBootstrap('verify_timeout_fallback');
        }
      } catch (err) {
        console.error('[Auth:TRACE] Bootstrap critical error:', err);
        clearState();
        finishBootstrap('critical_error');
      }
    };

    initSession();

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile, clearState]);

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      setIsSessionVerified(true);
      bootstrapHandledProfile.current = true;
      profileFetchInProgress.current = false; // Allow this explicit call
      await fetchProfile(data.user.id);
    }
    return { error: error as Error | null };
  };

  const signUpWithEmail = async (email: string, password: string, nome: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { nome, full_name: nome },
      },
    });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearState();
  };

  const hasRole = useCallback((role: UserRole) => {
    return roles.includes(role) || roles.includes('ADMIN');
  }, [roles]);

  const hasPermission = useCallback((permission: string) => {
    if (roles.includes('ADMIN')) return true;
    for (const role of roles) {
      const permissions = ROLE_PERMISSIONS[role];
      if (permissions.includes(permission)) return true;
      if (permissions.includes('*')) return true;
      if (permission.endsWith(':read') && permissions.includes('*:read')) return true;
      const [resource] = permission.split(':');
      if (permissions.includes(`${resource}:*`)) return true;
    }
    return false;
  }, [roles]);

  const value: AuthContextType = {
    user, session, profile, roles,
    isLoading, isSessionVerified, profileLoaded,
    isAuthenticated: !!session && !!user,
    signInWithEmail, signUpWithEmail, resetPassword, signOut,
    hasRole, hasPermission, refreshProfile,
  };

  if (isLoading) {
    return (
      <AuthContext.Provider value={value}>
        <AuthLoadingFallback onReload={handleReload} onClearSession={handleClearSession} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
