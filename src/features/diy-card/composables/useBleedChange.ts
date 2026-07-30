import { resolveLegendImageReflowChoice } from '@/features/diy-card/composables/legendImageCoverReflowPrompt'
import { useDiyStore, useInfoStore, useTemplateStore } from '@/features/diy-card/stores'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import type { useDialog } from 'naive-ui'

export const useBleedChange = (dialog: ReturnType<typeof useDialog>) => {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const templateStore = useTemplateStore()

  const changeBleedFlag = async (flag: boolean): Promise<'applied' | 'cancelled'> => {
    if (flag === diyStore.bleedFlag) return 'applied'

    const legend = infoStore.info as LegendInfo
    const reflow = await resolveLegendImageReflowChoice(dialog, Boolean(legend.baseInfo.pic?.trim()))
    if (reflow === null) return 'cancelled'

    diyStore.scheduleLegendImageReflow(reflow)
    diyStore.applyBleedState({
      bleedFlag: flag,
      bleedValue: flag ? templateStore.currentTemplate.bleed : undefined,
    })
    return 'applied'
  }

  const changeBleedValue = async (value: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    if (!diyStore.bleedFlag || value === diyStore.bleedValue) return

    const legend = infoStore.info as LegendInfo
    const reflow = await resolveLegendImageReflowChoice(dialog, Boolean(legend.baseInfo.pic?.trim()))
    if (reflow === null) return

    diyStore.scheduleLegendImageReflow(reflow)
    diyStore.applyBleedState({ bleedValue: value })
  }

  return {
    changeBleedFlag,
    changeBleedValue,
  }
}
