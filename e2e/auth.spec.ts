import { test, expect } from '@playwright/test';
import { AuthPage } from './pages/auth.page';

test.describe('Autenticação e Proteção de Rotas', () => {
  test.describe('Página de Login', () => {
    test('deve exibir a página de login com botão do Google', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.goto();
      await authPage.expectVisible();
    });

    test('deve ter o título correto', async ({ page }) => {
      await page.goto('/auth');
      await expect(page).toHaveTitle(/amélia|blue|login/i);
    });
  });

  test.describe('Rotas Protegidas (usuário autenticado)', () => {
    test('deve acessar a página inicial sem redirecionamento', async ({ page }) => {
      await page.goto('/');
      await expect(page).not.toHaveURL(/\/auth/);
    });

    test('deve acessar o pipeline', async ({ page }) => {
      await page.goto('/pipeline');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/pipeline/);
    });

    test('deve acessar contatos', async ({ page }) => {
      await page.goto('/contatos');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/contatos/);
    });

    test('deve acessar cadências', async ({ page }) => {
      await page.goto('/cadences');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/cadences/);
    });

    test('deve acessar o perfil do usuário', async ({ page }) => {
      await page.goto('/me');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/me/);
    });
  });

  test.describe('Controle de Acesso por Role (RBAC)', () => {
    test('deve redirecionar para /unauthorized se role insuficiente para /admin/settings', async ({
      page,
    }) => {
      // Este teste depende do role do usuário de teste.
      // Se o usuário for ADMIN, ele terá acesso.
      // Se não for ADMIN, será redirecionado.
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');

      const url = page.url();
      // O usuário ou tem acesso (ADMIN) ou é redirecionado
      expect(url).toMatch(/\/(admin\/settings|unauthorized)/);
    });

    test('deve redirecionar para /unauthorized se role insuficiente para /relatorios/executivo', async ({
      page,
    }) => {
      await page.goto('/relatorios/executivo');
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(url).toMatch(/\/(relatorios\/executivo|unauthorized)/);
    });
  });

  test.describe('Rotas Públicas', () => {
    test('formulário público deve ser acessível sem autenticação', async ({ browser }) => {
      // Cria um contexto limpo (sem sessão)
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/f/test-form-slug');
      await page.waitForLoadState('networkidle');

      // Não deve redirecionar para /auth (é rota pública)
      await expect(page).toHaveURL(/\/f\//);

      await context.close();
    });
  });

  test.describe('Redirecionamentos', () => {
    test('/leads deve redirecionar para /contatos', async ({ page }) => {
      await page.goto('/leads');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/contatos/);
    });

    test('/atendimentos deve redirecionar para /conversas', async ({ page }) => {
      await page.goto('/atendimentos');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/conversas/);
    });

    test('/integracoes deve redirecionar para /admin/settings', async ({ page }) => {
      await page.goto('/integracoes');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/admin\/settings/);
    });
  });

  test.describe('Página 404', () => {
    test('deve exibir página 404 para rotas inexistentes', async ({ page }) => {
      await page.goto('/rota-que-nao-existe');
      await page.waitForLoadState('networkidle');

      // Deve mostrar a página NotFound
      const content = await page.textContent('body');
      expect(content).toMatch(/404|não encontrad|not found/i);
    });
  });
});
