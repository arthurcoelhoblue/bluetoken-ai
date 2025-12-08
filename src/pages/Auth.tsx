import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Bot, Shield, Zap, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import type { LoginFormData, SignupFormData, ForgotPasswordFormData } from '@/schemas/auth';

type AuthView = 'auth' | 'forgot-password';

export default function Auth() {
  const { isAuthenticated, isLoading, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('auth');

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, from]);

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const { error } = await signInWithEmail(data.email, data.password);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Por favor, confirme seu email antes de fazer login');
      } else {
        toast.error('Erro ao fazer login. Tente novamente.');
      }
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsSubmitting(true);
    const { error } = await signUpWithEmail(data.email, data.password, data.nome);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Este email já está cadastrado. Tente fazer login.');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
      setIsSubmitting(false);
    } else {
      toast.success('Conta criada com sucesso! Você já pode fazer login.');
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    const { error } = await resetPassword(data.email);
    
    if (error) {
      toast.error('Erro ao enviar email de recuperação. Tente novamente.');
    } else {
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setAuthView('auth');
    }
    setIsSubmitting(false);
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
              <CardTitle className="text-2xl font-bold">
                {authView === 'forgot-password' ? 'Recuperar Senha' : 'Bem-vindo ao SDR IA'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {authView === 'forgot-password' 
                  ? 'Enviaremos instruções para redefinir sua senha'
                  : 'Sistema de Pré-Vendas Automatizado'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {authView === 'forgot-password' ? (
                <ForgotPasswordForm
                  onSubmit={handleForgotPassword}
                  onBack={() => setAuthView('auth')}
                  isLoading={isSubmitting}
                />
              ) : (
                <>
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

                  {/* Auth Tabs */}
                  <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="login">Entrar</TabsTrigger>
                      <TabsTrigger value="signup">Cadastrar</TabsTrigger>
                    </TabsList>
                    <TabsContent value="login" className="mt-4">
                      <LoginForm
                        onSubmit={handleLogin}
                        onForgotPassword={() => setAuthView('forgot-password')}
                        isLoading={isSubmitting}
                      />
                    </TabsContent>
                    <TabsContent value="signup" className="mt-4">
                      <SignupForm
                        onSubmit={handleSignup}
                        isLoading={isSubmitting}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              )}

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
