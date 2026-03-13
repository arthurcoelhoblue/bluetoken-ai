import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/web-vitals";
import { initSentry } from "./lib/sentry";

// Initialize monitoring (non-blocking)
initSentry();

// --- Global chunk/preload error recovery ---
const RELOAD_KEY = 'global-chunk-reload';
const MAX_RELOADS = 2;
const WINDOW_MS = 60_000;

function getReloadCount(): number {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (!raw) return 0;
    const { count, ts } = JSON.parse(raw);
    if (Date.now() - ts > WINDOW_MS) return 0;
    return count || 0;
  } catch { return 0; }
}

function doControlledReload() {
  const count = getReloadCount();
  if (count >= MAX_RELOADS) {
    console.warn('[GlobalReload] Max auto-reloads reached, not reloading');
    return;
  }
  sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ count: count + 1, ts: Date.now() }));
  console.info(`[GlobalReload] Auto-reload ${count + 1}/${MAX_RELOADS}`);
  window.location.reload();
}

function isChunkLikeError(msg: string): boolean {
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

// Vite-specific preload error
window.addEventListener('vite:preloadError', (e) => {
  console.warn('[GlobalReload] vite:preloadError caught', e);
  e.preventDefault();
  doControlledReload();
});

// Catch unhandled promise rejections (dynamic import failures)
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason || '');
  if (isChunkLikeError(msg)) {
    console.warn('[GlobalReload] Chunk error in unhandledrejection', msg);
    e.preventDefault();
    doControlledReload();
  }
});

// Catch script/module load failures that surface as window error
window.addEventListener('error', (e) => {
  const msg = e.message || e.error?.message || '';
  if (isChunkLikeError(msg)) {
    console.warn('[GlobalReload] Chunk-like error in window.error', msg);
    e.preventDefault();
    doControlledReload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

// Start Web Vitals monitoring after render
initWebVitals();
