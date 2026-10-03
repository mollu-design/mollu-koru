<template>
  <a-drawer
    :visible="show"
    title="🛠 调试面板"
    placement="right"
    :width="600"
    :footer="false"
    :unmount-on-close="false"
    :mask="false"
    @cancel="$emit('update:show', false)"
    :drawer-style="{ border: '1px solid var(--color-neutral-3)' }"
  >
    <!-- 头部工具栏 -->
    <div class="debug-header">
      <a-button size="mini" type="primary" @click="$emit('refresh')">手动刷新</a-button>
      <a-button size="mini" @click="handleLogData">输出图数据</a-button>
      <a-button size="mini" @click="handleLogBindings">输出绑定数据</a-button>
    </div>

    <!-- 测试工具区 -->
    <div class="debug-section">
      <div class="debug-section-title">📊 绑定测试工具</div>
      <KoruTestToolsPanel
        :graph="graph"
        :pause-multi-state="pauseMultiState"
        :resume-multi-state="resumeMultiState"
      />
    </div>

    <!-- 事件日志 -->
    <div class="debug-section">
      <div class="debug-section-header">
        <span class="debug-section-title">📋 事件回调日志</span>
        <a-button size="mini" type="text" @click="$emit('clear-log', 'event')">清空</a-button>
      </div>
      <div class="debug-log-body">
        <div
          v-for="(log, idx) in eventLog.slice().reverse()"
          :key="'e-' + idx"
          class="debug-log-item"
          :class="`debug-log-item--${log.eventType}`"
        >
          <span class="debug-log-time">{{ log.time }}</span>
          <span class="debug-log-type">[{{ log.eventType }}]</span>
          <span class="debug-log-cell">{{ log.cellId }}</span>
          <span class="debug-log-shape">({{ log.shape }})</span>
          <span
            v-if="log.data && (log.data.eventConfig?.enabled || log.data.binding?.bindings?.length)"
            class="debug-log-tag"
            >⚙</span
          >
        </div>
        <div v-if="eventLog.length === 0" class="debug-log-empty">
          点击画布上的图元查看事件回调信息...
        </div>
      </div>
    </div>

    <!-- 数据更新日志 -->
    <div class="debug-section">
      <div class="debug-section-header">
        <span class="debug-section-title">📡 数据更新日志</span>
      </div>
      <div class="debug-log-body">
        <div
          v-for="(log, idx) in dataLog.slice().reverse()"
          :key="'d-' + idx"
          class="debug-log-item debug-log-item--data"
        >
          <span class="debug-log-time">{{ log.time }}</span>
          <span>更新 {{ log.count }} 个测点</span>
          <span class="debug-log-detail">({{ log.preview }})</span>
        </div>
        <div v-if="dataLog.length === 0" class="debug-log-empty">
          开启模拟数据后这里会显示数据更新记录...
        </div>
      </div>
    </div>

    <!-- 触发器动作日志 -->
    <div class="debug-section">
      <div class="debug-section-header">
        <span class="debug-section-title">🔔 触发器动作日志</span>
        <a-button size="mini" type="text" @click="$emit('clear-log', 'action')">清空</a-button>
      </div>
      <div class="debug-log-body">
        <div
          v-for="(log, idx) in actionLog.slice().reverse()"
          :key="'a-' + idx"
          class="debug-log-item"
          :class="`debug-log-item--action-${log.actionType}`"
        >
          <span class="debug-log-time">{{ log.time }}</span>
          <span class="debug-log-type">[{{ log.actionType }}]</span>
          <span class="debug-log-cell">{{ log.cellId || '—' }}</span>
          <span class="debug-log-detail">{{ log.summary }}</span>
        </div>
        <div v-if="actionLog.length === 0" class="debug-log-empty">
          触发器命中后这里会显示动作记录...
        </div>
      </div>
    </div>

    <!-- 最后一次事件详情 -->
    <div class="debug-section">
      <div class="debug-section-header">
        <span class="debug-section-title">🔍 最后一次事件详情</span>
      </div>
      <pre class="debug-log-detail-block">{{ lastEventDetail }}</pre>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import type { Graph } from '@antv/x6'
import KoruTestToolsPanel from './KoruTestToolsPanel.vue'

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

