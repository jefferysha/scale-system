import { test, expect } from './fixtures';

test.describe('E2E-05 配置天平 + 探测连接 dialog', () => {
  test('新建天平 → 打开探测 dialog', async ({ loggedInPage, navWithin }) => {
    await navWithin('/scales');

    await loggedInPage.getByTestId('scales-new').click();
    const name = `E2E-05-Scale-${Date.now()}`;
    await loggedInPage.fill('input#scale-name', name);
    await loggedInPage.getByRole('button', { name: '保存' }).click();
    await loggedInPage.waitForTimeout(500);
    await expect(loggedInPage.getByText(name).first()).toBeVisible({ timeout: 5_000 });

    const probeBtn = loggedInPage.locator('[data-testid^="scale-probe-"]').first();
    await probeBtn.click();
    // 在 web 浏览器（无 ?mock=1）下走 UnsupportedSerialAdapter，
    // 这里至少要验证 dialog 打开 + 端口下拉可见。
    await expect(loggedInPage.getByTestId('probe-port-select')).toBeVisible();
  });
});
