<template>
  <div v-if="visible" class="koru-property-panel">
    <div class="koru-property-panel__body">
      <!-- 自定义 Tab 头 -->
      <div class="koru-property-panel__tabs">
        <div
          v-for="tab in tabList"
          :key="tab.key"
          class="koru-property-panel__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="onTabChange(tab.key)"
        >
          {{ tab.title }}
        </div>
      </div>
      <!-- Tab 内容区 -->
      <div class="koru-property-panel__tab-content">
        <!-- 属性 -->
        <div v-show="activeTab === 'basic'" class="koru-property-panel__tab-pane">
          <!-- Node properties -->
          <a-form
            v-if="cellProps.type === 'node'"
            :model="cellProps"
            layout="vertical"
            size="small"
          >
            <!-- 图元名称 -->
            <a-form-item label="图元标识">
              <a-input
                size="medium"
                :model-value="cellProps.label"
                @update:model-value="emitUpdate('label', $event)"
                placeholder="请输入图元名称"
                readonly
              />
            </a-form-item>

            <!-- 多选对齐 -->
            <div v-if="isMultiSelect" class="koru-property-panel__multi-align">
              <a-divider :margin="8">多选对齐</a-divider>
              <div class="koru-property-panel__multi-align-grid">
                <a-button
                  v-for="item in alignActions"
                  :key="item.action"
                  size="small"
                  class="koru-property-panel__multi-align-btn"
                  @click="handleAlign(item.action)"
                >
                  {{ item.label }}
                </a-button>
              </div>
            </div>

            <!-- 位置和大小 -->
            <a-divider :margin="8">位置和大小</a-divider>
            <a-form-item label="">
              <div class="koru-property-panel__pos-size-grid">
                <a-input-number
                  size="medium"
                  mode="button"
                  :model-value="cellProps.x"
                  @update:model-value="emitUpdate('x', $event)"
                  placeholder="X轴"
                  class="koru-property-panel__pos-size-half"
                >
                  <template #prefix>X</template>
                </a-input-number>
                <a-input-number
                  size="medium"
                  mode="button"
                  :model-value="cellProps.y"
                  @update:model-value="emitUpdate('y', $event)"
                  placeholder="Y轴"
                  class="koru-property-panel__pos-size-half"
                >
                  <template #prefix>Y</template>
                </a-input-number>
                <a-input-number
                  size="medium"
                  mode="button"
                  :model-value="cellProps.width"
                  @update:model-value="emitUpdate('width', $event)"
                  :min="1"
                  placeholder="宽度"
                  class="koru-property-panel__pos-size-half"
                >
                  <template #prefix>宽</template>
                </a-input-number>
                <a-input-number
                  size="medium"
                  mode="button"
                  :model-value="isLineNode ? cellProps.strokeWidth : cellProps.height"
                  @update:model-value="emitUpdate(isLineNode ? 'strokeWidth' : 'height', $event)"
                  :min="1"
                  :max="isLineNode ? 50 : undefined"
                  placeholder="高度"
                  class="koru-property-panel__pos-size-half"
                >
                  <template #prefix>{{ isLineNode ? '线宽' : '高' }}</template>
                </a-input-number>
                <!-- 行3：锁定宽高比（线条节点不适用） -->
                <div v-if="!isLineNode" class="koru-property-panel__lock-aspect-row">
                  <span class="koru-property-panel__lock-aspect-label">锁定宽高比</span>
                  <a-switch
                    size="medium"
                    :model-value="!!cellProps.lockAspect"
                    @update:model-value="emitUpdate('lockAspect', $event)"
                  />
                </div>
                <a-input-number
                  size="medium"
                  mode="button"
                  :model-value="cellProps.angle || 0"
                  @update:model-value="emitUpdate('angle', $event)"
                  :min="0"
                  :max="360"
                  :step="1"
                  placeholder="旋转角度"
                  class="koru-property-panel__pos-size-full"
                >
                  <template #prefix>角度</template>
                  <template #suffix>°</template>
                </a-input-number>
              </div>
            </a-form-item>

            <!-- 多状态元件：编辑多状态配置入口 -->
            <a-form-item v-if="cellProps.isMultiState" label="多状态配置">
              <a-space direction="vertical" style="width: 100%">
                <a-button long type="primary" @click="emit('edit-multi-state')">
                  编辑多状态
                </a-button>
              </a-space>
            </a-form-item>

            <!-- 样式 -->
            <a-divider :margin="8">样式</a-divider>
            <!-- 填充色（线条节点也显示，用作线条颜色；图片/文本/键值对节点不显示） -->
            <a-form-item v-if="!isImageNode && !isTextNode && !isSplitNode" label="填充色">
              <a-space>
                <a-color-picker
                  :model-value="cellProps.fill || '#EFF4FF'"
                  @change="emitUpdate('fill', $event)"
                />
                <a-input
                  size="medium"
                  :model-value="cellProps.fill || ''"
                  @change="emitUpdate('fill', $event)"
                  style="width: 110px"
                />
              </a-space>
            </a-form-item>

            <!-- 边框色（线条节点无独立边框色；图片/文本节点不显示） -->
            <a-form-item v-if="!isLineNode && !isImageNode && !isTextNode" label="边框色">
              <a-space>
                <a-color-picker
                  :model-value="cellProps.stroke || '#5F95FF'"
                  @change="emitUpdate('stroke', $event)"
                />
                <a-input
                  size="medium"
                  :model-value="cellProps.stroke || ''"
                  @change="emitUpdate('stroke', $event)"
                  style="width: 110px"
                />
              </a-space>
            </a-form-item>

            <!-- 边框大小（线条节点、SVG 节点、普通图元、split 显示；文本/图片节点不显示） -->
            <a-form-item
              v-if="!isImageNode && !isTextNode && cellProps.type === 'node'"
              label="边框大小"
            >
              <a-input-number
                size="medium"
                mode="button"
                :model-value="cellProps.strokeWidth || 1"
                @update:model-value="emitUpdate('strokeWidth', $event)"
                :min="1"
                :max="50"
                :step="1"
                placeholder="边框大小"
              >
                <template #suffix>px</template>
              </a-input-number>
            </a-form-item>

            <!-- 线条节点：线型 -->
            <a-form-item v-if="isLineNode" label="线条类型">
              <a-radio-group
                :model-value="cellProps.lineDashed ? 'dashed' : 'solid'"
                @update:model-value="emitUpdate('lineDashed', $event === 'dashed')"
              >
                <a-radio value="solid">实线</a-radio>
                <a-radio value="dashed">虚线</a-radio>
              </a-radio-group>
            </a-form-item>

            <!-- 文本/按钮节点：文本内容 -->
            <a-form-item v-if="isTextNode || isButtonNode" label="文本内容">
              <a-input
                size="medium"
                :model-value="cellProps.text"
                @update:model-value="emitUpdate('text', $event)"
                placeholder="请输入文本内容"
              />
            </a-form-item>

            <!-- 文本/按钮节点：字体大小 -->
            <a-form-item v-if="isTextNode || isButtonNode" label="字体大小">
              <a-input-number
                size="medium"
                mode="button"
                :model-value="cellProps.fontSize"
                @update:model-value="emitUpdate('fontSize', $event)"
                :min="8"
                :max="72"
                :step="1"
                placeholder="字体大小"
              >
                <template #suffix>px</template>
              </a-input-number>
            </a-form-item>

            <!-- 文本/按钮节点：字体颜色 -->
            <a-form-item v-if="isTextNode || isButtonNode" label="字体颜色">
              <a-space>
                <a-color-picker
                  :model-value="cellProps.fontColor || '#1D2129'"
                  @change="emitUpdate('fontColor', $event)"
                />
                <a-input
                  size="medium"
                  :model-value="cellProps.fontColor || ''"
                  @change="emitUpdate('fontColor', $event)"
                  style="width: 110px"
                />
              </a-space>
            </a-form-item>

            <!-- 分栏节点：键名/键值样式 -->
            <template v-if="isSplitNode">
              <a-divider :margin="8">键名</a-divider>
              <a-form-item label="键名 · 文本">
                <a-input
                  size="medium"
                  :model-value="cellProps.leftText"
                  @update:model-value="emitUpdate('leftText', $event)"
                  placeholder="请输入键名"
                />
              </a-form-item>
              <a-form-item label="键名 · 字体大小">
                <a-input-number
                  size="medium"
                  mode="button"
                  :model-value="cellProps.leftFontSize"
                  @update:model-value="emitUpdate('leftFontSize', $event)"
                  :min="8"
                  :max="72"
                  :step="1"
                  placeholder="字体大小"
                >
                  <template #suffix>px</template>
                </a-input-number>
              </a-form-item>
              <a-form-item label="键名 · 字体颜色">
                <a-space>
                  <a-color-picker
                    :model-value="cellProps.leftFontColor || '#262626'"
                    @change="emitUpdate('leftFontColor', $event)"
                  />
                  <a-input
                    size="medium"
                    :model-value="cellProps.leftFontColor || ''"
                    @change="emitUpdate('leftFontColor', $event)"
                    style="width: 110px"
                  />
                </a-space>
              </a-form-item>

              <a-divider :margin="8">键值</a-divider>
              <a-form-item label="键值 · 文本">
                <a-input
                  size="medium"
                  :model-value="cellProps.rightText"
                  @update:model-value="emitUpdate('rightText', $event)"
                  placeholder="请输入键值"
                />
              </a-form-item>
              <a-form-item label="键值 · 字体大小">
                <a-input-number
                  size="medium"
                  mode="button"
                  :model-value="cellProps.rightFontSize"
                  @update:model-value="emitUpdate('rightFontSize', $event)"
                  :min="8"
                  :max="72"
                  :step="1"
                  placeholder="字体大小"
                >
                  <template #suffix>px</template>
                </a-input-number>
              </a-form-item>
              <a-form-item label="键值 · 字体颜色">
                <a-space>
                  <a-color-picker
                    :model-value="cellProps.rightFontColor || '#262626'"
                    @change="emitUpdate('rightFontColor', $event)"
                  />
                  <a-input
                    size="medium"
                    :model-value="cellProps.rightFontColor || ''"
                    @change="emitUpdate('rightFontColor', $event)"
                    style="width: 110px"
                  />
                </a-space>
              </a-form-item>
            </template>
          </a-form>

          <!-- Edge properties -->
          <a-form
            v-else-if="cellProps.type === 'edge'"
            :model="cellProps"
            layout="vertical"
            size="small"
          >
            <!-- 连线名称 -->
            <a-form-item label="连线名称">
              <a-input
                size="medium"
                :model-value="cellProps.label"
                @update:model-value="emitUpdate('label', $event)"
                placeholder="请输入连线名称"
              />
            </a-form-item>

            <a-divider :margin="8">连线样式</a-divider>

            <a-form-item label="线条颜色">
              <a-space>
                <a-color-picker
                  :model-value="cellProps.stroke || '#A2B1C3'"
                  @change="emitUpdate('stroke', $event)"
                />
                <a-input
                  size="medium"
                  :model-value="cellProps.stroke || ''"
                  @change="emitUpdate('stroke', $event)"
                  style="width: 110px"
                />
              </a-space>
            </a-form-item>

            <a-form-item label="线条宽度">
              <a-input-number
                size="medium"
                :model-value="cellProps.strokeWidth || 2"
                @update:model-value="emitUpdate('strokeWidth', $event)"
                :min="1"
                :max="20"
                :step="1"
                placeholder="线条宽度"
                mode="button"
              >
                <template #suffix>px</template>
              </a-input-number>
            </a-form-item>

            <a-form-item label="线条类型">
              <a-radio-group
                size="medium"
                :model-value="cellProps.dashed ? 'dashed' : 'solid'"
                @update:model-value="emitUpdate('dashed', $event === 'dashed')"
              >
                <a-radio value="solid">实线</a-radio>
                <a-radio value="dashed">虚线</a-radio>
              </a-radio-group>
            </a-form-item>

            <a-form-item label="显示箭头">
              <a-switch
                size="medium"
                :model-value="!!cellProps.hasArrow"
                @update:model-value="emitUpdate('hasArrow', $event)"
              />
            </a-form-item>

            <a-form-item v-if="cellProps.hasArrow" label="箭头方向">
              <a-radio-group
                size="medium"
                :model-value="cellProps.arrowDirection || 'target'"
                @update:model-value="emitUpdate('arrowDirection', $event)"
              >
                <a-radio value="source">起点</a-radio>
                <a-radio value="target">终点</a-radio>
                <a-radio value="both">两端</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-form>
        </div>

        <!-- 动效 -->
        <div v-show="activeTab === 'anim'" class="koru-property-panel__tab-pane">
          <KoruAnimationPanel
            :cell-type="cellProps.type === 'edge' ? 'edge' : 'node'"
            :is-line-node="isLineNode"
            :animation="cellProps.animation"
            :line-anim="cellProps.lineAnim || 'none'"
            @update:animation="(v) => emitUpdate('animation', v)"
            @update:line-anim="(v) => emitUpdate('lineAnim', v)"
          />
        </div>

        <!-- 事件 -->
        <div v-show="activeTab === 'event'" class="koru-property-panel__tab-pane">
          <KoruEventPanel
            :cell-props="cellProps"
            :all-nodes="allNodes"
            :self-cell-id="selfCellId"
            :device-options="store.deviceConfig.deviceOptions"
            @update="(key, val) => emitUpdate(key, val)"
          />
        </div>

        <!-- 绑定 -->
        <div v-show="activeTab === 'binding'" class="koru-property-panel__tab-pane">
          <KoruBindingPanel
            :cell-props="cellProps"
            :all-nodes="allNodes"
            :device-options="store.deviceConfig.deviceOptions"
            :device-catalog="store.deviceConfig.deviceCatalog"
            @update="(key, val) => emitUpdate(key, val)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useCanvasStore } from '../stores/canvasStore'
