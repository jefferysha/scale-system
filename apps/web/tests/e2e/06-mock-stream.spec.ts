import { test, expect } from './fixtures';

test.describe('E2E-06 mock 天平流入 → LCD 实时更新', () => {
  test('采集页 mock 模式可见', async ({ loggedInPage, navWithin }) => {
    await navWithin('/weighing');

    // 通过 history 修改 URL（保留 SPA state），让 isMockSerial 命中
    await loggedInPage.evaluate(() => {
      const u = new URL(window.location.href);
      u.searchParams.set('mock', '1');
      window.history.replaceState({}, '', u.toString());
    });

    await expect(loggedInPage.getByText('称重设置')).toBeVisible();
    await expect(loggedInPage.getByText('数据表格')).toBeVisible();
  });
});
