# 自定义 SVG 节点注册指南

Koru 支持将任意 SVG 文件注册为可拖拽、可缩放的自定义节点，适用于电气符号、流程图图标、品牌图标等场景。

---

## 内置基础形状

Koru 预置了以下基础形状，开箱即用，无需注册：

| shape 名称 | 说明 | 默认尺寸 |
|------------|------|---------|
| `custom-rect` | 矩形 | 66×36 |
| `custom-polygon` | 多边形 | 66×36 |
| `custom-circle` | 圆形 | 45×45 |
| `custom-image` | 图片节点 | 52×52 |
| `custom-split` | 左右分栏 | 160×40 |
| `custom-text` | 文本节点 | 100×30 |
| `custom-button` | 按钮节点 | 80×32 |
| `shape-line` | 线条节点 | 55×2 |

这些形状通过 `registerBasicShapes()` 注册，通常由 KoruGraphEditor 内部自动调用。

### 创建基础节点

```ts
import { createDefaultNode, createDefaultCircleNode, createDefaultEdge, uid } from '@mollu/koru/topology'

// 创建矩形节点
const node = createDefaultNode({
  x: 100,
  y: 200,
  label: '开始',
})

// 创建圆形节点
const circle = createDefaultCircleNode({
  x: 300,
  y: 150,
  label: '审批',
})

// 创建连线
const edge = createDefaultEdge({
  source: node.id,
  target: circle.id,
  label: '通过',
})
```

---

## 注册自定义 SVG 节点

### 适用场景

当内置形状无法满足需求时（如电力系统的电气符号、行业特定图标等），可以将 SVG 文件注册为自定义节点。

### 核心流程

```
SVG 文件 → CustomShapeItem[] → registerSvgNode(item, index)  ← 静态全局注册（无 graph 也能调）
                                    ↓
                              shapeName = "svg-node-{index}"
                                    ↓
                              mountSvgDefs(graph, defs)  ← 实例级挂载（需要 graph）
                                    ↓
                              注入 Stencil 预览
```

### 📦 获取 SVG 资源

国网标准电气符号已开源，放在 `mollu-design/assets/` 目录下：

```
mollu-design/assets/
├── koru-electrical-single/    ← 单状态符号（断路器、变压器、互感器等 29 个）
└── koru-electrical-switch/    ← 多状态开关（闭合/分闸各一个，12 个）
```

获取方式：
- **Git sparse-checkout**：`git sparse-checkout set assets/koru-electrical-single`
- **GitHub Download ZIP**
- 直接复制到项目的 `src/assets/koru/`

