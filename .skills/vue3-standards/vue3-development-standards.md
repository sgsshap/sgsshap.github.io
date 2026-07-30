# Vue3 + TypeScript 开发规范（2026.05.15版）

## 工程化规范

### 格式化与提交

- 统一使用 **ESLint + Prettier**。
- IDE 配置保存时自动修复（`editor.codeActionsOnSave`）。
- 不符合规范的代码禁止提交，CI 流水线须包含 `vue-tsc` 类型检查和 ESLint 校验。`tsconfig.json` 中需启用
  `vueCompilerOptions.strictTemplates: true`。
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)（feat/fix/chore/docs等），配置 `commitlint`
  自动检查。
- 提交前自动运行 `lint-staged`，仅对暂存区文件执行修复。

### 环境变量与配置

- 所有环境变量通过 `import.meta.env` 访问，自定义变量必须以 `VITE_` 开头。
- 不同环境配置文件：`.env.development`、`.env.production` 等，禁止提交 `.env.local`。
- 关键常量统一收敛至 `shared/constants/env.ts`，避免代码中直接读取原始环境变量字符串。
- **禁止**在前端代码中存储敏感信息（如 API 密钥），须通过后端代理。

### 测试要求

- 核心工具函数、关键 composable、复杂组件必须覆盖单元测试（**Vitest**）。
- CI 流程中包含测试步骤，不通过则禁止合并。
- 核心模块测试覆盖率 ≥ 80%。`features/*/views/` 目录可酌情豁免。
- 对外部 API 请求须 mock，避免真实网络调用。

### 依赖管理

- 锁定依赖版本，`package-lock.json` / `pnpm-lock.yaml` 必须提交。
- 定期运行 `npm audit` / `pnpm outdated`，每月检查升级，高危漏洞立即修复。

## 项目结构与命名规范

### 项目结构（领域驱动设计）

摒弃传统的按文件类型分层，改用**按业务领域分层**。模块越独立，重构成本越低。

```text
src/
├── features/                  # 【业务域】独立的功能模块（每个域都是独立的闭环）
│   ├── auth/                  # 认证域
│   │   ├── api/               # 专属接口（index.ts 统一导出）
│   │   ├── components/        # 该域独有的组件（如 LoginForm.vue）
│   │   ├── composables/       # 该域独有的逻辑Hook（如 useLogin.ts）
│   │   ├── stores/            # 该域独有的 Pinia Store（如 authStore.ts）
│   │   ├── types/             # 该域专属TS类型
│   │   └── views/             # 页面入口（如 LoginView.vue）
│   └── order/                 # 订单考核域
│       ├── api/
│       ├── components/
│       ├── composables/
│       ├── stores/
│       ├── types/
│       └── views/
│
├── shared/                    # 【公共资源】跨业务域复用的底层资源
│   ├── api/                   # 公共接口（文件上传、字典等，同样遵守 DTO 规则）
│   ├── components/            # UI基础组件（Button, Input, Table等，严禁包含业务逻辑）
│   ├── composables/           # 全局通用逻辑（useAuth, usePermission, useDebounce）
│   ├── stores/                # 全局 Pinia Store（userStore, appConfigStore）
│   ├── utils/                 # 纯函数工具库（详细分类见下文）
│   ├── constants/             # 全局常量（枚举、正则表达式、固定配置项）
│   ├── assets/                # 全局静态资源（scss变量、全局icon、默认图片）
│   └── types/                 # 全局通用TS类型（如 API响应结构、分页参数结构）
│
├── router/                    # 路由配置（按模块拆分后在此统一注册）
├── plugins/                   # 第三方插件的初始化配置（如 axios拦截器、echarts挂载，禁止放业务逻辑）
├── App.vue                    # 根组件
└── main.ts                    # 入口文件
```

**域间依赖规则**：

- 允许通过 `shared/` 中的公共模块（如 `shared/composables/useAuth`）获取其他域的状态。
- 禁止直接导入其他 `features/*` 中的非 `types` 模块。
- 若必须跨域协作，应使用事件总线（`mitt`）或全局 Store 的公共 action 松耦合。

**全局 vs 业务 Store 判断标准**：

- 状态是否会被 **2 个及以上业务域** 使用 → 是则放 `shared/stores`，否则放域内 `stores`。

*注：`public/` 目录存放不参与构建打包的资源（如 favicon.ico、robots.txt），需通过根相对路径访问；`src/assets/` 存放经 `import`
引入、享受构建优化的资源。*

### 命名与语法规范

