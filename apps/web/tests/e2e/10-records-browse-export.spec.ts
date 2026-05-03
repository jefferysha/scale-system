import { test, expect } from './fixtures';

test.describe('E2E-10 数据浏览页 + CSV 导出', () => {
  test('页面可达 + 导出按钮触发下载', async ({ loggedInPage, navWithin }) => {
    await navWithin('/records');
    await expect(loggedInPage.getByText('数据浏览')).toBeVisible();

    const downloadPromise = loggedInPage.waitForEvent('download');
    await loggedInPage.getByTestId('records-export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^records-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
