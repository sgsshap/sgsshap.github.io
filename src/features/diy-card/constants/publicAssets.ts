import { PUBLIC_BASE_URL } from '@/shared/constants/env'

/** Vite `public/diy/` 制图域静态资源（Konva 相对 public 根的路径前缀）。目录说明见 docs/diy-card/public-assets.md */
export const DIY_PUBLIC_ROOT = `${PUBLIC_BASE_URL}diy`

/** 跨模板共享素材：public/diy/shared/ */
export const DIY_PUBLIC_ASSET_BASE = `${DIY_PUBLIC_ROOT}/shared`

/** 按模板分的皮肤包：public/diy/templates/ */
export const DIY_TEMPLATE_ROOT = `${DIY_PUBLIC_ROOT}/templates`

/** 制图 Web 字体目录 segment：public/diy/fonts/ */
export const DIY_FONTS_SEGMENT = 'diy/fonts'

/** 智能抠图模型目录 segment：public/diy/matting-models/ */
export const DIY_MATTING_MODELS_SEGMENT = 'diy/matting-models'

export const resolvePublicAssetSrc = (...segments: string[]) =>
  `${DIY_PUBLIC_ASSET_BASE}/${segments.filter(Boolean).join('/')}`

export const resolveTemplateAssetBase = (templateDir: string) =>
  `${DIY_TEMPLATE_ROOT}/${templateDir}`
