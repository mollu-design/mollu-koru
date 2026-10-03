<!--
  CustomUIDemo.vue
  ──────────────────────────────────────────────────────
  演示：不依赖 KoruTopologyPlugin / Arco Design，
  只用纯逻辑层 API + 原生 HTML/CSS 组装完整编辑器。
  
  证明消费方零 Arco 依赖下也能使用 mollu-koru。
-->
<template>
  <div class="custom-editor">
    <!-- ═══════ 顶部工具栏（复用 KoruToolbar —— 已零 Arco） ═══════ -->
    <KoruToolbar @save="handleToolbarSave" />

    <!-- ═══════ 主体三栏布局 ═══════ -->
    <div class="ce-body">
      <!-- 左侧 Stencil（直接复用 KoruStencil —— 它零 Arco 依赖） -->
      <div class="ce-stencil">
        <KoruStencil />
      </div>

      <!-- 中间画布 -->
      <div class="ce-canvas-wrap">
        <div ref="canvasEl" class="ce-canvas"></div>
      </div>

      <!-- 右侧属性面板（全原生 HTML 控件） -->
      <div class="ce-prop-panel">
        <div v-if="!currentCell" class="ce-prop-empty">
          <div class="ce-prop-empty-icon">👆</div>
          <div>选中图元后可在此编辑属性</div>
        </div>
        <div v-else class="ce-prop-form">
          <h3 class="ce-prop-title">
            {{ currentCell.type === 'node' ? '节点属性' : '连线属性' }}
            <span class="ce-prop-id">#{{ currentCell.id?.slice(-6) }}</span>
          </h3>

          <!-- 通用：标签/文本 -->
          <div class="ce-field">
            <label>标签</label>
            <input type="text" :value="currentCell.label || currentCell.text || ''" @input="updateProp('label', ($event.target as HTMLInputElement).value)" />
          </div>

          <!-- 节点专属 -->
          <template v-if="currentCell.type === 'node'">
            <div class="ce-field-row">
              <div class="ce-field">
                <label>X</label>
                <input type="number" :value="currentCell.x" @input="updateProp('x', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div class="ce-field">
                <label>Y</label>
                <input type="number" :value="currentCell.y" @input="updateProp('y', Number(($event.target as HTMLInputElement).value))" />
              </div>
            </div>
            <div class="ce-field-row">
              <div class="ce-field">
                <label>宽</label>
                <input type="number" :value="currentCell.width" @input="updateProp('width', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div class="ce-field">
                <label>高</label>
                <input type="number" :value="currentCell.height" @input="updateProp('height', Number(($event.target as HTMLInputElement).value))" />
              </div>
            </div>
            <div class="ce-field">
              <label>旋转角度</label>
              <input type="number" :value="currentCell.angle" @input="updateProp('angle', Number(($event.target as HTMLInputElement).value))" />
            </div>
          </template>

          <!-- 节点 & 连线共有 -->
          <div class="ce-field">
            <label>填充色</label>
            <input type="color" :value="currentCell.fill || '#EFF4FF'" @input="updateProp('fill', ($event.target as HTMLInputElement).value)" />
          </div>
          <div class="ce-field">
            <label>描边色</label>
            <input type="color" :value="currentCell.stroke || '#5F95FF'" @input="updateProp('stroke', ($event.target as HTMLInputElement).value)" />
          </div>
          <div class="ce-field">
            <label>描边宽度</label>
            <input type="number" min="0" max="20" :value="currentCell.strokeWidth" @input="updateProp('strokeWidth', Number(($event.target as HTMLInputElement).value))" />
          </div>
          <div class="ce-field">
            <label>虚线</label>
            <select :value="!!currentCell.dashed" @change="updateProp('dashed', ($event.target as HTMLSelectElement).value === 'true')">
              <option value="false">实线</option>
              <option value="true">虚线</option>
            </select>
          </div>

          <!-- 连线专属 -->
          <template v-if="currentCell.type === 'edge'">
            <div class="ce-field">
              <label>箭头方向</label>
              <select :value="currentCell.arrowDirection || 'target'" @change="updateProp('arrowDirection', ($event.target as HTMLSelectElement).value)">
                <option value="none">无</option>
                <option value="target">终点</option>
                <option value="source">起点</option>
                <option value="both">双向</option>
              </select>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══════ 右键菜单（直接复用 KoruContextMenu —— 零 Arco） ═══════ -->
    <KoruContextMenu :state="store.ctxMenu.value" />
  </div>
</template>

