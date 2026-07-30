export type MattingProgress = {
  step: number
  totalSteps: number
  title: string
  detail?: string
  percent: number
}

/** 将步骤与子进度合成为 0–100 的整体百分比 */
export const buildMattingProgress = (
  step: number,
  totalSteps: number,
  title: string,
  options?: { detail?: string; stepRatio?: number },
): MattingProgress => {
  const ratio = Math.max(0, Math.min(1, options?.stepRatio ?? 0.4))
  const percent = Math.min(100, Math.round(((step - 1) + ratio) / totalSteps * 100))
  return {
    step,
    totalSteps,
    title,
    detail: options?.detail,
    percent,
  }
}
