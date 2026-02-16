import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object — Pipeline Page (/pipeline)
 */
export class PipelinePage {
  readonly page: Page;
  readonly kanbanBoard: Locator;
  readonly dealCards: Locator;
  readonly searchInput: Locator;
  readonly pipelineSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.kanbanBoard = page.locator('[data-testid="kanban-board"]');
    this.dealCards = page.locator('[data-testid="deal-card"]');
    this.searchInput = page.getByPlaceholder(/buscar|pesquisar|search/i);
    this.pipelineSelector = page.locator('[data-testid="pipeline-selector"]');
  }

  async goto() {
    await this.page.goto('/pipeline');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    // Pipeline page should have loaded without redirecting to auth
    await expect(this.page).not.toHaveURL(/\/auth/);
    await expect(this.page).toHaveURL(/\/pipeline/);
  }

  async getDealCount(): Promise<number> {
    return await this.dealCards.count();
  }

  async clickFirstDeal() {
    const first = this.dealCards.first();
    await expect(first).toBeVisible();
    await first.click();
  }
}
