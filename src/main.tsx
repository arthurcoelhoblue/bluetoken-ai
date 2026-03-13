import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/web-vitals";
import { initSentry } from "./lib/sentry";

// Initialize monitoring (non-blocking)
initSentry();

// Apenas log — ZERO auto-reload
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[main] Chunk preload error:', event);
});

window.addEventListener('unhandledrejection', (event) => {
  console.warn('[main] Unhandled rejection:', event.reason);
});

window.addEventListener('error', (event) => {
  console.warn('[main] Uncaught error:', event.error);
});

createRoot(document.getElementById("root")!).render(<App />);

// Start Web Vitals monitoring after render
initWebVitals();