import KoruAnimationPanel from './panels/KoruAnimationPanel.vue'
import KoruEventPanel from './panels/KoruEventPanel.vue'
import KoruBindingPanel from './panels/KoruBindingPanel.vue'

interface CellProps {
  id?: string
  type?: string
  shape?: string
  label?: string
  // Node properties
  x?: number
  y?: number
  width?: number
  height?: number
  angle?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  // Text node
  text?: string
  fontSize?: number
  fontColor?: string
  // Split node
  leftText?: string
  leftFontSize?: number
  leftFontColor?: string
  rightText?: string
  rightFontSize?: number
  rightFontColor?: string
  splitRatio?: number
  // Line node
  lineDashed?: boolean
  lineAnim?: string
  lineAnimDir?: 'normal' | 'reverse'
  // Edge properties
  dashed?: boolean
  hasArrow?: boolean
  arrowDirection?: 'source' | 'target' | 'both' | 'none'
  // Animation
  animation?: any
  lockAspect?: boolean
  // Event & Binding
  eventConfig?: any
  binding?: any
  // Group / MultiState flags
  isMultiState?: boolean
  isGroup?: boolean
  stateList?: { stateId: string; stateName: string; cellIds?: string[] }[]
  activeStateId?: string
}

const props = withDefaults(
  defineProps<{
    visible?: boolean
  }>(),
  {
    visible: true,
  },
)

