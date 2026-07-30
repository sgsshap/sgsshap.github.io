/**
 * 生成rgba颜色
 * @param rgb rgb颜色
 * @param alpha 透明度
 */
export const rgba = (rgb: string, alpha: number) => `rgba(${rgb}, ${alpha})`

/**
 * 将16进制颜色转为rgb
 * @param hex 16进制颜色
 */
export const hex2rgb = (hex: string): { red: number; green: number; blue: number } | null => {
  if (!hex) {
    return null
  }
  let cleanHex = hex.trim().replace(/^#/, '').toUpperCase()

  const hexRegex = /^[0-9A-F]{3}$|^[0-9A-F]{6}$/
  if (!hexRegex.test(cleanHex)) {
    return null
  }

  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((char) => char + char)
      .join('')
  }
  const red = parseInt(cleanHex.slice(0, 2), 16)
  const green = parseInt(cleanHex.slice(2, 4), 16)
  const blue = parseInt(cleanHex.slice(4, 6), 16)
  return { red, green, blue }
}

export type Rgb = { red: number; green: number; blue: number }

/** H 0–360，S/L 0–1 */
export const rgbToHsl = (r: number, g: number, b: number) => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  const l = (max + min) / 2
  let s = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
        break
      case gn:
        h = ((bn - rn) / d + 2) / 6
        break
      default:
        h = ((rn - gn) / d + 4) / 6
    }
  }
  return { h: h * 360, s, l }
}

export const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const hn = h / 360
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let x = t
      if (x < 0) x += 1
      if (x > 1) x -= 1
      if (x < 1 / 6) return p + (q - p) * 6 * x
      if (x < 1 / 2) return q
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, hn + 1 / 3)
    g = hue2rgb(p, q, hn)
    b = hue2rgb(p, q, hn - 1 / 3)
  }
  return {
    red: Math.min(255, Math.max(0, Math.round(r * 255))),
    green: Math.min(255, Math.max(0, Math.round(g * 255))),
    blue: Math.min(255, Math.max(0, Math.round(b * 255))),
  }
}

export const rgbToHex = (rgb: Rgb): string =>
  `#${[rgb.red, rgb.green, rgb.blue].map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')}`

/**
 * 边框素材带深色纹理/黑斑时，过高饱和的色相（大红大紫等）容易显得刺眼；
 * 黄、金等色相与黑斑对比足且观感相对柔和，保持原色；低饱和、极浅色也不动。
 */
export const softenKingdomFrameTintRgb = (rgb: Rgb): Rgb => {
  const { h, s, l } = rgbToHsl(rgb.red, rgb.green, rgb.blue)

  if (s < 0.34) {
    return rgb
  }
  if (l > 0.93) {
    return rgb
  }
  // 黄～黄绿：典型「纯黄」约 51°–60°，略放宽以覆盖金黄、柠檬黄
  if (h >= 38 && h <= 82) {
    return rgb
  }

  const sLo = 0.42
  if (s <= sLo) {
    return rgb
  }

  const sCap = 0.58
  const u = (s - sLo) / (1 - sLo)
  const eased = Math.pow(u, 0.72)
  const sNew = sLo + (sCap - sLo) * eased

  return hslToRgb(h, sNew, l)
}
