import { test as base, type Page, expect } from '@playwright/test';

/**
 * loggedInPage：每个测试都拿一个已登录 admin 的 Page。
 *
 * 注意：access token 仅存在内存中（refresh cookie 是 __Host- 前缀，HTTP 下浏览器不接受）。
 * 因此所有测试必须用 SPA 内导航（点 NavMenu 链接或 page.evaluate 推 history），
 * 禁止 page.goto('/...') 跳到非 /login 受保护路由 —— 否则会被踢回 /login。
 *
 * 提供 navWithin 帮助函数。
 */

interface Fixtures {
  loggedInPage: Page;
  navWithin: (
    target: '/' | '/weighing' | '/scales' | '/projects' | '/cups' | '/records',
  ) => Promise<void>;
}

const NAV_LABEL: Record<string, string> = {
  '/': '采集',
  '/weighing': '采集',
  '/scales': '天平',
  '/projects': '项目',
  '/cups': '杯库',
  '/records': '数据',
};

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('input#username', 'admin');
    await page.fill('input#password', 'admin123!');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
    await use(page);
  },
  navWithin: async ({ page }, use) => {
    const fn = async (
      target: '/' | '/weighing' | '/scales' | '/projects' | '/cups' | '/records',
    ): Promise<void> => {
      const label = NAV_LABEL[target];
      await page.getByRole('link', { name: label, exact: true }).click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toMatch(target === '/' ? '/weighing' : target);
    };
    await use(fn);
  },
});

export { expect } from '@playwright/test';
