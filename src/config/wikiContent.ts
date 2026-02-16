// Wiki content registry - imports all markdown docs via Vite raw imports

// Root docs
import introMd from '../../docs-site/docs/intro.md?raw';
import guiaRapidoMd from '../../docs-site/docs/guia-rapido.md?raw';

// Vendedor
import vendedorIndexMd from '../../docs-site/docs/vendedor/index.md?raw';
import vendedorMeuDiaMd from '../../docs-site/docs/vendedor/meu-dia.md?raw';
import vendedorPipelineMd from '../../docs-site/docs/vendedor/pipeline.md?raw';
import vendedorDealsMd from '../../docs-site/docs/vendedor/deals.md?raw';
import vendedorConversasMd from '../../docs-site/docs/vendedor/conversas.md?raw';
import vendedorCadenciasMd from '../../docs-site/docs/vendedor/cadencias.md?raw';
import vendedorMetasMd from '../../docs-site/docs/vendedor/metas.md?raw';
import vendedorLeadsQuentesMd from '../../docs-site/docs/vendedor/leads-quentes.md?raw';
import vendedorTelefoniaMd from '../../docs-site/docs/vendedor/telefonia.md?raw';
import vendedorFaqMd from '../../docs-site/docs/vendedor/faq.md?raw';

// CS
import csIndexMd from '../../docs-site/docs/cs/index.md?raw';
import csDashboardMd from '../../docs-site/docs/cs/dashboard.md?raw';
import csClientesMd from '../../docs-site/docs/cs/clientes.md?raw';
import csHealthScoreMd from '../../docs-site/docs/cs/health-score.md?raw';
import csPesquisasMd from '../../docs-site/docs/cs/pesquisas.md?raw';
import csIncidenciasMd from '../../docs-site/docs/cs/incidencias.md?raw';
import csPlaybooksMd from '../../docs-site/docs/cs/playbooks.md?raw';
import csRenovacoesMd from '../../docs-site/docs/cs/renovacoes.md?raw';
import csChurnMd from '../../docs-site/docs/cs/churn.md?raw';
import csBriefingMd from '../../docs-site/docs/cs/briefing.md?raw';
import csFaqMd from '../../docs-site/docs/cs/faq.md?raw';

// Gestor
import gestorIndexMd from '../../docs-site/docs/gestor/index.md?raw';
import gestorAnalyticsMd from '../../docs-site/docs/gestor/analytics.md?raw';
import gestorCockpitMd from '../../docs-site/docs/gestor/cockpit.md?raw';
import gestorPerformanceMd from '../../docs-site/docs/gestor/performance.md?raw';
import gestorPipelinesConfigMd from '../../docs-site/docs/gestor/pipelines-config.md?raw';
import gestorCamposCustomMd from '../../docs-site/docs/gestor/campos-custom.md?raw';
import gestorTemplatesMd from '../../docs-site/docs/gestor/templates.md?raw';
import gestorUsuariosMd from '../../docs-site/docs/gestor/usuarios.md?raw';
import gestorFaqMd from '../../docs-site/docs/gestor/faq.md?raw';

// Admin
import adminIndexMd from '../../docs-site/docs/admin/index.md?raw';
import adminIaConfigMd from '../../docs-site/docs/admin/ia-config.md?raw';
import adminConhecimentoMd from '../../docs-site/docs/admin/conhecimento.md?raw';
import adminCustosIaMd from '../../docs-site/docs/admin/custos-ia.md?raw';
import adminBenchmarkMd from '../../docs-site/docs/admin/benchmark.md?raw';
import adminIntegracoesMd from '../../docs-site/docs/admin/integracoes.md?raw';
import adminImportacaoMd from '../../docs-site/docs/admin/importacao.md?raw';
import adminSaudeOperacionalMd from '../../docs-site/docs/admin/saude-operacional.md?raw';
import adminCronJobsMd from '../../docs-site/docs/admin/cron-jobs.md?raw';
import adminMultiTenancyMd from '../../docs-site/docs/admin/multi-tenancy.md?raw';
import adminFaqMd from '../../docs-site/docs/admin/faq.md?raw';

