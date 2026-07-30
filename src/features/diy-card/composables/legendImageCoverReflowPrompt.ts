import type { useDialog } from 'naive-ui'

export type LegendImageCoverReflowDecision = 'reflow' | 'keep' | 'cancel'

/** 原画显示区域变化时，询问是否按新区域 cover 重铺 */
export const promptLegendImageCoverReflow = (dialog: ReturnType<typeof useDialog>) =>
  new Promise<LegendImageCoverReflowDecision>((resolve) => {
    let settled = false
    const finish = (value: LegendImageCoverReflowDecision) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    dialog.warning({
      title: '重新铺满原画？',
      content: '原画显示区域已改变，可能出现未铺满的情况。是否重新自动铺满原画？',
      positiveText: '重新铺满',
      negativeText: '保持当前位置',
      draggable: true,
      maskClosable: false,
      onPositiveClick: () => {
        finish('reflow')
        return true
      },
      onNegativeClick: () => {
        finish('keep')
        return true
      },
      onClose: () => {
        finish('cancel')
      },
    })
  })

/** 有武将图时弹窗；无图则静默不重铺。返回 null 表示用户取消变更 */
export const resolveLegendImageReflowChoice = async (
  dialog: ReturnType<typeof useDialog>,
  hasPic: boolean,
): Promise<boolean | null> => {
  if (!hasPic) return false
  const decision = await promptLegendImageCoverReflow(dialog)
  if (decision === 'cancel') return null
  return decision === 'reflow'
}