| 类型                  | 命名风格               | 示例                               |
|:--------------------|:-------------------|:---------------------------------|
| Vue 组件文件            | 大驼峰 `PascalCase`   | `UserProfile.vue`                |
| Hooks / Composables | `use` + 小驼峰        | `useOrderList.ts`                |
| 工具函数 / 常量文件         | 小驼峰                | `dateFormat.ts`, `statusEnum.ts` |
| 变量 - 布尔值            | `is/has/can` 前缀    | `isLoading`, `hasPermission`     |
| 变量 - 数组             | `List` 或 `s` 后缀    | `userList`, `orderItems`         |
| 事件函数（模板内）           | `handle` 或 `on` 开头 | `handleClick`, `onSearch`        |
| 枚举 / 常量             | 全大写 + 下划线          | `MAX_RETRY`，枚举推荐语义字符串            |

- 禁止 Magic Number（魔法数字）：

  代码中严禁直接出现 `if (status === 1)` 这种写法。枚举值推荐使用语义字符串，例如：

  ```ts
  export const OrderStatus = {
    PAID: 'PAID',
    PENDING: 'PENDING'
  } as const
  ```

  使用时：`if (status === OrderStatus.PAID)`。

### Utils工具规范

为了避免 utils 变成一个几千行的“垃圾堆”，必须按功能进行文件拆分，且**严禁在 utils 中引入 Vue 的响应式 API（如 ref/reactive）
**，它们必须是纯粹的 JS/TS 函数。

建议的 `shared/utils/` 内部结构：

- **date.ts**：日期格式化、时间戳转换、相对时间计算（推荐使用 `dayjs` 封装）。
- **format.ts**：金额千分位、数字精度处理、脱敏处理（如手机号中间打码）。
- **validate.ts**：表单校验规则（邮箱、手机号、密码强度）、数据类型判断（isArray, isObject）。
- **storage.ts**：localStorage / sessionStorage 的增删改查封装（建议自动处理 JSON.parse/stringify）。
- **file.ts**：文件下载、Base64转Blob、文件大小单位转换。
- **url.ts**：URL 参数解析、拼接、跳转处理。
- **clipboard.ts**：复制内容到剪贴板。
- **index.ts**：统一对外导出所有工具函数，方便外部单行引入。

## 核心编码规范

### TypeScript严格模式

- **强制使用** `<script setup lang="ts">`。
- **禁用 any**：默认禁止使用 `any`，仅在第三方类型缺失等极端场景使用，且优先考虑 `unknown` + 运行时校验。
- **空值处理**：优先使用可选链 `?.` 和空值合并 `??`，禁止未判空访问嵌套属性。
- **样式隔离**：单文件组件必须使用 `<style scoped>`，防止 CSS 污染全局。

### 注释规范

- 可允许的注释类别有两种：

    - **多行注释**，在多行代码前使用，如：声明代码分区、声明方法等。
    - **单行注释**，在行前对下一行代码进行注释。

- 所有 `<script setup>` 必须严格遵循以下**注释格式规范**：

    - 不要在注释里写序号，如：1.2.3...。

    - 不要添加任何“逻辑保持不变”之类的AI式对话注释。

    - 代码逻辑清晰，注释不要太多，只保留必要注释即可。

    - 注释一律使用中文，css不需要任何注释。

    - 非一眼能看出意图的函数必须添加 JSDoc 注释，简单 getter 或单行返回函数可省略。

    - script 区域严格使用以下方式进行代码分区：

      ```js
      // ==================== 类型定义 ====================
      // ==================== 参数定义 ====================
      ```

    - script 分区的注释只能使用以下几个（不含括号），且要按照下列顺序排序（组件不需要的分区去掉即可）：

        1. 类型定义（组件内需要定义的TS类型）
        2. 参数定义（用来定义props/emits）
        3. 依赖注入（存放 useXxxStore()、useXxx()等函数调用）
        4. 状态定义（存放 ref、reactive、computed 等组件内部状态）
        5. 工具函数（这里的函数一般都带参数，要用/**  */注释声明完整）
        6. 监听器（存放watch、watchEffect）
        7. 核心逻辑（这里的函数都要用注释简单写一下是干什么的）
        8. 生命周期
        9. 暴露接口（存放defineExpose）

### 模板规范

- Import 位置必须在 `<script>` 的最开头，且不需要加任何注释。
- 禁止在同一元素上同时使用 `v-if` 与 `v-for`。改用外层 `template v-for` + 内层 `v-if`，或先通过计算属性过滤。
- `v-for` 必须提供稳定的 `:key`（优先业务主键 ID，避免索引）。
- 避免在模板中直接调用复杂函数，改用**计算属性**。
- 所有可交互元素必须提供可访问名称（`aria-label` 或关联 label）。

### 样式规范

