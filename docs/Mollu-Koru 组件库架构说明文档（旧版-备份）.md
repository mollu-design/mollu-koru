# Mollu\-Koru 组件库架构说明文档（最终完整版）

## 1\. 整体概述

### 1\.1 产品定位

**Koru** 是 **Mollu** 母品牌旗下的可视化图形画布子组件库，专注流程图、拓扑图、关系图、白板等画布类能力。

核心架构准则：

- **对外唯一包名：@mollu/koru**，不拆分多个独立 NPM 包

- 拓扑、流程、白板等能力，以 **子模块 / 内置插件** 形式扩展

- 核心画布统一支持 **编辑模式 / 预览只读模式** 双模式

- 底层内核统一复用，上层业务模块解耦分层

- 全量 TypeScript 强类型，完整 ESM/CJS 双产物

### 1\.2 技术栈

- 运行框架：Vue 3\.4\+

- 语言：TypeScript

- 构建：Vite Library Mode

- 样式：SCSS \+ BEM 规范

### 1\.3 能力范围

- 画布基础：平移、缩放、框选、撤销/重做、复制粘贴

- 节点能力：拖拽、选中、自定义渲染、连接桩

- 连线能力：自动连边、hover、创建/删除连线

- 辅助组件：工具栏、小地图、右键菜单、属性面板

- 双模式：编辑模式（全功能）、预览模式（只读查看）

---

## 2\. 包工程规范

### 2\.1 NPM 包信息

- 对外包名：`@mollu/koru`

- 模块入口：支持根入口 \+ 子模块精准导入

- 产物格式：ESM / CJS / 完整 DTS 类型

### 2\.2 完整 package\.json 核心配置

```json
{
  "name": "@mollu/koru",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.es.js",
      "require": "./dist/index.cjs"
    },
    "./topology": {
      "types": "./dist/topology/index.d.ts",
      "import": "./dist/topology/index.es.js",
      "require": "./dist/topology/index.cjs"
    },
    "./plugins/flow": {
      "types": "./dist/plugins/flow/index.d.ts",
      "import": "./dist/plugins/flow/index.es.js"
    }
  },
  "files": ["dist"],
  "peerDependencies": {
    "vue": "^3.4.0"
  }
}
```

### 2\.3 构建产物 dist 目录

```Plain Text
dist/
├── index.es.js
├── index.cjs
├── index.d.ts
├── topology/
│   ├── index.es.js
│   ├── index.cjs
│   └── index.d.ts
├── plugins/
│   └── flow/
└── style/
    ├── koru.css
    └── topology.css
```

### 2\.4 样式策略

- 支持 **CSS\-in\-JS** 自动注入，零引入成本

- 支持手动按需引入独立样式文件

- 所有样式遵循统一 BEM 命名，无全局污染

---

## 3\. 源码目录分层架构（最终定稿）

严格分层：**底层内核 → 业务模块 → 插件扩展**，层级单向依赖，杜绝循环依赖。

```Plain Text
src/
├── index.ts                     # 包根入口
├── core-kernel/                 # 底层公共内核（纯TS、无Vue依赖、全局复用）
│   ├── renderer/                # 渲染抽象层
│   ├── math/                    # 坐标/矩阵/向量几何计算
│   ├── event-bus.ts             # 全局事件总线
│   └── types.ts                 # 内核基础通用类型
├── topology/                    # 拓扑画布核心业务模块（Vue依赖）
│   ├── index.ts                 # @mollu/koru/topology 子模块入口
│   ├── plugin.ts                # Vue全局注册插件
│   ├── components/              # 所有拓扑UI组件
│   ├── core/                    # 拓扑业务逻辑、实例、模型
│   ├── types/                   # 拓扑模块专属类型
│   ├── utils/                   # 工具方法
│   └── presets/                 # 节点/连线预设物料
└── plugins/                     # 内部扩展插件（不独立对外发包）
    ├── flow/                    # 流程图插件
    └── whiteboard/              # 白板插件
```

### 3\.1 分层依赖规则

- **core\-kernel**：纯基础能力，不依赖任何上层业务、不依赖Vue

- **topology**：依赖 core\-kernel \+ Vue，独立业务闭环

- **plugins**：仅依赖 core\-kernel，禁止依赖 topology 业务代码

---

## 4\. 全局统一命名规范（最终定稿）

