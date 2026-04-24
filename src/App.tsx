import { Component, Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AgentCenterOld from "./pages/AgentCenterOld.tsx";
import NotFound from "./pages/NotFound.tsx";

const OperatorHubLazy = lazy(() =>
  import("./pages/OperatorHub.tsx").catch((err) => ({
    default: () => (
      <div className="m-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm">
        <div className="font-semibold text-red-300">Operator Hub failed to load</div>
        <div className="mt-2 break-all text-red-200">{String(err?.message || err)}</div>
      </div>
    ),
  }))
);

const queryClient = new QueryClient();

class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("RouteErrorBoundary", error);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-300">Route crashed</div>
          <div className="mt-2 break-all text-red-200">{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

const OperatorHubRoute = () => (
  // @ts-ignore
  <RouteErrorBoundary>
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Operator Hub…</div>}>
      <OperatorHubLazy />
    </Suspense>
  </RouteErrorBoundary>
);

const ThemeToggle = () => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark =
      document.documentElement.classList.contains("dark") ||
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="fixed bottom-4 right-4 z-50 rounded-full border bg-background/90 p-2 shadow-md backdrop-blur"
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      type="button"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

const App = () => {
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      setFatal(event.message || "Unknown runtime error");
    };
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = typeof event.reason === "string" ? event.reason : event.reason?.message || "Unhandled promise rejection";
      setFatal(reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ThemeToggle />
        {fatal ? (
          <div className="m-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm">
            <div className="font-semibold text-red-300">Runtime error detected</div>
            <div className="mt-2 break-all text-red-200">{fatal}</div>
          </div>
        ) : (
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<OperatorHubRoute />} />
              <Route path="/operator-hub" element={<OperatorHubRoute />} />
              <Route path="/legacy" element={<AgentCenterOld />} />
              <Route path="/agent-center" element={<AgentCenterOld />} />
              <Route path="/agent-center-old" element={<AgentCenterOld />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
