# 自定义模块注册指南

当内置形状（`custom-rect` / `custom-circle` / SVG 电气符号等）无法满足需求时，可以通过模块注册 API 一次性注册**任意完整的 X6 节点/连线模块**——自定义 markup、attrs、ports、尺寸、默认 data、交互行为等全部可控。

---

## 为什么用模块注册？

Koru 提供三种形状扩展方式，按复杂度递增：

| 方式 | 适用场景 | 注册时机 | 核心差异 |
|------|---------|---------|---------|
| `registerBasicShapes()` | Koru 内置的 7 种 basic 形状（自动调用） | 插件注册时 | 固定 Koru 预设，不可自定义 |
| `registerSvgNode()` + `mountSvgDefs()` | SVG 文件作为外观（电气符号、图标等） | `registerSvgNode` 模块顶层就能调，`mountSvgDefs` 等 graph 就绪 | **只注册 SVG 外观 + 默认 ports**，markup/attrs 由 SVG 自动解析 |
| `registerNodeModule()` / `registerEdgeModule()` | 完整模块（复杂 markup、自定义 attrs 规则、多 ports 组、交互逻辑） | 组件注册时（全局，不依赖 graph 实例） | **透传 X6 完整 NodeConfig/EdgeConfig**，自由度最高 |

核心差异：**模块注册不依赖 Graph 实例**——它直接调用 `Graph.registerNode(name, config)`，在应用启动阶段一次性注册到 X6 全局注册表，后续任何 `fromJSON` / `addNode` 遇到该 `shape` 名称时会自动实例化。

---

## API 速查

```ts
import {
  registerNodeModule,
  registerNodeModules,
  registerEdgeModule,
  registerEdgeModules,
  registerModules,
} from '@mollu/koru/topology'
import type { NodeConfig, EdgeConfig } from '@antv/x6'

// 注册单个节点模块
registerNodeModule(name: string, config: NodeConfig, overwrite?: boolean): void

// 批量注册节点模块
registerNodeModules(modules: Array<{ name: string; config: NodeConfig }>, overwrite?: boolean): void

// 注册单个连线模块
registerEdgeModule(name: string, config: EdgeConfig, overwrite?: boolean): void

// 批量注册连线模块
registerEdgeModules(modules: Array<{ name: string; config: EdgeConfig }>, overwrite?: boolean): void

// 一站式注册（节点 + 连线）
registerModules(options: {
  nodes?: Array<{ name: string; config: NodeConfig }>
  edges?: Array<{ name: string; config: EdgeConfig }>
  svgs?: Array<{ label: string; svg: string }>   // ⚠️ 仅 warn，需 graph 就绪后手动调 registerSvgNodes
  overwrite?: boolean
}): void
```

**所有函数默认 `overwrite = true`**——同名模块会覆盖之前的注册。设 `false` 则跳过已存在的。

> **注意**：NodeConfig / EdgeConfig 类型来自 `@antv/x6`（peer dependency）。若项目未引入 X6，可直接用 `as any` 绕过类型。

---

## 基础用法：注册一个自定义节点

