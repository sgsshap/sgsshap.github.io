export const formatKingdoms = (kingdoms: string[]) => {
  if (kingdoms.length === 0) {
    return ''
  }
  return kingdoms.map((kingdom) => getKingdomLabel(kingdom)).join('、')
}

/**
 * 按给定优先级表排序势力（未出现在表中的项排在末尾，保持相对顺序）
 * @param kingdoms 待排序势力 key 列表
 * @param displayOrder 优先级表，索引越小越靠前
 */
export const sortKingdomsByDisplayOrder = (
  kingdoms: string[],
  displayOrder: readonly string[],
) => {
  if (kingdoms.length <= 1 || displayOrder.length === 0) {
    return [...kingdoms]
  }
  const rank = new Map(displayOrder.map((k, i) => [k, i]))
  const fallback = displayOrder.length
  return [...kingdoms].sort(
    (a, b) => (rank.get(a) ?? fallback) - (rank.get(b) ?? fallback),
  )
}

/** 按数组顺序拼接势力字（双势力展示，如 魏+吴 → 魏吴） */
export const formatOrderedKingdoms = (kingdoms: string[]) => {
  if (kingdoms.length === 0) {
    return ''
  }
  return kingdoms.map((kingdom) => getKingdomLabel(kingdom)).join('')
}

export const getKingdomLabel = (kingdom: string) => {
  switch (kingdom) {
    case 'wei':
      return '魏'
    case 'shu':
      return '蜀'
    case 'wu':
      return '吴'
    case 'qun':
      return '群'
    case 'jin':
      return '晋'
    case 'shen':
      return '神'
  }
}
