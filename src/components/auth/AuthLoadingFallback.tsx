import { Loader2, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

interface AuthLoadingFallbackProps {
  /** How long (ms) before showing recovery options */
  timeoutMs?: number;
  onReload: () => void;
  onClearSession: () => void;
}

export function AuthLoadingFallback({ 
  timeoutMs = 6000, 
  onReload, 
  onClearSession 
}: AuthLoadingFallbackProps) {
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowRecovery(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {showRecovery ? 'O carregamento está demorando mais que o esperado.' : 'Carregando...'}
        </p>
        {showRecovery && (
          <div className="flex flex-col gap-2 mt-2 animate-in fade-in duration-300">
            <Button variant="outline" size="sm" onClick={onReload}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar página
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearSession}>
              <LogOut className="h-4 w-4 mr-2" />
              Limpar sessão e tentar novamente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
