<script setup lang="ts">
import { useDiyHistoryStore, useDiyStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import { useExportStore } from '@/features/diy-card/stores'
import { useTemplateStore } from '@/features/diy-card/stores'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { DownloadRound, FileUploadRound, SaveRound, VisibilityRound } from '@/shared/icons'
import { captureStageDataURL } from '@/features/diy-card/composables/konva/konvaStageExport'
import { applyBrightnessToDataUrl } from '@/features/diy-card/utils/canvasBrightness'
import {
  composeWhiteBorderExport,
  resolveExportCanvasMetrics,
} from '@/features/diy-card/utils/exportCanvas'
import { downloadBlob, downloadImage } from '@/shared/utils/file'
import { suppressHistoryRecord } from '@/features/diy-card/utils/diyHistoryRecord'
import { useBleedChange } from '@/features/diy-card/composables/useBleedChange'
import {
  resolveInfoKind,
  type DiyInfoSnapshot,
} from '@/features/diy-card/types/diy/history'
import { finalizeExportImageUrl } from '@/shared/utils/image'
import type { Stage } from 'konva/lib/Stage'
import { useDialog } from 'naive-ui'
import { computed, ref } from 'vue'

/* 参数定义 */
const props = defineProps<{
  stage: Stage | null
}>()

/* 依赖注入 */
const exportStore = useExportStore()
const templateStore = useTemplateStore()
const diyStore = useDiyStore()
const infoStore = useInfoStore()
const historyStore = useDiyHistoryStore()
const dialog = useDialog()
const { changeBleedFlag, changeBleedValue } = useBleedChange(dialog)

/* 状态定义 */
const isProcessing = ref(false)
const isSaving = ref(false)
const isPreviewVisible = ref(false)
const previewImage = ref('')

/** 画布素材加载中或导出处理中时不允许预览/下载 */
const exportImageDisabled = computed(() => diyStore.isCanvasLoading || isProcessing.value)

/* 工具函数 */
/**
 * 生成画布导出数据
 * @param stage Konva Stage 实例
 * @returns Data URL 字符串
 */
const generateExportData = async (stage: Stage): Promise<string> => {
  const template = templateStore.currentTemplate
  const bleedEnabled = diyStore.bleedFlag && template.supportBleed
  const whiteBorderEnabled = exportStore.whiteBorder && template.supportBleed
  const mimeType = exportStore.mineType || 'image/png'
  const quality = mimeType === 'image/jpeg' ? 0.95 : 1
  const metrics = resolveExportCanvasMetrics({
    template,
    ppi: exportStore.ppi,
    stageWidth: stage.width(),
    stageHeight: stage.height(),
    trimWidth: diyStore.stageConfig.width,
    trimHeight: diyStore.stageConfig.height,
    bleedFlag: bleedEnabled,
    bleedMm: diyStore.bleedValue,
    whiteBorder: whiteBorderEnabled,
  })

  const cardDataUrl = captureStageDataURL(stage, {
    x: metrics.cropX,
    y: metrics.cropY,
    width: metrics.cropWidth,
    height: metrics.cropHeight,
    pixelRatio: metrics.pixelRatio,
    mimeType,
    quality,
  })
  const brightDataUrl = await applyBrightnessToDataUrl(
    cardDataUrl,
    exportStore.brightness,
    mimeType,
    quality,
  )

  if (!metrics.whiteBorder) {
    return brightDataUrl
  }

  return composeWhiteBorderExport(brightDataUrl, metrics.whiteBorder, mimeType, quality)
}

/** PNG / JPEG 写入物理分辨率元数据，供 PS 等正确识别 PPI */
const finalizeExportDataUrl = (dataUrl: string) => {
  const mimeType = exportStore.mineType || 'image/png'
  return finalizeExportImageUrl(dataUrl, mimeType, exportStore.ppi)
}

/* 核心逻辑 */
const handleBleedChange = (flag: boolean) => {
  void changeBleedFlag(flag)
}

const handleBleedValueChange = (value: number | null) => {
  void changeBleedValue(value)
}

const handleWhiteBorderChange = async (flag: boolean) => {
  if (!flag) {
    exportStore.setWhiteBorder(false)
    return
  }
  if (diyStore.bleedFlag) {
    const result = await changeBleedFlag(false)
    if (result === 'cancelled') return
  }
  exportStore.setWhiteBorder(true)
}

/**
 * 统一的导出处理函数
 * @param onSuccess 成功后的回调
 */
const handleExportProcess = async (onSuccess: (data: string) => void) => {
  if (diyStore.isCanvasLoading) {
    return
  }
  const currentStage = props.stage
  if (!currentStage) {
    alert('画布 Stage 未就绪')
    return
  }
  isProcessing.value = true
  let objectUrl: string | undefined
  try {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const rawDataUrl = await generateExportData(currentStage)
    objectUrl = finalizeExportDataUrl(rawDataUrl)
    onSuccess(objectUrl)
  } catch (error) {
    if (objectUrl) revokeExportObjectUrl(objectUrl)
    console.error('导出/预览失败:', error)
    alert('处理过程中发生错误')
  } finally {
    isProcessing.value = false
  }
}

const revokeExportObjectUrl = (url: string) => {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

/**
 * 导出图片
 */
const getExportFileName = () => `${getExportName()}.${exportStore.format}`

const handleExport = () => {
  handleExportProcess((url) => {
    downloadImage(url, getExportFileName())
    revokeExportObjectUrl(url)
  })
}

/**
 * 预览图片
 */
const handlePreview = () => {
  handleExportProcess((url) => {
    if (previewImage.value) revokeExportObjectUrl(previewImage.value)
    previewImage.value = url
    isPreviewVisible.value = true
  })
}

/**
 * 从预览中保存图片
 */
const handleSaveFromPreview = () => {
  if (diyStore.isCanvasLoading || !previewImage.value) return
  isSaving.value = true
  try {
    downloadImage(previewImage.value, getExportFileName())
    revokeExportObjectUrl(previewImage.value)
    previewImage.value = ''
    isPreviewVisible.value = false
  } finally {
    isSaving.value = false
  }
}

const isProgressFileName = (name: string) => name.toLowerCase().endsWith('.shap')

/**
 * 保存进度为 JSON 文件
 */
const handleSaveJson = () => {
  try {
    const json = JSON.stringify(infoStore.toInfoSnapshot(), null, 2)
    const blob = new Blob([json], { type: 'application/octet-stream' })
    downloadBlob(blob, `${getExportName()}.shap`)
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存进度时发生错误')
  }
}

/**
 * 获取导出文件的名称
 */
const getExportName = () => {
  const currentTemplate = templateStore.currentTemplate
  const exportName = currentTemplate.exportName
  let resName = exportName.replace(/\{templateName}/g, currentTemplate.label)
  const info = infoStore.info
  if (currentTemplate.type === 'legend') {
    const legendInfo = info as LegendInfo
    resName = resName.replace(/{code}/g, legendInfo.baseInfo.legendId.replace(' ', ''))
    resName = resName.replace(/\{title}/g, legendInfo.baseInfo.title)
    resName = resName.replace(/\{name}/g, legendInfo.baseInfo.name)
  }
  return resName
}

/**
 * 读取进度 JSON 文件
 */
const handleReadJson = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.shap'
  input.style.display = 'none'
  input.onchange = (event: Event) => {
    const file = (event.target as HTMLInputElement)?.files?.[0]
    if (!file || !isProgressFileName(file.name)) {
      alert('请选择 .shap 文件')
      return
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const snapshot = JSON.parse(e.target?.result as string) as DiyInfoSnapshot
        const templateName = snapshot.template?.name
        const matched = templateName ? templateStore.getTemplate(templateName) : undefined
        if (!matched) {
          alert('文件中的模板不存在')
          return
        }
        templateStore.currentTemplateName = templateName
        suppressHistoryRecord(1200)
        await historyStore.importProgressSnapshot(snapshot, resolveInfoKind(matched.type))
      } catch (error) {
        console.error('JSON 解析失败:', error)
        alert('文件格式错误')
      }
    }
    reader.readAsText(file, 'utf-8')
    document.body.removeChild(input)
  }
  document.body.appendChild(input)
  input.click()
}

