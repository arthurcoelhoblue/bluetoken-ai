import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/web-vitals";
import { initSentry } from "./lib/sentry";

// Initialize monitoring (non-blocking)
initSentry();

createRoot(document.getElementById("root")!).render(<App />);

// Start Web Vitals monitoring after render
initWebVitals();