> 资源与组件库解耦，用户可按需下载、自行替换、自定义扩展。详见 [mollu-design/assets/README.md](https://github.com/mollu-design/mollu-design/tree/main/assets)。

### 步骤一：准备 SVG 文件

SVG 文件应满足以下条件：
- 使用标准 SVG 格式（`.svg` 扩展名）
- 建议设置 `viewBox` 属性
- 可包含 `<defs>`（如渐变、图案、滤镜）
- 支持文本、路径、矩形、圆形等常用元素

### 步骤二：加载 SVG 文件

Koru 注册函数需要的是 **SVG 原始字符串**（`<svg>...</svg>`），不是文件 URL，也不是模块对象。加载方式有两种：

#### 方式 A：import.meta.glob（批量，推荐）

Vite 的编译时 glob，一次性加载一个目录下所有 SVG 文件：

```ts
const svgModules = import.meta.glob('@/assets/svg/**/*.svg', {
  query: '?raw',      // ① 告诉 Vite 返回文件原始文本，不是 URL
  import: 'default',   // ② 把模块对象解包成纯字符串（关键！）
  eager: true,         // ③ import.meta.glob 默认返回懒加载函数，加 eager 立即执行
}) as Record<string, string>
```

**三个选项缺一不可，少一个就踩坑：**

| 选项 | 不写会怎样 | 结果 |
|------|-----------|------|
| `query: '?raw'` | Vite 把 SVG 当静态资源处理，返回 base64 URL | `registerSvgNode` 里 `DOMParser.parseFromString` 拿到 URL 字符串 → 解析失败 |
| `import: 'default'` | `eager: true` 时每个值是 `{ default: '<svg>...' }` 模块对象，不是字符串 | `parseFromString` 拿到对象 → `TypeError: Cannot convert object to primitive value` |
| `eager: true` | 返回 `() => Promise<string>` 懒加载函数，不是字符串 | `parseFromString` 拿到函数 → 解析失败 |

**返回值结构**：

```
svgModules = {
  '/src/assets/svg/断路器.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">...</svg>',
  '/src/assets/svg/变压器.svg': '<svg ...>...</svg>',
  ...
}
// key = Vite 虚拟模块路径，value = SVG 原始字符串
```

拿到这个对象后直接传给 `registerSvgGlob(svgModules)` 即可，**不需要手动遍历、不需要自己提取 label**——`registerSvgGlob` 内部自动处理。

#### 方式 B：静态 import（单个或少量）

```ts
import breakerSvg from '@/assets/svg/断路器.svg?raw'
import transformerSvg from '@/assets/svg/变压器.svg?raw'

// 结果：breakerSvg = '<svg xmlns="..." viewBox="...">...</svg>'
```

适用于 SVG 文件少、或只需要特定几个的场景。注意：
- **必须加 `?raw`**，否则 Vite 返回的是 URL
- 不能在 `vite.config.ts` 里配置 `assetsInclude`（会覆盖 `?raw` 行为）
- 中文文件名 Vite 默认支持，但生产环境推荐英文文件名

#### 方式 C：运行时 fetch（不推荐）

```ts
const resp = await fetch('/assets/svg/断路器.svg')
const svgText = await resp.text()
```

能工作但不推荐——绕过了 Vite 的编译时优化，无法做 tree-shaking、无法处理别名路径、有网络请求开销。只在**运行时动态加载**（比如后端返回 SVG 地址）的场景下用。

### 步骤三：构建 CustomShapeItem 列表

```ts
import type { CustomShapeItem } from '@mollu/koru/topology'

// 批量方式
const svgMap: Record<string, string> = {}
Object.entries(svgModules).forEach(([path, content]) => {
  const match = path.match(/\/([^/]+)\.svg$/)
  if (match) {
    svgMap[match[1]] = content as string
  }
})

const customShapes: CustomShapeItem[] = Object.entries(svgMap).map(([fileName, svg]) => ({
  label: fileName,   // 显示名称（如"变压器"、"断路器"）
  svg: svg,          // SVG 原始字符串
}))

// 单个方式
const customShapes: CustomShapeItem[] = [
  { label: '变压器', svg: transformerSvg },
  { label: '断路器', svg: breakerSvg },
]
```

### 步骤四：注册到 X6 Graph

**最简单：一行代码**（`registerSvgGlob` 自动处理 glob + 遍历 + registerSvgNode + setComponentConfig）：

```ts
import { registerSvgGlob, mountSvgDefs, getRegisteredDefs, useCanvasStore } from '@mollu/koru/topology'

// import.meta.glob 必须写齐三个选项（详见步骤二）
const modules = import.meta.glob('src/assets/koru/**/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

// 一行搞定批量注册（内部自动提取 label + registerSvgNode + setComponentConfig）
registerSvgGlob(modules)

onMounted(() => {
  // 等 graph 就绪后挂 defs（getRegisteredDefs 自动返回所有已注册 shape 的 defs）
  const tryMount = setInterval(() => {
    const graph = useCanvasStore().x6GraphRef.value
    if (graph) {
      const defs = getRegisteredDefs()
      if (defs) mountSvgDefs(graph, defs)
      clearInterval(tryMount)
    }
  }, 50)
})
```

**需要自定义加载逻辑**（条件过滤、分组注册等）时用旧写法（完全兼容，不废弃）：

```ts
// 旧写法（手动 forEach + registerSvgNode + setComponentConfig）
customShapes.forEach((item, index) => registerSvgNode(item, index))
setComponentConfig({ customShapes })
```

> **为什么分两层？** `Graph.registerNode` 是 X6 静态全局方法，跟 graph 实例无关，可以在 `main.ts` 或 bootstrap 文件里提前注册。只有 `mountSvgDefs` 需要 graph 实例（每个 graph 各挂一次）。这样 graph ready 之前就能创建 SVG 节点，多 graph 实例也只需挂 defs。

注册完成后，每个 SVG 节点会自动获得：
- shape 名称：`svg-node-0`、`svg-node-1`、`svg-node-2`、...
- 四方向连接桩（top/right/bottom/left）
- 自适应的 viewBox 尺寸
- 与 SVG 原始尺寸等比缩放的 hitarea

### 步骤五：加载到 Stencil 面板

注册完成后，使用 `createSvgPreviewNode()` 创建预览节点并加载到 Stencil 分组：

```ts
import { createSvgPreviewNode, useCanvasStore } from '@mollu/koru/topology'

const store = useCanvasStore()
const graph = store.x6GraphRef.value!

// 为每个 SVG 创建 Stencil 预览节点
const svgPreviewNodes = customShapes.map((item) => createSvgPreviewNode(graph, item))

// 加载到指定分组（如"电气符号"分组）
store.loadGroupNodesRef.value?.('electrical', svgPreviewNodes)
```

### 完整示例

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  setComponentConfig,
  registerSvgNode,
  mountSvgDefs,
  createSvgPreviewNode,
  useCanvasStore,
} from '@mollu/koru/topology'
import type { CustomShapeItem, KoruStencilGroup } from '@mollu/koru/topology'

