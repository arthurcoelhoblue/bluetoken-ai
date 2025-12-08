import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md animate-slide-up">
        <div className="mx-auto h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Acesso Negado
        </h1>
        
        <p className="text-muted-foreground mb-8">
          Você não tem permissão para acessar esta página. 
          Entre em contato com o administrador se acredita que isso é um erro.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button
            variant="default"
            onClick={() => navigate('/')}
          >
            <Home className="h-4 w-4" />
            Ir para Início
          </Button>
        </div>
      </div>
    </div>
  );
}
