# Composables 索引

> **源码目录**：`src/topology/composables/`（18 个文件）
> 每个 composable 是独立的 Vue 3 函数，返回 reactive state + 操作方法。大部分已被 KoruGraphEditor / KoruPreview 内部消费，部分可以独立使用。

---

## 总览

| # | 函数 | 文件 | 核心职责 |
|---|------|------|----------|
| 1 | `useKoruGraphEditor` | useKoruGraphEditor.ts | **编辑器核心**：创建 X6 Graph + 11 插件 + 事件桥接 |
| 2 | `useBindingExecutor` | useBindingExecutor.ts | **绑定执行引擎**：模板匹配 + 条件判断 + 12 种动作分发 |
| 3 | `useMultiState` | useMultiState.ts | **多状态切换**：find parents + apply visibility + JEXL 动态显隐 |
| 4 | `useAnimation` | useAnimation.ts | **动画控制**：apply / start / stop / toggle |
| 5 | `useTrigger` | useTrigger.ts | **触发器条件匹配**：8 种操作符 |
| 6 | `useEventActions` | useEventActions.ts | **事件动作执行**：6 种 cell-event → 业务回调 |
| 7 | `useJexl` | useJexl.ts | **JEXL 模板引擎**：9 种 templateType → 运行时求值 |
| 8 | `useScriptLib` | useScriptLib.ts | **JEXL 脚本沙箱**：注入 Math/Date/自定义函数 |
| 9 | `useCanvasPersistence` | useCanvasPersistence.ts | **持久化**：IndexedDB 读写 + 自动保存 + 防抖 |
| 10 | `useKoruCanvasConfig` | useKoruCanvasConfig.ts | **画布配置应用**：grid / wheel / pan / snapline 等运行时参数 |
| 11 | `useBindingRegistry` | useBindingRegistry.ts | **注册表采集**：collect + flatten + buildFetchData |
| 12 | `useBinding` | useBinding.ts | **绑定 CRUD**：newBinding / add / remove / update |
| 13 | `useSelection` | useSelection.ts | **选区管理**：select / deselect / selectAll / clear |
| 14 | `useNodeDrag` | useNodeDrag.ts | **节点拖拽**：dragstart / dragging / dragend 事件 |
| 15 | `useZoom` | useZoom.ts | **缩放控制**：zoomIn / zoomOut / fitView / setZoom |
| 16 | `useUndoRedo` | useUndoRedo.ts | **撤销重做**：push / undo / redo / clear（max 100） |
| 17 | `useClipboard` | useClipboard.ts | **剪贴板**：copy / cut / paste（+20px 偏移） |
| 18 | `useContextMenu` | useContextMenu.ts | **右键菜单**：open / close / 14 项 handler |

---

## useKoruGraphEditor — 编辑器核心

**位置**：`useKoruGraphEditor.ts`（~1025 行，最大的 composable）

```ts
function useKoruGraphEditor(
  container: HTMLElement | Ref<HTMLElement>,
  options?: Partial<KoruGraphEditorOptions>
): {
  instance: KoruEditorInstance        // X6 Graph + 所有方法
  getGraph: () => Graph               // 快速访问 X6 Graph
  canUndo: Ref<boolean>               // 撤销可用？
  canRedo: Ref<boolean>               // 重做可用？
  // + 所有 X6 Graph 的方法透传
}
```

### 11 个 X6 插件 & 具体配置值

| # | 插件 | 配置值 |
|---|------|--------|
| 1 | Grid | `{ size: 20, visible: true, type: 'dot' }` |
| 2 | Panning | `{ enabled: true, modifiers: ['shift'] }` |
| 3 | Scroller | `{ enabled: true, padding: 20 }` |
| 4 | MouseWheel | `{ enabled: true, minScale: 0.5, maxScale: 3, modifiers: ['ctrl'] }` |
| 5 | Connecting | `{ router: 'manhattan', connector: 'rounded', anchor: 'center', allowBlank: false, allowLoop: false, allowNode: false, snap: { radius: 20 } }` |
| 6 | Snapline | `{ enabled: true, filter: ['node'] }` |
| 7 | Selection | `{ rubberband: true, showNodeSelectionBox: true, multiple: true }` |
| 8 | Transform | `{ resizing: true, rotating: true, snapping: true }` |
| 9 | Keyboard | `{ enabled: true, global: false }` |
| 10 | Clipboard | `{ enabled: true, useLocalStorage: false }` |
| 11 | History | `{ enabled: true, max: 100, ignoreChange: true }` |