解决长单词冗余、命名冲突、品牌归属、多画布扩展问题，全套最优收口方案。

### 4\.1 Vue 组件规范

根组件区分领域、子组件全部精简无冗余

| 组件用途         | 组件名\(PascalCase\) | 模板标签\(kebab\-case\)     |
| ---------------- | -------------------- | --------------------------- |
| 画布根组件       | KoruCanvas           | \<koru\-canvas /\>          |
| 工具栏           | KoruToolbar          | \<koru\-toolbar /\>         |
| 小地图           | KoruMinimap          | \<koru\-minimap /\>         |
| 右键菜单         | KoruContextMenu      | \<koru\-context\-menu /\>   |
| 属性面板         | KoruPropertyPanel    | \<koru\-property\-panel /\> |
| 节点渲染器       | KoruNodeRenderer     | \<koru\-node\-renderer /\>  |
| 连线渲染器       | KoruEdgeRenderer     | \<koru\-edge\-renderer /\>  |
| 节点拖拽幽灵预览 | KoruNodeGhost        | \<koru\-node\-ghost /\>     |

### 4\.2 Core 模型类

模块内作用域隔离，全部精简无冗余 topology

- KoruCanvas：画布主实例

- KoruGraph：图数据根模型

- KoruNode：节点模型

- KoruEdge：连线模型

- KoruSelection：选区管理器

- KoruLayout：布局算法基类

### 4\.3 Composables Hook

- useKoruCanvas：主Hook，画布实例入口

- useZoom：缩放平移

- useNodeDrag：节点拖拽

- useSelection：点选/框选

- useClipboard：复制剪切粘贴

- useUndoRedo：撤销重做

### 4\.4 TS 类型定义

- KoruCanvasOptions：画布配置

- KoruGraphData：图结构化数据（对外v\-model）

- KoruNodeData：节点数据

- KoruEdgeData：连线数据

- KoruPortData：连接桩数据

- KoruCanvasInstance：画布实例类型

- KoruNodeEvent / KoruEdgeEvent：事件类型

### 4\.5 枚举与常量

- KoruEvent：全局画布事件枚举

- KORU_DEFAULT_OPTIONS：画布默认配置

### 4\.6 CSS BEM 规范

根容器统一，子组件简洁命名，带模式状态修饰符

```scss
.koru-canvas {
  &__viewport {
  }
  &__background {
  }
  &__node {
  }
  &__node--selected {
  }
  &__node--dragging {
  }
  &__edge {
  }
  &__edge--hover {
  }
  &__port {
  }
  &__selection-box {
  }

  // 模式状态修饰符
  &--mode-edit {
  }
  &--mode-preview {
  }

  // 子组件样式
  .koru-toolbar {
  }
  .koru-minimap {
  }
  .koru-context-menu {
  }
  .koru-property-panel {
  }
}
```

---

## 5\. 核心能力：编辑 / 预览双模式

### 5\.1 设计核心原则

- **单组件双模式**：复用 KoruCanvas，不拆分编辑/预览组件

- 同一套 **KoruGraphData** 数据双向通用，无需转换

- 预览模式强制禁用所有编辑能力，仅保留查看交互

- 子组件自动感知模式，自动禁用/隐藏

### 5\.2 模式类型定义

```ts
export type KoruCanvasMode = 'edit' | 'preview'

export interface KoruCanvasOptions {
  mode: KoruCanvasMode
  grid: boolean
  zoom: { min: number; max: number }

  // 编辑模式细粒度权限
  allowDragNode: boolean
  allowCreateEdge: boolean
  allowDelete: boolean
  allowSelect: boolean
}
```

### 5\.3 模式优先级

1. 组件 `mode`独立 Prop（最高优先级）

2. options\.mode 配置

3. 默认值：`edit`

### 5\.4 双模式能力差异

| 能力                | 编辑模式 edit | 预览模式 preview |
| ------------------- | ------------- | ---------------- |
| 平移/缩放           | ✅ 支持       | ✅ 支持          |
| 节点拖拽/增删       | ✅ 支持       | ❌ 禁用          |
| 连线创建/删除       | ✅ 支持       | ❌ 禁用          |
| 右键菜单/工具栏操作 | ✅ 支持       | ❌ 禁用          |
| 节点/边点击、Hover  | ✅ 支持       | ✅ 支持          |

