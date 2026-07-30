const INITIAL_CHECK_MS = 10_000
const DISMISS_CHECK_MS = 600_000

/** 与旧站一致：仅对比 index.html 中带 hash 的 /assets/*.js */
const SCRIPT_SRC_REG = /<script\b[^>]*\bsrc=["']([^"']+)["']/gi

const normalizeAssetPath = (ref: string): string => {
  const raw = ref.trim()
  if (!raw) return raw
  try {
    return new URL(raw, globalThis.location.href).pathname
  } catch {
    return raw.split('?')[0]?.split('#')[0] ?? raw
  }
}

const isBuildScriptSrc = (src: string) => normalizeAssetPath(src).includes('/assets/')

const parseBuildScriptsFromHtml = (html: string): string[] => {
  const assets = new Set<string>()
  SCRIPT_SRC_REG.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = SCRIPT_SRC_REG.exec(html))) {
    const src = match[1]
    if (src && isBuildScriptSrc(src)) {
      assets.add(normalizeAssetPath(src))
    }
  }

  return [...assets].sort()
}

const parseBuildScriptsFromDocument = () =>
  parseBuildScriptsFromHtml(document.documentElement.outerHTML)

const fingerprint = (refs: string[]) => refs.join('\n')

const resolveIndexHtmlUrl = () =>
  new URL(`${import.meta.env.BASE_URL}index.html`, globalThis.location.origin).href

export type AppAutoUpdateHandlers = {
  confirmUpdate: () => Promise<boolean>
}

/** 定时拉取 index.html，对比 /assets 脚本指纹；有更新则回调 confirmUpdate */
export const startAppAutoUpdate = (handlers: AppAutoUpdateHandlers) => {
  if (import.meta.env.DEV) {
    return () => {}
  }

  let intervalMs = INITIAL_CHECK_MS
  let timerId: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  let prompting = false

  const localScripts = parseBuildScriptsFromDocument()
  let baseline = localScripts.length ? fingerprint(localScripts) : null

  const schedule = () => {
    if (disposed) return
    timerId = globalThis.setTimeout(() => {
      void (async () => {
        await tick()
        schedule()
      })()
    }, intervalMs)
  }

  const tick = async () => {
    if (disposed) return

    let remoteFingerprint = ''
    try {
      const indexUrl = resolveIndexHtmlUrl()
      const response = await fetch(`${indexUrl}?_=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) return

      const html = await response.text()
      const remoteScripts = parseBuildScriptsFromHtml(html)
      if (!remoteScripts.length) return

      remoteFingerprint = fingerprint(remoteScripts)
    } catch {
      return
    }

    if (baseline === null) {
      baseline = remoteFingerprint
      return
    }

    if (baseline === remoteFingerprint || prompting) {
      baseline = remoteFingerprint
      return
    }

    prompting = true
    try {
      const shouldReload = await handlers.confirmUpdate()
      baseline = remoteFingerprint
      if (shouldReload) {
        globalThis.location.reload()
        return
      }
      intervalMs = DISMISS_CHECK_MS
    } finally {
      prompting = false
    }
  }

  schedule()

  return () => {
    disposed = true
    if (timerId !== null) {
      globalThis.clearTimeout(timerId)
      timerId = null
    }
  }
}
