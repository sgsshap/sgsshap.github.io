import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import Konva from 'konva'

const SKILL_DESC_DEFAULT_FILL = '#000000'

const isSkillDescTextSegment = (item: CanvasItemConfig) =>
  Boolean(
    (item.code?.startsWith('skillsDesc_text_') || item.code?.includes('_quote_line_')) &&
    item.text,
  )

/**
 * 将 canvasConfigs 中的 fill/stroke 写回 Konva Text（vue-konva 偶发不同步时兜底）
 */
export const paintSkillDescKonvaTextSubtree = (
  root: Konva.Group,
  segments: readonly CanvasItemConfig[],
) => {
  const byCode = new Map(
    segments.filter(isSkillDescTextSegment).map((item) => [item.code!, item]),
  )
  if (byCode.size === 0) return

  for (const node of root.find('Text') as Konva.Text[]) {
    const code = node.getAttr('code') as string | undefined
    if (!code || !byCode.has(code)) continue

    const cfg = byCode.get(code)!
    const fill = typeof cfg.fill === 'string' ? cfg.fill : SKILL_DESC_DEFAULT_FILL
    node.fill(fill)
    node.fontFamily(cfg.fontFamily ?? node.fontFamily())
    node.fontSize(cfg.fontSize ?? node.fontSize())
    node.lineHeight(cfg.lineHeight ?? node.lineHeight())
    node.letterSpacing(cfg.letterSpacing ?? node.letterSpacing())

    const stroke = typeof cfg.stroke === 'string' ? cfg.stroke : undefined
    const strokeWidth = typeof cfg.strokeWidth === 'number' ? cfg.strokeWidth : 0
    if (stroke && strokeWidth > 0) {
      node.stroke(stroke)
      node.strokeWidth(strokeWidth)
      node.fillAfterStrokeEnabled(Boolean(cfg.fillAfterStrokeEnabled))
    } else {
      node.stroke('')
      node.strokeWidth(0)
      node.fillAfterStrokeEnabled(false)
    }
    if (node.isCached()) node.clearCache()
  }
  root.getLayer()?.batchDraw()
}
