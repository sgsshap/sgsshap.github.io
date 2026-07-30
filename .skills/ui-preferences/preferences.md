# JxShap 项目 UI 偏好

> **模式库**，不是「某页样式清单」。规则按 **可复用模式** 组织；HomeView、SettingsView 等是验证实例。
> 用户每次确认 / 否决的审美决策，抽象进正文并写入「变更记录」，持续收敛，直到 **给文案即可产出合口味的页面**。
> **同一轮对话内，仅对同一主题/页面的反复修改合并为一条**；不同页面、不同模式决策 **各记一条**，禁止覆盖抹掉已有摘要。
> **UI 任务强制工作流**：见 [`.skills/README.md`](../README.md) 与各工具 `.cursor/rules/ui-skills-required.mdc`；须同时读取 `ui-preferences` + `frontend-design` skill。

---

## 1. 总体气质

| 原则 | 说明 |
| --- | --- |
| **有结构的主题感** | 工具站气质 + 主题色点缀；避免灰底线框「原型感」 |
| **克制 ≠ 寡淡** | 可大胆用渐变 wash、竖条、quote 卡；禁 **杂乱** 与 **套娃边框** |
| **主题驱动** | Naive token + `color-mix(in srgb, var(--primary-color) …)`，不写死 hex |
| **三国杀语境** | 势力主题装饰外层 shell；inset、表单、列表保持中性可读 |
| **拒绝 AI 模板感** | 见第 9 节；尤其：编号区块、全页顶条、大 letter-spacing 胶囊 label、bento 拼盘 |

**一句话**：外层 panel 定边界，内层 inset 分区；主题色做 **线条与 wash**；**按模式组合**，不按页面名抄样式。

---

## 2. 层次与边框（panel / inset）

| 层级 | 职责 | 样式 |
| --- | --- | --- |
| **外层 panel** | 区块容器 | 均匀 `border` + `border-radius` + `background: var(--card-color)`；**禁止**加粗左边条（见第 9 节） |
| **内层 inset** | 内部分组 | **仅** `background` + `padding` + 圆角，**不再套 border** |
| **可点击单元** | 链接 / 操作行 | 单层 border + 浅色底；顶条渐变 **仅在此类块偶发** |

### 禁止

- panel 套 card 套 inset（盒中盒）
- 同一区域两条平行边框
- `n-card` 套 `n-card` 做简单分区

### 间距 token（全站内容页统一）

```css
--page-p: 28px;
--page-inset: 20px;
--page-gap: 16px;
--page-r: 12px;
--page-p-top: calc(var(--page-p) - 8px); /* 可选：卡片顶内边距，见下节 */
```

### 不对称内边距（视觉平衡）

- 卡片 / inset 内 **首行正文距顶边可略近**：顶 padding 比左右、底 **小 4–8px**（如 `--page-p-top` + 左右底用 `--page-p`）
- **几何上的不对称** 换 **视觉上的对称感**；与 fixed 顶栏、邻块之间的 **外边距** 仍用正常 `--page-gap`，不要靠挤顶内边距代替
- 适用：详情卡、inset 分区、版本 chrome 等 **首行即正文** 的容器；底栏 / 页脚区保持常规 padding

---

## 3. 模式库

> 新页面 = 选模式组合 + 填内容。类名可 `{page}-view__…`，语义对齐即可。

### 3.1 页头

| 模式 | 适用 | 要点 |
| --- | --- | --- |
| **`page-head-hero`** | 品牌落地 / 拉新（首页） | 大渐变 H1、`clamp(2.35rem, 4.8vw, 3.15rem)`、800；可分栏 + 右操作区 + 轻 wash |
| **`page-head-compact`** | 工具 / 设置 / 列表等内容页 | **panel + 主题 wash**（与下方 plain section 区分）；H1 **24px / 700**；eyebrow + lead；**无**加粗左边条、**无**裸标题底部分割线 |

**不要** 在设置、百科、捐助等内容页使用 hero 级大标题。

