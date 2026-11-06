import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { applyTheme, readTheme } from "./lib/theme";
import { installTooltip } from "./lib/tooltip";
import "./styles.css";

// Theme first, so the first paint is already in the right theme (localStorage read in try/catch).
applyTheme(readTheme());
installTooltip();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
