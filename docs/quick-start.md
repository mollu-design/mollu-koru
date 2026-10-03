# 快速开始

## 安装

```bash
pnpm add @mollu/koru
```

### 自动安装的依赖

| 依赖 | 安装位置 | 说明 |
|------|---------|------|
| `@antv/x6 ^3.1.7` | **dependencies**（自动装） | 底层图编辑引擎核心 |
| `vue ^3.4.0` | **peerDependencies** | 消费方项目必然已有 |

### 方案 A：完整方案（推荐，支持全部功能）

同时安装 `@arco-design/web-vue`（可选但装了能用 KoruPropertyPanel / KoruPreview 完整功能）：

```bash
pnpm add @arco-design/web-vue@^2.58.0
```

### 方案 B：精简方案（零 Arco）

**不装 Arco 也能跑！** 12 个核心组件已自建 UI 层：

```bash
pnpm add @mollu/koru
```

**核心容器组件**（用 `useKoruGraphEditor` + 手动 init 的方式组装界面）：

| 组件 | 用途 | API 文档 |
|------|------|---------|
| KoruToolbar | 顶部工具栏（保存/预览/撤销/缩放） | [editor-api.md · KoruToolbar](./editor-api.md#korutoolbar工具栏) |
| KoruStencil | 左侧元件拖拽面板 | [editor-api.md · KoruStencil](./editor-api.md#korustencil元件面板) |
| KoruContextMenu | 右键菜单 | [editor-api.md · KoruContextMenu](./editor-api.md#korucontextmenu右键菜单) |
| KoruMinimap | 右下角小地图 | [editor-api.md · KoruMinimap](./editor-api.md#koruminimap小地图) |
| KoruGraphEditor（简化版） | 编辑器画布核心 | [editor-api.md · KoruGraphEditor](./editor-api.md#korugrapheditor编辑器主组件) |

**辅助组件**（弹窗/内部渲染器，自动被其他组件使用）：

| 组件 | 用途 | API 文档 |
|------|------|---------|
| KoruModal | 通用弹窗（零 Arco 自建） | [editor-api.md · KoruModal](./editor-api.md#korumodal通用弹窗) |
| KoruConfirmDialog | 确认弹窗（替代 Modal.confirm） | [editor-api.md · KoruConfirmDialog](./editor-api.md#koruconfirmdialog确认弹窗) |
| KoruTemplate | 模板面板 | [editor-api.md · KoruTemplate](./editor-api.md#korutemplate模板面板) |
| KoruGallery | 图库管理弹窗 | [editor-api.md · KoruGallery](./editor-api.md#korugallery图库管理弹窗) |
| KoruSavePanel / KoruNodeRenderer / KoruEdgeRenderer / KoruLogoName | 内部子组件 | [editor-api.md · 内部子组件](./editor-api.md#内部子组件) |

> 详细改造清单 + 完整模板代码见 [零 Arco 迁移技术文档](./zero-arco-migration.md)。

---

## 注册方式

### 方式一：全局插件（推荐）

```ts
// main.ts
import { createApp } from 'vue'
import { KoruTopologyPlugin } from '@mollu/koru/topology'
import App from './App.vue'

const app = createApp(App)
app.use(KoruTopologyPlugin)
app.mount('#app')
```

插件自动完成：
- 检查 `@antv/x6` 依赖、注册基础节点形状（`custom-rect` 等 7 种）
- 注册 `KoruModal` / `KoruConfirmDialog`（零 Arco 自建组件）
- 若 `@arco-design/web-vue` 已安装，额外注册 ArcoVue + ArcoVueIcon
- 注入全局样式（含 `.k-btn` / `.k-input` 等零 Arco 基础组件类）

### 方式二：按需手动导入

**完整方案（方案 A）**——需要引入 Arco 样式：

```vue
<script setup lang="ts">
import { KoruGraphEditor, KoruToolbar } from '@mollu/koru/topology'
import '@arco-design/web-vue/dist/arco.css'
import '@mollu/koru/style/koru.css'
</script>
```

**精简方案（方案 B，零 Arco）**——只引入 koru 样式：

```vue
<script setup lang="ts">
import { KoruGraphEditor, KoruToolbar } from '@mollu/koru/topology'
import '@mollu/koru/style/koru.css'
</script>
```

---

## 完整初始化示例（main.ts）

插件注册只是第一步。消费方通常还需要做两件事——**SVG 符号注册**和**全局 UI 配置**。以下是 main.ts 中常见的完整初始化流程：

```ts
// main.ts
import { createApp } from 'vue'
import { KoruTopologyPlugin, registerSvgGlob, setComponentConfig } from '@mollu/koru/topology'
import App from './App.vue'

const app = createApp(App)

// ① 插件注册（基础形状 + 零 Arco 组件自动全局注册）
app.use(KoruTopologyPlugin)

// ② SVG 符号注册（可选但推荐，loadDiagram 含 SVG 节点时必须先注册）
// glob 三选项缺一不可：query / import / eager
const svgModules = import.meta.glob('@/assets/koru/**/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const svgShapes = registerSvgGlob(svgModules)

// ③ 全局 UI 配置（可选，不调则用内置默认值）
setComponentConfig({
  toolbarName: '我的拓扑编辑器',
  stencilWidth: 210,
  customShapes: svgShapes,   // ② 的结果自动挂进去
})

app.mount('#app')
```

> 业务项目通常把这三步封到一个 `bootstrapKoru()` 函数里，main.ts `await bootstrapKoru()` 后再 mount。这样保证任何 Koru 组件挂载时，配置和符号都已就绪。
> 
> 完整 SVG 注册用法见 [svg-custom-nodes.md](./svg-custom-nodes.md)，4 类全局配置详解见 [global-config.md](./global-config.md)。

---

## 编辑模式（完整方案）

```vue
<template>
  <div style="height: 100vh">
    <koru-graph-editor v-model:graph="graphData" mode="edit" @save="handleSave" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { setComponentConfig, type KoruGraphData } from '@mollu/koru/topology'

setComponentConfig({ toolbarName: '我的拓扑编辑器', stencilWidth: 210 })

const graphData = ref<KoruGraphData>({ nodes: [], edges: [] })
function handleSave(data: { diagramData: any; bindingRegistry: any[] }) {
  console.log('画布:', data.diagramData, '绑定:', data.bindingRegistry)
}
</script>
```

---

## 预览模式（完整方案）

画完的拓扑图切换到运行态——**只有画布，没有 Stencil 和属性面板**，支持绑定数据实时刷新、节点点击、告警闪烁：

```vue
<template>
  <div style="height: 100vh">
    <koru-preview
      :graph="graphData"
      :auto-fit="true"
      :allow-canvas-pan="true"
      @ready="handleReady"
      @device-click="handleDeviceClick"
      @alarm="handleAlarm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { KoruGraphData } from '@mollu/koru/topology'

const graphData = ref<KoruGraphData>({ nodes: [], edges: [] })

// 从 IndexedDB 或后端 API 加载编辑器保存的数据
// graphData.value = await loadFromStorage()

function handleReady(api: any) {
  console.log('预览组件就绪', api)
  // api.highlightDevice('node-1')  // 高亮指定设备
  // api.scrollToCell('node-1')     // 滚动到指定设备
}

function handleDeviceClick(payload: any) {
  console.log('点击了设备', payload.node)
}

function handleAlarm(alarms: any[]) {
  console.log('告警列表', alarms)
}
</script>
```

> 完整 props / events / exposed API 见 [component-api.md · KoruPreview](./component-api.md)。绑定实时数据配置见 [global-config.md · setBindingConfig](./global-config.md#setbindingconfig绑定测试配置)。

---

## 零 Arco 风格（精简方案）

不安装 `@arco-design/web-vue`，只用 mollu-koru 零 Arco 组件 + 原生 HTML/CSS 搭界面。核心是 **手动管理 DOM 生命周期**（不像完整方案 `<koru-graph-editor>` 自动处理）：

```vue
<template>
  <div style="height: 100vh; display: flex; flex-direction: column">
    <KoruToolbar />
    <div style="flex: 1; display: flex">
      <KoruStencil />
      <div ref="canvasEl" style="flex: 1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useKoruGraphEditor, useCanvasStore, KoruToolbar, KoruStencil } from '@mollu/koru/topology'

const editor = useKoruGraphEditor({ mode: 'edit', grid: true })
const store = useCanvasStore()
const canvasEl = ref<HTMLElement | null>(null)

onMounted(() => {
  editor.init(canvasEl.value!)
  store.x6GraphRef.value = editor.getGraph()
})
onBeforeUnmount(() => editor.destroy())
</script>
```

> **完整模板 + 样式 + 右键菜单 + 自定义属性面板**：见 [零 Arco 迁移技术文档](./zero-arco-migration.md)。关键差异：`editor.init()` 需手动传 DOM 元素、`store.x6GraphRef` 需手动赋 graph 实例、属性面板自己写原生 HTML。

### 方案对比

| 能力 | 完整方案（Arco） | 精简方案（零 Arco） |
|------|-----------------|-------------------|
| 编辑器核心（画布/Stencil/工具栏/模板/图库） | ✅ | ✅ |
| 属性面板 | ✅ KoruPropertyPanel（Arco 表单） | ⚠️ 需自己写（或参考零 Arco 迁移文档里的原生属性面板写法） |
| 多状态编辑器 | ✅ | ❌ 需自己写 |
| 包体积 | 含 Arco（~300KB+ gzip） | 仅 X6 + mollu-koru |
| 样式冲突 | 可能与其他 UI 库冲突 | 零冲突 |

---

## 全局配置速查

quick-start 里不再重复贴完整配置代码——4 类配置（多状态 / 绑定 / 设备 / UI）各有独立文档，按需查阅：

| 配置函数 | 用途 | 文档 |
|---------|------|------|
| `setComponentConfig` | 工具栏名、Logo、Stencil 宽度、分组覆盖 | [UI 配置](./global-config.md#setcomponentconfigui-组件配置) |
| `setBindingConfig` | 实时数据源、轮询间隔、写入回调 | [绑定配置](./global-config.md#setbindingconfig绑定测试配置) |
| `setMultiStateConfig` | 测点候选、状态预设 | [多状态配置](./global-config.md#setmultistateconfig多状态配置) |
| `setDeviceConfig` | 设备树、属性面板字段 | [设备配置](./global-config.md#setdeviceconfig设备属性面板配置) |

**快速上手最小配置**（够用就行）：

```ts
setComponentConfig({ toolbarName: '我的编辑器', stencilWidth: 210 })
```

> **全局配置完整指南**：参见 [global-config.md](./global-config.md)

---

## 数据模型

quick-start 只列类型名，完整接口定义见 [component-api.md · 数据类型](./component-api.md)：

| 类型 | 用途 |
|------|------|
| `KoruGraphData` | 画布数据（`v-model:graph` 的值） |
| `KoruNodeData` | 节点数据（shape / x / y / width / height / label / attrs / data / ports） |
| `KoruEdgeData` | 连线数据（source / target / label / attrs / data） |
| `KoruPortData` | 连接桩数据 |

> 保存时 `@save` 事件返回的 `diagramData: { cells, canvas }` 是 **X6 原生序列化格式**，不等同于 KoruGraphData。

---

## 构建 & 开发

组件库开发者需要自己 build 或本地 watch：

```bash
cd mollu-koru
pnpm install
pnpm dev        # 监听模式，watch 编译
pnpm build      # 输出 dist/（ESM / CJS / DTS）
```

> **完整开发指南、产物结构、发布流程**：参见 [README.md · 开发](../../../README.md)

---

## 常见问题

### Q: 如何获取画布实例并调用方法？

```ts
const koruRef = ref<InstanceType<typeof KoruGraphEditor>>()
koruRef.value?.zoomIn()
koruRef.value?.fitView()
const registry = koruRef.value?.getBindingRegistry()
```

> **完整实例方法列表**：参见 [component-api.md](./component-api.md)

### Q: 如何自定义 SVG 节点？

```ts
import { registerSvgGlob } from '@mollu/koru/topology'
registerSvgGlob(import.meta.glob('src/assets/koru/**/*.svg', {
  query: '?raw', import: 'default', eager: true,
}))
```

SVG 资源（国网标准电气符号）已开源在 `mollu-design/assets/` 目录。详见 [svg-custom-nodes.md](./svg-custom-nodes.md)。

### Q: 数据持久化如何工作？

默认 IndexedDB 自动保存/恢复。通过 `persistenceKey` prop 控制：

```vue
<koru-graph-editor persistence-key="my-diagram-key" />
```

> 详细说明：参见 [persistence.md](./persistence.md)