### bridgeX6Events 事件桥接

内部把 X6 事件 → `eventBus.emit(KoruEvent.xxx)` 统一分发：

| X6 事件 | → KoruEvent | payload |
|---------|------------|---------|
| `node:click` | CELL_CLICK | `{ eventType, cellId, shape, data }` |
| `node:dblclick` | CELL_DBLCLICK | 同上 |
| `node:mouseenter` | CELL_MOUSEENTER | 同上 |
| `node:mouseleave` | CELL_MOUSELEAVE | 同上 |
| `selection:changed` | SELECTION_CHANGED | `{ cellIds }` |
| `history:change` | HISTORY_CHANGED | `{ canUndo, canRedo }` |
| `history:undo` | UNDO_CHANGED | — |
| `history:redo` | UNDO_CHANGED | — |
| `node:added` | NODE_ADDED | `{ node }` |
| `node:removed` | NODE_REMOVED | `{ node }` |
| `edge:connected` | EDGE_CONNECTED | `{ edge }` |
| `node:resized` | NODE_RESIZED | `{ node }` |
| `node:rotated` | NODE_ROTATED | `{ node }` |

---

## useBindingExecutor — 绑定执行引擎

**位置**：`useBindingExecutor.ts`

```ts
function useBindingExecutor(deps: BindingExecutorDeps): {
  onTick: (values: Record<string, any>) => void
  checkTriggers: (entry: BindingRegistryEntry, currentValue: any) => TriggerItem | null
  executeTrigger: (trigger: TriggerItem, entry: BindingRegistryEntry, currentValue: any) => Promise<void>
  applyTemplate: (entry: BindingRegistryEntry, currentValue: any) => void
  runAll: (values: Record<string, any>) => { alarms: Alarm[] }
}
```

### BindingExecutorDeps 完整接口

```ts
interface BindingExecutorDeps {
  getGraph: () => Graph
  readTagValue?: (graph, cellId, tag) => any
  showActionMessage?: (msg, type) => void
  sendCommand?: (payload) => Promise<void>
  requestConfirm?: (cfg) => Promise<boolean>
  onActionTriggered?: (payload: ActionTriggeredPayload) => void
  fetchData?: () => Promise<Record<string, any>>
  onDataUpdate?: (values) => void
  onTickComplete?: (summary) => void
}
```

### 触发器匹配流程

```
executeTrigger(trigger, entry, currentValue)
  │
  ├─ 1. 条件匹配（useTrigger）
  │     operator(currentValue, compareValue) → boolean
  │
  ├─ 2. once_change 模式 → 检查 _prevMatched[triggerId]
  │
  ├─ 3. debounceMs → 距上次执行 < debounceMs 则 skip
  │
  ├─ 4. confirmBefore → Modal.confirm 用户取消则 skip
  │
  ├─ 5. outerRequestApi → 返回 false 则 skip
  │
  └─ 6. actionType 分发（12 种 handler）
        ├─ alert / message → 显示 UI + emit action-triggered
        ├─ writePoint / httpRequest / sendMsg → emit 给消费方
        ├─ setGraphAttr → graph.setAttrs + 可选恢复
        ├─ playAudio → new Audio().play()
        ├─ jumpPage → window.location.href 或消费方 override
        ├─ openDialog → emit
        ├─ runScript → useJexl.safeEval()
        ├─ startAnimation / stopAnimation → useAnimation
```

### setGraphAttr 的恢复机制（源码 `useBindingExecutor.ts:L439-L467`）

```ts
if (trigger.actionType === 'setGraphAttr') {
  const node = graph.getCellById(cellId)
  const originalAttrs = { ...node.getAttrs() }   // 快照
  node.setAttrs(actionValue.attrs)

  if (actionValue.restoreAfterMs && actionValue.restoreAfterMs > 0) {
    setTimeout(() => {
      node.setAttrs(originalAttrs)                // 恢复
    }, actionValue.restoreAfterMs)
  }
}
```

---

## useMultiState — 多状态切换

**位置**：`useMultiState.ts`

