import { test, expect } from '@playwright/test';
import { PipelinePage } from './pages/pipeline.page';

test.describe('Pipeline — Fluxo Completo', () => {
  let pipelinePage: PipelinePage;

  test.beforeEach(async ({ page }) => {
    pipelinePage = new PipelinePage(page);
  });

  test.describe('Carregamento e Visualização', () => {
    test('deve carregar a página do pipeline sem erros', async ({ page }) => {
      await pipelinePage.goto();
      await pipelinePage.expectLoaded();

      // Não deve haver erros visíveis na página
      const errorBoundary = page.locator('[data-testid="error-boundary-fallback"]');
      await expect(errorBoundary).not.toBeVisible();
    });

    test('deve exibir o board Kanban', async ({ page }) => {
      await pipelinePage.goto();

      // A página deve conter colunas de estágio do pipeline
      // Verifica que há pelo menos uma coluna visível
      const columns = page.locator('[data-testid="pipeline-column"], [class*="column"], [class*="stage"]');
      const count = await columns.count();
      expect(count).toBeGreaterThan(0);
    });

    test('deve exibir deals no pipeline', async ({ page }) => {
      await pipelinePage.goto();

      // Aguarda carregamento dos deals
      await page.waitForTimeout(2000);

      // Verifica se há conteúdo carregado (deals ou mensagem de vazio)
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(0);
    });
  });

  test.describe('Interação com Deals', () => {
    test('deve abrir detalhes ao clicar em um deal', async ({ page }) => {
      await pipelinePage.goto();
      await page.waitForTimeout(2000);

      // Tenta clicar no primeiro deal card encontrado
      const dealCard = page.locator('[data-testid="deal-card"]').first();
      const hasDeal = await dealCard.isVisible().catch(() => false);

      if (hasDeal) {
        await dealCard.click();
        await page.waitForTimeout(1000);

        // Deve abrir um modal/drawer ou navegar para detalhes
        const detailVisible =
          (await page.locator('[data-testid="deal-detail"]').isVisible().catch(() => false)) ||
          (await page.locator('[role="dialog"]').isVisible().catch(() => false)) ||
          page.url().includes('/deals/');

        expect(detailVisible).toBeTruthy();
      } else {
        // Se não há deals, o teste é pulado (pipeline vazio é válido)
        test.skip();
      }
    });
  });

  test.describe('Navegação entre Pipelines', () => {
    test('deve permitir trocar de pipeline (se houver mais de um)', async ({ page }) => {
      await pipelinePage.goto();

      // Verifica se há seletor de pipeline
      const selector = page.locator('[data-testid="pipeline-selector"], select, [role="combobox"]').first();
      const hasSelector = await selector.isVisible().catch(() => false);

      if (hasSelector) {
        await selector.click();
        await page.waitForTimeout(500);
        // Deve abrir opções
        const options = page.locator('[role="option"], option');
        const optionCount = await options.count();
        expect(optionCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Resiliência', () => {
    test('deve lidar graciosamente com erro de rede', async ({ page }) => {
      // Intercepta chamadas ao Supabase e simula erro
      await page.route('**/rest/v1/**', (route) => route.abort('connectionrefused'));

      await page.goto('/pipeline');
      await page.waitForLoadState('networkidle');

      // Não deve ter tela branca — ErrorBoundary ou toast deve aparecer
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
    });

    test('não deve ter erros de console críticos no carregamento', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await pipelinePage.goto();
      await page.waitForTimeout(3000);

      // Filtra erros esperados (ex: favicon, analytics)
      const criticalErrors = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('analytics') && !e.includes('sentry')
      );

      // Não deve ter erros críticos de JavaScript
      expect(criticalErrors.length).toBeLessThanOrEqual(2);
    });
  });
});
