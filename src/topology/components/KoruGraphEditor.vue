<template>
  <div class="koru-graph-editor" :class="modeClass">
    <!-- 顶部工具栏（跨全宽，独立一行） -->
    <div v-if="resolvedShowToolbar" class="koru-graph-editor__toolbar-header">
      <slot name="toolbar">
        <KoruToolbar
          @save="onToolbarSave"
          @preview="onToolbarPreview"
          @template="(payload) => emit('template', payload)"
        />
      </slot>
    </div>

    <!-- 下方主体区域：左侧 Stencil + 中间画布 + 右侧属性面板 -->
    <div class="koru-graph-editor__body">
      <!-- 左侧 Stencil 面板 -->
      <div v-if="resolvedShowStencil" class="koru-graph-editor__stencil">
        <slot name="stencil">
          <KoruStencil
            :groups="resolvedStencilGroups"
            :width="resolvedStencilWidth"
            :custom-shapes="resolvedCustomShapes"
          />
        </slot>
      </div>

      <!-- 画布主体区域 -->
      <div class="koru-graph-editor__main">
        <!-- X6 画布容器 -->
        <div ref="x6Container" class="koru-graph-editor__viewport"></div>

        <!-- 小地图（内部集成） -->
        <div v-if="resolvedShowMinimap" class="koru-graph-editor__minimap">
          <slot name="minimap">
            <KoruMinimap />
          </slot>
        </div>
      </div>

      <!-- 属性面板（右侧，自动切换节点/画布面板） -->
      <div
        v-if="resolvedShowPropertyPanel && activePanel"
        class="koru-graph-editor__property-panel"
      >
        <slot name="property-panel">
          <KoruPropertyPanel
            v-if="activePanel === 'node'"
            v-model:visible="propertyPanelVisible"
            @edit-multi-state="openMultiStateEditorForSelected"
          />
          <KoruCanvasPropertyPanel v-else-if="activePanel === 'canvas'" />
        </slot>
      </div>
    </div>

    <!-- 右键菜单（浮层） -->
    <div class="koru-graph-editor__context-menu">
      <slot name="context-menu">
        <KoruContextMenu
          :state="ctxMenuState"
          @action="onContextMenuAction"
          @close="onContextMenuClose"
        />
      </slot>
    </div>

    <!-- 内嵌多状态编辑弹窗 -->
    <KoruMultiStateEditorModal
      :visible="!!store.multiStateEditVisible.value"
      @update:visible="store.multiStateEditVisible.value = $event"
      :parent="multiStateParent"
      :children="multiStateChildren"
      :custom-shapes="multiStateCustomShapes"
      @save="onMultiStateSave"
      @preview="onMultiStatePreview"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useKoruGraphEditor } from '../composables/useKoruGraphEditor'
import { useCanvasPersistence } from '../composables/useCanvasPersistence'
import { useContextMenu } from '../composables/useContextMenu'
import type {
  PersistenceStorageAdapter,
  PersistenceData,
} from '../composables/useCanvasPersistence'
import { useCanvasStore, setComponentConfig } from '../stores/canvasStore'
import type {
  KoruGraphEditorOptions,
  KoruGraphEditorMode,
  KoruGraphData,
  KoruStencilGroup,
} from '../types'
import type { CustomShapeItem } from '../presets/registerSvgNodes'
import { mountSvgDefs, createSvgPreviewNode } from '../presets/registerSvgNodes'
import {
  DEFAULT_STENCIL_GROUPS,
} from '../presets'
import { KORU_DEFAULT_OPTIONS } from '../types'
import { getMultiStateChildren, applyMultiStateVisibility } from '../composables/useMultiState'
import { nodeToSvgThumbnail } from '../utils/svgThumbnail'
import { dbSet } from '../utils/storage'
import type { ContextMenuStateData } from '../composables/useContextMenu'

import KoruToolbar from './KoruToolbar.vue'
import KoruStencil from './KoruStencil.vue'
import KoruMinimap from './KoruMinimap.vue'
import KoruContextMenu from './KoruContextMenu.vue'
import KoruPropertyPanel from './KoruPropertyPanel.vue'
import KoruCanvasPropertyPanel from './KoruCanvasPropertyPanel.vue'
import KoruMultiStateEditorModal from './KoruMultiStateEditorModal.vue'

