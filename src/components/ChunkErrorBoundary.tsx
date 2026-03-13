import React from 'react';

interface State {
  hasError: boolean;
  retryCount: number;
}

const STORAGE_KEY = 'chunk-error-reload';
const MAX_AUTO_RELOADS = 2;
const WINDOW_MS = 60_000;

export class ChunkErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, retryCount: 0 };

  static getDerivedStateFromError(error: Error): State | null {
    if (isRecoverableError(error)) {
      return { hasError: true, retryCount: getReloadCount() };
    }
    throw error; // re-throw non-recoverable errors to outer boundaries
  }

  componentDidCatch(error: Error) {
    if (!isRecoverableError(error)) return;

    const count = getReloadCount();
    console.warn(`[ChunkError] Recoverable error (attempt ${count + 1}/${MAX_AUTO_RELOADS}):`, error.message);

    if (count < MAX_AUTO_RELOADS) {
      console.info('[ChunkError] Auto-reloading...');
      incrementReloadCount();
      window.location.reload();
    } else {
      console.warn('[ChunkError] Max auto-reloads reached, showing manual recovery UI');
    }
  }

  handleHardReload = () => {
    console.info('[ChunkError] Hard reload with cache clear');
    clearReloadCount();
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.retryCount >= MAX_AUTO_RELOADS) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
          <p className="text-muted-foreground">
            Houve um erro ao carregar a página. Uma nova versão pode estar disponível.
          </p>
          <div className="flex flex-col gap-2">
            <button
              className="px-4 py-2 rounded bg-primary text-primary-foreground"
              onClick={this.handleHardReload}
            >
              Limpar cache e recarregar
            </button>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
          <p className="text-muted-foreground">Recarregando...</p>
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
    msg.includes('Importing a module script failed')
  );
}

function isContextMismatchError(error: Error): boolean {
  const msg = error.message || '';
  return msg.includes('must be used within');
}

/** Chunk errors + context mismatches are both recoverable via reload */
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
