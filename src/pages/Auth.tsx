import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Bot, Shield, Zap, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
  const { isAuthenticated, isLoading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, from]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      console.error('Error signing in:', error);
      toast.error('Erro ao fazer login. Tente novamente.');
      setIsSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">SDR IA</h1>
            <p className="text-xs text-primary-foreground/70">Tokeniza & Blue Consult</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          <Card className="glass border-border/30 shadow-lg">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold">Bem-vindo ao SDR IA</CardTitle>
              <CardDescription className="text-muted-foreground">
                Sistema de Pré-Vendas Automatizado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Features */}
              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">WhatsApp Integrado</p>
                </div>
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-2">
                    <Zap className="h-6 w-6 text-accent" />
                  </div>
                  <p className="text-xs text-muted-foreground">Automação Inteligente</p>
                </div>
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-2">
                    <Shield className="h-6 w-6 text-success" />
                  </div>
                  <p className="text-xs text-muted-foreground">Segurança Empresarial</p>
                </div>
              </div>

              {/* Login button */}
              <Button
                variant="google"
                size="xl"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Entrar com Google
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Acesso restrito a colaboradores autorizados
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-xs text-primary-foreground/50">
          © 2024 Tokeniza & Blue Consult. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
