# Preview 调试面板

> **源码位置**：`src/topology/components/panels/KoruPreviewDebugPanel.vue` + `src/topology/components/panels/KoruTestToolsPanel.vue`
> **启用方式**：`<koru-preview :show-test-tools="true" />` 或工具栏「调试」按钮。

---

## 两个组件的关系

```
KoruPreviewDebugPanel.vue  ← 主容器（标题 + 顶部按钮 + 日志区域）
  └─ 内嵌 KoruTestToolsPanel.vue  ← 功能测试区（注入/绑定/多状态）
```

KoruPreview 渲染时：

```vue
<koru-preview-debug-panel
  v-if="showTestTools"
  :graph="instance.getGraph()"
  :event-logs="eventLogs"
  :data-logs="dataLogs"
  :action-logs="actionLogs"
  :trigger-logs="triggerLogs"
  @refresh="instance.refresh()"
  @log-data="instance.logData()"
  @log-bindings="instance.logBindings()"
  @clear-log="clearAllLogs"
/>
```

---

## KoruPreviewDebugPanel — 主容器

### 顶部按钮

| # | 按钮 | handler | 具体做什么 |
|---|------|---------|-----------|
| 1 | 🔄 手动刷新 | `emit('refresh')` → `instance.refresh()` | 手动触发一次 fetchData + 绑定执行（不依赖 polling） |
| 2 | 📄 输出图数据 | `handleLogData()` | `console.log(instance.getGraph().toJSON())` — 打印完整 X6 JSON |
| 3 | 🔗 输出绑定数据 | `handleLogBindings()` | `console.log(instance.getAllBindings())` — 打印完整 BindingRegistry |
| 4 | 🗑️ 清空日志 | `emit('clear-log')` | 清空 eventLogs / dataLogs / actionLogs / triggerLogs 四个数组 |

### 6 个日志区域

| # | 区域标题 | 数据来源 | 记录内容 |
|---|----------|----------|----------|
| 1 | 📋 事件回调日志 | `@cell-event` | 每次 click/dblclick/hover → `{ eventType, cellId, shape, data }` |
| 2 | 📡 数据更新日志 | `@data-updated` | 每次 tick 只记录**有变化的测点**（去重） |
| 3 | 🔔 触发器动作日志 | `@action-triggered` | 每次 trigger 命中 → `{ cellId, triggerId, actionType, matched }` |
| 4 | ⚡ 告警日志 | `@alarm` | 每轮 tick 结束 → `Alarm[]` |
| 5 | 🔍 最后一次事件详情 | 实时显示 | 深灰色 JSON 预览框，显示最新一条完整 payload |

### 日志字段完整类型

```ts
// 📋 事件回调
interface CellEventLog {
  eventType: 'click' | 'dblclick' | 'mouseenter' | 'mouseleave' | 'mouseup' | 'mousemove'
  cellId: string
  shape: string
  data?: Record<string, any>
  rawEvent?: MouseEvent
  timestamp: number
}

// 📡 数据更新
interface DataUpdateLog {
  values: Record<string, any>        // 只含变化的 key
  allValues: Record<string, any>     // 全量
  changedKeys: string[]              // 具体哪些 key 变了
  tick: number                       // 第几轮 tick
  timestamp: number
}

// 🔔 触发器动作
interface ActionTriggerLog {
  cellId: string
  triggerId: string
  actionType: TriggerActionType
  actionValue?: Record<string, any>
  matched: boolean
  level?: 'warning' | 'critical' | 'info'
  timestamp: number
}

// ⚡ 告警
interface AlarmLog {
  deviceKey: string
  cellId: string
  level: 'warning' | 'critical'
  message: string
  pointName?: string
  currentValue?: number | string | null
  threshold?: number | string | null
  triggerId?: string
  timestamp: number
}
```

### 日志颜色分类

