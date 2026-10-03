<template>
  <div
    class="koru-graph-editor__node"
    :class="{
      'koru-graph-editor__node--selected': isSelected,
      'koru-graph-editor__node--dragging': isDragging,
    }"
    :style="nodeStyle"
    @click.stop="onClick"
    @dblclick.stop="onDblClick"
    @mousedown.stop="onMouseDown"
    @mouseover="onMouseOver"
    @mouseout="onMouseOut"
  >
    <div class="koru-graph-editor__node-body">
      {{ node.label || node.id }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KoruNodeData, KoruGraphEditorMode } from '../types'
import { useCanvasStore } from '../stores/canvasStore'

const props = defineProps<{
  node: KoruNodeData
  mode: KoruGraphEditorMode
}>()

const emit = defineEmits<{
  'node-click': [data: { nodeId: string; node: KoruNodeData; originalEvent?: MouseEvent }]
  'node-dblclick': [data: { nodeId: string; node: KoruNodeData; originalEvent?: MouseEvent }]
  'node-mousedown': [data: { nodeId: string; node: KoruNodeData; originalEvent?: MouseEvent }]
}>()

const instance = useCanvasStore().instance.value

const isSelected = computed(() => instance?.selection.includes(props.node.id) ?? false)
const isDragging = computed(() => false) // 由拖拽 composable 管理

const nodeStyle = computed(() => ({
  left: `${props.node.x}px`,
  top: `${props.node.y}px`,
  width: `${props.node.width}px`,
  height: `${props.node.height}px`,
}))

function onClick(e: MouseEvent): void {
  emit('node-click', { nodeId: props.node.id, node: props.node, originalEvent: e })
}

function onDblClick(e: MouseEvent): void {
  emit('node-dblclick', { nodeId: props.node.id, node: props.node, originalEvent: e })
}

function onMouseDown(e: MouseEvent): void {
  emit('node-mousedown', { nodeId: props.node.id, node: props.node, originalEvent: e })
}

function onMouseOver(e: MouseEvent): void {
  // hover 状态
}

function onMouseOut(e: MouseEvent): void {
  // hover 状态移除
}
</script>
