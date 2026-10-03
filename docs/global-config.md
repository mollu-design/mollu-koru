# 全局配置指南

Koru 采用**集中式全局配置**模式，消费方通过 4 个 `set*Config()` 函数一次性注册配置，所有组件自动从全局 Store 读取，无需逐个传递 props。

---

## 设计理念

```
传统方式（冗余传参）：
┌─────────────────┐   props   ┌──────────────┐  props  ┌──────────────┐
│  App.vue        │ ────────> │ Editor.vue   │ ──────> │ Stencil.vue  │
│                 │           │              │         │              │
│                 │ ────────> │              │ ──────> │ Toolbar.vue  │
│                 │   props   │              │  props  │              │
└─────────────────┘           └──────────────┘         └──────────────┘

Koru 方式（全局注册）：
┌─────────────────┐  set*Config()  ┌──────────────┐
│  App.vue        │ ──────────────> │  CanvasStore │
│                 │                 │  (reactive)  │
│                 │                 └──────┬───────┘
│                 │                        │ 自动读取
│                 │                 ┌──────▼───────┐
│                 │                 │ 所有 Koru   │
│                 │                 │  组件       │
└─────────────────┘                 └──────────────┘
```

**核心优势**：

- 消费方只需在根组件（或 `main.ts`）调用一次 `set*Config()`
- 所有子组件自动从 Store 读取配置，无需层层传递 props
- 支持运行时动态更新（修改 reactive 对象即可实时生效）
- 组件 props 仍可覆盖全局配置，灵活度不受影响

---

## 配置函数一览

| 函数                    | 用途                            | 影响组件                                   |
| ----------------------- | ------------------------------- | ------------------------------------------ |
| `setMultiStateConfig()` | 多状态测点/设备/预设            | KoruMultiStateEditorModal、KoruGraphEditor |
| `setBindingConfig()`    | 实时数据源、写入回调            | KoruTestToolsPanel、KoruPreview            |
| `setDeviceConfig()`     | 设备树、设备下拉选项            | KoruPropertyPanel（绑定/触发器 tab）       |
| `setComponentConfig()`  | 工具栏、Stencil、Logo、面板显隐 | KoruToolbar、KoruStencil、KoruGraphEditor  |

每个函数都有对应的 `reset*Config()` 用于恢复默认值。

---

## setMultiStateConfig（多状态配置）

### 使用场景

为「组合为状态」弹窗提供测点/设备下拉选项和状态名称预设。用户在编辑模式下选中多个节点 → 右键"组合为状态"→ 在弹窗中配置多状态。

### 配置项

```ts
interface MultiStateConfig {
  /** 测点候选列表 — 多状态编辑器中"状态点"字段的下拉选项 */
  pointOptions: { value: string; label: string }[]
  /** 设备候选列表 — 多状态编辑器中"设备"字段的下拉选项 */
  deviceOptions?: { value: string; label: string }[]
  /** 状态名称预设 — 新增状态时的快捷名称 */
  statePresets?: string[]
  /** 扩展数据 — 挂载任意自定义字段 */
  extra?: Record<string, any>
}
```

### 示例

```ts
import { setMultiStateConfig } from '@mollu/koru/topology'

setMultiStateConfig({
  pointOptions: [
    { value: 'breaker_state', label: '断路器状态' },
    { value: 'switch_state', label: '刀闸状态' },
    { value: 'fault_state', label: '故障状态' },
    { value: 'maintain_state', label: '检修状态' },
    { value: 'position', label: '位置/档位' },
    { value: 'temperature', label: '温度' },
    { value: 'pressure', label: '压力' },
  ],
  deviceOptions: [
    { value: 'main_transformer', label: '主变压器' },
    { value: 'breaker_1', label: '1#断路器' },
    { value: 'breaker_2', label: '2#断路器' },
    { value: 'disconnector', label: '隔离开关' },
  ],
  statePresets: ['合闸', '分闸', '故障', '检修', '备用'],
})
```

### 消费方

- **KoruMultiStateEditorModal**：`pointOptions` 作为"状态点"下拉选项，`deviceOptions` 作为"设备"下拉选项，`statePresets` 作为新增状态快捷名称
- **KoruGraphEditor**：通过 `multiStatePointOptions` prop 回退读取

