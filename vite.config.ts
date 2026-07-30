import vue from '@vitejs/plugin-vue'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'

import { defineConfig, type Plugin } from 'vite'

const FONT_CSS_PATH = path.resolve('public/diy/fonts/font.css')
const THEME_BG_DIR = 'shared/themes/bg/'

function isThemeBgAsset(assetInfo: { originalFileNames?: string[] }) {
  return assetInfo.originalFileNames?.some((fileName) =>
    fileName.replace(/\\/g, '/').includes(THEME_BG_DIR),
  )
}

/** font.css 内容 hash 作 query，改 @font-face 后部署即失效旧缓存，无需用户强刷 */
function fontCssVersionPlugin(): Plugin {
  const readVersion = () =>
    createHash('md5').update(readFileSync(FONT_CSS_PATH)).digest('hex').slice(0, 8)

  return {
    name: 'font-css-version',
    transformIndexHtml(html) {
      const version = readVersion()
      return html.replace(
        /href="(\/?diy\/fonts\/font\.css)"/,
        `href="$1?v=${version}"`,
      )
    },
    configureServer(server) {
      server.watcher.add(FONT_CSS_PATH)
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === FONT_CSS_PATH) {
          server.ws.send({ type: 'full-reload', path: '*' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  optimizeDeps: {
    include: ['@vicons/material'],
  },
  plugins: [
    fontCssVersionPlugin(),
    vue(),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar'],
        },
      ],
    }),
    Components({
      resolvers: [NaiveUiResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (isThemeBgAsset(assetInfo)) {
            return 'themes/bg/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
