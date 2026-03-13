import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sentry } from '@/lib/sentry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

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

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState | null {
    // Let chunk errors bubble up to ChunkErrorBoundary for auto-reload
    if (isChunkError(error)) {
      console.info('[ErrorBoundary] Chunk error detected, re-throwing to ChunkErrorBoundary');
      throw error;
    }
    // Treat context mismatch as recoverable (likely bundle/hydration issue)
    if (isContextMismatchError(error)) {
      console.warn('[ErrorBoundary] Context mismatch detected, re-throwing for auto-recovery');
      throw error;
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    Sentry?.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
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
