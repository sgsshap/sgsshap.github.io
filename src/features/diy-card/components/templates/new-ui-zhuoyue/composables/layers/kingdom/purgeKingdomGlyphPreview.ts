import { isKingdomGlyphCode } from '@/features/diy-card/composables/doubleKingdom'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'

const KINGDOM_GLYPH_CODES = ['kingdom-primary', 'kingdom-secondary'] as const

/**
 * 关闭双势力叠层后、图层 load 完成前，清掉预览里仍挂着的 kingdom-primary/secondary。
 * 避免模板从独立字节点切回 kingdom 组时，旧双字坐标被嵌套渲染导致势力字闪到右下。
 */
export const purgeKingdomGlyphPreviewState = (canvas: Pick<TemplateCanvasState, 'canvasConfigs' | 'itemCacheMap'>) => {
  const map = canvas.itemCacheMap.value
  if (map) {
    let mapDirty = false
    for (const code of KINGDOM_GLYPH_CODES) {
      if (!map[code]) continue
      map[code]!.ref.value = null
      delete map[code]
      mapDirty = true
    }
    if (mapDirty) {
      canvas.itemCacheMap.value = { ...map }
    }
  }

  const kingdom = canvas.canvasConfigs.kingdom
  if (!kingdom?.children?.some((child) => isKingdomGlyphCode(child.code))) return

  canvas.canvasConfigs.kingdom = buildKingdomPreviewShell(kingdom.loadFunc)
}

/** 势力层切换（如双势力单字显示）时清空预览，避免旧结构嵌套渲染闪到左上角 */
export const resetKingdomCanvasPreviewShell = (
  canvas: Pick<TemplateCanvasState, 'canvasConfigs' | 'itemCacheMap'>,
) => {
  purgeKingdomGlyphPreviewState(canvas)
  const loadFunc = canvas.canvasConfigs.kingdom?.loadFunc
  canvas.canvasConfigs.kingdom = buildKingdomPreviewShell(loadFunc)
}

const buildKingdomPreviewShell = (loadFunc?: CanvasItemConfig['loadFunc']) => ({
  code: 'kingdom',
  name: '势力',
  width: 0,
  height: 0,
  originX: 0,
  originY: 0,
  rotation: 0,
  listening: false,
  children: [] as CanvasItemConfig[],
  loadFunc,
})