### 3.2 区块与分区

| 模式 | 适用 | 要点 |
| --- | --- | --- |
| **`section-panel`** | 任意内容区块 | 外层 panel + `section-head`（底部分割线 + H2 左 **竖条** 19px/800 + 可选 desc） |
| **`cols-2`** | PC 信息 **足够多**、对等内容可并排 | `grid 1fr 1fr`、`gap: var(--page-gap)`、`max-width: 1080px`；≤860px 单栏。**区块少 / 内容短时用单栏**，不要为双栏而双栏 |
| **`page-stack`** | 内容页默认单栏堆叠 | panel 纵向 `gap`；信息少 `max-width` **640–720px**；可 **页头 + 一块 community-stack** 代替多个空 panel |
| **`inset-form-stack`** | 表单 / 设置项列表 | **单个 inset** + 内部分割线；行 padding 约 **10px 0**；label + hint + 控件同一行（窄屏可堆叠） |
| **`prose`** | 说明段落 | 14px、`line-height: 1.85`、`--text-color-2` |

**section-panel 不加顶条渐变**（全页重复显脏，已否决）。

### 3.3 强调与展示

| 模式 | 适用 | 要点 |
| --- | --- | --- |
| **`callout-inline`** | 段内一句强调 | 左 4px 渐变竖条 + inset wash + 15px/600；用于开发者说等 **行内引用** |
| **`theme-quote`** | 主题 / 字体 **一起预览** | 居中渐变 + 「」引号；署名 plain 小字（禁 capsule tag）；台词 `--site-font-family`、字距 **≤0.05em**、`balance` + `keep-all`；长句略缩字号；引号留边距勿压字 |
| **`community-stack`** | 组合信息一块展示 | 单外框 + 内部分割线 + 分区 label；上区可加 radial wash（QQ 群 + 捐助、故事 + 扫码等） |
| **`qr-panel`** | 扫码 / 收款展示 | 置于 stack 或 inset 内；支付方式一行 + 分割线 + 居中 QR；元信息 plain 小字；QR 框 primary 边框 + 轻 wash |

**theme-quote vs callout-inline**：需要 **看主题色 + 看字体** 时用 quote；仅强调一句话用 callout。

### 3.4 操作与导航

| 模式 | 适用 | 要点 |
| --- | --- | --- |
| **`action-card`** | 主次要跳转（捐助等） | 图标底 40px + 标题/说明 + 箭头；border primary 混色；hover 改色 |
| **`link-row`** | 多条并列入口 | min-height ~72px；**可** 顶条渐变（opacity hover 加深）；hover 仅 border/background/字色 |
| **`action-link`** | Hero 内链式按钮 | 透明底、hover primary wash；无位移 |
| **`sub-page-toolbar`** | 子页 fixed 顶栏（返回 / 标题 / 分享） | **普通满宽标题栏**：`card-color` + 底部分割线 + **轻下阴影**；ghost 操作钮；不做圆角卡片/浮动条；与内容靠 `--body-color` + `--page-gap` 分层 |

### 3.5 点缀（按需取用，勿堆满）

| 手法 | 用法 |
| --- | --- |
| **标题竖条** | H2 section 标题前，5px 渐变（**不是** panel 左边框） |
| **顶条渐变** | **仅** link-row / 少数重点可点击块；**禁止** section-panel 默认 |
| **Eyebrow** | 11–12px、`letter-spacing: 0.1–0.12em`、`color: primary`；**无** border/底色 |
| **Tag 胶囊** | 首页特点关键词等 **短词列表**；**禁止** 主题名 / 字段 label / **重复说明显而易见的信息**（如捐助页「自愿捐助」） |
| **图标底** | 40×40（小 36×36），primary 16% 底 + 22% 边框环 |

### 3.6 滚动顶栏收紧（`scroll-chrome-collapse`）

