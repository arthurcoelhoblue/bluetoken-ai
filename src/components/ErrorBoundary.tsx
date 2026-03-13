import { Component, ErrorInfo, ReactNode } from 'react';
import { captureException } from '@/lib/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, errorInfo.componentStack);
    try {
      captureException(error, { componentStack: errorInfo.componentStack });
    } catch {
      // Sentry falhou — não importa, segue em frente
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleBackToLogin = () => {
    sessionStorage.clear();
    window.location.href = '/auth';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', padding: '20px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '12px', color: '#1E293B' }}>Algo deu errado</h2>
        <p style={{ color: '#64748B', marginBottom: '24px', maxWidth: '400px' }}>
          {this.state.error?.message || 'Erro inesperado'}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={this.handleBackToLogin} style={{ padding: '12px 24px', backgroundColor: '#1A73E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
            Voltar ao login
          </button>
          <button onClick={this.handleReload} style={{ padding: '12px 24px', backgroundColor: '#f3f4f6', color: '#333', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
