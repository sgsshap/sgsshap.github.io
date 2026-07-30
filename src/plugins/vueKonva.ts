import type { App } from 'vue'
import VueKonva from 'vue-konva'

export function installVueKonva(app: App) {
  app.use(VueKonva)
}