// Desenvolvedor
import devIndexMd from '../../docs-site/docs/desenvolvedor/index.md?raw';
import devStackMd from '../../docs-site/docs/desenvolvedor/stack.md?raw';
import devEdgeFunctionsMd from '../../docs-site/docs/desenvolvedor/edge-functions.md?raw';
import devRlsMd from '../../docs-site/docs/desenvolvedor/rls.md?raw';
import devMultiTenancyMd from '../../docs-site/docs/desenvolvedor/multi-tenancy.md?raw';
import devSdrIaMd from '../../docs-site/docs/desenvolvedor/sdr-ia.md?raw';
import devCadenceEngineMd from '../../docs-site/docs/desenvolvedor/cadence-engine.md?raw';
import devWebhooksMd from '../../docs-site/docs/desenvolvedor/webhooks.md?raw';
import devApiReferenceMd from '../../docs-site/docs/desenvolvedor/api-reference.md?raw';
import devAdrMd from '../../docs-site/docs/desenvolvedor/adr.md?raw';
import devTestesMd from '../../docs-site/docs/desenvolvedor/testes.md?raw';

export interface WikiPage {
  slug: string;
  title: string;
  group: string;
  content: string;
}

function extractTitle(content: string, fallback: string): string {
  // Try to get title from frontmatter
  const fmMatch = content.match(/^---[\s\S]*?title:\s*(.+?)$/m);
  if (fmMatch) return fmMatch[1].trim();
  // Try first H1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return fallback;
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n*/, '');
}

function page(slug: string, group: string, content: string, fallbackTitle: string): WikiPage {
  return {
    slug,
    title: extractTitle(content, fallbackTitle),
    group,
    content: stripFrontmatter(content),
  };
}

