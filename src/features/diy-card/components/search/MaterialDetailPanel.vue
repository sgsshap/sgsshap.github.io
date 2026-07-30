<script setup lang="ts">
import { getMaterial } from '@/features/diy-card/api'
import type { MaterialSelectPayload } from '@/features/diy-card/types/search'
import { getDict, isSuccess } from '@/shared/api'
import type { DictItem } from '@/shared/types/api'
import { getLabel } from '@/shared/utils/dict'
import { CheckCircleRound, ImageNotSupportedRound } from '@/shared/icons'
import { useMessage } from 'naive-ui'
import { ref, watch } from 'vue'

defineOptions({ name: 'MaterialDetailPanel' })

interface Props {
  materialId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  apply: [payload: MaterialSelectPayload]
}>()

const message = useMessage()
const loading = ref(false)
const detail = ref<Record<string, unknown>>({})
const typeOptions = ref<DictItem[]>([])

const loadMaterial = async () => {
  loading.value = true
  try {
    const res = await getMaterial(props.materialId)
    if (!isSuccess(res)) {
      throw new Error(res.message || '素材加载失败')
    }
    detail.value = res.data
  } catch (error) {
    message.error(error instanceof Error ? error.message : '素材加载失败')
  } finally {
    loading.value = false
  }
}

const handleApply = () => {
  const url = String(detail.value.url ?? '')
  if (!url) {
    message.warning('当前素材缺少图片地址')
    return
  }
  emit('apply', {
    type: 'material',
    data: { url },
  })
}

watch(
  () => props.materialId,
  (id) => {
    if (id > 0) {
      void loadMaterial()
    }
  },
  { immediate: true },
)

void (async () => {
  const res = await getDict('material_type')
  if (isSuccess(res)) {
    typeOptions.value = res.data.itemList ?? []
  }
})()
</script>

<template>
  <n-el tag="div" class="material-detail-panel">
    <n-spin :show="loading" class="material-detail-panel__body-spin">
      <header class="material-detail-panel__header">
        <h1 class="diy-drawer-page-title">{{ detail.name || '角标素材' }}</h1>
        <n-tag size="small" :bordered="false">
          {{ getLabel(String(detail.type ?? ''), typeOptions) }}
        </n-tag>
      </header>

      <div class="material-detail-panel__preview">
        <img v-if="detail.url" :src="String(detail.url)" :alt="String(detail.name ?? '角标')" />
        <div v-else class="material-detail-panel__preview-empty">
          <n-icon :size="32"><ImageNotSupportedRound /></n-icon>
          <span>暂无预览图</span>
        </div>
      </div>

      <p v-if="detail.remark" class="material-detail-panel__remark">{{ detail.remark }}</p>
    </n-spin>

    <footer class="diy-detail-panel__footer-bar">
      <n-button type="primary" size="large" block :disabled="!detail.url" @click="handleApply">
        <template #icon>
          <n-icon><CheckCircleRound /></n-icon>
        </template>
        一键使用此角标
      </n-button>
    </footer>
  </n-el>
</template>

<style scoped>
.material-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  max-width: 100%;
  padding: 4px 0 0;
  box-sizing: border-box;
}

.material-detail-panel__body-spin {
  display: block;
  width: 100%;
}

.material-detail-panel__body-spin :deep(.n-spin-content) {
  display: flex;
  flex-direction: column;
  gap: var(--diy-drawer-content-gap);
  width: 100%;
}

.material-detail-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.material-detail-panel__preview {
  border-radius: 10px;
  overflow: hidden;
  background: color-mix(in srgb, var(--border-color) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-color) 45%, transparent);
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.material-detail-panel__preview img {
  width: 100%;
  max-width: 100%;
  max-height: min(320px, 45dvh);
  object-fit: contain;
}

.material-detail-panel__preview-empty {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-color-3);
}

.material-detail-panel__remark {
  margin: 0;
  color: var(--text-color-2);
  line-height: 1.5;
}
</style>
