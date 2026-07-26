import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./i18n";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// PWA service worker. Registered in production only — in dev it would fight
// Vite's HMR and serve stale modules. A new deploy activates on the next load
// (the SW skips waiting), so clients self-heal without a stale-cache trap.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // Whether this page was already controlled by a SW. On the very first visit
  // there is no controller, so the initial clientsClaim must NOT trigger a
  // reload — only a genuine *update* on a return visit should.
  const hadController = !!navigator.serviceWorker.controller;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}