```ts
// main.ts 或 App.vue onMounted
import { registerNodeModule } from '@mollu/koru/topology'

registerNodeModule('smart-meter', {
  // 1. 视觉结构：markup 定义 DOM 子元素树（类似 SVG markup）
  markup: [
    { tagName: 'rect', selector: 'body', attrs: { width: 60, height: 60, rx: 6 } },
    { tagName: 'rect', selector: 'display', attrs: { x: 8, y: 8, width: 44, height: 28, rx: 2 } },
    { tagName: 'text', selector: 'label', attrs: { text: '电表', fontSize: 11 } },
    { tagName: 'circle', selector: 'status', attrs: { r: 4, cx: 50, cy: 50 } },
  ],

  // 2. 默认样式（attrs 选择器对应 markup 里的 selector）
  attrs: {
    body: { fill: '#1e293b', stroke: '#0f172a', strokeWidth: 2 },
    display: { fill: '#22d3ee' },
    label: { fill: '#fff', refX: '50%', refY: '75%', textAnchor: 'middle' },
    status: { fill: '#22c55e' },
  },

  // 3. 默认尺寸 & 位置
  width: 60,
  height: 60,

  // 4. 连接桩
  ports: {
    groups: {
      top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true } } },
      bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true } } },
      left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true } } },
      right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true } } },
    },
    items: [
      { id: 'p-t', group: 'top' },
      { id: 'p-b', group: 'bottom' },
      { id: 'p-l', group: 'left' },
      { id: 'p-r', group: 'right' },
    ],
  },

  // 5. 默认 data（绑定系统、多状态等会用到）
  data: {
    deviceType: 'meter',
    deviceKey: 'M-001',
    voltageLevel: 220,
  },
})
```

注册后，这个 shape 就能在 Stencil 里配置、拖入画布、保存恢复、参与绑定系统——与内置的 `custom-rect` / `svg-node-*` 完全一致。

---

## 注册自定义连线

```ts
import { registerEdgeModule } from '@mollu/koru/topology'

registerEdgeModule('power-cable', {
  markup: [
    { tagName: 'path', selector: 'line',
      attrs: { fill: 'none', stroke: '#ff6b00', strokeWidth: 3 } },
    { tagName: 'circle', selector: 'start-arrow', attrs: { r: 4, fill: '#ff6b00' } },
    { tagName: 'circle', selector: 'end-arrow',   attrs: { r: 4, fill: '#ff6b00' } },
  ],
  // 路径走线策略
  router: { name: 'orth', args: { padding: 10 } },
  connector: { name: 'rounded', args: { radius: 8 } },
  // 连线标签
  labels: [
    { attrs: { text: 'XLPE', fontSize: 10, fill: '#666' }, position: 0.5 },
  ],
})
```

---

## 批量注册：registerModules

适合项目初始化时一次性注册所有自定义模块：

```ts
import { registerModules } from '@mollu/koru/topology'

registerModules({
  nodes: [
    { name: 'breaker-vacuum', config: { markup: [...], attrs: {...}, width: 60, height: 80 } },
    { name: 'transformer-2w', config: { markup: [...], attrs: {...}, width: 80, height: 60 } },
    { name: 'smart-meter',   config: { /* 见上文示例 */ } },
  ],
  edges: [
    { name: 'power-cable', config: { /* 见上文示例 */ } },
    { name: 'signal-line', config: { router: { name: 'orth' }, connector: { name: 'smooth' } } },
  ],
  overwrite: true,
})
```

> **关于 svgs 字段**：`registerModules` 的 `svgs` 参数会**打印 warn 提示**，不实际注册。SVG 注册是两步：`registerSvgNode(item, index)` 静态全局注册（无 graph 也能调）+ `mountSvgDefs(graph, defs)` 实例级挂载（等 graph 就绪）。正确做法是：
> 1. 在 `registerModules` 里注册 nodes/edges
> 2. 模块顶层 `customShapes.forEach((item, index) => registerSvgNode(item, index))`
> 3. 等 KoruGraphEditor ready 后调 `mountSvgDefs(graph, defs)` 挂 defs
> 
> 完整示例参见 [svg-custom-nodes.md](./svg-custom-nodes.md)

---

## 在 Stencil 中使用注册的模块

注册完成后，通过 `setComponentConfig` 或 Stencil prop 把模块加入分组：

```ts
import { setComponentConfig } from '@mollu/koru/topology'

setComponentConfig({
  stencilGroups: [
    {
      name: 'devices',
      label: '电力设备',
      layoutOptions: { columns: 4, columnWidth: 70, rowHeight: 70 },
      items: [
        { shape: 'breaker-vacuum', label: '真空断路器', width: 60, height: 80 },
        { shape: 'transformer-2w', label: '两绕组变', width: 80, height: 60 },
        { shape: 'smart-meter',   label: '智能电表', width: 60, height: 60 },
      ],
    },
  ],
})
```

