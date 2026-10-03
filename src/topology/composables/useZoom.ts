import { ref, type Ref } from 'vue'

/**
 * 缩放平移控制
 */
export function useZoom(initialScale = 1, min = 0.1, max = 5) {
  const scale = ref(initialScale)
  const offsetX = ref(0)
  const offsetY = ref(0)

  function setScale(s: number): void {
    scale.value = Math.min(Math.max(s, min), max)
  }

  function zoomIn(factor = 1.2): void {
    setScale(scale.value * factor)
  }

  function zoomOut(factor = 1.2): void {
    setScale(scale.value / factor)
  }

  function reset(): void {
    scale.value = 1
    offsetX.value = 0
    offsetY.value = 0
  }

  function pan(dx: number, dy: number): void {
    offsetX.value += dx
    offsetY.value += dy
  }

  return {
    scale,
    offsetX,
    offsetY,
    setScale,
    zoomIn,
    zoomOut,
    reset,
    pan,
  }
}