| 项 | 约定 |
| --- | --- |
| **适用** | 长列表 + 固定顶栏（页头 + tabs + 搜索）需 **省纵向空间** 时 |
| **驱动** | JS 写 `--wiki-collapse-progress`；`@property` 在 WikiView scoped 样式；快滚加 `.wiki-view--chrome-animated` + CSS transition |
| **行为** | **慢滚**：跟 scroll 即时更新；**快滚**：同帧加 transition class 并设目标 progress，由 CSS 缓收（420ms + 72ms delay） |
| **视觉** | 顶栏 / sticky 搜索 **中性底**（`--card-color` + 底边线）；H1 **24→17px**；eyebrow / 副标题渐隐；tabs inset 底 + primary **边框**（禁大区域主题 wash 铺底） |
| **联动** | 搜索栏 sticky 层与 chrome 共用 progress；控件高度、toolbar padding 同步收紧 |

**保留此交互**——用户已确认喜欢下滑收紧顶栏的效果；新增长列表页可复用 composable + 变量名约定。

### color-mix 比例

- 轻 wash：primary **4–8%**
- 边框：primary **12–28%** 混 `border-color`
- 渐变节点：primary **16–22%** 混 `card-color`
- 强调字：primary **68–78%** 混 `text-color-base`

---

## 4. 布局

| 项 | 约定 |
| --- | --- |
| **内容宽** | 信息多：`max-width: 1080px`；信息少：单栏 **640–720px** 即可 |
| **断点** | ≤860px 双栏→单栏；≤520px 收紧 `--page-p` / `--page-inset` |
| **制图页** | 预览 `.diy-panel-card`，`max-width: 640px` |
| **滚动条** | 8px 细条，全站统一 |

---

## 5. 排版

| 层级 | 偏好 |
| --- | --- |
| **站点字体** | `--site-font-family`（默认霞鹜文楷）；卡面制图字体独立 |
| **H1** | hero 见 `page-head-hero`；内容页见 `page-head-compact` |
| **H2** | 19px / 800 + 左竖条 |
| **H3 / 列表标题** | 14px / 600 |
| **正文** | 14px / 1.75–1.85 / `--text-color-2` |
| **辅助** | 12–13px / `--text-color-3` |
| **文案** | 遵循 `project-glossary` |

---

## 6. 交互与动效

- **Hover**：只改 border / background / color；**禁止** translateY、scale、阴影剧变（**scroll-chrome-collapse 顶栏自身的 progress 插值除外**）
- **入场**：页面级区块可错峰淡入 + `translateY(12px→0)`；须 `prefers-reduced-motion: reduce`
- **折叠 / 链接**：高度或 opacity 过渡；链接 hover 改色即可
- **滚动顶栏**：见 `scroll-chrome-collapse`；progress 驱动 chrome + sticky 搜索栏同步收紧

---

## 7. 色彩与主题

- Naive UI + CSS 变量；内容页大块圆角 **12px**
- inset 底：`color-mix(in srgb, var(--body-color) 48%, var(--card-color))`
- 主题装饰只作用于外层 shell，**inset 全主题中性**
- **大区域底色**：顶栏、整页 chrome、section panel 等 **大面积** 用 `--card-color` / `--body-color`；**禁止** 用 primary 混色 wash 或偏深主题色铺底（主题色只留边框、竖条、小 icon 环、短 callout）

---

## 8. 组件约定

| 场景 | 偏好 |
| --- | --- |
| **主操作** | `n-button type="primary"` |
| **折叠** | `n-collapse`；header hover 仅背景/边框 |
| **抽屉 / 弹窗** | 跟 modal token；统一 scrollbar |
| **Tooltip** | 补充说明，不替代主文案 |

---

## 9. 避免事项（含已否决）

**AI / 模板感**

