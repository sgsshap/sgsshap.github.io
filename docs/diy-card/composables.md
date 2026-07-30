# diy-card composables 说明

DIY 制图相关可复用逻辑，按职责分子目录。

源码：`src/features/diy-card/composables/`

## 目录


| 目录        | 职责                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `template/` | Konva 模板框架：`TemplateProps`、`useDiyTemplate`、`defineTemplateSetup` |
| `konva/`    | Konva 底层：图片加载、滤镜、节点更新、拖拽、选中                         |
| `preview/`  | 制图页 UI：PC 固定画布、窄屏悬挂预览                                     |

## 业务模板怎么用

**新增或维护 Konva 模板**（目录结构、`setup` / `layers` / `watches`、注册方式）见：

→ [templates.md](./templates.md)

模板内入口示例：

```typescript
import { useDiyTemplate, defineTemplateSetup, type TemplateProps } from '@/features/diy-card/composables/template'
```

推荐业务代码从 `@/features/diy-card/composables` 导入 Konva / 预览等共享能力。

## 类型与入口对照


| 导出                                               | 说明                                                      |
| -------------------------------------------------- | --------------------------------------------------------- |
| `useDiyTemplate`                                   | 模板根 composable，绑定 setup 后返回 refs + canvasConfigs |
| `defineTemplateSetup`                              | 校验 layers                                               |
| `SetupTemplateWatches` / `TemplateWatchContext`    | 模板 watches.ts 入参类型                                  |
| `useTemplateCanvas`                                | 仅创建画布运行时（一般由 useDiyTemplate 内部调用）        |
| `loadKonvaImage` / `createTrackedKonvaImageLoader` | 图层内加载图片                                            |
| `useKonvaCanvasNodeUpdater`                        | updateNode / syncMaterialLayout                           |
| `useKonvaMaterialDragger`                          | 可移动图层拖拽                                            |
| `useKonvaNodeSelection`                            | 点击选中图层                                              |
| `useKonvaBrightnessFilters`                        | 导出亮度滤镜配置                                          |
| `useDiyCanvasPin`                                  | PC 固定画布                                               |
| `useDiyCanvasFloatPreview`                         | 窄屏悬挂预览                                              |

详细字段见各文件顶部 JSDoc 与 `template/types.ts`。
