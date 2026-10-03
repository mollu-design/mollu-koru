# KoruGraphEditor 开发者指南

> 本文档面向**集成方开发者**，讲解 KoruGraphEditor 编辑器组件的完整使用方式、Props/Emits 的实用场景、常见业务代码示例。
> **安装与注册**见 [quick-start.md](./quick-start.md)；纯 API 参考见 [component-api.md](./component-api.md)；终端操作手册见 [user-editor-operations.md](./user-editor-operations.md)。

---

## 最小集成

```vue
<template>
  <div style="height: 100vh">
    <koru-graph-editor
      v-model:graph="graphData"
      mode="edit"
      persistence-key="substation-1-transformer"
      :show-minimap="true"
      @ready="onEditorReady"
      @save="onSave"
      @preview="onPreview"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  setComponentConfig,
  setMultiStateConfig,
  setDeviceConfig,
  type KoruGraphData,
} from '@mollu/koru/topology'

// ── 全局配置（一次设置，所有组件生效） ──
setComponentConfig({
  toolbarName: '1#主变压器间隔',
  toolbarLogo: '/assets/substation-icon.png',
  stencilWidth: 220,
  confirmTemplateApply: true,     // 应用模板前弹确认框
  fullscreenTarget: '.editor-host',
})

setMultiStateConfig({
  pointOptions: [
    { value: 'breaker_state', label: '断路器状态' },
    { value: 'switch_state', label: '刀闸状态' },
  ],
  statePresets: ['合闸', '分闸', '故障', '检修'],
})

setDeviceConfig({
  deviceOptions: [
    { value: 'main_tr', label: '主变压器' },
    { value: 'breaker_1', label: '1#断路器' },
    { value: 'breaker_2', label: '2#断路器' },
  ],
})

// ── 画布数据 ──
const graphData = ref<KoruGraphData>({ nodes: [], edges: [] })

onMounted(async () => {
  // ① 从后端加载已保存的图纸
  const res = await fetch(`/your-api/diagram/${diagramId}`)
  const { diagramData } = await res.json()
  graphData.value = diagramData.cells
    ? { nodes: [], edges: [] }  // X6 原生格式，需用 loadDiagram() 灌入
    : diagramData

  // ② 用 ref 方式灌入 X6 原生 JSON（更完整，带 canvas 配置）
  //    见下一节
})

const koruRef = ref<InstanceType<typeof KoruGraphEditor>>()

function onEditorReady(api: Record<string, any>) {
  // api 就是 koruRef.value 暴露的全部方法
  console.log('编辑器就绪', api.getGraph())

  // 如果需要加载 X6 原生 JSON（从后端拿的 diagramData）
  api.loadDiagram(diagramData)  // { cells: [...], canvas: {...} }
}

function onSave(data: { diagramData: any; bindingRegistry: any[]; name?: string }) {
  backend.saveDiagram({
    diagramData: data.diagramData,     // X6 原生序列化格式
    bindingRegistry: data.bindingRegistry,  // 绑定注册表（给后端 WS 订阅用）
    name: data.name,                    // 用户在保存弹窗输入的图纸名称
  })
}

function onPreview(data: { diagramData: any; bindingRegistry: any[] }) {
  // 切换到预览模式
  currentView.value = 'preview'
  previewPayload.value = data
}
</script>
```

---

## Props 详解（常用场景）

### `persistenceKey` — 恢复上次编辑

默认值 `'koru-diagram-data'`。设成空字符串 `''` 禁用 IndexedDB 持久化。

```vue
<!-- 每个间隔一个独立 key，互不干扰 -->
<koru-graph-editor persistence-key="substation-1-breaker-cells" />
<koru-graph-editor persistence-key="substation-2-transformer" />
```

### `persistenceConfirm` — 恢复前弹确认框

默认恢复时直接加载。如果画布可能被覆盖（比如多个编辑页），加个确认：

```vue
<koru-graph-editor
  :persistence-confirm="async (savedData) => {
    return await Modal.confirm({
      title: '恢复上次编辑？',
      content: '检测到本地有未保存的图纸数据，是否恢复？',
    })
  }"
/>
```

### `persistenceAdapter` — 自定义存储

默认用 IndexedDB。想换成 localStorage 或内存存储：

```ts
import { createIndexedDBAdapter } from '@mollu/koru/topology'

const memoryAdapter: PersistenceStorageAdapter = {
  async get(key) { return localStorage.getItem(key) },
  async set(key, value) { localStorage.setItem(key, value) },
  async remove(key) { localStorage.removeItem(key) },
}

<koru-graph-editor :persistence-adapter="memoryAdapter" />
```