const emit = defineEmits<{
  'update:visible': [v: boolean]
  'edit-multi-state': []
}>()

const store = useCanvasStore()
const cellProps = ref<CellProps>({})
const activeTab = ref('basic')

// 自定义 Tab 列表（替代 a-tabs）
const tabList = [
  { key: 'basic', title: '属性' },
  { key: 'anim', title: '动效' },
  { key: 'event', title: '事件' },
  { key: 'binding', title: '绑定' },
]

let selectionHandler: ((ids: string[]) => void) | null = null
let nodeSyncHandler: ((data: { nodeId: string }) => void) | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncLastTime = 0

// ========== 计算属性 ==========
const instance = computed(() => store.instance.value)
const isEditMode = computed(() => instance.value?.isEditMode() ?? true)

const panelTitle = computed(() => {
  if (isMultiSelect.value) return '多选属性'
  if (cellProps.value.type === 'edge') return '连线属性'
  if (cellProps.value.type === 'node') return '节点属性'
  return '属性'
})
0
const isMultiSelect = ref(false)

const isTextNode = computed(() => {
  return cellProps.value.type === 'node' && cellProps.value.shape === 'custom-text'
})

const isButtonNode = computed(() => {
  return cellProps.value.type === 'node' && cellProps.value.shape === 'custom-button'
})

