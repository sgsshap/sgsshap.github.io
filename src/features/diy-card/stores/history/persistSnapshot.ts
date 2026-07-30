import type { DiyInfoSnapshot } from '@/features/diy-card/types/diy/history'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'

export type PersistedBinaryAssets = Record<string, string>

const INLINE_IMAGE_PREFIX = 'data:image'
export const PERSISTED_IMAGE_REF_PREFIX = 'img:'
const ASSET_REF_PREFIX = PERSISTED_IMAGE_REF_PREFIX

export const isPersistedImageRef = (value: string) => value.startsWith(PERSISTED_IMAGE_REF_PREFIX)

let runtimePersistedBinaryAssets: PersistedBinaryAssets = {}

/** 会话内可用的 sidecar 图片表（持久化恢复 / 写入后同步，供 img: 引用解析） */
export const setRuntimePersistedBinaryAssets = (assets: PersistedBinaryAssets) => {
  runtimePersistedBinaryAssets = assets
}

export const mergeRuntimePersistedBinaryAssets = (assets: PersistedBinaryAssets) => {
  if (!Object.keys(assets).length) return
  runtimePersistedBinaryAssets = { ...runtimePersistedBinaryAssets, ...assets }
}

export const resolvePersistedImageSrc = (
  src: string,
  assets: PersistedBinaryAssets = runtimePersistedBinaryAssets,
): string => {
  if (!isPersistedImageRef(src)) return src
  return assets[src] ?? src
}

const isInlineImageData = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(INLINE_IMAGE_PREFIX)

const hashInlineImage = (data: string): string => {
  let hash = 0
  const step = Math.max(1, Math.floor(data.length / 64))
  for (let i = 0; i < data.length; i += step) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  return `${Math.abs(hash)}_${data.length}`
}

/** 将 inline 图片注册到 sidecar，返回短引用键 */
export const registerInlineImageAsset = (
  data: string,
  assets: PersistedBinaryAssets,
): string => {
  if (!isInlineImageData(data)) return data
  const key = `${ASSET_REF_PREFIX}${hashInlineImage(data)}`
  assets[key] = data
  return key
}

/** 判断两段 inline 图片内容是否相同（structuredClone 后引用不同但内容一致） */
export const isSameInlineImageData = (a: string, b: string) => {
  if (a === b) return true
  if (!isInlineImageData(a) || !isInlineImageData(b)) return false
  if (a.length !== b.length) return false
  return hashInlineImage(a) === hashInlineImage(b)
}

const resolveInlineImageAsset = (value: string, assets: PersistedBinaryAssets): string =>
  resolvePersistedImageSrc(value, assets)

const jsonCloneWithReplacer = <T>(
  value: T,
  replacer: (key: string, val: unknown) => unknown,
): T => JSON.parse(JSON.stringify(value, replacer)) as T

/** 自定义素材 data 保留 inline base64（最多 5 张，避免 sidecar 丢失后无法恢复） */
const shouldKeepInlineImageField = (path: string, key: string) =>
  key === 'data' && path.includes('customMaterialList')

const stripInlineImagesDeep = (
  value: unknown,
  path: string,
  assets: PersistedBinaryAssets,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      stripInlineImagesDeep(item, `${path}[${index}]`, assets),
    )
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key
      if (
        typeof val === 'string' &&
        (key === 'data' || key === 'pic') &&
        !shouldKeepInlineImageField(childPath, key)
      ) {
        result[key] = registerInlineImageAsset(val, assets)
      } else {
        result[key] = stripInlineImagesDeep(val, childPath, assets)
      }
    }
    return result
  }
  return value
}

