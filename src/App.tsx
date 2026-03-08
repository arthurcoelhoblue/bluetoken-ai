import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "sonner";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Me = lazy(() => import("./pages/Me"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MonitorSgtEvents = lazy(() => import("./pages/MonitorSgtEvents"));

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
const EmailSmtpConfigPage = lazy(() => import("./pages/EmailSmtpConfigPage"));

// CS Module pages
const CSDashboardPage = lazy(() => import("./pages/cs/CSDashboardPage"));
const CSClientesPage = lazy(() => import("./pages/cs/CSClientesPage"));
const CSClienteDetailPage = lazy(() => import("./pages/cs/CSClienteDetailPage"));
const CSPesquisasPage = lazy(() => import("./pages/cs/CSPesquisasPage"));
const CSPesquisaMassaPage = lazy(() => import("./pages/cs/CSPesquisaMassaPage"));
const CSIncidenciasPage = lazy(() => import("./pages/cs/CSIncidenciasPage"));
const CSPlaybooksPage = lazy(() => import("./pages/cs/CSPlaybooksPage"));
const CSOfertasPage = lazy(() => import("./pages/admin/CSOfertasPage"));
const OperationalHealthPage = lazy(() => import("./pages/admin/OperationalHealthPage"));
const AccessControl = lazy(() => import("./pages/admin/AccessControl"));
const AdminEmpresas = lazy(() => import("./pages/AdminEmpresas"));
const WikiPage = lazy(() => import("./pages/WikiPage"));
const MarketingListsPage = lazy(() => import("./pages/MarketingListsPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Assinatura = lazy(() => import("./pages/Assinatura"));
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
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
          <ChunkErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* Public routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/f/:slug" element={<PublicFormPage />} />
                <Route path="/home" element={<Navigate to="/" replace />} />
                
                {/* Protected routes */}
                <Route path="/" element={<Index />} />
                <Route path="/meu-dia" element={<ProtectedRoute><WorkbenchPage /></ProtectedRoute>} />
                <Route path="/me" element={<ProtectedRoute><ErrorBoundary><Me /></ErrorBoundary></ProtectedRoute>} />
                
                {/* Pipeline & Deals */}
                <Route path="/pipeline" element={<ProtectedRoute screenKey="pipeline"><ErrorBoundary><PipelinePage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/contatos" element={<ProtectedRoute screenKey="contatos"><ErrorBoundary><ContatosPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/organizacoes" element={<ProtectedRoute screenKey="organizacoes"><ErrorBoundary><OrganizationsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/metas" element={<ProtectedRoute screenKey="metas"><ErrorBoundary><MetasPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/renovacao" element={<ProtectedRoute screenKey="renovacao"><ErrorBoundary><RenovacaoPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cockpit" element={<ProtectedRoute screenKey="cockpit"><ErrorBoundary><CockpitPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/relatorios" element={<ProtectedRoute screenKey="relatorios"><ErrorBoundary><AnalyticsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/relatorios/executivo" element={<ProtectedRoute screenKey="relatorios_executivo"><ErrorBoundary><AnalyticsExecutivoPage /></ErrorBoundary></ProtectedRoute>} />

                {/* Conversas & Atendimentos */}
                <Route path="/conversas" element={<ProtectedRoute screenKey="conversas"><ErrorBoundary><ConversasPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/atendimentos" element={<Navigate to="/conversas" replace />} />

                {/* Amelia & Templates */}
                <Route path="/amelia" element={<ProtectedRoute screenKey="amelia"><ErrorBoundary><AmeliaPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/amelia/mass-action" element={<ProtectedRoute screenKey="amelia_mass_action"><ErrorBoundary><AmeliaMassActionPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/templates" element={<ProtectedRoute screenKey="templates"><ErrorBoundary><TemplatesPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/integracoes" element={<Navigate to="/admin/settings" replace />} />
                <Route path="/cadencias-crm" element={<Navigate to="/cadences" replace />} />
                <Route path="/capture-forms" element={<ProtectedRoute screenKey="capture_forms"><ErrorBoundary><CaptureFormsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/capture-forms/:id/edit" element={<ProtectedRoute screenKey="capture_forms"><ErrorBoundary><CaptureFormBuilderPage /></ErrorBoundary></ProtectedRoute>} />
                
                {/* Monitor */}
                <Route path="/monitor/sgt-events" element={<ProtectedRoute screenKey="monitor_sgt"><ErrorBoundary><MonitorSgtEvents /></ErrorBoundary></ProtectedRoute>} />
                
                {/* Leads routes */}
                <Route path="/leads" element={<Navigate to="/contatos" replace />} />
                <Route path="/leads/:leadId/:empresa" element={<ProtectedRoute><ErrorBoundary><LeadDetail /></ErrorBoundary></ProtectedRoute>} />
                
                {/* Cadences routes */}
                <Route path="/cadences/new" element={<ProtectedRoute screenKey="cadencias"><ErrorBoundary><CadenceEditor /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cadences/:cadenceId/edit" element={<ProtectedRoute screenKey="cadencias"><ErrorBoundary><CadenceEditor /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cadences/runs/:runId" element={<ProtectedRoute screenKey="leads_cadencia"><ErrorBoundary><CadenceRunDetail /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cadences/runs" element={<ProtectedRoute screenKey="leads_cadencia"><ErrorBoundary><CadenceRunsList /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cadences/next-actions" element={<ProtectedRoute screenKey="proximas_acoes"><ErrorBoundary><CadenceNextActions /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cadences/:cadenceId" element={<ProtectedRoute screenKey="cadencias"><ErrorBoundary><CadenceDetail /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cadences" element={<ProtectedRoute screenKey="cadencias"><ErrorBoundary><CadencesList /></ErrorBoundary></ProtectedRoute>} />
                
                {/* Tokeniza */}
                <Route path="/tokeniza/offers" element={<ProtectedRoute><ErrorBoundary><TokenizaOffers /></ErrorBoundary></ProtectedRoute>} />
                {/* Admin routes */}
                <Route path="/admin/produtos" element={<ProtectedRoute screenKey="knowledge_base"><ErrorBoundary><ProductKnowledgeList /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/produtos/:productId" element={<ProtectedRoute screenKey="knowledge_base"><ErrorBoundary><ProductKnowledgeEditor /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute screenKey="configuracoes"><ErrorBoundary><Settings /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/leads-quentes" element={<ProtectedRoute screenKey="leads_quentes"><ErrorBoundary><LeadsQuentes /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/ai-benchmark" element={<ProtectedRoute screenKey="benchmark_ia"><ErrorBoundary><AIBenchmark /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/ai-costs" element={<ProtectedRoute screenKey="custos_ia"><ErrorBoundary><AICostDashboardPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/pendencias" element={<ProtectedRoute screenKey="pendencias_gestor"><ErrorBoundary><PendenciasPerda /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/settings/pipelines" element={<ProtectedRoute screenKey="funis_config"><ErrorBoundary><PipelineConfigPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/settings/custom-fields" element={<ProtectedRoute screenKey="campos_config"><ErrorBoundary><CustomFieldsConfigPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/importacao" element={<ProtectedRoute screenKey="importacao"><ErrorBoundary><ImportacaoPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/zadarma" element={<ProtectedRoute screenKey="telefonia_zadarma"><ErrorBoundary><ZadarmaConfigPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/email-smtp" element={<ProtectedRoute screenKey="integracoes"><ErrorBoundary><EmailSmtpConfigPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/operational-health" element={<ProtectedRoute screenKey="saude_operacional"><ErrorBoundary><OperationalHealthPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/access-control" element={<ProtectedRoute screenKey="controle_acesso"><ErrorBoundary><AccessControl /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/empresas" element={<ProtectedRoute screenKey="configuracoes"><ErrorBoundary><AdminEmpresas /></ErrorBoundary></ProtectedRoute>} />

                {/* CS Module */}
                <Route path="/cs" element={<ProtectedRoute screenKey="cs_dashboard"><ErrorBoundary><CSDashboardPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/clientes" element={<ProtectedRoute screenKey="cs_clientes"><ErrorBoundary><CSClientesPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/clientes/:id" element={<ProtectedRoute screenKey="cs_clientes"><ErrorBoundary><CSClienteDetailPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/pesquisas" element={<ProtectedRoute screenKey="cs_pesquisas"><ErrorBoundary><CSPesquisasPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/pesquisas/massa" element={<ProtectedRoute screenKey="cs_pesquisas"><ErrorBoundary><CSPesquisaMassaPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/incidencias" element={<ProtectedRoute screenKey="cs_incidencias"><ErrorBoundary><CSIncidenciasPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/playbooks" element={<ProtectedRoute screenKey="cs_playbooks"><ErrorBoundary><CSPlaybooksPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/cs/admin/ofertas" element={<ProtectedRoute screenKey="cs_ofertas_admin"><ErrorBoundary><CSOfertasPage /></ErrorBoundary></ProtectedRoute>} />

                {/* Wiki & Marketing */}
                <Route path="/marketing/listas" element={<ProtectedRoute><ErrorBoundary><MarketingListsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/assinatura" element={<ProtectedRoute><ErrorBoundary><Assinatura /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/wiki" element={<ProtectedRoute screenKey="wiki"><ErrorBoundary><WikiPage /></ErrorBoundary></ProtectedRoute>} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          </ChunkErrorBoundary>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
