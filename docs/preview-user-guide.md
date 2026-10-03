# KoruPreview 开发者指南

> 本文档面向**集成方开发者**，讲解 KoruPreview 预览组件的完整使用方式——数据对接、实时数据源、触发器、告警、事件回调。
> 纯 API 参考见 [component-api.md](#korupreview预览模式组件)，终端操作手册见 [preview-user-guide (终端)](./preview-user-guide.md)。

---

## 预览 vs 编辑

| | KoruGraphEditor | KoruPreview |
|--|----------------|-------------|
| **定位** | 图纸设计 | 运行态展示 + 实时数据 |
| **画布编辑** | ✅ 全部可用 | ❌ 只读 |
| **Stencil / 属性面板 / 工具栏** | ✅ 有 | ❌ 无 |
| **实时数据绑定** | 可选（配置后画布上的值也会跳） | ✅ 内置，默认开启轮询 |
| **触发器执行** | ❌ | ✅ |
| **调试面板** | ❌ | ✅ `:show-test-tools="true"` |
| **告警检测** | ❌ | ✅ `enableAlarmEmit` |
| **事件回调** | 无（画布级事件自己订阅） | `@cell-event` / `@data-updated` / `@action-triggered` / `@alarm` |

---

## 最小集成

```vue
<template>
  <div style="height: 100vh">
    <koru-preview
      ref="previewRef"
      v-model:graph="graphData"
      :auto-fit="true"
      :show-test-tools="true"
      :enable-alarm-emit="true"
      @ready="onReady"
      @cell-event="onCellEvent"
      @data-updated="onDataUpdated"
      @action-triggered="onActionTriggered"
      @alarm="onAlarm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  KoruPreview,
  setBindingConfig,
  buildFetchData,
} from '@mollu/koru/topology'

const previewRef = ref()
const graphData = ref<any>({ nodes: [], edges: [] })
let bindingRegistry: any[] = []

onMounted(async () => {
  // ① 从你的服务端加载图纸 + 绑定注册表
  const res = await fetch(`/your-api/diagram/${diagramId}`)
  const { diagramData, registry } = await res.json()
  bindingRegistry = registry

  // 灌入画布（X6 原生 JSON 格式）
  previewRef.value?.loadDiagram(diagramData)
})

function onReady(api) {
  // ② 配置实时数据源
  setupRealtimeBinding(bindingRegistry)
}

function setupRealtimeBinding(registry: any[]) {
  // 封装一个 fetch 函数：从你的数据源（HTTP / WS / MQTT）拉实时数据
  const fetchData = buildFetchData(registry, async () => {
    // 方式 A：HTTP 轮询
    const res = await fetch('/your-api/realtime')
    const json = await res.json()
    // json 必须是扁平格式：{ "device.dataPoint": value }
    return json

    // 方式 B：WebSocket — 把 WebSocket 收到的数据直接返回
    // return wsLastMessage.value  // 假设已经有全局的 WS 数据缓存
  })

  setBindingConfig({
    fetchData,
    pollInterval: 2000,  // 2 秒调一次 fetchData
  })
}

// ── 事件处理 ──
function onCellEvent(payload) {
  console.log(`[click] ${payload.cellId} (${payload.shape})`)
  // payload.eventType, payload.cellId, payload.shape, payload.data
}

function onDataUpdated(data) {
  // data = { "ct.ia": 27.1, "ct.ib": 26.8, ... }
  console.log(`${Object.keys(data).length} 个测点值更新`)
}

function onActionTriggered(info) {
  // info.actionType: 'alert' | 'message' | 'confirm' | 'openDialog' | 'writePoint' | 'jumpPage'
  switch (info.actionType) {
    case 'alert':
      Modal.warning({
        title: `告警 — ${info.cellId}`,
        content: info.actionValue?.message || '阈值越限',
      })
      break
    case 'writePoint':
      // 把控制点写回后端
      backend.writePoint(info.cellId, info.actionValue)
      break
  }
}

function onAlarm(alarms: Alarm[]) {
  // 一轮 tick 结束后统一 emit 检测到的告警列表
  alarms.forEach(a => {
    console.log(`[${a.level.toUpperCase()}] ${a.deviceKey}: ${a.message}`)
  })
  // 通常推送给告警中心 / 通知系统
}
</script>
```

---

## `setBindingConfig` — 实时数据源配置

这是预览模式最关键的一步。所有实时数据（测点值、告警、多状态切换）都依赖这个函数：

```ts
import { setBindingConfig } from '@mollu/koru/topology'

setBindingConfig({
  fetchData,          // ✅ 必须：拉最新数据的函数
  pollInterval: 2000, // ✅ 必须：多久拉一次（毫秒）
  values: {},         // 可选：初始值缓存
  setValue,           // 可选：控制点写入回调
  tick,               // 可选：外部驱动刷新（不用轮询时）
  runTest,            // 可选：测试面板里的模拟数据
})
```

### fetchData 返回格式（扁平）

```json
{
  "ct.ia": 27.1,
  "ct.ib": 26.8,
  "ct.ic": 27.3,
  "main_tr.temp": 65.2,
  "breaker_1.state": "closed",
  "breaker_2.state": "open"
}
```

**key 格式**：`{deviceKey}.{dataPoint}`（点号分隔）

### buildFetchData — 自动按 bindingRegistry 过滤

如果后端一次返回所有测点，但你只关心当前图纸绑定的那些：

```ts
import { buildFetchData } from '@mollu/koru/topology'

// 只传 bindingRegistry 和 fetch 函数
const fetchData = buildFetchData(bindingRegistry, async () => {
  const allData = await fetch('/your-api/realtime').then(r => r.json())
  // buildFetchData 会自动从 allData 里只挑图纸用到的 key
  return allData
})
```

也支持数据源返回**分组格式**（按设备聚合）：

```json
{
  "ct": { "ia": 27.1, "ib": 26.8, "ic": 27.3 },
  "main_tr": { "temp": 65.2 }
}
```

```ts
const fetchData = buildFetchData(registry, fetchGroupedData, { inputFormat: 'grouped' })
// buildFetchData 自动展平成扁平格式
```

### 方式对比：各种数据源

| 数据源 | fetchData 写法 | pollInterval |
|--------|---------------|--------------|
| **HTTP 轮询** | `fetch('/your-api/realtime')` | 2000~5000ms |
| **WebSocket** | 存一个全局变量，fetchData 里直接 return | 0（tick 驱动） |
| **MQTT** | 同 WebSocket，订阅后缓存到全局变量 | 0 |
| **静态 mock** | `async () => ({ "ct.ia": 27 })` | 任意 |

### WebSocket 模式（推荐生产用）

```ts
// store/realtime.ts — 全局实时数据 store
const latestData = ref<Record<string, any>>({})

// 建立 WS 连接
const ws = new WebSocket('ws://backend/realtime')
ws.onmessage = (evt) => {
  const json = JSON.parse(evt.data)
  latestData.value = json  // 每次 WS push 就覆盖
}

// setBindingConfig 里不用轮询，用 tick 驱动
setBindingConfig({
  fetchData: async () => latestData.value,  // 同步返回最新值（不用 poll 也能变）
  pollInterval: 0,  // 关闭自动轮询
  tick: () => previewRef.value?.refresh(),  // WS 收到新值时手动 tick
})

// WS push 到达后触发画布刷新
ws.onmessage = (evt) => {
  latestData.value = JSON.parse(evt.data)
  previewRef.value?.tick()
}
```

---

## Props 详解（常用场景）

### `autoFit` — 首次加载自动适配

```vue
<koru-preview :auto-fit="true" />
```

默认 `false`。开启后 `ready` 时自动调用 `fitView()` 让所有图元在视口内。

### `showTestTools` — 调试面板

```vue
<koru-preview :show-test-tools="true" />
```

打开后右上角出现🛠按钮，点击从右侧滑出 Drawer。开发阶段必开，生产环境建议关掉（用户不需要）。

### `allowCanvasPan` — 画布平移

默认 `true`，允许用户鼠标拖动画布查看不同区域。某些场景想让用户只能看不能拖：

```vue
<koru-preview :allow-canvas-pan="false" />
```

也可以运行时通过 `previewRef.value?.setPanningEnabled(false)` 动态切换。

### `customShapes` — SVG 自定义符号

**⚠️ 不推荐用 prop**——跟 KoruGraphEditor 一样，prop 会覆盖全局 `setComponentConfig({ customShapes })` 的值。正常场景应该在项目启动时一次性注册（`registerSvgNode(item, index)` 静态注册 + `setComponentConfig()`），编辑器和预览都不需要传 prop。

只有以下情况才考虑 prop：**这个预览组件需要一套跟其他地方完全不同的符号集**。

如果确实要传，确保跟编辑器里的符号集完全一致——否则图纸里的 `svg-node-*` 形状预览时找不到对应 SVG。

```vue
<!-- 不推荐：prop 方式（会覆盖全局） -->
<koru-preview :custom-shapes="electricalSymbols" />

<!-- ✅ 推荐：全局注册一次，两边都不用传 -->
<!-- main.ts / koruBootstrap.ts -->
electricalSymbols.forEach((item, index) => registerSvgNode(item, index))
setComponentConfig({ customShapes: electricalSymbols })
<!-- 任何地方裸写即可 -->
<koru-preview />
```

### `enableHighlight` — 设备高亮 & 滚动

```vue
<koru-preview :enable-highlight="true" />
```

开启后，ref 上会出现高亮相关方法：

```ts
// 场景：收到告警 → 高亮设备
previewRef.value?.highlightDevice('ct', { ring: true, pulse: true })

// 场景：告警列表点击 → 滚动到画布上的设备
previewRef.value?.scrollToCell('ct')

// 场景：告警恢复 → 清高亮
previewRef.value?.clearAllHighlights()
```

### `enableAlarmEmit` — 告警回调

```vue
<koru-preview :enable-alarm-emit="true" @alarm="onAlarm" />
```

触发器检测到阈值越限时，**每轮 tick 结束后统一 emit** 一次告警数组（不是单条 emit，避免刷屏）：

```ts
function onAlarm(alarms: Alarm[]) {
  // 推送到告警中心
  alarmCenter.push(alarms.map(a => ({
    deviceKey: a.deviceKey,
    level: a.level,     // 'warning' | 'critical'
    message: a.message, // "ct.ia 电流越限 (阈值 25A)"
    timestamp: a.timestamp,
  })))
}
```

### `outerRequestApi` — 触发器外部前置请求

某些触发器动作（比如 `alert` / `confirm`）需要先调一个后端接口："这个告警要不要弹？用户有没有权限看到？"

```vue
<koru-preview
  :outer-request-api="async (cfg) => {
    // cfg = OuterRequestRuntimeConfig，包含触发器配置里写的请求参数
    const res = await fetch(cfg.url, {
      method: cfg.method || 'GET',
      headers: cfg.headers,
      body: cfg.body ? JSON.stringify(cfg.body) : undefined,
    })
    return res.ok  // true = 允许执行动作，false = 跳过
  }"
/>
```

> 只有触发器配置里 `actionConfig.outerRequest.enabled = true` 时才会调这个函数。

---

## Emits 详解

### `@cell-event` — 图元事件

```ts
interface CellEventPayload {
  eventType: string     // click / dblclick / mouseenter / mouseleave / mouseup / mousemove
  cellId: string
  shape: string
  data: Record<string, any>  // cell.getData() — 包含所有绑定、触发器配置
  rawEvent?: any
}
```

**用途**：点击设备节点 → 弹出设备详情弹窗。

```ts
function onCellEvent({ eventType, cellId, data }) {
  if (eventType === 'click') {
    // 设备详情弹窗
    showDeviceDetail(cellId, data)
  }
}
```

### `@data-updated` — 数据更新

```ts
function onDataUpdated(data: Record<string, number | string | null>) {
  // data = { "ct.ia": 27.1, "main_tr.temp": 65.2 }
  // 注意：只有**变化的**测点才在 data 里，没变化的不推
  updateRealtimePanel(data)
}
```

**用途**：刷新页面右上角的实时数据面板（电流表、温度表等）。

### `@action-triggered` — 触发器动作

```ts
interface ActionTriggeredPayload {
  cellId: string
  triggerId: string
  actionType: string        // alert | message | confirm | openDialog | writePoint | jumpPage
  actionValue: Record<string, any>  // 动作参数（message 内容、弹窗配置等）
  matched: boolean          // 条件是否命中
  binding?: any             // 触发条件的绑定
  triggerConfig?: any       // 完整触发器配置
}
```

**所有 actionType 的处理**：

```ts
function onActionTriggered(info) {
  switch (info.actionType) {
    case 'alert':
      // 告警弹窗（红色警告）
      Modal.warning({ title: info.actionValue?.message })
      break
    case 'message':
      // Toast 提示
      Message.info(info.actionValue?.message)
      break
    case 'confirm':
      // 确认框（比如"确定断开断路器？"）
      Modal.confirm({
        title: info.actionValue?.message,
        onOk: () => sendControlCommand(info.cellId, 'open'),
      })
      break
    case 'openDialog':
      // 打开详情弹窗
      showDetailDialog(info.cellId, info.actionValue)
      break
    case 'writePoint':
      // 下发控制命令到后端（比如分/合断路器）
      backend.sendControl(info.actionValue)
      break
    case 'jumpPage':
      // 页面跳转
      router.push(info.actionValue?.url)
      break
  }
}
```

### `@device-click` — 点击设备节点（高级）

比 `cell-event` 的 `click` 更智能——**自动向上找父容器**，返回设备级信息：

```ts
interface DeviceClickPayload {
  cellId: string           // 实际被点击的 cellId
  deviceCellId: string     // 设备/容器级 cellId（可能是父容器）
  deviceKey: string         // 设备标识
  deviceName?: string       // 设备名称
  bindings: any[]           // 该设备所有测点绑定
  cellData: Record<string, any>
}
```

**典型场景**：用户点了 CT 上的一个 binding 标记（子节点），但你想弹出"CT 整个设备"的详情弹窗——用 `device-click` 省了自己找父节点的逻辑。

### `@alarm` — 告警（需 `enableAlarmEmit: true`）

```ts
interface Alarm {
  deviceKey: string
  cellId: string
  level: 'warning' | 'critical'
  message: string           // "ct.ia 电流越限 (阈值 25A)"
  pointName?: string
  currentValue?: number | string | null
  threshold?: number | string | null
  triggerId?: string
  timestamp: number
}
```

---

## 实例方法（ref 调用）

```ts
const previewRef = ref()

// ── 数据加载 ──
previewRef.value?.loadDiagram({ cells: [...], canvas: {...} })
previewRef.value?.getGraph()          // X6 Graph 实例
previewRef.value?.getAllCells()       // 所有图元

// ── 数据刷新 ──
previewRef.value?.refresh()           // 手动调一次 fetchData + 绑定执行
previewRef.value?.tick()              // 不拉新数据，只重跑绑定逻辑
previewRef.value?.startPolling(3000)  // 动态开轮询
previewRef.value?.stopPolling()       // 停轮询

// ── 手动注入数据 ──
previewRef.value?.setPointValue('ct', 'ct.ia', 27.1)
previewRef.value?.setPointValues({
  'ct.ia': 27.1,
  'ct.ib': 26.8,
  'breaker_1.state': 'open',
})

// ── 设备高亮（需 enableHighlight） ──
previewRef.value?.highlightDevice('ct', { ring: true, pulse: true })
previewRef.value?.scrollToCell('ct')
previewRef.value?.clearAllHighlights()

// ── 告警查询（需 enableAlarmEmit） ──
const alarms = previewRef.value?.getActiveAlarms()

// ── 运行时开关 ──
previewRef.value?.setPanningEnabled(false)  // 动态禁画布平移
```

---

## 完整场景：数据对接架构（推荐）

```
[设计时] KoruGraphEditor (前端)
    │
    │ @save → { diagramData, bindingRegistry }
    ▼
[你的服务端 / 存储] （Koru 不绑定技术栈）
    │
    │ GET 图纸 → { diagramData, bindingRegistry }
    │ GET/WS/SSE 实时值 → { "device.point": value, ... }
    ▼
[运行时] KoruPreview (前端)
    │
    │ setBindingConfig({ fetchData, pollInterval: 2000 })
    │   ↓ fetchData 每 2s 拉最新值（HTTP 轮询 / WS / SSE 任选）
    │   ↓ 画布上绑定的节点自动更新数值 / 切换多状态
    │
    │ trigger 条件命中 → @action-triggered
    │ alarm 检测 → @alarm（enableAlarmEmit: true）
    │ 用户点节点 → @cell-event / @device-click
    │
    │ @data-updated → 页面实时面板刷新
    ▼
[告警中心 / 控制下发 / 日志] （你的业务系统实现）
```

### fetchData 数据接口约定

Koru **不关心你的后端是什么技术栈**（Node.js / Go / Java / Python / ...），只关心 `fetchData()` 返回的数据格式。你只需要在 `fetchData` 里调用你的接口，然后返回以下三种格式之一（executor 自动归一化）：

| 返回格式 | 示例 | 说明 |
|----------|------|------|
| **扁平三段式**（推荐） | `{ "ct:ia": 27, "ct:ib": 26 }` | 设备名和测点名用 `:` 拼接 |
| **分组格式** | `{ "ct": { "ia": 27, "ib": 26 } }` | 按设备嵌套 |
| **两段式** | `{ "ia": 27, "ib": 26 }` | 只有测点名（多设备冲突时注意） |

> 也支持 WebSocket / SSE 推送——把 `fetchData` 换成定时消费 WS 消息即可，executor 对 HTTP 轮询和 WS 推送一视同仁。

### 后端 bindingRegistry 存储建议

`bindingRegistry` 是数组，每项代表一个绑定关系：

```json
[
  { "cellId": "ct", "device": "ct", "dataPoint": "ia", "targetProperty": "text" },
  { "cellId": "ct", "device": "ct", "dataPoint": "ib", "targetProperty": "text" },
  { "cellId": "breaker_1", "device": "breaker_1", "dataPoint": "state", "targetProperty": "multiState" }
]
```

存数据库（PostgreSQL / MySQL）或 Redis 都行——只要能按 diagramId 拿回来。

---

## 完整场景：WebSocket 实时 + 告警推送

```vue
<template>
  <koru-preview
    ref="previewRef"
    :auto-fit="true"
    :enable-alarm-emit="true"
    @alarm="handleAlarm"
    @action-triggered="handleAction"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { KoruPreview, setBindingConfig } from '@mollu/koru/topology'
import { useAlarmStore } from '@/stores/alarm'

const previewRef = ref()
const wsData = ref<Record<string, any>>({})
let ws: WebSocket | null = null

onMounted(async () => {
  // ① 加载图纸
  const { diagramData, bindingRegistry } = await loadFromBackend()
  previewRef.value?.loadDiagram(diagramData)

  // ② 建立 WebSocket
  ws = new WebSocket('ws://backend/realtime')
  ws.onmessage = (evt) => {
    wsData.value = JSON.parse(evt.data)
    // 不用轮询，手动 tick 让画布刷新
    previewRef.value?.tick()
  }

  // ③ 配置 binding — fetchData 直接返回 wsData
  setBindingConfig({
    fetchData: async () => wsData.value,
    pollInterval: 0,  // 关闭自动轮询（WS 驱动）
  })
})

onBeforeUnmount(() => {
  ws?.close()
})

// ── 告警处理 ──
function handleAlarm(alarms: Alarm[]) {
  const alarmStore = useAlarmStore()
  alarmStore.addBatch(alarms)

  // 重大告警弹通知
  alarms.filter(a => a.level === 'critical').forEach(a => {
    Notification.error({
      title: `🚨 严重告警: ${a.deviceKey}`,
      content: a.message,
    })
  })
}

// ── 触发器动作 ──
function handleAction(info) {
  // writePoint → 下发控制命令
  if (info.actionType === 'writePoint') {
    backend.sendControl(info.actionValue).then(res => {
      if (res.ok) {
        Message.success(`已下发控制命令`)
      }
    })
  }
}
</script>
```

---

## 完整场景：设备点击跳转详情页

```vue
<koru-preview @device-click="onDeviceClick" />
```

```ts
import { useRouter } from 'vue-router'

const router = useRouter()

function onDeviceClick(payload: DeviceClickPayload) {
  // payload.deviceKey 就是设备标识，不用自己从 data 里找
  router.push({
    name: 'device-detail',
    params: { deviceKey: payload.deviceKey },
    query: { cellId: payload.deviceCellId },
  })
}
```

---

## ⚠️ 常见坑

### 1. setBindingConfig 必须在 KoruPreview 挂载后调

`setBindingConfig` 是**全局单例**，但 `fetchData` / `pollInterval` 只有在 KoruPreview 实例存在时才会被轮询。如果先 setBindingConfig 后挂载 Preview——`tick()` 里 `pollInterval === 0` 不会触发轮询。

正确顺序：**onReady 回调里调 setBindingConfig**。

### 2. bindingRegistry 和 diagramData 必须匹配

保存时从编辑器拿到的 `bindingRegistry` 和 `diagramData` 是配套的。后端存的时候必须一起存，加载时必须一起拿。如果 bindingRegistry 里引用了一个 diagramData 里不存在的 cellId——这个绑定会被静默忽略。

### 3. fetchData 必须返回扁平格式

❌ 数据源返回：
```json
{ "ct": { "ia": 27 } }  // 分组格式
```

✅ 前端 `buildFetchData(registry, fetchFn, { inputFormat: 'grouped' })` 自动展平。

❌ 数据源返回但没 buildFetchData：
```json
{ "ct": { "ia": 27 } }  // 绑定查找 "ct.ia" 找不到！
```

✅ 数据源直接返回扁平：
```json
{ "ct.ia": 27 }  // 正确
```

### 4. preview 的 graph prop 和 loadDiagram 的区别

| 方式 | 适用 |
|------|------|
| `v-model:graph="graphData"` | 手动构造的简单 `{ nodes, edges }` 格式 |
| `previewRef.value.loadDiagram(diagramData)` | 你存储返回的 X6 原生 `{ cells, canvas }` 格式 |

**从存储加载务必用 `loadDiagram`**——它会恢复完整的画布配置（网格、缩放、背景），而 v-model:graph 只设 nodes/edges，画布配置全丢。

### 5. enableAlarmEmit 只是开启 emit，不开启检测

默认触发器检测一直跑——`enableAlarmEmit` 只是**开启 `@alarm` 事件的 emit**。不开的话，告警检测照样执行，只是不会 emit 给父组件。

### 6. outerRequestApi 返回 false 会抑制动作

```ts
// 触发器配置里写了 outerRequest.enabled: true
// 如果 outerRequestApi 返回 false → 整个 action 不执行
// 返回 true → 正常执行 alert/message/writePoint 等
```

这可以用来做权限控制：比如非管理员看不到某些告警弹窗。

### 7. 预览和编辑器的 customShapes 必须一致

如果编辑器里注册了 `svg-node-0 = 断路器`，预览也必须注册一模一样的 SVG——否则预览时会显示空白或默认矩形。

建议：把 `electricalSymbols.forEach((item, index) => registerSvgNode(item, index))` 放在 `main.ts` 里**全局注册**，两边自动共享。

---

## 参考

- 最小示例：[quick-start.md](#最小示例预览模式)
- 纯 API 参考：[component-api.md](#korupreview预览模式组件)
- 全局配置项：[global-config.md](#setbindingconfig绑定配置)
- 绑定注册表：[binding-registry.md](#buildfetchdata)
- 多状态：[svg-custom-nodes.md](#多状态节点)
