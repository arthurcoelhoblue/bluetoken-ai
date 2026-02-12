import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bot, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
        <div className="text-center max-w-lg animate-slide-up">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center mb-6 shadow-glow animate-pulse-glow">
            <Bot className="h-10 w-10 text-primary-foreground" />
          </div>
          
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            Blue CRM
          </h1>
          
          <p className="text-primary-foreground/80 mb-2 text-xl">
            Grupo Blue
          </p>
          
          <p className="text-primary-foreground/60 mb-8">
            CRM Inteligente com IA — Vendas, Automação e Relacionamento
          </p>

          <Button
            variant="gradient"
            size="xl"
            onClick={() => navigate('/auth')}
            className="shadow-lg"
          >
            Acessar Sistema
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout requireAuth={false}>
      <DashboardContent />
    </AppLayout>
  );
}
