import type { BaseRenderConfig, DiyCardInfoBase, LayoutItem } from './base'

/**
 * 标记模板完整类型定义
 */
// ======================
// 基础标记信息（纯内容数据）
// ======================
export interface BaseMarkInfo {
  name: string // 名称
}

// ======================
// 渲染配置
// ======================
export interface MarkRenderConfig extends BaseRenderConfig {
  // === 全局图像设置 ===

  // === 各 UI 组件的布局与样式（每个都继承 LayoutItem）===
  items: {
    demo: LayoutItem
  }
}

// ======================
// 最终模板根结构
// ======================
export interface MarkInfo extends DiyCardInfoBase<BaseMarkInfo, MarkRenderConfig> {}

/**
 * 默认的配置工厂
 */
export const createDefaultRenderConfig = (): MarkRenderConfig => {
  return {
    customImage: {
      defaultScale: 50,
    },
    watermark: {
      showFlag: true,
      username: '',
    },
    items: createDefaultItemsConfig(),
  }
}

/**
 * 默认的布局配置工厂
 */
const createDefaultItemsConfig = (): MarkRenderConfig['items'] => {
  const baseItem: LayoutItem = {
    code: '',
    name: 'unknown',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    scale: 1,
    order: 99,
    rotation: 0,
    editable: {
      selectable: false,
      movable: false,
      rotatable: false,
      scalable: false,
    },
  }

  return {
    demo: {
      ...baseItem,
      code: 'demo',
    },
  }
}
