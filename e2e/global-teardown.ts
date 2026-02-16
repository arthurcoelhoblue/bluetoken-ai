import { test as teardown } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, 'fixtures', '.auth', 'user.json');

teardown('cleanup auth state', async () => {
  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile);
  }
});
