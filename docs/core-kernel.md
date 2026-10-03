# Core Kernel（不依赖 X6 的底层能力）

> **源码位置**：`src/core-kernel/` + `src/topology/core/`
> 这部分**不依赖 X6**——可以作为独立库使用，用于自己构建拓扑组件或纯 JS 后端处理图纸数据。

---

## 模块清单

| 模块 | 路径 | 说明 |
|------|------|------|
| KoruEventBus | `core-kernel/event-bus.ts` | 发布订阅事件总线 |
| KoruGraph | `topology/core/KoruGraph.ts` | 独立图数据模型（节点 + 连线 + 邻接表） |
| KoruSelection | `topology/core/KoruSelection.ts` | 独立选区管理（支持矩形框选） |
| Point Math | `core-kernel/math/point.ts` | 向量/距离/加/减/缩放 |
| Rect Math | `core-kernel/math/rect.ts` | 矩形创建/包含/相交/并集/包围盒 |
| Transform Math | `core-kernel/math/transform.ts` | 仿射变换/平移/缩放/组合 |
| Renderer | `core-kernel/renderer/` | 节点渲染器抽象（接口） |

---

## KoruEventBus

### API

```ts
import { KoruEventBus } from '@mollu/koru/core-kernel'

const bus = new KoruEventBus()

// 订阅
const off = bus.on('alarm-changed', (alarm) => {
  console.log(alarm)
})

// 发布
bus.emit('alarm-changed', { deviceKey: 'ct', level: 'critical' })

// 取消订阅
off()  // 方式 A
bus.off('alarm-changed', handler)  // 方式 B

// 一次性订阅
bus.once('load-complete', () => { /* 只执行一次 */ })

// 清空所有订阅
bus.clear()
```

### 用在哪里

- `useKoruGraphEditor` 内部 History/undo/redo 事件广播
- `KoruMultiState` 状态变化通知
- 绑定执行引擎内部 tick 循环

### 类型安全版

```ts
// 定义事件类型映射
interface BusEvents {
  'alarm-changed': Alarm
  'tick-done': void
  'multiStateChanged': { cellId: string; newStateId: string }
}

const bus = new KoruEventBus<BusEvents>()

// 有类型提示
bus.on('alarm-changed', (alarm) => {
  alarm.deviceKey  // ✅ 类型正确
})
```

---

## KoruGraph（独立图数据模型）

### 什么时候用

- 不想引入 X6 的打包体积（X6 gzip 后 ~100KB）
- 后端纯 Node.js 里处理拓扑图纸数据
- 自己做渲染引擎（Canvas / SVG / WebGL）

### API

```ts
import { KoruGraph } from '@mollu/koru/core-kernel'

const graph = new KoruGraph()

// ── 节点 ──
graph.addNode({ id: 'n1', x: 100, y: 200, width: 50, height: 50, data: { label: 'CT' } })
graph.getNode('n1')
graph.updateNode('n1', { x: 120 })
graph.removeNode('n1')
graph.getAllNodes()
graph.findNodesByData('label', 'CT')

// ── 连线 ──
graph.addEdge({ id: 'e1', source: 'n1', target: 'n2', data: { type: 'power' } })
graph.getEdge('e1')
graph.getEdgesFrom('n1')   // 出边
graph.getEdgesTo('n2')     // 入边
graph.getNeighbors('n1')   // 相邻节点（不区分方向）
graph.removeEdge('e1')

// ── 查询 ──
graph.containsNode('n1')   // → true/false
graph.containsEdge('e1')
graph.nodeCount            // → number
graph.edgeCount
graph.toJSON()             // → { nodes: [...], edges: [...] }
graph.fromJSON(json)       // 反序列化
graph.clear()

// ── 遍历 ──
graph.walkFrom('n1', (node) => console.log(node))
// BFS 遍历所有可达节点
graph.shortestPath('n1', 'n5')
// 计算最短路径（返回节点 id 数组）
```

### 跟 X6 Graph 的关系

```
X6 Graph（有 DOM 渲染）
  └─ 内部持有一个 KoruGraph 的数据模型
     （cells/nodes/edges 数据结构一致）

KoruGraph（纯数据，无 DOM）
  └─ 可以独立序列化/反序列化
     可以用来在 Node.js 里做拓扑计算
```

`X6 Graph.toJSON()` 的输出格式和 `KoruGraph.toJSON()` **兼容**——后端用 KoruGraph 处理完，前端直接 `graph.fromJSON(...)` 就能渲染。

---

## KoruSelection

### 为什么独立写一个

X6 的 Selection 是 DOM 绑定的——要跑在浏览器里。但矩形框选的数学逻辑（哪些点被框住了）跟 DOM 无关，可以抽出来复用。

### API

```ts
import { KoruSelection } from '@mollu/koru/core-kernel'

const selection = new KoruSelection()

// 设图元集合
selection.setCells(graph.getAllNodes())

// 矩形框选
const rect = { x: 0, y: 0, width: 200, height: 200 }
const picked = selection.selectInRect(rect)
// → 返回框住的所有 cell

// 点选
const picked2 = selection.selectAt({ x: 120, y: 130 })

// 追加选中
selection.addToSelection(cell.id)
selection.removeFromSelection(cell.id)
selection.clearSelection()

// 查询
selection.selected      // → Set<string> 选中的 id
selection.isEmpty       // → boolean
selection.contains(id)  // → boolean
```

---

## Math 工具函数

### Point（向量）— `core-kernel/math/point.ts`

