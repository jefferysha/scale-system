# Legacy 归档

Phase 4 之前的原始 HTML 原型，仅作参考保留。

## 内容

- `scale-system.html` — 1150 行单文件原型，Phase 4 会复刻成 React 组件
- `balance.png` — 天平大图，Phase 4 直接复用到 `apps/web/public/balance.png`
- `balance.svg` — 天平矢量图（备用）

## 删除时机

Phase 4 完全复刻后，本目录可整体删除。届时建议：

```bash
git rm -r legacy/
git commit -m "chore: remove legacy HTML 原型 (Phase 4 已完成复刻)"
```

## 设计参考

复刻时请保留以下视觉/交互特性：
- 深/浅双主题（CSS 变量已迁移到 `apps/web/src/styles/tokens.css`）
- LCD 数字 + 稳定灯
- SCADA 风格状态徽章 + 闪烁 LED
- 顶栏品牌 + 导航 + 主题切换 + 用户卡
- 三栏布局：数据表 / 天平 + 6 指标 + 垂线图 / 配置面板
