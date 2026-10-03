<template>
  <div class="demo-page">
    <div class="demo-toolbar">
      <div class="demo-info">
        <span class="demo-badge demo-badge--preview">预览模式</span>
        <span>只读查看，不可编辑</span>
        <span class="demo-sep">|</span>
        <label class="demo-label">
          <input type="checkbox" v-model="enableMockData" />
          <span>模拟接口数据（自动轮询 2s）</span>
        </label>
      </div>
      <div class="demo-actions">
        <button class="demo-btn" @click="manualRefresh" :disabled="!enableMockData">
          手动刷新数据
        </button>
        <button class="demo-btn" @click="logData">输出图数据</button>
        <button class="demo-btn" @click="logBindingValues">输出绑定数据</button>
        <button class="demo-btn" @click="testFlatten">测试展平</button>
        <button class="demo-btn" @click="logKeys">输出订阅Keys</button>
      </div>
    </div>

    <div class="demo-main">
      <!-- 画布区域（调试面板已内置在 KoruPreview 中） -->
      <div class="demo-canvas-wrapper">
        <div v-if="loading" class="demo-loading">加载中...</div>
        <koru-preview
          v-else-if="hasData"
          ref="previewRef"
          v-model:graph="graphData"
          :outer-request-api="mockOuterRequestApi"
          :show-test-tools="showTestTools"
          :allow-canvas-pan="false"
          @cell-event="onCellEvent"
          @data-updated="onDataUpdated"
          @action-triggered="onActionTriggered"
        />
        <div v-else class="demo-loading">暂无数据，请先在编辑模式下创建并保存</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Notification } from '@arco-design/web-vue'
import {
  KoruPreview,
  dbGet,
  buildFetchData,
  flattenBindingData,
  extractBindingKeys,
  collectBindingRegistry,
  setBindingConfig,
  useCanvasStore,
} from '@mollu/koru/topology'
import type { BindingRegistryItem, GroupedBindingDataItem } from '@mollu/koru/topology'

const SAVE_KEY = 'koru-diagram-data'

const graphData = ref<any>({ nodes: [], edges: [] })
const loading = ref(true)
const enableMockData = ref(false)
const showTestTools = ref(true) // 默认打开内置调试面板
const previewRef = ref<any>(null)

let mockCounter = 0
const mockTickTimer = setInterval(() => {
  mockCounter++
}, 1000)

// ============ 绑定注册表 + fetchData 示例 ============

/** 从保存的数据中提取 bindingRegistry（实际项目中由保存接口回传） */
const bindingRegistry = ref<BindingRegistryItem[]>([])

/** 数据源函数：模拟后端返回扁平格式数据 */
const mockDataSource = async (): Promise<Record<string, number | string | null>> => {
  await new Promise((r) => setTimeout(r, 100))
  const result: Record<string, number | string | null> = {}
  const registry = bindingRegistry.value
  registry.forEach((item) => {
    item.bindings.forEach((b) => {
      const key = `${item.cellId}:${b.device}:${b.dataPoint}`
      const tp = b.targetProperty
      if (tp === 'fill' || tp === 'stroke') {
        const colors = ['#165dff', '#00b42a', '#ff7d00', '#f53f3f', '#722ed1']
        result[key] = colors[mockCounter % colors.length]
      } else if (tp === 'nodeAnim') {
        const anims = ['none', 'opacityBreath', 'motorSpin', 'glowBreath']
        result[key] = anims[mockCounter % anims.length]
      } else if (tp === 'visible') {
        result[key] = mockCounter % 3 === 0 ? 'false' : 'true'
      } else {
        result[key] = 50 + ((mockCounter * 17) % 100)
      }
    })
  })
  return result
}

/** 数据源函数：模拟后端返回分组格式数据 */
const mockGroupedDataSource = async (): Promise<GroupedBindingDataItem[]> => {
  await new Promise((r) => setTimeout(r, 100))
  const result: GroupedBindingDataItem[] = bindingRegistry.value.map((item) => ({
    cellId: item.cellId,
    data: item.bindings.map((b) => ({
      device: b.device,
      dataPoint: b.dataPoint,
      value: Math.round(50 + Math.random() * 50),
    })),
  }))
  return result
}

