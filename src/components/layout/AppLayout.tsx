import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CompanyProvider } from '@/contexts/CompanyContext';
import { Navigate } from 'react-router-dom';
import { ZadarmaPhoneWidget } from '@/components/zadarma/ZadarmaPhoneWidget';
import { useGamificationNotifications } from '@/hooks/useGamificationNotifications';

interface AppLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AppLayout({ children, requireAuth = true }: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  useGamificationNotifications();

  return (
    <ThemeProvider>
      <CompanyProvider>
        <SidebarProvider defaultOpen={true}>
          <div className="h-screen flex w-full overflow-hidden">
            <AppSidebar />
            <SidebarInset className="flex flex-col min-w-0 min-h-0 overflow-hidden">
              <TopBar />
              <div className="flex-1 min-h-0 overflow-auto flex flex-col">
                {children}
              </div>
            </SidebarInset>
          </div>
          <ZadarmaPhoneWidget />
        </SidebarProvider>
      </CompanyProvider>
    </ThemeProvider>
  );
}
