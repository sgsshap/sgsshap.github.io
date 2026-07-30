export type OutOfFrameBrushShape = 'round' | 'soft' | 'square'

export type OutOfFrameBrushPaintMode = 'erase' | 'restore'

export type OutOfFrameBrushStampOptions = {
  shape: OutOfFrameBrushShape
  mode: OutOfFrameBrushPaintMode
  /** 软边笔刷：0–100，越高中心越实 */
  hardness?: number
  /** 笔刷不透明度 0–1 */
  opacity?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const resolveStampColor = (
  mode: OutOfFrameBrushPaintMode,
  alpha: number,
  opacity = 1,
) => {
  const a = clamp(alpha, 0, 1) * clamp(opacity, 0, 1)
  if (mode === 'erase') {
    return `rgba(0,0,0,${a})`
  }
  return `rgba(255,255,255,${a})`
}

const paintRoundStamp = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  mode: OutOfFrameBrushPaintMode,
  opacity = 1,
) => {
  ctx.fillStyle = resolveStampColor(mode, 1, opacity)
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

const paintSquareStamp = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  mode: OutOfFrameBrushPaintMode,
  opacity = 1,
) => {
  ctx.fillStyle = resolveStampColor(mode, 1, opacity)
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

const paintSoftStamp = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  mode: OutOfFrameBrushPaintMode,
  hardness: number,
  opacity = 1,
) => {
  const hard = clamp(hardness, 0, 100) / 100
  const coreStop = clamp(hard * 0.88, 0.08, 0.96)
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, resolveStampColor(mode, 1, opacity))
  gradient.addColorStop(coreStop, resolveStampColor(mode, 1, opacity))
  gradient.addColorStop(1, resolveStampColor(mode, 0, opacity))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

/** 在蒙版上盖一个笔刷印记 */
export const paintOutOfFrameBrushStamp = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  options: OutOfFrameBrushStampOptions,
) => {
  if (radius <= 0) return
  const opacity = options.opacity ?? 1
  if (options.shape === 'square') {
    paintSquareStamp(ctx, x, y, radius, options.mode, opacity)
    return
  }
  if (options.shape === 'soft') {
    paintSoftStamp(ctx, x, y, radius, options.mode, options.hardness ?? 85, opacity)
    return
  }
  paintRoundStamp(ctx, x, y, radius, options.mode, opacity)
}

const stampStep = (radius: number, shape: OutOfFrameBrushShape) => {
  const base = Math.max(1, radius * 0.55)
  return shape === 'soft' ? base * 0.65 : base
}

/** 两点间补笔刷轨迹（软边/方形用密集 stamp，圆形用粗描边） */
export const paintOutOfFrameBrushSegment = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  options: OutOfFrameBrushStampOptions,
) => {
  if (radius <= 0) return
  const dist = Math.hypot(x1 - x0, y1 - y0)
  if (dist <= 0.001) {
    paintOutOfFrameBrushStamp(ctx, x1, y1, radius, options)
    return
  }

  const opacity = options.opacity ?? 1

  if (options.shape === 'round') {
    ctx.lineWidth = radius * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = resolveStampColor(options.mode, 1, opacity)
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    return
  }

  const step = stampStep(radius, options.shape)
  const steps = Math.max(1, Math.ceil(dist / step))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    paintOutOfFrameBrushStamp(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, options)
  }
}

export const OUT_OF_FRAME_BRUSH_SHAPE_OPTIONS: ReadonlyArray<{
  value: OutOfFrameBrushShape
  label: string
}> = [
  { value: 'round', label: '圆形' },
  { value: 'soft', label: '软边' },
  { value: 'square', label: '方形' },
]
