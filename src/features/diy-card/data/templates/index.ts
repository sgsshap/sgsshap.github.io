import { createTemplateInfo } from '@/features/diy-card/types/template'

const newUiZhuoyue = createTemplateInfo(
  'legend',
  'new_ui_zhuoyue',
  '新UI',
  '“高度还原官方模板”',
  '武将自印、武将DIY',
  [
    { name: '卓越成长', contact: '百度贴吧：卓越成长' },
    { name: '大湿我悟了', contact: '' },
    { name: 'zyydi', contact: '百度贴吧：zyydi' },
  ],
  '{templateName}.{code}.{title}.{name}',
)

const demoGame = createTemplateInfo(
  'game',
  'demo_game',
  '测试游戏牌',
  '“用于验证游戏牌画布与操作历史”',
  '游戏牌自印、历史记录测试',
  [{ name: '卓越成长', contact: '' }],
  '{templateName}.{name}',
  { width: 63, height: 88 },
)

const defaultKingdom = {
  label: '势力',
  value: ['wei', 'shu', 'wu', 'qun', 'jin', 'shen'],
}

const derivedSkill = {
  label: '衍生技',
  value: true,
}

const invertDoubleKingdom = {
  label: '双势力',
  value: true,
  numValue: 2,
}

const customKingdomName = {
  label: '自定义势力字',
  value: true,
  numValue: 2,
}

const customKingdomColor = {
  label: '自定义势力色',
  value: true,
}

const maxHpDisplayNum = {
  label: '最大体力',
  numValue: 12,
  showFlag: false,
}

newUiZhuoyue.config = {
  kingdoms: defaultKingdom,
  derivedSkill: derivedSkill,
  doubleKingdom: invertDoubleKingdom,
  customKingdomName: customKingdomName,
  customKingdomColor: customKingdomColor,
  maxHpDisplayNum: maxHpDisplayNum,
}

export const templates = [newUiZhuoyue, demoGame]