---

## setBindingConfig（绑定/测试配置）

### 使用场景

对接实时数据系统。预览模式下轮询拉取数据、测试面板写入值、手动刷新等操作都通过此配置对接。

### 配置项

```ts
interface BindingConfig {
  /** 测点值缓存（key = "cellId:device:dataPoint"） */
  values: Record<string, string | number | null>
  /** 写入单个绑定值 — 测试面板"写入值"按钮回调 */
  setValue: (
    cellId: string,
    device: string,
    dataPoint: string,
    value: string | number | null,
  ) => void
  /** 触发画布刷新 — 测试面板"刷新"按钮回调 */
  tick: () => void
  /** 运行绑定测试 — 测试面板"运行测试"按钮回调 */
  runTest: (val: string | number | null) => any[]
  /** 远程拉取实时数据 — 预览模式轮询使用 */
  fetchData?: (points: string[]) => Promise<Record<string, any>>
  /** 轮询间隔（毫秒），0 表示不轮询 */
  pollInterval?: number
  /** 扩展数据 */
  extra?: Record<string, any>
}
```

### 示例

```ts
import { setBindingConfig, useCanvasStore } from '@mollu/koru/topology'

setBindingConfig({
  values: {},
  // 写入绑定值 — 对接实时数据库
  setValue: (cellId, device, dataPoint, value) => {
    const key = `${cellId}:${device}:${dataPoint}`
    console.log(`[Demo] setBindingValue ${key} =`, value)
    // 实际项目中对接后端 API
  },
  // 触发画布绑定刷新
  tick: () => {
    const s = useCanvasStore()
    s.propActiveTab.value = Date.now() + ''
  },
  // 绑定测试
  runTest: (val) => {
    return [] // 返回命中报告
  },
  // 预览模式数据源
  fetchData: async () => {
    return {
      'node-1:WS-001:温度': 23.5,
      'node-1:WS-001:状态': 'running',
    }
  },
  // 轮询间隔
  pollInterval: 2000,
})
```

### 消费方

- **KoruTestToolsPanel**：`values` 显示值、`setValue` 写入、`tick` 刷新、`runTest` 测试
- **KoruPreview**：`fetchData` 拉取实时数据、`pollInterval` 定时轮询、`values` 共享绑定值

---

## setDeviceConfig（设备/属性面板配置）

### 使用场景

为属性面板的绑定 tab 和触发器 tab 提供设备下拉选项和设备树数据。

### 配置项

```ts
interface DeviceConfig {
  /** 设备候选列表 — 绑定/触发器中"设备"下拉选项 */
  deviceOptions: { value: string; label: string }[]
  /** 设备目录数据 — 绑定面板中的设备树（设备 → 测点层级） */
  deviceCatalog?: any
  /** 扩展数据 */
  extra?: Record<string, any>
}
```

### 示例

```ts
import { setDeviceConfig } from '@mollu/koru/topology'

setDeviceConfig({
  deviceOptions: [
    { value: 'main_transformer', label: '主变压器' },
    { value: 'breaker_1', label: '1#断路器' },
    { value: 'breaker_2', label: '2#断路器' },
    { value: 'disconnector', label: '隔离开关' },
  ],
  deviceCatalog: [
    {
      value: 'main_transformer',
      label: '主变压器',
      points: [
        { value: 'temperature', label: '温度' },
        { value: 'oil_pressure', label: '油压' },
        { value: 'winding_temperature', label: '绕组温度' },
      ],
    },
    {
      value: 'breaker_1',
      label: '1#断路器',
      points: [
        { value: 'breaker_state', label: '断路器状态' },
        { value: 'current', label: '电流' },
        { value: 'voltage', label: '电压' },
      ],
    },
  ],
})
```

### 消费方

- **KoruPropertyPanel**：`deviceOptions` 作为绑定/触发器中"设备"下拉选项，`deviceCatalog` 作为绑定面板设备树数据

---

## setComponentConfig（UI 组件配置）

### 使用场景

配置工具栏、Stencil 面板、Logo、面板显隐等 UI 相关属性。

