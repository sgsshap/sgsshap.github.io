# shap2-web 项目 Skills（唯一维护源）

本目录是 **所有 AI Agent 共享的 skill 正文**。各工具目录（`.cursor/`、`.codex/`、`.claude/`、`.qoder/`、`.agents/`）下仅为 **入口 stub**，指向此处。

## 维护规则

1. **只改 `.skills/`** — 模式库、术语表、规范正文、变更记录均在此更新。
2. **不要** 在 `.cursor/skills/` 等入口里复制长文；最多改 stub 的 `description` / triggers。
3. UI 样式改造后 → 更新 `ui-preferences/preferences.md` 变更记录（见该文件第 11 节规则）。
4. UI 任务须 **同时读** `ui-preferences` + `frontend-design`；冲突以 `ui-preferences` 为准。

## 目录

| Skill | 正文 | 用途 |
| --- | --- | --- |
| `ui-preferences/` | [SKILL.md](ui-preferences/SKILL.md) · [preferences.md](ui-preferences/preferences.md) | UI 模式库、禁忌、变更记录 |
| `frontend-design/` | [SKILL.md](frontend-design/SKILL.md) | 创意与细节（服从 ui-preferences） |
| `project-glossary/` | [SKILL.md](project-glossary/SKILL.md) · [glossary.md](project-glossary/glossary.md) | 中文术语与命名 |
| `vue3-standards/` | [SKILL.md](vue3-standards/SKILL.md) · [vue3-development-standards.md](vue3-standards/vue3-development-standards.md) | Vue/TS 工程规范 |

## 各工具入口

| 工具 | 入口目录 |
| --- | --- |
| Cursor | `.cursor/skills/` · 规则 `.cursor/rules/ui-skills-required.mdc` |
| Codex | `.codex/skills/` |
| Claude Code | `.claude/skills/` |
| Qoder | `.qoder/skills/` |
| 通用 Agents | `.agents/skills/` |

## 新增 / 同步 skill

1. 在 `.skills/<name>/` 新建 `SKILL.md` 与附属 md。
2. 在 `.cursor/skills/<name>/SKILL.md` 写 **入口 stub**（指向 `.skills/`）。
3. 运行 `.skills/generate-agent-stubs.ps1` 同步到 `.codex`、`.claude`、`.qoder`、`.agents`。
4. 在本 README 表格补一行。

## 命名与风险说明

### 为何用 `.skills/` 而不是 `skills/`

- 与 `.cursor/`、`.codex/` 等 **Agent 配置目录同级**，语义是「Agent 资产」而非业务源码。
- 与 `.cursor/skills/`（工具 **入口 stub**）区分：`.skills/` = 正文，`.cursor/skills/` = Cursor 发现用薄链接。

### 与官方工具目录 **不冲突**

| 工具 | 官方 skill 目录 | 会读 `.skills/` 吗 |
| --- | --- | --- |
| Cursor | `.cursor/skills/`、`.agents/skills/` | **否**（只读 stub，stub 指向 `.skills/`） |
| Claude Code | `.claude/skills/` | **否** |
| Codex | `.codex/skills/` | **否** |
| Qoder | `.qoder/skills/`（项目约定） | **否** |

各工具 **不会** 把仓库根 `.skills/` 当作自动 discovery 目录；正文通过 stub 里的链接读取。

### 需注意：`npx skills` CLI

社区 [skills CLI](https://www.npmjs.com/package/skills)（如 `npx skills add …`）约定：

- **项目级** 默认安装到 `./.skills/`
- **全局** 安装到 `~/.skills/`

若在本仓库运行 **不带 `--global` 的 `npx skills add`**，可能往 `.skills/` **追加** 外部 skill 子目录，与现有 `ui-preferences/` 等 **混在同一文件夹**。

**建议**：

- 外部 skill 装到 `.cursor/skills/` 或 `.claude/skills/`，再按需迁入 `.skills/` 正文；
- 或使用 `npx skills add … --global`；
- 勿对 shap2-web 根目录盲目 `npx skills add`，以免目录结构被打乱。
