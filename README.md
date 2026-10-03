# @mollu/koru

基于 Vue 3 + @antv/x6 的可视化拓扑图组件库。提供编辑器、预览器、绑定系统、多状态等完整能力，支持电力监控系统、流程图、关系图等场景。

## 特性

- **编辑/预览双模式**：`KoruGraphEditor`（全功能编辑）/ `KoruPreview`（只读查看，实时绑定）
- **绑定系统**：JEXL 表达式驱动测点数据 → 图元属性（颜色/文本/动画/多状态切换）
- **SVG 电气符号**：内置 20+ 电力设备 SVG 节点，支持消费方注册自定义符号
- **自定义模块注册**：`registerNodeModule` / `registerEdgeModule` 一次性注册完整节点/连线模块
- **全局配置**：`setMultiStateConfig` / `setBindingConfig` / `setDeviceConfig` / `setComponentConfig`
- **持久化**：IndexedDB 自动保存 + 自定义存储适配器
- **全量 TypeScript 强类型**，ESM/CJS 双产物

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 运行框架 | Vue | ^3.4.0 |
| 语言 | TypeScript | ^5.9.3 |
| 画布内核 | @antv/x6 | ^3.1.7 |
| UI 组件库 | @arco-design/web-vue | ^2.58.0 |
| 构建 | Vite + vite-plugin-dts | — |
| 包管理 | pnpm | 11.x |

## 快速开始

### 安装

```bash
pnpm add @mollu/koru @antv/x6@^3.1.7
```

`@antv/x6` 是必须的 peer dependency，需单独安装。

### 全局注册（推荐）

```ts
// main.ts
import { createApp } from 'vue'
import { KoruTopologyPlugin } from '@mollu/koru/topology'
import '@arco-design/web-vue/dist/arco.css'
import '@mollu/koru/style/koru.css'
import App from './App.vue'

const app = createApp(App)
app.use(KoruTopologyPlugin)
app.mount('#app')
```

### 最小编辑器示例

```vue
<template>
  <div style="height: 100vh">
    <koru-graph-editor
      v-model:graph="graphData"
      mode="edit"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { setComponentConfig, type KoruGraphData } from '@mollu/koru/topology'

setComponentConfig({ toolbarName: '我的拓扑编辑器' })

const graphData = ref<KoruGraphData>({ nodes: [], edges: [] })

function handleSave(data: { diagramData: any; bindingRegistry: any[] }) {
  console.log('画布:', data.diagramData)
  console.log('绑定注册表:', data.bindingRegistry)
}
</script>
```

## 文档

完整文档在 [docs/](./docs/) 目录：

| 文档 | 说明 |
|------|------|
| [docs/README.md](./docs/README.md) | **★ 文档索引** — 从这里开始 |
| [docs/quick-start.md](./docs/quick-start.md) | 快速上手 |
| [docs/component-api.md](./docs/component-api.md) | 组件 API 参考 |
| [docs/global-config.md](./docs/global-config.md) | 全局配置指南 |
| [docs/module-registration.md](./docs/module-registration.md) | 自定义模块注册 |
| [docs/svg-custom-nodes.md](./docs/svg-custom-nodes.md) | SVG 自定义节点 |
| [docs/binding-registry.md](./docs/binding-registry.md) | 绑定注册表 |
| [docs/persistence.md](./docs/persistence.md) | 持久化与存储 |
| [docs/Mollu-Koru 架构说明文档.md](./docs/Mollu-Koru%20架构说明文档.md) | 整体架构设计 |

## 开发

```bash
# 本地开发（监听模式）
pnpm install
pnpm dev

# 同时启动 demo
pnpm dev:demo

# 生产构建
pnpm build

# 类型检查
pnpm type-check
```

## 构建产物

```
dist/
├── index.es.js              # 根入口 ESM
├── index.cjs                # 根入口 CJS
├── index.d.ts               # 根入口类型
├── topology/                # @mollu/koru/topology
├── plugins/flow/            # @mollu/koru/plugins/flow
└── style/
    └── koru.css             # 全局样式
```

## 包入口

| 路径 | 说明 |
|------|------|
| `@mollu/koru` | 根入口：核心内核类型 + 几何工具 |
| `@mollu/koru/topology` | 主模块：所有组件 + 配置 + Composables |
| `@mollu/koru/plugins/flow` | 流程图插件（可选） |
| `@mollu/koru/plugins/whiteboard` | 白板插件（可选） |
| `@mollu/koru/style/koru.css` | 全局样式 |

## License

MIT
