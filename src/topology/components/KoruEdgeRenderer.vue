<template>
  <svg
    class="koru-graph-editor__edge"
    :class="{ 'koru-graph-editor__edge--hover': isHover }"
    :style="edgeStyle"
    @click.stop="onClick"
  >
    <line
      :x1="sourcePosition.x"
      :y1="sourcePosition.y"
      :x2="targetPosition.x"
      :y2="targetPosition.y"
      stroke="#333"
      stroke-width="2"
      stroke-linecap="round"
    />
    <text
      v-if="edge.label"
      :x="(sourcePosition.x + targetPosition.x) / 2"
      :y="(sourcePosition.y + targetPosition.y) / 2 - 8"
      text-anchor="middle"
      font-size="12"
      fill="#666"
    >
      {{ edge.label }}
    </text>
  </svg>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { KoruEdgeData, KoruGraphEditorMode } from '../types'
import { useCanvasStore } from '../stores/canvasStore'

const props = defineProps<{
  edge: KoruEdgeData
  mode: KoruGraphEditorMode
}>()

const emit = defineEmits<{
  'edge-click': [data: { edgeId: string; edge: KoruEdgeData; originalEvent?: MouseEvent }]
}>()

const instance = useCanvasStore().instance.value
const isHover = ref(false)

// 简化位置计算：实际应由渲染引擎根据节点位置计算
const sourcePosition = computed(() => {
  const node = instance ? null : null // 实际从 graph 中查找
  return { x: 0, y: 0 }
})

const targetPosition = computed(() => {
  return { x: 100, y: 100 }
})

const edgeStyle = computed(() => ({
  position: 'absolute' as const,
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'stroke' as any,
  overflow: 'visible',
}))

function onClick(e: MouseEvent): void {
  emit('edge-click', { edgeId: props.edge.id, edge: props.edge, originalEvent: e })
}
</script>
