import type { DiyHistoryEntry, DiyInfoSnapshot } from '@/features/diy-card/types/diy/history'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { shouldReconcileKingdomLayoutFromSnapshot } from '@/features/diy-card/composables/doubleKingdom'
import {
  shouldReconcileFrameLayoutFromSnapshot,
  shouldReconcileNameLayoutFromSnapshot,
  shouldReconcileTitleLayoutFromSnapshot,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/cardTextLayout'
import { isRef, nextTick, unref } from 'vue'

export interface InfoHistoryStack {
  entries: DiyHistoryEntry[]
  /** 当前所处快照下标 */
  index: number
}

let entrySeq = 0

export const nextEntryId = () => {
  entrySeq += 1
  return `diy-h-${Date.now()}-${entrySeq}`
}

export const createEmptyStack = (): InfoHistoryStack => ({
  entries: [],
  index: -1,
})

export const cloneSnapshot = (snapshot: DiyInfoSnapshot): DiyInfoSnapshot => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(snapshot)
    } catch {
      /* 含不可克隆类型时回退 JSON */
    }
  }
  return JSON.parse(JSON.stringify(snapshot)) as DiyInfoSnapshot
}

/** 将可能含嵌套 ref 的 info 转为可 JSON 序列化的纯对象（避免快照丢失 baseInfo） */
export const toPlainSnapshot = (value: unknown): unknown => {
  const raw = isRef(value) ? unref(value) : value
  if (raw === null || typeof raw !== 'object') {
    return raw
  }
  if (Array.isArray(raw)) {
    return raw.map((item) => toPlainSnapshot(item))
  }
  const plain: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    plain[key] = toPlainSnapshot(entry)
  }
  return plain
}

export const snapshotSignature = (snapshot: DiyInfoSnapshot) => JSON.stringify(snapshot)

const inlineImageReplacer = (_key: string, value: unknown) => {
  if (typeof value === 'string' && value.startsWith('data:image')) {
    return `@bin:${value.length}:${value.charCodeAt(0)}:${value.charCodeAt(value.length - 1)}`
  }
  return value
}

/** record 去重用：不把 base64 正文写入签名字符串 */
export const snapshotRecordSignature = (snapshot: DiyInfoSnapshot) =>
  JSON.stringify(snapshot, inlineImageReplacer)

const LAYOUT_GEOMETRY_KEYS = ['x', 'y', 'width', 'height', 'scale', 'rotation', 'size', 'order'] as const
const RENDER_ITEM_LAYOUT_KEYS = ['x', 'y', 'width', 'height', 'scale', 'rotation', 'size'] as const

const stripRenderItemLayout = (item: Record<string, unknown>) => {
  const stripped = { ...item }
  for (const key of RENDER_ITEM_LAYOUT_KEYS) {
    delete stripped[key]
  }
  if (stripped.splitChars && typeof stripped.splitChars === 'object') {
    const splitChars = { ...(stripped.splitChars as Record<string, unknown>) }
    for (const charKey of Object.keys(splitChars)) {
      const char = splitChars[charKey]
      if (char && typeof char === 'object') {
        const strippedChar = { ...(char as Record<string, unknown>) }
        for (const key of RENDER_ITEM_LAYOUT_KEYS) {
          delete strippedChar[key]
        }
        splitChars[charKey] = strippedChar
      }
    }
    stripped.splitChars = splitChars
  }
  return stripped
}

/** 排除画布重算后会漂移的几何字段，用于判断用户数据是否一致（不 structuredClone 整份快照） */
export const snapshotSemanticSignature = (snapshot: DiyInfoSnapshot) => {
  const items = snapshot.renderConfig?.items
  if (!items) return JSON.stringify(snapshot)

  const itemsForSig: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(items)) {
    if (!item || typeof item !== 'object') {
      itemsForSig[key] = item
      continue
    }
    itemsForSig[key] = stripRenderItemLayout(item as unknown as Record<string, unknown>)
  }

  return JSON.stringify({
    ...snapshot,
    renderConfig: {
      ...snapshot.renderConfig,
      items: itemsForSig,
    },
  })
}

const copyLayoutFields = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): boolean => {
  let changed = false
  for (const key of LAYOUT_GEOMETRY_KEYS) {
    if (!(key in source)) continue
    if (target[key] !== source[key]) {
      target[key] = source[key]
      changed = true
    }
  }
  return changed
}

/** reconcile 时跳过角标几何：避免快照里普通框宽高覆盖神框 preset */
export const stripPackageLayoutGeometry = (packageItem: Record<string, unknown>) => {
  for (const key of RENDER_ITEM_LAYOUT_KEYS) {
    delete packageItem[key]
  }
}

/** reconcile 时跳过势力字几何（含双势力字子节点） */
export const stripKingdomLayoutGeometry = (kingdomItem: Record<string, unknown>) => {
  for (const key of RENDER_ITEM_LAYOUT_KEYS) {
    delete kingdomItem[key]
  }
  const glyphs = kingdomItem.doubleGlyphs
  if (!glyphs || typeof glyphs !== 'object') return
  for (const glyphKey of Object.keys(glyphs as Record<string, unknown>)) {
    const glyph = (glyphs as Record<string, unknown>)[glyphKey]
    if (!glyph || typeof glyph !== 'object') continue
    for (const key of RENDER_ITEM_LAYOUT_KEYS) {
      delete (glyph as Record<string, unknown>)[key]
    }
  }
}

