import { ref, type Ref } from 'vue'

/**
 * 节点拖拽
 */
export function useNodeDrag() {
  const dragging = ref(false)
  const dragNodeId = ref<string | null>(null)
  const dragOffset = ref({ x: 0, y: 0 })

  function startDrag(nodeId: string, event: MouseEvent): void {
    dragging.value = true
    dragNodeId.value = nodeId
    dragOffset.value = { x: event.offsetX, y: event.offsetY }
  }

  function endDrag(): void {
    dragging.value = false
    dragNodeId.value = null
  }

  return {
    dragging,
    dragNodeId,
    dragOffset,
    startDrag,
    endDrag,
  }
}
