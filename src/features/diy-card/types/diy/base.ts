// ======================
// 通用类型
// ======================
export interface BaseSkill {
  name: string
  desc?: string
}

// ======================
// 通用布局项（含几何属性 + 交互权限）
// ======================
export interface LayoutItem {
  code: string // 元素代码
  name: string // 元素名称
  x: number // 左上角 X 坐标
  y: number // 左上角 Y 坐标
  width: number // 宽度
  height: number // 高度
  scale: number // 缩放比例（1.0 为原始大小）
  rotation: number // 旋转角度（单位：度）
  size?: number // 字体大小（仅文本类元素使用，可选）
  order: number // 排序序号
  /** 拆分武将名单字：字形视觉中心（mm，相对画布内容区），字号变化时据此重算包围盒 */
  anchorCenterX?: number
  anchorCenterY?: number

  /**
   * 交互权限控制（全部可选，默认为 true）
   */
  editable?: {
    selectable?: boolean // 是否允许被选中
    movable?: boolean // 是否允许移动
    scalable?: boolean // 是否允许缩放
    rotatable?: boolean // 是否允许旋转
    /** 拖拽时自动吸附画布边缘，并显示参考线 */
    snapToStageEdge?: boolean
  }
}

// ======================
// 自定义素材（用户上传的图片）
// ======================
export interface CustomMaterial extends LayoutItem {
  id: string
  name: string
  data: string // base64 字符串 或 路径
}

export interface BaseRenderConfig {
  // === 全局图像设置 ===
  customImage: {
    defaultScale: number // 默认素材缩放
  }

  // === 水印配置 ===
  watermark: {
    showFlag: boolean
    username: string
  }
}

/** 各牌种 info 的公共根结构 */
export interface DiyCardInfoBase<
  TBaseInfo = unknown,
  TRenderConfig extends BaseRenderConfig = BaseRenderConfig,
> {
  template: { name: string }
  baseInfo: TBaseInfo
  renderConfig: TRenderConfig
  customMaterialList: CustomMaterial[]
}
