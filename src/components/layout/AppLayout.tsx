import { useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Navigate } from 'react-router-dom';
import { ZadarmaPhoneWidget } from '@/components/zadarma/ZadarmaPhoneWidget';
import { CopilotFab } from '@/components/copilot/CopilotFab';
import { GlobalCreateDealDialog } from '@/components/pipeline/GlobalCreateDealDialog';
import { Plus } from 'lucide-react';
import { useNewDealAlert } from '@/hooks/useNewDealAlert';

interface AppLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AppLayout({ children, requireAuth = true }: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [showGlobalDeal, setShowGlobalDeal] = useState(false);
  useNewDealAlert();

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

  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="h-screen flex w-full overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex flex-col min-w-0 min-h-0 overflow-hidden">
            <TopBar />
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
              {children}
            </div>
          </SidebarInset>
        </div>
        <ZadarmaPhoneWidget />
        <button
          onClick={() => setShowGlobalDeal(true)}
          className="fixed bottom-20 right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-transform hover:scale-105"
          title="Novo Deal"
        >
          <Plus className="h-5 w-5" />
        </button>
        <GlobalCreateDealDialog open={showGlobalDeal} onOpenChange={setShowGlobalDeal} />
        <CopilotFab />
      </SidebarProvider>
    </ThemeProvider>
  );
}