const props = withDefaults(
  defineProps<{
    /** 画布数据（v-model 双向绑定） */
    graph?: KoruGraphData
    /** 模式：edit(编辑) | preview(预览) */
    mode?: KoruGraphEditorMode
    /** 扩展配置 */
    options?: Partial<KoruGraphEditorOptions>
    /** 启用持久化，不传默认使用 'koru-diagram-data' */
    persistenceKey?: string
    /** 恢复数据的自定义确认回调 */
    persistenceConfirm?: (savedData: PersistenceData) => Promise<boolean> | boolean
    /** 自定义存储适配器 */
    persistenceAdapter?: PersistenceStorageAdapter

    // ============ 内部集成组件配置 ============

    /** Stencil 元件分组数据（编辑模式下必填） */
    stencilGroups?: KoruStencilGroup[]
    /** Stencil 面板宽度，默认 210 */
    stencilWidth?: number
    /** SVG 自定义形状列表 */
    customShapes?: CustomShapeItem[]
    /** 工具栏 Logo */
    toolbarLogo?: string
    /** 工具栏名称 */
    toolbarName?: string
    /** 全屏容器选择器 */
    fullscreenTarget?: string
    /** 是否显示工具栏，默认 true */
    showToolbar?: boolean
    /** 保存对话框默认名称（运行时值，从 edit.vue onReady 传入） */
    saveDefaultName?: string
    /** 是否显示 Stencil 面板，默认 true（编辑模式） */
    showStencil?: boolean
    /** 是否显示属性面板，默认 true */
    showPropertyPanel?: boolean
    /** 是否显示小地图，默认 false */
    showMinimap?: boolean
    /** @deprecated 请使用 setMultiStateConfig() 全局注册 */
    multiStatePointOptions?: { value: string; label: string }[]
  }>(),
  {
    mode: KORU_DEFAULT_OPTIONS.mode,
    options: () => ({}),
    persistenceKey: 'koru-diagram-data',
    stencilGroups: () => [],
    stencilWidth: 210,
    customShapes: () => [],
    toolbarLogo: '',
    toolbarName: '',
    fullscreenTarget: '',
    showToolbar: true,
    saveDefaultName: '',
    showStencil: true,
    showPropertyPanel: true,
    showMinimap: false,
  },
)

const emit = defineEmits<{
  'update:graph': [data: KoruGraphData]
  'update:mode': [mode: KoruGraphEditorMode]
  /** 保存事件：payload 带命名后的 name（可能空字符串） */
  save: [data: { diagramData: any; bindingRegistry: any[]; name?: string }]
  preview: [data: { diagramData: any; bindingRegistry: any[] }]
  /** 统一模板事件：save | delete | clear，组件内部已完成 IndexedDB 操作 */
  template: [payload: { action: 'save' | 'delete' | 'clear'; template?: any; templates?: any[] }]
  rendered: []
  destroyed: []
  /** Phase 1 新增：init + persistence + 订阅 全就绪后触发（SVG 全局注册项目 init 时已完成） */
  ready: [api: Record<string, any>]  // ready 回调带组件暴露的 API 对象（等同 ref.value）
}>()

// ============ 画布初始化 ============

const mergedOptions: Partial<KoruGraphEditorOptions> = {
  ...props.options,
  mode: props.mode,
}

const { instance, containerRef, mode, init, destroy, getGraph } = useKoruGraphEditor(mergedOptions)

const x6Container = ref<HTMLElement | null>(null)

const modeClass = computed(() => ({
  'koru-graph-editor--mode-edit': mode.value === 'edit',
  'koru-graph-editor--mode-preview': mode.value === 'preview',
}))

const store = useCanvasStore()
store.instance.value = instance
const x6GraphRef = store.x6GraphRef
const stencilRef = store.stencilRef
const customShapesRef = store.customShapesRef
const loadGroupNodesRef = store.loadGroupNodesRef

// ============ 组件配置（优先 props，回退到 store.componentConfig） ============

