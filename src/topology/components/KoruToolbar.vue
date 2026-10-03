<template>
  <div class="koru-toolbar-wrapper">
    <div class="koru-toolbar">
      <koru-logo-name :logo="resolvedLogo" :name="resolvedName" />
      <div class="koru-toolbar__group">
        <button
          class="koru-toolbar__btn"
          :disabled="!canUndo"
          @click="doUndo"
          title="撤销 (Ctrl+Z)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"
            />
          </svg>
          <span>撤销</span>
        </button>
        <button
          class="koru-toolbar__btn"
          :disabled="!canRedo"
          @click="doRedo"
          title="重做 (Ctrl+Shift+Z)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"
            />
          </svg>
          <span>重做</span>
        </button>
        <button
          class="koru-toolbar__btn koru-toolbar__btn--danger"
          :disabled="!canDelete"
          @click="doDelete"
          title="删除选中元素 (Delete)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
            />
          </svg>
          <span>删除</span>
        </button>
      </div>

      <div class="koru-toolbar__divider"></div>

      <div class="koru-toolbar__group">
        <button class="koru-toolbar__btn" @click="doZoomIn" title="放大 (Ctrl+滚轮上)">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"
            />
          </svg>
          <span>放大</span>
        </button>
        <button class="koru-toolbar__btn" @click="doZoomOut" title="缩小 (Ctrl+滚轮下)">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"
            />
          </svg>
          <span>缩小</span>
        </button>
        <button class="koru-toolbar__btn" @click="doFitView" title="适应画布">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
            />
          </svg>
          <span>适应</span>
        </button>
      </div>

      <div class="koru-toolbar__divider"></div>

      <div class="koru-toolbar__group">
        <button class="koru-toolbar__btn" @click="doExport" title="导出画布为 PNG 图片">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
          <span>导出</span>
        </button>
        <button class="koru-toolbar__btn" @click="doSave" title="保存当前图数据到本地">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"
            />
          </svg>
          <span>保存</span>
        </button>
        <button class="koru-toolbar__btn" @click="doPreview" title="预览画布内容">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
            />
          </svg>
          <span>预览</span>
        </button>
        <button
          class="koru-toolbar__btn"
          :disabled="!fullscreenSupported"
          @click="toggleFullscreen"
          :title="isFullscreen ? '退出全屏' : '全屏浏览画布'"
        >
          <svg v-if="isFullscreen" viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
            />
          </svg>
          <span>全屏</span>
        </button>
      </div>

      <div class="koru-toolbar__divider"></div>

      <div class="koru-toolbar__group">
        <button class="koru-toolbar__btn" @click="doOpenTemplateManager" title="管理已保存的模板">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-8 14H7v-2h4v2zm4-4h-8v-2h8v2zm0-4H7V7h8v2z"
            />
          </svg>
          <span>模板管理</span>
        </button>
        <button
          class="koru-toolbar__btn"
          @click="doOpenImageManager"
          title="管理左侧图库（按分组显示/隐藏）"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
            />
          </svg>
          <span>图库管理</span>
        </button>
        <!-- <div>
          <button
            class="koru-toolbar__btn"
            @click="handleImportClick"
            title="导入本地 SVG 或图片文件（可多选）"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
            </svg>
            <span>本地文件</span>
          </button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".svg,image/svg+xml,image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp"
            multiple
            style="display: none"
            @change="handleFileChange"
          />
        </div> -->
      </div>
    </div>

    <!-- 图库管理弹窗 -->
    <koru-gallery
      :visible="galleryVisible"
      :items="galleryItems"
      @update:visible="galleryVisible = $event"
      @toggle-group="onGalleryGroupToggle"
      @show-all="onGalleryShowAll"
      @hide-all="onGalleryHideAll"
    />

    <!-- 模板管理弹窗 -->
    <koru-template
      ref="templateManagerRef"
      :visible="templateVisible"
      @update:visible="templateVisible = $event"
      @apply="onTemplateApply"
      @change="onTemplateChange"
      @template="(payload) => emit('template', payload)"
    />

    <!-- 保存弹窗 -->
    <koru-save-panel
      :visible="saveVisible"
      @update:visible="saveVisible = $event"
      @save="(data) => emit('save', data)"
      @save-template="onSaveAsTemplate"
    />

    <!-- 确认弹窗 -->
    <koru-confirm-dialog
      :visible="confirmState.visible"
      :title="confirmState.title"
      :content="confirmState.content"
      :type="confirmState.type"
      :ok-text="confirmState.okText"
      :cancel-text="confirmState.cancelText"
      @update:visible="(v: boolean) => confirmState.visible = v"
      @ok="confirmState.resolve?.(true)"
      @cancel="confirmState.resolve?.(false)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef, computed, type Ref } from 'vue'