- 单文件组件必须使用 `<style scoped>` 隔离。
- 业务组件内禁止通过 `:global()` 修改全局样式；确需覆盖第三方组件时使用 `:deep()`。
- 全局样式（如覆盖第三方UI库、定义 body 背景）应放置在独立全局样式文件（如 `shared/styles/global.scss`）中，并遵循命名空间隔离。
- 推荐 **BEM** 命名约定：`.block__element--modifier`，或使用 CSS Modules。
- **block** 与组件文件名一致（小写连字符），如 `DiyExportBar.vue` → `diy-export-bar`；元素用 `__`，状态/变体用 `--`。
- 禁止裸用 `container`、`label`、`name` 等泛化类名。
- 全局 SCSS 变量、mixin 统一放在 `shared/styles/`，通过 `@import` 引入。

## API请求层与状态管理

### API层设计

- 每个 `features/xxx/api/` 下存放域内接口；公共接口放 `shared/api/`。
- API 函数只负责发起请求并返回原始响应（DTO），**不做业务转换**。
- DTO 到展示模型的映射统一在对应的 `composables/` 或专用 mapper 函数中完成，严禁在模板中调用转换函数或编写复杂三元表达式。
- **防抖/节流属于业务逻辑**，必须在 `composables/` 或组件内部处理 API 调用，以保持 API 函数的通用性。

### 统一响应处理

- 在 `plugins/axios.ts` 中统一拦截网络错误（超时、非 2xx、401 等），接入错误上报服务。
- 对于文件下载接口（`responseType: 'blob'`），应跳过业务状态码校验，直接返回 Blob。
- 定义项目专用的成功判定工具函数 `isSuccess(res)`（如 `code === 0` 或 `success === true`），避免业务代码中反复硬编码。
- 请求返回后，**必须先通过 `isSuccess` 判定成功**，再读取载荷。

### 状态管理（Pinia）

1. 统一使用 **Setup Store** 语法，保持与组合式 API 风格一致。
2. Action 命名采用 `fetch/Load/save` 等动词前缀，清晰表达副作用动作。
3. 仅全局共用状态放入 `shared/stores/`，业务域独有状态放在对应 `features/xxx/stores/`。
4. **Token 存储**：**强烈推荐**将 Token 存放在 `httpOnly` Cookie 中（由后端设置），以防范 XSS 泄漏。若必须使用
   LocalStorage，需配合严格 CSP 和短周期刷新机制，且不得明文存储。
5. **SSR 兼容**：禁止在 Store 初始化时直接访问 `window` 或 `document`。如需使用浏览器 API，请在 action 中通过
   `if (!import.meta.env.SSR) { ... }` 或 `onMounted` 延迟执行。

### 错误处理统一机制

- 定义全局 `useErrorHandler` composable，提供 toast / 模态框 / 日志上报。
- 所有 `catch` 块不得为空，必须调用错误处理器并提供用户友好提示。
- 在 API 拦截器中统一处理 401 跳转登录、500 提示等通用错误；业务错误码由具体逻辑处理。

## 组合式函数设计规范

- 必须以 `use` 为前缀，文件名小驼峰（如 `useWindowResize.ts`）。
- 单一职责：一个 composable 只做一类事。
- 参数使用对象形式（便于扩展和 TS 类型推断）。
- 返回值应为普通对象或 refs，避免暴露内部私有状态。
- 若包含副作用（事件监听、定时器），必须在 `onUnmounted` 中清理。
- 可结合 `shallowRef` / `shallowReactive` 优化性能。
- **单个 composable 文件 ≤ 300 行**，单个 composable 函数 ≤ 80 行。

## 组件开发规范

### 标准模板

```vue
<template>
  <div class="example-box">
    <!-- 模板内容 -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useUserStore } from '@/shared/stores/user'
import { fetchOrderList } from '../api'
import { formatCurrency } from '@/shared/utils/format'

// ==================== 类型定义 ====================
interface OrderItem {
  id: string
  amount: number
}

// ==================== 参数定义 ====================
interface Props {
  orderId: string
  readonly?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const emit = defineEmits<{
  (e: 'update', data: OrderItem): void
}>()

// ==================== 组合式函数 / Store 引用 ====================
const userStore = useUserStore()

// ==================== 状态定义 ====================
const loading = ref(false)
const orderList = ref<OrderItem[]>([])

const totalAmount = computed(() => {
  return orderList.value.reduce((sum, item) => sum + item.amount, 0)
})

// ==================== 监听器 ====================
watch(() => props.orderId, (newId) => {
  if (newId) loadOrderData()
})

// ==================== 核心逻辑 ====================
/**
 * 加载订单核心数据
 */
const loadOrderData = async () => {
  loading.value = true
  try {
    const res = await fetchOrderList(props.orderId)
    // 必须先按约定判断成功与否，再读取载荷
    if (isSuccess(res) && Array.isArray(res.data)) {
      orderList.value = res.data
    }
  } catch (error) {
    useErrorHandler().handle(error)
  } finally {
    loading.value = false
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadOrderData()
})

// ==================== 暴露接口 ====================
defineExpose({
  loadOrderData
})
</script>

<style scoped>
.example-box {
  padding: 20px;
}
</style>
```