// 合并 stencilGroups：prop 传入的分组自动与内置默认合并（按 name 覆盖/追加）
function mergeWithDefaults(custom: KoruStencilGroup[]): KoruStencilGroup[] {
  if (!custom.length) return []
  const defaults = DEFAULT_STENCIL_GROUPS.map((g) => ({ ...g }))
  const merged: KoruStencilGroup[] = []
  for (const def of defaults) {
    const override = custom.find((c) => c.name === def.name)
    merged.push(override ? { ...override } : { ...def })
  }
  for (const c of custom) {
    if (!defaults.find((d) => d.name === c.name)) {
      merged.push({ ...c })
    }
  }
  return merged
}

const resolvedStencilGroups = computed<KoruStencilGroup[]>(() => {
  if (props.stencilGroups?.length) {
    return mergeWithDefaults(props.stencilGroups)
  }
  return store.componentConfig.stencilGroups
})
const resolvedStencilWidth = computed(() =>
  props.stencilWidth !== undefined ? props.stencilWidth : store.componentConfig.stencilWidth,
)
const resolvedCustomShapes = computed(() =>
  props.customShapes?.length ? props.customShapes : store.componentConfig.customShapes,
)
const resolvedToolbarLogo = computed(() => props.toolbarLogo || store.componentConfig.toolbarLogo)
const resolvedToolbarName = computed(() => props.toolbarName || store.componentConfig.toolbarName)
const resolvedFullscreenTarget = computed(
  () => props.fullscreenTarget || store.componentConfig.fullscreenTarget,
)
const resolvedShowToolbar = computed(() =>
  props.showToolbar !== true ? props.showToolbar : store.componentConfig.showToolbar,
)
const resolvedShowStencil = computed(() =>
  props.showStencil !== true ? props.showStencil : store.componentConfig.showStencil,
)
const resolvedShowPropertyPanel = computed(() =>
  props.showPropertyPanel !== true
    ? props.showPropertyPanel
    : store.componentConfig.showPropertyPanel,
)
const resolvedShowMinimap = computed(() =>
  props.showMinimap !== false ? props.showMinimap : store.componentConfig.showMinimap,
)

// ============ 属性面板自动切换 ============

const activePanel = ref<'canvas' | 'node' | null>(null)
const propertyPanelVisible = ref(true)

// ============ 右键菜单自动连线 ============

const ctxMenuState = computed<ContextMenuStateData>({
  get: (): ContextMenuStateData => store.ctxMenu.value!,
  set: (v: ContextMenuStateData) => {
    store.ctxMenu.value = v
  },
})

const { handleContextAction } = useContextMenu({
  getGraph: () => getGraph() ?? null,
  getContainer: () => {
    const el = x6Container.value
    return el?.querySelector?.('.koru-graph-editor__viewport') ?? el ?? null
  },
  ctxMenu: store.ctxMenu as { value: ContextMenuStateData },
  getSelectedCell: () => {
    const g = getGraph()
    if (!g) return null
    const sel = g.getSelectedCells()
    return sel.length > 0 ? sel[0] : null
  },
  setSelectedCell: (cell: any) => {
    const g = getGraph()
    if (!g) return
    g.cleanSelection?.()
    if (cell) g.select?.(cell)
    store.selectedCell.value = cell
    activePanel.value = 'node'
  },
  updateCellProps: (cell: any) => {
    store.selectedCell.value = cell
  },
  setPropActiveTab: (tab: string) => {
    store.propActiveTab.value = tab
  },
  getInstance: () => instance,
})

function onContextMenuAction(action: string) {
  handleContextAction(action)
}

function onContextMenuClose() {
  const cur = store.ctxMenu.value
  store.ctxMenu.value = {
    visible: false,
    x: cur?.x ?? 0,
    y: cur?.y ?? 0,
    onNode: cur?.onNode ?? false,
    multi: cur?.multi ?? false,
    locked: cur?.locked ?? false,
    cellId: cur?.cellId ?? '',
    grouped: cur?.grouped ?? false,
    isMultiState: cur?.isMultiState ?? false,
    isMultiStateMember: cur?.isMultiStateMember ?? false,
    canMultiState: cur?.canMultiState ?? false,
    canPaste: cur?.canPaste ?? false,
  }
}

// ============ 工具栏事件转发 ============

