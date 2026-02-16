import { test, expect } from '@playwright/test';

/**
 * Smoke Tests — Verificação rápida de que todas as páginas principais
 * carregam sem tela branca, sem erros de JavaScript e sem redirecionamento
 * inesperado para /auth.
 *
 * Estes testes são a primeira linha de defesa contra regressões.
 */

const PROTECTED_PAGES = [
  { path: '/', name: 'Home' },
  { path: '/meu-dia', name: 'Meu Dia (Workbench)' },
  { path: '/me', name: 'Perfil' },
  { path: '/pipeline', name: 'Pipeline' },
  { path: '/contatos', name: 'Contatos' },
  { path: '/organizacoes', name: 'Organizações' },
  { path: '/cadences', name: 'Cadências' },
  { path: '/cadences/runs', name: 'Cadence Runs' },
  { path: '/cadences/next-actions', name: 'Próximas Ações' },
  { path: '/tokeniza/offers', name: 'Tokeniza Offers' },
  { path: '/cs', name: 'CS Dashboard' },
  { path: '/cs/clientes', name: 'CS Clientes' },
  { path: '/cs/pesquisas', name: 'CS Pesquisas' },
  { path: '/cs/incidencias', name: 'CS Incidências' },
  { path: '/cs/playbooks', name: 'CS Playbooks' },
];

const ADMIN_PAGES = [
  { path: '/admin/settings', name: 'Settings' },
  { path: '/admin/produtos', name: 'Produtos' },
  { path: '/admin/ai-benchmark', name: 'AI Benchmark' },
  { path: '/admin/ai-costs', name: 'AI Costs' },
  { path: '/admin/zadarma', name: 'Zadarma Config' },
  { path: '/admin/operational-health', name: 'Operational Health' },
  { path: '/monitor/sgt-events', name: 'Monitor SGT Events' },
  { path: '/settings/pipelines', name: 'Pipeline Config' },
  { path: '/settings/custom-fields', name: 'Custom Fields' },
  { path: '/importacao', name: 'Importação' },
  { path: '/amelia', name: 'Amélia' },
  { path: '/templates', name: 'Templates' },
  { path: '/capture-forms', name: 'Capture Forms' },
  { path: '/relatorios', name: 'Relatórios' },
  { path: '/relatorios/executivo', name: 'Relatórios Executivo' },
  { path: '/conversas', name: 'Conversas' },
  { path: '/metas', name: 'Metas' },
  { path: '/cockpit', name: 'Cockpit' },
  { path: '/pendencias', name: 'Pendências' },
  { path: '/admin/leads-quentes', name: 'Leads Quentes' },
];

test.describe('Smoke Tests — Páginas Protegidas', () => {
  for (const { path, name } of PROTECTED_PAGES) {
    test(`${name} (${path}) deve carregar sem erros`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (error) => jsErrors.push(error.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // 1. Não deve redirecionar para /auth
      await expect(page).not.toHaveURL(/\/auth/);

      // 2. Não deve ter tela branca
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);

      // 3. Não deve ter erros de JavaScript não tratados
      const criticalErrors = jsErrors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});

test.describe('Smoke Tests — Páginas Admin/Restritas', () => {
  for (const { path, name } of ADMIN_PAGES) {
    test(`${name} (${path}) deve carregar ou redirecionar corretamente`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (error) => jsErrors.push(error.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const url = page.url();

      // Deve ter acesso (se ADMIN) ou ser redirecionado para /unauthorized
      // Nunca deve redirecionar para /auth (já está autenticado)
      expect(url).not.toMatch(/\/auth$/);

      // Não deve ter tela branca
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);

      // Não deve ter erros de JavaScript não tratados
      const criticalErrors = jsErrors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});

test.describe('Smoke Tests — Performance', () => {
  test('a página inicial deve carregar em menos de 5 segundos', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  test('o pipeline deve carregar em menos de 8 segundos', async ({ page }) => {
    const start = Date.now();
    await page.goto('/pipeline');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(8000);
  });
});
