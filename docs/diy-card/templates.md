# 制图模板开发指南

本文说明如何在 `src/features/diy-card/components/templates/` 下新增一套 Konva 画布模板。下文以参考实现 **`new-ui-zhuoyue`（新 UI / 卓越）** 为例；通用框架在 `@/features/diy-card/composables/template`，**不必复制**。

---

## 1. 模板是什么

一套模板 = 一个目录，至少包含：


| 路径                                      | 作用                                                            |
| ----------------------------------------- | --------------------------------------------------------------- |
| `index.vue`                               | Konva 节点树（`vue-konva`），与 `setup.ts` 里 `refKey` 一一对应 |
| `composables/setup.ts`                    | 图层清单：code、顺序、绘制函数                                  |
| `composables/useTemplate.ts`              | 绑定`setup` + `watches`，调用 `useDiyTemplate`                  |
| `composables/watches.ts`                  | 数据变化 → 重载图层的`watch`                                   |
| `composables/constants.ts`                | 布局（mm）、字号、静态素材路径                                  |
| `composables/layers/*.ts`                 | 每个图层一个`drawXxx(canvas)`                                   |
| `public/diy/templates/<文件夹名>/assets/` | PNG 等静态资源（与`TEMPLATE_ASSET_BASE` 对应）                  |

运行时由 `DiyPreview.vue` 按模板 **code** 动态加载：

```ts
// code: new_ui_zhuoyue  →  目录: new-ui-zhuoyue
const dir = name.replace(/_/g, '-')
import.meta.glob('@/features/diy-card/components/templates/*/index.vue')
```

**命名约定**


| 用途                                   | 格式         | 示例                                  |
| -------------------------------------- | ------------ | ------------------------------------- |
| 业务 code（`data/templates.ts`、存档） | `snake_case` | `new_ui_zhuoyue`                      |
| 源码目录、`public` 资源目录            | `kebab-case` | `new-ui-zhuoyue`                      |
| TypeScript 文件名                      | `camelCase`  | `legendImage.ts`、`useKingdomTint.ts` |

三者通过 `code.replace(/_/g, '-')` 关联，新增模板时三处保持一致即可。

---

## 2. 参考目录：`new-ui-zhuoyue`

```
components/templates/new-ui-zhuoyue/
├── index.vue                 # 画布 UI：v-image / v-group / v-text
└── composables/
    ├── setup.ts              # defineTemplateSetup({ layers })
    ├── useTemplate.ts        # useDiyTemplate(props, emit, templateSetup, setupTemplateWatches)
    ├── watches.ts            # setupTemplateWatches(ctx)
    ├── constants.ts          # 布局表、TEMPLATE_ASSET_BASE、字体列表
    ├── index.ts              # export useTemplate
    ├── layers/
    │   ├── legendImage.ts    # drawLegendImage
    │   ├── frame.ts
    │   ├── hp.ts
    │   ├── kingdom.ts
    │   ├── name.ts
    │   ├── title.ts
    │   └── watermark.ts
    └── filters/              # 仅本模板需要的 Konva 滤镜
        ├── kingdomFrameTint.ts
        ├── useKingdomTint.ts
        └── index.ts

public/diy/templates/new-ui-zhuoyue/assets/   # 边框、势力、体力等 PNG
```

---

## 3. 新增模板：检查清单

### 3.1 复制并重命名

1. 复制整个 `new-ui-zhuoyue/` → `my-new-template/`（kebab-case）。
2. 复制 `public/diy/templates/new-ui-zhuoyue/` → `public/diy/templates/my-new-template/`。
3. 全局替换目录名相关字符串（`TEMPLATE_ASSET_BASE`、注释等）。

### 3.2 注册元数据

在 `src/features/diy-card/data/templates.ts` 中增加一条 `createTemplateInfo(...)`，并挂到 `export const templates`：

```ts
const myNewTemplate = createTemplateInfo(
  'legend',              // 品类：legend | game 等
  'my_new_template',     // code（snake_case）
  '模板显示名',
  '简介',
  '标签',
  [{ name: '作者', contact: '' }],
  '{templateName}.{code}.{title}.{name}',  // 导出文件名模式
)

myNewTemplate.config = {
  kingdoms: defaultKingdom,
  // 按需：doubleKingdom、customKingdomColor …
}

export const templates = [..., myNewTemplate]
```

