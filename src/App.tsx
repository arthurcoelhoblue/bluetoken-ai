import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "sonner";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Me = lazy(() => import("./pages/Me"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MonitorSgtEvents = lazy(() => import("./pages/MonitorSgtEvents"));
const LeadsList = lazy(() => import("./pages/LeadsList"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const CadencesList = lazy(() => import("./pages/CadencesList"));
const CadenceDetail = lazy(() => import("./pages/CadenceDetail"));
const CadenceRunsList = lazy(() => import("./pages/CadenceRunsList"));
const CadenceRunDetail = lazy(() => import("./pages/CadenceRunDetail"));
const CadenceNextActions = lazy(() => import("./pages/CadenceNextActions"));
const CadenceEditor = lazy(() => import("./pages/CadenceEditor"));
const TokenizaOffers = lazy(() => import("./pages/TokenizaOffers"));
const ProductKnowledgeList = lazy(() => import("./pages/admin/ProductKnowledgeList"));
const ProductKnowledgeEditor = lazy(() => import("./pages/admin/ProductKnowledgeEditor"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const LeadsQuentes = lazy(() => import("./pages/admin/LeadsQuentes"));
const AIBenchmark = lazy(() => import("./pages/admin/AIBenchmark"));
const PendenciasPerda = lazy(() => import("./pages/admin/PendenciasPerda"));
const Atendimentos = lazy(() => import("./pages/Atendimentos"));
const WorkbenchPage = lazy(() => import("./pages/WorkbenchPage"));
const PipelinePage = lazy(() => import("./pages/PipelinePage"));
const ContatosPage = lazy(() => import("./pages/ContatosPage"));
const ConversasPage = lazy(() => import("./pages/ConversasPage"));
const MetasPage = lazy(() => import("./pages/MetasPage"));
const RenovacaoPage = lazy(() => import("./pages/RenovacaoPage"));
const CockpitPage = lazy(() => import("./pages/CockpitPage"));
const AmeliaPage = lazy(() => import("./pages/AmeliaPage"));
const AmeliaMassActionPage = lazy(() => import("./pages/AmeliaMassActionPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const PipelineConfigPage = lazy(() => import("./pages/PipelineConfigPage"));
const CustomFieldsConfigPage = lazy(() => import("./pages/CustomFieldsConfigPage"));
const OrganizationsPage = lazy(() => import("./pages/OrganizationsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

const ImportacaoPage = lazy(() => import("./pages/ImportacaoPage"));
const ZadarmaConfigPage = lazy(() => import("./pages/ZadarmaConfigPage"));
const CaptureFormsPage = lazy(() => import("./pages/CaptureFormsPage"));
const CaptureFormBuilderPage = lazy(() => import("./pages/CaptureFormBuilderPage"));
const PublicFormPage = lazy(() => import("./pages/PublicFormPage"));

// CS Module pages
const CSDashboardPage = lazy(() => import("./pages/cs/CSDashboardPage"));
const CSClientesPage = lazy(() => import("./pages/cs/CSClientesPage"));
const CSClienteDetailPage = lazy(() => import("./pages/cs/CSClienteDetailPage"));
const CSPesquisasPage = lazy(() => import("./pages/cs/CSPesquisasPage"));
const CSIncidenciasPage = lazy(() => import("./pages/cs/CSIncidenciasPage"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: {
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Erro inesperado");
      },
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* Public routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                
                {/* Protected routes */}
                <Route path="/" element={<Index />} />
                <Route path="/meu-dia" element={<ProtectedRoute><WorkbenchPage /></ProtectedRoute>} />
                <Route path="/me" element={<ProtectedRoute><Me /></ProtectedRoute>} />
                
                {/* Shell pages — Patch 0 */}
                <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
                <Route path="/contatos" element={<ProtectedRoute><ContatosPage /></ProtectedRoute>} />
                <Route path="/organizacoes" element={<ProtectedRoute><OrganizationsPage /></ProtectedRoute>} />
                <Route path="/conversas" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><ConversasPage /></ProtectedRoute>} />
                <Route path="/metas" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><MetasPage /></ProtectedRoute>} />
                <Route path="/renovacao" element={<ProtectedRoute><RenovacaoPage /></ProtectedRoute>} />
                <Route path="/cockpit" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><CockpitPage /></ProtectedRoute>} />
                <Route path="/amelia" element={<ProtectedRoute requiredRoles={['ADMIN']}><AmeliaPage /></ProtectedRoute>} />
                <Route path="/amelia/mass-action" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><AmeliaMassActionPage /></ProtectedRoute>} />
                <Route path="/templates" element={<ProtectedRoute requiredRoles={['ADMIN', 'MARKETING']}><TemplatesPage /></ProtectedRoute>} />
                <Route path="/integracoes" element={<Navigate to="/admin/settings" replace />} />
                <Route path="/relatorios" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/cadencias-crm" element={<Navigate to="/cadences" replace />} />
                <Route path="/capture-forms" element={<ProtectedRoute requiredRoles={['ADMIN']}><CaptureFormsPage /></ProtectedRoute>} />
                <Route path="/capture-forms/:id/edit" element={<ProtectedRoute requiredRoles={['ADMIN']}><CaptureFormBuilderPage /></ProtectedRoute>} />
                
                {/* Admin/Auditor routes */}
                <Route path="/monitor/sgt-events" element={
                  <ProtectedRoute requiredRoles={['ADMIN', 'AUDITOR']}><MonitorSgtEvents /></ProtectedRoute>
                } />
                
                {/* Atendimentos redirect → Conversas */}
                <Route path="/atendimentos" element={<Navigate to="/conversas" replace />} />
                
                {/* Leads routes - redirect to unified Contatos */}
                <Route path="/leads" element={<Navigate to="/contatos" replace />} />
                <Route path="/leads/:leadId/:empresa" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
                
                {/* Cadences routes */}
                <Route path="/cadences/new" element={<ProtectedRoute requiredRoles={['ADMIN']}><CadenceEditor /></ProtectedRoute>} />
                <Route path="/cadences/:cadenceId/edit" element={<ProtectedRoute requiredRoles={['ADMIN']}><CadenceEditor /></ProtectedRoute>} />
                <Route path="/cadences/runs/:runId" element={<ProtectedRoute><CadenceRunDetail /></ProtectedRoute>} />
                <Route path="/cadences/runs" element={<ProtectedRoute><CadenceRunsList /></ProtectedRoute>} />
                <Route path="/cadences/next-actions" element={<ProtectedRoute><CadenceNextActions /></ProtectedRoute>} />
                <Route path="/cadences/:cadenceId" element={<ProtectedRoute><CadenceDetail /></ProtectedRoute>} />
                <Route path="/cadences" element={<ProtectedRoute><CadencesList /></ProtectedRoute>} />
                
                {/* Tokeniza routes */}
                <Route path="/tokeniza/offers" element={<ProtectedRoute><TokenizaOffers /></ProtectedRoute>} />
                
                {/* Admin routes */}
                <Route path="/admin/produtos" element={<ProtectedRoute requiredRoles={['ADMIN']}><ProductKnowledgeList /></ProtectedRoute>} />
                <Route path="/admin/produtos/:productId" element={<ProtectedRoute requiredRoles={['ADMIN']}><ProductKnowledgeEditor /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute requiredRoles={['ADMIN']}><Settings /></ProtectedRoute>} />
                <Route path="/admin/leads-quentes" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><LeadsQuentes /></ProtectedRoute>} />
                <Route path="/admin/ai-benchmark" element={<ProtectedRoute requiredRoles={['ADMIN']}><AIBenchmark /></ProtectedRoute>} />
                <Route path="/pendencias" element={<ProtectedRoute><PendenciasPerda /></ProtectedRoute>} />
                <Route path="/settings/pipelines" element={<ProtectedRoute requiredRoles={['ADMIN']}><PipelineConfigPage /></ProtectedRoute>} />
                <Route path="/settings/custom-fields" element={<ProtectedRoute requiredRoles={['ADMIN']}><CustomFieldsConfigPage /></ProtectedRoute>} />
                <Route path="/importacao" element={<ProtectedRoute requiredRoles={['ADMIN']}><ImportacaoPage /></ProtectedRoute>} />
                <Route path="/admin/zadarma" element={<ProtectedRoute requiredRoles={['ADMIN']}><ZadarmaConfigPage /></ProtectedRoute>} />
                
                {/* Public form route */}
                <Route path="/f/:slug" element={<PublicFormPage />} />

                {/* CS Module routes */}
                <Route path="/cs" element={<ProtectedRoute><CSDashboardPage /></ProtectedRoute>} />
                <Route path="/cs/clientes" element={<ProtectedRoute><CSClientesPage /></ProtectedRoute>} />
                <Route path="/cs/clientes/:id" element={<ProtectedRoute><CSClienteDetailPage /></ProtectedRoute>} />
                <Route path="/cs/pesquisas" element={<ProtectedRoute><CSPesquisasPage /></ProtectedRoute>} />
                <Route path="/cs/incidencias" element={<ProtectedRoute><CSIncidenciasPage /></ProtectedRoute>} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
