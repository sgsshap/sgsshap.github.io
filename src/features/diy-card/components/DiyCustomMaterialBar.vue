<script setup lang="ts">
import type { CustomMaterial } from '@/features/diy-card/types/diy/base'
import { useInfoStore } from '@/features/diy-card/stores'
import {
  clampCustomMaterialList,
  createCustomMaterialFromUpload,
  CUSTOM_IMAGE_DEFAULT_SIZE_OPTIONS,
  CUSTOM_MATERIAL_MAX_COUNT,
  normalizeCustomMaterialOrders,
  resolveCustomMaterialDownloadFileName,
  sortCustomMaterialsForDisplay,
} from '@/features/diy-card/utils/customMaterial'
import { record } from '@/features/diy-card/utils/diyHistoryRecord'
import { resolvePersistedImageSrc } from '@/features/diy-card/stores/history/persistSnapshot'
import { applyFieldChange } from '@/features/diy-card/utils/diyHistoryField'
import {
  DownloadRound,
  FileUploadRound,
  OpenWithRound,
  RemoveCircleOutlineFilled,
  VisibilityOffRound,
  VisibilityRound,
} from '@/shared/icons'
import { fileToBase64, downloadImage, loadImageNaturalSize } from '@/shared/utils/file'
import { shouldUseLightDragEffects } from '@/shared/utils/deviceCapability'
import { useSystemStore } from '@/shared/stores/system'
import type { UploadInst, UploadOnFinish, UploadSettledFileInfo } from 'naive-ui/es/upload/src/public-types'
import { useDialog } from 'naive-ui'
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'

/* 依赖注入 */
const infoStore = useInfoStore()
const systemStore = useSystemStore()
const dialog = useDialog()

/* 状态定义 */
const uploadRef = ref<UploadInst | null>(null)
const showDetails = ref(true)

const defaultScale = computed({
  get: () => infoStore.info.renderConfig.customImage.defaultScale,
  set: (value: number) => {
    applyFieldChange(
      '自定义素材默认尺寸',
      infoStore.info.renderConfig.customImage.defaultScale,
      value,
      (next) => {
        infoStore.info.renderConfig.customImage.defaultScale = next
      },
      { category: 'renderConfig' },
    )
  },
})

const isPhone = computed(() => systemStore.isCompactPhone)

const sizeOptions = CUSTOM_IMAGE_DEFAULT_SIZE_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}))

const dragAnimation = computed(() => (shouldUseLightDragEffects() ? 0 : 200))
const dragGhostClass = computed(() =>
  shouldUseLightDragEffects() ? '' : 'diy-custom-material-bar__item--ghost',
)

const sortedMaterials = computed({
  get: () => sortCustomMaterialsForDisplay(infoStore.customMaterialList),
  set: (next: CustomMaterial[]) => {
    const prevOrder = infoStore.customMaterialList.map((item) => `${item.id}:${item.order}`).join('|')
    const normalized = normalizeCustomMaterialOrders(next)
    infoStore.customMaterialList = normalized
    const nextOrder = normalized.map((item) => `${item.id}:${item.order}`).join('|')
    if (prevOrder !== nextOrder) {
      record({ operation: 'modify', itemName: '自定义素材', detail: '调整图层顺序' })
    }
  },
})

const hasMaterials = computed(() => sortedMaterials.value.length > 0)
const materialCount = computed(() => infoStore.customMaterialList.length)
const uploadDisabled = computed(() => materialCount.value >= CUSTOM_MATERIAL_MAX_COUNT)
const remainingUploadCount = computed(() =>
  Math.max(0, CUSTOM_MATERIAL_MAX_COUNT - materialCount.value),
)