// 1. 配置 Stencil 分组
const stencilGroups: KoruStencilGroup[] = [
  {
    name: 'basic',
    label: '基础图形',
    layoutOptions: { columns: 3, columnWidth: 60, rowHeight: 50 },
    items: [
      { shape: 'custom-rect', label: '长方形', width: 46, height: 30 },
      { shape: 'custom-circle', label: '圆形', width: 40, height: 40 },
    ],
  },
  {
    name: 'electrical',
    label: '电气符号',
    graphHeight: 335,
    layoutOptions: { columns: 4, columnWidth: 45, rowHeight: 45 },
    items: [], // SVG 节点动态加载
  },
]

setComponentConfig({
  stencilGroups,
  customShapes: [],
})

// 2. 加载 SVG 文件
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

const customShapes = ref<CustomShapeItem[]>(
  Object.entries(svgMap).map(([fileName, svg]) => ({
    label: fileName,
    svg,
  })),
)

// 3. 静态注册（无 graph 也能调，提前到模块顶层）
customShapes.value.forEach((item, index) => registerSvgNode(item, index))

// 4. 等 Graph 就绪后挂 defs + 填 Stencil
onMounted(() => {
  const tryMount = setInterval(() => {
    const graph = useCanvasStore().x6GraphRef.value
    if (graph) {
      // 挂载 SVG defs（实例级，每个 graph 各挂一次）
      const allDefs = customShapes.value.map(s => s.defs).filter(Boolean).join('\n')
      if (allDefs) mountSvgDefs(graph, allDefs)

      // 同步到全局配置（供 Stencil 查找落点尺寸）
      setComponentConfig({ customShapes: customShapes.value })

      // 加载预览节点到 Stencil
      const svgNodes = customShapes.value.map((item) =>
        createSvgPreviewNode(graph, item),
      )
      useCanvasStore().loadGroupNodesRef.value?.('electrical', svgNodes)

      clearInterval(tryMount)
    }
  }, 50)
})
</script>
```

---

## 底层 API 参考

### sanitizeSvgForX6(rawSvg: string)

将 SVG 字符串清洗为 X6 可用的 JSON markup。

**返回值**：
```ts
{
  markup: any[]           // X6 JSON markup 树
  viewBox: string          // SVG viewBox 字符串
  defs: string            // defs 元素 HTML
  vbWidth: number         // viewBox 宽度
  vbHeight: number        // viewBox 高度
  vbX: number             // viewBox X 偏移
  vbY: number             // viewBox Y 偏移
  hasFill: boolean        // 是否包含填充元素
  hasStroke: boolean      // 是否包含描边元素
  strokeWidth: number     // 最大描边宽度
}
```

内部会自动处理：
- `fill` / `stroke` 属性继承链（设为 `inherit` 跟随 `svg-body`）
- URL 引用修复（`url(#id)` → 动态 ID）
- `defs` 提取
- 文本元素特殊处理（清除继承描边）
- 元素标签过滤（移除 `title`、`desc`、`metadata`）

### registerSvgGlob(modules, options?)

**一行搞定批量注册**（最常用）。接受 `import.meta.glob` 的结果，内部自动：从文件名提取 label → `registerSvgNode` 遍历注册 → `setComponentConfig({ customShapes })`。

```ts
import { registerSvgGlob } from '@mollu/koru/topology'

const modules = import.meta.glob('src/assets/koru/**/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
registerSvgGlob(modules)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `modules` | `Record<string, string>` | `import.meta.glob` 结果，key=路径, value=SVG 字符串 |
| `options.extractLabel` | `(filePath) => string` | 自定义 label 提取函数（可选，默认从文件名） |
| `options.setGlobalConfig` | `boolean` | 是否自动调 `setComponentConfig`（默认 `true`） |

返回：`CustomShapeItem[]`（带 shapeName / defs / vbWidth 等清洗后数据）

### getRegisteredDefs(): string

返回**所有已注册 SVG shape 的 defs 拼接**。不管是 `registerSvgGlob` 还是手动 `forEach registerSvgNode`，都会被自动收集。业务侧 `mountAllDefs(graph)` 直接用：

```ts
import { getRegisteredDefs, mountSvgDefs } from '@mollu/koru/topology'

export const mountAllDefs = (graph: any) => {
  const defs = getRegisteredDefs()
  if (defs && graph) mountSvgDefs(graph, defs)
}
```

### getRegisteredShapes(): CustomShapeItem[]

返回已注册的所有 `CustomShapeItem[]`（带 shapeName / defs / vbWidth 等清洗后数据）。供 Stencil 加载、调试等场景。

### registerSvgNode(item: CustomShapeItem, index: number)

注册单个 SVG 为 X6 自定义节点，shape 名称为 `svg-node-{index}`。**X6 静态全局方法**，不依赖 graph 实例，可在模块顶层调。

### mountSvgDefs(graph: Graph, defStr: string)

将 SVG defs 挂载到画布顶层 SVG（用于渐变、图案、滤镜等引用）。需要 graph 实例，每个 graph 各挂一次。

### createSvgPreviewNode(graph: Graph, item: CustomShapeItem)

为 Stencil 创建等比缩放的预览节点（限制在 30×30 内，保持原始比例）。

### createLocalImagePreviewNodes(graph: Graph, images: Array<{label: string, dataUrl: string}>)

为 Stencil 创建本地图片预览节点。

---

## 高级用法

### 节点属性动态调整

SVG 节点注册后，可以通过 Stencil 配置覆盖属性：

```ts
const stencilGroups: KoruStencilGroup[] = [
  {
    name: 'electrical',
    label: '电气符号',
    items: [
      {
        // 引用已注册的 SVG 节点
        shape: 'svg-node-0',   // 变压器
        label: '主变压器',
        width: 46,
        height: 46,
        // 覆盖默认 attrs
        attrs: {
          'svg-body': {
            color: '#165DFF',  // 改变 SVG 颜色
            stroke: '#165DFF',
            fill: '#165DFF',
          },
        },
        data: { type: 'transformer' },
      },
    ],
  },
]
```

### 多色 SVG 支持

如果 SVG 包含多色元素（不同的 `fill` 或 `stroke`），注册逻辑会：
- 保留部分元素的原始 `fill`/`stroke`（如 `fill="none"` 的轮廓元素）
- 将可继承的元素设为 `inherit`，跟随 `svg-body` 的 `color` 属性
- 这样可以通过修改 `svg-body` 的 `color` 来整体改变 SVG 颜色

### 运行时动态注册

SVG 节点可以在运行时动态注册：

```ts
const store = useCanvasStore()

function addNewSvg(item: CustomShapeItem) {
  const graph = store.x6GraphRef.value
  if (!graph) return

  const index = store.componentConfig.customShapes.length
  registerSvgNode(item, index)
  store.componentConfig.customShapes.push(item)
}
```

### 持久化注意

SVG 节点注册后创建的实例会被 X6 正常序列化。持久化时会保存：
- `shape: 'svg-node-0'`（shape 标识）
- 节点位置、尺寸、attrs、data 等所有属性

**恢复时需要重新注册相同的 SVG 节点**（确保 shape 名称和顺序一致）。

#### Shape 注册保护机制

如果恢复时某个 shape 未注册（比如 SVG 符号文件缺失、注册时机不对），**组件不会崩溃**——`loadDiagram()` 内部会自动执行注册表预检 + shape 降级：

| 检测 | 处理 |
|------|------|
| `Node.registry.get(shape)` 找不到 | 降级为 `rect`（浅蓝底 + 蓝框 + 圆角 4px） |
| `Edge.registry.get(shape)` 找不到 | 降级为 X6 默认 `edge` |
| cell 完全缺 `shape` 字段 | 丢弃（打印 warn） |

降级时会彻底清除原始自定义 shape 特有的 `attrs` / `labels` / `label` / `lineText`，只保留 X6 rect/edge 能安全识别的字段，杜绝 `[object Object]` 等渲染异常。

控制台会打印清晰的 warn：

```
[Koru][loadDiagram] ⚠️ 有 3 个 cell 的 shape 未注册，已降级为基础形状:
  ['svg-node-0', 'svg-node-1', 'svg-node-2']
→ 请检查 koruBootstrap 的 SVG 符号是否正确注册
[{id: 'xxx', originalShape: 'svg-node-0'}, ...]
```

> **降级只发生在加载时**，不会修改原始图纸数据。修复 SVG 符号注册后重新加载即可恢复正常显示。

---

## 常见问题

### Q: SVG 节点显示为黑色方框怎么办？

可能原因：
1. SVG 没有设置 `viewBox` → 系统会使用 512×512 默认值
2. SVG 使用了不支持的标签 → 检查是否包含 `<title>`、`<desc>` 等不可见标签
3. `fill` 属性未正确处理 → 确保 SVG 的 `fill` 属性有效

### Q: SVG 节点颜色无法动态修改？

确保使用 `svg-body` 选择器修改颜色：

```ts
node.setAttrs({
  'svg-body': {
    color: '#FF0000',  // 控制整体颜色
  },
})
```

因为 SVG 元素的 `fill`/`stroke` 已经设为 `inherit`，会跟随 `svg-body` 的 `color` 属性。

### Q: 如何让 SVG 节点不显示连线桩？

在创建节点时不传 `ports` 配置即可，或者修改 ports 组的 `visibility` 属性。
