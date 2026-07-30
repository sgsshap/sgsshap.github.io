import type { useDiyStore } from '@/features/diy-card/stores'

type DiyStore = ReturnType<typeof useDiyStore>

export type SkillsAreaLayoutTaskOptions = {
  diyStore?: DiyStore
  /** 保留字段；加载文案由图层内 runWithLoading 入栈，不再写 bootstrap hint */
  label?: string
}

/** 技能区布局任务串行，避免首屏 skillsDesc / skillsName / bottomInfo 并行测高竞态 */
let skillsAreaTaskChain: Promise<void> = Promise.resolve()

/**
 * 取消 epoch：递增后队列中尚未执行的任务会被跳过。
 * 用于 debounce 取消 / 配置连变，不应在每次入队时递增（否则并行入队的串行任务会被误杀）。
 */
let skillsAreaLayoutEpoch = 0

export const cancelSkillsAreaLayoutTasks = () => {
  skillsAreaLayoutEpoch += 1
  skillsAreaTaskChain = Promise.resolve()
}

export const runSkillsAreaLayoutTask = <T>(
  task: () => Promise<T> | T,
  _options?: SkillsAreaLayoutTaskOptions,
): Promise<T> => {
  const epoch = skillsAreaLayoutEpoch
  const run = async (): Promise<T | undefined> => {
    if (epoch !== skillsAreaLayoutEpoch) return undefined
    const result = await task()
    if (epoch !== skillsAreaLayoutEpoch) return undefined
    return result
  }
  const result = skillsAreaTaskChain.then(run, run) as Promise<T>
  skillsAreaTaskChain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