### 5\.5 实例模式 API

```ts
interface KoruCanvasInstance {
  getMode(): KoruCanvasMode
  setMode(mode: KoruCanvasMode): void
  isEditMode(): boolean
  isPreviewMode(): boolean
}
```

### 5\.6 子组件模式适配规则

- **KoruToolbar**：预览模式全部禁用，支持`hideInPreview` 整栏隐藏

- **KoruContextMenu**：预览模式完全不弹出

- **KoruPropertyPanel**：预览模式只读展示，禁止编辑

---

## 6\. 完整实例 API 契约

```ts
interface KoruCanvasInstance {
  // 视口控制
  zoomIn(): void
  zoomOut(): void
  resetView(): void
  fitView(): void
  setZoom(scale: number): void

  // 图数据操作
  addNode(node: Partial<KoruNodeData>): KoruNode
  removeNode(nodeId: string): void
  addEdge(edge: Partial<KoruEdgeData>): KoruEdge
  removeEdge(edgeId: string): void

  // 选区
  selectNode(nodeId: string): void
  selectAll(): void
  clearSelection(): void
  readonly selection: string[]

  // 数据读写
  getGraphData(): KoruGraphData
  setGraphData(data: KoruGraphData): void
  exportJSON(): string

  // 模式管理
  getMode(): KoruCanvasMode
  setMode(mode: KoruCanvasMode): void
  isEditMode(): boolean
  isPreviewMode(): boolean

  // 事件订阅
  on(event: string, handler: (...args: any[]) => void): void
  off(event: string, handler: (...args: any[]) => void): void
}
```

---

## 7\. 插件开发规范

- 所有扩展能力（流程、白板）统一放置 `src/plugins`

- 插件不独立发包，仅作为 `@mollu/koru` 子模块导出

- 插件仅依赖 `core-kernel`，禁止依赖 topology 业务层

- 插件必须独立提供 index\.ts、类型、组件、install 注册方法

- 插件必须适配画布 **编辑/预览** 双模式状态

---

## 8\. 编码规范（团队强制约束）

1. 组件：PascalCase；模板/样式：kebab\-case

2. Props：小驼峰；事件名：短横线命名（node\-click）

3. 内部私有变量：下划线 `_xxx` 前缀

4. 所有对外API、类型、方法必须书写 **JSDoc 注释**

5. 组件 Props/Emits 统一抽离独立 `*.types.ts`，禁止大量内联定义

6. 严格分层，禁止跨层反向依赖

---

## 9\. 业务使用示例

### 9\.1 编辑模式

```vue
<template>
  <koru-canvas v-model:graph="graph" mode="edit" ref="canvasRef">
    <koru-toolbar />
    <koru-minimap />
    <koru-property-panel />
  </koru-canvas>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { KoruCanvas, KoruToolbar, useKoruCanvas } from '@mollu/koru/topology'
import type { KoruGraphData } from '@mollu/koru/topology'

const graph = ref<KoruGraphData>({ nodes: [], edges: [] })
const canvasRef = ref()
</script>
```

### 9\.2 预览模式

```vue
<template>
  <koru-canvas v-model:graph="graph" mode="preview" />
</template>
```

### 9\.3 全局注册

```ts
import { createApp } from 'vue'
import { KoruTopologyPlugin } from '@mollu/koru/topology'

const app = createApp()
app.use(KoruTopologyPlugin)
```

---

## 10\. 非本架构覆盖范围（后续工程迭代）

以下不属于架构设计范畴，为后续工程落地项：

- 单元测试、测试用例

- Vitepress 官方文档站

- Demo 示例项目

- CI/CD、版本发布、自动化脚本

- 底层渲染引擎具体实现（SVG/Canvas/WebGL）

---

## 11\. 最终架构总结

本文档为 **Mollu\-Koru** 可视化画布组件库唯一最终架构标准，统一收口：

- ✅ 品牌层级：Mollu 母品牌 \+ Koru 子产品线

- ✅ 包架构：单对外包、子模块插件化扩展

- ✅ 命名体系：简洁无冗余、无冲突、可多画布扩展

- ✅ 分层架构：内核解耦、单向依赖

- ✅ 双模式能力：编辑/预览全覆盖，数据统一

- ✅ 完整工程规范、类型、样式、API、编码约束

> （注：部分内容可能由 AI 生成）
