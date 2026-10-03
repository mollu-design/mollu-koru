# 触发器 & 动作（12种）

> **源码位置**：`src/topology/composables/bindingTypes.ts:L7-L32`（类型）、`src/topology/composables/bindingConfig.ts:L18-L119`（选项）、`src/topology/composables/useBindingExecutor.ts:L84-L118, L439-L619`（执行）
> **运行引擎**：`useBindingExecutor()` 在每轮 tick 结束后统一执行所有触发器条件匹配。

---

## 触发器结构

```ts
interface TriggerItem {
  id: string
  enabled: boolean                      // 开关：关掉就不执行
  triggerMode: 'once_change' | 'always' // 触发模式
  operator: string                       // 条件操作符
  compareValue: string | number          // 条件阈值
  actionType: TriggerActionType          // 动作类型（12 种）
  actionValue: Record<string, any>       // 动作参数（每种 action 不一样）
  debounceMs?: number                    // 防抖毫秒数（默认 0，不防抖）
  confirmBefore?: boolean                // 触发前弹 Modal 确认（默认 false）
}
```

---

## 8 种条件操作符

**源码**：`bindingConfig.ts:L71-L78`（下拉选项） + `useBindingExecutor.ts:L84-L118`（实现）

| # | value | label | 等价 | 适用类型 |
|---|-------|-------|------|----------|
| 1 | `==` | 等于 | `==` | number / string |
| 2 | `!=` | 不等于 | `!=` | number / string |
| 3 | `>` | 大于 | `>` | number |
| 4 | `<` | 小于 | `<` | number |
| 5 | `>=` | 大于等于 | `>=` | number |
| 6 | `<=` | 小于等于 | `<=` | number |

**实现细节**（`useBindingExecutor.ts:L84-L118`）：

```ts
// 操作符 → JS 比较函数映射
const OPS: Record<string, (a, b) => boolean> = {
  '==':  (a, b) => a == b,
  '!=':  (a, b) => a != b,
  '>':   (a, b) => Number(a) > Number(b),
  '<':   (a, b) => Number(a) < Number(b),
  '>=':  (a, b) => Number(a) >= Number(b),
  '<=':  (a, b) => Number(a) <= Number(b),
  // 内部也接受别名
  'eq':  (a, b) => a == b,
  'neq': (a, b) => a != b,
  'gt':  (a, b) => Number(a) > Number(b),
  'lt':  (a, b) => Number(a) < Number(b),
  'gte': (a, b) => Number(a) >= Number(b),
  'lte': (a, b) => Number(a) <= Number(b),
}
```

**null/undefined 处理**：测点值为 null 时**不触发任何条件**——直接跳过这条 trigger。

---

## 两种触发模式

| mode | label | 行为 | 典型用例 |
|------|-------|------|----------|
| `once_change` | 仅状态跳变 | 条件**从未命中 → 命中**时执行一次；持续命中不重复执行 | 告警弹窗（越限瞬间弹一次，不会每秒弹） |
| `always` | 持续满足 | 条件**每次 tick 都命中**就每次都执行 | 数据上报（越限期间每秒上报一次） |

**once_change 的内部实现**：`useBindingExecutor` 内部维护 `_prevMatched[triggerId]` 记录上一轮是否命中。

---

## 触发器防抖

```ts
{
  debounceMs: 3000  // 3 秒内最多执行一次
}
```

防抖发生在条件匹配之后、动作执行之前。同一 trigger 在 debounce 窗口内多次命中 → 只执行第一次。

---

## 触发前确认（confirmBefore）

```ts
{
  confirmBefore: true,
  actionType: 'writePoint',
  actionValue: { point: 'breaker_1.open' }
}
```

**实现**：`useBindingExecutor` 执行前调用 `requestConfirm({ title, content })`（Preview 内部方法）。用户点"确认"才继续执行动作，"取消"则跳过。

---

## 外部前置请求（outerRequestApi）

