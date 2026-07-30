/** 会话内：WebGPU 推理失败后不再尝试 GPU，避免反复刷 validation error */
let mattingGpuSessionBlocked = false

let mattingWebGpuBasicProbe: Promise<boolean> | null = null

const MATTING_GPU_FAILURE_PATTERN =
  /webgpu|computepipeline|bindgroup(layout)?|validations?\s+error|wgsl|shadermodule|onnxruntime.*webgpu|invalid\s+shader/i

export const isMattingGpuFailureMessage = (message: string) =>
  MATTING_GPU_FAILURE_PATTERN.test(message)

export const isMattingGpuSessionBlocked = () => mattingGpuSessionBlocked

export const markMattingGpuUnavailable = (reason?: unknown) => {
  mattingGpuSessionBlocked = true
  if (reason !== undefined) {
    console.warn('[matting] WebGPU 不可用，已切换为 CPU 推理', reason)
  }
}

type NavigatorWithGpu = Navigator & {
  gpu?: {
    requestAdapter: (options?: {
      powerPreference?: 'low-power' | 'high-performance'
    }) => Promise<{
      requestDevice: () => Promise<{ destroy: () => void }>
    } | null>
  }
}

/** 基础 WebGPU 能力探测（无法覆盖 ONNX 算子兼容，仅过滤明显不可用环境） */
export const probeMattingWebGpuBasic = async (): Promise<boolean> => {
  if (mattingGpuSessionBlocked) return false
  if (typeof navigator === 'undefined') return false
  const gpu = (navigator as NavigatorWithGpu).gpu
  if (!gpu) return false

  if (!mattingWebGpuBasicProbe) {
    mattingWebGpuBasicProbe = (async () => {
      try {
        const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
        if (!adapter) return false
        const device = await adapter.requestDevice()
        device.destroy()
        return true
      } catch {
        return false
      }
    })()
  }
  return mattingWebGpuBasicProbe
}

type MattingGpuWatchSuccess<T> = {
  ok: true
  result: T
  webgpuErrors: string[]
}

type MattingGpuWatchFailure = {
  ok: false
  error: unknown
  webgpuErrors: string[]
}

/**
 * imgly / ONNX WebGPU 常只向 console 打 validation error 而不 reject Promise。
 * 推理期间临时监听 console，供后续 CPU 回退判定。
 */
export const runWithMattingGpuErrorWatch = async <T>(
  run: () => Promise<T>,
): Promise<MattingGpuWatchSuccess<T> | MattingGpuWatchFailure> => {
  const webgpuErrors: string[] = []
  const capture = (args: unknown[]) => {
    const msg = args
      .map((item) => {
        if (item instanceof Error) return item.message
        if (typeof item === 'string') return item
        try {
          return JSON.stringify(item)
        } catch {
          return String(item)
        }
      })
      .join(' ')
    if (isMattingGpuFailureMessage(msg)) {
      webgpuErrors.push(msg)
    }
  }

  const origError = console.error
  const origWarn = console.warn
  console.error = (...args: unknown[]) => {
    capture(args)
    origError.apply(console, args as Parameters<typeof console.error>)
  }
  console.warn = (...args: unknown[]) => {
    capture(args)
    origWarn.apply(console, args as Parameters<typeof console.warn>)
  }

  try {
    const result = await run()
    return { ok: true, result, webgpuErrors }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isMattingGpuFailureMessage(message)) {
      webgpuErrors.push(message)
    }
    return { ok: false, error, webgpuErrors }
  } finally {
    console.error = origError
    console.warn = origWarn
  }
}

export const shouldFallbackMattingToCpu = (
  device: 'cpu' | 'gpu',
  error: unknown | undefined,
  webgpuErrors: string[],
) => {
  if (device !== 'gpu') return false
  if (webgpuErrors.length > 0) return true
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  if (/invalid base url|publicpath|resource/i.test(message)) return false
  return true
}
