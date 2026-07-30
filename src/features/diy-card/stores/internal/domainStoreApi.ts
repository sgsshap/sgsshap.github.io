import type { DiyCardInfoBase } from '@/features/diy-card/types/diy/base'

/** 各牌种 domain store 内部统一的 info 读写 API */
export interface DiyDomainStoreApi<T extends DiyCardInfoBase = DiyCardInfoBase> {
  info: T
  /** 该牌种数据绑定的模板 name（快照 / 存档用） */
  templateName: string
  setTemplateName(name: string): void
  baseInfo: T['baseInfo']
  renderConfig: T['renderConfig']
  customMaterialList: T['customMaterialList']
  toInfoSnapshot(): T
  applyInfo(next: T): void
}
