import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, Navigate, RouterProvider } from "react-router";
import "./styles/index.css";
import { queryClient } from "./lib/api";
import { TooltipProvider } from "./components/ui/Tooltip";
import { AppShell } from "./components/layout/AppShell";
import { Gate } from "./components/layout/Gate";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import OverviewPage from "./pages/OverviewPage";
import SchedulePage from "./pages/SchedulePage";
import DemandPage from "./pages/DemandPage";
import CostServicePage from "./pages/CostServicePage";
import ScenarioLabPage from "./pages/ScenarioLabPage";
import PlaybookPage from "./pages/PlaybookPage";
import MethodsPage from "./pages/MethodsPage";
import KitPage from "./pages/KitPage";

// Hash routes (#/schedule?scenario=PEAK&wh=2&block=...), so FastAPI needs no fallback routes.
const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: "overview", element: <OverviewPage /> },
      { path: "schedule", element: <SchedulePage /> },
      { path: "demand", element: <DemandPage /> },
      { path: "cost-service", element: <CostServicePage /> },
      { path: "scenario-lab", element: <ScenarioLabPage /> },
      { path: "playbook", element: <PlaybookPage /> },
      { path: "methods", element: <MethodsPage /> },
      { path: "kit", element: <KitPage /> },
      { path: "*", element: <Navigate to="/overview" replace /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Gate>
            <RouterProvider router={router} />
          </Gate>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