| 区域 | 颜色 | 视觉 |
|------|------|------|
| 事件回调 | 浅灰 | 普通文本 |
| 数据更新 | 青绿 `#01bfa5` | 代码色 |
| 触发器动作 | 紫色 `#8b5cf6` | 标记 actionType |
| 告警 | 红 `#ef4444` / 橙 `#f59e0b` | 按 level 分色 |

---

## KoruTestToolsPanel — 功能测试区

### 4 个功能区

#### 功能 1：绑定数据注入

| 输入 | 说明 |
|------|------|
| 测点 key 输入框 | 比如 `ct.ia` |
| 值 输入框 | 比如 `27.5`（自动识别数字 / 字符串 / JSON） |
| ➕ 添加按钮 | 加入注入列表 |
| 🚀 执行按钮 | 调 `instance.setPointValues(values)` → 立即触发绑定执行 |
| 🗑️ 清空按钮 | 清空注入列表 |

**内部流程**（`KoruTestToolsPanel.vue:L92-L145`）：

```ts
const injectList = ref<{ key: string; value: any }[]>([])

async function handleExecuteInject() {
  // 1. 构造扁平对象
  const values = {}
  for (const item of injectList.value) {
    values[item.key] = tryParse(item.value)  // 自动转数字/JSON
  }
  // 2. 注入 → 立即 tick
  graphRef.value?.setPointValues(values)
  // 3. 手动跑一轮绑定（不等 polling）
  graphRef.value?.tick()
  // 4. 记录日志
  logs.push({ type: 'inject', values, timestamp: Date.now() })
}
```

**自动类型推断**（`tryParse`）：

```ts
function tryParse(raw: string): any {
  const trimmed = raw.trim()
  if (trimmed === 'null') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed) } catch { /* 当字符串 */ }
  }
  return trimmed  // 普通字符串
}
```

#### 功能 2：绑定测试（runBindingTest）

**入口**：KoruPreview 暴露的 `runBindingTest()` 实例方法。

```ts
function handleBindingTest() {
  const report = instance.runBindingTest()
  // report 结构：
  // {
  //   total: 23,           // 总绑定数
  //   tested: 23,          // 成功测试数
  //   failed: 0,           // 失败数
  //   details: [
  //     { cellId, device, dataPoint, templateType, sampleValue, result, error? },
  //     ...
  //   ]
  // }
  logs.push({ type: 'test', report, timestamp: Date.now() })
}
```

**测试做了什么**：对 registry 里的每条 binding，模拟一个 sampleValue 跑 `useJexl.applyTemplate()` → 检查有没有抛异常。

#### 功能 3：映射规则测试

**用途**：临时测试某个 binding 的模板效果，不用真实 fetchData。

| 输入 | 说明 |
|------|------|
| 选一个 binding | 下拉选现有的绑定项 |
| 输入测试值 | 比如 `fault` / `25` / `0` |
| 🔍 测试按钮 | 跑 `useJexl.applyTemplate(binding, testValue)` |

**输出**：测试值 → 模板转换结果

| 模板类型 | 输入 | 输出 |
|----------|------|------|
| rawValue | `27` | `27` |
| textFormat | `27.1456` | `"27.1 A"` |
| boolText | `1` | `"合"` |
| statusTextMapping | `"fault"` | `"故障"` |
| colorMap | `"closed"` | `"#10b981"` |
| threshold | `27` | `"#ef4444"` (红) |
| threshold_color | `27` | `"#ef4444"` (alarmColor) |
| elementStateMapping | `"closed"` | `"合闸"` |

#### 功能 4：多状态测试

| 输入 | 说明 |
|------|------|
| statePoint 下拉 | 从 setMultiStateConfig.pointOptions 里选 |
| 选一个状态 | 比如 `closed` / `open` / `fault` |
| 模拟切换按钮 | 调 `useMultiState.applyMultiStateByPoint()` |
| 暂停多状态 | 冻结，不再响应真实测点变化 |
| 恢复多状态 | 解冻，继续自动切换 |
| 恢复初始状态 | 回到 currentStateId |

**内部流程**（`L150-L245`）：

