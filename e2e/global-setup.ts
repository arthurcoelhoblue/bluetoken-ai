import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, 'fixtures', '.auth', 'user.json');

/**
 * Global Setup — Authenticates once and saves session state.
 *
 * The Amélia CRM uses Google OAuth via Supabase. For E2E tests,
 * we bypass the OAuth flow by injecting a valid Supabase session
 * directly into localStorage.
 *
 * Required environment variables:
 *   - E2E_USER_EMAIL: Test user email
 *   - E2E_USER_ACCESS_TOKEN: Valid Supabase access token
 *   - E2E_USER_REFRESH_TOKEN: Valid Supabase refresh token
 *
 * To generate tokens, use the Supabase Admin API or sign in manually
 * and copy the tokens from the browser's localStorage.
 */
setup('authenticate', async ({ page }) => {
  const baseURL = process.env.BASE_URL || 'http://localhost:8080';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const accessToken = process.env.E2E_USER_ACCESS_TOKEN || '';
  const refreshToken = process.env.E2E_USER_REFRESH_TOKEN || '';

  if (!accessToken || !refreshToken) {
    throw new Error(
      'E2E auth tokens not set. Provide E2E_USER_ACCESS_TOKEN and E2E_USER_REFRESH_TOKEN.'
    );
  }

  // Navigate to the app so we can set localStorage on the correct origin
  await page.goto(baseURL + '/auth');

  // Inject Supabase session into localStorage
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  await page.evaluate(
    ({ key, access, refresh }) => {
      const session = {
        access_token: access,
        refresh_token: refresh,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };
      localStorage.setItem(key, JSON.stringify(session));
    },
    { key: storageKey, access: accessToken, refresh: refreshToken }
  );

  // Navigate to home and verify authentication succeeded
  await page.goto(baseURL + '/');
  await expect(page).not.toHaveURL(/\/auth/);

  // Save authenticated state for reuse by all test projects
  await page.context().storageState({ path: authFile });
});