/* 核心逻辑 */
const handleUpload = async ({
  file,
  onFinish,
}: {
  file: UploadSettledFileInfo
  onFinish: UploadOnFinish
}) => {
  const rawFile = file.file
  if (!rawFile) return

  if (uploadDisabled.value) {
    window.alert(`最多上传 ${CUSTOM_MATERIAL_MAX_COUNT} 张自定义素材`)
    return
  }

  try {
    const dataUrl = (await fileToBase64(rawFile)) as string
    const { width: imageWidth, height: imageHeight } = await loadImageNaturalSize(dataUrl)
    const id = String(file.id)
    const material = createCustomMaterialFromUpload(id, file.name, dataUrl, {
      defaultScalePercent: defaultScale.value,
      orderIndex: infoStore.customMaterialList.length,
      existingNames: infoStore.customMaterialList.map((item) => item.name),
      imageWidth,
      imageHeight,
    })
    infoStore.customMaterialList = clampCustomMaterialList([
      material,
      ...infoStore.customMaterialList,
    ])
    record({ operation: 'modify', itemName: '自定义素材', detail: `上传 ${material.name}` })
    onFinish?.({ file })
  } catch {
    window.alert('图片读取失败，请重试')
  } finally {
    uploadRef.value?.clear()
  }
}

const removeMaterial = (material: CustomMaterial) => {
  infoStore.customMaterialList = normalizeCustomMaterialOrders(
    infoStore.customMaterialList.filter((item) => item.id !== material.id),
  )
  record({ operation: 'modify', itemName: '自定义素材', detail: `移除 ${material.name}` })
}

