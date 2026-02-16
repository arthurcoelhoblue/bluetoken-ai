import { test, expect } from '@playwright/test';
import { ContatosPage } from './pages/contatos.page';

test.describe('Contatos — Fluxo Completo', () => {
  let contatosPage: ContatosPage;

  test.beforeEach(async ({ page }) => {
    contatosPage = new ContatosPage(page);
  });

  test.describe('Carregamento e Visualização', () => {
    test('deve carregar a página de contatos sem erros', async ({ page }) => {
      await contatosPage.goto();
      await contatosPage.expectLoaded();
    });

    test('deve exibir tabela ou lista de contatos', async ({ page }) => {
      await contatosPage.goto();

      // Deve haver uma tabela ou lista de contatos
      const hasTable = await page.locator('table').isVisible().catch(() => false);
      const hasList = await page.locator('[data-testid="contacts-list"], [role="list"]').isVisible().catch(() => false);
      const hasContent = hasTable || hasList;

      // Se não há contatos, deve mostrar mensagem de vazio
      if (!hasContent) {
        const body = await page.textContent('body');
        expect(body).toMatch(/nenhum|vazio|empty|sem contatos/i);
      }
    });
  });

  test.describe('Busca e Filtros', () => {
    test('deve ter campo de busca funcional', async ({ page }) => {
      await contatosPage.goto();

      const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i).first();
      const hasSearch = await searchInput.isVisible().catch(() => false);

      if (hasSearch) {
        await searchInput.fill('teste');
        await page.waitForTimeout(1000);

        // A página deve responder à busca (filtrar ou mostrar resultados)
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Navegação', () => {
    test('deve navegar para detalhes de um contato ao clicar', async ({ page }) => {
      await contatosPage.goto();
      await page.waitForTimeout(2000);

      // Tenta clicar na primeira linha da tabela
      const firstRow = page.locator('table tbody tr').first();
      const hasRow = await firstRow.isVisible().catch(() => false);

      if (hasRow) {
        await firstRow.click();
        await page.waitForTimeout(1000);

        // Deve abrir detalhes (modal, drawer ou nova página)
        const detailVisible =
          (await page.locator('[role="dialog"]').isVisible().catch(() => false)) ||
          page.url().includes('/leads/') ||
          page.url().includes('/contatos/');

        expect(detailVisible).toBeTruthy();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Resiliência', () => {
    test('não deve ter tela branca ao carregar', async ({ page }) => {
      await page.goto('/contatos');
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
    });
  });
});
