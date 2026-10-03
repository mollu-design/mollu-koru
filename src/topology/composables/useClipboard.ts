import { ref } from 'vue'
import type { KoruNodeData, KoruEdgeData } from '../types'

/**
 * 复制剪切粘贴
 */
export function useClipboard() {
  const clipboard = ref<{
    nodes: KoruNodeData[]
    edges: KoruEdgeData[]
  }>({ nodes: [], edges: [] })

  function copy(nodes: KoruNodeData[], edges: KoruEdgeData[]): void {
    clipboard.value = {
      nodes: nodes.map((n) => ({ ...n })),
      edges: edges.map((e) => ({ ...e })),
    }
  }

  function cut(nodes: KoruNodeData[], edges: KoruEdgeData[]): void {
    copy(nodes, edges)
  }

  function paste(): { nodes: KoruNodeData[]; edges: KoruEdgeData[] } | null {
    if (clipboard.value.nodes.length === 0) return null
    return {
      nodes: clipboard.value.nodes.map((n) => ({
        ...n,
        id: `${n.id}_copy`,
        x: n.x + 20,
        y: n.y + 20,
      })),
      edges: clipboard.value.edges.map((e) => ({
        ...e,
        id: `${e.id}_copy`,
      })),
    }
  }

  function clear(): void {
    clipboard.value = { nodes: [], edges: [] }
  }

  return {
    clipboard,
    copy,
    cut,
    paste,
    clear,
  }
}