### `options` — 画布权限控制

限制用户能做什么，做一个"只读但允许选中"的画布：

```vue
<koru-graph-editor
  :options="{
    allowDragNode: false,      // 不能拖节点
    allowCreateEdge: false,    // 不能连线
    allowDelete: false,        // 不能删
    grid: true,
    gridSize: 20,
    zoom: { min: 0.5, max: 3 },
  }"
/>
```

### `customShapes` — 注册业务 SVG 符号

在模板里传 SVG 列表（或者全局注册）：

```ts
const customShapes = [
  { label: '断路器', svg: '<svg>...</svg>' },
  { label: '刀闸',   svg: '<svg>...</svg>' },
  { label: '变压器', svg: '<svg>...</svg>' },
]
```

```vue
<!-- ⚠️ 方式 A：通过 prop 传入（只对这一个编辑器生效） -->
<!--   注意：prop 会覆盖 setComponentConfig 的全局值！ -->
<!--   如果传了 prop，全局 store 里的 customShapes 就被忽略了。 -->
<!--   正常场景推荐用方式 B。只有需要完全不同的符号集才用 prop。 -->
<koru-graph-editor :custom-shapes="customShapes" />

<!-- ✅ 方式 B（推荐）：通过 setComponentConfig 全局传入（所有编辑器 + 预览都生效） -->
<script setup>
import { setComponentConfig, registerSvgNode } from '@mollu/koru/topology'
// 项目启动时调一次，静态全局注册（无 graph 也能调）
customShapes.forEach((item, index) => registerSvgNode(item, index))
setComponentConfig({ customShapes })
</script>
```

> 完整注册流程（含 defs 挂载）见 [svg-custom-nodes.md](./svg-custom-nodes.md)。

### `stencilGroups` — 自定义左侧元件分组

```ts
import type { KoruStencilGroup } from '@mollu/koru/topology'

const myGroups: KoruStencilGroup[] = [
  {
    name: 'basic',
    label: '基础图形',
    items: [
      { shape: 'custom-rect', label: '矩形', dropWidth: 80, dropHeight: 50 },
      { shape: 'custom-circle', label: '圆',   dropWidth: 50, dropHeight: 50 },
    ],
  },
  {
    name: 'electrical',
    label: '电气符号',
    items: [
      { shape: 'svg-node-0', label: '断路器', dropWidth: 48, dropHeight: 48 },
    ],
  },
]
```

```vue
<!-- prop 传入（覆盖默认分组） -->
<koru-graph-editor :stencil-groups="myGroups" />

<!-- 或者全局配置 -->
<script setup>
setComponentConfig({ stencilGroups: myGroups })
</script>
```

> 分组会与内置默认分组自动合并——内置 `basic`/`electrical`/`templates` 会被你的同名分组覆盖，其他保留。

### `showToolbar / showStencil / showPropertyPanel / showMinimap` — 面板显隐

| 场景 | 组合 |
|------|------|
| **标准编辑器** | 全开（默认） |
| **极简画布** | `showToolbar=false, showPropertyPanel=false`，只留 Stencil + 画布 |
| **属性面板独立** | `showPropertyPanel=false`，自己在外面放 `<KoruPropertyPanel>` |
| **纯展示（编辑模式但禁所有操作）** | `options.allow* = false` + `showStencil=false` |

### `toolbarLogo / toolbarName / fullscreenTarget` — 工具栏定制

```ts
setComponentConfig({
  toolbarName: '110kV 主控室',
  toolbarLogo: '/assets/substation-logo.svg',
  fullscreenTarget: '#editor-container',  // 全屏时只全屏这个 div，不是整个页面
})
```

### `saveDefaultName / savePlaceholder` — 保存对话框默认值

用户点工具栏"保存"按钮时，组件内置一个命名对话框。这两个 prop 控制对话框里的默认值和 placeholder：

```vue
<!-- edit.vue 典型用法 -->
<koru-graph-editor
  :save-default-name="saveDefaultName"
  save-placeholder="留空则自动使用设备名+图纸"
/>
```

```ts
// edit.vue onReady 里根据设备档案推断默认图纸名
saveDefaultName.value = device?.name
  ? `${device.name} 拓扑图`
  : ''   // 空字符串 → placeholder 提示用户输入
```

