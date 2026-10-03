<template>
  <div class="koru-preview">
    <!-- 画布区 -->
    <div class="koru-preview__main">
      <div ref="graphContainer" class="koru-preview__canvas"></div>

      <!-- 切换按钮 -->
      <a-button
        class="koru-preview__toggle"
        size="mini"
        :type="showTestTools ? 'primary' : 'outline'"
        @click="showTestTools = !showTestTools"
      >
        {{ showTestTools ? '隐藏调试面板' : '调试面板' }}
      </a-button>
    </div>

    <!-- 右侧调试面板（a-drawer） -->
    <KoruPreviewDebugPanel
      :graph="graph"
      :show="showTestTools"
      :event-log="eventLog"
      :data-log="dataLog"
      :action-log="actionLog"
      :last-event-detail="lastEventDetail"
      :pause-multi-state="pauseMultiState"
      :resume-multi-state="resumeMultiState"
      @update:show="showTestTools = $event"
      @refresh="handleRefresh"
      @clear-log="handleClearLog"
    />

    <!-- 确认弹窗（内部处理，确认/取消均通过事件通知外部） -->
    <a-modal
      v-model:visible="confirmVisible"
      :title="confirmRequest?.title || '提示'"
      :ok-text="confirmRequest?.confirmText || '确认'"
      cancel-text="取消"
      :ok-loading="confirmLoading"
      @ok="handleConfirmOk"
      @cancel="handleConfirmCancel"
      unmount-on-close
      width="720px"
    >
      <!-- controlDevice 专用卡片美化渲染 -->
      <div
        v-if="confirmRequest?.kind === 'controlDevice' && confirmRequest.devicePayload"
        class="koru-preview__confirm-device"
      >
        <!-- 设备信息 -->
        <div class="device-card device-card--device">
          <div class="device-card__header">
            <span class="device-card__label">目标设备</span>
            <a-link size="mini" @click="copyText(confirmRequest.devicePayload.deviceId, '设备ID')">
              <icon-copy />复制
            </a-link>
          </div>
          <div class="device-card__value">
            <template v-if="confirmRequest.devicePayload.deviceName">
              {{ confirmRequest.devicePayload.deviceName }}
              <span class="device-card__value-sub">【{{ confirmRequest.devicePayload.deviceId }}】</span>
            </template>
            <template v-else>
              {{ confirmRequest.devicePayload.deviceId || '未指定' }}
            </template>
          </div>
        </div>

        <!-- 指令信息 -->
        <div class="device-card device-card--command">
          <div class="device-card__header">
            <span class="device-card__label">下发指令</span>
            <a-link
              size="mini"
              @click="copyText(confirmRequest.devicePayload.cmdObj ? JSON.stringify(confirmRequest.devicePayload.cmdObj, null, 2) : confirmRequest.devicePayload.command, '指令')"
            >
              <icon-copy />复制
            </a-link>
          </div>
          <template v-if="confirmRequest.devicePayload.cmdObj">
            <div class="device-card__tags">
              <a-tag v-if="confirmRequest.devicePayload.cmdObj.instructionName" color="arcoblue">
                {{ confirmRequest.devicePayload.cmdObj.instructionName }}
              </a-tag>
              <a-tag v-if="confirmRequest.devicePayload.cmdObj.instructionId" color="green">
                {{ confirmRequest.devicePayload.cmdObj.instructionId }}
              </a-tag>
              <a-tag v-if="confirmRequest.devicePayload.cmdObj.instructionType">
                {{ confirmRequest.devicePayload.cmdObj.instructionType }}
              </a-tag>
            </div>
            <div v-if="confirmRequest.devicePayload.cmdObj.desc" class="device-card__desc">
              {{ confirmRequest.devicePayload.cmdObj.desc }}
            </div>
            <a-collapse class="device-card__raw">
              <a-collapse-item header="查看原始 JSON" :key="1">
                <pre>{{ JSON.stringify(confirmRequest.devicePayload.cmdObj, null, 2) }}</pre>
              </a-collapse-item>
            </a-collapse>
          </template>
          <div v-else class="device-card__raw-text">
            {{ confirmRequest.devicePayload.command }}
          </div>
        </div>

        <!-- 参数信息 -->
        <div
          v-if="confirmRequest.devicePayload.param"
          class="device-card device-card--param"
        >
          <div class="device-card__header">
            <span class="device-card__label">指令参数</span>
            <a-link
              size="mini"
              @click="copyText(confirmRequest.devicePayload.paramObj ? JSON.stringify(confirmRequest.devicePayload.paramObj, null, 2) : confirmRequest.devicePayload.param, '参数')"
            >
              <icon-copy />复制
            </a-link>
          </div>
          <template v-if="confirmRequest.devicePayload.paramObj?.paramList">
            <div class="device-param-list">
              <div
                v-for="(p, idx) in confirmRequest.devicePayload.paramObj.paramList"
                :key="idx"
                class="device-param-item"
              >
                <span class="device-param-item__key">{{ p.paramKey }}</span>
                <span class="device-param-item__eq">=</span>
                <span class="device-param-item__val">{{ p.paramValue }}</span>
                <span v-if="p.desc" class="device-param-item__desc">（{{ p.desc }}）</span>
              </div>
            </div>
          </template>
          <a-collapse class="device-card__raw">
            <a-collapse-item header="查看原始 JSON" :key="1">
              <pre>{{ confirmRequest.devicePayload.paramObj ? JSON.stringify(confirmRequest.devicePayload.paramObj, null, 2) : confirmRequest.devicePayload.param }}</pre>
            </a-collapse-item>
          </a-collapse>
        </div>

        <!-- 警告提示 -->
        <div class="device-warning">
          <icon-exclamation-circle-fill />
          <span>此操作将向目标设备下发控制指令，请确认参数正确</span>
        </div>
      </div>

      <!-- 其他 kind / 无 payload → 纯文本 fallback -->
      <div v-else class="koru-preview__confirm-content">{{ confirmRequest?.content }}</div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { Message } from '@arco-design/web-vue'
import { Graph, Selection } from '@antv/x6'
import { registerBasicShapes, registerSvgNode, mountSvgDefs, type CustomShapeItem } from '../presets'
import { dumpAllAnimClasses, applyAnimationFromData } from '../composables/useAnimation'
import { useCanvasStore } from '../stores/canvasStore'
import { useEventActions, type ConfirmRequest } from '../composables/useEventActions'
import { deserializeKoruCanvasConfig } from '../types'
import { applyKoruCanvasConfig } from '../composables/useKoruCanvasConfig'
import { useBindingExecutor } from '../composables/useBindingExecutor'
import KoruPreviewDebugPanel from './panels/KoruPreviewDebugPanel.vue'