```ts
function handleMultiStateTest() {
  // 1. 暂停真实数据驱动
  pauseMultiState()
  // 2. 手动切换
  applyMultiStateByPoint(graph, selectedStatePoint.value, selectedStateId.value)
  // 3. 记录
  logs.push({
    type: 'multiState',
    statePoint: selectedStatePoint.value,
    stateId: selectedStateId.value,
    timestamp: Date.now(),
  })
}

function restoreAllMultiState() {
  // 恢复所有容器到 data.multiState.currentStateId
  for (const parent of graph.getCells()) {
    const ms = parent.getData('multiState')
    if (ms) applyMultiStateByPoint(graph, ms.point, ms.currentStateId)
  }
  // 恢复真实数据驱动
  resumeMultiState()
}
```

---

## KoruPreview 暴露给调试面板的实例方法

从 `KoruPreview.vue:L1238-L1338`（`defineExpose`）：

```ts
// 刷新
refresh()                       // fetchData + 绑定执行 + tick

// 手动注入（调试面板用）
setPointValue(cellId, device, dataPoint, value)
setPointValues(values: Record<string, any>)

// 绑定查询
getAllBindings(): BindingRegistryItem[]
getCellBindings(cellId: string): BindingRegistryItem[]

// 测试工具
runBindingTest(): BindingTestReport
tick(): void                    // 不拉新数据，只重跑绑定
startPolling(ms?: number): void
stopPolling(): void

// 图元查询
getGraph(): Graph
getAllCells(): Cell[]
findCellById(id: string): Cell | null

// 多状态控制（调试面板用）
pauseMultiState(): void
resumeMultiState(): void
switchMultiState(cellId: string, newStateId: string): void
getActiveAlarms(): Alarm[]

// 高亮（调试面板可以触发）
highlightDevice(deviceKey: string, opts?: { ring?: boolean; pulse?: boolean }): void
scrollToCell(cellId: string): void
clearAllHighlights(): void
```

---

## 完整调试流程示例

### 场景：验证断路器越限告警

```
1. 启动 KoruPreview，showTestTools=true

2. 功能 4「多状态测试」:
   → statePoint 选 breaker_state
   → 状态选 open（分闸）
   → 点「模拟切换」→ 画布上断路器 SVG 切成分闸

3. 功能 1「绑定数据注入」:
   → 添加 ct.ia = 27.5（A）
   → 点「执行」→ 画布上 ct 电流变成 "27.5A"
                → 触发 threshold 模板 → fill 变红
                → 触发 trigger → console 打告警
                → 📡 日志区出现 "ct.ia → 27.5"
                → 🔔 日志区出现 "trig-1 actionType=alert"
                → ⚡ 日志区出现 "ct critical 电流越限"

4. 功能 1「绑定测试」:
   → 点「清空」
   → 注入 ct.ia = 12.0
   → 执行 → fill 变回绿
         → 🔔 日志区出现 "trig-2 恢复"

5. 功能 3「映射规则测试」:
   → 下拉选 ct 的 threshold 绑定
   → 输入 30
   → 点「测试」→ 显示结果颜色 #ef4444

6. 功能 4「恢复多状态」:
   → 点「恢复初始状态」→ 断路器回到 data.multiState.currentStateId
```

---

## 生产 vs 开发

| 环境 | 建议 |
|------|------|
| 开发期 | `showTestTools: true`，边写边调 |
| 联调期 | `showTestTools: true`，验证前后端数据格式 |
| 生产环境 | **必须关掉** `showTestTools: false`（面板会暴露内部数据） |

---

## 相关文档

- 预览集成：[preview-user-guide.md](./preview-user-guide.md)（有 Debug Panel 的集成示例）
- 触发器：[trigger-actions.md](./trigger-actions.md)（12 种动作怎么在日志里分类）
- 绑定模板：[binding-templates.md](./binding-templates.md)（映射规则测试的模板效果参考）
- 多状态：[multi-state.md](./multi-state.md)（pauseMultiState / resumeMultiState 原理）