| Prop | 默认值 | 说明 |
|------|--------|------|
| `saveDefaultName` | `''` | 保存对话框的默认文件名（运行时传入，比如从设备档案推断） |
| `savePlaceholder` | `'留空则自动使用"设备名+图纸"'` | 命名输入框的 placeholder 提示 |

> 如果 `saveEnabled`（见下）被设为 `false`，对话框不会弹出——`saveDefaultName` 会直接作为 `data.name` emit 给 `@save` 事件的 handler。

### `saveEnabled` — 关闭内置保存对话框

默认 `true`（组件弹框让用户命名）。设为 `false` 时，点保存直接 emit `@save`，跳过弹框：

```ts
// 方式 A：全局 store 配置（所有编辑器都不弹）
setComponentConfig({ saveEnabled: false })

// 方式 B：不走这个 prop，直接用 @save 事件 handler 里自己弹框
```

关闭内置弹框的场景：
- 你有自己的保存对话框 UI（比如要弹"选择保存到哪个项目"）
- 图纸名已经固定（比如"1#主变压器间隔"），不需要用户每次改

---

## Emits 详解

### `save` — 保存图纸

```ts
interface SavePayload {
  diagramData: any     // X6 原生序列化：{ cells: [...], canvas: {...} }
  bindingRegistry: any[]  // 绑定注册表（给后端 WS 订阅用）
  name?: string         // 用户在保存弹窗输入的图纸名称（可能为空）
}

function onSave(data: SavePayload) {
  // 发给后端存起来
  backend.saveDiagram(data.diagramData, data.bindingRegistry, data.name)
}
```

> **为什么要同时传 bindingRegistry？**
> `diagramData` 存的是画布结构（节点在哪、连线怎么连）；
> `bindingRegistry` 存的是"节点 X 的测点 Y 订阅 device.dataPoint"。
> 预览模式需要 bindingRegistry 来建立实时数据订阅关系。

### `preview` — 切换预览模式

跟 `save` 的 payload 一样：

```ts
function onPreview(data) {
  // 方案 A：同一组件切 mode
  //  <koru-graph-editor v-model:graph="graphData" :mode="viewMode" />
  //  viewMode.value = 'preview'

  // 方案 B：换组件（推荐）
  currentView.value = 'preview'
  previewPayload.value = data
}
```

### `ready` — 编辑器就绪

payload 就是 ref.value 暴露的全部方法：

```vue
<koru-graph-editor @ready="onEditorReady" />
```

```ts
function onEditorReady(api) {
  // api.getGraph()           → X6 Graph 实例
  // api.loadDiagram(data)    → 灌入 X6 原生 JSON
  // api.getBindingRegistry() → 绑定注册表
  // api.instance.zoomIn()    → 实例方法
  // api.instance.addNode()
  // ...
}
```

可以替代 `koruRef.value?.loadDiagram(data)` 的写法——`@ready` 触发时组件一定已 mounted。

### `template` — 模板操作

```ts
interface TemplatePayload {
  action: 'save' | 'delete' | 'clear'
  template?: TemplateItem
  templates?: TemplateItem[]
}

function onTemplate(payload: TemplatePayload) {
  switch (payload.action) {
    case 'save':
      console.log('新模板保存:', payload.template)
      break
    case 'delete':
      console.log('模板已删除')
      break
    case 'clear':
      console.log('所有模板已清空')
      break
  }
  // 组件内部已完成 IndexedDB 操作，这里可以同步给后端
}
```

---

## 实例方法（ref 调用）

```vue
<koru-graph-editor ref="editorRef" />
```

```ts
const editorRef = ref<InstanceType<typeof KoruGraphEditor>>()

// ── 数据加载 ──
editorRef.value?.loadDiagram(x6Json)  // { cells: [...], canvas: {...} }
editorRef.value?.getBindingRegistry() // → BindingRegistryItem[]

// ── 视口控制 ──
editorRef.value?.instance.fitView()
editorRef.value?.instance.zoomIn()
editorRef.value?.instance.setZoom(1.5)

// ── 图元操作 ──
editorRef.value?.instance.addNode({
  shape: 'custom-rect',
  x: 100, y: 200,
  width: 80, height: 50,
  label: 'CT',
})
editorRef.value?.instance.addEdge({
  source: 'node-1',
  target: 'node-2',
})
editorRef.value?.instance.removeNode('node-3')

// ── 选区 ──
editorRef.value?.instance.selectNode('node-1')
editorRef.value?.instance.selectAll()
editorRef.value?.instance.clearSelection()

// ── 撤销/重做 ──
editorRef.value?.instance.undo()
editorRef.value?.instance.redo()
console.log(editorRef.value?.instance.canUndo)

// ── 模式 ──
editorRef.value?.instance.setMode('preview')
```

