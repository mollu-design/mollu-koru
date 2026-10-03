# 开发者技术总览

> **定位**: Mollu-Koru 技术全貌 — 架构分层 · 工程规范 · 核心能力 · 编码约定 · 使用示例

> **范围**: 本文档覆盖架构设计、包工程规范、源码目录、核心绑定系统、双模式能力、命名/编码规范、业务接入示例和后续演进方向，是消费方开发者的入门必读。


## 1. 概述

### 1.1 产品定位

**Koru** 是 **Mollu** 母品牌旗下的可视化图形画布组件库，当前主力场景为**电力监控系统拓扑图编辑器**，同时保留向流程图、关系图、白板等通用场景扩展的能力。

核心架构准则：

- **对外唯一包名**：`@mollu/koru`，不拆分多个 NPM 包
- **底层依赖 X6**：基于 `@antv/x6@3.x` 提供画布渲染、节点/连线、插件系统
- **UI 基于 Arco Design**：消费方需安装 `@arco-design/web-vue`
- **编辑/预览双模式**：`KoruGraphEditor`（全功能编辑）、`KoruPreview`（只读查看）
- **绑定系统**：基于 JEXL 表达式的测点数据 → 图元属性映射（颜色/文本/动画/多状态）
- **SVG 电气符号**：内置 20+ 电力设备 SVG 节点，支持消费方注册自定义符号
- **全量 TypeScript 强类型**，ESM/CJS 双产物

### 1.2 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 运行框架 | Vue | ^3.4.0 |
| 语言 | TypeScript | ^5.9.3 |
| 画布内核 | @antv/x6 | ^3.1.7 |
| UI 组件库 | @arco-design/web-vue | ^2.58.0 |
| 表达式引擎 | JEXL | — |
| 构建 | Vite + vite-plugin-dts | — |
| 样式 | SCSS + BEM 规范 | — |
| 包管理 | pnpm | 11.x |

### 1.3 能力范围

**画布基础**：平移、缩放、框选、撤销/重做、复制粘贴、右键菜单

**节点能力**：SVG 电气符号、自定义形状（矩形/圆形/椭圆/线条/文本/按钮/左右分栏）、拖拽、连接桩、父子容器（X6 parent-child）

**绑定系统**：
- 测点值 → 填充色 / 边框色 / 字体颜色
- 测点值 → 阈值区间 / 状态等值 / 原始值
- 测点值 → 文本格式化 / 动画开关 / 多状态元件

**辅助组件**：Stencil 面板（基础图形 + 电气符号）、工具栏、小地图、属性面板、绑定面板、多状态编辑器、JEXL 测试工具

**双模式**：`KoruGraphEditor`（全功能编辑）、`KoruPreview`（只读查看，支持实时绑定执行）

---

## 2. 包工程规范

### 2.1 完整 package.json 核心配置

```json
{
  "name": "@mollu/koru",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.es.js", "types": "./dist/index.d.ts" },
    "./topology": { "import": "./dist/topology/index.es.js", "types": "./dist/topology/index.d.ts" },
    "./plugins/flow": { "import": "./dist/plugins/flow/index.es.js", "types": "./dist/plugins/flow/index.d.ts" },
    "./style/*": { "import": "./dist/style/*" }
  },
  "peerDependencies": {
    "@antv/x6": "^3.1.7",
    "@arco-design/web-vue": "^2.58.0",
    "vue": "^3.4.0"
  }
}
```

### 2.2 Vite alias 开发期接入

消费方 `vite.config.ts` 推荐配置（用于开发期热更新源码）：

```ts
resolve: {
  alias: {
    '@mollu/koru': 'xx/mollu-design/mollu-koru/src',
    '@mollu/koru/topology': 'xx/mollu-design/mollu-koru/src/topology',
  },
  dedupe: ['vue', '@antv/x6', '@arco-design/web-vue'],
}
```

---

## 3. 源码目录分层架构

严格分层：**底层内核 → 业务模块 → 插件扩展**，层级单向依赖，杜绝循环依赖。