```ts
import { distance, add, sub, scale, vector } from '@mollu/koru/core-kernel/math'

const a: KoruPoint = { x: 10, y: 20 }
const b: KoruPoint = { x: 40, y: 60 }

distance(a, b)    // → 50（欧几里得距离）
add(a, b)         // → { x: 50, y: 80 }
sub(a, b)         // → { x: -30, y: -40 }
scale(a, 2)       // → { x: 20, y: 40 }
vector(a, b)      // → { x: 30, y: 40 } 从 a 指向 b
```

### Rect（矩形）— `core-kernel/math/rect.ts`

```ts
import { createRect, rectContainsPoint, rectIntersect, rectUnion, boundingRect, rectToSize } from '@mollu/koru/core-kernel/math'

const r1 = createRect(0, 0, 100, 100)
const r2 = createRect(50, 50, 200, 200)

rectContainsPoint(r1, { x: 50, y: 50 })   // → true
rectContainsPoint(r1, { x: 200, y: 200 }) // → false
rectIntersect(r1, r2)  // → { x: 50, y: 50, width: 50, height: 50 }（相交矩形）
rectUnion(r1, r2)      // → { x: 0, y: 0, width: 250, height: 250 }（覆盖两者）
boundingRect([point1, point2, point3]) // → 包围所有点的最小矩形
rectToSize(r1)         // → { width: 100, height: 100 }
```

### Transform（仿射变换）— `core-kernel/math/transform.ts`

```ts
import { identityTransform, translateTransform, scaleTransform, applyTransform, multiplyTransform } from '@mollu/koru/core-kernel/math'

identityTransform()              // → 单位矩阵（3×3）
translateTransform(10, 20)       // → 平移 (10, 20) 的变换矩阵
scaleTransform(2, 2)             // → 2× 缩放矩阵
applyTransform(point, transform) // → { x: 10 + 2*5, y: 20 + 2*3 } 变换后的点
multiplyTransform(a, b)          // → a × b 矩阵乘积（先做 b 再做 a）
```

---

## 独立使用示例

### 后端 Node.js 处理图纸数据

```ts
// server/topology-service.ts
import { KoruGraph } from '@mollu/koru/core-kernel'
import { KoruSelection, rectContainsPoint } from '@mollu/koru/core-kernel'

export function findShortestPathBetweenDevices(diagramJson: any, fromKey: string, toKey: string) {
  const graph = new KoruGraph()
  graph.fromJSON(diagramJson)

  // 后端计算：从 source 设备到 target 设备的最短电气路径
  return graph.shortestPath(fromKey, toKey)
  // → ['source-breaker', 'bus-1', 'main-tr', 'target-breaker']
}

export function findOverlappingNodes(diagramJson: any) {
  const graph = new KoruGraph()
  graph.fromJSON(diagramJson)
  const nodes = graph.getAllNodes()

  // 找两个节点矩形互相重叠的（设计时可能需要提示用户）
  const overlaps = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const r1 = createRect(nodes[i].x, nodes[i].y, nodes[i].width, nodes[i].height)
      const r2 = createRect(nodes[j].x, nodes[j].y, nodes[j].width, nodes[j].height)
      if (rectIntersect(r1, r2)) {
        overlaps.push([nodes[i].id, nodes[j].id])
      }
    }
  }
  return overlaps
}
```

### 自己构建渲染器（不用 X6）

```vue
<!-- custom-canvas.vue -->
<template>
  <canvas ref="canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { KoruGraph } from '@mollu/koru/core-kernel'

const canvas = ref<HTMLCanvasElement>()
const graph = new KoruGraph()

onMounted(() => {
  // 从后端加载图纸
  fetch('/your-api/diagram/1')
    .then(r => r.json())
    .then(json => {
      graph.fromJSON(json)
      draw()
    })
})

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return

  // 画连线
  for (const edge of graph.getAllEdges()) {
    const src = graph.getNode(edge.source)!
    const tgt = graph.getNode(edge.target)!
    ctx.beginPath()
    ctx.moveTo(src.x + src.width/2, src.y + src.height/2)
    ctx.lineTo(tgt.x + tgt.width/2, tgt.y + tgt.height/2)
    ctx.stroke()
  }

  // 画节点
  for (const node of graph.getAllNodes()) {
    ctx.fillRect(node.x, node.y, node.width, node.height)
  }
}
</script>
```

### 纯逻辑验证（单元测试）

```ts
// 不需要 DOM 的拓扑逻辑测试
import { describe, it, expect } from 'vitest'
import { KoruGraph } from '@mollu/koru/core-kernel'

describe('拓扑连通性', () => {
  it('主变 → 断路器 → 馈线 应该连通', () => {
    const g = new KoruGraph()
    g.addNode({ id: 'tr', ... })
    g.addNode({ id: 'br', ... })
    g.addNode({ id: 'load', ... })
    g.addEdge({ source: 'tr', target: 'br' })
    g.addEdge({ source: 'br', target: 'load' })

    const path = g.shortestPath('tr', 'load')
    expect(path).toEqual(['tr', 'br', 'load'])
  })
})
```

---

## 导出路径

```ts
// 全部
import { KoruEventBus, KoruGraph, KoruSelection, distance, rectIntersect, ... }
  from '@mollu/koru/core-kernel'

// 或按子模块
import { KoruGraph } from '@mollu/koru/core-kernel/graph'
import * as math from '@mollu/koru/core-kernel/math'
```

> **体积提示**：core-kernel 全部加起来 ~15KB gzip。如果只引入 math 模块 ~3KB。

---

## 相关文档

- 架构说明（core + 渲染层分离设计）：[architecture.md](./architecture.md)