`config` 字段控制配置面板里出现哪些开关（势力、双势力、自定义势力色等），见同文件内 `newUiZhuoyue.config` 示例。

### 3.3 改 `constants.ts`

- `TEMPLATE_ASSET_BASE` → 使用 `resolveTemplateAssetBase('my-new-template')`（见 `publicAssets.ts`）。
- 按美术稿调整 `NAME_LAYOUTS`、`KINGDOMS_POSITION_INFO`、双势力字布局等。
- 神框内各势力预设 PNG 字：`CUSTOM_SHEN_KINGDOM_LAYOUT.presetGlyph`（与神势力自定义字 `singleTextMm` / `dualCharTopMm` 等同文件）。
- 官方预设势力 PNG 字支持预览栏「缩放」%（`renderConfig.items.kingdom.scale`）；自定义势力文字仍用「字号」pt。
- 画布键盘：方向键移动、+/- 缩放/字号；宽屏与窄屏（含蓝牙键盘）均可用，见 `useDiyCanvasKeyboardShortcuts`。
- 文本图层在各自 `layers/*.ts` 的 `load` 内通过 `loadWebFontFamily` 按需加载字体（见 `TITLE_FONT_FAMILY`、`HP_VALUE_FONT_FAMILY` 等常量）。

### 3.4 改 `setup.ts`

用 `defineTemplateSetup` 声明图层（开发阶段会校验 **code / refKey 不重复**）：

```ts
export const templateSetup = defineTemplateSetup({
  layers: [
    {
      code: 'legendImage',       // 与 renderConfig.items 的 key 一致
      name: '武将图',             // 操作历史 / 元素列表展示名
      refKey: 'legendImageRef',  // index.vue 中 ref 名
      order: 10,                 // 叠放顺序（小在下）
      draw: drawLegendImage,
      resetOnLoadAll: true,      // 全量重载时是否 load(true)
      group: true,               // 可选：Konva Group + children
      highDprCache: true,        // 可选：高 DPR 缓存
    },
    // ...
  ],
})
```

导出本模板专用类型（供 `watches.ts` 类型安全）：

```ts
export type MyLayerCode = LayerCode<typeof templateSetup>
export type MyWatchContext = TemplateWatchContext<typeof templateSetup>
```

### 3.5 改 `index.vue`

- `useTemplate(props, emits)` 解构出的 **ref 名** 必须与 `setup.ts` 的 `refKey` 一致。
- 每个图层对应 `canvasConfigs.<code>`；`group: true` 的图层用 `v-group` + 子节点 `v-for`。
- 特殊 UI（如双势力独立字、拆字武将名）在模板内用 `computed` 处理，参考 `new-ui-zhuoyue/index.vue` 中 `kingdomGlyphChildren`、`nameSplitChildren`。

### 3.6 改 `watches.ts`

实现 `setupTemplateWatches(ctx)`，`ctx` 提供：


| 字段                 | 说明                                                                              |
| -------------------- | --------------------------------------------------------------------------------- |
| `info`               | 当前 DIY 数据（如`LegendInfo`）                                                   |
| `loaders`            | `loaders.kingdom()` / `loaders.name(true)` 等，code 由 setup 推断                 |
| `runLayerReload`     | 批量重载：`runLayerReload([{ code: 'frame' }, { code: 'kingdom', reset: true }])` |
| `syncMaterialLayout` | 出血变化时只同步坐标、不重建默认布局                                              |

直接写 Vue `watch` 即可，不必维护配置表。恢复历史记录时注意 `historyStore.isRestoring`，避免多余重绘。

### 3.7 `useTemplate.ts`（通常只需改 import）

```ts
import { useDiyTemplate, type TemplateProps, type TemplateEmit } from '@/features/diy-card/composables/template'
import { templateSetup } from './setup'
import { setupTemplateWatches } from './watches'

export function useTemplate(props: TemplateProps, emit: TemplateEmit) {
  return useDiyTemplate(props, emit, templateSetup, setupTemplateWatches)
}
```

---

## 4. 实现一个图层 `drawXxx`

约定：每个 `layers/*.ts` 导出 **`function drawXxx(canvas: TemplateCanvasState)`**，返回 **`load(isReset?: boolean)`**。

典型流程（以 `legendImage.ts` 为例）：

