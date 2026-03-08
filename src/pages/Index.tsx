import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { lazy } from 'react';

const LandingPage = lazy(() => import('@/pages/LandingPage'));

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/meu-dia" replace />;
  }

  return <LandingPage />;
}