const isSplitNode = computed(() => {
  return cellProps.value.type === 'node' && cellProps.value.shape === 'custom-split'
})

const isLineNode = computed(() => {
  return cellProps.value.type === 'node' && cellProps.value.shape === 'shape-line'
})

const isSvgNode = computed(() => {
  return cellProps.value.type === 'node' && !!cellProps.value.shape?.startsWith?.('svg-node-')
})

const isImageNode = computed(() => {
  return cellProps.value.type === 'node' && cellProps.value.shape === 'custom-image'
})

/** 读取节点 label（优先 data.label → data.name → X6 顶层 label → 渲染文本） */
const readNodeLabel = (cell: any): string => {
  try {
    const d = cell.getData?.()
    if (d?.label != null) return String(d.label)
    if (d?.name != null) return String(d.name)
  } catch {
    /* ignore */
  }
  try {
    const p = cell.getProp?.('label')
    if (typeof p === 'string' && p !== '') return p
    if (p && typeof p === 'object' && p.text != null) return String(p.text)
  } catch {
    /* ignore */
  }
  try {
    const t = cell.attr?.('label/text')
    if (t != null && t !== '') return String(t)
    const tx = cell.attr?.('text/text')
    if (tx != null && tx !== '') return String(tx)
  } catch {
    /* ignore */
  }
  return ''
}