const mergeItemLayoutFields = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): boolean => {
  let changed = copyLayoutFields(target, source)
  if (
    target.code === 'package' &&
    source.packageCardLayoutKey !== undefined &&
    target.packageCardLayoutKey !== source.packageCardLayoutKey
  ) {
    target.packageCardLayoutKey = source.packageCardLayoutKey
    changed = true
  }
  if (
    target.code === 'name' &&
    source.textCardLayoutKey !== undefined &&
    target.textCardLayoutKey !== source.textCardLayoutKey
  ) {
    target.textCardLayoutKey = source.textCardLayoutKey
    changed = true
  }
  if (
    target.code === 'title' &&
    source.textCardLayoutKey !== undefined &&
    target.textCardLayoutKey !== source.textCardLayoutKey
  ) {
    target.textCardLayoutKey = source.textCardLayoutKey
    changed = true
  }
  if (
    target.code === 'frame' &&
    source.frameCardLayoutKey !== undefined &&
    target.frameCardLayoutKey !== source.frameCardLayoutKey
  ) {
    target.frameCardLayoutKey = source.frameCardLayoutKey
    changed = true
  }
  if (
    target.code === 'kingdom' &&
    source.singlePresetGlyphKey !== undefined &&
    target.singlePresetGlyphKey !== source.singlePresetGlyphKey
  ) {
    target.singlePresetGlyphKey = source.singlePresetGlyphKey
    changed = true
  }
  const sourceSplit = source.splitChars
  const targetSplit = target.splitChars
  if (
    sourceSplit &&
    targetSplit &&
    typeof sourceSplit === 'object' &&
    typeof targetSplit === 'object'
  ) {
    for (const key of Object.keys(sourceSplit as Record<string, unknown>)) {
      const srcChar = (sourceSplit as Record<string, unknown>)[key]
      const tgtChar = (targetSplit as Record<string, unknown>)[key]
      if (
        srcChar &&
        tgtChar &&
        typeof srcChar === 'object' &&
        typeof tgtChar === 'object' &&
        copyLayoutFields(
          tgtChar as Record<string, unknown>,
          srcChar as Record<string, unknown>,
        )
      ) {
        changed = true
      }
    }
  }
  const sourceGlyphs = source.doubleGlyphs
  const targetGlyphs = target.doubleGlyphs
  if (
    sourceGlyphs &&
    targetGlyphs &&
    typeof sourceGlyphs === 'object' &&
    typeof targetGlyphs === 'object'
  ) {
    for (const key of Object.keys(sourceGlyphs as Record<string, unknown>)) {
      const srcGlyph = (sourceGlyphs as Record<string, unknown>)[key]
      const tgtGlyph = (targetGlyphs as Record<string, unknown>)[key]
      if (
        srcGlyph &&
        tgtGlyph &&
        typeof srcGlyph === 'object' &&
        typeof tgtGlyph === 'object' &&
        copyLayoutFields(
          tgtGlyph as Record<string, unknown>,
          srcGlyph as Record<string, unknown>,
        )
      ) {
        changed = true
      }
    }
  }
  return changed
}

/**
 * 画布 settle 后仅写回 layout 几何，避免整份 structuredClone + 持久化大快照
 */
export const syncLayoutGeometryIntoSnapshot = (
  target: DiyInfoSnapshot,
  source: DiyInfoSnapshot,
): boolean => {
  let changed = false
  const targetItems = target.renderConfig?.items
  const sourceItems = source.renderConfig?.items
  if (targetItems && sourceItems) {
    for (const key of Object.keys(sourceItems)) {
      const src = sourceItems[key as keyof typeof sourceItems]
      const tgt = targetItems[key as keyof typeof targetItems]
      if (src && tgt && typeof src === 'object' && typeof tgt === 'object') {
        if (
          key === 'kingdom' &&
          !shouldReconcileKingdomLayoutFromSnapshot(
            target as LegendInfo,
            src as LegendInfo['renderConfig']['items']['kingdom'],
          )
        ) {
          continue
        }
        if (
          key === 'name' &&
          !shouldReconcileNameLayoutFromSnapshot(
            target as LegendInfo,
            src as LegendInfo['renderConfig']['items']['name'],
          )
        ) {
          continue
        }
        if (
          key === 'title' &&
          !shouldReconcileTitleLayoutFromSnapshot(
            target as LegendInfo,
            src as LegendInfo['renderConfig']['items']['title'],
          )
        ) {
          continue
        }
        if (
          key === 'frame' &&
          !shouldReconcileFrameLayoutFromSnapshot(
            target as LegendInfo,
            src as LegendInfo['renderConfig']['items']['frame'],
          )
        ) {
          continue
        }
        if (
          mergeItemLayoutFields(
            tgt as Record<string, unknown>,
            src as Record<string, unknown>,
          )
        ) {
          changed = true
        }
      }
    }
  }

  if (target.customMaterialList && source.customMaterialList) {
    const targetById = new Map(target.customMaterialList.map((item) => [item.id, item]))
    for (const src of source.customMaterialList) {
      const tgt = targetById.get(src.id)
      if (
        tgt &&
        copyLayoutFields(
          tgt as unknown as Record<string, unknown>,
          src as unknown as Record<string, unknown>,
        )
      ) {
        changed = true
      }
    }
  }

  return changed
}

/** 等待 Vue watch 与 Konva 布局写回完成，避免恢复结束后联动 watch 覆盖快照布局 */
export const flushRestoreGuards = async () => {
  await nextTick()
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export const cloneStack = (stack: InfoHistoryStack): InfoHistoryStack => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(stack)
    } catch {
      /* 回退 JSON */
    }
  }
  return JSON.parse(JSON.stringify(stack)) as InfoHistoryStack
}
