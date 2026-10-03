# 多状态节点（分合位）

> **源码位置**：`src/topology/composables/useMultiState.ts`（核心逻辑）、`src/topology/components/KoruMultiStateEditorModal.vue`（编辑器）、`src/topology/stores/canvasStore.ts:L225-L233`（全局配置）

---

## 什么是多状态节点

电力符号不是一张静态 SVG——断路器有「合闸 / 分闸 / 故障 / 检修」四种状态，每种状态 SVG 外观不同。多状态节点就是把**多个子图元组合成一个容器**，根据测点值切换不同子图元的显隐。

```
KoruMultiStateEditorModal 组合后：

        多状态容器节点 (multi-state-breaker-1)
        ┌────────────────────────────────────┐
        │  ┌─ 子节点 A ──┐  ┌─ 子节点 B ──┐  │
        │  │ 合闸 SVG    │  │ 分闸 SVG    │  │
        │  └─────────────┘  └─────────────┘  │
        │  ┌─ 子节点 C ──┐  ┌─ 子节点 D ──┐  │
        │  │ 故障 SVG    │  │ 检修 SVG    │  │
        │  └─────────────┘  └─────────────┘  │
        │                                     │
        │  stateRules = {                     │
        │    "closed":  [A:visible, B:hidden, │
        │               C:hidden, D:hidden],  │
        │    "open":    [A:hidden, B:visible, │
        │               C:hidden, D:hidden],  │
        │    "fault":   [C:visible, 其余隐藏],│
        │    "maintenance": [D:visible, ...]  │
        │  }                                  │
        └────────────────────────────────────┘

绑定测点 state === "closed" → 触发 elementStateMapping → 切到合闸
```

---

## 全局配置

```ts
import { setMultiStateConfig } from '@mollu/koru/topology'

setMultiStateConfig({
  // 状态点下拉选项（编辑器里"绑定哪个测点驱动"）
  pointOptions: [
    {
      value: 'breaker_state',
      label: '断路器状态',
      points: [
        { value: 'closed', label: '合闸' },
        { value: 'open',   label: '分闸' },
        { value: 'fault',  label: '故障' },
      ],
    },
    {
      value: 'switch_state',
      label: '刀闸状态',
      points: [
        { value: 'closed', label: '合' },
        { value: 'open',   label: '分' },
      ],
    },
  ],

  // 状态预设（新建多状态时自动填充）
  statePresets: ['合闸', '分闸', '故障', '检修'],

  // 状态颜色（可选，用于调色盘）
  stateColors: {
    合闸: '#10b981',
    分闸: '#9ca3af',
    故障: '#ef4444',
    检修: '#f59e0b',
  },

  autoAdvance: false,  // 状态切换时是否自动推进（高级功能）
})
```

---

## 创建多状态节点

### 方式 1：编辑器里操作（KoruMultiStateEditorModal）

```
1. 从 Stencil 拖两个 SVG 断路器到画布（一个画合闸、一个画分闸）
2. 选中两个 → 右键 → 「组合」
3. 点击组合节点 → 属性面板 → 「编辑多状态」按钮
4. 在 KoruMultiStateEditorModal 里：
   ├─ 选状态点（从 setMultiStateConfig.pointOptions 里选）
   ├─ 每个状态勾选哪些子图元 visible / hidden
   ├─ 可以给每个状态写 JEXL 表达式动态决定显隐
   └─ 保存
5. 组合节点的 data 里现在有：
   {
     shape: 'multi-state-group',
     data: {
       multiState: {
         point: 'breaker_state',
         currentStateId: 'closed',
         stateRules: { closed: [...], open: [...], fault: [...] }
       }
     }
   }
```

### 方式 2：代码创建

```ts
const stateNode = graph.addNode({
  shape: 'custom-rect',        // 容器本身的 shape
  x: 100, y: 100,
  width: 48, height: 48,
  data: {
    multiState: {
      point: 'breaker_state',
      currentStateId: 'closed',
      stateRules: {
        closed: { cell-a: true, cell-b: false, cell-c: false },
        open:   { cell-a: false, cell-b: true,  cell-c: false },
        fault:  { cell-a: false, cell-b: false, cell-c: true  },
      },
    },
  },
})
```

---

## 运行态切换逻辑

**源码**：`useMultiState.ts:L24-L132`

### 触发来源

