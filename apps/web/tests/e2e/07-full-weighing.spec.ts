import { test, expect } from './fixtures';

test.describe('E2E-07 采集页交互', () => {
  test('采集页基本交互可见', async ({ loggedInPage, navWithin }) => {
    await navWithin('/weighing');
    await expect(loggedInPage.getByText('称重设置')).toBeVisible();
    await expect(loggedInPage.getByText('数据表格')).toBeVisible();
    await expect(loggedInPage.getByRole('button', { name: '开始称重' })).toBeVisible();
  });
});
