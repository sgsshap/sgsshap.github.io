/// <reference types="vite/client" />
/// <reference types="naive-ui/volar" />

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    keepAlive?: boolean
  }
}
