import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { captureException } from '@/lib/sentry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isRecoverable: boolean;
  retryCount: number;
}

const STORAGE_KEY = 'eb-recoverable-reload';
const MAX_AUTO_RELOADS = 2;
const WINDOW_MS = 60_000;

function isChunkError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('Importing a module script failed')
  );
}

function isContextMismatchError(error: Error): boolean {
  const msg = error.message || '';
  return msg.includes('must be used within');
}

function isRecoverableError(error: Error): boolean {
  return isChunkError(error) || isContextMismatchError(error);
}

function getReloadCount(): number {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY);
    if (!data) return 0;
    const { count, timestamp } = JSON.parse(data);
    if (Date.now() - timestamp > WINDOW_MS) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

function incrementReloadCount(): void {
  const current = getReloadCount();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ count: current + 1, timestamp: Date.now() }));
}

function clearReloadCount(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, isRecoverable: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const recoverable = isRecoverableError(error);
    return {
      hasError: true,
      error,
      isRecoverable: recoverable,
      retryCount: getReloadCount(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    captureException(error, { extra: { componentStack: errorInfo.componentStack } });

    if (isRecoverableError(error)) {
      const count = getReloadCount();
      console.warn(`[ErrorBoundary] Recoverable error (attempt ${count + 1}/${MAX_AUTO_RELOADS}):`, error.message);

      if (count < MAX_AUTO_RELOADS) {
        console.info('[ErrorBoundary] Auto-reloading...');
        incrementReloadCount();
        window.location.reload();
      } else {
        console.warn('[ErrorBoundary] Max auto-reloads reached, showing manual recovery UI');
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, isRecoverable: false, retryCount: 0 });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHardReload = () => {
    clearReloadCount();
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Recoverable error with max retries exceeded → manual recovery UI
      if (this.state.isRecoverable && this.state.retryCount >= MAX_AUTO_RELOADS) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-muted-foreground max-w-md">
              Houve um erro ao carregar a página. Uma nova versão pode estar disponível.
            </p>
            <Button size="sm" onClick={this.handleHardReload}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Limpar cache e recarregar
            </Button>
          </div>
        );
      }

      // Recoverable error still auto-reloading (shouldn't render long, reload is in progress)
      if (this.state.isRecoverable) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
            <p className="text-muted-foreground">Recarregando...</p>
          </div>
        );
      }

      // Non-recoverable error → standard error UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">
            {this.props.fallbackTitle || 'Algo deu errado'}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Ocorreu um erro inesperado. Tente recarregar a página ou voltar à tela anterior.
          </p>
          {this.state.error && (
            <pre className="text-xs text-muted-foreground bg-muted rounded p-2 max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleReset}>
              Tentar novamente
            </Button>
            <Button size="sm" onClick={this.handleReload}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Recarregar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
