// Sentry desabilitado temporariamente para estabilizar o app.
// Será reativado após o login estar 100% estável.

export function initSentry(): void {}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  console.error('[Sentry:stub]', error, context);
}

export function captureMessage(message: string): void {
  console.warn('[Sentry:stub]', message);
}

export function setUser(_user: { id: string; email?: string } | null): void {}

export function withScope(_callback: (scope: unknown) => void): void {}