function onToolbarSave(data: { diagramData: any; bindingRegistry: any[] }) {
  // 统一走外部 KoruSavePanel（已带图纸名称输入框），不再内嵌二次弹窗
  emit('save', { ...data, name: props.saveDefaultName || undefined })
}

function onToolbarPreview(data: { diagramData: any; bindingRegistry: any[] }) {
  emit('preview', data)
}

// ============ 多状态编辑弹窗 ============

const multiStateCustomShapes = computed(() => store.customShapesRef.value)

/** 多状态父节点（从 cell ID 解引用为最新的 Node 实例） */
const multiStateParent = computed(() => {
  const id = store.multiStateEditTarget.value
  const g = store.x6GraphRef.value
  if (!id || !g) return null
  return g.getCellById(id)
})

const multiStateChildren = computed<any[]>(() => {
  const target = multiStateParent.value
  const g = store.x6GraphRef.value
  if (!target || !g) return []
  const children = getMultiStateChildren(g, target)
  return children.map((c: any) => {
    const data = c.getData?.() || {}
    let icon = data.icon || ''
    if (!icon && c.attrs?.image) {
      icon = c.attrs.image['xlink:href'] || c.attrs.image.href || ''
    }
    // 针对 svg-node-* 自定义节点：使用自定义 shape 图标
    if (!icon && c.shape && typeof c.shape === 'string' && c.shape.startsWith('svg-node-')) {
      const idx = parseInt(c.shape.replace('svg-node-', ''), 10)
      if (!Number.isNaN(idx) && store.customShapesRef.value?.[idx]?.svg) {
        icon = store.customShapesRef.value[idx].svg
      }
    }
    if (!icon && typeof c?.getSize === 'function') {
      try {
        icon = nodeToSvgThumbnail(c)
      } catch {
        /* ignore */
      }
    }
    // 兜底：生成一个带颜色的占位缩略图
    if (!icon) {
      try {
        const size = c.getSize?.() || { width: 40, height: 40 }
        const w = Math.max(20, size.width || 40)
        const h = Math.max(20, size.height || 40)
        const color =
          c.attrs?.body?.fill
            ?.toString()
            .replace(/rgba?\(([^)]+)\)/, (_m: string, inner: string) => {
              const parts = inner.split(',').map((s: string) => s.trim())
              return `rgb(${parts[0]},${parts[1]},${parts[2]})`
            }) || '#5F95FF'
        icon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="4" ry="4" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/></svg>`,
        )}`
      } catch {
        /* ignore */
      }
    }
    return {
      id: c.id,
      label: resolveCellLabel(c),
      icon,
    }
  })
})

/** 确保 cell 的 data.name 已同步（兜底：如果没有 name 则尝试从各种来源提取并写回） */
function ensureCellName(c: any): string {
  try {
    const d = c?.getData?.() || {}
    if (d?.name != null && String(d.name)) return String(d.name)
    // 尝试提取 label
    let labelText = ''
    if (c?.label?.text) labelText = String(c.label.text)
    if (!labelText) {
      const labels = c?.getLabels?.()
      if (Array.isArray(labels) && labels[0]?.text) labelText = String(labels[0].text)
    }
    if (!labelText && d?.label) labelText = String(d.label)
    if (!labelText) {
      const t = c?.attr?.('text/text')
      if (t != null) labelText = String(t)
    }
    if (!labelText) {
      const p = c?.getProp?.('label')
      if (typeof p === 'string' && p) labelText = p
      else if (p?.text) labelText = String(p.text)
    }
    if (labelText) {
      c?.setData?.({ ...d, name: labelText })
      return labelText
    }
  } catch {
    /* ignore */
  }
  return ''
}

