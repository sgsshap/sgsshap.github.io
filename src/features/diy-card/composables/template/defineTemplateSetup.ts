import type { TemplateSetup } from './types'

/**
 * 声明并校验模板配置
 *
 * 在复制新模板时，将 `setup.ts` 中的配置对象包一层本函数，可在开发阶段尽早发现：
 * - 图层 `code` / `refKey` 重复
 *
 * @param setup 模板差异配置（图层表）
 * @returns 通过校验的同一对象（便于推断字面量类型）
 */
export function defineTemplateSetup<const S extends TemplateSetup>(setup: S): S {
  const codes = new Set<string>()
  const refKeys = new Set<string>()
  for (const layer of setup.layers) {
    if (codes.has(layer.code)) {
      throw new Error(`[template setup] 图层 code 重复: ${layer.code}`)
    }
    if (refKeys.has(layer.refKey)) {
      throw new Error(`[template setup] refKey 重复: ${layer.refKey}`)
    }
    codes.add(layer.code)
    refKeys.add(layer.refKey)
  }
  return setup
}
