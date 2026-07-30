import { useInfoStore } from '@/features/diy-card/stores'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'

/**
 * 每次属性访问都读 infoStore.info，避免 reset / 撤销 替换 baseInfo 后模板仍持有旧快照。
 */
export function createLiveDiyInfo(): LegendInfo {
  const infoStore = useInfoStore()
  return new Proxy({} as LegendInfo, {
    get(_target, prop) {
      return (infoStore.info as LegendInfo)[prop as keyof LegendInfo]
    },
  })
}