/** 画布上可选作目标图元的节点（排除组合成员，保留独立图元 + 组合容器） */
const allNodes = computed<
  { value: string; label: string; shape?: string; data?: Record<string, any> }[]
>(() => {
  const graph = store.x6GraphRef.value
  if (!graph) return []
  let containerCounter = 0
  return graph
    .getNodes()
    // 排除: 有父节点的组合成员节点（它们被容器逻辑保护，不是独立可操作图元）
    .filter((n: any) => !n.getParent?.())
    .map((n: any) => {
      const d = n.getData?.() || {}
      const isContainer = d.isGroup || d.isMultiState
      let label = readNodeLabel(n) || '未命名图元'
      if (isContainer) {
        if (label === '组合') {
          containerCounter += 1
          label = `组合 ${containerCounter}`
        }
        label = `[容器] ${label}`
      }
      return {
        value: n.id,
        label,
        shape: n.shape,
        data: d,
      }
    })
})

/** 当前选中节点的 cellId（供事件面板默认目标） */
const selfCellId = computed(() => cellProps.value.id || '')

// ========== 多选对齐动作 ==========
const alignActions: { action: string; label: string }[] = [
  { action: 'alignLeft', label: '左对齐' },
  { action: 'alignCenterH', label: '水平居中' },
  { action: 'alignRight', label: '右对齐' },
  { action: 'alignTop', label: '顶对齐' },
  { action: 'alignCenterV', label: '垂直居中' },
  { action: 'alignBottom', label: '底对齐' },
  { action: 'sameWidth', label: '等宽' },
  { action: 'sameHeight', label: '等高' },
]

