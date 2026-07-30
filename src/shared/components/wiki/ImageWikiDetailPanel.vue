<script setup lang="ts">
import { getImageWiki } from '@/shared/api/wiki'
import type { WikiImageSelectPayload } from '@/shared/types/wiki'
import { getDict, isSuccess } from '@/shared/api'
import type { DictItem } from '@/shared/types/api'
import { getLabel } from '@/shared/utils/dict'
import { CheckCircleRound, DownloadRound, ImageNotSupportedRound, VisibilityRound } from '@/shared/icons'
import { useWikiImageFullRouteOverlay } from '@/shared/composables/useWikiImageFullRouteOverlay'
import WikiLegendLinkList from '@/shared/components/wiki/WikiLegendLinkList.vue'
import { parseImageWikiLegendLinks } from '@/shared/utils/wikiLegendLink'
import { downloadRemoteFile, formatFileSize } from '@/shared/utils/file'
import { useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'ImageWikiDetailPanel' })

interface Props {
  imageId: number
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
})

const emit = defineEmits<{
  apply: [payload: WikiImageSelectPayload]
}>()

const message = useMessage()
const { visible: fullImageVisible, open: openFullImage, handleShowUpdate: handleFullImageShowUpdate } =
  useWikiImageFullRouteOverlay()
const loading = ref(false)
const fullImageLoading = ref(false)
const downloadingKey = ref<'primary' | 'alternate' | null>(null)
const imageWiki = ref<Record<string, unknown>>({})
const useAlternate = ref(false)

const kingdomOptions = ref<DictItem[]>([])
const qualityOptions = ref<DictItem[]>([])

const primaryPreviewUrl = computed(() =>
  String(imageWiki.value.previewUrl ?? imageWiki.value.url ?? ''),
)
const alternatePreviewUrl = computed(() =>
  String(imageWiki.value.previewUrl2 ?? imageWiki.value.url2 ?? ''),
)

const previewUrl = computed(() =>
  useAlternate.value ? alternatePreviewUrl.value : primaryPreviewUrl.value,
)

const fullUrl = computed(() =>
  useAlternate.value ? alternateFullUrl.value : primaryFullUrl.value,
)

const activeVariantKey = computed<'primary' | 'alternate'>(() =>
  useAlternate.value ? 'alternate' : 'primary',
)

const activeSizeLabel = computed(() =>
  useAlternate.value ? alternateSizeLabel.value : primarySizeLabel.value,
)

const activeVariantLabel = computed(() => (useAlternate.value ? '原画 2' : '原画 1'))

const selectVariant = (variant: 'primary' | 'alternate') => {
  useAlternate.value = variant === 'alternate'
}

const primaryFullUrl = computed(() => String(imageWiki.value.url ?? imageWiki.value.previewUrl ?? ''))
const alternateFullUrl = computed(() => String(imageWiki.value.url2 ?? imageWiki.value.previewUrl2 ?? ''))
const hasAlternateImage = computed(() => Boolean(imageWiki.value.url2))

const formatWikiImageSize = (raw: unknown) => {
  const size = Number(raw)
  return Number.isFinite(size) && size > 0 ? formatFileSize(size) : '未知'
}

const primarySizeLabel = computed(() => formatWikiImageSize(imageWiki.value.size))
const alternateSizeLabel = computed(() => formatWikiImageSize(imageWiki.value.size2))

const resolveDownloadFilename = (url: string, suffix = '') => {
  const title = String(imageWiki.value.title ?? '原画').trim() || '原画'
  const ext = url.split('?')[0]?.match(/\.(\w+)$/)?.[1] ?? 'jpg'
  return suffix ? `${title}-${suffix}.${ext}` : `${title}.${ext}`
}