1. 从 `useDiyStore()` 取 `info`、`mmToPx`。
2. 用 `createTrackedKonvaImageLoader` / `useKonvaBrightnessFilters` 等共享能力。
3. 读 `info.renderConfig.items.<code>` 作为 `LayoutItem`（位置、缩放、是否可拖拽）。
4. 加载图片或算文本布局 → `buildXxxConfig` → `updateNode(renderObj, config, isReset)`。
5. 可拖拽图层：`getDragger` / `getSelectHandlers` 已在 `canvas` 上挂好。

`updateNode` 会合并 `renderObj` 与 Konva `config`，并在非 reset 时保留用户拖拽结果。工厂默认布局（如 `0,0` 占位）会走 `calculateFitSize` 等默认居中逻辑，见 `utils/canvas.ts`。

---

## 5. 共享能力（不要写进模板目录）


| 能力                                                           | 位置                                            |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `defineTemplateSetup`、`useDiyTemplate`、`TemplateCanvasState` | `@/features/diy-card/composables/template`      |
| 图片加载、亮度滤镜、拖拽、选中、节点更新                       | `@/features/diy-card/composables`（`konva/`）   |
| 双势力通用逻辑（开关、字图层 code、renderConfig 同步）         | `@/features/diy-card/composables/doubleKingdom` |
| 布局合并、mm↔px、`calculateFitSize`                           | `@/features/diy-card/utils/canvas`              |
| 制图页 Stage、模板动态加载                                     | `components/DiyPreview.vue`                     |

更细的 composable 列表见 [composables.md](./composables.md)。

**双势力说明**：`doubleKingdom.ts` 管「是否双势力渲染、主次势力、字图层条目」；**位置与默认叠放**仍在模板 `constants.ts` + `layers/kingdom.ts`（卓越模板用 `DOUBLE_KINGDOM_GLYPH_LAYOUT`）。新模板若支持双势力，可复用共享逻辑并实现自己的布局表。

**模板特有逻辑** 放在本目录即可，例如：

- `filters/useKingdomTint.ts` — 自定义势力色、边框 HSL 着色
- `layers/frame.ts` — 边框 full/half、势力框左右叠层

---

## 6. 新增 / 删除图层

1. **`layers/foo.ts`** — 实现 `export function drawFoo(canvas) { ... return load }`。
2. **`setup.ts`** — `layers` 数组增加一项，`import { drawFoo }`。
3. **`index.vue`** — 增加 `v-image` / `v-group` / `v-text` 与对应 `ref`。
4. **`watches.ts`** — 为相关 `baseInfo` / `renderConfig` 字段添加 `watch`。
5. **类型** — 若新品类，在 `types/diy/` 的 `renderConfig.items` 中增加 `foo` 字段及默认值（武将 `legend.ts` 等）。

删除图层时按相反顺序操作，并确认配置面板、历史记录无残留引用。

---

## 7. 与配置面板的关系

- 模板 **code** 决定加载哪个 `index.vue`。
- `templates.ts` 里 `config` 决定 `LegendConfig.vue` 等面板展示哪些表单项。
- 部分表单项会 import 模板常量（如 `KINGDOM_DISPLAY_ORDER` 来自 `new-ui-zhuoyue/composables/constants`）。**若新模板顺序不同，应 export 自己的常量，避免从别的模板 import。**

---

## 8. 调试建议

- 图层不刷新：先查 `watches.ts` 是否监听对应字段，是否被 `isRestoring` 挡住。
- 刷新后位置跑偏：查 `renderObj` 是否被当成「未布局」的工厂默认值；势力字见 `hasKingdomGlyphPersistedLayout`。
- 模板未加载：确认 `data/templates.ts` 的 code 与文件夹名满足 `snake_case` ↔ `kebab-case` 规则。
- 素材 404：核对 `TEMPLATE_ASSET_BASE` 与 `public/diy/templates/<目录>/assets/` 路径。静态资源布局见 [public-assets.md](./public-assets.md)。

---

## 9. 现有模板


| 目录             | code             | 说明                                  |
| ---------------- | ---------------- | ------------------------------------- |
| `new-ui-zhuoyue` | `new_ui_zhuoyue` | 新 UI 武将牌（本指南参考实现）        |
| `old-ui-muyi`    | `old_ui_muyi`    | 老 UI                                 |
| `demo-game`      | `demo_game`      | 游戏牌测试（结构较简，仅`index.vue`） |

新模板建议 **从 `new-ui-zhuoyue` 复制**，再按美术与交互删减图层与 `watches`。
