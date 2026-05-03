import { test, expect } from './fixtures';
import { test as baseTest } from '@playwright/test';

baseTest.describe('E2E-01 登录 → 进采集页', () => {
  baseTest('登录后跳转到 /weighing 且看到 admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#username', 'admin');
    await page.fill('input#password', 'admin123!');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => u.pathname === '/weighing', { timeout: 10_000 });
    await expect(page.locator('header').getByText('admin')).toBeVisible();
    await expect(page.getByRole('button', { name: /退出/ })).toBeVisible();
  });

  baseTest('未登录访问受保护路由会重定向回登录', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });
});

test('admin 登录后导航菜单可见', async ({ loggedInPage }) => {
  await expect(loggedInPage.getByRole('link', { name: '项目' })).toBeVisible();
  await expect(loggedInPage.getByRole('link', { name: '天平' })).toBeVisible();
});
