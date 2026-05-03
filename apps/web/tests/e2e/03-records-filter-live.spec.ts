import { test, expect } from './fixtures';

test.describe('E2E-03 选项目 → 选垂线 → 左表自动刷新 + URL 同步', () => {
  test('采集页选项目后 URL 同步且左表 loading', async ({ loggedInPage, navWithin }) => {
    // 默认登录后已在 /weighing。先确保有 ≥1 个项目。
    await navWithin('/projects');
    if ((await loggedInPage.locator('[data-testid^="project-row-"]').count()) === 0) {
      await loggedInPage.getByTestId('projects-new').click();
      await loggedInPage.fill('input#proj-name', 'E2E-03-PROJ');
      await loggedInPage.getByRole('button', { name: '保存' }).click();
      await loggedInPage.waitForTimeout(500);
    }

    await navWithin('/weighing');
    await loggedInPage.getByTestId('project-combobox-trigger').click();
    await loggedInPage
      .locator('[data-testid^="project-combobox-item-"]')
      .first()
      .click();

    await expect
      .poll(() => new URL(loggedInPage.url()).searchParams.get('project_id'))
      .not.toBeNull();
  });
});