> 完整方法列表见 [component-api.md](#实例方法通过-ref-调用)

---

## 完整场景：保存图纸到后端 + 预览

```vue
<!-- 编辑页 -->
<template>
  <koru-graph-editor
    v-model:graph="graphData"
    persistence-key="substation-1"
    @ready="onReady"
    @save="onSave"
    @preview="onPreview"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { collectBindingRegistry } from '@mollu/koru/topology'

const router = useRouter()
const graphData = ref({ nodes: [], edges: [] })
const editorRef = ref()
let bindingRegistry: any[] = []

function onReady(api) {
  // 1. 从后端加载图纸
  fetch(`/your-api/diagram/${diagramId}`).then(r => r.json()).then(({ diagramData, registry }) => {
    api.loadDiagram(diagramData)
    bindingRegistry = registry
  })
}

async function onSave(data) {
  // 2. 保存到后端
  await fetch(`/your-api/diagram/${diagramId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagramData: data.diagramData,
      bindingRegistry: data.bindingRegistry,
    }),
  })
  bindingRegistry = data.bindingRegistry
  // 提示保存成功...
}

function onPreview(data) {
  // 3. 跳到预览页（或同一组件切模式）
  router.push({
    name: 'diagram-preview',
    query: { diagramId },
  })
  // 预览页自己从后端拉一次 diagramData + bindingRegistry
}
</script>
```

---

## 完整场景：集成到 Tabs（多图纸切换）

```vue
<template>
  <a-tabs v-model:active-key="activeTab">
    <a-tab-pane key="transformer" title="1#主变压器">
      <koru-graph-editor :key="'tr-' + activeVersion" ref="trRef" persistence-key="substation-1-tr" />
    </a-tab-pane>
    <a-tab-pane key="breaker" title="1#馈线断路器">
      <koru-graph-editor :key="'br-' + activeVersion" ref="brRef" persistence-key="substation-1-br" />
    </a-tab-pane>
  </a-tabs>
</template>
```

**关键**：给 `<koru-graph-editor>` 加 `:key`——切换 tab 时强制重建组件，触发 IndexedDB 恢复对应 key 的数据。如果不加 key，Vue 会复用组件实例，persistenceKey 变了但不会自动重新加载。

---

## 完整场景：自定义 SVG 符号库

```ts
// symbols.ts — 业务方维护自己的 SVG 符号
import { registerSvgNode } from '@mollu/koru/topology'

