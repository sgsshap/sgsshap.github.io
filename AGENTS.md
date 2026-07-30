# AGENTS.md

本仓库 AI Agent 协作说明。**Skill 正文统一维护在 [`.skills/`](.skills/README.md)。**

## UI / 样式任务（强制）

1. 读 [`.skills/ui-preferences/SKILL.md`](.skills/ui-preferences/SKILL.md) + [`preferences.md`](.skills/ui-preferences/preferences.md)
2. 读 [`.skills/frontend-design/SKILL.md`](.skills/frontend-design/SKILL.md)
3. 改完 UI 后更新 `preferences.md` 变更记录（若用户有确认/否决）

## 其他 Skill

| Skill | 路径 |
| --- | --- |
| 术语表 | `.skills/project-glossary/` |
| Vue 规范 | `.skills/vue3-standards/` |

## 工具入口（stub，勿写长文）

| 工具 | 目录 |
| --- | --- |
| Cursor | `.cursor/skills/` |
| Codex | `.codex/skills/` |
| Claude Code | `.claude/skills/` |
| Qoder | `.qoder/skills/` |
| Agents | `.agents/skills/` |

新增 skill 或同步入口：运行 `.skills/generate-agent-stubs.ps1`（或复制 `.cursor/skills/` 并改入口标题）。