// 注册基础形状
registerBasicShapes()

const canvasStore = useCanvasStore()

const props = withDefaults(
  defineProps<{
    /** 图数据，支持 { nodes, edges } 或 { cells } 两种格式 */
    graph?: { nodes?: any[]; edges?: any[]; cells?: any[] }
    /** 是否自动缩放适配画布，默认 true */
    autoFit?: boolean
    /** 是否显示调试面板（含绑定测试+日志），默认 false */
    showTestTools?: boolean
    /** 是否允许鼠标拖动画布（平移），默认 true */
    allowCanvasPan?: boolean
    /** SVG 自定义形状列表，用于注册 svg-node-* 形状 */
    customShapes?: CustomShapeItem[]
    /** Phase 1 新增：是否启用 highlightDevice / clearAllHighlights / scrollToCell 便捷 API，默认 true */
    enableHighlight?: boolean
    /** Phase 1 新增：是否启用 alarm 事件（绑定执行器检测到阈值越限时 emit），默认 false */
    enableAlarmEmit?: boolean
    /**
     * 外部前置请求 API：返回 true 表示成功，false 或 throw 表示失败。
     * 宿主实现后，事件的「外部前置请求」开关才能生效。
     */
    outerRequestApi?: (
      cfg: import('../composables/useEventActions').OuterRequestRuntimeConfig,
    ) => Promise<boolean>
  }>(),
  {
    graph: () => ({ nodes: [], edges: [] }),
    autoFit: false,
    showTestTools: false,
    allowCanvasPan: true,
    customShapes: () => [],
    enableHighlight: true,
    enableAlarmEmit: false,
  },
)

const emit = defineEmits<{
  'update:graph': [data: any]
  ready: [api: Record<string, any>]  // Phase 1 新增：ready 回调带组件暴露的 API 对象（等同 ref.value）
  destroyed: []
  /** 图元事件回调：点击/双击/鼠标移动等 */
  'cell-event': [payload: CellEventPayload]
  /** 数据更新回调：fetchData 拉取到新数据时触发 */
  'data-updated': [data: Record<string, number | string | null>]
  /** 触发器动作触发回调：当绑定触发器命中并执行行为时 */
  'action-triggered': [info: ActionTriggeredPayload]
  /** Phase 1 新增：点击设备节点（自动向上找父容器） */
  'device-click': [payload: DeviceClickPayload]
  /** Phase 1 新增：一轮 bindingTick 结束后统一 emit 本轮检测到的告警列表 */
  alarm: [alarms: Alarm[]]
}>()

/** 设备点击载荷 */
interface DeviceClickPayload {
  /** 实际被点击的 cellId */
  cellId: string
  /** 设备/容器 cellId（可能是被点击 cell 本身，也可能是其父容器） */
  deviceCellId: string
  /** 设备标识（cell.data.deviceKey / deviceId / id，按优先级取） */
  deviceKey: string
  /** 设备名称 */
  deviceName?: string
  /** 该设备的测点绑定（cell.data.binding.bindings） */
  bindings: any[]
  /** 原始 cell 数据 */
  cellData: Record<string, any>
  /** 原始 X6 事件对象 */
  rawEvent?: any
}

/** Phase 1 新增：告警事件载荷（Koru 内部绑定执行器检测到阈值越限时 emit） */
interface Alarm {
  /** 设备标识（cell.data.deviceKey / deviceId / id） */
  deviceKey: string
  /** 告警发生的 cellId */
  cellId: string
  /** 告警级别 */
  level: 'warning' | 'critical'
  /** 告警消息 */
  message: string
  /** 触发告警的测点名（binding.dataPoint） */
  pointName?: string
  /** 测点当前值 */
  currentValue?: number | string | null
  /** 告警阈值 */
  threshold?: number | string | null
  /** 告警来源触发器 ID */
  triggerId?: string
  /** 时间戳 */
  timestamp: number
}

/** 图元事件载荷 */
interface CellEventPayload {
  /** 事件类型：click / dblclick / mouseenter / mouseleave / ... */
  eventType: string
  /** 图元 ID */
  cellId: string
  /** 图元 shape */
  shape: string
  /** 图元数据 (cell.getData()) */
  data: Record<string, any>
  /** 原始 X6 事件对象 */
  rawEvent?: any
}

/** 触发器动作触发载荷 */
interface ActionTriggeredPayload {
  /** 图元 ID */
  cellId: string
  /** 触发器 ID */
  triggerId: string
  /** 行为类型：alert / openDialog / jumpPage / sendMsg / ... */
  actionType: string
  /** 行为参数 */
  actionValue: any
  /** 当前测点值 */
  tagValue: number | string | null
  /** 是否命中条件 */
  matched: boolean
  /** 触发该动作的绑定配置（含 device、dataPoint、mappingRules 等） */
  binding?: any
  /** 触发该动作的触发器配置 */
  triggerConfig?: any
  /** 图元完整数据（含 binding、eventConfig 等） */
  cellData?: Record<string, any>
  /** 图元 shape */
  shape?: string
}

const graphContainer = ref<HTMLElement | null>(null)
const graph = shallowRef<Graph | null>(null)

// ============ 调试面板内部日志 ============

interface EventLogEntry {
  time: string
  eventType: string
  cellId: string
  shape: string
  data: Record<string, any>
}
interface DataLogEntry {
  time: string
  count: number
  preview: string
}
interface ActionLogEntry {
  time: string
  actionType: string
  cellId: string
  summary: string
  detail: any
}

const eventLog = ref<EventLogEntry[]>([])
const dataLog = ref<DataLogEntry[]>([])
const actionLog = ref<ActionLogEntry[]>([])

const lastEventDetail = computed(() => {
  const last = eventLog.value[eventLog.value.length - 1]
  if (!last) return '// 暂无事件'
  return JSON.stringify(
    {
      eventType: last.eventType,
      cellId: last.cellId,
      shape: last.shape,
      data: last.data,
    },
    null,
    2,
  )
})

function pushEventLog(entry: EventLogEntry) {
  eventLog.value.push(entry)
  if (eventLog.value.length > 50) eventLog.value.shift()
}