```vue
<koru-preview
  :outer-request-api="async (cfg) => {
    // cfg = { url, method, headers, body }
    const res = await fetch(cfg.url, { method: cfg.method, ... })
    return res.ok  // true = 执行动作，false = 跳过
  }"
/>
```

**作用层级**：在 `confirmBefore` 之后、实际动作之前调用。可以用来做权限校验："非管理员不弹告警"。

---

## 12 种 TriggerActionType 详解

### ⭐ 普通动作（normalActionTypes）

#### 1. `alert` — 弹窗告警

**actionValue**：

```ts
{
  message?: string          // 自定义告警文案（不传自动生成）
  level?: 'warning' | 'critical'  // 严重度，决定弹窗颜色
  title?: string            // 弹窗标题
}
```

**执行流程**：
```
条件命中
  → emit('action-triggered', { actionType: 'alert', actionValue })
  → 消费方（Preview 默认）弹 Modal.warning({ title, content })
  → 同时 emit('alarm', Alarm[])（如果 enableAlarmEmit: true）
```

**消费方处理**（Preview 默认内置）：
```ts
// 组件内部已实现
Modal.warning({
  title: `🚨 ${trigger.label || '告警'}`,
  content: actionValue.message || `测点 ${binding.dataPoint} ${operatorLabel(operator)} ${compareValue}`,
})
```

---

#### 2. `writePoint` — 下发控制指令

**actionValue**：

```ts
{
  device?: string           // 目标设备
  dataPoint?: string        // 目标控制点
  value?: any               // 写入值
  payload?: Record<string, any>  // 额外 payload（透传给消费方）
}
```

**执行流程**：emit('action-triggered') → **消费方必须自己实现**（框架不帮你写后端 API 调用）。

**消费方示例**：
```ts
function onActionTriggered(info) {
  if (info.actionType === 'writePoint') {
    await fetch('/your-api/control/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device: info.actionValue.device,
        point: info.actionValue.dataPoint,
        value: info.actionValue.value,
      }),
    })
  }
}
```

---

#### 3. `jumpPage` — 跳转页面

**actionValue**：

```ts
{
  url: string               // 跳转地址（可含 query）
  openInNewTab?: boolean    // 默认 false
}
```

**框架默认处理**：
```ts
if (actionValue.openInNewTab) {
  window.open(actionValue.url, '_blank')
} else {
  window.location.href = actionValue.url
}
```

**消费方也可以 override**（比如用 Vue Router）：
```ts
function onActionTriggered(info) {
  if (info.actionType === 'jumpPage') {
    router.push(info.actionValue.url)
  }
}
```

---

#### 4. `addLog` — 记录日志

**actionValue**：

```ts
{
  message: string
  level?: 'info' | 'warning' | 'error'  // 默认 'info'
}
```

**框架默认**：`console.log` / `console.warn` / `console.error` 打印。实际使用时消费方接后端审计接口：

```ts
await fetch('/your-api/log/audit', {
  method: 'POST',
  body: JSON.stringify({ level, message, timestamp: Date.now() }),
})
```

---

#### 5. `setGraphAttr` — 修改图元属性

**actionValue**：

```ts
{
  target: 'self' | 'other'     // 修改当前节点还是其他指定节点
  targetCellId?: string        // target='other' 时要传
  attrs: Record<string, any>   // key-value，要修改的图元属性
  restoreAfterMs?: number      // 恢复时间（毫秒），0 = 不恢复（永久）
}
```

**框架实现**（`useBindingExecutor.ts:L439-L619`）：

```ts
// 命中时修改
const node = graph.getCellById(targetCellId)
node.setAttrs(attrs)

// 如果配了 restoreAfterMs
if (actionValue.restoreAfterMs > 0) {
  setTimeout(() => {
    node.setAttrs(originalAttrs)  // 恢复原值
  }, actionValue.restoreAfterMs)
}
```

**典型用例**：告警时把节点边框改成红色闪烁，10 秒后自动恢复。

---

#### 6. `playAudio` — 播放声音

**actionValue**：