/** 从 X6 cell 中提取显示文字（与 readNodeLabel 保持一致 + 额外兜底） */
function resolveCellLabel(c: any): string {
  // 1. data.name（node:added 时已同步，最可靠）
  try {
    const d = c?.getData?.() || {}
    if (d?.name != null) return String(d.name)
    if (d?.label != null) return String(d.label)
  } catch {
    /* ignore */
  }
  // 2. 即时同步兜底：确保 data.name 已写入
  const synced = ensureCellName(c)
  if (synced) return synced
  // 3. cell.attr('text/text')（markup text selector）
  try {
    const t = c?.attr?.('text/text')
    if (t != null) return String(t)
  } catch {
    /* ignore */
  }
  // 4. cell.getProp('label')（X6 prop API）
  try {
    const p = c?.getProp?.('label')
    if (typeof p === 'string' && p) return p
    if (p && typeof p === 'object' && p.text != null) return String(p.text)
  } catch {
    /* ignore */
  }
  // 5. c.label.text（X6 label getter）
  try {
    if (c?.label?.text != null) return String(c.label.text)
  } catch {
    /* ignore */
  }
  // 6. c.getLabels()[0].text（X6 getLabels API）
  try {
    const labels = c?.getLabels?.()
    if (Array.isArray(labels) && labels.length > 0) {
      const first = labels[0]
      if (typeof first === 'string' && first) return first
      if (first?.text != null) return String(first.text)
    }
  } catch {
    /* ignore */
  }
  // 7. cell.attr('label/text')（markup label selector）
  try {
    const t = c?.attr?.('label/text')
    if (t != null) return String(t)
  } catch {
    /* ignore */
  }
  // 8. 直接读 attrs 对象
  try {
    if (c?.attrs?.text?.text) return String(c.attrs.text.text)
    if (c?.attrs?.label?.text) return String(c.attrs.label.text)
  } catch {
    /* ignore */
  }
  // 9. shape 特定兜底
  if (c?.shape === 'shape-line') return '连接线'
  // 10. ID 截断
  return c?.id?.slice(0, 8) || '未命名'
}

function openMultiStateEditorForSelected() {
  const g = getGraph()
  if (!g) return
  const sel = g.getSelectedCells?.()
  if (!sel || sel.length === 0) return
  const target = sel[0]
  if (!target?.getData?.()?.isMultiState) return
  store.multiStateEditTarget.value = target.id  // 存 cell ID，不是实例
  store.multiStateEditVisible.value = true
}

function onMultiStateSave(payload: any) {
  const g = store.x6GraphRef.value
  const id = store.multiStateEditTarget.value
  if (!id || !g) return
  const target = g.getCellById(id)
  if (!target) return
  const data = target.getData?.() || {}
  const newData: any = {
    ...data,
    activeStateId: payload.activeStateId,
    stateList: payload.stateList,
  }
  // pointBind: 只保留 stateRule（pointCode 已废弃，device+dataPoint 从 binding 取）
  if (payload.pointBind && Object.keys(payload.pointBind.stateRule || {}).length > 0) {
    newData.pointBind = { stateRule: payload.pointBind.stateRule }
  } else {
    delete newData.pointBind
  }
  target.setData?.({ ...newData }, { overwrite: true })
  applyMultiStateVisibility(g, target)
  instance.getGraph?.()?.emit?.('graph:changed', instance.getGraphData?.() || {})
}

function onMultiStatePreview(stateId: string) {
  const g = store.x6GraphRef.value
  const id = store.multiStateEditTarget.value
  if (!id || !g) return
  const target = g.getCellById(id)
  if (!target) return
  const data = target.getData?.() || {}
  data.activeStateId = stateId
  target.setData?.({ ...data }, { overwrite: true })
  applyMultiStateVisibility(g, target)
}

// ============ 生命周期 ============

let persistenceCleanup: (() => void) | null = null

