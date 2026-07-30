import { type TemplateEmit, type TemplateProps, useDiyTemplate } from '@/features/diy-card/composables/template'
import { templateSetup } from './setup'
import { setupTemplateWatches } from './watches'

/** 模板入口：逻辑在 @/features/diy-card/composables/template，本文件绑定 setup + watches */
export function useTemplate(props: TemplateProps, emit: TemplateEmit) {
  return useDiyTemplate(props, emit, templateSetup, setupTemplateWatches)
}
