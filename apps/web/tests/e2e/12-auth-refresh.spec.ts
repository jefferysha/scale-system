import { test, expect } from './fixtures';

test.describe('E2E-12 鉴权失败：401 自动 refresh / 强制登出', () => {
  test('点击退出后回到 /login', async ({ loggedInPage }) => {
    await loggedInPage.getByRole('button', { name: /退出/ }).click();
    await loggedInPage.waitForURL((u) => u.pathname.includes('/login'), {
      timeout: 5_000,
    });
    await expect(loggedInPage).toHaveURL(/\/login/);
  });

  test('未带 token 访问受保护资源会触发跳登录', async ({ page }) => {
    // 直接打开 /weighing，没 access token：cookie 也不存在 → 401 → reset → 跳 /login
    await page.goto('/weighing');
    await expect(page).toHaveURL(/\/login/);
  });
});
