import App from '@/App.vue'
import { installVueKonva } from '@/plugins/vueKonva'
import router from '@/router'
import { useAppLoadingStore } from '@/shared/stores/appLoading'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

const appLoadingStore = useAppLoadingStore(pinia)
appLoadingStore.startBootstrap()

app.use(router)
installVueKonva(app)

app.mount('#app')

void router.isReady().then(() => {
  appLoadingStore.finishBootstrap()
})
