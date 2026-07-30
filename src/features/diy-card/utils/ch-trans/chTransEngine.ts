import { tify } from 'chinese-conv'

/** 简繁转化例外表：键为简体（词组或单字），值为繁体；引擎会先匹配长词组再匹配单字 */
export type ChTransOverrideMap = Readonly<Record<string, string>>

const splitOverrides = (overrides: ChTransOverrideMap) => {
  const phrases: Array<[string, string]> = []
  const chars: Record<string, string> = {}

  for (const [from, to] of Object.entries(overrides)) {
    if (from.length > 1) {
      phrases.push([from, to])
    } else if (from.length === 1) {
      chars[from] = to
    }
  }

  phrases.sort((a, b) => b[0].length - a[0].length)
  return { phrases, chars }
}

/** 按例外表将简体转为繁体 */
export const convertToTraditional = (value: string, overrides: ChTransOverrideMap) => {
  if (!value) return value

  const { phrases, chars } = splitOverrides(overrides)
  const output = [...value]
  const converted: boolean[] = Array.from({ length: output.length }, () => false)

  for (const [from, to] of phrases) {
    let start = 0
    while (start <= value.length - from.length) {
      const index = value.indexOf(from, start)
      if (index === -1) break
      for (let offset = 0; offset < from.length; offset += 1) {
        output[index + offset] = to[offset]!
        converted[index + offset] = true
      }
      start = index + from.length
    }
  }

  for (let index = 0; index < output.length; index += 1) {
    if (converted[index]) continue
    const char = output[index]!
    output[index] = chars[char] ?? tify(char)
  }

  return output.join('')
}

/** 按开关返回展示文本 */
export const resolveDisplayText = (
  text: string,
  convertTChFlag: boolean,
  overrides: ChTransOverrideMap,
) => (convertTChFlag ? convertToTraditional(text, overrides) : text)

/** 空例外表（走 chinese-conv 默认转化） */
export const EMPTY_CH_TRANS_OVERRIDES: ChTransOverrideMap = {}
