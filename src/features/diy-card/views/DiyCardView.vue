<script setup lang="ts">
import DiyCardMobile from '@/features/diy-card/components/DiyCardMobile.vue'
import DiyCardPc from '@/features/diy-card/components/DiyCardPc.vue'
import { useDiyHistoryStore } from '@/features/diy-card/stores'
import {
  peekWikiToDiyPendingSession,
  tryApplyWikiToDiyPendingSession,
} from '@/features/diy-card/utils/wikiToDiyNavigation'
import {
  deleteLegacyHistoryIndexedDatabases,
} from '@/features/diy-card/utils/diyHistoryStorage'
import { useSystemStore } from '@/shared/stores/system'
import { useMessage } from 'naive-ui'
import { onActivated, onBeforeMount } from 'vue'

defineOptions({ name: 'DiyCardView' })

const systemStore = useSystemStore()
const historyStore = useDiyHistoryStore()
const message = useMessage()

/** 进入制图页最早恢复本地历史，避免画布 init 抢先写入默认「初始状态」 */
onBeforeMount(async () => {
  deleteLegacyHistoryIndexedDatabases()
  if (peekWikiToDiyPendingSession()) return
  await historyStore.ensureSessionRestored()
})

/** keep-alive 二次进入不会触发 onMounted，须在 activated 时消费百科导入 */
onActivated(async () => {
  try {
    const applied = await tryApplyWikiToDiyPendingSession()
    if (applied) {
      message.success('已从百科导入武将版本')
    }
  } catch (error) {
    console.error('[wiki-to-diy] apply failed', error)
    if (error instanceof Error && error.message === 'template-not-found') {
      message.error('模板加载失败，请重试')
      return
    }
    message.error('导入失败，请重试')
  }
})
</script>

<template>
  <DiyCardMobile v-if="!systemStore.isDiyPcLayout" />
  <DiyCardPc v-else />
</template>