### 表单处理与校验

- 使用 `vee-validate` + `zod` / `yup` 进行 schema 校验，避免手写大量 if。
- 表单组件支持受控与非受控模式，校验错误信息需统一 UI 展示。
- 表单提交时通过 `loading` 状态或防抖防止重复提交。

### 第三方UI库

- 必须按需引入（如 Element Plus 的 `unplugin-vue-components`）。
- 主题变量覆盖集中在 `shared/styles/` 下。
- 图标统一使用 SVG Sprite 或按需引入，禁止全量注册。

### 组件文档

- `shared/components` 中的基础组件必须提供 `README.md` 或 Storybook 示例，说明 props、slots、events。
- 复杂业务组件也建议添加 JSDoc 并在生成文档工具中展示。

## 安全与性能

### 安全红线

- **禁止直接使用 `v-html`**。如需渲染富文本，请封装 `SafeHtml` 组件并使用 `DOMPurify` 清洗：

  ```vue
  <template>
    <div v-html="sanitizedHtml"></div>
  </template>
  <script setup>
  import DOMPurify from 'dompurify'
  const props = defineProps<{ rawHtml: string }>()
  const sanitizedHtml = computed(() => DOMPurify.sanitize(props.rawHtml))
  </script>
  ```

- 所有用户输入的 URL 参数必须校验，防止 XSS 或注入。

- 敏感操作（如支付、删除）需二次确认。

### 性能要求

- 非首屏路由必须使用动态导入 `() => import('...')` 实现代码分割。
- 长列表（>100 项）必须使用虚拟滚动（如 `vue-virtual-scroller`）。
- 图片资源使用懒加载（`v-lazy` 或 `IntersectionObserver`）。
- 频繁触发的事件（滚动、输入）必须使用防抖/节流（推荐 `useDebounceFn` 来自 `@vueuse/core`）。
- 避免在模板中直接调用复杂函数，改用计算属性或 `useMemoize`。

### 性能监控与调试

- 开发环境强制使用 Vue Devtools。
- 生产环境集成性能打点（LCP, FID, CLS）和错误监控（Sentry）。
- 对核心业务指标进行埋点。

## 单文件组件（SFC）规模与重构标准

为防止出现 2000 行大文件，强制执行以下指标：

| 指标            | 警戒线     | 措施                                  |
|:--------------|:--------|:------------------------------------|
| 单文件 `.vue` 行数 | ≤ 400 行 | 超过必须拆分：先抽 composables，再拆子组件，最后抽样式变量 |
| 单函数行数         | ≤ 80 行  | 超过则拆分逻辑为更小的函数                       |
| 圈复杂度（每个函数）    | ≤ 5 层嵌套 | 通过早返回、策略模式或函数拆分降低嵌套                 |
| 组件 props 数量   | ≤ 10 个  | 过多考虑是否职责过重，应拆分子组件或使用组合对象            |

**大文件拆分顺序**（强制执行）：

- **第一步**：抽取 `composables`（组合式函数）。将状态、异步请求、数据契约、领域规则剥离到 `shared/composables` 或组件同级的
  hooks 中。
- **第二步**：抽取展示型子组件。将模板中独立的 UI 块拆为子组件，父组件仅保留编排逻辑。
- **第三步**：如果 `<style>` 内容过大，应抽离 SCSS 变量、mixins 等到 `shared/styles/` 并通过 `@import` 引入，仍保持
  `<style scoped>`。全局样式必须定义明确的命名空间（如 BEM），避免污染。

## 国际化

- 使用 `vue-i18n`，所有 UI 文本必须通过 `$t()` 或 `useI18n` 调用，禁止硬编码中文。
- Key 按模块组织：`auth.login.title`、`order.list.status`，避免全局扁平化冲突。
- 动态内容（如后端返回的错误信息）需谨慎翻译或使用 fallback。
- 日期、数字、货币格式应使用 i18n 的相应 API，而非手动拼接。

## 特殊场景补充

### Web Worker

- 若涉及复杂计算，封装 `useWorker` composable，内部管理 Worker 生命周期和通信。

### SSR/SSG（如 Nuxt）

- 禁止在 `setup` 或顶层代码中访问 `window`、`document`，须在 `onMounted` 或客户端专用钩子中执行。
- 使用 `<ClientOnly>` 包裹依赖浏览器 API 的组件。

### 第三方 SDK 集成（地图、支付等）

- 必须封装在 `plugins/` 目录，并提供完整的 TypeScript 类型声明（`.d.ts`）。
- 避免在多个组件中重复初始化 SDK，通过 provide/inject 共享实例。