/**
 * 关闭预览弹窗
 */
const handleClosePreview = () => {
  isPreviewVisible.value = false
  previewImage.value = ''
}
</script>

<template>
  <n-card title="导出设置" class="diy-panel-card">
    <div class="diy-export-bar">
      <div class="diy-export-bar__config">
        <div class="diy-export-bar__inputs">
          <n-select
            v-model:value="exportStore.ppi"
            :options="exportStore.ppiOptions"
            class="diy-export-bar__select"
            size="medium"
            placeholder="分辨率"
          />
          <n-select
            v-model:value="exportStore.format"
            :options="exportStore.formatOptions"
            class="diy-export-bar__select diy-export-bar__select--format"
            size="medium"
            placeholder="格式"
          />
          <div class="diy-export-bar__brightness">
            <div class="diy-export-bar__label">画布亮度</div>
            <n-input-number
              :value="exportStore.brightness"
              button-placement="both"
              size="medium"
              :step="0.02"
              :min="0.8"
              :max="1.2"
              @update:value="
                (v) => {
                  if (typeof v === 'number') exportStore.brightness = v
                }
              "
            />
          </div>
        </div>
        <div class="diy-export-bar__white-border">
          <span>圆角白边：</span>
          <n-switch
            :value="exportStore.whiteBorder"
            @update:value="handleWhiteBorderChange"
            size="medium"
            :disabled="isProcessing || !templateStore.currentTemplate.supportBleed"
          >
            <template #checked>开启</template>
            <template #unchecked>关闭</template>
          </n-switch>
        </div>
        <div class="diy-export-bar__bleed">
          <span>出血：</span>
          <n-switch
            :value="diyStore.bleedFlag"
            @update:value="handleBleedChange"
            size="medium"
            :disabled="isProcessing"
          >
            <template #checked>开启</template>
            <template #unchecked>关闭</template>
          </n-switch>
          <n-input-number
            v-if="diyStore.bleedFlag"
            :value="diyStore.bleedValue"
            class="diy-export-bar__bleed-input"
            button-placement="both"
            size="medium"
            :min="1"
            :step="0.5"
            :max="templateStore.currentTemplate.bleed"
            @update:value="
              (v) => {
                handleBleedValueChange(typeof v === 'number' ? v : null)
              }
            "
          >
            <template #suffix> mm </template>
          </n-input-number>
        </div>
      </div>

      <div class="diy-export-bar__actions-row">
        <div class="diy-export-bar__action-group diy-export-bar__action-group--save">
          <n-button-group>
            <n-button type="info" round @click="handleSaveJson">
              <n-icon><SaveRound /></n-icon>
              保存进度
            </n-button>
            <n-button type="info" round secondary @click="handleReadJson">
              <n-icon><FileUploadRound /></n-icon>
              读取进度
            </n-button>
          </n-button-group>
        </div>

        <div class="diy-export-bar__action-group diy-export-bar__action-group--export">
          <n-button-group>
            <n-button
              type="primary"
              round
              secondary
              :disabled="exportImageDisabled"
              @click="handlePreview"
            >
              <n-icon><VisibilityRound /></n-icon>
              预览图片
            </n-button>
            <n-button
              type="primary"
              round
              :disabled="exportImageDisabled"
              :loading="isProcessing"
              @click="handleExport"
            >
              <n-icon><DownloadRound /></n-icon>
              {{ isProcessing ? '处理中...' : '导出图片' }}
            </n-button>
          </n-button-group>
        </div>
      </div>
    </div>
  </n-card>

  <n-modal
    v-model:show="isPreviewVisible"
    :mask-closable="false"
    preset="card"
    title="图片预览"
    style="width: 80%; max-width: 900px"
  >
    <div class="diy-export-bar__modal-preview">
      <img
        v-if="previewImage"
        :src="previewImage"
        alt="预览图片"
        class="diy-export-bar__modal-image"
      />
      <div v-else class="diy-export-bar__modal-loading">
        <n-spin size="large" />
        <p>正在生成预览...</p>
      </div>
    </div>
    <template #footer>
      <div class="diy-export-bar__modal-footer">
        <n-button @click="handleClosePreview">关闭</n-button>
        <n-button
          type="primary"
          :disabled="exportImageDisabled"
          :loading="isSaving"
          @click="handleSaveFromPreview"
        >
          保存图片
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.diy-export-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  max-width: 100%;
}

.diy-export-bar__config {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 0 1 auto;
}

.diy-export-bar__label {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.diy-export-bar__inputs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.diy-export-bar__bleed,
.diy-export-bar__white-border {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  margin-right: 20px;
}

.diy-export-bar__bleed-input {
  flex: 1;
  max-width: 120px;
}

.diy-export-bar__select {
  min-width: 140px;
  flex: 1;
}

.diy-export-bar__select--format {
  min-width: 80px;
}

.diy-export-bar__actions-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex: 1;
  justify-content: center;
  flex-wrap: wrap;
}

.diy-export-bar__action-group {
  width: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diy-export-bar__brightness {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
}

.diy-export-bar__brightness .diy-export-bar__label {
  font-size: 0.9em;
}

.diy-export-bar__modal-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  overflow: hidden;
}

.diy-export-bar__modal-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.diy-export-bar__modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.diy-export-bar__modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 768px) {
  .diy-export-bar__select,
  .diy-export-bar__select--format,
  .diy-export-bar__brightness {
    min-width: 0;
    flex: 1 1 100%;
  }
}
</style>