> **重要**：`stencilGroups` 已内置默认配置，包含基础图形（矩形/圆形/多边形/线条/分栏/文本/按钮）、自定义图片、电气符号、模板、本地文件 5 个分组。消费方**无需定义**即可使用。如需扩展或替换，通过 `setComponentConfig({ stencilGroups })` 覆盖。

### 配置项

```ts
interface ComponentConfig {
  /** Stencil 元件分组数据 — 有内置默认值，可覆盖 */
  stencilGroups: KoruStencilGroup[]
  /** SVG 自定义形状列表 */
  customShapes: CustomShapeItem[]
  /** 工具栏 Logo */
  toolbarLogo: string
  /** 工具栏名称 */
  toolbarName: string
  /** 全屏容器 CSS 选择器 */
  fullscreenTarget: string
  /** Stencil 面板宽度 */
  stencilWidth: number
  /** 是否显示工具栏 */
  showToolbar: boolean
  /** 是否显示 Stencil 面板 */
  showStencil: boolean
  /** 是否显示属性面板 */
  showPropertyPanel: boolean
  /** 是否显示小地图 */
  showMinimap: boolean
  /** 扩展数据 */
  extra?: Record<string, any>
}
```

### 默认 Stencil 分组

内置 5 个分组，可直接使用：

| name         | label      | 内容                                                                                        |
| ------------ | ---------- | ------------------------------------------------------------------------------------------- |
| `basic`      | 基础图形   | 7 个自定义样式节点 + 6 个 X6 原生内置节点（rect, circle, ellipse, polygon, polyline, path） |
| `images`     | 自定义图片 | 空（由消费方动态填充）                                                                      |
| `electrical` | 电气符号   | 空（由消费方注册 SVG 节点后动态填充）                                                       |
| `templates`  | 我的模板   | 空                                                                                          |
| `files`      | 本地文件   | 空                                                                                          |

### 合并行为（重要）

`setComponentConfig({ stencilGroups })` **自动与内置默认分组合并**，无需手动展开 `DEFAULT_STENCIL_GROUPS`：

- **同名覆盖**：消费方分组的 `name` 与默认分组相同 → 覆盖该默认分组内容
- **新名追加**：消费方分组的 `name` 在默认中不存在 → 追加到末尾
- **完全替换**：传 `replaceStencilGroups: true` 跳过合并，直接使用消费方分组

此合并逻辑对以下两种场景均生效：

- `setComponentConfig({ stencilGroups })` — 全局配置
- `<KoruGraphEditor :stencil-groups="groups" />` — 组件 prop

### 示例 1：最小配置（零配置即可使用内置 Stencil 分组）

```ts
import { setComponentConfig } from '@mollu/koru/topology'

// 无需定义 stencilGroups，使用内置默认配置
setComponentConfig({
  toolbarName: '我的拓扑编辑器',
  toolbarLogo: '/logo.png',
  stencilWidth: 210,
})
```

### 示例 2：追加自定义分组（自动与默认合并）

消费方只需定义自己的额外分组，默认分组会自动保留：

```ts
import { setComponentConfig } from '@mollu/koru/topology'
import type { KoruStencilGroup } from '@mollu/koru/topology'

// 只定义额外分组，自动追加到默认分组后面
// 内置 5 个默认分组（basic / images / electrical / templates / files）会自动保留
const extraGroups: KoruStencilGroup[] = [
  {
    name: 'my-custom-group',
    label: '自定义分组',
    layoutOptions: { columns: 2, columnWidth: 80, rowHeight: 50 },
    items: [{ shape: 'custom-rect', label: '自定义节点', width: 46, height: 30 }],
  },
]

setComponentConfig({
  stencilGroups: extraGroups, // 自动与默认合并
  toolbarName: '我的拓扑编辑器',
})
```

### 示例 3：覆盖默认分组中的某一个

消费方可以通过 `name` 匹配覆盖默认分组的内容：

