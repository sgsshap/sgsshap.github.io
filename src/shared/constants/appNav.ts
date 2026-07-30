import {
  HomeRound,
  MenuBookRound,
  PaletteRound,
  SettingsRound,
  VolunteerActivismRound,
} from '@/shared/icons'
import type { Component } from 'vue'

export interface AppNavItem {
  key: string
  label: string
  path: string
  icon: Component
}

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  { key: 'home', label: '首页', path: '/home', icon: HomeRound },
  { key: 'diy', label: '在线制图', path: '/diy', icon: PaletteRound },
  { key: 'wiki', label: '三杀百科', path: '/wiki', icon: MenuBookRound },
  { key: 'settings', label: '系统设置', path: '/settings', icon: SettingsRound },
] as const

/** PC 侧栏二级入口（不进移动端 tabbar） */
export const APP_SECONDARY_NAV_ITEMS: readonly AppNavItem[] = [
  { key: 'donation', label: '支持项目', path: '/donation', icon: VolunteerActivismRound },
] as const

export const findAppNavItem = (key: string): AppNavItem | undefined =>
  APP_NAV_ITEMS.find((item) => item.key === key)
  ?? APP_SECONDARY_NAV_ITEMS.find((item) => item.key === key)
