import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from 'eslint-config-prettier/flat'
import pluginOxlint from 'eslint-plugin-oxlint'
import pluginVue from 'eslint-plugin-vue'
import { globalIgnores } from 'eslint/config'

export default defineConfigWithVueTs(
  [
    {
      name: 'app/files-to-lint',
      files: ['**/*.{vue,ts,mts,tsx}'],
    },
    // 👇 暂时移除这里的 index.vue 配置，把它移到下面去
  ],

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  // 加载 Vue 的基础推荐配置 (这里会开启 multi-word-component-names)
  ...pluginVue.configs['flat/essential'],

  // 加载 TypeScript 推荐配置
  vueTsConfigs.recommended,

  // 加载 oxlint 配置
  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  // 专属配置
  {
    name: 'app/shap-rules',
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 5. 最后处理 Prettier 格式化忽略
  skipFormatting,
)
