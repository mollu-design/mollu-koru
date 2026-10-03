# 画布配置

Koru 支持对画布的网格、背景、滚动、缩放、对齐等行为进行细粒度配置。画布配置在**持久化时随图纸数据一起保存**（`canvas` 字段），恢复时自动应用。

---

## 配置方式

画布配置有三种设置方式，按优先级从高到低：

```
1️⃣ 持久化恢复（最高） → 从已保存的 diagramData.canvas 自动恢复
2️⃣ 组件 options prop → <KoruGraphEditor :options="{ grid: false }" />
3️⃣ applyKoruCanvasConfig() → 运行时动态应用
4️⃣ defaultKoruCanvasConfig() → 内置默认值（最低）
```

### 方式一：通过 options prop（初始化时）

```vue
<koru-graph-editor
  v-model:graph="graphData"
  :options="{
    grid: true,
    zoom: { min: 0.25, max: 4 },
    panning: true,
    mouseWheel: true,
  }"
/>
```

### 方式二：运行时动态应用（applyKoruCanvasConfig）

```ts
import { ref } from 'vue'
import { useCanvasStore, applyKoruCanvasConfig, defaultKoruCanvasConfig } from '@mollu/koru/topology'

const store = useCanvasStore()

// 获取默认配置，修改后应用
const config = defaultKoruCanvasConfig()
config.background.color = '#f5f5f5'
config.grid.size = 30
config.grid.type = 'dot'
config.minScale = 0.25
config.maxScale = 4

applyKoruCanvasConfig(store.x6GraphRef.value!, config)
```

### 方式三：序列化到持久化数据

画布配置在保存时**自动写入** `diagramData.canvas`，恢复时自动应用——不需要消费方额外处理：

```ts
function handleSave(data: { diagramData: any; bindingRegistry: any[] }) {
  // data.diagramData 结构：
  // {
  //   cells: [...],           // 图元数据
  //   canvas: { ... },        // 画布配置（含 background/grid/mousewheel 等）
  // }
  backend.saveDiagram(data.diagramData, data.bindingRegistry)
}
```

---

## 完整配置结构

### KoruCanvasConfig

```ts
interface KoruCanvasConfig {
  /** 画布逻辑宽度（导出图片尺寸以此为准） */
  width: number
  /** 画布逻辑高度 */
  height: number
  /** 背景配置 */
  background: KoruCanvasBackground
  /** 网格配置 */
  grid: KoruCanvasGrid
  /** 滚轮缩放 */
  mousewheel?: KoruCanvasMousewheel
  /** 最小缩放（默认 0.5） */
  minScale?: number
  /** 最大缩放（默认 3） */
  maxScale?: number
  /** 画布平移拖拽 */
  panning?: KoruCanvasPanning
  /** 对齐辅助线（仅编辑模式生效） */
  snapline?: KoruCanvasSnapline
  /** 限制节点移出画布（仅编辑模式生效） */
  translating?: KoruCanvasTranslating
  /** 无限滚动画布 */
  scroller?: KoruCanvasScroller
}
```

### 子类型

```ts
// 背景
interface KoruCanvasBackground {
  color: string       // 背景色，默认 '#ffffff'
  image: string       // 背景图片 dataUrl 或 URL，默认 ''
}

// 网格
interface KoruCanvasGrid {
  visible: boolean           // 是否显示，默认 true
  size: number               // 网格尺寸，默认 20
  type?: 'mesh' | 'dot'      // 网格类型：mesh(直线) / dot(点阵)，默认 mesh
  color?: string             // 网格颜色，默认 '#cccccc'
}

// 滚轮缩放
interface KoruCanvasMousewheel {
  enabled: boolean           // 是否启用，默认 true
  modifiers?: 'ctrl' | 'none'  // 修饰键：ctrl(按住 Ctrl 才缩放) / none(直接缩放)，默认 'ctrl'
}

// 平移拖拽
interface KoruCanvasPanning {
  enabled: boolean           // 是否启用，默认 true
  modifiers?: 'alt' | 'none'   // 修饰键：alt(按住 Alt 才平移) / none(直接平移)，默认 'alt'
}

// 对齐辅助线
interface KoruCanvasSnapline {
  enabled: boolean           // 是否启用，默认 true
}

// 限制节点移出
interface KoruCanvasTranslating {
  restrict: boolean          // 是否限制节点不能移出画布边界，默认 false
}

// 无限滚动
interface KoruCanvasScroller {
  enabled: boolean           // 是否启用 scroller（画布大于视口时可滚动），默认 false
}
```

