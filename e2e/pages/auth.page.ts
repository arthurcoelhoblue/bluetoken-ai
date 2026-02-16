import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object — Auth Page (/auth)
 */
export class AuthPage {
  readonly page: Page;
  readonly googleButton: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.googleButton = page.getByRole('button', { name: /google/i });
    this.heading = page.getByRole('heading', { level: 1 });
  }

  async goto() {
    await this.page.goto('/auth');
  }

  async expectVisible() {
    await expect(this.googleButton).toBeVisible();
  }
}