const downloadImageByKey = async (key: 'primary' | 'alternate' = activeVariantKey.value) => {
  const url = key === 'alternate' ? alternateFullUrl.value : primaryFullUrl.value
  if (!url) {
    message.warning('当前原画缺少可用下载地址')
    return
  }
  downloadingKey.value = key
  try {
    const suffix = key === 'alternate' ? '原画2' : hasAlternateImage.value ? '原画1' : ''
    const filename = resolveDownloadFilename(url, suffix)
    const ok = await downloadRemoteFile(url, filename)
    if (ok) {
      message.success('原画已开始下载')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    message.info('无法直接下载，已在新标签页打开原画')
  } finally {
    downloadingKey.value = null
  }
}

const legendLinks = computed(() =>
  parseImageWikiLegendLinks(imageWiki.value.legendImageList, kingdomOptions.value),
)

const loadImage = async () => {
  loading.value = true
  useAlternate.value = false
  try {
    const res = await getImageWiki(props.imageId)
    if (!isSuccess(res)) {
      throw new Error(res.message || '原画加载失败')
    }
    imageWiki.value = res.data
  } catch (error) {
    message.error(error instanceof Error ? error.message : '原画加载失败')
  } finally {
    loading.value = false
  }
}

const handleApply = () => {
  const url = fullUrl.value
  if (!url) {
    message.warning('当前原画缺少可用图片地址')
    return
  }
  emit('apply', {
    type: 'image',
    data: {
      url,
      title: String(imageWiki.value.title ?? ''),
      painter: String(imageWiki.value.painter ?? '佚名'),
    },
  })
}

watch(
  () => props.imageId,
  (id) => {
    if (id > 0) {
      void loadImage()
    }
  },
  { immediate: true },
)

watch(
  () => [fullImageVisible.value, fullUrl.value] as const,
  ([visible]) => {
    if (visible) {
      fullImageLoading.value = true
    }
  },
)

void (async () => {
  const [kingdomRes, qualityRes] = await Promise.all([
    getDict('kingdom'),
    getDict('image_quality'),
  ])
  if (isSuccess(kingdomRes)) kingdomOptions.value = kingdomRes.data.itemList ?? []
  if (isSuccess(qualityRes)) qualityOptions.value = qualityRes.data.itemList ?? []
})()
</script>

<template>
  <n-el tag="div" class="image-detail-panel">
    <n-spin :show="loading" class="image-detail-panel__body-spin">
      <header class="image-detail-panel__header">
        <h1 class="diy-drawer-page-title">{{ imageWiki.title || '原画详情' }}</h1>
        <p class="image-detail-panel__meta">
          {{ imageWiki.painter || '佚名' }}
          <span v-if="imageWiki.quality">
            · {{ getLabel(String(imageWiki.quality), qualityOptions) }}
          </span>
        </p>
      </header>

      <section
        class="image-detail-panel__media-card"
        :class="{ 'image-detail-panel__media-card--dual': hasAlternateImage }"
      >
        <div v-if="hasAlternateImage" class="image-detail-panel__variants" role="tablist">
          <button
            type="button"
            role="tab"
            class="image-detail-panel__variant"
            :class="{ 'image-detail-panel__variant--active': !useAlternate }"
            :aria-selected="!useAlternate"
            @click="selectVariant('primary')"
          >
            <span class="image-detail-panel__variant-thumb">
              <img
                v-if="primaryPreviewUrl"
                :src="primaryPreviewUrl"
                alt=""
                loading="lazy"
              />
              <n-icon v-else :size="20"><ImageNotSupportedRound /></n-icon>
            </span>
            <span class="image-detail-panel__variant-text">
              <span class="image-detail-panel__variant-label">原画 1</span>
              <span class="image-detail-panel__variant-size">{{ primarySizeLabel }}</span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            class="image-detail-panel__variant"
            :class="{ 'image-detail-panel__variant--active': useAlternate }"
            :aria-selected="useAlternate"
            @click="selectVariant('alternate')"
          >
            <span class="image-detail-panel__variant-thumb">
              <img
                v-if="alternatePreviewUrl"
                :src="alternatePreviewUrl"
                alt=""
                loading="lazy"
              />
              <n-icon v-else :size="20"><ImageNotSupportedRound /></n-icon>
            </span>
            <span class="image-detail-panel__variant-text">
              <span class="image-detail-panel__variant-label">原画 2</span>
              <span class="image-detail-panel__variant-size">{{ alternateSizeLabel }}</span>
            </span>
          </button>
        </div>

        <div class="image-detail-panel__preview">
          <img
            v-if="previewUrl"
            :key="previewUrl"
            :src="previewUrl"
            :alt="`${String(imageWiki.title ?? '原画')} · ${activeVariantLabel}`"
          />
          <div v-else class="image-detail-panel__preview-empty">
            <n-icon :size="32"><ImageNotSupportedRound /></n-icon>
            <span>暂无预览图</span>
          </div>
          <span v-if="hasAlternateImage" class="image-detail-panel__preview-badge">
            {{ activeVariantLabel }}
          </span>
        </div>

        <div class="image-detail-panel__media-meta">
          <div class="image-detail-panel__size">
            <span class="image-detail-panel__size-label">
              {{ hasAlternateImage ? `${activeVariantLabel} 文件大小` : '文件大小' }}
            </span>
            <span class="image-detail-panel__size-value">{{ activeSizeLabel }}</span>
          </div>
          <div class="image-detail-panel__media-actions">
            <n-button
              class="image-detail-panel__action-btn"
              type="primary"
              size="medium"
              :disabled="!fullUrl"
              :loading="downloadingKey === activeVariantKey"
              @click="downloadImageByKey()"
            >
              <template #icon>
                <n-icon><DownloadRound /></n-icon>
              </template>
              {{ hasAlternateImage ? `下载${activeVariantLabel}` : '下载原画' }}
            </n-button>
            <n-button
              v-if="readonly && fullUrl"
              class="image-detail-panel__action-btn"
              type="primary"
              ghost
              size="medium"
              @click="openFullImage"
            >
              <template #icon>
                <n-icon><VisibilityRound /></n-icon>
              </template>
              查看原图
            </n-button>
          </div>
        </div>
      </section>

      <n-alert v-if="!readonly" type="info" :bordered="false">
        预览图为压缩效果，一键使用时会写入高清原图地址。
      </n-alert>
      <n-alert v-else type="info" :bordered="false">
        预览图为压缩效果，完整原画请使用上方下载按钮或点击查看原图。
      </n-alert>

      <div class="image-detail-panel__facts wiki-detail-inset">
        <div class="image-detail-panel__fact-row">
          <strong>关联武将</strong>
          <WikiLegendLinkList :links="legendLinks" />
        </div>
        <div v-if="imageWiki.remark" class="image-detail-panel__fact-remark">
          <strong>备注</strong>{{ imageWiki.remark }}
        </div>
      </div>
    </n-spin>

    <footer v-if="!readonly" class="diy-detail-panel__footer-bar">
      <n-button
        type="primary"
        size="large"
        block
        :disabled="!fullUrl"
        @click="handleApply"
      >
        <template #icon>
          <n-icon><CheckCircleRound /></n-icon>
        </template>
        一键使用{{ hasAlternateImage ? activeVariantLabel : '此原画' }}
      </n-button>
    </footer>

    <n-modal
      :show="fullImageVisible"
      preset="card"
      title="查看原图"
      class="image-detail-panel__full-modal"
      :style="{ width: 'min(96vw, 960px)' }"
      :mask-closable="true"
      :auto-focus="false"
      transform-origin="center"
      @update:show="handleFullImageShowUpdate"
    >
      <div class="image-detail-panel__full-body">
        <n-spin :show="fullImageLoading">
          <img
            v-if="fullUrl"
            :key="fullUrl"
            :src="fullUrl"
            :alt="`${String(imageWiki.title ?? '原画')} · ${activeVariantLabel}`"
            class="image-detail-panel__full-img"
            @load="fullImageLoading = false"
            @error="fullImageLoading = false"
          />
        </n-spin>
        <p v-if="hasAlternateImage" class="image-detail-panel__full-caption">
          {{ activeVariantLabel }} · {{ activeSizeLabel }}
        </p>
      </div>
      <template #footer>
        <n-button block quaternary @click="handleFullImageShowUpdate(false)">关闭</n-button>
      </template>
    </n-modal>
  </n-el>
</template>

<style scoped>
.image-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  max-width: 100%;
  padding: 4px 0 0;
  box-sizing: border-box;
}