```
src/
├── index.ts                       # 包根入口
├── env.d.ts                       # 全局类型声明
├── assets/                        # 静态资源（SVG 电气符号、logo）
│   ├── svg/                       # 20+ 电力设备 SVG 文件
│   ├── logo.png
│   └── logo.webp
├── style/                         # 全局样式（SCSS）
│   ├── variables.scss             # SCSS 变量
│   ├── global.scss                # 全局重置
│   ├── reset.scss                 # reset 样式
│   └── anim.scss                  # 动画关键帧
│
├── core-kernel/                   # 【底层公共内核】纯 TS、无 Vue 依赖
│   ├── index.ts
│   ├── types.ts                   # 内核基础通用类型
│   ├── event-bus.ts               # 全局事件总线
│   ├── math/                      # 坐标/矩阵/向量几何计算
│   │   ├── point.ts
│   │   ├── rect.ts
│   │   ├── transform.ts
│   │   └── index.ts
│   └── renderer/                  # 渲染抽象层（预留接口）
│       └── index.ts
│
├── topology/                      # 【拓扑业务核心】依赖 core-kernel + Vue + X6 + Arco
│   ├── index.ts                   # @mollu/koru/topology 入口
│   ├── plugin.ts                  # Vue 全局注册插件 KoruTopologyPlugin
│   │
│   ├── components/                # 【UI 组件层】
│   │   ├── index.ts               # 统一导出
│   │   ├── KoruGraphEditor.vue    # ★ 编辑模式根组件
│   │   ├── KoruPreview.vue        # ★ 预览/只读模式根组件
│   │   ├── KoruStencil.vue        # Stencil 物料面板（基础图形 + 电气符号）
│   │   ├── KoruToolbar.vue        # 工具栏
│   │   ├── KoruMinimap.vue        # 小地图
│   │   ├── KoruContextMenu.vue    # 右键菜单
│   │   ├── KoruPropertyPanel.vue  # 属性面板
│   │   ├── KoruCanvasPropertyPanel.vue # 画布级属性
│   │   ├── KoruNodeRenderer.vue   # 节点渲染器（预留）
│   │   ├── KoruEdgeRenderer.vue   # 连线渲染器（预留）
│   │   ├── KoruGallery.vue        # 图元展示
│   │   ├── KoruTemplate.vue       # 模板管理
│   │   ├── KoruModal.vue          # 通用 Modal 封装
│   │   ├── KoruLogoName.vue       # Logo 名称
│   │   ├── KoruSavePanel.vue      # 保存面板
│   │   │
│   │   └── panels/                # 【业务弹窗子组件】
│   │       ├── KoruBindingPanel.vue        # ★ 绑定面板（目标属性→测点映射）
│   │       ├── KoruBindingItemForm.vue     # 单条绑定表单
│   │       ├── KoruAnimationPanel.vue      # 动画配置面板
│   │       ├── KoruMultiStateEditorModal.vue # ★ 多状态元件编辑器
│   │       ├── KoruEventPanel.vue          # 事件面板
│   │       ├── KoruJexlEditorModal.vue     # ★ JEXL 表达式编辑器
│   │       ├── KoruMappingModal.vue        # ★ 映射规则编辑（模板类型选择）
│   │       ├── KoruMappingTestModal.vue    # 映射测试工具
│   │       ├── KoruConditionEditorModal.vue # 条件编辑器
│   │       ├── KoruTriggerEditorModal.vue   # 触发编辑器
│   │       ├── KoruButtonMappingModal.vue   # 按钮映射
│   │       ├── KoruPreviewDebugPanel.vue   # 预览调试面板
│   │       └── KoruTestToolsPanel.vue      # 测试工具
│   │
│   ├── composables/               # 【业务逻辑层】Vue Composition API
│   │   ├── index.ts
│   │   ├── useKoruGraphEditor.ts  # ★ 编辑器核心（X6 Graph 初始化 + monkey-patch）
│   │   ├── useKoruCanvasConfig.ts # 画布配置
│   │   ├── useCanvasPersistence.ts # 画布数据持久化（toX6JSON / fromX6JSON）
│   │   ├── useClipboard.ts        # 复制剪切粘贴
│   │   ├── useContextMenu.ts      # 右键菜单
│   │   ├── useNodeDrag.ts         # 节点拖拽
│   │   ├── useSelection.ts        # 点选/框选
│   │   ├── useUndoRedo.ts         # 撤销重做
│   │   ├── useZoom.ts             # 缩放平移
│   │   ├── useJexl.ts             # ★ JEXL 表达式引擎 + 默认模板类型
│   │   ├── useBinding.ts          # ★ 绑定管理（CRUD + 应用）
│   │   ├── useBindingRegistry.ts  # ★ 绑定注册表（cellId → bindings）
│   │   ├── useBindingExecutor.ts  # ★ 绑定执行器（测点值 → 图元属性）
│   │   ├── useMultiState.ts       # ★ 多状态元件（elementStateMapping）
│   │   ├── useAnimation.ts        # 动画配置
│   │   ├── useEventActions.ts     # 事件动作
│   │   ├── useTrigger.ts          # 触发系统
│   │   ├── useScriptLib.ts        # 脚本库
│   │   ├── nodeProps.ts           # 节点属性定义（按 shape 暴露可用属性）
│   │   ├── bindingConfig.ts       # 绑定配置常量
│   │   ├── bindingTypes.ts        # 绑定相关 TS 类型
│   │   └── AnimationTypes.ts      # 动画相关类型
│   │
│   ├── core/                      # 【数据模型层】
│   │   ├── index.ts
│   │   ├── KoruGraph.ts           # 图数据根模型
│   │   └── KoruSelection.ts       # 选区管理器
│   │
│   ├── presets/                   # 【预设物料层】
│   │   ├── index.ts
│   │   ├── registerBasicShapes.ts # ★ 基础形状注册（custom-rect/circle/text/button/split...）
│   │   ├── registerSvgNodes.ts    # ★ SVG 电气符号注册
│   │   ├── registerNodeModule.ts  # 节点模块注册
│   │   ├── defaultStencilGroups.ts # ★ 默认 Stencil 分组配置
│   │   └── ports.ts               # 连接桩预设
│   │
│   ├── stores/                    # 【状态管理层】
│   │   ├── index.ts
│   │   └── canvasStore.ts         # 画布 Pinia store
│   │
│   ├── types/                     # 【拓扑专属类型】
│   │   ├── index.ts
│   │   └── KoruCanvasConfig.ts
│   │
│   └── utils/                     # 【工具方法层】
│       ├── index.ts
│       ├── storage.ts             # localStorage 封装
│       └── svgThumbnail.ts        # SVG 缩略图生成
│
└── plugins/                       # 【内部扩展插件】不独立对外发包
    ├── flow/                      # 流程图插件（预留）
    │   └── index.ts
    └── whiteboard/                # 白板插件（预留）
        └── index.ts
```

