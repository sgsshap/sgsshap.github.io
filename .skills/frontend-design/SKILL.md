---
name: frontend-design
description: >-
  生产级前端界面创意与细节打磨。新建/重构页面、View、组件、布局、CSS、美化 UI 时使用。
  shap2-web 中与 ui-preferences 强制配对：创意探索用本 skill，模式/禁忌/冲突以 ui-preferences 为准。
  Triggers: 重构页面, 改样式, 新组件, 新页面, UI, 界面, 美化, component, styling, layout.
license: Complete terms in LICENSE.txt
---

# Frontend Design（JxShap）

> **与 `ui-preferences` 强制配对**：凡 UI 页面/组件/样式任务，须 **先读** `.skills/ui-preferences/`（模式库 + 避免事项），再读本 skill 做创意补充。  
> 工作流：`.skills/README.md` · Cursor：`.cursor/rules/ui-skills-required.mdc`

## JxShap 约束（优先于下文通用指南）

| 听 ui-preferences | 本 skill 可补充 |
| --- | --- |
| panel / inset、spacing token、color-mix | 区块内细节层次、非常规排版节奏 |
| 禁页头左边条、禁 section 顶条、禁大区域主题 wash | 单块 callout / link-row 的点缀张力 |
| `--site-font-family`、H1/H2 尺寸 | 长文案排版、引号卡、入场错峰 |
| hover 只改色 | scroll-chrome 等已确认交互勿改 |

**禁止**与 `.skills/ui-preferences/preferences.md` 第 9 节冲突。

---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision.

Then implement working code that is production-grade, visually striking, cohesive, and meticulously refined.

## Frontend Aesthetics Guidelines

Focus on typography, color & theme (CSS variables), motion (CSS-first), spatial composition, backgrounds & visual details.

NEVER use generic AI aesthetics: Inter/Roboto defaults, purple gradients on white, cookie-cutter layouts.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Elegance comes from executing the vision well.

**维护**：仅编辑 `.skills/frontend-design/` 本目录。