const props = defineProps<{
  /** X6 Graph 实例 */
  graph: Graph | null
  /** 是否显示（作为 a-drawer 的 v-model:visible） */
  show: boolean
  /** 事件日志 */
  eventLog: EventLogEntry[]
  /** 数据更新日志 */
  dataLog: DataLogEntry[]
  /** 动作日志 */
  actionLog: ActionLogEntry[]
  /** 最后一次事件详情 JSON */
  lastEventDetail: string
  /** 暂停多状态自动切换（手动测试时） */
  pauseMultiState?: () => void
  /** 恢复多状态自动切换 */
  resumeMultiState?: () => void
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  refresh: []
  'log-data': []
  'log-bindings': []
  'clear-log': [type: 'event' | 'action']
}>()

function handleLogData() {
  const g = props.graph
  if (!g) {
    console.warn('[DebugPanel] 图实例尚未就绪')
    return
  }
  const json = g.toJSON()
  console.log('[DebugPanel] 图数据:', JSON.stringify(json, null, 2))
}

function handleLogBindings() {
  const g = props.graph
  if (!g) {
    console.warn('[DebugPanel] 图实例尚未就绪')
    return
  }
  const cells = g.getCells?.() || []
  const bindings: any[] = []
  cells.forEach((cell: any) => {
    const data = cell.getData?.() || {}
    const list = data.binding?.bindings || []
    list.forEach((b: any) => {
      bindings.push({
        cellId: cell.id,
        shape: cell.shape,
        device: b.device,
        dataPoint: b.dataPoint,
        targetProperty: b.targetProperty,
      })
    })
  })
  console.log('[DebugPanel] 绑定配置:', bindings)
  console.log('[DebugPanel] 绑定数量:', bindings.length)
}
</script>

<style scoped>
.debug-header {
  display: flex;
  gap: 6px;
  padding: 4px 0 8px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 4px;
}
.debug-section {
  border-bottom: 1px solid #f0f0f0;
  padding: 6px 0;
}
.debug-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}
.debug-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  padding: 4px 0;
}
.debug-section:last-child {
  border-bottom: none;
}
.debug-log-body {
  overflow-y: auto;
  padding: 4px 0;
  max-height: 200px;
  min-height: 40px;
}
.debug-log-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 0;
  font-size: 11px;
  font-family: 'Menlo', 'Consolas', monospace;
  border-bottom: 1px solid #f5f5f5;
}
.debug-log-time {
  color: #bbb;
  min-width: 60px;
}
.debug-log-type {
  font-weight: 600;
}
.debug-log-cell {
  color: #1890ff;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.debug-log-shape {
  color: #999;
  font-size: 10px;
}
.debug-log-tag {
  color: #faad14;
}
.debug-log-item--click .debug-log-type {
  color: #1890ff;
}
.debug-log-item--dblclick .debug-log-type {
  color: #722ed1;
}
.debug-log-item--mouseenter .debug-log-type {
  color: #52c41a;
}
.debug-log-item--mouseleave .debug-log-type {
  color: #fa8c16;
}
.debug-log-item--mouseup .debug-log-type {
  color: #eb2f96;
}
.debug-log-item--mousemove .debug-log-type {
  color: #13c2c2;
}
.debug-log-item--action-alert .debug-log-type {
  color: #f53f3f;
}
.debug-log-item--action-openDialog .debug-log-type {
  color: #722ed1;
}
.debug-log-item--action-confirm .debug-log-type {
  color: #fa8c16;
}
.debug-log-item--action-message .debug-log-type {
  color: #52c41a;
}
.debug-log-item--action-writePoint .debug-log-type {
  color: #13c2c2;
}
.debug-log-item--action-jumpPage .debug-log-type {
  color: #1890ff;
}
.debug-log-item--data {
  font-size: 11px;
  color: #333;
}
.debug-log-detail {
  color: #999;
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.debug-log-empty {
  padding: 16px 0;
  text-align: center;
  font-size: 11px;
  color: #bbb;
}
.debug-log-detail-block {
  margin: 0;
  padding: 8px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 11px;
  font-family: 'Menlo', 'Consolas', monospace;
  white-space: pre-wrap;
  max-height: 180px;
  overflow: auto;
}
</style>
