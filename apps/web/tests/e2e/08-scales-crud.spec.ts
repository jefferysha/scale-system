import { test, expect } from './fixtures';

test.describe('E2E-08 天平 CRUD', () => {
  test('新建后行可见', async ({ loggedInPage, navWithin }) => {
    await navWithin('/scales');
    await loggedInPage.getByTestId('scales-new').click();
    const name = `E2E-08-Scale-${Date.now()}`;
    await loggedInPage.fill('input#scale-name', name);
    await loggedInPage.getByRole('button', { name: '保存' }).click();
    // 等待 toast 关闭与列表 invalidate
    await loggedInPage.waitForTimeout(500);
    await expect(loggedInPage.getByText(name).first()).toBeVisible({ timeout: 5_000 });
  });
});
