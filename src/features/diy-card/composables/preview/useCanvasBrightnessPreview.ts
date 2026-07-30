import { buildCanvasBrightnessCssStyle } from '@/features/diy-card/utils/canvasBrightness'
import { onUnmounted, watch, type Ref } from 'vue'

const applyBrightnessToElement = (el: HTMLElement | null | undefined, brightness: number) => {
  if (!el) return
  const style = buildCanvasBrightnessCssStyle(brightness)
  if (style?.filter) {
    el.style.filter = style.filter
  } else {
    el.style.removeProperty('filter')
  }
}

/**
 * 预览区画布亮度：仅写 DOM filter，不触发模板 reload / Konva 重绘 / info 变更
 */
export function useCanvasBrightnessPreview(
  getBrightness: () => number,
  targets: Array<Ref<HTMLElement | null | undefined>>,
) {
  const syncCanvasBrightnessPreview = () => {
    const brightness = getBrightness()
    for (const target of targets) {
      applyBrightnessToElement(target.value ?? null, brightness)
    }
  }

  const stopBrightness = watch(getBrightness, syncCanvasBrightnessPreview, {
    flush: 'post',
    immediate: true,
  })
  const stopTargets = watch(
    () => targets.map((target) => target.value),
    syncCanvasBrightnessPreview,
    { flush: 'post' },
  )

  onUnmounted(() => {
    stopBrightness()
    stopTargets()
    for (const target of targets) {
      target.value?.style.removeProperty('filter')
    }
  })

  return { syncCanvasBrightnessPreview }
}
