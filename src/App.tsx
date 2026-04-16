import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AgentCenterOld from "./pages/AgentCenterOld.tsx";
import OperatorHub from "./pages/OperatorHub.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeToggle />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AgentCenterOld />} />
          <Route path="/agent-center" element={<AgentCenterOld />} />
          <Route path="/agent-center-old" element={<AgentCenterOld />} />
          <Route path="/legacy" element={<OperatorHub />} />
          <Route path="/operator-hub" element={<OperatorHub />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