export const electricalSymbols = [
  {
    label: '断路器',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect x="4" y="18" width="16" height="12" rx="2" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="20" y1="24" x2="28" y2="24" stroke="#333" stroke-width="2"/>
      <rect x="28" y="18" width="16" height="12" rx="2" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="8" y1="24" x2="4" y2="24" stroke="#333" stroke-width="2"/>
      <line x1="44" y1="24" x2="40" y2="24" stroke="#333" stroke-width="2"/>
    </svg>`,
  },
  { label: '刀闸', svg: '...' },
  { label: '接地刀闸', svg: '...' },
  { label: '电流互感器', svg: '...' },
  { label: '电压互感器', svg: '...' },
  { label: '避雷器', svg: '...' },
]

// main.ts 里注册一次（静态全局，无 graph 也能调）
electricalSymbols.forEach((item, index) => registerSvgNode(item, index))
// 注册后 shapeName 自动变成 svg-node-0, svg-node-1, ...
// 同时自动填充到 Stencil 的 "电气符号" 分组
```

---

## 完整场景：独立使用子组件

不想用 KoruGraphEditor 的"全家桶"？可以只拿需要的子组件：

```vue
<template>
  <div class="custom-editor">
    <!-- 自己布局 -->
    <koru-stencil width="200" />
    <div class="center">
      <koru-toolbar />
      <!-- X6 画布自己创建（useKoruGraphEditor） -->
      <div ref="graphContainer" />
    </div>
    <koru-property-panel />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { KoruToolbar, KoruStencil, KoruPropertyPanel, useKoruGraphEditor } from '@mollu/koru/topology'

const graphContainer = ref<HTMLElement>()
const { instance, getGraph } = useKoruGraphEditor(graphContainer, {
  // KoruGraphEditorOptions
  grid: true,
  zoom: { min: 0.5, max: 3 },
})
</script>
```

> 独立使用子组件时，它们之间通过 **useCanvasStore**（全局 reactive store）共享状态。不用手动传 props 同步。

---

## 完整场景：事件订阅（画布级）

```vue
<koru-graph-editor ref="editorRef" />
```

```ts
const editorRef = ref()

onMounted(() => {
  const graph = editorRef.value?.getGraph()
  if (!graph) return

  // X6 原生事件
  graph.on('node:click', ({ node }) => {
    console.log('节点被点击:', node.id, node.getData())
  })

  graph.on('edge:connected', ({ edge }) => {
    console.log('连线创建:', edge.id)
  })

  graph.on('node:added', ({ node }) => {
    // 拖入新节点
    console.log('新增节点:', node.shape)
  })

  graph.on('node:removed', ({ node }) => {
    console.log('删除节点:', node.id)
  })

  graph.on('cell:change:*', ({ cell }) => {
    console.log('节点属性变化:', cell.id)
  })
})
```

---

## ⚠️ 常见坑

### 1. `loadDiagram` vs `setGraphData` 区别

| 方法 | 输入格式 | 适用场景 |
|------|----------|----------|
| `loadDiagram(data)` | X6 原生 JSON `{ cells, canvas }` | 从后端拿回的完整图纸数据 |
| `setGraphData(data)` | `KoruGraphData` `{ nodes, edges }` | 手动构造的简单数据 |

**从后端加载务必用 `loadDiagram`**，因为它会同时恢复 `canvas` 配置（网格、背景、缩放）。

### 2. shape 未注册 → 自动降级，不崩溃

`loadDiagram` 内部有 shape 注册表预检机制：遍历 cells 时会用 `Node.registry.get(shape)` / `Edge.registry.get(shape)` 检测每个 cell 的 shape 是否已注册。

| 情况 | 行为 |
|------|------|
| shape 已注册 | 正常加载 |
| shape 未注册（SVG 符号文件缺失等） | **降级为基础形状**（node→rect, edge→edge），不崩溃 |
| cell 完全缺 shape 字段 | 丢弃 + warn |

降级时会彻底清除原始自定义 shape 的 `attrs` / `labels` / `label` / `lineText`，只保留 rect/edge 能安全识别的字段，杜绝 `[object Object]` 渲染异常。控制台会打印 warn 列出所有缺失的 shape 名。

> 完整细节见 [svg-custom-nodes.md#shape-注册保护机制](./svg-custom-nodes.md#shape-注册保护机制)。

### 3. 多编辑器实例 + Stencil 共享

Stencil 分组是**全局**的（存在 Canvas Store 里）。如果你同时挂两个 KoruGraphEditor，后渲染的 Stencil 会覆盖前一个的分组。

解决：不要同时渲染，或者用 `v-if` 切换，或者给每个编辑器传独立的 `stencilGroups` prop。

### 4. persistenceKey 命名规范

建议按"项目-间隔-类型"格式：

```
substation-1-tr          → 1号变电站主变压器间隔
substation-1-breaker-1  → 1号变电站1号断路器间隔
substation-2-cabinet-3  → 2号变电站3号开关柜
```

避免用通用名 `koru-diagram-data`——多个图纸会互相覆盖。

### 4. `@save` 事件的 name 可能为空

保存弹窗里的名称输入框默认空。如果用户直接点保存，`data.name` 就是空字符串。后端要有兜底逻辑（比如用"设备名 + 图纸"自动生成）。

### 5. 禁用持久化

```vue
<!-- 方式 A：prop 传空字符串 -->
<koru-graph-editor persistence-key="" />

<!-- 方式 B：props 不传 + persistenceConfirm 不触发 -->
```

### 6. 组件销毁后重建（Tabs 切换）

加 `:key` 强制重建，否则 Vue 复用实例不会重新跑 persistence 恢复逻辑。

---

## 参考

- 最小示例：[quick-start.md](./quick-start.md)
- 纯 API 参考：[component-api.md](#korugrapheditor编辑器主组件)
- 全局配置项：[global-config.md](./global-config.md)
- 自定义 SVG 节点：[svg-custom-nodes.md](./svg-custom-nodes.md)
- 绑定注册表：[binding-registry.md](./binding-registry.md)
- 持久化：[persistence.md](./persistence.md)
