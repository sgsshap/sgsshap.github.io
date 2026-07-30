import { resolveLegendImageReflowChoice } from '@/features/diy-card/composables/legendImageCoverReflowPrompt'
import { useDiyStore, useInfoStore } from '@/features/diy-card/stores'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { applyFieldChange } from '@/features/diy-card/utils/diyHistoryField'
import type { useDialog } from 'naive-ui'

export const useFullModeChange = (dialog: ReturnType<typeof useDialog>) => {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()

  const changeFullModeFlag = async (flag: boolean) => {
    const legend = infoStore.info as LegendInfo
    if (flag === legend.renderConfig.display.fullModeFlag) return

    const reflow = await resolveLegendImageReflowChoice(dialog, Boolean(legend.baseInfo.pic?.trim()))
    if (reflow === null) return

    diyStore.scheduleLegendImageReflow(reflow)
    applyFieldChange(
      '全幅模式',
      legend.renderConfig.display.fullModeFlag,
      flag,
      (val) => {
        legend.renderConfig.display.fullModeFlag = val
      },
      { category: 'renderConfig', format: 'bool' },
    )
  }

  return { changeFullModeFlag }
}
