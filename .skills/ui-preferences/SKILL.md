---
name: ui-preferences
description: >-
  JxShap 项目 UI 模式库与审美边界。新建/重构页面、View、组件、区块、抽屉、表单、CSS 样式、
  布局排版时必须读取；按 preferences.md 可复用模式组合界面；用户确认或否决后写入变更记录。
  Triggers: 重构页面, 改样式, 新组件, 新页面, UI, 界面, 美化, layout, styling.
---

# 项目 UI 偏好（JxShap）

维护本仓库 **可复用的 UI 模式库** 与 **审美边界**。具体页面（HomeView、SettingsView 等）是模式的 **验证实例**，不是「某页专属样式表」。

## 目标

用户用自然语言描述页面意图与内容 → Agent 读取 `preferences.md` 中的 **模式 + 避免事项 + 已确认决策** → 产出符合其口味的界面。偏好随对话 **迭代收敛**，不是一次性写死。

## 何时使用（强制）

以下任务 **必须先读本 skill + `preferences.md`**，并与 `frontend-design` 一并启用：

- 新建 / 改造 **页面、View、组件、区块、抽屉、表单**
- 修改 **样式、布局、排版、动效、主题**
- 评审 UI 是否「像 JxShap」还是「灰线框 / AI 模板」
- 用户表达满意 / 不满意时，**立即抽象进偏好文档**

> UI 工作流见 `.skills/README.md`；Cursor 另见 `.cursor/rules/ui-skills-required.mdc`

## 核心原则（速查）

1. **外层 panel、内层 inset** — 边框一层；inset 仅底色分区
2. **主题色做线条与 wash** — H2 竖条、callout 内直条、渐变底；**禁止** panel 加粗左边条与 section 顶条渐变
3. **模式组合，非页面抄作业** — 从模式库选 `page-head-compact` + `section-panel` + …，类名随页面变
4. **hover 只改色** — 禁止 hover 位移 / scale / 阴影爆开
5. **token + color-mix** — 不写死 hex

完整模式库见 [preferences.md](preferences.md) 第 2–9 节。

## 执行规则

1. **先查模式库**：对照 `preferences.md`；需要写法时查「模式 → 参考实现」表，打开对应 Vue 文件片段。
2. **抽象后再记**：用户确认或否决时，提炼为 **跨页面模式规则**，**禁止**只写「SettingsView 怎样怎样」而不归纳。
3. **改完必记**：更新正文模式 / 避免事项；变更记录 **同主题合并、异主题分行**。
4. **只记共识**：稳定规则进正文；未拍板的实验只记变更记录。
5. **并存 skill（UI 任务强制双读）**：文案 `project-glossary`；工程 `vue3-standards`；**样式任务同时读 `frontend-design`**，冲突 **以本 skill 为准**。

## 更新流程（持续收敛）

1. **回顾对话**：用户否决了什么、保留了什么、为什么。
2. **更新模式**：改「模式库」条目——用法、尺寸、何时用 / 何时不用。
3. **更新避免事项**：把被否决的做法写进第 9 节。
4. **写变更记录**：宜简；同主题可合并；不同页面分行。
5. **挂参考实现**：在「模式 → 参考实现」表补一行实例路径。
6. **维护位置**：**仅编辑** `.skills/ui-preferences/`（本目录），勿在工具入口目录复制正文。

## 参考文件

| 文件 | 用途 |
| --- | --- |
| [preferences.md](preferences.md) | 模式库、避免事项、变更记录 |
| `src/features/home/views/HomeView.vue` | 落地页 / 双栏 / link-row 等实例 |
| `src/features/settings/views/SettingsView.vue` | 工具页 / form-stack / theme-quote 等实例 |
| `src/features/donation/views/DonationView.vue` | 工具页 / page-stack / qr-panel 实例 |
| `src/features/wiki/views/WikiView.vue` | 长列表 / scroll-chrome-collapse 实例 |
| `src/shared/themes/decorative-home.css` | 主题外层装饰（inset 保持中性） |
