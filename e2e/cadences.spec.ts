import { test, expect } from '@playwright/test';
import { CadencesPage } from './pages/cadences.page';

test.describe('Cadências — Fluxo Completo', () => {
  let cadencesPage: CadencesPage;

  test.beforeEach(async ({ page }) => {
    cadencesPage = new CadencesPage(page);
  });

  test.describe('Carregamento e Visualização', () => {
    test('deve carregar a página de cadências sem erros', async ({ page }) => {
      await cadencesPage.goto();
      await cadencesPage.expectLoaded();
    });

    test('deve exibir lista de cadências ou mensagem de vazio', async ({ page }) => {
      await cadencesPage.goto();

      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
    });
  });

  test.describe('Navegação para Sub-rotas', () => {
    test('deve acessar a lista de runs', async ({ page }) => {
      await page.goto('/cadences/runs');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/cadences\/runs/);
    });

    test('deve acessar as próximas ações', async ({ page }) => {
      await page.goto('/cadences/next-actions');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/cadences\/next-actions/);
    });
  });

  test.describe('Resiliência', () => {
    test('deve lidar graciosamente com cadência inexistente', async ({ page }) => {
      await page.goto('/cadences/00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      // Não deve ter tela branca
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
    });

    test('deve lidar graciosamente com run inexistente', async ({ page }) => {
      await page.goto('/cadences/runs/00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
    });
  });
});