import type { Graph, Stencil, Node } from '@antv/x6'
import KoruLogoName from './KoruLogoName.vue'
import KoruGallery from './KoruGallery.vue'
import type { GalleryResourceItem } from './KoruGallery.vue'
import KoruTemplate from './KoruTemplate.vue'
import type { TemplateItem } from './KoruTemplate.vue'
import KoruSavePanel from './KoruSavePanel.vue'
import KoruConfirmDialog from './KoruConfirmDialog.vue'
import { svgToDataUrl, nodeToSvgThumbnail } from '../utils/svgThumbnail'
import type { CustomShapeItem } from '../presets/registerSvgNodes'
import { registerSvgNode } from '../presets/registerSvgNodes'
import { useCanvasStore } from '../stores/canvasStore'
import { dbGet } from '../utils/storage'
import { collectBindingRegistry } from '../composables/useBindingRegistry'
import { serializeKoruCanvasConfig } from '../types'

const props = withDefaults(
  defineProps<{
    logo?: string
    name?: string
    fullscreenTarget?: string | string[]
    onFullscreenChange?: (isFullscreen: boolean) => void
  }>(),
  { logo: '', name: '' },
)

const emit = defineEmits<{
  (e: 'save', data: { diagramData: any; bindingRegistry: any[] }): void
  (e: 'preview', data: { diagramData: any; bindingRegistry: any[] }): void
  /** 统一模板事件：save | delete | clear，组件内部已完成 IndexedDB 操作 */
  (e: 'template', payload: { action: 'save' | 'delete' | 'clear'; template?: any; templates?: any[] }): void
}>()

// 从全局 store 获取画布状态
const store = useCanvasStore()
const x6GraphRef = store.x6GraphRef
const stencilRef = store.stencilRef
const customShapesRef = store.customShapesRef
const loadGroupNodesRef = store.loadGroupNodesRef

// 从 store.componentConfig 回退 logo/name/fullscreenTarget
const resolvedLogo = computed(() => props.logo || store.componentConfig.toolbarLogo)
const resolvedName = computed(() => props.name || store.componentConfig.toolbarName)
const resolvedFullscreenTarget = computed(
  () => props.fullscreenTarget || store.componentConfig.fullscreenTarget,
)

// 状态
const canUndo = ref(false)
const canRedo = ref(false)
const canDelete = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

function syncState() {
  const inst = store.instance.value
  if (inst) {
    canUndo.value = inst.canUndo
    canRedo.value = inst.canRedo
    canDelete.value = inst.selection.length > 0
  }
}

onMounted(() => {
  syncState()
  pollTimer = setInterval(syncState, 300)
  // 初始化时加载模板到 Stencil 分组
  setTimeout(refreshTemplateGroup, 500)
  // 等 graph ready 后 hook 模板拖拽
  setTimeout(() => {
    const g = x6GraphRef?.value
    if (g) {
      g.on('node:added', handleDraggedTemplateAdded)
      g.on('node:dblclick', handleTemplateNodeDblClick)
    }
  }, 600)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  const g = x6GraphRef?.value
  if (g) {
    g.off('node:added', handleDraggedTemplateAdded)
    g.off('node:dblclick', handleTemplateNodeDblClick)
  }
})