```ts
// 查找
function findMultiStateParents(graph: Graph, statePoint?: string): string[]
function getMultiStateChildren(graph: Graph, parentId: string): string[]

// 核心切换
function applyMultiStateVisibility(graph, parentId, stateId): void
function applyMultiStateByPoint(graph, statePoint, activeStateId): void

// 暂停 / 恢复
function pauseMultiState(): void
function resumeMultiState(): void
function isMultiStatePaused(): boolean

// 手动切换
function switchMultiState(cellId, newStateId): void

// JEXL 辅助
function validateMultiStateJexl(expr: string): string | null   // 返回错误信息或 null
function safeEvalPointExpr(expr: string, ctx): any
```

### applyMultiStateByPoint 内部逻辑（源码 L70-L132）

```ts
function applyMultiStateByPoint(graph, statePoint, activeStateId) {
  const parents = findMultiStateParents(graph, statePoint)
  for (const parentId of parents) {
    const parent = graph.getCellById(parentId)
    const rules = parent.getData('multiState.stateRules')?.[activeStateId]
    if (!rules) continue

    for (const [childId, rule] of Object.entries(rules)) {
      const child = graph.getCellById(childId)
      if (!child) continue

      let visible: boolean
      if (typeof rule === 'boolean') {
        visible = rule
      } else if (typeof rule === 'string') {
        // JEXL 表达式：safeEvalPointExpr
        visible = !!safeEvalPointExpr(rule, {
          currentValue: child.getData('lastValue'),
          cellData: child.getData(),
        })
      }

      visible ? child.show() : child.hide()
    }
    parent.setData('multiState.currentStateId', activeStateId)
  }
}
```

---

## useAnimation — 动画控制

**位置**：`useAnimation.ts`

```ts
// 启动 / 停止
function startCellAnimation(cell, templateId, options?): void
function stopCellAnimation(cell): void
function toggleCellAnimation(cell, templateId, options?): void

// 批量
function applyAnimationFromData(graph, cell, animationData): void
function stopAllAnimations(graph): void
function stopCellAnimations(graph, cellIds): void

// CSS 类管理
function animationClassFor(templateId): string   // → 'anim-opacityBreath'
```

### DOM 操作（核心实现）

```ts
function applyCellAnimation(cell, templateId, options) {
  const dom = cell.container as HTMLElement
  // 先清旧的
  dom.classList.remove(...allAnimClasses)
  // 加新的
  const cls = animationClassFor(templateId)
  dom.classList.add(cls)
  // 注入 CSS 变量（duration, glowColor 等）
  for (const [key, val] of Object.entries(options || {})) {
    dom.style.setProperty(`--${key}`, String(val))
  }
}
```

---

## useTrigger — 触发器条件匹配

**位置**：`useTrigger.ts`

```ts
// 条件判断
function checkCondition(operator: string, current: any, compare: any): boolean
function checkTriggerCondition(trigger: TriggerItem, currentValue: any): boolean

// 防抖包装
function debounceCheck(debounceMs: number, fn: () => boolean): () => boolean
```

### 8 种操作符实现

```ts
const OPS = {
  '==':  (a, b) => a == b,
  '!=':  (a, b) => a != b,
  '>':   (a, b) => Number(a) > Number(b),
  '<':   (a, b) => Number(a) < Number(b),
  '>=':  (a, b) => Number(a) >= Number(b),
  '<=':  (a, b) => Number(a) <= Number(b),
  'in':  (a, b) => Array.isArray(b) ? b.includes(a) : String(b).includes(String(a)),
  'contains': (a, b) => String(a).includes(String(b)),
  // 别名
  'eq': / 'neq': / 'gt': / 'lt': / 'gte': / 'lte': 同上
}
```

---

## useJexl — JEXL 模板引擎

**位置**：`useJexl.ts`

```ts
function useJexl(): {
  openJexl(graph, cellId): Promise<JexlTemplateState | null>
  buildTemplateFromStyleMapping(config: StyleMappingConfig): JexlTemplateState
  buildStyleConfigFromTemplate(state: JexlTemplateState): StyleMappingConfig
  onTemplateTypeChange(newType: JexlTemplateType): JexlTemplateState
  applyTemplate(cell, state, currentValue): any    // 运行时求值
  checkJexl(expr, ctx): any
  saveJexl(graph, cellId, state): void
}

// 工厂函数（静态）
function normalizedJexl(expr: string): string
function newJexlTemplate(type: JexlTemplateType): JexlTemplateState
```

