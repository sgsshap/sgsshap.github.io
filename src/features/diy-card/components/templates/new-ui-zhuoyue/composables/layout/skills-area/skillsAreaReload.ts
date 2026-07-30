import type { LayerLoaderMap } from '@/features/diy-card/composables/template/types'
import { scheduleAfterUiPaint } from '@/shared/utils/scheduling'
import { getSkillsAreaBlockLayoutSignature } from './layout'
import { cancelSkillsAreaLayoutTasks } from './areaLayoutGate'
import type { ZhuoyueLayerCode } from '../../setup'

export type SkillsAreaReloadMode = 'desc' | 'name' | 'full'

export type SkillsAreaReloadRequest = {
  reset: boolean
  mode: SkillsAreaReloadMode
}

const resolveMergedSkillsAreaReloadMode = (
  current: SkillsAreaReloadMode,
  next: SkillsAreaReloadMode,
): SkillsAreaReloadMode => {
  if (current === 'full' || next === 'full') return 'full'
  if (current !== next) return 'full'
  return current
}

const mergeSkillsAreaReloadRequest = (
  current: SkillsAreaReloadRequest | null,
  next: SkillsAreaReloadRequest,
): SkillsAreaReloadRequest => {
  if (!current) return next
  return {
    reset: current.reset || next.reset,
    mode: resolveMergedSkillsAreaReloadMode(current.mode, next.mode),
  }
}

export type SkillsAreaReloadCoordinator = {
  schedule: (request: SkillsAreaReloadRequest) => void
  cancel: () => void
}

/** 技能区 desc/name 串行合并重载：连打时只保留最新意图，避免 cancel 与 in-flight 竞态卡死 */
export const createSkillsAreaReloadCoordinator = (
  loaders: LayerLoaderMap<ZhuoyueLayerCode>,
  options: {
    canReload: () => boolean
    onSettled: () => void
  },
): SkillsAreaReloadCoordinator => {
  let pending: SkillsAreaReloadRequest | null = null
  let draining = false
  let drainEpoch = 0

  const runIteration = async (epoch: number, request: SkillsAreaReloadRequest) => {
    if (epoch !== drainEpoch || !options.canReload()) return

    if (request.mode === 'name') {
      await Promise.resolve(loaders.skillsName(request.reset))
      return
    }

    const prevBlockSig = getSkillsAreaBlockLayoutSignature()
    await Promise.resolve(loaders.skillsDesc(request.reset))
    if (epoch !== drainEpoch) return

    const layoutChanged = getSkillsAreaBlockLayoutSignature() !== prevBlockSig
    if (request.reset || request.mode === 'full' || layoutChanged) {
      await Promise.resolve(loaders.skillsName(request.reset))
    }
  }

  let drainPaintScheduled = false

  const kickDrain = () => {
    if (drainPaintScheduled) return
    drainPaintScheduled = true
    scheduleAfterUiPaint(() => {
      drainPaintScheduled = false
      void drain()
    })
  }

  const drain = async () => {
    if (draining) return
    draining = true
    const epoch = ++drainEpoch
    try {
      while (pending && epoch === drainEpoch) {
        const request = pending
        pending = null
        await runIteration(epoch, request)
      }
    } finally {
      draining = false
      options.onSettled()
      if (pending && epoch === drainEpoch) {
        kickDrain()
      }
    }
  }

  const schedule = (request: SkillsAreaReloadRequest) => {
    if (!options.canReload()) return
    pending = mergeSkillsAreaReloadRequest(pending, request)
    kickDrain()
  }

  const cancel = () => {
    pending = null
    drainEpoch += 1
    cancelSkillsAreaLayoutTasks()
  }

  return { schedule, cancel }
}