/** 内置默认模板应用确认框（KoruConfirmDialog 替代 window.confirm） */
async function internalConfirmTemplateApply(name: string): Promise<boolean> {
  return showConfirm({
    title: '覆盖确认',
    content: `确定要用模板 "${name}" 覆盖当前画布吗？此操作不可撤销。`,
    type: 'danger',
    okText: '确定覆盖',
  })
}

/**
 * Stencil 模板拖拽到画布 → node:added 时触发
 * 关键：先弹确认框，用户点确定才移除 anchor + applyTemplateToCanvas
 *       用户取消则只移除 anchor，不做任何其他操作
 */
async function handleDraggedTemplateAdded({ node }: { node: Node }) {
  const dragging = store.draggingTemplateRef.value
  if (!dragging) return
  store.draggingTemplateRef.value = null

  // 没开确认 → 直接移除 anchor + apply
  if (!store.componentConfig.confirmTemplateApply) {
    node.remove()
    applyTemplateToCanvas(dragging.data)
    return
  }

  // 弹确认框（DnD clone anchor 暂时留在画布上，等用户确认后再处理）
  const ok = await internalConfirmTemplateApply(dragging.templateName || '模板')
  // 立即移除 anchor（无论 ok 还是取消）
  node.remove()
  if (!ok) return  // 用户取消 → 只移除 anchor，不 apply
  applyTemplateToCanvas(dragging.data)
}

/** 画布上模板缩略图双击也能应用 */
async function handleTemplateNodeDblClick({ node }: { node: Node }) {
  const data = node.getData?.()
  if (!data?.isTemplate) return
  if (store.componentConfig.confirmTemplateApply) {
    const ok = await internalConfirmTemplateApply(data.templateName || '模板')
    if (!ok) return
  }
  applyTemplateToCanvas(data.templateData)
}

// ============ 按钮功能 ============

function doUndo() {
  store.instance.value?.undo()
  syncState()
}
function doRedo() {
  store.instance.value?.redo()
  syncState()
}
function doDelete() {
  store.instance.value?.removeSelectedCells()
  syncState()
}

function doZoomIn() {
  store.instance.value?.zoomIn()
}
function doZoomOut() {
  store.instance.value?.zoomOut()
}
function doFitView() {
  store.instance.value?.fitView()
}

function doExport() {
  const graph = x6GraphRef?.value
  if (!graph) return
  graph.toPNG(
    (dataUri: string) => {
      const link = document.createElement('a')
      link.download = `diagram-${Date.now()}.png`
      link.href = dataUri
      link.click()
    },
    { backgroundColor: '#fff', padding: 20 },
  )
}

function doSave() {
  saveVisible.value = true
}
function doPreview() {
  const graph = x6GraphRef?.value
  if (!graph) {
    emit('preview', { diagramData: { cells: [], canvas: undefined }, bindingRegistry: [] })
    return
  }
  const diagramData = {
    cells: graph.toJSON().cells || [],
    canvas: serializeKoruCanvasConfig(store.canvasConfig.value!),
  }
  const bindingRegistry = collectBindingRegistry(graph)
  emit('preview', { diagramData, bindingRegistry })
}

// ============ 图库管理 ============

const galleryVisible = ref(false)
const galleryItems = ref<GalleryResourceItem[]>([])

const GROUP_NAMES: Record<string, string> = {
  basic: '基础图库',
  electrical: '电器符号',
  templates: '我的模板',
}

