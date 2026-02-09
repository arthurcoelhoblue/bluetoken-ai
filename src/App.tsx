import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Me from "./pages/Me";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import MonitorSgtEvents from "./pages/MonitorSgtEvents";
import LeadsList from "./pages/LeadsList";
import LeadDetail from "./pages/LeadDetail";
import CadencesList from "./pages/CadencesList";
import CadenceDetail from "./pages/CadenceDetail";
import CadenceRunsList from "./pages/CadenceRunsList";
import CadenceRunDetail from "./pages/CadenceRunDetail";
import CadenceNextActions from "./pages/CadenceNextActions";
import CadenceEditor from "./pages/CadenceEditor";
import TokenizaOffers from "./pages/TokenizaOffers";
import ProductKnowledgeList from "./pages/admin/ProductKnowledgeList";
import ProductKnowledgeEditor from "./pages/admin/ProductKnowledgeEditor";
import Settings from "./pages/admin/Settings";
import LeadsQuentes from "./pages/admin/LeadsQuentes";
import Atendimentos from "./pages/Atendimentos";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <Index />
            } />
            <Route path="/me" element={
              <ProtectedRoute>
                <Me />
              </ProtectedRoute>
            } />
            
            {/* Admin/Auditor routes */}
            <Route path="/monitor/sgt-events" element={
              <ProtectedRoute requiredRoles={['ADMIN', 'AUDITOR']}>
                <MonitorSgtEvents />
              </ProtectedRoute>
            } />
            
            {/* Atendimentos Blue Chat */}
            <Route path="/atendimentos" element={
              <ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}>
                <Atendimentos />
              </ProtectedRoute>
            } />
            
            {/* Leads routes */}
            <Route path="/leads" element={
              <ProtectedRoute>
                <LeadsList />
              </ProtectedRoute>
            } />
            <Route path="/leads/:leadId/:empresa" element={
              <ProtectedRoute>
                <LeadDetail />
              </ProtectedRoute>
            } />
            
            {/* Cadences routes - ÉPICO 4 */}
            <Route path="/cadences/new" element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <CadenceEditor />
              </ProtectedRoute>
            } />
            <Route path="/cadences/:cadenceId/edit" element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <CadenceEditor />
              </ProtectedRoute>
            } />
            <Route path="/cadences/runs/:runId" element={
              <ProtectedRoute>
                <CadenceRunDetail />
              </ProtectedRoute>
            } />
            <Route path="/cadences/runs" element={
              <ProtectedRoute>
                <CadenceRunsList />
              </ProtectedRoute>
            } />
            <Route path="/cadences/next-actions" element={
              <ProtectedRoute>
                <CadenceNextActions />
              </ProtectedRoute>
            } />
            <Route path="/cadences/:cadenceId" element={
              <ProtectedRoute>
                <CadenceDetail />
              </ProtectedRoute>
            } />
            <Route path="/cadences" element={
              <ProtectedRoute>
                <CadencesList />
              </ProtectedRoute>
            } />
            
            {/* Tokeniza routes */}
            <Route path="/tokeniza/offers" element={
              <ProtectedRoute>
                <TokenizaOffers />
              </ProtectedRoute>
            } />
            
            {/* Admin routes */}
            <Route path="/admin/produtos" element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <ProductKnowledgeList />
              </ProtectedRoute>
            } />
            <Route path="/admin/produtos/:productId" element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <ProductKnowledgeEditor />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/admin/leads-quentes" element={
              <ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}>
                <LeadsQuentes />
              </ProtectedRoute>
            } />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