```ts
{
  src: string              // 音频 URL
  volume?: number          // 0~1，默认 1
  loop?: boolean           // 默认 false
}
```

**框架实现**：`new Audio(src).play()`

---

#### 7. `startAnimation` / `stopAnimation` — 动画控制

**actionValue**：

```ts
// startAnimation
{
  templateId?: string      // 要启动的动画模板 id（不传用节点默认）
  options?: Record<string, any>  // 动画参数（duration, glowColor 等）
}

// stopAnimation
{
  // 无额外参数
}
```

**框架实现**（`useAnimation.ts`）：
```ts
// startAnimation
graph.getCellById(cellId)?.setAttr('animation', {
  templateId,
  enabled: true,
  options,
})

// stopAnimation
graph.getCellById(cellId)?.setAttr('animation.enabled', false)
```

动画模板 id 列表见 [animation.md](./animation.md)。

---

### 🟢 高级动作（advancedActionTypes）

#### 8. `sendMsg` — 推送通知

**actionValue**：

```ts
{
  channel?: 'wechat' | 'dingtalk' | 'email' | 'webhook'
  to?: string                // 接收方
  title?: string
  message?: string
}
```

**框架不实现**，emit 给消费方。典型接入方式：

```ts
function onActionTriggered(info) {
  if (info.actionType === 'sendMsg') {
    await fetch('/your-api/notify', {
      method: 'POST',
      body: JSON.stringify({
        channel: info.actionValue.channel,
        to: info.actionValue.to,
        message: info.actionValue.message,
      }),
    })
  }
}
```

---

#### 9. `openDialog` — 打开业务弹窗

**actionValue**：

```ts
{
  dialogKey?: string         // 弹窗标识（消费方内部注册）
  url?: string               // 或直接打开 iframe
  title?: string
  props?: Record<string, any>  // 传给弹窗的 props
}
```

**消费方实现**：

```ts
const dialogRegistry = {
  'device-detail': (props) => h(DeviceDetailDialog, props),
  'alarm-history': (props) => h(AlarmHistoryDialog, props),
}

function onActionTriggered(info) {
  if (info.actionType === 'openDialog') {
    const factory = dialogRegistry[info.actionValue.dialogKey]
    if (factory) showDialog(factory(info.actionValue.props))
  }
}
```

---

#### 10. `httpRequest` — 执行 HTTP 请求

**actionValue**：

```ts
{
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  headers?: Record<string, string>
  body?: string                   // POST/PUT body
  bodyType?: 'json' | 'text'      // 默认 'json'
  timeoutMs?: number              // 默认 5000
}
```

**框架实现**（`useBindingExecutor.ts` 内部 fetch）：
```ts
fetch(url, {
  method,
  headers: {
    'Content-Type': bodyType === 'json' ? 'application/json' : 'text/plain',
    ...headers,
  },
  body: bodyType === 'json' ? JSON.stringify(body) : body,
  signal: AbortSignal.timeout(timeoutMs),
})
```

> **注意**：这个是**同步阻塞执行**（在 tick 循环里 await），如果接口慢会拖慢其他触发器。建议生产环境用 `sendMsg` / `writePoint` 让后端处理。

---

#### 11. `runScript` — 执行 JEXL 脚本

**actionValue**：

```ts
{
  script: string             // JEXL 表达式
  vars?: Record<string, any> // 额外注入的变量
}
```

**框架实现**（`useJexl`）：
```ts
const ctx = {
  currentValue: binding.currentValue,
  cellData: node.getData(),
  ...actionValue.vars,
}
const result = jexl.evaluate(actionValue.script, ctx)
// result 可以用来：动态决定要不要触发、动态生成文案等
```

**典型 JEXL 表达式示例**：

```jexl
// 动态文案
"设备 " + cellData.label + " 告警：" + currentValue + "A"

// 复杂条件
currentValue > 25 && currentValue < 50

// 调用函数（useScriptLib 内置的 Math、Date、自定义函数）
Math.abs(currentValue - 25) > 5
```