<script setup lang="ts">
/**
 * CustomUIDemo
 * ──────────────────────────────────────────
 * 不依赖 KoruTopologyPlugin / Arco Design，
 * 只用纯逻辑层 API + 原生 HTML/CSS 组装编辑器。
 *
 * 关键：
 *  - 依赖全局样式（由 main.ts 的 app.use(KoruTopologyPlugin) 注入）
 *  - useKoruGraphEditor.init() 需要手动传 DOM 元素
 *  - init 之后把 graph 实例赋给 store.x6GraphRef，Stencil 才能 dnd
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useKoruGraphEditor, useCanvasStore, KoruToolbar, KoruStencil, KoruContextMenu } from '@mollu/koru/topology'

// ── 初始化核心 composable ──
const editor = useKoruGraphEditor({ mode: 'edit', grid: true })
const store = useCanvasStore()

// ── 画布容器 ──
const canvasEl = ref<HTMLElement | null>(null)

// ── 当前选中 cell 的属性（供属性面板用） ──
const currentCell = computed(() => store.selectedCell.value)

// ── 属性面板：更新单个属性 ──
function updateProp(key: string, value: any) {
  const ids = editor.selectedIds.value
  if (ids.length === 0) return
  // 多选批量更新
  if (ids.length > 1) {
    editor.instance.updateSelectedCellsProp(key, value)
  } else {
    editor.instance.updateCellProp(ids[0], key, value)
  }
  // 同步刷新属性面板数据
  refreshSelection()
}

// ── 刷新选中 cell 的属性面板数据 ──
function refreshSelection() {
  const ids = editor.selectedIds.value
  if (ids.length > 0) {
    store.selectedCell.value = editor.instance.readCellProps(ids[0])
  } else {
    store.selectedCell.value = null
  }
}

// ── 保存处理（KoruToolbar emit @save 时触发） ──
function handleToolbarSave(payload: { diagramData: any; bindingRegistry: any[], name?: string }) {
  try {
    localStorage.setItem('koru-demo-graph', JSON.stringify(payload.diagramData))
    const nodeCount = payload.diagramData?.nodes?.length || payload.diagramData?.cells?.length || 0
    const edgeCount = payload.diagramData?.edges?.length || 0
    const displayName = payload.name || '未命名图纸'
    alert(`✅ 已保存 ${nodeCount} 节点 / ${edgeCount} 连线 到 ${displayName}`)
  } catch {
    alert('❌ 保存失败')
  }
}

// ── 监听选中变化 → 更新 store.selectedCell + 属性面板 ──
watch(editor.selectedIds, () => {
  refreshSelection()
}, { deep: true })

// ── 生命周期 ──
onMounted(() => {
  if (!canvasEl.value) return

  // 1. 初始化 X6 画布（这一步会注册基础形状、搭建插件链、绑事件）
  editor.init(canvasEl.value)

  // 2. 把 graph 实例赋给 store —— KoruToolbar / KoruStencil 都靠 store.x6GraphRef
  store.x6GraphRef.value = editor.getGraph()

  // 3. 尝试恢复上次保存的数据
  try {
    const saved = localStorage.getItem('koru-demo-graph')
    if (saved) {
      const data = JSON.parse(saved)
      editor.instance.setGraphData(data)
    }
  } catch {
    /* ignore */
  }
})

onBeforeUnmount(() => {
  editor.destroy()
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════
   CustomUIDemo 自己的样式（全原生，不依赖 Arco）
   ═══════════════════════════════════════════════════ */

.custom-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f6f8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #1d2129;
  overflow: hidden;
}

/* ── 主体三栏 ── */
.ce-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── 左侧 Stencil ── */
.ce-stencil {
  width: 220px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  flex-shrink: 0;
  overflow-y: auto;
}

/* ── 中间画布 ── */
.ce-canvas-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #fafafa;
}
.ce-canvas {
  width: 100%;
  height: 100%;
}

/* ── 右侧属性面板 ── */
.ce-prop-panel {
  width: 280px;
  background: #fff;
  border-left: 1px solid #e8e8e8;
  flex-shrink: 0;
  overflow-y: auto;
}
.ce-prop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #c9cdd4;
  gap: 8px;
}
.ce-prop-empty-icon {
  font-size: 36px;
}
.ce-prop-form {
  padding: 16px;
}
.ce-prop-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 16px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ce-prop-id {
  font-size: 11px;
  color: #86909c;
  font-weight: normal;
  font-family: monospace;
}
.ce-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.ce-field label {
  font-size: 12px;
  color: #86909c;
}
.ce-field-row {
  display: flex;
  gap: 8px;
}
.ce-field-row .ce-field {
  flex: 1;
}
.ce-field input[type="text"],
.ce-field input[type="number"],
.ce-field select {
  padding: 5px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  background: #fff;
}
.ce-field input[type="text"]:focus,
.ce-field input[type="number"]:focus,
.ce-field select:focus {
  border-color: #165dff;
}
.ce-field input[type="color"] {
  width: 100%;
  height: 30px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  padding: 2px;
}
</style>
