import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Screen key from SCREEN_REGISTRY — used to check view permission */
  screenKey?: string;
  /** @deprecated Use screenKey instead. Kept only for backward compat. */
  requiredRoles?: string[];
  requiredPermission?: string;
}

export function ProtectedRoute({ 
  children, 
  screenKey,
  requiredRoles,
  requiredPermission 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission, profile } = useAuth();
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const { data: permissions, isLoading: permissionsLoading } = useScreenPermissions();

  if (isLoading || permissionsLoading) {
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

  // Admin always has full access
  if (isAdmin) {
    return <>{children}</>;
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
