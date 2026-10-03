<template>
  <div class="koru-stencil">
    <div ref="stencilContainer" class="koru-stencil-body"></div>
  </div>
  <!-- teleport 到 body，避免被祖先 overflow/stacking context 裁剪 -->
  <teleport to="body">
    <div
      v-if="templateTooltip.visible"
      ref="tooltipRef"
      class="koru-stencil-tooltip"
      :style="{
        left: templateTooltip.x + 'px',
        top: templateTooltip.y + 'px',
        opacity: templateTooltip._measuring ? 0 : 1,
      }"
    >
      <span>{{ templateTooltip.text }}</span>
      <img v-if="templateTooltip.thumbnail" :src="templateTooltip.thumbnail" alt="" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Stencil } from '@antv/x6'
import type { Graph, Node } from '@antv/x6'
import type { KoruStencilGroup } from '../types'
import type { CustomShapeItem } from '../presets/registerSvgNodes'
import { DEFAULT_STENCIL_GROUPS } from '../presets'
import { useCanvasStore } from '../stores/canvasStore'

const props = withDefaults(
  defineProps<{
    groups?: KoruStencilGroup[]
    width?: number
    /** SVG 自定义形状列表（用于 svg-node-* 形状的落点缩放） */
    customShapes?: CustomShapeItem[]
  }>(),
  {
    width: 210,
    customShapes: () => [],
  },
)

const store = useCanvasStore()
const graphRef = store.x6GraphRef
const parentStencilRef = store.stencilRef
const parentCustomShapes = store.customShapesRef
const parentLoadGroupNodes = store.loadGroupNodesRef
const stencilContainer = ref<HTMLElement | null>(null)
const stencilInstance = ref<Stencil | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)