function handleAlign(action: string): void {
  const graph = store.x6GraphRef.value
  if (!graph || !instance.value) return
  const cells = graph.getSelectedCells()
  if (cells.length < 2) return

  const bboxes = cells.map((c: any) => c.getBBox?.() || { x: 0, y: 0, width: 0, height: 0 })

  switch (action) {
    case 'alignLeft': {
      const minX = Math.min(...bboxes.map((b: any) => b.x))
      cells.forEach((c: any, i: number) => {
        const b = bboxes[i]
        c.position(minX, b.y)
      })
      break
    }
    case 'alignRight': {
      const maxRight = Math.max(...bboxes.map((b: any) => b.x + b.width))
      cells.forEach((c: any, i: number) => {
        const b = bboxes[i]
        c.position(maxRight - b.width, b.y)
      })
      break
    }
    case 'alignCenterH': {
      const avgCenter =
        bboxes.reduce((sum: number, b: any) => sum + b.x + b.width / 2, 0) / bboxes.length
      cells.forEach((c: any, i: number) => {
        const b = bboxes[i]
        c.position(avgCenter - b.width / 2, b.y)
      })
      break
    }
    case 'alignTop': {
      const minY = Math.min(...bboxes.map((b: any) => b.y))
      cells.forEach((c: any, i: number) => {
        const b = bboxes[i]
        c.position(b.x, minY)
      })
      break
    }
    case 'alignBottom': {
      const maxBottom = Math.max(...bboxes.map((b: any) => b.y + b.height))
      cells.forEach((c: any, i: number) => {
        const b = bboxes[i]
        c.position(b.x, maxBottom - b.height)
      })
      break
    }
    case 'alignCenterV': {
      const avgCenter =
        bboxes.reduce((sum: number, b: any) => sum + b.y + b.height / 2, 0) / bboxes.length
      cells.forEach((c: any, i: number) => {
        const b = bboxes[i]
        c.position(b.x, avgCenter - b.height / 2)
      })
      break
    }
    case 'sameWidth': {
      const maxWidth = Math.max(...bboxes.map((b: any) => b.width))
      cells.forEach((c: any) => {
        const size = c.getSize?.() || { width: 100, height: 60 }
        c.resize?.(maxWidth, size.height)
      })
      break
    }
    case 'sameHeight': {
      const maxHeight = Math.max(...bboxes.map((b: any) => b.height))
      cells.forEach((c: any) => {
        const size = c.getSize?.() || { width: 100, height: 60 }
        c.resize?.(size.width, maxHeight)
      })
      break
    }
  }
}

// ========== 属性更新 ==========
function emitUpdate(key: string, value: any): void {
  const inst = instance.value
  if (!inst || !cellProps.value.id) return

  // 值未变化则不触发更新（防止程序刷新误触发）
  if ((cellProps.value as Record<string, any>)[key] === value) return // 更新本地面板状态
  ;(cellProps.value as Record<string, any>)[key] = value

  // 多选批量编辑
  if (isMultiSelect.value) {
    inst.updateSelectedCellsProp(key, value)
    // 以第一个选中 cell 为准回显
    const graph = store.x6GraphRef.value
    if (graph) {
      const cells = graph.getSelectedCells()
      if (cells.length > 0) {
        const props = inst.readCellProps(cells[0].id)
        cellProps.value = { ...cellProps.value, ...props }
      }
    }
  } else {
    inst.updateCellProp(cellProps.value.id, key, value)
    // 宽高更新时回填实际值（锁定宽高比时会按比例计算另一边）
    if (key === 'width' || key === 'height') {
      const props = inst.readCellProps(cellProps.value.id)
      cellProps.value = { ...cellProps.value, ...props }
    }
  }
}

function onTabChange(key: string): void {
  activeTab.value = key
}

// ========== 选区同步 ==========
function updateFromSelection(ids: string[]): void {
  const inst = instance.value

  // 同步多选状态（isMultiSelect 不再是 computed，需手动维护）
  isMultiSelect.value = ids.length > 1

  if (!inst) {
    cellProps.value = {}
    return
  }

  if (ids.length === 0) {
    cellProps.value = {}
    return
  }

  const targetId = ids[0]
  const props = inst.readCellProps(targetId)
  cellProps.value = props

  activeTab.value = 'basic'
}

