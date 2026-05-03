import { test, expect } from './fixtures';

test.describe('E2E-09 项目 + 杯库 CRUD', () => {
  test('新建项目 + 新建杯', async ({ loggedInPage, navWithin }) => {
    await navWithin('/projects');
    const projName = `E2E-09-Proj-${Date.now()}`;
    await loggedInPage.getByTestId('projects-new').click();
    await loggedInPage.fill('input#proj-name', projName);
    await loggedInPage.getByRole('button', { name: '保存' }).click();
    await expect(loggedInPage.getByText(projName).first()).toBeVisible({ timeout: 5_000 });

    await navWithin('/cups');
    const cupName = `C-E2E-${Date.now() % 1000000}`;
    await loggedInPage.getByTestId('cups-new').click();
    await loggedInPage.fill('input#cup-number', cupName);
    await loggedInPage.fill('input#cup-tare', '35.0');
    await loggedInPage.getByRole('button', { name: '保存' }).click();
    await loggedInPage.waitForTimeout(800);
    // 列表可能很大；用搜索定位新建项。
    await loggedInPage.locator('[data-testid=cups-search]').fill(cupName);
    await expect(loggedInPage.getByText(cupName).first()).toBeVisible({ timeout: 8_000 });
  });
});