const confirmRemoveMaterial = (material: CustomMaterial) => {
  dialog.warning({
    title: '删除素材',
    content: `确定删除「${material.name}」？删除后可在操作历史中撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    draggable: true,
    onPositiveClick: () => {
      removeMaterial(material)
    },
  })
}

const downloadMaterial = (material: CustomMaterial) => {
  downloadImage(
    resolvePersistedImageSrc(material.data),
    resolveCustomMaterialDownloadFileName(material.name, material.data),
  )
}
</script>

<template>
  <n-card
    :title="`自定义素材（${materialCount}/${CUSTOM_MATERIAL_MAX_COUNT}）`"
    class="diy-panel-card"
    :class="{ 'diy-panel-card--collapsed': !showDetails }"
  >
    <template #header-extra>
      <n-button
        circle
        type="primary"
        secondary
        size="small"
        @click="showDetails = !showDetails"
      >
        <n-icon>
          <VisibilityRound v-if="!showDetails" />
          <VisibilityOffRound v-else />
        </n-icon>
      </n-button>
    </template>

    <div class="diy-custom-material-bar">
      <n-collapse-transition :show="showDetails">
        <div class="diy-custom-material-bar__body">
          <div class="diy-custom-material-bar__header">
            <span class="diy-custom-material-bar__label">素材导入的默认尺寸</span>
            <n-select
              v-model:value="defaultScale"
              :options="sizeOptions"
              size="medium"
              class="diy-custom-material-bar__size-select"
            />
          </div>

          <n-upload
            ref="uploadRef"
            class="diy-custom-material-bar__upload"
            :class="{ 'diy-custom-material-bar__upload--phone': isPhone }"
            accept="image/*"
            :max="remainingUploadCount"
            :disabled="uploadDisabled"
            multiple
            :show-file-list="false"
            :custom-request="handleUpload"
          >
            <n-upload-dragger v-if="!isPhone">
              <div class="diy-custom-material-bar__dragger">
                <n-icon size="42" :depth="3">
                  <FileUploadRound />
                </n-icon>
                <p class="diy-custom-material-bar__dragger-title">
                  将图片拖到此处或点击上传
                </p>
                <p class="diy-custom-material-bar__dragger-subtitle">
                  （用于自定义水印、出框图等）
                </p>
              </div>
            </n-upload-dragger>
            <n-button v-else type="primary" :disabled="uploadDisabled">上传自定义素材</n-button>
          </n-upload>

          <p v-if="uploadDisabled" class="diy-custom-material-bar__limit-tip">
            已达上限 {{ CUSTOM_MATERIAL_MAX_COUNT }} 张，请先删除后再上传
          </p>

          <div v-if="hasMaterials" class="diy-custom-material-bar__list-shell">
            <div class="diy-custom-material-bar__list-title">已上传素材（拖拽调整图层顺序，越靠上越在上层）</div>
            <draggable
              v-model="sortedMaterials"
              class="diy-custom-material-bar__list"
              item-key="id"
              handle=".diy-custom-material-bar__drag-handle"
              :animation="dragAnimation"
              :ghost-class="dragGhostClass || undefined"
              :force-fallback="shouldUseLightDragEffects()"
              fallback-class="diy-custom-material-bar__item--fallback"
            >
              <template #item="{ element: material, index }">
                <div class="diy-custom-material-bar__item">
                  <n-tooltip>
                    <template #trigger>
                      <n-button
                        circle
                        secondary
                        size="small"
                        class="diy-custom-material-bar__drag-handle"
                      >
                        <template #icon>
                          <n-icon><OpenWithRound /></n-icon>
                        </template>
                      </n-button>
                    </template>
                    拖拽排序
                  </n-tooltip>

                  <img
                    class="diy-custom-material-bar__thumb"
                    :src="resolvePersistedImageSrc(material.data)"
                    :alt="material.name"
                  />

                  <div class="diy-custom-material-bar__meta">
                    <span class="diy-custom-material-bar__name" :title="material.name">
                      {{ material.name }}
                    </span>
                    <span class="diy-custom-material-bar__layer">图层 {{ index + 1 }}</span>
                  </div>

                  <div class="diy-custom-material-bar__actions">
                    <n-tooltip>
                      <template #trigger>
                        <n-button
                          circle
                          type="primary"
                          secondary
                          size="small"
                          @click="downloadMaterial(material)"
                        >
                          <template #icon>
                            <n-icon><DownloadRound /></n-icon>
                          </template>
                        </n-button>
                      </template>
                      下载
                    </n-tooltip>

                    <n-tooltip>
                      <template #trigger>
                        <n-button
                          circle
                          type="error"
                          secondary
                          size="small"
                          @click="confirmRemoveMaterial(material)"
                        >
                          <template #icon>
                            <n-icon><RemoveCircleOutlineFilled /></n-icon>
                          </template>
                        </n-button>
                      </template>
                      删除
                    </n-tooltip>
                  </div>
                </div>
              </template>
            </draggable>
          </div>

          <n-alert type="warning" class="diy-custom-material-bar__hint">
            仅支持图片；<strong>武将图</strong>请至「基础信息 · 武将图」上传
          </n-alert>
        </div>
      </n-collapse-transition>
    </div>
  </n-card>
</template>

<style scoped>
.diy-custom-material-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.diy-custom-material-bar__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.diy-custom-material-bar__header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.diy-custom-material-bar__label {
  font-size: 0.9em;
  white-space: nowrap;
  color: var(--text-color-2);
}

.diy-custom-material-bar__size-select {
  flex: 1;
  min-width: 180px;
}

.diy-custom-material-bar__upload {
  width: 100%;
}

.diy-custom-material-bar__limit-tip {
  margin: 0;
  font-size: 0.86em;
  text-align: center;
  color: var(--warning-color);
}

.diy-custom-material-bar__upload--phone {
  text-align: center;
}

.diy-custom-material-bar__dragger {
  padding: 12px 0;
  text-align: center;
}

.diy-custom-material-bar__dragger-title {
  margin: 8px 0 4px;
  font-size: 0.95em;
}

.diy-custom-material-bar__dragger-subtitle {
  margin: 0;
  font-size: 0.85em;
  color: var(--text-color-3);
}

.diy-custom-material-bar__list-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--action-color);
  border: 1px solid var(--border-color);
}

.diy-custom-material-bar__list-title {
  font-size: 0.86em;
  color: var(--text-color-2);
}

.diy-custom-material-bar__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diy-custom-material-bar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--card-color);
  border: 1px solid var(--border-color);
}

.diy-custom-material-bar__item--ghost {
  opacity: 0.55;
}

.diy-custom-material-bar__item--fallback {
  opacity: 0.92;
}

.diy-custom-material-bar__drag-handle {
  flex: 0 0 auto;
  cursor: grab;
}

.diy-custom-material-bar__thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 6px;
  background: #fff;
  border: 1px solid var(--border-color);
  flex: 0 0 auto;
}

.diy-custom-material-bar__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.diy-custom-material-bar__name {
  font-size: 0.9em;
  text-align: left;
  color: var(--text-color-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.diy-custom-material-bar__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.diy-custom-material-bar__layer {
  font-size: 0.8em;
  color: var(--text-color-3);
}

.diy-custom-material-bar__hint {
  margin: 0;
  font-size: 0.9em;
  line-height: 1.55;
}

.diy-custom-material-bar__hint strong {
  font-weight: 600;
}
</style>
