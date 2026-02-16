import { test, expect } from '@playwright/test';

test.describe('Módulo CS (Customer Success) — Fluxo Completo', () => {
  test.describe('Dashboard CS', () => {
    test('deve carregar o dashboard CS sem erros', async ({ page }) => {
      await page.goto('/cs');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/cs/);

      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
    });
  });

  test.describe('Clientes CS', () => {
    test('deve carregar a lista de clientes', async ({ page }) => {
      await page.goto('/cs/clientes');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/cs\/clientes/);
    });

    test('deve lidar com cliente inexistente', async ({ page }) => {
      await page.goto('/cs/clientes/00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      // Não deve ter tela branca
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
    });
  });

  test.describe('Pesquisas CS', () => {
    test('deve carregar a página de pesquisas', async ({ page }) => {
      await page.goto('/cs/pesquisas');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/cs\/pesquisas/);
    });
  });

  test.describe('Incidências CS', () => {
    test('deve carregar a página de incidências', async ({ page }) => {
      await page.goto('/cs/incidencias');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/cs\/incidencias/);
    });
  });

  test.describe('Playbooks CS', () => {
    test('deve carregar a página de playbooks', async ({ page }) => {
      await page.goto('/cs/playbooks');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/cs\/playbooks/);
    });
  });

  test.describe('Navegação entre páginas CS', () => {
    test('deve navegar entre todas as sub-páginas do CS sem erros', async ({ page }) => {
      const csPages = ['/cs', '/cs/clientes', '/cs/pesquisas', '/cs/incidencias', '/cs/playbooks'];

      for (const csPage of csPages) {
        await page.goto(csPage);
        await page.waitForLoadState('networkidle');

        // Nenhuma página deve redirecionar para /auth ou mostrar tela branca
        await expect(page).not.toHaveURL(/\/auth/);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(50);
      }
    });
  });
});