### 3.1 分层依赖规则

```
┌──────────────────────────────────────────────┐
│  plugins/ (flow, whiteboard)                  │  ← 仅依赖 core-kernel
├──────────────────────────────────────────────┤
│  topology/                                    │  ← 依赖 core-kernel + Vue + X6 + Arco
│  ├─ components/                               │
│  ├─ composables/                              │
│  ├─ presets/                                  │
│  ├─ core/                                     │
│  └─ stores/                                   │
├──────────────────────────────────────────────┤
│  core-kernel/                                 │  ← 纯 TS，无 Vue/X6/Arco 依赖
│  ├─ math/                                     │
│  ├─ renderer/                                 │
│  └─ event-bus.ts                              │
└──────────────────────────────────────────────┘
```

**单向依赖，禁止反向**：`plugins → topology → core-kernel` 不成立，必须是 `plugins → core-kernel`、`topology → core-kernel`。

---

## 4. 核心能力：绑定系统

绑定系统是 Koru 的核心差异化能力，详见 [binding-registry.md](./binding-registry.md) 和各组件 API。

### 4.1 绑定三要素

```
目标图元属性  →  模板类型  →  测点数据源
   fill         threshold      tagVal(tagId)
   stroke       colorMap
   text         statusTextMapping
   nodeAnim     textFormat
   ...          boolAnim
                elementStateMapping
                rawValue
```

### 4.2 默认模板类型映射（useJexl.ts）

| targetProperty | 首次打开默认模板 | 原因 |
|----------------|-----------------|------|
| fill / stroke / fontColor | **threshold** | 支持 >、<、>=、<=、between 区间 |
| text / label | **rawValue** | 直接显示测点原始值（最常见场景） |
| nodeAnim / lineAnim | boolAnim | 开关量 → 动画开/关 |
| 多状态元件 | elementStateMapping | 状态值 → 元件展示状态 |

### 4.3 父子容器（X6 parent-child）

基于 X6 原生 `parent` 字段实现容器/子图元关系，详见 [x6-parent-child-migration.md](./x6-parent-child-migration.md)。

**三种传播（monkey-patch）**：

| 操作 | 传播方式 |
|------|---------|
| translate | ✅ X6 原生 `eachChild` 自动传播 |
| resize | 🛠️ patchedResize — 按 sx/sy 缩放 child 的 size + 绝对位置偏移 |
| rotate | 🛠️ patchedRotate — `child.rotate(angle, { absolute: true })` |

---

## 5. 双模式：编辑 / 预览

### 5.1 根组件

| 组件 | 用途 | 说明 |
|------|------|------|
| `KoruGraphEditor` | 全功能编辑 | Stencil + 画布 + 属性面板 + 绑定面板 |
| `KoruPreview` | 只读查看 | 画布 + 实时绑定执行，拖拽/右键/连线禁用 |

### 5.2 模式能力差异