onMounted(() => {
  if (x6Container.value) {
    init(x6Container.value)
    x6GraphRef.value = getGraph()

    // 内置持久化
    if (props.persistenceKey) {
      const persistence = useCanvasPersistence(instance, {
        storageKey: props.persistenceKey,
        confirmRestore: props.persistenceConfirm,
        autoSave: true,
        ...(props.persistenceAdapter ? { storageAdapter: props.persistenceAdapter } : {}),
      })
      persistenceCleanup = persistence.setupAutoSave()
      persistence.checkAndRestore()
    } else if (props.graph) {
      instance.setGraphData(props.graph)
    }

    // Phase 2：自动处理 customShapes —— 从 store.componentConfig 读
    // nextTick 等 KoruStencil script setup + onMounted 都执行完（stencil 实例初始化、loadGroupNodesRef 注入）
    const g = getGraph()
    const shapes = store.componentConfig.customShapes
    console.log('[KoruGraphEditor] store.componentConfig.customShapes:', shapes?.length, 'items')
    if (g && shapes?.length) {
      const allDefs = shapes.map(s => s.defs).filter(Boolean).join('\n')
      if (allDefs) mountSvgDefs(g, allDefs)
      // 两层 nextTick：第一层等 KoruStencil 的 script setup 执行（loadGroupNodesRef.value 注入）
      //              第二层等 KoruStencil 的 onMounted 执行（stencilInstance 创建、graphs['electrical'] 初始化）
      nextTick(() => {
        nextTick(() => {
          const fn = store.loadGroupNodesRef.value
          console.log('[KoruGraphEditor] loadGroupNodesRef.value exists:', !!fn)
          fn?.('electrical',
            shapes.map(item => createSvgPreviewNode(g, item)))
          console.log(`[KoruGraphEditor] Stencil 电气符号填充: ${shapes.length} 个`)
        })
      })
    }

    // 点击空白 → 显示画布属性面板
    if (g) {
      g.on('blank:click', () => {
        activePanel.value = 'canvas'
      })
    }

    // 选中变化 → 自动切换属性面板
    instance.on('selection:changed', (ids: string[]) => {
      activePanel.value = ids.length > 0 ? 'node' : null
    })

    emit('rendered')
    emit('ready', _exposedAPI)
  }
})

onBeforeUnmount(() => {
  persistenceCleanup?.()
  destroy()
  emit('destroyed')
})

// 模式变化同步
watch(mode, (newMode) => {
  emit('update:mode', newMode)
})

// 外部数据同步（graphChangePending 计数器防止内部 graph:changed 回环触发 setGraphData 全量重建）
let graphChangePending = 0
watch(
  () => props.graph,
  (newData) => {
    if (newData && containerRef.value && graphChangePending === 0) {
      instance.setGraphData(newData)
    }
  },
  { deep: true },
)

// 内部变化同步回 v-model
instance.on('graph:changed', (data: KoruGraphData) => {
  graphChangePending++
  emit('update:graph', data)
  // nextTick 在所有 watcher 之后执行，确保 flag 在所有 watcher 检查完后才恢复
  nextTick(() => {
    graphChangePending = Math.max(0, graphChangePending - 1)
  })
})

const _exposedAPI = {
  instance,
  getGraph,
  getBindingRegistry: () => instance.getBindingRegistry(),
  /** Phase 1：统一数据灌入入口（X6 原生 JSON） */
  loadDiagram: (data: Parameters<typeof instance.loadDiagram>[0]) => instance.loadDiagram(data),
  /** 模板数据灌入：写 IndexedDB + 触发 KoruToolbar 刷新模板分组 */
  loadTemplates: async (list: Array<{ id?: any; name: string; data: any; thumbnail?: string }>) => {
    await dbSet('koru-templates', JSON.stringify(list))
    nextTick(() => {
      store.loadGroupNodesRef.value?.('templates', [])
    })
    console.log(`[Koru] loadTemplates → ${list.length} 个模板已写入 IndexedDB`)
  },
}
defineExpose(_exposedAPI)
</script>

<style lang="scss">
.koru-graph-editor {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  // 顶部工具栏 - 跨全宽独立一行
  &__toolbar-header {
    width: 100%;
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }

  // 下方主体区域（Stencil + Main + PropertyPanel 横向排列）
  &__body {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
    min-width: 0;
    position: relative;
  }

  // 左侧 Stencil 面板
  &__stencil {
    width: 210px;
    height: 100%;
    border-right: 1px solid #dfe3e8;
    background: #fff;
    overflow-y: auto;
    flex-shrink: 0;
  }

  // 画布主体
  &__main {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  &__viewport {
    width: 100%;
    height: 100%;
  }

  // 小地图 - 右下角
  &__minimap {
    position: absolute;
    bottom: 12px;
    right: 12px;
    z-index: 10;
  }

  // 属性面板 - 右侧
  &__property-panel {
    height: 100%;
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
    z-index: 1;
  }

  // 右键菜单 - 浮层
  &__context-menu {
    position: absolute;
    z-index: 20;
  }

  &--mode-edit {
  }
  &--mode-preview {
  }
}
.koru-graph-editor--mode-edit {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
</style>