.image-detail-panel__body-spin {
  display: block;
  width: 100%;
}

.image-detail-panel__body-spin :deep(.n-spin-content) {
  display: flex;
  flex-direction: column;
  gap: var(--diy-drawer-content-gap);
  width: 100%;
}

.image-detail-panel__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: var(--page-gap, 16px);
  border-bottom: 1px solid var(--divider-color);
}

.image-detail-panel__meta {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-color-2);
}

.image-detail-panel__media-card {
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, var(--border-color));
  border-radius: var(--page-r, 12px);
  overflow: hidden;
  background: var(--card-color);
}

.image-detail-panel__variants {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 10px 10px 0;
}

.image-detail-panel__variant {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--card-color);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.image-detail-panel__variant:hover {
  border-color: color-mix(in srgb, var(--primary-color) 40%, var(--border-color));
}

.image-detail-panel__variant--active {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, var(--card-color));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 24%, transparent);
}

.image-detail-panel__variant-thumb {
  flex-shrink: 0;
  width: 44px;
  height: 58px;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--border-color) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
}

.image-detail-panel__variant-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-detail-panel__variant-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.image-detail-panel__variant-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-base);
}

.image-detail-panel__variant-size {
  font-size: 12px;
  color: var(--text-color-3);
}

.image-detail-panel__preview {
  position: relative;
  margin: 10px;
  border-radius: 10px;
  overflow: hidden;
  background: color-mix(in srgb, var(--border-color) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-color) 45%, transparent);
  min-height: 280px;
}

