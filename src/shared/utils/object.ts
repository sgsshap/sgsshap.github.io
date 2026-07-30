/**
 * 保留指定位数的小数
 */
export const toFixed = (value: number, digits: number): number => {
  if (value === undefined || isNaN(value)) {
    return 0
  }
  return Number(value.toFixed(digits))
}
