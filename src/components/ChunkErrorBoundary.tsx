import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  error: Error | null;
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message?.toLowerCase() || '';
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('dynamically imported module')
  );
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // NUNCA fazer throw aqui — isso mata o React inteiro
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ChunkErrorBoundary]', error.message, errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    sessionStorage.clear();
    window.location.href = '/auth';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.state.isChunkError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', padding: '20px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '12px', color: '#1E293B' }}>Nova versão disponível</h2>
          <p style={{ color: '#64748B', marginBottom: '24px', maxWidth: '400px' }}>
            Uma atualização foi publicada. Clique abaixo para carregar a versão mais recente.
          </p>
          <button onClick={this.handleReload} style={{ padding: '12px 24px', backgroundColor: '#1A73E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
            Atualizar agora
          </button>
        </div>
      );
    }

    // Erro não-chunk: mostrar fallback genérico, NUNCA auto-reload
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', padding: '20px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '12px', color: '#1E293B' }}>Algo deu errado</h2>
        <p style={{ color: '#64748B', marginBottom: '24px', maxWidth: '400px' }}>
          {this.state.error?.message || 'Erro inesperado na aplicação'}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={this.handleClearAndReload} style={{ padding: '12px 24px', backgroundColor: '#1A73E8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
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