/** 将快照内 img: 引用还原为 inline 图片（sidecar 已载入会话后调用） */
export const resolvePersistedImagesInSnapshot = (snapshot: DiyInfoSnapshot): void => {
  if ('customMaterialList' in snapshot && Array.isArray(snapshot.customMaterialList)) {
    for (const item of snapshot.customMaterialList) {
      if (item?.data) {
        item.data = resolvePersistedImageSrc(item.data)
      }
    }
  }

  if ('baseInfo' in snapshot && snapshot.baseInfo && typeof snapshot.baseInfo === 'object') {
    const base = snapshot.baseInfo as {
      pic?: string
      packageIdentify?: { pic?: string }
    }
    if (base.pic) {
      base.pic = resolvePersistedImageSrc(base.pic)
    }
    if (base.packageIdentify?.pic) {
      base.packageIdentify.pic = resolvePersistedImageSrc(base.packageIdentify.pic)
    }
  }
}

/** 持久化前剥离快照中的 base64，写入 binaryAssets sidecar（按内容去重） */
export const stripSnapshotForPersist = (
  snapshot: DiyInfoSnapshot,
  assets: PersistedBinaryAssets,
): DiyInfoSnapshot => stripInlineImagesDeep(snapshot, '', assets) as DiyInfoSnapshot

/** 从 IndexedDB 恢复时还原 inline 图片 */
export const hydrateSnapshotFromPersist = (
  snapshot: DiyInfoSnapshot,
  assets: PersistedBinaryAssets = {},
): DiyInfoSnapshot =>
  jsonCloneWithReplacer(snapshot, (_key, val) => {
    if (typeof val === 'string' && val.startsWith(ASSET_REF_PREFIX)) {
      return resolveInlineImageAsset(val, assets)
    }
    return val
  })

/** 将可能含嵌套 ref 的 inline 图片与历史栈中已有快照复用同一字符串引用，降低内存 */
export const shareBinaryRefsWithStack = (
  snapshots: readonly DiyInfoSnapshot[],
  next: DiyInfoSnapshot,
): void => {
  for (const previous of snapshots) {
    shareBinaryRefsWithPrevious(previous, next)
  }
}

/** 新快照与上一项内容相同时复用 base64 字符串引用，降低内存与 GC 压力 */
export const shareBinaryRefsWithPrevious = (
  previous: DiyInfoSnapshot | undefined,
  next: DiyInfoSnapshot,
): void => {
  if (!previous) return

  if ('customMaterialList' in previous && 'customMaterialList' in next) {
    const prevList = (previous as LegendInfo).customMaterialList
    const nextList = (next as LegendInfo).customMaterialList
    if (prevList?.length && nextList?.length) {
      const prevById = new Map(prevList.map((item) => [item.id, item]))
      for (const item of nextList) {
        const prevItem = prevById.get(item.id)
        if (!prevItem?.data || !item.data) continue
        if (isSameInlineImageData(prevItem.data, item.data)) {
          item.data = prevItem.data
          continue
        }
        if (isInlineImageData(prevItem.data) && isPersistedImageRef(item.data)) {
          if (resolvePersistedImageSrc(item.data) === prevItem.data) {
            item.data = prevItem.data
          }
        }
      }
    }
  }

  if ('baseInfo' in previous && 'baseInfo' in next) {
    const prevBase = (previous as LegendInfo).baseInfo
    const nextBase = (next as LegendInfo).baseInfo
    if (prevBase.pic && nextBase.pic && isSameInlineImageData(prevBase.pic, nextBase.pic)) {
      nextBase.pic = prevBase.pic
    }
    const prevPkgPic = prevBase.packageIdentify?.pic
    const nextPkgPic = nextBase.packageIdentify?.pic
    if (
      prevPkgPic &&
      nextPkgPic &&
      isSameInlineImageData(prevPkgPic, nextPkgPic) &&
      nextBase.packageIdentify
    ) {
      nextBase.packageIdentify.pic = prevPkgPic
    }
  }
}

/** clone 后把大图字段指回 live plain，避免 structuredClone 复制多份 base64 */
export const restoreInlineBinaryRefsFromPlain = (
  plain: DiyInfoSnapshot,
  snapshot: DiyInfoSnapshot,
): void => {
  shareBinaryRefsWithPrevious(plain, snapshot)
}