| 能力 | KoruGraphEditor | KoruPreview |
|------|-----------------|-------------|
| 平移/缩放 | ✅ | ✅ |
| 节点拖拽/增删 | ✅ | ❌ |
| 连线创建/删除 | ✅ | ❌ |
| Stencil 面板 | ✅ | ❌ |
| 右键菜单 | ✅ | ❌ |
| 属性/绑定面板 | ✅ | ❌ |
| 绑定执行（测点→图元） | ✅（保存时） | ✅（实时） |

---

## 6. 全局命名规范

### 6.1 Vue 组件

根组件区分领域、子组件精简，统一 `Koru` 前缀：

| 组件用途 | 组件名 | 模板标签 |
|---------|--------|---------|
| 编辑器根组件 | KoruGraphEditor | `<koru-graph-editor />` |
| 预览根组件 | KoruPreview | `<koru-preview />` |
| Stencil 面板 | KoruStencil | `<koru-stencil />` |
| 工具栏 | KoruToolbar | `<koru-toolbar />` |
| 小地图 | KoruMinimap | `<koru-minimap />` |
| 右键菜单 | KoruContextMenu | `<koru-context-menu />` |
| 属性面板 | KoruPropertyPanel | `<koru-property-panel />` |
| 画布属性 | KoruCanvasPropertyPanel | `<koru-canvas-property-panel />` |
| 绑定面板 | KoruBindingPanel | `<koru-binding-panel />` |
| 多状态编辑器 | KoruMultiStateEditorModal | `<koru-multi-state-editor-modal />` |
| JEXL 编辑器 | KoruJexlEditorModal | `<koru-jexl-editor-modal />` |
| 映射规则编辑 | KoruMappingModal | `<koru-mapping-modal />` |

### 6.2 Composables Hook

- `useKoruGraphEditor`：编辑器核心（★）
- `useKoruCanvasConfig`：画布配置
- `useCanvasPersistence`：数据持久化
- `useJexl`：JEXL 表达式引擎（★）
- `useBinding`：绑定管理（★）
- `useBindingRegistry`：绑定注册表（★）
- `useBindingExecutor`：绑定执行器（★）
- `useMultiState`：多状态元件（★）
- `useAnimation`：动画配置
- `useClipboard` / `useSelection` / `useZoom` / `useUndoRedo` / `useContextMenu` / `useNodeDrag`

### 6.3 CSS BEM 规范

```scss
.koru-graph-editor {
  &__stencil {}            // 左侧物料面板
  &__canvas {}             // 中间画布区
  &__property-panel {}     // 右侧属性面板
  &__toolbar {}            // 工具栏

  // 子组件样式嵌套
  .koru-stencil {}
  .koru-property-panel {}
  .koru-context-menu {}
}
```

---

## 7. 细分文档索引

| 文档 | 内容 |
|------|------|
| [docs/quick-start.md](docs/quick-start.md) | 快速开始：安装 + 接入 + 基础示例 |
| [docs/component-api.md](docs/component-api.md) | 组件 API 详细文档 |
| [docs/global-config.md](docs/global-config.md) | 全局配置（setComponentConfig） |
| [docs/binding-registry.md](docs/binding-registry.md) | 绑定注册表架构 + JEXL 模板类型详解 |
| [docs/persistence.md](docs/persistence.md) | 数据持久化（图纸 JSON 格式 + toX6JSON / fromX6JSON） |
| [docs/svg-custom-nodes.md](docs/svg-custom-nodes.md) | SVG 电气符号自定义指南 |
| [docs/x6-parent-child-migration.md](docs/x6-parent-child-migration.md) | X6 parent-child 手动传播实现（translate/resize/rotate） |
| [docs/README.md](docs/README.md) | docs 目录索引 |

---

## 8. 编码规范

1. 组件：PascalCase；模板/样式：kebab-case
2. Props：小驼峰；事件名：短横线命名（node-click）
3. 内部私有变量：下划线 `_xxx` 前缀
4. 所有对外 API、类型、方法必须书写 **JSDoc 注释**
5. 严格分层，禁止跨层反向依赖
6. `peerDependencies` 不安装，消费方必须自行安装 `@antv/x6` + `@arco-design/web-vue` + `vue`
7. 新增 SVG 符号 → 同时在 `registerSvgNodes.ts` 注册 + `defaultStencilGroups.ts` 配置 Stencil 项

---

## 9. 业务使用示例

### 9.1 编辑模式