> **安全说明**：JEXL 不是 JS eval，不能执行任意代码，只能做表达式求值。但仍然建议不要把用户输入直接拼进 script。

---

## 触发器匹配完整流程

```
useBindingExecutor.onTick()
  │
  ├─ 1. 遍历所有 BindingRegistryEntry
  │     对每个 entry 的 triggers[]
  │
  ├─ 2. 检查 trigger.enabled
  │     → false = 跳过
  │
  ├─ 3. 条件匹配：operator(currentValue, compareValue)
  │     → false = 记录 _prevMatched[triggerId] = false，跳过
  │     → true = 继续
  │
  ├─ 4. 检查 triggerMode
  │     ├─ 'once_change' && _prevMatched[triggerId] === true → 跳过（持续命中不重复）
  │     └─ 'always' → 继续
  │
  ├─ 5. debounceMs 防抖检查
  │     如果距离上次执行 < debounceMs → 跳过
  │
  ├─ 6. confirmBefore 前置确认
  │     Modal.confirm → 用户取消 → 跳过
  │
  ├─ 7. outerRequestApi 外部前置请求
  │     返回 false → 跳过
  │
  ├─ 8. 执行 actionType（12 种）
  │     ├─ 框架内置：alert / jumpPage / playAudio / setGraphAttr / startAnimation / stopAnimation
  │     └─ emit 出去：writePoint / sendMsg / openDialog / httpRequest / runScript / addLog
  │
  └─ 9. 更新 _prevMatched + pushAlarm（如果 enableAlarmEmit）
```

---

## Preview 事件回调完整类型

```ts
// 消费方在 @action-triggered 里会收到的 payload
interface ActionTriggeredPayload {
  cellId: string
  triggerId: string
  actionType: TriggerActionType
  actionValue: Record<string, any>
  matched: boolean           // true = 条件命中（肯定是 true 才触发）
  binding?: BindingRegistryEntry
  triggerConfig?: TriggerItem
}

// @alarm 里的告警类型
interface Alarm {
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

---

## 常见配置示例

### 电流越限告警（阈值 25A）

```jsonc
{
  "device": "ct",
  "dataPoint": "ia",
  "targetProperty": "text",
  "triggers": [
    {
      "id": "trig-1",
      "enabled": true,
      "triggerMode": "once_change",
      "operator": ">",
      "compareValue": 25,
      "actionType": "alert",
      "actionValue": {
        "level": "critical",
        "message": "ct.ia 电流越限 25A"
      },
      "debounceMs": 3000,
      "confirmBefore": false
    }
  ]
}
```

### 电流越限自动下发控制命令

```jsonc
{
  "triggers": [
    {
      "enabled": true,
      "triggerMode": "once_change",
      "operator": ">",
      "compareValue": 25,
      "actionType": "writePoint",
      "actionValue": {
        "device": "breaker_1",
        "dataPoint": "open",
        "value": 1
      },
      "confirmBefore": true   // 下发前弹确认框
    }
  ]
}
```

### 断路器状态跳变记录日志 + 播放音效

```jsonc
{
  "device": "breaker_1",
  "dataPoint": "state",
  "triggers": [
    {
      "enabled": true,
      "triggerMode": "once_change",
      "operator": "==",
      "compareValue": "fault",
      "actionType": "addLog",
      "actionValue": {
        "message": "断路器进入故障态",
        "level": "error"
      }
    },
    {
      "enabled": true,
      "triggerMode": "once_change",
      "operator": "==",
      "compareValue": "fault",
      "actionType": "playAudio",
      "actionValue": {
        "src": "/assets/alarm-bell.mp3",
        "volume": 1,
        "loop": true
      }
    }
  ]
}
```

---

## 相关文档

- 可视化模板（10 种）：[binding-templates.md](./binding-templates.md)
- 动画模板：[animation.md](./animation.md)
- 绑定注册表：[binding-registry.md](./binding-registry.md)
- Preview 集成：[preview-user-guide.md](./preview-user-guide.md)