```ts
import { setComponentConfig } from '@mollu/koru/topology'
import type { KoruStencilGroup } from '@mollu/koru/topology'

// 覆盖内置 basic 分组的内容，其他默认分组保持不变
const overrides: KoruStencilGroup[] = [
  {
    name: 'basic', // 与默认 basic 同名 → 覆盖
    label: '我的基础图形',
    layoutOptions: { columns: 4, columnWidth: 50, rowHeight: 40 },
    items: [
      { shape: 'custom-rect', label: '矩形', width: 40, height: 28 },
      { shape: 'custom-circle', label: '圆形', width: 36, height: 36 },
    ],
  },
]

setComponentConfig({
  stencilGroups: overrides, // basic 被覆盖，其他默认分组保留
})
```

### 示例 4：完全替换所有分组（不走合并）

如果确实需要完全替换而不是合并，使用 `replaceStencilGroups` 选项：

```ts
import { setComponentConfig } from '@mollu/koru/topology'
import type { KoruStencilGroup } from '@mollu/koru/topology'

const customGroups: KoruStencilGroup[] = [
  {
    name: 'shapes',
    label: '图形库',
    layoutOptions: { columns: 4, columnWidth: 50, rowHeight: 50 },
    items: [
      { shape: 'custom-rect', label: '矩形', width: 40, height: 28 },
      { shape: 'custom-circle', label: '圆形', width: 36, height: 36 },
    ],
  },
]

setComponentConfig({
  stencilGroups: customGroups,
  replaceStencilGroups: true, // 完全替换，不合并
})
```

### 消费方

| 配置项              | 消费组件        | 用途                     |
| ------------------- | --------------- | ------------------------ |
| `stencilGroups`     | KoruStencil     | 左侧分组+节点定义        |
| `customShapes`      | KoruStencil     | SVG 节点缩略图和落点尺寸 |
| `toolbarLogo`       | KoruToolbar     | 工具栏 Logo 显示         |
| `toolbarName`       | KoruToolbar     | 工具栏标题               |
| `fullscreenTarget`  | KoruToolbar     | 全屏按钮作用的根节点     |
| `stencilWidth`      | KoruStencil     | 面板宽度                 |
| `showToolbar`       | KoruGraphEditor | 工具栏显隐               |
| `showStencil`       | KoruGraphEditor | Stencil 显隐             |
| `showPropertyPanel` | KoruGraphEditor | 属性面板显隐             |
| `showMinimap`       | KoruGraphEditor | 小地图显隐               |

---

## 完整配置示例

以下是一个完整的根组件配置示例，展示了 4 个 `set*Config()` 的典型用法：

```vue
<!-- App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import {
  setMultiStateConfig,
  setBindingConfig,
  setDeviceConfig,
  setComponentConfig,
  registerSvgNode,
  mountSvgDefs,
  useCanvasStore,
} from '@mollu/koru/topology'
import type { CustomShapeItem } from '@mollu/koru/topology'

// ============ 1. 多状态配置 ============
setMultiStateConfig({
  pointOptions: [
    { value: 'breaker_state', label: '断路器状态' },
    { value: 'switch_state', label: '刀闸状态' },
  ],
  deviceOptions: [{ value: 'main_transformer', label: '主变压器' }],
  statePresets: ['合闸', '分闸', '故障', '检修'],
})

// ============ 2. 绑定/测试配置 ============
setBindingConfig({
  values: {},
  setValue: (cellId, device, dataPoint, value) => {
    console.log(`写入: ${cellId}:${device}:${dataPoint} = ${value}`)
  },
  tick: () => {
    const s = useCanvasStore()
    s.propActiveTab.value = Date.now() + ''
  },
  runTest: () => [],
  fetchData: async () => ({}),
  pollInterval: 0,
})

// ============ 3. 设备配置 ============
setDeviceConfig({
  deviceOptions: [
    { value: 'main_transformer', label: '主变压器' },
    { value: 'breaker_1', label: '1#断路器' },
  ],
  deviceCatalog: [
    {
      value: 'main_transformer',
      label: '主变压器',
      points: [
        { value: 'temperature', label: '温度' },
        { value: 'oil_pressure', label: '油压' },
      ],
    },
  ],
})

// ============ 4. UI 组件配置 ============
// 无需定义 stencilGroups — 已内置 5 个默认分组（basic/images/electrical/templates/files）
// 如需扩展，只需传额外分组，自动与默认合并
setComponentConfig({
  toolbarName: '我的拓扑编辑器',
  toolbarLogo: '/logo.png',
  fullscreenTarget: '.app-root',
  stencilWidth: 210,
  showToolbar: true,
  showStencil: true,
  showPropertyPanel: true,
  showMinimap: false,
})

// ============ 5. SVG 节点注册（异步） ============
onMounted(() => {
  const svgModules = import.meta.glob('@/assets/svg/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  const svgMap: Record<string, string> = {}
  Object.entries(svgModules).forEach(([path, content]) => {
    const match = path.match(/\/([^/]+)\.svg$/)
    if (match) svgMap[match[1]] = content as string
  })

  const customShapes: CustomShapeItem[] = Object.entries(svgMap).map(([fileName, svg]) => ({
    label: fileName,
    svg,
  }))

  // 静态全局注册（无 graph 也能调）
  customShapes.forEach((item, index) => registerSvgNode(item, index))

  // 等 Graph 就绪后挂 defs
  const tryMount = setInterval(() => {
    const graph = useCanvasStore().x6GraphRef.value
    if (graph) {
      const allDefs = customShapes.map(s => s.defs).filter(Boolean).join('\n')
      if (allDefs) mountSvgDefs(graph, allDefs)
      setComponentConfig({ customShapes })
      clearInterval(tryMount)
    }
  }, 50)
})
</script>
```