### JexlTemplateState 完整字段

```ts
interface JexlTemplateState {
  type: JexlTemplateType            // 10 种模板类型
  colorPairs: { value: string; color: string }[]  // colorMap
  thresholdRules: ThresholdRule[]                  // threshold
  defaultColor: string                             // colorMap / threshold
  thresholdValue: string                           // threshold_color
  thresholdOp: 'gt' | 'lt'                         // threshold_color
  normalColor: string                              // threshold_color
  alarmColor: string                               // threshold_color
  prefix: string                                   // textFormat
  suffix: string                                   // textFormat
  decimals: number                                 // textFormat
  trueText: string                                 // boolText
  falseText: string                                // boolText
  mappingItems: JexlMappingItem[]                  // statusTextMapping
  defaultText: string                              // statusTextMapping / textFormat / boolText
}
```

---

## useScriptLib — JEXL 脚本沙箱

**位置**：`useScriptLib.ts`

```ts
function useScriptLib(): {
  evaluate: (expr: string, vars?: Record<string, any>) => any
  availableFunctions: () => string[]   // ['Math.abs', 'Math.round', 'now', ...]
  safeEval: (expr, ctx) => any          // try-catch 包装版
}
```

### 内置函数列表

| 函数 | 说明 |
|------|------|
| `Math.abs(x)` | 绝对值 |
| `Math.round(x)` | 四舍五入 |
| `Math.floor(x)` / `Math.ceil(x)` | 下取整 / 上取整 |
| `Math.min(a, b)` / `Math.max(a, b)` | 最小 / 最大 |
| `Date.now()` | 当前时间戳 |
| `now()` | 当前时间戳（别名） |
| `today()` | `'YYYY-MM-DD'` |
| `bool(v)` | truthy → true，否则 false |
| `stringify(v)` | `JSON.stringify(v)` |

### 自定义扩展

```ts
// 注入自己的函数
useScriptLib.addFunction('myCustomFn', (a, b) => a + b)
```

---

## useCanvasPersistence — 持久化

**位置**：`useCanvasPersistence.ts`

```ts
function useCanvasPersistence(
  graph: Graph,
  options: {
    storageKey: string
    storage?: PersistenceStorageAdapter    // IndexedDB 或自定义
    debounceMs?: number                     // 默认 1000
    confirmRestore?: (data) => Promise<boolean>
    autoSave?: boolean                      // 默认 true
  }
): {
  save: () => Promise<void>
  load: () => Promise<boolean>
  clear: () => Promise<void>
  getKey: () => string
}
```

### PersistenceStorageAdapter 接口

```ts
interface PersistenceStorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}
```

### IndexedDB 适配器默认实现

```ts
// utils/storage.ts
const DB_NAME = 'koru'
const STORE_NAME = 'diagrams'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase>
function dbGet<T>(key): Promise<T | null>
function dbSet(key, value): Promise<void>
function dbRemove(key): Promise<void>
function dbAll<T>(): Promise<T[]>
```

---

## useKoruCanvasConfig — 画布配置应用

**位置**：`useKoruCanvasConfig.ts`

```ts
function useKoruCanvasConfig(graph: Graph): {
  applyConfig: (config: Partial<KoruCanvasConfig>) => void
  getConfig: () => KoruCanvasConfig
  serialize: () => KoruCanvasConfigStorage
  deserialize: (raw: KoruCanvasConfigStorage) => KoruCanvasConfig
  reset: () => void
}
```

### KoruCanvasConfig 完整字段

```ts
interface KoruCanvasConfig {
  showGrid: boolean
  gridSize: number
  gridType: 'dot' | 'line' | 'mesh'
  showBorder: boolean
  borderWidth: number
  backgroundType: 'none' | 'color' | 'image'
  backgroundColor: string
  backgroundImage: string
  minScale: number
  maxScale: number
  mouseWheel: 'zoom' | 'pan'
  panning: boolean
  scroller: boolean
  snaplineEnabled: boolean
  snaplineFilter: string[]
  defaultNodeWidth: number
  defaultNodeHeight: number
  fontSize: number
  fontFamily: string
  textColor: string
}
```

