import { ref, computed } from 'vue'
import type { KoruGraphData } from '../types'

/**
 * 撤销重做
 */
export function useUndoRedo(limit = 50) {
  const stack = ref<KoruGraphData[]>([])
  const index = ref(-1)

  const canUndo = computed(() => index.value > 0)
  const canRedo = computed(() => index.value < stack.value.length - 1)

  function push(state: KoruGraphData): void {
    // 丢弃当前位置之后的历史
    stack.value = stack.value.slice(0, index.value + 1)
    stack.value.push(JSON.parse(JSON.stringify(state)))
    // 限制历史栈大小
    if (stack.value.length > limit) {
      stack.value.shift()
    }
    index.value = stack.value.length - 1
  }

  function undo(): KoruGraphData | null {
    if (!canUndo.value) return null
    index.value--
    return JSON.parse(JSON.stringify(stack.value[index.value]))
  }

  function redo(): KoruGraphData | null {
    if (!canRedo.value) return null
    index.value++
    return JSON.parse(JSON.stringify(stack.value[index.value]))
  }

  function clear(): void {
    stack.value = []
    index.value = -1
  }

  return {
    canUndo,
    canRedo,
    push,
    undo,
    redo,
    clear,
  }
}
