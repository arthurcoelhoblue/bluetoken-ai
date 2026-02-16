import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object — Contatos Page (/contatos)
 */
export class ContatosPage {
  readonly page: Page;
  readonly contactsTable: Locator;
  readonly contactRows: Locator;
  readonly searchInput: Locator;
  readonly newContactButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.contactsTable = page.locator('table');
    this.contactRows = page.locator('table tbody tr');
    this.searchInput = page.getByPlaceholder(/buscar|pesquisar|search/i);
    this.newContactButton = page.getByRole('button', { name: /novo|adicionar|new/i });
  }

  async goto() {
    await this.page.goto('/contatos');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).not.toHaveURL(/\/auth/);
    await expect(this.page).toHaveURL(/\/contatos/);
  }

  async search(term: string) {
    await this.searchInput.fill(term);
    // Wait for debounce and network
    await this.page.waitForTimeout(500);
    await this.page.waitForLoadState('networkidle');
  }

  async getContactCount(): Promise<number> {
    return await this.contactRows.count();
  }
}
