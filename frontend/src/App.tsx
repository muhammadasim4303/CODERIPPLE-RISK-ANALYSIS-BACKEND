import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AuthCallback from "./pages/Auth/AuthCallback";

import Login from "./pages/Auth/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import RepoList from "./pages/Repositories/RepoList";
import RepoDetails from "./pages/Repositories/RepoDetails";
import CommitDetails from "./pages/Commits/CommitDetails";
import ChangeImpact from "./pages/ChangeImpact/ChangeImpact";
import RiskOverview from "./pages/RiskAnalysis/RiskOverview";
import Settings from "./pages/Settings/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/repos" element={<RepoList />} />
                {/* repoId is encoded "owner/repo" */}
                <Route path="/repos/:repoId" element={<RepoDetails />} />
                {/* sha with optional owner/repo query params */}
                <Route path="/commits/:sha" element={<CommitDetails />} />
                <Route path="/change-impact" element={<ChangeImpact />} />
                <Route path="/risk-overview" element={<RiskOverview />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