```vue
<template>
  <koru-graph-editor
    ref="editorRef"
    v-model:graph="graphData"
    @save="onSave"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { KoruGraphEditor, setComponentConfig, type KoruGraphData } from '@mollu/koru/topology'

// 全局配置（一次设置、全组件生效）
setComponentConfig({ toolbarName: '我的拓扑编辑器' })

const graphData = ref<KoruGraphData>({ nodes: [], edges: [] })
const editorRef = ref<InstanceType<typeof KoruGraphEditor>>()

const onSave = (data: { diagramData: any; bindingRegistry: any[]; name?: string }) => {
  console.log('画布完整数据:', data.diagramData)
  console.log('绑定注册表（发给后端建立实时订阅）:', data.bindingRegistry)
  console.log('图纸命名:', data.name)
}
</script>
```

### 9.2 预览模式（含实时绑定）

> **重要**：KoruPreview **没有** `tagValues` prop。实时数据源必须通过 `setBindingConfig()` 全局配置。

```vue
<template>
  <koru-preview
    ref="previewRef"
    v-model:graph="graphData"
    :show-test-tools="true"
    @cell-event="onCellEvent"
    @action-triggered="onActionTriggered"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { KoruPreview, setBindingConfig } from '@mollu/koru/topology'

const graphData = ref<any>({ nodes: [], edges: [] })
const previewRef = ref<InstanceType<typeof KoruPreview>>()

onMounted(() => {
  // 通过全局配置对接实时数据源
  setBindingConfig({
    values: {},
    fetchData: async () => {
      // 返回 { 'cellId:device:dataPoint': value, ... } 格式
      return { 'node-1:breaker:switch_status': 2, 'node-2:ct:ia': 31.5 }
    },
    pollInterval: 2000,
    setValue: () => {},
    tick: () => {},
    runTest: () => [],
  })
})
</script>
```

### 9.3 全局注册

```ts
import { createApp } from 'vue'
import { KoruTopologyPlugin } from '@mollu/koru/topology'
import '@arco-design/web-vue/dist/arco.css'       // Arco Design 样式
import '@mollu/koru/style/koru.css'                 // Koru 全局样式（reset/variables/global/anim）
import App from './App.vue'

const app = createApp(App)
app.use(KoruTopologyPlugin)  // 自动注册所有组件 + 基础形状 + Arco 图标 + 注入样式
app.mount('#app')
```

### 9.4 注册自定义 SVG 符号

SVG 注册需要先拿到 X6 Graph 实例，然后批量注册。详见 [svg-custom-nodes.md](./svg-custom-nodes.md)。

```ts
import { ref, onMounted } from 'vue'
import { registerSvgNode, mountSvgDefs, createSvgPreviewNode, useCanvasStore } from '@mollu/koru/topology'
import type { CustomShapeItem } from '@mollu/koru/topology'

// 1. 加载 SVG 文件（Vite glob）
const svgModules = import.meta.glob('@/assets/svg/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

// 2. 构建 CustomShapeItem 列表
const customShapes: CustomShapeItem[] = Object.entries(svgModules).map(([path, svg]) => ({
  label: path.match(/\/([^/]+)\.svg$/)?.[1] ?? path,
  svg: svg as string,
}))

// 3. 静态全局注册（无 graph 也能调）
customShapes.forEach((item, index) => registerSvgNode(item, index))

// 4. 等 Graph 就绪后挂 defs + 填 Stencil
onMounted(() => {
  const tryMount = setInterval(() => {
    const graph = useCanvasStore().x6GraphRef.value
    if (graph) {
      const allDefs = customShapes.map(s => s.defs).filter(Boolean).join('\n')
      if (allDefs) mountSvgDefs(graph, allDefs)
      // 加载到 Stencil 的 electrical 分组
      const previewNodes = customShapes.map(item => createSvgPreviewNode(graph, item))
      useCanvasStore().loadGroupNodesRef.value?.('electrical', previewNodes)
      clearInterval(tryMount)
    }
  }, 50)
})
```

---

## 10. 后续演进方向

- [x] plugins/flow 真实能力（6 个流程节点注册 + Stencil 分组追加，autoLayout/swimlane 待实现）
- [ ] plugins/whiteboard 真实能力填充（当前为插件壳）
- [ ] core-kernel/renderer 抽象层落地（从 X6 解耦，支持 Canvas/WebGL）
- [ ] 单元测试 + Vitest
- [x] Vitepress 官方文档站（docs-portal 已建完，30 篇文档，双轨架构）
- [ ] CI/CD + 版本发布自动化
- [ ] 画布数据格式 v2（当前为兼容 X6 JSON 的扁平格式）
- [ ] 多画布并行（一个页面多个 KoruGraphEditor 实例）

---

> 本文档基于真实代码实现编写，如有代码变更请同步更新。
