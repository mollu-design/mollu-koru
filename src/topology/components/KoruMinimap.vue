<template>
  <div class="koru-minimap" ref="minimapContainer">
    <div v-if="!graphReady" class="koru-minimap__hint">加载中…</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 小地图组件 — 基于 X6 MiniMap 插件
 *
 * 设计要点：
 *   1. 子组件 onMounted 先于父组件（KoruGraphEditor），Graph 实例在父组件 onMounted 中才初始化，
 *      因此不能在 onMounted 里直接拿 graph，必须 watch store.x6GraphRef
 *   2. 实例 dispose 放在 onBeforeUnmount，避免 graph 销毁后 minimap 继续响应事件报错
 *   3. 未启用 Scroller 插件时，MiniMap 可正常渲染缩略图，但视口框追踪与点击导航受限；
 *      后续如需完整导航体验，可在 useKoruGraphEditor 中补充 Scroller
 */
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { MiniMap } from '@antv/x6'
import { useCanvasStore } from '../stores/canvasStore'

const store = useCanvasStore()
const minimapContainer = ref<HTMLElement | null>(null)
const graphReady = ref(false)

let minimap: MiniMap | null = null

function initMiniMap(graph: any) {
  if (!minimapContainer.value || !graph) return
  try {
    minimap = new MiniMap({
      container: minimapContainer.value,
      width: 180,
      height: 120,
      padding: 10,
    })
    graph.use(minimap)
    graphReady.value = true
  } catch (e) {
    console.error('[KoruMinimap] 初始化失败:', e)
  }
}

// 监听 X6 Graph 实例就绪（父组件 init 后赋值给 store.x6GraphRef）
watch(
  () => store.x6GraphRef.value,
  (g) => {
    if (g && !minimap) {
      nextTick(() => initMiniMap(g))
    }
  },
)

onBeforeUnmount(() => {
  if (minimap) {
    try {
      minimap.dispose()
    } catch {
      /* ignore */
    }
    minimap = null
  }
})
</script>

<style lang="scss" scoped>
.koru-minimap {
  width: 180px;
  height: 120px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  position: relative;

  &__hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: rgb(var(--gray-5, 134 144 156));
    pointer-events: none;
  }

  // X6 MiniMap 内部缩略图画布样式微调
  :deep(.x6-minimap) {
    width: 100%;
    height: 100%;

    .x6-graph-svg {
      background: #fafafa;
    }
  }

  :deep(.x6-minimap-viewport) {
    border: 1px dashed rgb(var(--primary-6, 22 93 255));
    background: rgba(var(--primary-6, 22 93 255), 0.1);
    cursor: pointer;
  }
}
</style>