// 从 store.componentConfig 回退；props.groups 自动与默认合并
const resolvedGroups = computed(() => {
  const custom = props.groups
  if (custom?.length) {
    const defaults = DEFAULT_STENCIL_GROUPS.map((g) => ({ ...g }))
    const merged = []
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
  return store.componentConfig.stencilGroups || []
})
const resolvedWidth = computed(() =>
  props.width !== 210 ? props.width : store.componentConfig.stencilWidth,
)
const resolvedCustomShapes = computed(
  () =>
    (props.customShapes?.length ? props.customShapes : store.componentConfig.customShapes) || [],
)

// 模板 hover 提示
const templateTooltip = ref<{
  visible: boolean
  text: string
  x: number
  y: number
  thumbnail: string
  /** 是否正在测量尺寸（测量期间 opacity:0，避免闪烁） */
  _measuring?: boolean
}>({ visible: false, text: '', x: 0, y: 0, thumbnail: '' })

/** 模板节点 cellId → 模板名称 映射，供 hover 查询 */
const templateStencilNames = ref<Record<string, string>>({})

/** 注册模板节点 ID 到名称的映射（由 loadGroupNodes 在加载模板时调用） */
function registerTemplateNames(nodes: any[]) {
  const map: Record<string, string> = {}
  for (const node of nodes) {
    const data = node.getData?.()
    if (data?.isTemplate && data.templateName) {
      map[node.id] = data.templateName
    }
  }
  templateStencilNames.value = map
}

watch(stencilInstance, (val) => {
  if (parentStencilRef) {
    parentStencilRef.value = val
  }
})
watch(
  () => resolvedCustomShapes.value,
  (val) => {
    if (parentCustomShapes) {
      parentCustomShapes.value = val || []
    }
  },
  { immediate: true },
)
if (parentLoadGroupNodes) {
  parentLoadGroupNodes.value = loadGroupNodes
}

/** 根据 shape 名称查找对应的 CustomShapeItem */
function findCustomShape(shape: string): CustomShapeItem | undefined {
  return resolvedCustomShapes.value?.find((c) => c.shapeName === shape)
}

function buildStencil(): void {
  const x6Graph = graphRef?.value
  if (!x6Graph || !stencilContainer.value) return

  // 销毁旧的 Stencil
  if (stencilInstance.value) {
    stencilInstance.value.remove()
    stencilInstance.value = null
  }
  // 清空模板 ID 映射（Stencil 重建后旧节点 ID 全部失效）
  templateStencilNames.value = {}

  // 清空容器
  stencilContainer.value.innerHTML = ''

  // 构建 X6 分组配置
  const x6Groups = resolvedGroups.value.map((g) => ({
    name: g.name,
    title: g.label,
    collapsed: g.collapsed ?? false,
    graphHeight: g.graphHeight ?? 200,
    layoutOptions: g.layoutOptions ?? {
      columns: 3,
      columnWidth: 60,
      rowHeight: 50,
    },
  }))

  // 创建 Stencil 实例（匹配 webtopo 实现）
  stencilInstance.value = new (Stencil as any)({
    title: '',
    target: x6Graph,
    stencilGraphWidth: resolvedWidth.value,
    stencilGraphOptions: { panning: false },
    collapsable: false,
    nodeTitle: {
      name: 'label',
    },
    groups: x6Groups,
    layoutOptions: {
      columns: 2,
      columnWidth: 80,
      rowHeight: 55,
    },
    // getDropNode 是模板标记的可靠拦截点（每次 drop 必调，且拿到原始完整 node）
    getDropNode(node: any) {
      const nodeData = (node as Node).getData?.()
      // 模板节点：在 store 存标记（node:added 时消费）
      if (nodeData?.isTemplate) {
        store.draggingTemplateRef.value = {
          data: nodeData.templateData,
          templateName: nodeData.templateName,
          thumbnail: nodeData.thumbnail,
        }
        const anchor = (node as Node).clone()
        anchor.updateData({ isTemplate: true, templateData: nodeData.templateData })
        anchor.attr('body/fill', 'transparent')
        anchor.attr('body/stroke', 'none')
        anchor.attr('label/text', '')
        return anchor
      }
      // custom-split：落点放大到 160x40，恢复默认文字 + 透明填充（stencil 里是蓝底）
      if (node.shape === 'custom-split') {
        const cloned = (node as Node).clone()
        cloned.resize(160, 40)
        cloned.attr('body/fill', 'transparent')
        cloned.attr('divider/display', 'none')
        cloned.attr('dividerHandle/display', 'none')
        cloned.attr('leftText/display', 'block')
        cloned.attr('rightText/display', 'block')
        cloned.attr('leftText/text', '键名')
        cloned.attr('rightText/text', '键值')
        return cloned
      }
      // svg-node-*：按 viewBox 等比缩放到 60x60
      if (node.shape.startsWith('svg-node-')) {
        const item = findCustomShape(node.shape)
        if (item) {
          const vbW = item.vbWidth || 512
          const vbH = item.vbHeight || 512
          const targetW = 60
          const targetH = 60
          const scale = Math.min(targetW / vbW, targetH / vbH)
          const w = Math.round(vbW * scale)
          const h = Math.round(vbH * scale)
          const cloned = node.clone()
          cloned.resize(w, h)
          return cloned
        }
      }
      // 其他节点：按 dropWidth/dropHeight 放大
      const item = resolvedGroups.value.flatMap((g) => g.items).find((i) => i.shape === node.shape)
      if (item) {
        const n = node.clone()
        const dropW = item.dropWidth ?? node.getSize().width * 2
        const dropH = item.dropHeight ?? node.getSize().height * 2
        n.setSize({ width: dropW, height: dropH })
        // 清除 label 文字（避免 stencil 的 label 属性通过 propHooks 写入 text 元素后显示在画布上）
        // 文本节点 / 按钮节点保留文字
        const keepText = node.shape === 'custom-text' || node.shape === 'custom-button'
        if (!keepText) {
          n.attr('text/display', 'none')
        }
        return n
      }
      return node.clone()
    },
  })

  // 将 Stencil 容器挂载到 DOM
  stencilContainer.value.appendChild(stencilInstance.value!.container)

  // DnD 插件事件作为辅助兜底（主要标记走 getDropNode）
  try {
    const dnd = (stencilInstance.value as any)?.plugin?.['dnd'] || (stencilInstance.value as any)?.dnd
    if (dnd && typeof dnd.on === 'function') {
      dnd.on('start', ({ node }: any) => {
        const data = node.getData?.()
        if (data?.isTemplate && !store.draggingTemplateRef.value) {
          store.draggingTemplateRef.value = {
            data: data.templateData,
            templateName: data.templateName,
            thumbnail: data.thumbnail,
          }
        }
      })
      dnd.on('end', () => {
        setTimeout(() => {
          store.draggingTemplateRef.value = null
        }, 2000)
      })
    }
  } catch {
    /* DnD hook 失败不影响主流程 */
  }

  // 加载节点
  resolvedGroups.value.forEach((g) => {
    const nodes = g.items.map((item) => {
      const node = x6Graph.createNode({
        shape: item.shape,
        width: item.width ?? 50,
        height: item.height ?? 30,
        label: item.label,
        attrs: item.attrs || {},
        data: item.data || {},
      })
      return node
    })
    stencilInstance.value!.load(nodes, g.name)
  })

  // 默认展开所有分组
  setTimeout(() => {
    stencilInstance.value?.expandGroups()
  }, 100)
}

/** 向指定分组加载节点（用于外部动态添加模板/本地文件） */
function loadGroupNodes(groupName: string, nodes: any[], opts?: { replace?: boolean }) {
  if (!stencilInstance.value) return
  const replace = opts?.replace ?? false
  const graphs = (stencilInstance.value as any)?.graphs
  const groupGraph = graphs?.[groupName]

  if (nodes.length === 0) {
    // 空数组 → 清空分组
    stencilInstance.value.load([], groupName)
    if (groupName === 'templates') {
      templateStencilNames.value = {}
    }
    setTimeout(() => stencilInstance.value?.expandGroups(), 100)
    return
  }

  if (replace) {
    // 替换模式：清空分组后加载（用于 refreshTemplateGroup 全量刷新）
    stencilInstance.value.load(nodes, groupName)
  } else {
    // 追加模式：保留已有节点，追加新节点（避免 stencil.load 替换掉已有内容）
    const existingCells: any[] = groupGraph?.getCells?.() || []
    const existingIds = new Set(existingCells.map((c) => c.id))
    const newNodes = nodes.filter((n) => !existingIds.has(n.id))
    if (newNodes.length === 0) return
    // 用 stencil.load 重新加载合并后的完整列表
    stencilInstance.value.load([...existingCells, ...newNodes], groupName)
  }

  // templates 分组：重建模板名称映射（从 graph 中读取所有模板节点）
  if (groupName === 'templates' && graphs) {
    const newMap: Record<string, string> = {}
    for (const key of Object.keys(graphs)) {
      const g = graphs[key]
      const cells = g?.getCells?.() || []
      for (const cell of cells) {
        const data = cell.getData?.()
        if (data?.isTemplate && data.templateName) {
          newMap[cell.id] = data.templateName
        }
      }
    }
    templateStencilNames.value = newMap
  }
  setTimeout(() => stencilInstance.value?.expandGroups(), 100)
}

defineExpose({ loadGroupNodes })

/** 在 Stencil 容器上绑定 mousemove，显示模板名称 tooltip */
function bindTemplateHover() {
  const container = stencilContainer.value
  if (!container) return
  container.addEventListener('mousemove', (e) => {
    const target = (e.target as Element).closest('.x6-node') as HTMLElement | null
    if (!target) {
      templateTooltip.value.visible = false
      return
    }
    const cellId = target.getAttribute('data-cell-id')
    if (!cellId) return
    const name = templateStencilNames.value[cellId]
    if (name) {
      const img = target.querySelector('image')
      const mouseEvent = e as MouseEvent
      const text = name
      const thumbnail = img ? img.getAttribute('xlink:href') || '' : ''

      // 两阶段定位（无闪烁）：
      // Stage 1：先以 opacity:0 渲染占位（让 DOM 测得出真实尺寸）
      // Stage 2：下一帧读取尺寸 → 计算最佳位置 → 更新 x/y + 显示
      templateTooltip.value = {
        visible: true,
        text,
        thumbnail,
        x: mouseEvent.clientX + 12,
        y: mouseEvent.clientY + 12,
        _measuring: true,
      }
      requestAnimationFrame(() => {
        const el = tooltipRef.value
        if (!el) return
        const rect = el.getBoundingClientRect()
        let finalX = mouseEvent.clientX + 12
        let finalY = mouseEvent.clientY + 12

        // 底部溢出 → 翻到鼠标上方
        if (rect.bottom > window.innerHeight - 4) {
          finalY = mouseEvent.clientY - rect.height - 12
          if (finalY < 4) finalY = 4
        }
        // 右侧溢出 → 翻到鼠标左侧
        if (rect.right > window.innerWidth - 4) {
          finalX = mouseEvent.clientX - rect.width - 12
          if (finalX < 4) finalX = 4
        }
        // 左右上边界兜底（缩略图 200px 可能超出）
        if (finalX < 4) finalX = 4
        if (finalY < 4) finalY = 4

        templateTooltip.value = {
          ...templateTooltip.value,
          x: finalX,
          y: finalY,
          _measuring: false,
        }
      })
    } else {
      templateTooltip.value.visible = false
    }
  })
  container.addEventListener('mouseleave', () => {
    templateTooltip.value.visible = false
  })
}

onMounted(() => {
  let unwatch: (() => void) | null = null
  unwatch = watch(
    () => graphRef?.value,
    (val) => {
      if (val) {
        buildStencil()
        // 绑定模板 hover 事件
        bindTemplateHover()
        unwatch?.()
      }
    },
    { immediate: true },
  )
})

onBeforeUnmount(() => {
  if (stencilInstance.value) {
    stencilInstance.value.remove()
    stencilInstance.value = null
  }
})

watch(
  () => resolvedGroups.value,
  () => buildStencil(),
  { deep: true },
)
</script>

<style lang="scss">
.koru-stencil {
  width: 100%;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  overflow: hidden;
  position: relative;
}

// 模板 hover 提示
.koru-stencil-tooltip {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
  pointer-events: none;
  white-space: nowrap;
  transition: opacity 0.05s ease;
  will-change: left, top;

  img {
    width: 200px;
    height: 200px;
    object-fit: contain;
    border-radius: 2px;
    background: #fff;
  }
}
</style>