function buildGalleryItems(): GalleryResourceItem[] {
  const items: GalleryResourceItem[] = []
  const stencil = stencilRef?.value
  if (!stencil) return items
  const shapes = customShapesRef?.value || []
  for (const groupKey of Object.keys(GROUP_NAMES)) {
    const gph = (stencil as any).graphs?.[groupKey]
    if (!gph) continue
    const nodes: Node[] = gph.getNodes()
    nodes.forEach((node, idx) => {
      const key = `${groupKey}-${idx}`
      const svgItem = shapes.find((s) => s.shapeName === node.shape)
      const name =
        svgItem?.label ||
        node.attr('label/text') ||
        node.attr('text/text') ||
        (node as any).data?.label ||
        (node as any).data?.templateName ||
        node.id.slice(0, 6)
      let thumbnail = (node as any).data?.thumbnail || ''
      if (!thumbnail) {
        if (svgItem) {
          thumbnail = svgToDataUrl(svgItem.svg)
        } else {
          thumbnail = nodeToSvgThumbnail(node)
        }
      }
      items.push({
        key,
        name,
        type: 'node',
        groupKey,
        groupName: GROUP_NAMES[groupKey] || groupKey,
        visible: true,
        thumbnail,
      })
    })
  }
  return items
}

async function doOpenImageManager() {
  galleryItems.value = buildGalleryItems()
  galleryVisible.value = true
}

function onGalleryGroupToggle(groupKey: string, visible: boolean) {
  // 更新 galleryItems 状态
  galleryItems.value = galleryItems.value.map((item) =>
    item.groupKey === groupKey ? { ...item, visible } : item,
  )
  // 更新 stencil 节点显隐
  const stencil = stencilRef?.value
  const g = (stencil as any)?.graphs?.[groupKey]
  if (g) {
    g.getNodes().forEach((n: Node) => {
      if (visible) n.show()
      else n.hide()
    })
  }
}

function onGalleryShowAll() {
  galleryItems.value = galleryItems.value.map((item) => ({ ...item, visible: true }))
  const stencil = stencilRef?.value
  if (!stencil) return
  Object.keys(GROUP_NAMES).forEach((g) => {
    const gph = (stencil as any)?.graphs?.[g]
    gph?.getNodes().forEach((n: Node) => n.show())
  })
}

function onGalleryHideAll() {
  galleryItems.value = galleryItems.value.map((item) => ({ ...item, visible: false }))
  const stencil = stencilRef?.value
  if (!stencil) return
  Object.keys(GROUP_NAMES).forEach((g) => {
    const gph = (stencil as any)?.graphs?.[g]
    gph?.getNodes().forEach((n: Node) => n.hide())
  })
}

// ============ 保存 ============

const saveVisible = ref(false)

// ============ 通用确认弹窗状态 ============
type ConfirmType = 'info' | 'warning' | 'danger'
const confirmState = ref<{
  visible: boolean
  title: string
  content: string
  type: ConfirmType
  okText: string
  cancelText: string
  resolve: ((ok: boolean) => void) | null
}>({
  visible: false,
  title: '',
  content: '',
  type: 'info',
  okText: '确定',
  cancelText: '取消',
  resolve: null,
})

/** 通用 confirm API — 替代 window.confirm */
function showConfirm(opts: {
  title: string
  content: string
  type?: ConfirmType
  okText?: string
  cancelText?: string
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmState.value = {
      visible: true,
      title: opts.title,
      content: opts.content,
      type: opts.type || 'info',
      okText: opts.okText || '确定',
      cancelText: opts.cancelText || '取消',
      resolve,
    }
  })
}

async function onSaveAsTemplate(name: string) {
  const graph = x6GraphRef?.value
  if (!graph) return
  const data = graph.toJSON()
  const emitTpl = (thumbnail: string) => {
    const tpl: TemplateItem = { name, data, thumbnail }
    refreshTemplateGroup()
    emit('template', { action: 'save', template: tpl })
  }
  // 先无缩略图保存 IndexedDB，确保模板数据一定写入
  await templateManagerRef.value?.upsertTemplate?.({ name, data, thumbnail: '' })
  // 尝试生成缩略图
  try {
    graph.toPNG(
      (uri: string) => {
        if (uri) {
          templateManagerRef.value?.upsertTemplate?.({ name, data, thumbnail: uri })
          emitTpl(uri)
        } else {
          emitTpl('')
        }
      },
      { backgroundColor: '#ffffff', padding: 8 },
    )
  } catch {
    emitTpl('')
  }
}

