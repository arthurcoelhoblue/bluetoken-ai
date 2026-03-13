import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

const PERMISSIONS_TIMEOUT_MS = 10000;
const PROFILE_WAIT_TIMEOUT_MS = 12000;

interface ProtectedRouteProps {
  children: React.ReactNode;
  screenKey?: string;
  /** @deprecated Use screenKey instead */
  requiredRoles?: string[];
  requiredPermission?: string;
}

export function ProtectedRoute({ 
  children, 
  screenKey,
  requiredRoles,
  requiredPermission 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission, profile, profileLoaded, roles } = useAuth();
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const { data: permissions, isLoading: permissionsLoading, isError: permissionsError } = useScreenPermissions();
  const [permissionsTimedOut, setPermissionsTimedOut] = useState(false);
  const [profileTimedOut, setProfileTimedOut] = useState(false);

  // Timeout for permissions loading
  useEffect(() => {
    if (!permissionsLoading) {
      setPermissionsTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      if (permissionsLoading) {
        console.warn('[ProtectedRoute] Permissions loading timed out');
        setPermissionsTimedOut(true);
      }
    }, PERMISSIONS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [permissionsLoading]);

  // Timeout for profile loading - prevents infinite spinner
  useEffect(() => {
    if (profileLoaded) {
      setProfileTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!profileLoaded) {
        console.warn('[ProtectedRoute] Profile loading timed out');
        setProfileTimedOut(true);
      }
    }, PROFILE_WAIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [profileLoaded]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Verifica se usuário está ativo
  if (profile && !profile.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acesso Desativado</h1>
          <p className="text-muted-foreground">
            Sua conta foi desativada. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  // Wait for profile/roles to load — but with timeout recovery
  if (!profileLoaded && !profileTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  // If profile timed out, show recovery UI
  if (profileTimedOut && !profileLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-sm text-muted-foreground">
            O carregamento do perfil está demorando mais que o esperado.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
        </div>
      </div>
    );
  }

  // Admin always has full access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Handle permissions error or timeout
  if (permissionsError || permissionsTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-sm text-muted-foreground">
            {permissionsTimedOut 
              ? 'O carregamento de permissões está demorando mais que o esperado.' 
              : 'Erro ao carregar permissões.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
        </div>
      </div>
    );
  }

  // Still loading permissions (non-admin)
  if (permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // Check screen-level permission from access profiles
  if (screenKey && permissions) {
    if (!permissions[screenKey]?.view) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Verifica permissão requerida (legacy)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