/** 使用 buildFetchData 构建最终的 fetchData 函数 */
const mockFetchData = buildFetchData(bindingRegistry.value, mockDataSource)

let useGroupedFormat = false
const mockFetchDataGrouped = buildFetchData(bindingRegistry.value, mockGroupedDataSource, {
  inputFormat: 'grouped',
})

/** Mock 外部前置请求 API */
async function mockOuterRequestApi(cfg: any): Promise<boolean> {
  const delay = 100 + Math.random() * 400
  await new Promise((r) => setTimeout(r, delay))
  const ok = Math.random() > 0.1
  if (!ok) {
    throw new Error('模拟外部接口返回 500 Server Error')
  }
  console.log('[PreviewDemo] mock outerRequestApi 成功:', {
    nodeId: cfg.node?.id,
    eventId: cfg.eventItem?.id,
    url: cfg.url || '(未配置，宿主自定义)',
  })
  return true
}

function toggleDataSourceFormat() {
  useGroupedFormat = !useGroupedFormat
  if (useGroupedFormat) {
    console.log('[PreviewDemo] 切换到分组格式数据源')
  } else {
    console.log('[PreviewDemo] 切换到扁平格式数据源')
  }
}

/** 手动测试 flattenBindingData */
function testFlatten() {
  const grouped: GroupedBindingDataItem[] = [
    {
      cellId: 'test-node-1',
      data: [
        { device: 'DEV-1', dataPoint: '温度', value: 36.5 },
        { device: 'DEV-1', dataPoint: '状态', value: 'normal' },
      ],
    },
  ]
  const flat = flattenBindingData(grouped)
  console.log('[PreviewDemo] flattenBindingData 测试:', flat)
  alert(`展平结果: ${JSON.stringify(flat, null, 2)}`)
}

const hasData = computed(() => {
  const d = graphData.value
  return d.cells?.length > 0 || d.nodes?.length > 0 || d.edges?.length > 0
})

/** 配置绑定/测试的全局配置 */
function configureBindingConfig() {
  setBindingConfig({
    values: {},
    setValue: (cellId, device, dataPoint, value) => {
      const key = `${cellId}:${device}:${dataPoint}`
      const store = useCanvasStore()
      store.bindingConfig.values[key] = value
    },
    tick: () => {
      const store = useCanvasStore()
      store.propActiveTab.value = Date.now() + ''
    },
    runTest: (val) => {
      return []
    },
    fetchData: enableMockData.value ? mockFetchData : undefined,
    pollInterval: enableMockData.value ? 2000 : 0,
  })
}

watch(enableMockData, () => {
  configureBindingConfig()
})

