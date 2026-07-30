/**
 * Konva 图层合成配置（亮度已改为画布级整体调整，见 canvasBrightness.ts）
 *
 * 保留 getFilters 供图层 spread 与势力着色回退；不再向单节点附加 Brightness 滤镜。
 */
export function useKonvaBrightnessFilters() {
  const getFilters = () => ({
    globalCompositeOperation: 'source-over' as const,
  })

  return { getFilters }
}
