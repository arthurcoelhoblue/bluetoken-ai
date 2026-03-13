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
const FETCH_PROFILE_TIMEOUT_MS = 6000;

const t0 = Date.now();
function trace(code: string, extra?: Record<string, unknown>) {
  const elapsed = Date.now() - t0;
  const route = typeof window !== 'undefined' ? window.location.pathname : '?';
  console.info(`[Auth:TRACE] +${elapsed}ms ${code}`, { route, ...extra });
}

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

  const profileFetchInProgress = useRef(false);
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
    if (profileFetchInProgress.current) {
      trace('PROFILE_SKIP_DEDUP');
      return;
    }
    profileFetchInProgress.current = true;
    trace('PROFILE_START', { userId });

    try {
      const profilePromise = (async () => {
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
          supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', userId)
            .then(() => {});
        }

        trace('PROFILE_DATA_OK');

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
        trace('ROLES_OK');
      })();

      await withTimeout(profilePromise, FETCH_PROFILE_TIMEOUT_MS, 'fetchProfile');
    } catch (error) {
      console.error('[Auth] fetchProfile error/timeout:', error);
      trace('PROFILE_ERROR', { error: String(error) });
    } finally {
      setProfileLoaded(true);
      profileFetchInProgress.current = false;
      trace('PROFILE_LOADED_SET');
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      profileFetchInProgress.current = false;
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
    trace('BOOTSTRAP_START');
    let bootstrapDone = false;

    const finishBootstrap = (reason: string) => {
      if (!bootstrapDone) {
        bootstrapDone = true;
        setIsLoading(false);
        trace('BOOTSTRAP_FINISH', { reason });
      }
    };

    const timeoutId = setTimeout(() => {
      if (!bootstrapDone) {
        // Force profileLoaded so ProtectedRoute doesn't hang
        setProfileLoaded(true);
        finishBootstrap('timeout');
      }
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        trace('AUTH_STATE_CHANGE', { event, hasSession: !!currentSession });
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
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

    const initSession = async () => {
      try {
        trace('GET_SESSION_START');
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();

        if (error) {
          trace('GET_SESSION_ERROR', { error: error.message });
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
          clearState();
          setProfileLoaded(true);
          finishBootstrap('getSession_error');
          return;
        }

        if (!existingSession) {
          trace('NO_SESSION');
          clearState();
          setProfileLoaded(true);
          finishBootstrap('no_session');
          return;
        }

        // Validate session against backend
        try {
          trace('GET_USER_START');
          const { data: { user: verifiedUser }, error: userError } = await withTimeout(
            supabase.auth.getUser(),
            SESSION_VERIFY_TIMEOUT_MS,
            'getUser'
          );

          if (userError || !verifiedUser) {
            trace('SESSION_INVALID', { error: userError?.message });
            try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
            clearState();
            setProfileLoaded(true);
            finishBootstrap('stale_session_cleared');
            return;
          }

          setSession(existingSession);
          setUser(verifiedUser);
          setIsSessionVerified(true);
          trace('SESSION_VERIFIED', { userId: verifiedUser.id });

          bootstrapHandledProfile.current = true;
          try {
            await fetchProfile(verifiedUser.id);
          } catch (profileErr) {
            trace('PROFILE_FETCH_FAILED', { error: String(profileErr) });
            // profileLoaded is set in fetchProfile's finally block
          }

          finishBootstrap('success');
        } catch (verifyErr) {
          trace('GET_USER_TIMEOUT', { error: String(verifyErr) });
          // Fallback: use local session but still try to fetch profile
          setSession(existingSession);
          setUser(existingSession.user);
          setIsSessionVerified(true);
          bootstrapHandledProfile.current = true;

          // CRITICAL FIX: fetch profile even on timeout fallback
          try {
            await fetchProfile(existingSession.user.id);
          } catch {
            // profileLoaded set in finally
          }

          finishBootstrap('verify_timeout_fallback');
        }
      } catch (err) {
        trace('BOOTSTRAP_CRITICAL_ERROR', { error: String(err) });
        clearState();
        setProfileLoaded(true);
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
      profileFetchInProgress.current = false;
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