/** 从模板管理器读取所有模板，加载到 Stencil 的 templates 分组 */
async function refreshTemplateGroup() {
  const fn = loadGroupNodesRef?.value
  if (!fn || !x6GraphRef?.value) return
  // 直接从 IndexedDB 读取模板数据，不依赖组件引用（组件可能未挂载）
  let templates: any[] = []
  try {
    const raw = await dbGet('koru-templates')
    if (raw) {
      templates = JSON.parse(raw)
    }
  } catch {
    templates = []
  }
  if (!Array.isArray(templates) || templates.length === 0) {
    fn('templates', [])
    return
  }
  const nodes = templates.map((tpl: any) => {
    if (tpl.thumbnail) {
      // 有缩略图：使用 custom-image 形状显示模板缩略图
      return x6GraphRef.value!.createNode({
        shape: 'custom-image',
        width: 56,
        height: 60,
        data: {
          isTemplate: true,
          templateData: tpl.data,
          templateName: tpl.name,
          thumbnail: tpl.thumbnail,
        },
        attrs: {
          image: {
            'xlink:href': tpl.thumbnail,
            refWidth: '100%',
            refHeight: '100%',
            refX: 0,
            refY: 0,
          },
        },
      })
    }
    // 无缩略图：使用 rect 兜底
    return x6GraphRef.value!.createNode({
      shape: 'rect',
      width: 50,
      height: 30,
      label: tpl.name,
      attrs: {
        body: { fill: '#f5f5f5', stroke: '#d9d9d9', strokeWidth: 1, rx: 4, ry: 4 },
        label: { text: tpl.name, fontSize: 10, fill: '#333', textAnchor: 'middle' },
      },
      data: { isTemplate: true, templateData: tpl.data, templateName: tpl.name },
    })
  })
  fn('templates', nodes, { replace: true })
}

// ============ 模板管理 ============

const templateVisible = ref(false)
const templateManagerRef = ref<InstanceType<typeof KoruTemplate>>()

function doOpenTemplateManager() {
  templateVisible.value = true
  // 打开时刷新模板分组
  setTimeout(refreshTemplateGroup, 100)
}

/** 共享：把模板数据应用到画布（清画布 + fromJSON） */
function applyTemplateToCanvas(tplData: any) {
  const graph = x6GraphRef?.value
  if (!graph || !tplData) return
  graph.clearCells()
  graph.fromJSON(tplData)
  graph.centerContent()
}

async function onTemplateApply(tpl: TemplateItem) {
  if (!tpl.data) return
  // 确认：开关 true 则弹内置 Modal
  if (store.componentConfig.confirmTemplateApply) {
    const ok = await internalConfirmTemplateApply(tpl.name || '模板')
    if (!ok) return
  }
  applyTemplateToCanvas(tpl.data)
  templateVisible.value = false
}

function onTemplateChange(_templates: TemplateItem[]) {
  // 模板列表变化时（删除/重命名等），刷新 Stencil 的模板分组
  refreshTemplateGroup()
}

// ============ 本地文件导入 ============

const fileInputRef = ref<HTMLInputElement | null>(null)

const handleImportClick = () => {
  fileInputRef.value?.click()
}

const handleFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0 || !x6GraphRef?.value) {
    if (input) input.value = ''
    return
  }
  const graph = x6GraphRef.value

  // 读取所有文件，直接添加到画布
  const errors: string[] = []
  let offsetY = 0

  for (const file of Array.from(files)) {
    try {
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        // SVG → 注册为自定义形状，同时添加到画布
        const svgContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`))
          reader.readAsText(file)
        })
        if (!/<svg[\s>]/i.test(svgContent)) {
          errors.push(`${file.name}: 不是有效的 SVG`)
          continue
        }
        // 注册到 customShapesRef
        const shapes = customShapesRef.value || []
        const item: CustomShapeItem = {
          label: file.name.replace(/\.svg$/i, ''),
          svg: svgContent,
        }
        shapes.push(item)
        const idx = shapes.length - 1
        registerSvgNode(item, idx)

        // 添加到画布
        const vbW = item.vbWidth || 512
        const vbH = item.vbHeight || 512
        const scale = Math.min(60 / vbW, 60 / vbH)
        const w = Math.max(20, vbW * scale)
        const h = Math.max(20, vbH * scale)
        graph.addNode({
          shape: `svg-node-${idx}`,
          x: 100 + offsetY,
          y: 100 + offsetY,
          width: w,
          height: h,
          attrs: {
            'svg-body': { color: '#000', stroke: '#000', fill: '#000' },
          },
        })
        offsetY += 30
      } else if (file.type.startsWith('image/')) {
        // 图片 → 添加到画布
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`))
          reader.readAsDataURL(file)
        })
        graph.addNode({
          shape: 'custom-image',
          x: 100 + offsetY,
          y: 100 + offsetY,
          width: 60,
          height: 60,
          attrs: {
            image: {
              'xlink:href': dataUrl,
              refWidth: '100%',
              refHeight: '100%',
              refX: 0,
              refY: 0,
              preserveAspectRatio: 'xMidYMid meet',
            },
          },
        })
        offsetY += 30
      } else {
        errors.push(`${file.name}: 不支持的文件类型`)
      }
    } catch (err) {
      errors.push(`${file.name}: ${(err as Error).message}`)
    }
  }
  if (input) input.value = ''
}

// ============ 全屏 ============

const isFullscreen = ref(false)
const fullscreenSupported =
  typeof document !== 'undefined' &&
  (typeof (document as any).fullscreenEnabled !== 'undefined' ||
    typeof (document as any).webkitFullscreenEnabled !== 'undefined')

const getRoot = (): HTMLElement => {
  if (resolvedFullscreenTarget.value) {
    const target = resolvedFullscreenTarget.value
    const selectors = Array.isArray(target) ? target : [target]
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel)
      if (el) return el
    }
  }
  return document.documentElement
}

const toggleFullscreen = async () => {
  const doc: any = document
  if (isFullscreen.value) {
    try {
      if (doc.exitFullscreen) await doc.exitFullscreen()
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
    } catch (e) {
      console.warn('退出全屏失败', e)
    }
  } else {
    const el = getRoot() as any
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
    } catch (e) {
      console.warn('进入全屏失败', e)
    }
  }
}

const syncFullscreen = () => {
  const doc: any = document
  const fsEl = (doc.fullscreenElement || doc.webkitFullscreenElement) as Element | undefined
  isFullscreen.value = !!fsEl
  if (props.onFullscreenChange) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        props.onFullscreenChange!(isFullscreen.value)
      })
    })
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('webkitfullscreenchange', syncFullscreen)
}

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', syncFullscreen)
    document.removeEventListener('webkitfullscreenchange', syncFullscreen)
  }
})

defineExpose({ templateManagerRef })
</script>

<style lang="scss">
.koru-toolbar-wrapper {
  position: relative;
}

.koru-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #dfe3e8;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  gap: 0;

  &__group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__divider {
    width: 1px;
    height: 24px;
    background: #e8e8e8;
    margin: 0 12px;
  }

  &__btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    background: #fff;
    color: #595959;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      color: #40a9ff;
      border-color: #40a9ff;
      background: #f0f5ff;
    }
    &:active:not(:disabled) {
      color: #096dd9;
      border-color: #096dd9;
    }
    &:disabled {
      color: #bfbfbf;
      background: #f5f5f5;
      border-color: #d9d9d9;
      cursor: not-allowed;
      opacity: 0.6;
    }
    &--danger:hover:not(:disabled) {
      color: #ff4d4f;
      border-color: #ff4d4f;
      background: #fff1f0;
    }
    svg {
      flex-shrink: 0;
    }
  }
}
</style>