function pushDataLog(entry: DataLogEntry) {
  dataLog.value.push(entry)
  if (dataLog.value.length > 30) dataLog.value.shift()
}

function pushActionLog(entry: ActionLogEntry) {
  actionLog.value.push(entry)
  if (actionLog.value.length > 100) actionLog.value.shift()
}

function handleClearLog(type: 'event' | 'action') {
  if (type === 'event') eventLog.value = []
  else if (type === 'action') actionLog.value = []
}

// ============ 事件相关 UI 状态 ============

const confirmVisible = ref(false)
const confirmLoading = ref(false)
const confirmRequest = ref<ConfirmRequest | null>(null)

/** 脚本执行日志：累积最近 50 条，emit 给外部 */
const scriptLogs = ref<{ level: string; msg: string; time: string }[]>([])

const onCustomCodeExec = (level: 'info' | 'warn' | 'error', msg: string) => {
  const entry = { level, msg, time: new Date().toLocaleTimeString() }
  scriptLogs.value.push(entry)
  if (scriptLogs.value.length > 50) scriptLogs.value.shift()
  emit('action-triggered', {
    cellId: '',
    triggerId: '',
    actionType: 'script-log',
    actionValue: entry,
    tagValue: null,
    matched: true,
  })
}

/** 行为提示（内部不再显示 UI，仅通知外部） */
function showActionMessage(msg: string) {
  emit('action-triggered', {
    cellId: '',
    triggerId: '',
    actionType: 'message',
    actionValue: { message: msg },
    tagValue: null,
    matched: true,
  })
}

/** 复制文本到剪贴板，带 toast 提示 */
function copyText(text: string, label = '内容') {
  if (!text) return
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => Message.success(`${label}已复制`),
      () => Message.warning('复制失败，请手动选择复制'),
    )
  } else {
    // fallback：临时 textarea
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      Message.success(`${label}已复制`)
    } catch {
      Message.warning('复制失败，请手动选择复制')
    }
    document.body.removeChild(ta)
  }
}

/** 请求外部确认弹窗（内部 Modal 保留，确认后通过事件通知外部） */
function requestConfirm(req: ConfirmRequest): boolean {
  confirmRequest.value = req
  confirmLoading.value = false
  confirmVisible.value = true
  return true
}

function handleConfirmOk() {
  const req = confirmRequest.value
  if (!req) {
    confirmVisible.value = false
    return
  }
  confirmLoading.value = true
  try {
    req.onConfirm()
    // 确认后通知外部（带上来源 trigger 上下文 + 结构化数据）
    const actionValue: Record<string, any> = {
      kind: req.kind,
      title: req.title,
      content: req.content,      // 可读摘要字符串（Modal 显示用，宿主也可用）
      confirmed: true,
    }
    // controlDevice 专用：结构化字段，宿主直接读不需要 parse JSON
    if (req.devicePayload) {
      actionValue.deviceId = req.devicePayload.deviceId
      actionValue.deviceName = req.devicePayload.deviceName
      actionValue.command = req.devicePayload.command
      actionValue.param = req.devicePayload.param
      if (req.devicePayload.cmdObj) actionValue.commandObj = req.devicePayload.cmdObj
      if (req.devicePayload.paramObj) actionValue.paramObj = req.devicePayload.paramObj
    }
    emit('action-triggered', {
      cellId: req.cellId ?? '',
      triggerId: req.triggerId ?? '',
      actionType: 'confirm',
      actionValue,
      tagValue: req.tagValue ?? null,
      matched: true,
    })
  } finally {
    setTimeout(() => {
      confirmLoading.value = false
      confirmVisible.value = false
      confirmRequest.value = null
    }, 300)
  }
}

function handleConfirmCancel() {
  const req = confirmRequest.value
  confirmVisible.value = false
  // 取消也通知外部
  emit('action-triggered', {
    cellId: req?.cellId ?? '',
    triggerId: req?.triggerId ?? '',
    actionType: 'confirm',
    actionValue: {
      kind: req?.kind,
      title: req?.title,
      content: req?.content,
      confirmed: false,
    },
    tagValue: req?.tagValue ?? null,
    matched: false,
  })
  confirmRequest.value = null
}

// ============ 绑定数据 & 执行器 ============

/** 实时绑定数据源：key = "cellId:device:dataPoint"（与 store 中 bindingConfig.values 同步） */
const bindingValues = ref<Record<string, number | string | null>>({
  ...canvasStore.bindingConfig.values,
})

/** 更新单个绑定测点的值 */
const setBindingValue = (
  cellId: string,
  device: string,
  dataPoint: string,
  value: number | string | null,
) => {
  const key = `${cellId}:${device}:${dataPoint}`
  bindingValues.value[key] = value
  // 同步到全局 store
  canvasStore.bindingConfig.values[key] = value
}

/** 从 store.bindingConfig.values 同步到本地 bindingValues */
function syncPointValues() {
  const sv = canvasStore.bindingConfig.values
  if (!sv) return
  Object.entries(sv).forEach(([key, val]) => {
    bindingValues.value[key] = val
  })
}

/** 生成动作摘要文本 */
function buildActionSummary(info: ActionTriggeredPayload): string {
  const av = info.actionValue || {}
  const b = info.binding || {}
  const deviceInfo = b.device ? `[${b.device}:${b.dataPoint}]` : ''
  switch (info.actionType) {
    case 'alert':
      return `${deviceInfo} ⚠ ${av.message || '告警触发'}`
    case 'openDialog':
      return `${deviceInfo} → ${av.title || '打开业务弹窗'}`
    case 'confirm':
      return `${deviceInfo} ${av.title || '确认'} ${av.confirmed ? '✓' : '✗'}`
    case 'message':
      return `${deviceInfo} 📢 ${av.message || '消息'}`
    case 'writePoint':
      return `${deviceInfo} 下发指令: ${av.command || av.message || ''}`
    case 'jumpPage':
      return `${deviceInfo} 跳转: ${av.url || ''}`
    case 'runScript':
      return `${deviceInfo} 脚本执行: ${av.success ? '成功' : '失败'}`
    case 'script-log': {
      const level = av.level || 'info'
      const icon = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝'
      return `${icon} [${level}] ${av.msg || ''}`
    }
    case 'event-callback': {
      return `🔔 外部回调 [${av.type}] item=${av.item?.id ?? av.item}${av.extras?.length ? ' extras=' + JSON.stringify(av.extras) : ''}`
    }
    case 'outer-request': {
      const icon = av.success ? '✅' : '❌'
      const evtInfo = info.triggerId ? `[${info.triggerId}] ` : ''
      const skipped = av.success ? '' : ' → 已放弃执行内部动作'
      return `${icon} 前置请求 ${evtInfo}${av.success ? '成功' : '失败'} (${av.durationMs}ms)${av.error ? ' ' + av.error : ''}${skipped}`
    }
    case 'sendMsg':
      return `${deviceInfo} 发送消息[${av.notifyType || ''}→${av.receiver || ''}]: ${av.content || av.message || ''}`
    default:
      return `${deviceInfo} ${info.actionType}`
  }
}