export const WIKI_PAGES: WikiPage[] = [
  // Geral
  page('intro', 'Geral', introMd, 'Introdução'),
  page('guia-rapido', 'Geral', guiaRapidoMd, 'Guia Rápido'),

  // Vendedor
  page('vendedor', 'Vendedor', vendedorIndexMd, 'Manual do Vendedor'),
  page('vendedor/meu-dia', 'Vendedor', vendedorMeuDiaMd, 'Meu Dia'),
  page('vendedor/pipeline', 'Vendedor', vendedorPipelineMd, 'Pipeline'),
  page('vendedor/deals', 'Vendedor', vendedorDealsMd, 'Deals'),
  page('vendedor/conversas', 'Vendedor', vendedorConversasMd, 'Conversas'),
  page('vendedor/cadencias', 'Vendedor', vendedorCadenciasMd, 'Cadências'),
  page('vendedor/metas', 'Vendedor', vendedorMetasMd, 'Metas'),
  page('vendedor/leads-quentes', 'Vendedor', vendedorLeadsQuentesMd, 'Leads Quentes'),
  page('vendedor/telefonia', 'Vendedor', vendedorTelefoniaMd, 'Telefonia'),
  page('vendedor/faq', 'Vendedor', vendedorFaqMd, 'FAQ Vendedor'),

  // CS
  page('cs', 'Sucesso do Cliente', csIndexMd, 'Manual CS'),
  page('cs/dashboard', 'Sucesso do Cliente', csDashboardMd, 'Dashboard CS'),
  page('cs/clientes', 'Sucesso do Cliente', csClientesMd, 'Clientes'),
  page('cs/health-score', 'Sucesso do Cliente', csHealthScoreMd, 'Health Score'),
  page('cs/pesquisas', 'Sucesso do Cliente', csPesquisasMd, 'Pesquisas'),
  page('cs/incidencias', 'Sucesso do Cliente', csIncidenciasMd, 'Incidências'),
  page('cs/playbooks', 'Sucesso do Cliente', csPlaybooksMd, 'Playbooks'),
  page('cs/renovacoes', 'Sucesso do Cliente', csRenovacoesMd, 'Renovações'),
  page('cs/churn', 'Sucesso do Cliente', csChurnMd, 'Churn'),
  page('cs/briefing', 'Sucesso do Cliente', csBriefingMd, 'Briefing'),
  page('cs/faq', 'Sucesso do Cliente', csFaqMd, 'FAQ CS'),

  // Gestor
  page('gestor', 'Gestor', gestorIndexMd, 'Manual do Gestor'),
  page('gestor/analytics', 'Gestor', gestorAnalyticsMd, 'Analytics'),
  page('gestor/cockpit', 'Gestor', gestorCockpitMd, 'Cockpit'),
  page('gestor/performance', 'Gestor', gestorPerformanceMd, 'Performance'),
  page('gestor/pipelines-config', 'Gestor', gestorPipelinesConfigMd, 'Config. Funis'),
  page('gestor/campos-custom', 'Gestor', gestorCamposCustomMd, 'Campos Custom'),
  page('gestor/templates', 'Gestor', gestorTemplatesMd, 'Templates'),
  page('gestor/usuarios', 'Gestor', gestorUsuariosMd, 'Usuários'),
  page('gestor/faq', 'Gestor', gestorFaqMd, 'FAQ Gestor'),

  // Admin
  page('admin', 'Administrador', adminIndexMd, 'Manual do Admin'),
  page('admin/ia-config', 'Administrador', adminIaConfigMd, 'Config. IA'),
  page('admin/conhecimento', 'Administrador', adminConhecimentoMd, 'Base de Conhecimento'),
  page('admin/custos-ia', 'Administrador', adminCustosIaMd, 'Custos IA'),
  page('admin/benchmark', 'Administrador', adminBenchmarkMd, 'Benchmark'),
  page('admin/integracoes', 'Administrador', adminIntegracoesMd, 'Integrações'),
  page('admin/importacao', 'Administrador', adminImportacaoMd, 'Importação'),
  page('admin/saude-operacional', 'Administrador', adminSaudeOperacionalMd, 'Saúde Operacional'),
  page('admin/cron-jobs', 'Administrador', adminCronJobsMd, 'CRON Jobs'),
  page('admin/multi-tenancy', 'Administrador', adminMultiTenancyMd, 'Multi-tenancy'),
  page('admin/faq', 'Administrador', adminFaqMd, 'FAQ Admin'),

  // Desenvolvedor
  page('dev', 'Desenvolvedor', devIndexMd, 'Manual do Dev'),
  page('dev/stack', 'Desenvolvedor', devStackMd, 'Stack'),
  page('dev/edge-functions', 'Desenvolvedor', devEdgeFunctionsMd, 'Edge Functions'),
  page('dev/rls', 'Desenvolvedor', devRlsMd, 'RLS'),
  page('dev/multi-tenancy', 'Desenvolvedor', devMultiTenancyMd, 'Multi-tenancy'),
  page('dev/sdr-ia', 'Desenvolvedor', devSdrIaMd, 'SDR IA'),
  page('dev/cadence-engine', 'Desenvolvedor', devCadenceEngineMd, 'Cadence Engine'),
  page('dev/webhooks', 'Desenvolvedor', devWebhooksMd, 'Webhooks'),
  page('dev/api-reference', 'Desenvolvedor', devApiReferenceMd, 'API Reference'),
  page('dev/adr', 'Desenvolvedor', devAdrMd, 'ADR'),
  page('dev/testes', 'Desenvolvedor', devTestesMd, 'Testes'),
];

export const WIKI_GROUPS = [...new Set(WIKI_PAGES.map(p => p.group))];

export function getWikiPagesByGroup(): Record<string, WikiPage[]> {
  return WIKI_PAGES.reduce((acc, page) => {
    if (!acc[page.group]) acc[page.group] = [];
    acc[page.group].push(page);
    return acc;
  }, {} as Record<string, WikiPage[]>);
}
