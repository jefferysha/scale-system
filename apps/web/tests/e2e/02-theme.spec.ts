import { test, expect } from './fixtures';

test.describe('E2E-02 切换主题', () => {
  test('深 ↔ 浅切换 + 持久化', async ({ loggedInPage }) => {
    const html = loggedInPage.locator('html');
    const before = await html.getAttribute('data-theme');

    // 切到另一个主题
    const target = before === 'light' ? '深色' : '浅色';
    await loggedInPage.getByRole('button', { name: target }).click();
    await expect.poll(async () => html.getAttribute('data-theme')).not.toBe(before);

    const after = await html.getAttribute('data-theme');
    await loggedInPage.reload();
    await expect(html).toHaveAttribute('data-theme', after ?? '');
  });
});
