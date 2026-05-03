import { test, expect } from './fixtures';

test.describe('E2E-04 项目下拉 infinite scroll + 搜索 debounce', () => {
  test('搜索输入触发后端查询', async ({ loggedInPage, navWithin }) => {
    await navWithin('/projects');
    await loggedInPage.getByTestId('projects-new').click();
    const name = `E2E-04-COMBO-${Date.now()}`;
    await loggedInPage.fill('input#proj-name', name);
    await loggedInPage.getByRole('button', { name: '保存' }).click();
    await loggedInPage.waitForTimeout(500);

    await navWithin('/weighing');
    await loggedInPage.getByTestId('project-combobox-trigger').click();
    await loggedInPage.getByTestId('project-combobox-input').fill('E2E-04-COMBO');
    await loggedInPage.waitForTimeout(450); // debounce 250ms
    await expect(
      loggedInPage.locator('[data-testid^="project-combobox-item-"]').first(),
    ).toBeVisible();
  });
});