---

## useBindingRegistry — 绑定注册表

**位置**：`useBindingRegistry.ts`

```ts
// 采集
function collectBindingRegistry(graph: Graph): BindingRegistryItem[]

// 工具
function extractBindingKeys(registry: BindingRegistryItem[]): string[]
function flattenBindingData(raw: any, inputFormat?: 'flat' | 'grouped'): Record<string, any>
function buildFetchData(
  registry: BindingRegistryItem[],
  fetchFn: () => Promise<any>,
  options?: { inputFormat?: 'flat' | 'grouped' }
): () => Promise<Record<string, any>>

// composable
function useBindingRegistry(): {
  collect: (graph) => BindingRegistryItem[]
  getKeys: (registry) => string[]
}
```

### buildFetchData 自动过滤逻辑

```ts
function buildFetchData(registry, fetchFn, opts) {
  const neededKeys = extractBindingKeys(registry)  // ['ct.ia', 'ct.ib', 'breaker_1.state']

  return async () => {
    const raw = await fetchFn()
    const flat = flattenBindingData(raw, opts.inputFormat)

    // 只返回图纸用到的 key
    const filtered = {}
    for (const key of neededKeys) {
      if (key in flat) filtered[key] = flat[key]
    }
    return filtered
  }
}
```

---

## useBinding — 绑定 CRUD

**位置**：`useBinding.ts`

```ts
function newBinding(): BindingItem   // 创建带 uuid 的空绑定项

function useBinding(): {
  add: (cell, binding) => void
  remove: (cell, bindingId) => void
  update: (cell, bindingId, patch) => void
  getAll: (cell) => BindingItem[]
  clear: (cell) => void
}
```

---

## 其他 Composables

### useSelection（useSelection.ts）

```ts
function useSelection(graph: Graph): {
  selected: Ref<string[]>
  select: (cellId: string | string[], append?: boolean) => void
  deselect: (cellId: string) => void
  selectAll: () => void
  clear: () => void
  contains: (cellId: string) => boolean
}
```

### useNodeDrag（useNodeDrag.ts）

```ts
function useNodeDrag(graph: Graph): {
  onDragStart: (handler: (e) => void) => void
  onDragging: (handler: (e) => void) => void
  onDragEnd: (handler: (e) => void) => void
  stop: () => void
}
```

### useZoom（useZoom.ts）

```ts
function useZoom(graph: Graph): {
  zoom: Ref<number>
  zoomIn: () => void
  zoomOut: () => void
  setZoom: (level: number) => void
  fitView: () => void
  centerContent: () => void
  reset: () => void
}
```

### useUndoRedo（useUndoRedo.ts）

```ts
function useUndoRedo(graph: Graph): {
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  push: (action: Action) => void
  undo: () => void
  redo: () => void
  clear: () => void
  maxHistory: number   // 100
}
```

### useClipboard（useClipboard.ts）

```ts
function useClipboard(graph: Graph): {
  copy: (cells?: Cell[]) => void
  cut: (cells?: Cell[]) => void
  paste: () => Cell[]
  clear: () => void
  hasClipboard: () => boolean
}
```

### useContextMenu（useContextMenu.ts）

```ts
function useContextMenu(graph: Graph): {
  visible: Ref<boolean>
  position: Ref<{ x: number; y: number }>
  selectedCells: Ref<Cell[]>
  items: ComputedRef<ContextMenuItem[]>
  open: (cell?: Cell, e?: MouseEvent) => void
  close: () => void
  execute: (itemKey: string) => void
}
```

---

## 导出路径

```ts
// 全部
import { useKoruGraphEditor, useBindingExecutor, ... }
  from '@mollu/koru/topology'

// 或按文件直接 import
import { useKoruGraphEditor }
  from '@mollu/koru/topology/composables/useKoruGraphEditor'
```

---

## 相关文档

- 编辑器集成：[editor-user-guide.md](./editor-user-guide.md)
- 预览集成：[preview-user-guide.md](./preview-user-guide.md)
- 绑定模板：[binding-templates.md](./binding-templates.md)
- 触发器：[trigger-actions.md](./trigger-actions.md)
- 多状态：[multi-state.md](./multi-state.md)
- 动画：[animation.md](./animation.md)
- 右键菜单：[context-menu.md](./context-menu.md)