/** 绑定执行器 */
const {
  tick: bindingTick,
  reset: resetBinding,
  runBindingTest,
  startPolling,
  stopPolling,
  refresh: refreshBinding,
  pauseMultiState,
  resumeMultiState,
} = useBindingExecutor({
  getGraph: () => graph.value,
  showActionMessage,
  requestConfirm: (req: any) => requestConfirm(req),
  onActionTriggered: (info) => {
    // 内部追踪日志
    const summary = buildActionSummary(info)
    pushActionLog({
      time: new Date().toLocaleTimeString(),
      actionType: info.actionType,
      cellId: info.cellId,
      summary,
      detail: info,
    })
    // 向外 emit
    emit('action-triggered', info)

    // Phase 1 新增：告警收集（enableAlarmEmit 开启时）
    if (props.enableAlarmEmit && info.actionType === 'alert') {
      const cellData = info.cellData || {}
      const actionValue = (info as any).actionValue || {}
      const triggerId = info.triggerId || ''
      const bindObj = (info as any).binding || {}
      const deviceKey =
        bindObj.device || cellData.deviceKey || cellData.deviceId || cellData.id || ''
      const isRecover = !!(info as any).isRecover

      if (isRecover) {
        // ── 恢复事件：直接 emit（不等 tick 结束） ──
        //    业务层 onKoruAlarms 收到后调 updateDeviceAlarm(clear=true)
        emit('alarm', [{
          deviceKey,
          cellId: info.cellId,
          level: (actionValue.level as 'warning' | 'critical') || 'warning',
          message: `${deviceKey} 恢复正常`,
          pointName: bindObj.dataPoint,
          currentValue: (info as any).tagValue,
          triggerId,
          timestamp: Date.now(),
          clear: true,  // ← 标记：这是恢复事件
        }])
      } else {
        // ── 越限事件：进 buffer（一轮 tick 内去重，tick 结束后统一 emit） ──
        const dedupKey = `${info.cellId}:${triggerId}`
        _alarmBuffer.set(dedupKey, {
          deviceKey,
          cellId: info.cellId,
          level: (actionValue.level as 'warning' | 'critical') || 'warning',
          message: actionValue.message || info.actionType,
          pointName: bindObj.dataPoint,
          currentValue: (info as any).tagValue,
          triggerId,
          timestamp: Date.now(),
        })
      }
    }
  },
  readTagValue: (cellId: string, device: string, dataPoint: string) => {
    const val = bindingValues.value[`${cellId}:${device}:${dataPoint}`]
    return val !== undefined ? val : null
  },
  // Phase 1 新增：一轮 tick 结束后 flush 告警缓冲
  onTickComplete: () => {
    if (_alarmBuffer.size > 0) {
      emit('alarm', Array.from(_alarmBuffer.values()))
      _alarmBuffer.clear()
    }
  },
  sendCommand: async (cmd: string) => {
    showActionMessage(`指令已发送：${cmd}`)
  },
  // 动态读取 store.bindingConfig.fetchData（避免初始化时闭包捕获 undefined 的问题）
  fetchData: () =>
    canvasStore.bindingConfig.fetchData
      ? canvasStore.bindingConfig.fetchData([])
      : Promise.resolve(undefined),
  onDataUpdate: (data) => {
    // 同步到内部 bindingValues，使 readTagValue 能立即读取
    Object.entries(data).forEach(([key, val]) => {
      bindingValues.value[key] = val
    })
    // 内部追踪数据更新日志
    const entries = Object.entries(data)
    if (entries.length > 0) {
      const time = new Date().toLocaleTimeString()
      const preview = entries
        .slice(0, 3)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
      pushDataLog({ time, count: entries.length, preview })
    }
    // 向外 emit
    emit('data-updated', data)
  },
})

// ============ 测试工具面板显隐 ============

const showTestTools = ref(props.showTestTools)

// ============ 创建只读 Graph ============

function createReadonlyGraph(container: HTMLElement): Graph {
  // 先确保基础形状注册（X6 Graph.registerNode 是全局静态的，但这里保险起见）
  const g = new Graph({
    container,
    grid: false,
    connecting: {
      router: 'manhattan',
      connector: { name: 'rounded', args: { radius: 8 } },
      anchor: 'center',
      connectionPoint: 'anchor',
      allowBlank: false,
      allowEdge: false,
      allowNode: false,
      allowLoop: false,
      allowPort: false,
      allowMulti: false,
    },
    // interacting 函数形式：X6 3.x 签名 (this: Graph, cellView) => InteractionMap
    // Preview 模式整体不可移动；注意：不能对子元素返回 nodeMovable: false，会阻断 X6 parent-child 传播
    interacting: (cellView: any) => {
      const hasParent = !!cellView?.cell?.getParent?.()
      return {
        nodeMovable: false,        // Preview 模式整体不可移动
        edgeMovable: false,
        magnetConnectable: false,
        // 子元素禁连线能力（但不禁用 nodeMovable，保持结构一致）
        toolsAddable: false,
      }
    },
    mousewheel: {
      enabled: true,
      zoomAtMousePosition: true,
      modifiers: 'ctrl',
      minScale: 0.5,
      maxScale: 3,
    },
    // 预览模式：允许直接鼠标拖动画布（平移），无需按 Ctrl
    // 宿主可通过 allowCanvasPan prop 或 setPanningEnabled() 动态开关
    panning: { enabled: props.allowCanvasPan },
    sorting: 'approx',
  } as any)

  // === 关键：加 Selection 插件，否则 setSelectionFilter 会被可选链静默跳过 ===
  // 三道防线第一道（Selection filter）必须有这个插件才能生效
  g.use(
    new Selection({
      rubberband: false,
      showNodeSelectionBox: false,
      movable: false,
    }),
  )
  // Selection filter：拦截所有 group 成员（有父节点，根本进不了 selection）
  g.setSelectionFilter((cell: any) => !cell?.getParent?.())

  // monkey-patch fromJSON —— 建模后延迟应用所有 group 成员的 DOM 保护
  // （和 useKoruGraphEditor 里的 patchedFromJSON 逻辑一致）
  const origFromJSON = g.fromJSON.bind(g)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  g.fromJSON = function patchedFromJSON(this: any, ...args: any[]) {
    const result = origFromJSON(...(args as [any]))
    // 四轮延迟：rAF + 50ms + 200ms + 500ms，兜底 DOM 渲染延迟
    const applyProtection = () => {
      const cells = g.getCells?.() || []
      cells.forEach((cell: any) => {
        if (cell?.getParent?.()) {
          const view = g.findViewByCell?.(cell)
          if (view?.container) {
            ;(view.container as HTMLElement).style.pointerEvents = 'none'
          }
        }
      })
    }
    requestAnimationFrame(applyProtection)
    setTimeout(applyProtection, 50)
    setTimeout(applyProtection, 200)
    setTimeout(applyProtection, 500)
    return result
  }

  return g
}