onMounted(() => {
  const inst = instance.value
  if (inst) {
    selectionHandler = (ids: string[]) => updateFromSelection(ids)
    inst.on('selection:changed', selectionHandler)

    // 画布手柄拖拽/缩放/旋转时刷新属性面板（throttle 16ms）
    nodeSyncHandler = (data: { nodeId: string }) => {
      if (data.nodeId !== cellProps.value.id) return
      const now = Date.now()
      const elapsed = now - syncLastTime
      if (elapsed >= 16) {
        syncLastTime = now
        const props = inst.readCellProps(data.nodeId)
        cellProps.value = props
      } else if (!syncTimer) {
        // trailing: 确保最后一次更新在 16ms 后执行
        syncTimer = setTimeout(() => {
          syncLastTime = Date.now()
          const inst2 = instance.value
          if (inst2) {
            const props = inst2.readCellProps(data.nodeId)
            cellProps.value = props
          }
          syncTimer = null
        }, 16 - elapsed)
      }
    }
    inst.on('node:drag', nodeSyncHandler)
    inst.on('node:resized', nodeSyncHandler)
    inst.on('node:rotated', nodeSyncHandler)
  }

  // 初始化：读取当前选中
  const graph = store.x6GraphRef.value
  if (graph) {
    const selected = graph.getSelectedCells()
    if (selected.length > 0) {
      updateFromSelection(selected.map((c: any) => c.id))
    }
  }
})

onBeforeUnmount(() => {
  const inst = instance.value
  if (inst && selectionHandler) {
    inst.off('selection:changed', selectionHandler)
    selectionHandler = null
  }
  // 清理节点事件监听
  if (inst && nodeSyncHandler) {
    inst.off('node:drag', nodeSyncHandler)
    inst.off('node:resized', nodeSyncHandler)
    inst.off('node:rotated', nodeSyncHandler)
    nodeSyncHandler = null
  }
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
})

// 监听 cell 变化以刷新属性面板
watch(
  () => cellProps.value.id,
  (id) => {
    if (id) {
      // 保留本地已修改的字段，其他从 cell 重新读取
      const inst = instance.value
      if (inst) {
        const props = inst.readCellProps(id)
        cellProps.value = { ...props, ...cellProps.value }
      }
    }
  },
)
</script>

<style lang="scss">
.koru-property-panel {
  width: 280px;
  height: 100%;
  background: #fff;
  border-left: 1px solid #dfe3e8;
  display: flex;
  flex-direction: column;

  &__body {
    flex: 1;
    min-height: 0;
    padding: 8px 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  // ── 自定义 Tab 头 ──
  &__tabs {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid #e5e6eb;
    margin: -8px -10px 0;
    padding: 0 10px;
    background: #fff;
  }

  &__tab {
    padding: 10px 1px;
    font-size: 14px;
    color: #4e5969;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-left: 12px;
    margin-right: 12px;
    margin-bottom: -1px;
    transition:
      color 0.2s,
      border-color 0.2s;
    user-select: none;
    white-space: nowrap;

    &:hover {
      color: #165dff;
    }

    &.is-active {
      color: #165dff;
      border-bottom-color: #165dff;
      font-weight: 500;
    }
  }

  // ── Tab 内容区（唯一的滚动容器） ───
  &__tab-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-top: 18px;
  }

  /* 位置和大小：网格布局 */
  &__pos-size-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    width: 100%;
  }

  &__pos-size-half {
    width: 100%;
  }

  &__pos-size-full {
    width: 100%;
    grid-column: 1 / -1;
  }

  /* 锁定宽高比 */
  &__lock-aspect-row {
    display: flex;
    align-items: center;
    margin-top: 8px;
  }

  &__lock-aspect-label {
    font-size: 13px;
    color: #333;
    margin-right: 8px;
  }

  /* 多选对齐 */
  &__multi-align {
    margin-top: 8px;
    margin-bottom: 22px;
  }

  &__multi-align-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 22px;
  }

  &__multi-align-btn {
    width: 100%;
    font-size: 13px;
  }

  /* 动效提示文字 */
  &__anim-hint {
    margin-top: 4px;
    font-size: 12px;
    color: #86909c;
    line-height: 1.6;
  }
}

/* 全局动画提示样式 */
.anim-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
  line-height: 1.6;
}
</style>