也可以通过 `graph.addNode({ shape: 'breaker-vacuum', x, y })` 直接创建实例。

---

## 注册时机建议

**推荐在应用初始化阶段注册**——不要等 Graph 就绪。因为模块注册写的是 `Graph.registerNode()`（全局注册表），与具体 Graph 实例无关。

### Vue 3 main.ts（全局注册）

```ts
import { createApp } from 'vue'
import { KoruTopologyPlugin, registerModules } from '@mollu/koru/topology'
import App from './App.vue'

// 1. 先注册自定义模块（与 Graph 无关，随时可做）
registerModules({
  nodes: [ /* ... */ ],
  edges: [ /* ... */ ],
})

// 2. 再注册插件
const app = createApp(App)
app.use(KoruTopologyPlugin)
app.mount('#app')
```

### 局部注册（仅特定页面使用）

```ts
import { onMounted } from 'vue'
import { registerNodeModule } from '@mollu/koru/topology'

onMounted(() => {
  registerNodeModule('page-specific-node', { /* ... */ })
})
```

---

## 与 SVG 注册的对比

| 维度 | `registerSvgNode(items, index)` + `mountSvgDefs(graph, defs)` | `registerNodeModule(name, config)` |
|------|----------------------------------------------------------------|-------------------------------------|
| 输入 | SVG 原始字符串数组 | 完整 NodeConfig 对象 |
| 依赖 Graph 实例 | `registerSvgNode` ❌ 不需要 / `mountSvgDefs` ✅ 需要 | ❌ 不需要（全局注册） |
| markup/attrs | 由 SVG 自动解析 | 手动编写，完全可控 |
| ports | 默认 4 方向 | 自由定义 groups/items |
| 自定义 data | 不支持（从 Stencil items 传入） | `config.data` 里直接写 |
| 默认尺寸 | 从 SVG viewBox 推导 | `config.width / height` 指定 |
| 典型用途 | 电气符号、图标、品牌 logo | 复杂组件（断路器、变压器、仪表等有内部结构的） |

**什么时候该用哪个**：如果你的模块可以用一个 SVG 文件表示（纯视觉符号），用 `registerSvgNode` + `mountSvgDefs` 更简单；如果模块有**内部多元素结构、动态 attrs 切换、复杂 ports 布局、默认 data 注入**，用 `registerNodeModule`。

---

## 持久化兼容

`registerNodeModule` 注册的模块，保存时 X6 会输出 `shape: 'your-module-name'`，恢复时 X6 `fromJSON` 会自动根据注册表重建——**与内置形状完全一致**，无需额外处理。

> ⚠️ 恢复时**该模块必须已注册**。确保 `registerNodeModule` 在 `fromJSON` 之前执行（通常在应用启动阶段注册即可满足）。

---

## 常见问题

### Q: 注册了模块但 fromJSON 报错 "Cell with shape xxx not found"

注册时机太晚。把 `registerNodeModule` 移到 `main.ts` 或 `KoruGraphEditor` 初始化之前。

### Q: 模块属性在属性面板不可编辑

Koru 的属性面板（`KoruPropertyPanel`）内置了对 `custom-rect` / `custom-circle` 等形状的属性映射。自定义模块如需属性面板支持，需在 `nodeProps.ts` 中添加映射规则（内部机制，通常只需绑定系统即可，基础 text/fill 属性可通过绑定配置）。

### Q: 可以注册与内置形状同名的模块吗？

可以——默认 `overwrite = true` 会覆盖。如果想避免覆盖内置形状，设 `overwrite = false`。

### Q: 注册的模块可以用在多个 KoruGraphEditor 实例中吗？

可以。模块注册是 `Graph` 类的静态方法（全局注册表），所有实例共享。