/** 已注册的 SVG 形状名集合（避免重复注册） */
const registeredSvgShapes = new Set<string>()

/** 注册 SVG 自定义形状 + mount defs（从 store 读 customShapes，main.ts bootstrapKoru 里已注入） */
function registerSvgShapes() {
  const shapes: CustomShapeItem[] = canvasStore.componentConfig.customShapes || []
  if (!shapes.length) return
  shapes.forEach((item, index) => {
    const shapeName = `svg-node-${index}`
    if (!registeredSvgShapes.has(shapeName)) {
      registerSvgNode(item, index)
      registeredSvgShapes.add(shapeName)
    }
  })
  // mount SVG defs 到 graph container（每个 graph 实例各调一次）
  const g = graph.value
  if (g) {
    const allDefs = shapes.map(s => s.defs).filter(Boolean).join('\n')
    if (allDefs) mountSvgDefs(g, allDefs)
  }
}

/** 统一拆解：兼容 X6 原生 / 后端 API 包装 / KoruGraphData 三种输入 */
function _unwrapDiagramInput(raw: any): { cells: any[]; canvas?: any } {
  if (!raw) return { cells: [] }
  // 后端 API 包装 { diagram_data: { cells, canvas } }
  if (raw.diagram_data && typeof raw.diagram_data === 'object') {
    return { cells: raw.diagram_data.cells || [], canvas: raw.diagram_data.canvas }
  }
  // X6 原生
  if (Array.isArray(raw.cells)) {
    return { cells: raw.cells, canvas: raw.canvas }
  }
  return { cells: [] }
}

/** 加载图数据到画布 */
function loadData(data: any) {
  const g = graph.value
  if (!g) return
  try {
    // 先注册 SVG 自定义形状，确保 fromJSON 能正确解析 svg-node-* 节点
    registerSvgShapes()
    g.clearCells()

    const { cells, canvas } = _unwrapDiagramInput(data)

    // 用 container visibility 隐藏，避免 fromJSON → centerContent 两帧闪烁
    const container = g.container as HTMLElement | undefined
    const centerEnabled = canvasStore.componentConfig.centerContent
    if (centerEnabled && container) container.style.visibility = 'hidden'

    g.fromJSON({ cells, ...(canvas ? { canvas } : {}) })

    // ⚠️ 关键：X6 fromJSON 渲染 DOM 是异步的！必须等 DOM 创建完成后再调 cell.attr() 触发 className 渲染
    // 用四轮延迟（和 patchedFromJSON 对齐）—— 让 DOM 完全就绪
    const deferredApply = (round: number) => {
      try {
        const allCells = g.getCells?.() || []
        console.log(`[KoruPreview] deferredApply round=${round} cells=${allCells.length}`)
        allCells.forEach((cell: any) => applyAnimationFromData(cell, g))
      } catch (e) {
        console.warn('[KoruPreview] applyAnimationFromData 失败:', e)
      }
      dumpAllAnimClasses(g)
    }
    requestAnimationFrame(() => deferredApply(1))
    setTimeout(() => deferredApply(2), 50)
    setTimeout(() => deferredApply(3), 200)
    setTimeout(() => deferredApply(4), 500)

    // 恢复画布配置（背景、网格等）
    if (data.canvas) {
      const restored = deserializeKoruCanvasConfig(data.canvas)
      try {
        applyKoruCanvasConfig(g, restored)
      } catch (e) {
        console.warn('[KoruPreview] 画布配置恢复失败:', e)
      }
    }

    // 居中图纸（和 Editor 的 loadDiagram 对齐；可通过 setComponentConfig({ centerContent: false }) 关闭）
    if (centerEnabled) {
      g.centerContent()
    }
    if (container) container.style.visibility = ''

    // 数据加载后同步外部测点值
    syncPointValues()
    // 执行一次绑定 tick
    bindingTick()
  } catch (e) {
    console.error('[KoruPreview] 数据加载失败:', e)
  }
}

