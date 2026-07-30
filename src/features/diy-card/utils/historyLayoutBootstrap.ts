import type { DiyInfoKind } from '@/features/diy-card/types/diy/history'

type HistoryBootstrapContext = {
  bootstrappedKinds: Partial<Record<DiyInfoKind, boolean>>
  activeInfoKind: DiyInfoKind
  canvasBootstrapPending: boolean
}

/** 首屏从 IndexedDB 恢复历史后的 loadAll：layout 以快照为准，禁止 preset / stale 判定重置 */
export const shouldTrustHistorySnapshotLayout = (ctx: HistoryBootstrapContext) =>
  Boolean(ctx.bootstrappedKinds[ctx.activeInfoKind]) && ctx.canvasBootstrapPending