.image-detail-panel__media-card:not(.image-detail-panel__media-card--dual) .image-detail-panel__preview {
  margin: 0;
  border: none;
  border-radius: 0;
}

.image-detail-panel__preview-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  pointer-events: none;
}

.image-detail-panel__preview img {
  width: 100%;
  max-width: 100%;
  max-height: min(420px, 55dvh);
  object-fit: contain;
  display: block;
}

.image-detail-panel__preview-empty {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-color-3);
}

.image-detail-panel__media-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 55%, transparent);
  background: color-mix(in srgb, var(--body-color) 30%, var(--card-color));
}

.image-detail-panel__media-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.image-detail-panel__media-actions:has(.image-detail-panel__action-btn + .image-detail-panel__action-btn)
  :deep(.image-detail-panel__action-btn) {
  flex: 1 1 0;
  min-width: 132px;
  max-width: 168px;
  justify-content: center;
}

.image-detail-panel__size {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.image-detail-panel__size-label {
  font-size: 12px;
  color: var(--text-color-3);
}

.image-detail-panel__size-value {
  font-size: 14px;
  font-weight: 600;
  font-family: var(--site-font-family);
  color: var(--text-color-base);
}

.image-detail-panel__facts {
  display: grid;
  gap: 12px;
  font-size: 14px;
  margin-top: 2px;
}

.image-detail-panel__facts strong {
  display: inline-block;
  width: 72px;
  color: var(--text-color-3);
  flex-shrink: 0;
}

.image-detail-panel__fact-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.image-detail-panel__fact-row :deep(.wiki-legend-link-list),
.image-detail-panel__fact-row :deep(.wiki-legend-link-list__empty) {
  flex: 1;
  min-width: 0;
}

.image-detail-panel__fact-remark {
  line-height: 1.55;
}

.image-detail-panel__full-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-height: 200px;
}

.image-detail-panel__full-img {
  display: block;
  width: 100%;
  max-width: 100%;
  max-height: min(78dvh, 900px);
  object-fit: contain;
  margin: 0 auto;
}

.image-detail-panel__full-caption {
  margin: 0;
  font-size: 13px;
  color: var(--text-color-3);
  text-align: center;
}
</style>
