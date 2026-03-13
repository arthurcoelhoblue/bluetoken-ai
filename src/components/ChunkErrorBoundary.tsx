import React from 'react';

interface State {
  hasError: boolean;
}

export class ChunkErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State | null {
    if (isChunkError(error)) {
      return { hasError: true };
    }
    throw error; // re-throw non-chunk errors to outer boundaries
  }

  componentDidCatch(error: Error) {
    if (!isChunkError(error)) return;

    const key = 'chunk-error-reload';
    const last = sessionStorage.getItem(key);
    const now = Date.now();

    // Allow one auto-reload per 30s window to avoid infinite loops
    if (!last || now - Number(last) > 30_000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
          <p className="text-muted-foreground">Houve um erro ao carregar a página.</p>
          <button
            className="px-4 py-2 rounded bg-primary text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function isChunkError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes("Importing a module script failed")
  );
}