onMounted(() => {
  if (!graphContainer.value) return
  const g = createReadonlyGraph(graphContainer.value)
  graph.value = g
  loadData(props.graph as any)

  // 设备选项：优先用 store.deviceConfig.deviceOptions（宿主 onReady 后 setDeviceConfig 填充），
  // 没有则从 graph cells 构建 fallback（加延迟等 fromJSON 完成）
  const buildFromGraphCells = () => {
    const cells = g.getCells?.() || []
    const opts: { label: string; value: string }[] = []
    const seen = new Set<string>()
    cells.forEach((cell: any) => {
      if (!cell || cell.isEdge?.()) return
      const d = cell.getData?.() || cell.data || {}
      const id = d.deviceKey || d.deviceId || cell.id
      if (!id || seen.has(id)) return
      seen.add(id)
      const name = d.deviceName || d.name || d.label || cell.attrs?.label?.text || id
      opts.push({ label: `${name}（${id}）`, value: id })
    })
    return opts
  }
  // getter：每次调用时求值，响应式拿 store 最新值；store 空时 fallback
  const getDeviceOptions = () => {
    const storeOpts = canvasStore.deviceConfig.deviceOptions
    if (storeOpts && storeOpts.length) return storeOpts
    return buildFromGraphCells()
  }

  // 绑定事件动作系统
  const { bindNodeEvents } = useEventActions({
    getGraph: () => graph.value,
    showActionMessage,
    requestConfirm,
    deviceOptions: getDeviceOptions,   // getter，每次调用时取最新值
    onCustomCodeExec,
    // 宿主传入的外部前置请求 API
    outerRequestApi: props.outerRequestApi,
    // $topoEventCallBack → emit 给宿主
    eventBus: (type: string, item: any, ...extras: any[]) => {
      emit('action-triggered', {
        cellId: item?.id || '',
        triggerId: '',
        actionType: 'event-callback',
        actionValue: { type, item, extras },
        tagValue: null,
        matched: true,
      })
    },
    // 外部前置请求结果 → emit 给宿主
    onOuterRequestResult: (result) => {
      emit('action-triggered', {
        cellId: '',
        triggerId: result.evtId,
        actionType: 'outer-request',
        actionValue: result,
        tagValue: null,
        matched: result.success,
      })
    },
    // 图元事件回调：内部追踪日志 + 向外 emit
    onCellEvent: (cell: any, eventType: string, rawEvent: any) => {
      const payload = {
        eventType,
        cellId: cell.id,
        shape: cell.shape || '',
        data: cell.getData?.() || {},
        rawEvent,
      }
      // 内部追踪事件日志
      pushEventLog({
        time: new Date().toLocaleTimeString(),
        eventType: payload.eventType,
        cellId: payload.cellId,
        shape: payload.shape,
        data: payload.data,
      })
      // 向外 emit
      emit('cell-event', payload)
    },
  })
  bindNodeEvents()

  // === Phase 1 新增：device-click 事件 ===
  // 点击节点 → 用 _findDeviceCell 找设备节点（自动处理 groupId 父子关系）→ emit device-click
  g.on('node:click', ({ node, e }: { node: any; e: any }) => {
    const cellData = node.getData?.() || {}
    const clickedKey =
      cellData.deviceKey || cellData.deviceId || cellData.id || node.id || ''
    // 优先用公共 helper 找（自动跳过 groupId 成员，返回父容器）
    const found = _findDeviceCell(g, clickedKey)
    const deviceNode = found?.cell || node
    const deviceData = found?.data || cellData
    const deviceKey =
      deviceData.deviceKey || deviceData.deviceId || deviceNode.id || ''
    if (!deviceKey) return
    emit('device-click', {
      cellId: node.id,
      deviceCellId: deviceNode.id,
      deviceKey,
      deviceName: deviceData.deviceName || deviceData.name,
      bindings: deviceData.binding?.bindings || [],
      cellData: deviceData,
      rawEvent: e,
    })
  })

  // 如果配置了 fetchData，启动自动轮询
  if (canvasStore.bindingConfig.fetchData && (canvasStore.bindingConfig.pollInterval ?? 0) > 0) {
    startPolling(canvasStore.bindingConfig.pollInterval!)
  }

  emit('ready', _exposedAPI)
})

onBeforeUnmount(() => {
  resetBinding()
  graph.value?.dispose()
  graph.value = null
  emit('destroyed')
})

// 外部数据变化时重新加载
watch(
  () => props.graph,
  (data) => {
    if (data && graph.value) {
      loadData(data as any)
    }
  },
  { deep: true },
)

// showTestTools prop 变化
watch(
  () => props.showTestTools,
  (v) => {
    showTestTools.value = v
  },
)

// allowCanvasPan 变化时动态更新 panning 开关
watch(
  () => props.allowCanvasPan,
  (v) => {
    const g = graph.value
    if (g) {
      if (v) g.enablePanning()
      else g.disablePanning()
    }
  },
)

// fetchData 变化时重新绑定轮询（监听 store 变化）
watch(
  () => canvasStore.bindingConfig.fetchData,
  (fn) => {
    if (fn && (canvasStore.bindingConfig.pollInterval ?? 0) > 0) {
      startPolling(canvasStore.bindingConfig.pollInterval!)
    } else {
      stopPolling()
    }
  },
)

// pollInterval 变化时重启轮询
watch(
  () => canvasStore.bindingConfig.pollInterval,
  (interval) => {
    if (canvasStore.bindingConfig.fetchData && (interval ?? 0) > 0) {
      startPolling(interval!)
    } else {
      stopPolling()
    }
  },
)

/** ============ Phase 1 新增：设备高亮便捷 API ============ */

/** 当前正在高亮的 cellId 集合（内部跟踪，供 clearAllHighlights 使用） */
const _highlightedCellIds = new Set<string>()

/** Phase 1 新增：告警去重缓冲（一轮 bindingTick 内同一设备同一测点只保留一条） */
const _alarmBuffer = new Map<string, Alarm>()

/** highlightDevice 可选项 */
interface HighlightDeviceOptions {
  /** 高亮颜色，默认告警红 #f5222d */
  color?: string
  /** 高亮边框宽度，默认 3 */
  strokeWidth?: number
  /** 是否自动将视野滚到设备位置，默认 true */
  autoCenter?: boolean
  /** 高亮光晕类型：stroke=外框 / surround=外框+半透明填充，默认 stroke */
  highlighterType?: 'stroke' | 'surround'
}

/**
 * 工具函数：按 deviceKey 查找设备节点
 * 自动跳过 group 成员，找到其父容器返回（供 highlightDevice 和 device-click 共用）
 * 匹配策略：
 *   1) 顶层字段 deviceKey / deviceId（如果存在）
 *   2) data.binding.bindings[].device（Koru 保存的 bindings 里必带 device 字段 ✅ 真数据源）
 */
function _findDeviceCell(g: any, deviceKey: string): { cell: any; data: Record<string, any> } | null {
  if (!g || !deviceKey) return null
  const cells = g.getCells?.() || []
  for (const c of cells) {
    const d = c.getData?.() || {}
    // 策略 1：顶层字段（某些业务可能加）
    const topMatch = d.deviceKey === deviceKey || d.deviceId === deviceKey
    // 策略 2：bindings 里的 device ← 主要命中
    const bindings = d.binding?.bindings || d.bindings || []
    const bindMatch = bindings.some((b: any) => b?.device === deviceKey)

    if (topMatch || bindMatch) {
      // 如果是 group 成员，沿 parent 链向上找根容器；没有 parent 就返回自己
      const parent = c.getParent?.()
      if (parent) {
        const pd = parent.getData?.() || {}
        return { cell: parent, data: pd }
      }
      return { cell: c, data: d }
    }
  }
  return null
}