onMounted(async () => {
  try {
    const raw = await dbGet(SAVE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      graphData.value = parsed.cells
        ? { cells: parsed.cells, canvas: parsed.canvas }
        : { nodes: [], edges: [] }

      if (parsed.cells?.length) {
        const tempGraph: any = {
          getCells: () => parsed.cells,
        }
        bindingRegistry.value = collectBindingRegistry(tempGraph)
        console.log('[PreviewDemo] 重建 bindingRegistry:', bindingRegistry.value)
        console.log('[PreviewDemo] 订阅 Keys:', extractBindingKeys(bindingRegistry.value))
      }

      configureBindingConfig()
    } else {
      console.warn('[PreviewDemo] 未找到已保存的数据，请先在编辑模式下创建并保存')
    }
  } catch (e) {
    console.error('[PreviewDemo] 加载数据失败:', e)
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  clearInterval(mockTickTimer)
})

/** 处理图元事件回调（console 输出即可，日志已由内置面板追踪） */
function onCellEvent(payload: {
  eventType: string
  cellId: string
  shape: string
  data: Record<string, any>
}) {
  console.log(`[cell-event:${payload.eventType}]`, {
    cellId: payload.cellId,
    shape: payload.shape,
    data: payload.data,
    hasEventConfig: !!payload.data?.eventConfig?.enabled,
    eventCount: payload.data?.eventConfig?.list?.length || 0,
    hasBinding: !!payload.data?.binding?.bindings?.length,
    bindingCount: payload.data?.binding?.bindings?.length || 0,
  })
}

/** 处理数据更新回调（console 输出即可，日志已由内置面板追踪） */
function onDataUpdated(data: Record<string, number | string | null>) {
  const entries = Object.entries(data)
  if (entries.length === 0) return
  console.log(`[data-updated] ${entries.length} 个测点:`, Object.fromEntries(entries.slice(0, 3)))
}

/** 处理触发器动作回调（Notification 弹窗 + console） */
function onActionTriggered(info: {
  cellId: string
  triggerId: string
  actionType: string
  actionValue: any
  tagValue: number | string | null
  matched: boolean
  binding?: any
  triggerConfig?: any
  cellData?: Record<string, any>
  shape?: string
}) {
  const av = info.actionValue || {}
  const b = info.binding || {}
  const deviceInfo = b.device ? `[${b.device}:${b.dataPoint}]` : ''
  console.log('[PreviewDemo] 触发器动作:', info)

  switch (info.actionType) {
    case 'alert':
      Notification.warning({
        title: '⚠ 告警',
        content: `${deviceInfo} ${av.message || '告警触发'}`,
        duration: 5000,
      })
      break
    case 'openDialog':
      if (av.confirmed) {
        Notification.success({
          title: '✅ 已确认',
          content: `${deviceInfo} ${av.title || '打开业务弹窗'}`,
        })
      }
      break
    case 'message':
      Notification.success({
        title: '📢',
        content: `${deviceInfo} ${av.message || '消息'}`,
        duration: 3000,
      })
      break
    case 'event-callback':
      console.log('[PreviewDemo] 外部回调:', av.type, av.item, ...(av.extras || []))
      break
    case 'outer-request':
      console.log(
        '[PreviewDemo] 前置请求:',
        av.success ? '✅成功' : '❌失败',
        `(${av.durationMs}ms)`,
      )
      break
  }

  console.log(`[action:${info.actionType}]`, {
    cellId: info.cellId,
    triggerId: info.triggerId,
    actionValue: av,
    tagValue: info.tagValue,
    matched: info.matched,
  })
}

/** 手动刷新 */
function manualRefresh() {
  if (previewRef.value?.refresh) {
    previewRef.value.refresh()
    console.log('[PreviewDemo] 手动刷新完成')
  }
}

function logData(): void {
  console.log('Preview graph data:', JSON.stringify(graphData.value, null, 2))
}

function logBindingValues(): void {
  const g = previewRef.value?.getGraph?.()
  if (!g) {
    console.warn('[PreviewDemo] 图实例尚未就绪')
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
  console.log('[PreviewDemo] 绑定配置:', bindings)
  console.log('[PreviewDemo] 绑定数量:', bindings.length)
}

function logKeys(): void {
  const keys = extractBindingKeys(bindingRegistry.value)
  console.log('[PreviewDemo] 订阅 Keys:', keys)
  console.log('[PreviewDemo] 绑定注册表:', bindingRegistry.value)
  alert(`订阅 Keys (${keys.length} 个):\n${keys.join('\n') || '无'}`)
}
</script>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.demo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}
.demo-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #666;
}
.demo-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}
.demo-label input {
  cursor: pointer;
}
.demo-sep {
  color: #d9d9d9;
}
.demo-badge {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}
.demo-badge--preview {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}
.demo-actions {
  display: flex;
  gap: 6px;
}
.demo-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 12px;
}
.demo-btn:hover:not(:disabled) {
  color: #1890ff;
  border-color: #1890ff;
}
.demo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.demo-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.demo-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.demo-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14px;
}
</style>
