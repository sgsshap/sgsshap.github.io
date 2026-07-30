import {
  isPackageTextBadgeKind,
  resolvePackageTextBadgeTextDefaults,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/package'

/** 角标预设 key（角标库 / 自定义图片 / 两种自定义文字标） */
export type PackageIdentifyName =
  | '0'
  | 'user-select'
  | 'user-defined'
  | 'text_ccxh'
  | 'blood_point'
  | 'text_10th'

/** 配置面板折叠区标题（首页 / 详细设置统一） */
export const PACKAGE_IDENTIFY_CONFIG_TITLE = '角标'

export interface PackageIdentify {
  name: PackageIdentifyName | string
  pic: string
  textFlag: boolean
  maxLength: number
  text: string
}

export interface PackageIdentifyPreset {
  name: PackageIdentifyName
  label: string
  pic: string
  textFlag?: boolean
  maxLength?: number
  defaultText?: string
}

export const PACKAGE_IDENTIFY_PRESETS: readonly PackageIdentifyPreset[] = [
  { name: '0', label: '无', pic: '' },
  { name: 'user-select', label: '角标库', pic: '' },
  { name: 'user-defined', label: '自定义图片', pic: '' },
  {
    name: 'text_ccxh',
    label: '【自定义文字】璀璨星河',
    pic: '',
    textFlag: true,
  },
  {
    name: 'blood_point',
    label: '【自定义文字】血点标',
    pic: '',
    textFlag: true,
  },
  {
    name: 'text_10th',
    label: '【自定义文字】十周年圆标',
    pic: '',
    textFlag: true,
  },
]

export const createDefaultPackageIdentify = (): PackageIdentify => ({
  name: '0',
  pic: '',
  textFlag: false,
  maxLength: 1,
  text: '',
})

export const resolvePackageIdentifyPreset = (name: string): PackageIdentify => {
  const preset = PACKAGE_IDENTIFY_PRESETS.find((item) => item.name === name)
  if (!preset) return createDefaultPackageIdentify()

  const textBadgeDefaults = isPackageTextBadgeKind(preset.name)
    ? resolvePackageTextBadgeTextDefaults(preset.name)
    : undefined

  return {
    name: preset.name,
    pic: preset.pic,
    textFlag: Boolean(preset.textFlag),
    maxLength: textBadgeDefaults?.maxLength ?? preset.maxLength ?? 1,
    text: textBadgeDefaults?.defaultText ?? preset.defaultText ?? '',
  }
}

export const isPackageIdentifyActive = (identify: PackageIdentify) =>
  identify.name !== '0' && identify.name !== ''

/** 从站内角标素材库选取（与自定义图片共用 pic 渲染逻辑） */
export const isPackageLibraryKind = (name: string) => name === 'user-select'

/** 本地上传自定义角标图 */
export const isPackageUploadImageKind = (name: string) => name === 'user-defined'

/** 远程/自定义图片角标（角标库或本地上传） */
export const isPackageRemoteImageKind = (name: string) =>
  isPackageLibraryKind(name) || isPackageUploadImageKind(name)