/** 便捷 API：按设备名高亮（红框闪烁） */
function _highlightDevice(deviceKey: string, opts?: HighlightDeviceOptions): boolean {
  if (!props.enableHighlight) {
    console.warn('[highlightDevice] enableHighlight=false')
    return false
  }
  const g = graph.value
  if (!g) {
    console.warn('[highlightDevice] graph=null')
    return false
  }
  const found = _findDeviceCell(g, deviceKey)
  if (!found) {
    console.warn(`[highlightDevice] deviceKey="${deviceKey}" 没找到对应 cell!`)
    // dump 所有 cells 的 bindings 帮助诊断
    const allCells = g.getCells?.() || []
    for (const c of allCells) {
      const d = c.getData?.() || {}
      const bs = d.binding?.bindings || d.bindings || []
      const ds = bs.map((b: any) => `${b.device}.${b.dataPoint}`).join(', ')
      if (ds) console.warn(`  cell ${c.id} bindings: ${ds}`)
    }
    return false
  }
  const { cell } = found
  const color = opts?.color || '#f5222d'
  const strokeWidth = opts?.strokeWidth ?? 3
  const autoCenter = opts?.autoCenter !== false
  const highlighterType = opts?.highlighterType || 'stroke'

  const view = g.findViewByCell?.(cell)
  if (!view) {
    console.warn(`[highlightDevice] cell ${cell.id} 没有渲染 view`)
    return false
  }

  console.log(`[highlightDevice] ✅ cell=${cell.id} view found`)

  // ── 绝对生效版：用 cellId 从整个 canvas SVG 找元素 ──
  try {
    // X6 给每个 cell 的 <g> 元素加了 data-cell-id 属性
    const canvas = g.container
    const cellG = canvas.querySelector(`[data-cell-id="${cell.id}"]`) ||
                  canvas.querySelector(`[cell-id="${cell.id}"]`)
    const target = (cellG as any) || (view as any).container

    if (target) {
      (cell as any).__koruHighlightPrev = {
        cssText: (target as HTMLElement).style?.cssText || '',
        attrStroke: target.getAttribute?.('stroke') || null,
        attrFill: target.getAttribute?.('fill') || null,
      }

      // 方式 A: 改 cell 里**所有可见 shape 元素**的 stroke（粗暴遍历）
      const shapeSelector = 'rect, circle, ellipse, polygon, polyline, path, line'
      const shapes = (target as Element).querySelectorAll?.(shapeSelector) || []
      shapes.forEach(s => {
        s.setAttribute?.('stroke', color)
        s.setAttribute?.('stroke-width', String(strokeWidth + 1))
        s.setAttribute?.('stroke-opacity', '1')
        const htmlS = s as unknown as HTMLElement
        if (htmlS.style) {
          htmlS.style.stroke = color
          htmlS.style.strokeWidth = String(strokeWidth + 1)
          htmlS.style.strokeOpacity = '1'
        }
      })

      // 方式 B: 给 cell 根 g 加 filter（整个 cell 红色外发光）
      if ((target as HTMLElement).style) {
        (target as HTMLElement).style.filter = `drop-shadow(0 0 4px ${color})`
      }

      console.log(`[highlightDevice] ✅ 绝对生效版: 找到 ${shapes.length} 个 shape 改 stroke`,
        'cellG?', !!cellG, 'target=', target.tagName)
    } else {
      console.warn('[highlightDevice] canvas 里没找到 cell 元素!')
    }
  } catch (e) {
    console.warn('[highlightDevice] 绝对生效版失败:', e)
  }

  _highlightedCellIds.add(cell.id)
  return true
}

/** 便捷 API：清除所有高亮 */
function _clearAllHighlights(): void {
  if (!props.enableHighlight) return
  const g = graph.value
  console.log(`[clearAllHighlights] 当前 tracked=${_highlightedCellIds.size} cells:`,
    Array.from(_highlightedCellIds))
  if (!g) {
    _highlightedCellIds.clear()
    return
  }
  _highlightedCellIds.forEach((id) => {
    const cell = g.getCellById?.(id)
    if (!cell) {
      console.warn(`[clearAllHighlights] cell ${id} 不存在`)
      return
    }

    // 用 cellId 从 canvas SVG 找元素
    const canvas = g.container
    const cellG = canvas.querySelector(`[data-cell-id="${id}"]`) ||
                  canvas.querySelector(`[cell-id="${id}"]`)
    const target = (cellG as Element) || (g.findViewByCell?.(cell) as any)?.container

    if (target) {
      // 恢复所有 shape 元素
      const shapes = (target as Element).querySelectorAll?.(
        'rect, circle, ellipse, polygon, polyline, path, line'
      ) || []
      shapes.forEach(s => {
        // 恢复为蓝色（custom-split 原始色是 #5F95FF）
        s.setAttribute?.('stroke', '#5F95FF')
        s.setAttribute?.('stroke-width', '1')
        s.setAttribute?.('stroke-opacity', '1')
        const htmlS = s as unknown as HTMLElement
        if (htmlS.style) {
          htmlS.style.stroke = '#5F95FF'
          htmlS.style.strokeWidth = '1'
          htmlS.style.strokeOpacity = '1'
        }
      })
      // 清除 filter
      if ((target as HTMLElement).style) {
        (target as HTMLElement).style.filter = ''
      }
      console.log(`[clearAllHighlights] ✅ 恢复 ${shapes.length} 个 shape`)
    }

    // 也调 X6 view.unhighlight（如果注册了 highlighter）
    const view = g.findViewByCell?.(cell)
    view?.unhighlight?.()
  })
  _highlightedCellIds.clear()
}

/** 便捷 API：滚到指定 cellId */
function _scrollToCell(cellId: string): boolean {
  const g = graph.value
  if (!g) return false
  const cell = g.getCellById?.(cellId)
  if (!cell) return false
  const bbox = cell.getBBox?.()
  const rect = g.container?.getBoundingClientRect?.()
  if (!bbox || !rect) return false
  g.translate(rect.width / 2 - bbox.center.x, rect.height / 2 - bbox.center.y)
  return true
}

/** 手动刷新（供 DebugPanel 调用） */
function handleRefresh() {
  refreshBinding()
}

