import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
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
const AICostDashboardPage = lazy(() => import("./pages/admin/AICostDashboardPage"));
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
const AnalyticsExecutivoPage = lazy(() => import("./pages/AnalyticsExecutivoPage"));

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
const CSPlaybooksPage = lazy(() => import("./pages/cs/CSPlaybooksPage"));
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
          <CompanyProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* Public routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/f/:slug" element={<PublicFormPage />} />
                
                {/* Protected routes */}
                <Route path="/" element={<Index />} />
                <Route path="/meu-dia" element={<ProtectedRoute><WorkbenchPage /></ProtectedRoute>} />
                <Route path="/me" element={<ProtectedRoute><Me /></ProtectedRoute>} />
                
                {/* Pipeline & Deals — isolated ErrorBoundary */}
                <Route path="/pipeline" element={<ProtectedRoute><ErrorBoundary><PipelinePage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/contatos" element={<ProtectedRoute><ErrorBoundary><ContatosPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/organizacoes" element={<ProtectedRoute><ErrorBoundary><OrganizationsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/metas" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><ErrorBoundary><MetasPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/renovacao" element={<ProtectedRoute><ErrorBoundary><RenovacaoPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cockpit" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><ErrorBoundary><CockpitPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/relatorios" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><ErrorBoundary><AnalyticsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/relatorios/executivo" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><AnalyticsExecutivoPage /></ErrorBoundary></ProtectedRoute>} />

                {/* Conversas & Atendimentos — isolated ErrorBoundary */}
                <Route path="/conversas" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><ErrorBoundary><ConversasPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/atendimentos" element={<Navigate to="/conversas" replace />} />

                {/* Amelia & Templates */}
                <Route path="/amelia" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><AmeliaPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/amelia/mass-action" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><ErrorBoundary><AmeliaMassActionPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/templates" element={<ProtectedRoute requiredRoles={['ADMIN', 'MARKETING']}><ErrorBoundary><TemplatesPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/integracoes" element={<Navigate to="/admin/settings" replace />} />
                <Route path="/cadencias-crm" element={<Navigate to="/cadences" replace />} />
                <Route path="/capture-forms" element={<ProtectedRoute requiredRoles={['ADMIN']}><CaptureFormsPage /></ProtectedRoute>} />
                <Route path="/capture-forms/:id/edit" element={<ProtectedRoute requiredRoles={['ADMIN']}><CaptureFormBuilderPage /></ProtectedRoute>} />
                
                {/* Admin/Auditor — isolated ErrorBoundary */}
                <Route path="/monitor/sgt-events" element={<ProtectedRoute requiredRoles={['ADMIN', 'AUDITOR']}><ErrorBoundary><MonitorSgtEvents /></ErrorBoundary></ProtectedRoute>} />
                
                {/* Leads routes */}
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
                
                {/* Tokeniza */}
                <Route path="/tokeniza/offers" element={<ProtectedRoute><TokenizaOffers /></ProtectedRoute>} />
                
                {/* Admin routes — isolated ErrorBoundary */}
                <Route path="/admin/produtos" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><ProductKnowledgeList /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/produtos/:productId" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><ProductKnowledgeEditor /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><Settings /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/leads-quentes" element={<ProtectedRoute requiredRoles={['ADMIN', 'CLOSER']}><ErrorBoundary><LeadsQuentes /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/ai-benchmark" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><AIBenchmark /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/ai-costs" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><AICostDashboardPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/pendencias" element={<ProtectedRoute><ErrorBoundary><PendenciasPerda /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/settings/pipelines" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><PipelineConfigPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/settings/custom-fields" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><CustomFieldsConfigPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/importacao" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><ImportacaoPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/zadarma" element={<ProtectedRoute requiredRoles={['ADMIN']}><ErrorBoundary><ZadarmaConfigPage /></ErrorBoundary></ProtectedRoute>} />

                {/* CS Module — isolated ErrorBoundary */}
                <Route path="/cs" element={<ProtectedRoute><ErrorBoundary><CSDashboardPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/clientes" element={<ProtectedRoute><ErrorBoundary><CSClientesPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/clientes/:id" element={<ProtectedRoute><ErrorBoundary><CSClienteDetailPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/pesquisas" element={<ProtectedRoute><ErrorBoundary><CSPesquisasPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/incidencias" element={<ProtectedRoute><ErrorBoundary><CSIncidenciasPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/playbooks" element={<ProtectedRoute><ErrorBoundary><CSPlaybooksPage /></ErrorBoundary></ProtectedRoute>} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