| 来源 | 触发方式 |
|------|---------|
| **绑定测点驱动**（最常用） | 模板为 `elementStateMapping` 的绑定检测到测点值变化 → `applyMultiStateByPoint()` |
| **Preview 调试面板手动** | pauseMultiState / resumeMultiState 按钮 |
| **代码调用** | `useMultiState().switchTo(cellId, newStateId)` |

### 切换流程

```
applyMultiStateByPoint(graph, statePoint, activeStateId)
  │
  ├─ 1. findMultiStateParents(graph, statePoint)
  │     遍历所有节点，找 data.multiState.point === statePoint 的
  │
  ├─ 2. 对每个多状态容器：
  │     ├─ 取 stateRules[activeStateId]
  │     │   → { cell-a: true, cell-b: false, ... }
  │     │
  │     ├─ 遍历 stateRules 每一项
  │     │   ├─ value === true  → cell.show()
  │     │   ├─ value === false → cell.hide()
  │     │   └─ value === JEXL 字符串 → jexl.evaluate() → 根据结果显隐
  │     │
  │     └─ 更新容器 data.multiState.currentStateId = activeStateId
  │
  └─ 3. emit('multiStateChanged', { cellId, newStateId })
```

### JEXL 表达式显隐

stateRules 里可以写 JEXL 字符串（运行时求值）：

```jsonc
{
  "stateRules": {
    "closed": {
      "breaker-svg": true,
      "fault-indicator": "currentValue == 'fault'"
    }
  }
}
```

`useJexl` 会注入变量：
- `currentValue` — 当前测点值
- `cellData` — 容器节点 data
- `prevStateId` — 上一轮状态

---

## elementStateMapping 模板

绑定模板里选 `elementStateMapping`（见 [binding-templates.md](./binding-templates.md)）：

```jsonc
{
  "device": "breaker_1",
  "dataPoint": "state",
  "targetProperty": "elementState",
  "templateType": "elementStateMapping",
  "textMapping": {
    "mappingItems": [
      { "sourceValue": "closed",   "showText": "合闸" },
      { "sourceValue": "open",     "showText": "分闸" },
      { "sourceValue": "fault",    "showText": "故障" },
      { "sourceValue": "unknown",  "showText": "未知" }
    ],
    "defaultText": "—"
  }
}
```

**运行时自动关联**：bindingRegistry 里 targetProperty === `elementState` 的条目，会被 useMultiState 订阅——每次 fetchData 拉到新值 → 查 mappingItems 里的 showText → 调 `applyMultiStateByPoint()`。

---

## 父子节点查找

**`findMultiStateParents(graph, statePoint)`**

```ts
// 反向查找：给定一个子节点 cellId，向上找最近的 multiState 容器
const parent = findMultiStateParent(graph, childCellId)
// → 返回 容器节点 或 null

// 正向查找：给定 statePoint，找所有订阅这个点的多状态容器
const parents = findMultiStateParents(graph, 'breaker_state')
// → 返回 [容器节点1, 容器节点2, ...]
```

---

## 调试面板控制

Preview 的 KoruTestToolsPanel 提供两个按钮：

| 按钮 | 作用 |
|------|------|
| 暂停多状态 | `pauseMultiState()` — 冻结当前状态，不再响应测点变化 |
| 恢复多状态 | `resumeMultiState()` — 恢复自动切换 |

手动强制切换：
```ts
previewRef.value?.switchMultiState('breaker-container-id', 'fault')
```

---

## 常见坑

### 1. stateRules 的 key 是子节点的 cellId，不是 shape

```jsonc
// ❌ 错
{ "closed": { "custom-rect": true } }

// ✅ 对
{ "closed": { "cell-a1b2c3": true, "cell-d4e5f6": false } }
```

### 2. elementStateMapping 只在有多状态容器时生效

没有多状态容器的普通节点，选 elementStateMapping 模板没用（不会报错，但也不会做任何事）。

### 3. 一个 statePoint 可以被多个多状态容器订阅

比如所有断路器都订阅 `breaker_state` 这个 statePoint。测点一变 → 全部一起切。

---

## 相关文档

- 绑定模板（elementStateMapping 一节）：[binding-templates.md](./binding-templates.md)
- 触发器：[trigger-actions.md](./trigger-actions.md)
- 全局配置：[global-config.md](./global-config.md)
