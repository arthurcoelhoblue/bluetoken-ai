import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bot, ChevronRight, Brain, Columns3, Zap } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';

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
      <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative floating circles */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div className="absolute bottom-32 right-16 w-80 h-80 rounded-full bg-accent/10 blur-3xl animate-float animation-delay-200" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-primary/5 blur-2xl animate-float animation-delay-400" />

        {/* Main content */}
        <div className="relative z-10 text-center max-w-lg animate-slide-up">
          {/* Amelia icon */}
          <div className="mx-auto h-24 w-24 rounded-3xl bg-gradient-primary flex items-center justify-center mb-8 shadow-glow animate-pulse-glow">
            <Bot className="h-12 w-12 text-primary-foreground" />
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold mb-3">
            <span className="text-gradient">Amelia CRM</span>
          </h1>

          <p className="text-primary-foreground/80 text-lg mb-2">
            Grupo Blue
          </p>

          <p className="text-primary-foreground/50 mb-10">
            Sua inteligência comercial sempre ativa
          </p>

          {/* Mini feature indicators */}
          <div className="flex items-center justify-center gap-8 mb-10">
            <div className="text-center animate-fade-in animation-delay-100">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary-foreground/10 flex items-center justify-center mb-2">
                <Brain className="h-5 w-5 text-accent" />
              </div>
              <p className="text-xs text-primary-foreground/60">IA Conversacional</p>
            </div>
            <div className="text-center animate-fade-in animation-delay-200">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary-foreground/10 flex items-center justify-center mb-2">
                <Columns3 className="h-5 w-5 text-accent" />
              </div>
              <p className="text-xs text-primary-foreground/60">Pipeline Inteligente</p>
            </div>
            <div className="text-center animate-fade-in animation-delay-300">
              <div className="mx-auto h-11 w-11 rounded-xl bg-primary-foreground/10 flex items-center justify-center mb-2">
                <Zap className="h-5 w-5 text-accent" />
              </div>
              <p className="text-xs text-primary-foreground/60">Automação 24/7</p>
            </div>
          </div>

          {/* CTA */}
          <Button
            variant="gradient"
            size="xl"
            onClick={() => navigate('/auth')}
            className="shadow-lg"
          >
            Entrar
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-6 text-center">
          <p className="text-xs text-primary-foreground/30">
            © 2025 Grupo Blue. Powered by Amelia IA.
          </p>
        </footer>
      </div>
    );
  }

  return <Navigate to="/meu-dia" replace />;
}
