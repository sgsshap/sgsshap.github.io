import {
  SKILL_DESC_SHEN_BG_FILL_RGB,
  SKILL_DESC_SHEN_BG_SLICE_BOTTOM_PX,
  SKILL_DESC_SHEN_BG_SLICE_LEFT_PX,
  SKILL_DESC_SHEN_BG_SLICE_RIGHT_PX,
  SKILL_DESC_SHEN_BG_SLICE_TOP_PX,
} from '../../constants/skills'

/** shen.svg 设计稿 viewBox 宽 */
export const SHEN_SKILL_DESC_BG_SRC_WIDTH = 956
/** shen.svg 设计稿 viewBox 高 */
export const SHEN_SKILL_DESC_BG_SRC_HEIGHT = 329

/** 与 public/.../skill-desc/shen.svg 中 path 一致 */
const SHEN_FRAME_PATH =
  'M24.659,0 C326.856,0 629.144,0 931.341,0 C931.341,8.222 931.341,11.447 931.341,19.67 C939.56,19.67 947.781,19.67 955,19.67 C955,113.282 955,206.922 955,300.534 C947.781,300.534 939.56,300.534 931.341,300.534 C931.341,310.021 931.341,319.512 931.341,328 C629.144,328 326.856,328 24.659,328 C24.659,319.512 24.659,310.021 24.659,300.534 C16.44,300.534 8.219,300.534 0,300.534 C0,206.922 0,113.282 0,19.67 C8.219,19.67 16.44,19.67 24.659,19.67 C24.659,11.447 24.659,8.222 24.659,0 ZM28.452,3.795 C28.452,12.018 28.452,15.243 28.452,23.465 C20.234,23.465 12.012,23.465 3.794,23.465 C3.794,114.547 3.794,205.656 3.794,296.738 C12.012,296.738 20.234,296.738 28.452,296.738 C28.452,306.226 28.452,315.716 28.452,325.204 C328.121,325.204 627.879,325.204 927.547,325.204 C927.547,315.716 927.547,306.226 927.547,296.738 C935.766,296.738 943.988,296.738 952.206,296.738 C952.206,205.656 952.206,114.547 952.206,23.465 C943.988,23.465 935.766,23.465 927.547,23.465 C927.547,15.243 927.547,12.018 927.547,3.795 C627.879,3.795 328.121,3.795 28.452,3.795 ZM32.936,8.284 C326.283,8.284 629.717,8.284 923.063,8.284 C923.063,16.506 923.063,19.731 923.063,27.954 C931.282,27.954 939.503,27.954 947.722,27.954 C947.722,112.711 947.722,207.493 947.722,292.25 C939.503,292.25 931.282,292.25 923.063,292.25 C923.063,301.737 923.063,311.228 923.063,320.716 C629.717,320.716 326.283,320.716 32.936,320.716 C32.936,311.228 32.936,301.737 32.936,292.25 C24.718,292.25 16.496,292.25 8.278,292.25 C8.278,207.493 8.278,112.711 8.278,27.954 C16.496,27.954 24.718,27.954 32.936,27.954 C32.936,19.731 32.936,16.506 32.936,8.284 Z'

const SHEN_FRAME_FILL = `rgb(${SKILL_DESC_SHEN_BG_FILL_RGB.join(', ')})`

const CMD_ARG_COUNT: Record<string, number> = {
  M: 2,
  L: 2,
  C: 6,
  Z: 0,
}

const snapPx = (value: number) => Math.round(value)

const formatNum = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

/** 对设计稿 path 做九宫格坐标映射：四角固定，中间随 w/h 拉伸（单 path，无分块接缝） */
const warpShenFramePath = (width: number, height: number): string => {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const srcW = SHEN_SKILL_DESC_BG_SRC_WIDTH
  const srcH = SHEN_SKILL_DESC_BG_SRC_HEIGHT

  const capL = SKILL_DESC_SHEN_BG_SLICE_LEFT_PX
  const capR = SKILL_DESC_SHEN_BG_SLICE_RIGHT_PX
  const capT = SKILL_DESC_SHEN_BG_SLICE_TOP_PX
  const capB = SKILL_DESC_SHEN_BG_SLICE_BOTTOM_PX

  const sx = w / srcW
  const capLeft = capL * sx
  const capRight = capR * sx
  const capTop = capT * sx
  const capBottom = capB * sx
  const midW = Math.max(0, w - capLeft - capRight)
  const midH = Math.max(0, h - capTop - capBottom)
  const midSrcW = Math.max(1, srcW - capL - capR)
  const midSrcH = Math.max(1, srcH - capT - capB)

  const mapX = (x: number) => {
    if (x <= capL) return x * sx
    if (x >= srcW - capR) return w - (srcW - x) * sx
    return capLeft + ((x - capL) / midSrcW) * midW
  }

  const mapY = (y: number) => {
    if (y <= capT) return y * sx
    if (y >= srcH - capB) return h - (srcH - y) * sx
    return capTop + ((y - capT) / midSrcH) * midH
  }

  const tokens = SHEN_FRAME_PATH.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)
  if (!tokens?.length) return SHEN_FRAME_PATH

  let out = ''
  let i = 0

  while (i < tokens.length) {
    const token = tokens[i]!
    if (/[a-zA-Z]/.test(token)) {
      const cmd = token
      const argCount = CMD_ARG_COUNT[cmd]
      if (argCount === undefined) {
        throw new Error(`unsupported path command: ${cmd}`)
      }
      out += cmd
      i += 1
      if (argCount === 0) continue

      for (let arg = 0; arg < argCount; arg += 2) {
        const x = Number(tokens[i]!)
        const y = Number(tokens[i + 1]!)
        out += `${formatNum(mapX(x))},${formatNum(mapY(y))}`
        i += 2
        if (arg + 2 < argCount) out += ' '
      }
      continue
    }
    i += 1
  }

  return out
}

/**
 * 动态 SVG：单条 path（四角固定 + 中间区随 width/height 映射），无 viewBox 分块。
 */
export const buildShenSkillDescBgSvg = (width: number, height: number): string => {
  const w = Math.max(1, snapPx(width))
  const h = Math.max(1, snapPx(height))
  const d = warpShenFramePath(w, h)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path fill-rule="evenodd" fill="${SHEN_FRAME_FILL}" d="${d}"/></svg>`
}
