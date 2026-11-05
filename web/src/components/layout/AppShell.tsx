import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { ErrorBoundary } from "./ErrorBoundary";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * The frame: a navy top bar and sidebar (one L-shaped surface) holding a light canvas
 * with a rounded inner corner. Pages render inside the canvas, which scrolls on its own.
 */
export function AppShell() {
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  // New page: start at the top. A scenario or warehouse switch keeps the scroll position.
  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-screen min-w-[1180px] flex-col overflow-hidden bg-navy">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="main" ref={main} className="scrollbar-thin min-w-0 flex-1 overflow-y-auto rounded-tl-frame bg-canvas" tabIndex={-1}>
          <div className="mx-auto max-w-[1600px] px-6 pt-7 pb-12 min-[1440px]:px-8">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
