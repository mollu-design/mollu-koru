import { ref } from 'vue'

/**
 * 点选/框选
 */
export function useSelection() {
  const selected = ref<string[]>([])
  const selectionBox = ref<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  function select(ids: string | string[]): void {
    selected.value = Array.isArray(ids) ? ids : [ids]
  }

  function toggle(id: string): void {
    const idx = selected.value.indexOf(id)
    if (idx >= 0) {
      selected.value.splice(idx, 1)
    } else {
      selected.value.push(id)
    }
  }

  function clear(): void {
    selected.value = []
  }

  function isSelected(id: string): boolean {
    return selected.value.includes(id)
  }

  return {
    selected,
    selectionBox,
    select,
    toggle,
    clear,
    isSelected,
  }
}
