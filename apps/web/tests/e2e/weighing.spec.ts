import { test } from '@playwright/test';

/**
 * Phase 4 E2E 占位
 *
 * 当前 phase 没接 BE，无法走完整登录 → 采集页动线。
 * 完整动线 E2E（E2E-06 / E2E-07：mock 串口流入 LCD、5s 后 stable、点录入提交）
 * 在 Phase 5（接 BE 后能真实登录）补完。
 *
 * 此处仅留 skip 占位，避免 file empty。Phase 3 已有的 4 个冒烟用例（smoke.spec.ts）
 * 仍是 Phase 4 必须保持绿色的回归用例。
 */
test.describe('采集页（mock 串口）', () => {
  test.skip('三栏布局可见', async ({ page }) => {
    // Phase 5 接 BE 后启用：先注入 fake auth state，再访问 /weighing?mock=1
    await page.goto('/weighing?mock=1');
  });

  test.skip('mock 串口流入 LCD 实时更新', async ({ page }) => {
    // Phase 5 接 BE 后启用：登录 + 选项目/垂线/杯号 + 开始称重 + 校验 LCD 数字变化
    await page.goto('/weighing?mock=1');
  });
});