### 默认值

```ts
const defaultKoruCanvasConfig = {
  width: 1200,
  height: 800,
  background: { color: '#ffffff', image: '' },
  grid: { visible: true, size: 20 },
  mousewheel: { enabled: true, modifiers: 'ctrl' },
  minScale: 0.5,
  maxScale: 3,
  panning: { enabled: true, modifiers: 'alt' },
  snapline: { enabled: true },
  translating: { restrict: false },
  scroller: { enabled: false },
}
```

---

## 典型场景示例

### 1. 隐藏网格 + 更密的点阵

```ts
const config = defaultKoruCanvasConfig()
config.grid.visible = true
config.grid.size = 10
config.grid.type = 'dot'
config.grid.color = '#e8e8e8'
applyKoruCanvasConfig(graph, config)
```

### 2. 无限滚动画布（白板式）

```ts
const config = defaultKoruCanvasConfig()
config.scroller.enabled = true
config.grid.size = 30
applyKoruCanvasConfig(graph, config)
```

### 3. 自定义背景色 + 限制节点不跑出

```ts
const config = defaultKoruCanvasConfig()
config.background.color = '#1e293b'   // 深色背景
config.grid.color = '#334155'
config.translating.restrict = true
applyKoruCanvasConfig(graph, config)
```

### 4. 滚轮无修饰键直接缩放

```ts
const config = defaultKoruCanvasConfig()
config.mousewheel.enabled = true
config.mousewheel.modifiers = 'none'
applyKoruCanvasConfig(graph, config)
```

---

## 序列化格式（KoruCanvasConfigStorage）

为保持持久化 JSON 轻量，存储格式**只存核心字段 + 异于默认值的高级项**：

```json
{
  "background": { "color": "#ffffff", "image": "" },
  "grid": { "visible": true, "size": 20 },
  "gridType": "dot",              // 仅当不同于默认 mesh 时写入
  "gridColor": "#dddddd",         // 仅当不同于默认 #cccccc 时写入
  "mousewheelModifiers": "none",  // 仅当不同于默认 ctrl 时写入
  "minScale": 0.25,               // 仅当不同于默认 0.5 时写入
  "maxScale": 4                   // 仅当不同于默认 3 时写入
}
```

反序列化时自动补全默认值：

```ts
import { deserializeKoruCanvasConfig } from '@mollu/koru/topology'

const config = deserializeKoruCanvasConfig(diagramData.canvas)
// → 返回完整 KoruCanvasConfig（缺失字段用 defaultKoruCanvasConfig() 填充）
```

---

## 与 KoruGraphEditorOptions 的关系

`KoruGraphEditorOptions`（通过 `options` prop 传入）是**简化版的画布配置**，在组件初始化时映射到 `KoruCanvasConfig`：

```ts
interface KoruGraphEditorOptions {
  mode: 'edit' | 'preview'
  grid: boolean
  gridSize?: number
  zoom: { min: number; max: number }
  panning: boolean
  mouseWheel: boolean
  allowDragNode: boolean
  allowCreateEdge: boolean
  allowDelete: boolean
  allowSelect: boolean
}
```

消费方可以二选一：
- **简单场景**：用 `options` prop 快速配置几个常用开关
- **精细场景**：用 `applyKoruCanvasConfig` 或完整 `KoruCanvasConfig`

---

## API 速查

```ts
// 类型
import type {
  KoruCanvasConfig,
  KoruCanvasBackground,
  KoruCanvasGrid,
  KoruCanvasMousewheel,
  KoruCanvasPanning,
  KoruCanvasSnapline,
  KoruCanvasTranslating,
  KoruCanvasScroller,
  KoruCanvasScroller,
  KoruCanvasConfigStorage,
} from '@mollu/koru/topology'

// 默认值 & 序列化
import {
  defaultKoruCanvasConfig,
  serializeKoruCanvasConfig,
  deserializeKoruCanvasConfig,
} from '@mollu/koru/topology'

// 应用到 Graph 实例
import { applyKoruCanvasConfig, useCanvasStore } from '@mollu/koru/topology'

const store = useCanvasStore()
applyKoruCanvasConfig(store.x6GraphRef.value!, defaultKoruCanvasConfig())
```