const _exposedAPI = {
  getGraph: () => graph.value,
  /** Phase 1 新增：统一数据灌入入口（X6 原生 JSON） */
  loadDiagram: (data: { cells?: any[]; canvas?: any } | null | undefined) => {
    loadData(data as any)
  },
  /** Phase 1 新增：按 deviceKey 高亮设备（需 enableHighlight=true） */
  highlightDevice: (deviceKey: string, opts?: HighlightDeviceOptions) =>
    _highlightDevice(deviceKey, opts),
  /** Phase 1 新增：清除所有高亮 */
  clearAllHighlights: () => _clearAllHighlights(),
  /** Phase 1 新增：滚到指定 cellId */
  scrollToCell: (cellId: string) => _scrollToCell(cellId),
  /** Phase 1 新增：主动查询当前告警缓冲区里的告警（enableAlarmEmit 开启时有效） */
  getActiveAlarms: () => Array.from(_alarmBuffer.values()),
  /** 运行时开关：是否允许鼠标拖动画布（平移） */
  setPanningEnabled: (enabled: boolean) => {
    const g = graph.value
    if (!g) return
    if (enabled) g.enablePanning()
    else g.disablePanning()
  },
  /** 更新单个测点值并立即执行绑定 */
  setPointValue: (
    cellId: string,
    device: string,
    dataPoint: string,
    value: number | string | null,
  ) => {
    setBindingValue(cellId, device, dataPoint, value)
    bindingTick()
  },
  /** 批量更新测点值并立即执行绑定 */
  setPointValues: (values: Record<string, number | string | null>) => {
    Object.entries(values).forEach(([key, val]) => {
      bindingValues.value[key] = val
    })
    bindingTick()
  },
  /** 获取单个图元绑定信息 */
  getCellBindings: (cellId: string) => {
    const cell = graph.value?.getCellById?.(cellId)
    if (!cell) return []
    return cell.getData()?.binding?.bindings || []
  },
  /** 获取全部图元绑定信息 */
  getAllBindings: () => {
    const g = graph.value
    if (!g) return []
    const cells = g.getCells?.() || []
    const result: Array<{
      cellId: string
      shape: string
      bindings: any[]
    }> = []
    cells.forEach((cell: any) => {
      const data = cell.getData?.() || {}
      const bindings = data.binding?.bindings || []
      if (bindings.length > 0) {
        result.push({
          cellId: cell.id,
          shape: cell.shape || '',
          bindings,
        })
      }
    })
    return result
  },
  /** 获取全部图元（含 data 字段） */
  getAllCells: () => {
    const g = graph.value
    if (!g) return []
    const cells = g.getCells?.() || []
    return cells.map((cell: any) => ({
      id: cell.id,
      shape: cell.shape || '',
      position: cell.getPosition?.(),
      size: cell.getSize?.(),
      data: cell.getData?.() || {},
    }))
  },
  /** 执行全部绑定 tick */
  tick: bindingTick,
  /** 运行绑定测试 */
  runBindingTest,
  /** 启动自动数据轮询 */
  startPolling: (interval?: number) => {
    const iv = interval ?? canvasStore.bindingConfig.pollInterval
    if (canvasStore.bindingConfig.fetchData && (iv ?? 0) > 0) startPolling(iv!)
  },
  /** 停止自动数据轮询 */
  stopPolling,
  /** 手动触发数据刷新（拉取 + 绑定执行） */
  refresh: refreshBinding,
}
defineExpose(_exposedAPI)
</script>

<style scoped>
.koru-preview {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  overflow: hidden;
  display: flex;
}
.koru-preview__main {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
}
.koru-preview__canvas {
  width: 100%;
  height: 100%;
}
.koru-preview__confirm-content {
  white-space: pre-line;
  font-size: 14px;
  line-height: 1.6;
}

/* ── controlDevice 卡片美化 ── */
.koru-preview__confirm-device {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.device-card {
  border: 1px solid var(--color-border-2, #e5e6eb);
  border-radius: 6px;
  padding: 12px 16px;
  background: var(--color-fill-1, #fafbfc);
}
.device-card--device {
  background: linear-gradient(135deg, #e8f3ff 0%, #f0f7ff 100%);
  border-color: #bedaff;
}
.device-card--command {
  background: linear-gradient(135deg, #fff7e8 0%, #fffbef 100%);
  border-color: #ffd591;
}
.device-card--param {
  background: linear-gradient(135deg, #f0f9eb 0%, #f7fcf5 100%);
  border-color: #b7eb8f;
}
.device-card__label {
  font-size: 12px;
  color: var(--color-text-3, #86909c);
  font-weight: 500;
}
.device-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.device-card__value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1, #1d2129);
  font-family: 'SF Mono', Consolas, Monaco, monospace;
}
.device-card__value-sub {
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  color: #1a73df;
  margin-left: 2px;
}
.device-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.device-card__desc {
  font-size: 13px;
  color: var(--color-text-2, #4e5969);
  margin-bottom: 8px;
}
.device-card__raw {
  margin-top: 8px;
}
.device-card__raw :deep(.arco-collapse-item__content) {
  padding: 8px 12px;
  background: #1d2129;
  border-radius: 4px;
}
.device-card__raw pre {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #638ad1;
  font-family: 'SF Mono', Consolas, Monaco, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
.device-card__raw-text {
  font-family: 'SF Mono', Consolas, Monaco, monospace;
  font-size: 13px;
  color: var(--color-text-1, #1d2129);
  word-break: break-all;
}

/* 参数列表 */
.device-param-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.device-param-item {
  display: flex;
  align-items: baseline;
  font-size: 13px;
  line-height: 1.6;
}
.device-param-item__key {
  color: #165dff;
  font-family: 'SF Mono', Consolas, Monaco, monospace;
  font-weight: 500;
}
.device-param-item__eq {
  color: var(--color-text-3, #86909c);
  margin: 0 4px;
}
.device-param-item__val {
  color: var(--color-text-1, #1d2129);
  font-family: 'SF Mono', Consolas, Monaco, monospace;
  font-weight: 500;
}
.device-param-item__desc {
  color: var(--color-text-3, #86909c);
  font-size: 12px;
}

/* 底部警告 */
.device-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fff7e8;
  border: 1px solid #ffd591;
  border-radius: 6px;
  color: #d46b08;
  font-size: 13px;
}
.device-warning .icon-exclamation-circle-fill {
  font-size: 16px;
  color: #ff7d00;
  flex-shrink: 0;
}
.koru-preview__toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 30;
}

:deep(.arco-collapse-item-content){
  background-color: #090c12;
}
</style>