### 追加自定义 Stencil 分组

如果需要在默认分组基础上追加自定义分组：

```ts
import { setComponentConfig } from '@mollu/koru/topology'
import type { KoruStencilGroup } from '@mollu/koru/topology'

// 只需定义额外分组，自动与内置默认合并
setComponentConfig({
  stencilGroups: [
    {
      name: 'my-shapes',
      label: '我的图形',
      layoutOptions: { columns: 3, columnWidth: 60, rowHeight: 50 },
      items: [
        { shape: 'custom-rect', label: '自定义矩形', width: 46, height: 30 },
        { shape: 'custom-text', label: '自定义文本', width: 50, height: 24 },
      ],
    },
  ],
})
```

> 合并规则：同名分组覆盖默认、新分组追加末尾。传 `replaceStencilGroups: true` 完全替换。

---

## 配置优先级

配置有三层优先级，高优先级覆盖低优先级：

```

1️⃣ 组件 prop（最高） → <KoruGraphEditor stencil-groups="..." />（自动与默认合并）
2️⃣ 全局 set\*Config() → setComponentConfig({ stencilGroups: [...] })（自动与默认合并）
3️⃣ 内置默认值（最低） → DEFAULT_COMPONENT_CONFIG + DEFAULT_STENCIL_GROUPS

```

> **Stencil 分组特殊说明**：组件 prop 和全局配置的 `stencilGroups` 都会自动与内置默认分组合并（同名覆盖、新名追加）。传 `replaceStencilGroups: true` 可跳过合并。

```ts
// 示例：stencilGroups 的解析逻辑（KoruGraphEditor 内部）
const resolvedStencilGroups = computed(() => {
  if (props.stencilGroups?.length) {
    // prop 传入：自动与默认合并
    return mergeWithDefaults(props.stencilGroups)
  }
  // 回退到全局配置（已经是合并后的结果）
  return store.componentConfig.stencilGroups
})
```

---

## 重置配置

每个 `set*Config()` 都有对应的 `reset*Config()` 函数，可以恢复默认值：

```ts
import {
  resetMultiStateConfig,
  resetBindingConfig,
  resetDeviceConfig,
  resetComponentConfig,
} from '@mollu/koru/topology'

resetMultiStateConfig() // 恢复默认测点选项
resetBindingConfig() // 清空绑定值和回调
resetDeviceConfig() // 清空设备选项
resetComponentConfig() // 恢复默认 UI 配置
```

---

## 动态更新

所有配置对象都是 `reactive` 的，运行时修改会自动反映到所有组件：

```ts
const store = useCanvasStore()

// 动态添加 Stencil 分组
store.componentConfig.stencilGroups.push({
  name: 'dynamic',
  label: '动态分组',
  items: [{ shape: 'custom-rect', label: '新节点', width: 46, height: 30 }],
})

// 动态切换工具栏名称
store.componentConfig.toolbarName = '新模式名称'
```