- **页头 / 标题卡加粗左边条**：`border-left: 4px solid primary` + 圆角 panel — **永久禁止**
- **页头裸标题 + 底部分割线**（无 panel wash，与正文脱节）
- 主题名、字段 label 用 **大 letter-spacing 胶囊 tag**（如 `0.28em` + 圆角边框底）
- 每个 section panel **顶条渐变**
- 编号章节 01–06、bento 拼盘、水印大字
- Inter/Roboto、紫渐变白底
- **大区域主题 wash / 深主题底**：固定顶栏、整宽 chrome、大 panel 用 primary 混色铺底 — **禁止**

**结构**

- panel 套 card 套 inset
- 访问链接 PC 端挤成窄竖条

**交互**

- hover 浮起、scale

**维护**

- 偏好只写「某某页样式」而不抽象模式
- 内容少仍硬套双栏（**双栏为提密度，非装饰**）
- 每页一套 spacing / 圆角 magic number

---

## 10. 模式 → 参考实现

> 查代码时看此表；**规则以第 3 节为准**，实现可随页面演进。

| 模式 | 参考文件（片段） |
| --- | --- |
| `page-head-hero` | `HomeView.vue` — hero |
| `page-head-compact` | `SettingsView.vue`、`DonationView.vue` — page-head |
| `section-panel` / `cols-2` | `HomeView.vue`、`SettingsView.vue` |
| `page-stack` / `qr-panel` | `DonationView.vue` |
| `callout-inline` | `HomeView.vue` — callout |
| `theme-quote` | `SettingsView.vue` — quote |
| `inset-form-stack` | `SettingsView.vue` — field-stack |
| `link-row` | `HomeView.vue`、`SettingsView.vue` — link-list |
| `action-card` | `HomeView.vue`、`SettingsView.vue` |
| `community-stack` | `HomeView.vue` — community-stack |
| `scroll-chrome-collapse` | `WikiView.vue` — chrome + `useWikiScrollChromeCollapse.ts` |
| `wiki-detail` / section 竖条 | `wiki-detail-panel.css` + 三类 DetailPanel |
| `diy-panel-card` / 配置折叠 | `panel-card.css`、`diy-config-panel.css` — 制图预览区与配置区 |

---

## 11. 变更记录

> **记录规则**
>
> - **可合并**：同一轮对话里，对 **同一页面 / 同一模式** 的多次微调 → 更新该条摘要，不重复追加。
> - **不可合并**：不同页面（首页 / 设置 / 捐助…）、不同模式决策（双栏规则、quote 卡、页头左边条…）→ **各写一条**，禁止用新条目覆盖旧条目。
> - 摘要 **宜简**：一句说清结果；细节在正文模式库，勿堆模式名。
> - 正文模式库写 **跨页规则**；变更记录保留 **哪页 / 哪类决策**，便于回溯。

| 日期 | 摘要 |
| --- | --- |
| 2026-06-26 | 文档初始化：HomeView 经验 → 模式库 |
| 2026-06-26 | **首页**：去 section 顶条、hero 加粗左边条 |
| 2026-06-26 | **系统设置**：模式库落地；git quote 卡；页头 panel + wash（非裸分割线标题） |
| 2026-06-26 | **捐助页**：单栏合块 + 扫码区；去页头冗余 tag |
| 2026-06-26 | **跨页规则**：双栏看密度、顶条偶发、禁页头左边条与 capsule tag；记录同主题才合并 |
| 2026-06-26 | **三杀百科**：仅样式模式库落地（不动 scroll-chrome 逻辑）；顶栏中性底、tabs inset |
| 2026-06-26 | **制图页**：panel-card section 竖条、配置折叠中性 inset、模板介绍全宽卡 |
| 2026-06-26 | **百科详情**：三类 DetailPanel + 共享样式；section 竖条、inset 分区、去大区域 primary wash |
| 2026-06-26 | **跨页 + 百科详情**：卡片顶内边距可小于左右底（不对称换视觉平衡）；顶栏与详情卡留 `--page-gap`；详情 inset / 版本 chrome 顶收紧 |
| 2026-06-26 | **子页顶栏**：普通满宽标题栏 + ghost 操作钮，与内容卡靠底色间距分层（非浮动卡片） |
