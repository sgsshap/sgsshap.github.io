import type Konva from 'konva'
import type { LineCap, LineJoin } from 'konva/lib/Shape'

export interface CanvasItemConfig {
  // 基础标识
  code: string
  name: string
  loadFunc?: () => void // 用于 reloadMaterial
  children?: CanvasItemConfig[]

  // 布局
  x?: number
  y?: number
  originX?: number // 对应代码中的 originX/Y 计算
  originY?: number
  offsetX?: number
  offsetY?: number
  width?: number
  height?: number
  /** Konva 裁剪区域（相对 group 本地坐标），用于拆分单字避免描边在字缝叠亮 */
  clip?: { x: number; y: number; width: number; height: number }
  clipFunc?: (ctx: CanvasRenderingContext2D) => void
  rotation?: number
  scaleX?: number
  scaleY?: number
  skewX?: number

  // 图片（Canvas 用于出框合成等免 PNG 往返场景）
  image?: HTMLImageElement | HTMLCanvasElement
  /** 出框/原画缩放时按此原图比例推导显示高度（Canvas 合成图无 naturalWidth 时） */
  sourceNaturalWidth?: number
  sourceNaturalHeight?: number
  crop?: { x: number; y: number; width: number; height: number }
  filters?: ((imageData: ImageData) => void)[]
  /** 无 RGB 的像素滤镜 cache 签名（如角标双色渐变底图） */
  filterCacheSignature?: string
  brightness?: number
  red?: number
  green?: number
  blue?: number

  // 文本
  text?: string
  fontSize?: number
  fontFamily?: string
  fill?: string
  /** Konva 10：须为 linear-gradient 才会绘制 fillLinearGradientColorStops */
  fillPriority?: 'color' | 'linear-gradient' | 'radial-gradient' | 'pattern'
  fillLinearGradientStartPoint?: { x: number; y: number }
  fillLinearGradientEndPoint?: { x: number; y: number }
  fillLinearGradientColorStops?: (number | string)[]
  lineHeight?: number
  align?: string
  verticalAlign?: string
  fontStyle?: string
  textDecoration?: string
  letterSpacing?: number
  wrap?: string
  perfectDrawEnabled?: boolean
  fillAfterStrokeEnabled?: boolean
  lineJoin?: LineJoin
  lineCap?: LineCap

  // 其他样式
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowOpacity?: number
  shadowEnabled?: boolean
  stroke?: string
  strokeLinearGradientStartPoint?: { x: number; y: number }
  strokeLinearGradientEndPoint?: { x: number; y: number }
  strokeLinearGradientColorStops?: (number | string)[]
  strokeWidth?: number
  cornerRadius?: number
  opacity?: number
  globalCompositeOperation?: GlobalCompositeOperation

  // 交互（Konva Node）
  listening?: boolean
  draggable?: boolean
  onDragstart?: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragend?: (e: Konva.KonvaEventObject<DragEvent>) => void
  onClick?: (e: Konva.KonvaEventObject<MouseEvent>) => void
}
