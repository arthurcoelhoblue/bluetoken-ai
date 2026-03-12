import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clearState = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
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
    } catch (error) {
      console.error('[Auth] Error in fetchProfile:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  // Force clear session from local storage and reset
  const handleClearSession = useCallback(async () => {
    console.log('[Auth] Clearing session manually');
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore signOut errors during recovery
    }
    clearState();
    setIsLoading(false);
    window.location.reload();
  }, [clearState]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    console.log('[Auth] Bootstrap start');
    let bootstrapDone = false;

    const finishBootstrap = () => {
      if (!bootstrapDone) {
        bootstrapDone = true;
        setIsLoading(false);
      }
    };

    // Safety timeout — always unblock UI
    const timeoutId = setTimeout(() => {
      if (!bootstrapDone) {
        console.warn('[Auth] Bootstrap timeout reached, forcing isLoading=false');
        finishBootstrap();
      }
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    // 1. Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Defer profile fetch to avoid deadlock — non-blocking
          setTimeout(() => {
            fetchProfile(currentSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }

        if (event === 'SIGNED_OUT') {
          clearState();
        }
      }
    );

    // 2. Check for existing session with error handling
    const initSession = async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[Auth] getSession error:', error.message);
          // Try local sign-out to clear corrupted tokens
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Ignore
          }
          clearState();
          finishBootstrap();
          return;
        }

        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          // Fetch profile but don't block bootstrap on it
          try {
            await fetchProfile(existingSession.user.id);
          } catch (profileErr) {
            console.error('[Auth] Profile fetch failed during bootstrap:', profileErr);
          }
        }

        finishBootstrap();
        console.log('[Auth] Bootstrap success');
      } catch (err) {
        console.error('[Auth] Bootstrap critical error:', err);
        clearState();
        finishBootstrap();
      }
    };

    initSession();

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile, clearState]);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    user,
    session,
    profile,
    roles,
    isLoading,
    isAuthenticated: !!session && !!user,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
    hasRole,
    hasPermission,
    refreshProfile,
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
