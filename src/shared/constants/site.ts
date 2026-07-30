/** JxShap 公测访问地址 */
export const JXSHAP_PUBLIC_URL = 'http://www.sgsshap.cn:8200/'

/** 经典版 sgs-shap 制图站点 */
export const LEGACY_SGS_SHAP_URL = 'http://www.sgsshap.cn:8000/#/home'

/** 新网站 BUG 反馈表（腾讯文档） */
export const BUG_FEEDBACK_SHEET_URL =
  'https://docs.qq.com/sheet/DTkhGVE5wS1hSRVRk?tab=000001'

/** 新网站建议收集表（腾讯文档） */
export const SUGGESTION_FEEDBACK_SHEET_URL =
  'https://docs.qq.com/sheet/DTkhHa3d4dGVodFBj?tab=000001'

/** JxShap 2.0 制图教学视频（B 站） */
export const DIY_TUTORIAL_VIDEO_URL = 'https://www.bilibili.com/video/BV14Bj26DE8u/'

/** DIY 页教学视频横幅文案 */
export const DIY_TUTORIAL_BANNER_TITLE = 'B 站教学视频'
export const DIY_TUTORIAL_BANNER_DESC = '首次制图？来看详细网站教学视频！'

/** DIY 页教学视频横幅：用户关闭后不再显示 */
export const DIY_TUTORIAL_BANNER_DISMISSED_KEY = 'shap2-diy-tutorial-banner-dismissed'

export const isDiyTutorialBannerDismissed = (): boolean => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(DIY_TUTORIAL_BANNER_DISMISSED_KEY) === '1'
}

export const dismissDiyTutorialBanner = (): void => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DIY_TUTORIAL_BANNER_DISMISSED_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

export const openDiyTutorialVideo = () => {
  window.open(DIY_TUTORIAL_VIDEO_URL, '_blank', 'noopener,noreferrer')
}

/** 用户选择留在测试站后，本会话不再弹出测试版提示 */
export const BETA_NOTICE_STAYED_SESSION_KEY = 'shap2_beta_notice_stayed'
