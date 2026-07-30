/** 自定义势力 / 双势力开关切换：抑制同 tick 内其它 layout watch 重复重载画布 */
let batchActive = false
let onBeginHooks: Array<() => void> = []
let onEndHooks: Array<() => void> = []

export const registerKingdomToggleCanvasBatchHooks = (hooks: {
  onBegin?: () => void
  onEnd?: () => void
}) => {
  if (hooks.onBegin) {
    onBeginHooks.push(hooks.onBegin)
  }
  if (hooks.onEnd) {
    onEndHooks.push(hooks.onEnd)
  }
}

export const resetKingdomToggleCanvasBatchHooks = () => {
  onBeginHooks = []
  onEndHooks = []
}

export const beginKingdomToggleCanvasBatch = () => {
  batchActive = true
  for (const hook of onBeginHooks) {
    hook()
  }
}

export const endKingdomToggleCanvasBatch = () => {
  batchActive = false
  for (const hook of onEndHooks) {
    hook()
  }
}

export const isKingdomToggleCanvasBatchActive = () => batchActive
