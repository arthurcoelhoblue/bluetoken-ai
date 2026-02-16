import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object — Cadences Page (/cadences)
 */
export class CadencesPage {
  readonly page: Page;
  readonly cadenceCards: Locator;
  readonly newCadenceButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cadenceCards = page.locator('[data-testid="cadence-card"]');
    this.newCadenceButton = page.getByRole('button', { name: /nova|criar|new/i });
    this.searchInput = page.getByPlaceholder(/buscar|pesquisar|search/i);
  }

  async goto() {
    await this.page.goto('/cadences');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).not.toHaveURL(/\/auth/);
    await expect(this.page).toHaveURL(/\/cadences/);
  }

  async getCadenceCount(): Promise<number> {
    return await this.cadenceCards.count();
  }
}
