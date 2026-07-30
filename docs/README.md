# 开发文档

项目内 Markdown 文档统一放在 `docs/` 子目录，根目录仅保留本索引；不随 `public/` 发布到生产环境。

根目录 [`README.md`](../README.md) 为项目介绍；以下为技术说明。

## 模板制图（`diy-card/`）


| 文档                                            | 说明                                          |
| ----------------------------------------------- | --------------------------------------------- |
| [templates.md](./diy-card/templates.md)         | 新增 / 维护制图模板（setup、layers、watches） |
| [composables.md](./diy-card/composables.md)     | 制图 composable 目录与导出对照                |
| [public-assets.md](./diy-card/public-assets.md) | `public/diy/` 静态资源布局与路径常量          |

## 规范（`standards/`）


| 文档                                               | 说明                            |
| -------------------------------------------------- | ------------------------------- |
| [vue3-standards.md](./standards/vue3-standards.md) | Vue 3 + TypeScript 团队规范索引 |

Agent skill **正文**在 [`.skills/`](../.skills/README.md)；各工具入口 stub 在 `.cursor/skills/`、`.codex/skills/` 等。维护时只改 `.skills/`。
