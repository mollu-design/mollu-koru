# 绑定注册表

## 概述

绑定注册表是连接 **前端图元绑定配置** 与 **后端实时数据推送** 的桥梁。

```
┌──────────────┐     bindingRegistry      ┌──────────────┐     HTTP轮询      ┌──────────────┐
│  前端编辑器   │  ──────────────────────> │   后端服务    │  ──────────────> │   前端预览    │
│ (KoruEditor) │                          │              │                 │ (KoruPreview)│
└──────────────┘                          └──────────────┘                 └──────────────┘
```

**核心原则**：`binding_registry` 是唯一事实源。你的存储从它推导查询哪些测点，前端 executor 从它反查 cellId 补全 key。

---

## 核心概念

### 1. BindingRegistry（绑定注册表）

**是什么**：画布上所有图元的绑定配置清单，描述了「哪些图元订阅了哪些设备的哪些测点」。

**什么时候用**：保存图纸时随 `diagramData` 一起发给你的服务端存储，加载图纸时一起取回。

**数据结构**：

```ts
type BindingRegistryItem = {
  cellId: string           // 图元 ID（X6 graph cell.id，UUID）
  cellLabel: string        // 图元名称（显示用）
  shape: string            // 图元形状类型
  bindings: BindingRegistryEntry[]  // 该图元的全部绑定项
}

type BindingRegistryEntry = {
  id: string               // 绑定项 ID（前端生成，UUID）
  device: string           // 设备标识（device_key，如 "feeder_breaker_02"）
  deviceLabel: string      // 设备名称（显示用）
  dataPoint: string        // 测点标识（如 "switch_status" / "ia" / "pf"）
  targetProperty: string   // 绑定的图元属性（见下方可选值）
  mappingRules: string     // JEXL 映射规则（可选）
  refreshInterval: number  // 刷新间隔（毫秒，可选）
  triggerCount: number     // 触发器数量（可选）
}
```

### 2. targetProperty 可选值

决定 executor Phase 2 拿到测点值后怎么处理：

| 值 | 含义 | Phase 2 动作 |
|---|---|---|
| `fill` | 填充颜色 | 直接把值写入 cell style.fill |
| `text` | 文本内容 | 直接把值写入 cell text（append 到现有文本） |
| `fontColor` | 字体颜色 | 把值写入 cell style.fontColor |
| `nodeAnim` | 节点动画 | 触发节点脉冲动画 |
| `elementStateMapping` | 多状态切换 | **Phase 1 处理**——根据值切多状态元件的 activeStateId |

> **多状态元件约定**：targetProperty = `elementStateMapping` 的绑定，executor 会走 Phase 1（多状态专用通道），用 `applyMultiStateByPoint` 里的 stateRule 表达式驱动 SVG 状态切换，不走普通的 Phase 2 属性映射。

### 3. 实时数据格式（三种，executor 全支持）

executor 的 `normalizeToFlat()` 会**统一归一化为内部三段式**再进 cache。你的数据源（HTTP 轮询 / WS / MQTT）可以任选一种格式返回。

#### 格式 A：扁平三段式（flat，默认，推荐）

```json
{
  "478ac6a7-e1f1-4e62-a0fe-cccf39552f1a:ct:ia": 31.31,
  "de26923e-783b-400f-ad0c-13313bd934c0:ct:ia": 31.31,
  "b8a1cc41-4ad4-451b-8478-41d1e15ecd19:ct:ib": 15.95,
  "3d3389f6-fe66-448b-bb97-1664b289cedd:feeder_breaker_02:switch_status": 2
}
```

- **key 格式**：`cellId:device:dataPoint`
- **优点**：executor 直接 `cache.get(key)` O(1) 命中，无需反查 graph
- **缺点**：同一 device:dataPoint 绑多个 cell 时会重复

#### 格式 B：按 cell 分组（grouped）

```json
[
  {
    "cellId": "478ac6a7-e1f1-4e62-a0fe-cccf39552f1a",
    "data": [
      { "device": "ct", "dataPoint": "ia", "value": 31.31 }
    ]
  },
  {
    "cellId": "de26923e-783b-400f-ad0c-13313bd934c0",
    "data": [
      { "device": "ct", "dataPoint": "ia", "value": 31.31 }
    ]
  }
]
```

- **优点**：自描述，每个 cell 带 device 列表
- **缺点**：数据量较大，和三段式一样有冗余

#### 格式 C：两段式（twoseg，最省带宽）

```json
{
  "ct:ia": 31.31,
  "ct:ib": 15.95,
  "feeder_breaker_02:switch_status": 2
}
```

- **key 格式**：`device:dataPoint`
- **优点**：零冗余——同一 (device, dataPoint) 只一条
- **缺点**：executor 需要从 graph binding 反查哪些 cell 绑了这个测点，自动补全 cellId

> **注意**：两段式归一化时，executor 会扫 graph 里所有 cell 的 `binding.bindings[]`，把匹配 `device:dataPoint` 的 cell 都展开成独立的三段式 cacheKey。**所以两个 cell 绑同一个测点不会冲突，各自独立命中。**

### 4. 内部 cache 格式（归一化后统一）

不管你的数据源返回哪种格式，executor 内部 `tagValueCache` 里存的都是：

```
key:   cellId:device:dataPoint    （三段式，snake_case）
value: number | string | null
```

---

## 前端使用（库导出 API）

### 前置：配置业务侧测点数据源（业务系统侧实现）

> 绑定面板"设备"和"测点"下拉的数据来源是业务系统的设备目录。通过 `setDeviceConfig()` 和 `setMultiStateConfig()` 全局注册：
>
> ```ts
> import { setDeviceConfig, setMultiStateConfig } from '@mollu/koru/topology'
>
> setDeviceConfig({
>   deviceOptions: [
>     { value: 'feeder_breaker_02', label: '02#馈线断路器' },
>     { value: 'ct', label: '电流互感器 CT' },
>   ],
>   deviceCatalog: [
>     {
>       value: 'feeder_breaker_02', label: '02#馈线断路器',
>       points: [
>         { value: 'switch_status', label: '开关状态' },
>         { value: 'pf', label: '功率因数' },
>       ],
>     },
>     {
>       value: 'ct', label: '电流互感器 CT',
>       points: [
>         { value: 'ia', label: 'A相电流', unit: 'A' },
>         { value: 'ib', label: 'B相电流', unit: 'A' },
>       ],
>     },
>   ],
> })
>
> setMultiStateConfig({
>   pointOptions: [
>     { value: 'switch_status', label: '开关状态' },
>     { value: 'fault_code', label: '故障代码' },
>   ],
>   statePresets: ['合闸', '分闸', '故障', '检修'],
> })
> ```
>
> 业务系统可以把这些配置与你自己的设备/测点管理系统关联。Koru 本身**不管理设备/测点数据源**——只消费 `setDeviceConfig` 注册的静态数据。

### 步骤一：编辑模式——给图元加绑定

#### 普通图元（文本、矩形等）

1. 在画布上选中一个 cell
2. 右侧属性面板 → 「绑定」tab
3. 点击 **+ 新增绑定**
4. 配置：

```
绑定设备:     [下拉选] ct / feeder_breaker_02 / ...
绑定数据点:   [下拉选] ia / ib / pf ...（选中设备后自动过滤）
               找不到？allow-create 直接打字输入新测点编码
绑定属性:     text / fill / fontColor / nodeAnim
               └─ text: 把测点值显示在图元文本上
               └─ fill: 把测点值当颜色（需 mappingRules）
```

5. 保存时自动采集 binding_registry 发给后端

#### 多状态元件（断路器、隔离开关等 SVG 有多个状态）

**比普通图元多两步**：配置 binding 选 `elementStateMapping` + 编辑 stateRule。

**第一步：绑定面板**（和普通图元一样）

```
绑定设备:     [下拉选] feeder_breaker_02
绑定数据点:   [下拉选] switch_status
绑定属性:     elementStateMapping    ← 关键！选这个告诉 executor 走 Phase 1
```

**第二步：多状态编辑器**（独立弹窗，画布上右键多状态元件 → 「编辑多状态」）

```
多状态编辑器弹窗:

┌─ 状态列表 ──────────────────────────────────────┐
│  状态 ID      │  状态名称  │  子图元列表        │
│  state_1      │  合闸      │  child-cell-1, ... │
│  state_2      │  分闸      │  child-cell-2, ... │
│  state_3      │  检修      │  child-cell-3, ... │
└────────────────────────────────────────────────┘

┌─ 状态切换规则（stateRule）──────────────────────┐
│  state_1:  ${point} == 1                         │
│  state_2:  ${point} == 2                         │
│  state_3:  ${point} == 3                         │
│  state_4:  ${point} >= 4                         │
└────────────────────────────────────────────────┘
```

**规则说明**：
- `${point}` 是占位符，运行时被实际测点值替换
- 表达式用 JEXL 语法：`==`、`!=`、`>=`、`&&`、`||` 都支持
- executor Phase 1 遍历每个 state，**第一个表达式为 true 的 state 生效**
- **stateList 里的 stateId 必须和 stateRule 的 key 完全一致**

**多状态元件完整配置检查表**：

| # | 做什么 | 在哪做 | 存到哪 |
|---|---|---|---|
| 1 | 在业务侧给设备加测点（如 `switch_status`） | 业务系统设备管理（非 Koru 库内容） | 业务侧（如 `TopologyDevice.measure_points`） |
| 2 | 通过 `setDeviceConfig({ deviceCatalog })` 注册设备测点 | 应用启动时 | `@mollu/koru/topology` 全局 Store |
| 3 | 画布里放一个多状态元件 | 从工具栏拖进来 | `cell.data.isMultiState = true` |
| 4 | 配置状态列表（合闸/分闸/检修...） | 右键 → 编辑多状态 | `cell.data.stateList` |
| 5 | 配置状态切换规则 stateRule | 编辑多状态弹窗 | `cell.data.pointBind.stateRule` |
| 6 | 加 binding 选 `elementStateMapping` | 属性面板 → 绑定 tab | `binding_registry.bindings[].targetProperty` |

### 步骤二：保存图纸——采集绑定注册表

KoruGraphEditor 的 `@save` 事件**已经自动返回** `bindingRegistry`，直接保存即可：

```vue
<!-- EditPage.vue -->
<koru-graph-editor
  ref="koruRef"
  v-model:graph="graphData"
  @save="handleSave"
/>

<script setup lang="ts">
import { ref } from 'vue'
import type { KoruGraphData } from '@mollu/koru/topology'

const graphData = ref<KoruGraphData>({ nodes: [], edges: [] })

function handleSave(data: {
  diagramData: any              // X6 原生序列化：{ cells, canvas }
  bindingRegistry: any[]        // 绑定注册表，发给后端建立实时订阅
  name?: string                 // 用户输入的图纸命名（可能为空）
}) {
  // 发送给后端
  backend.saveDiagram(data.diagramData, data.bindingRegistry, data.name)
}
</script>
```

> **替代方式**：也可以通过 ref 手动获取（不依赖 save 事件）：
> ```ts
> const koruRef = ref()
> const registry = koruRef.value?.getBindingRegistry()
> const graphData = koruRef.value?.getGraphData()
> ```

### 步骤三：预览模式——对接实时数据源

预览模式通过 **`setBindingConfig()`** 全局配置对接数据源，Koru 自动轮询并在每次 tick 时执行绑定：

```vue
<!-- PreviewPage.vue -->
<koru-preview
  v-model:graph="graphData"
  :show-test-tools="true"
  @cell-event="onCellEvent"
  @action-triggered="onActionTriggered"
/>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  KoruPreview,
  setBindingConfig,
  buildFetchData,
  extractBindingKeys,
  type BindingRegistryItem,
} from '@mollu/koru/topology'

const graphData = ref<any>({ nodes: [], edges: [] })

onMounted(async () => {
  // 1. 从后端加载已保存的图纸数据
  const { diagramData, bindingRegistry } = await backend.loadDiagram('device_5')
  graphData.value = diagramData

  // 2. 从绑定注册表提取需要订阅的测点 key（可选，用于 debug/按需请求）
  const keys = extractBindingKeys(bindingRegistry as BindingRegistryItem[])
  console.log('订阅 Keys:', keys)

  // 3. 构建 fetchData 函数——统一对接后端数据源
  //    buildFetchData 会自动根据 bindingRegistry 反查 cellId，支持三种输入格式
  const fetchData = buildFetchData(
    bindingRegistry as BindingRegistryItem[],
    async () => {
      // 后端接口返回的三种格式之一（flat / grouped / twoseg 都行）
      return await backend.fetchRealtime('device_5')
    },
    { inputFormat: 'flat' },  // 可选，默认 flat；twoseg/grouped 时指定
  )

  // 4. 全局配置——预览组件自动读取并启动轮询
  setBindingConfig({
    values: {},                  // 测点值缓存（Koru 自动维护）
    fetchData,                   // 统一数据源
    pollInterval: 3000,          // 轮询间隔（毫秒，0 表示不轮询）
    setValue: () => {},          // 测试面板"写入值"回调（可选）
    tick: () => {},              // 手动触发刷新回调（可选）
    runTest: () => [],           // 绑定测试回调（可选）
  })
})
</script>
```

### buildFetchData & 数据归一化原理

`buildFetchData(registry, dataSource, options?)` 是 Koru 提供的**数据源适配工具**——封装了"从数据源拉数据 → 归一化为内部三段式 cacheKey"的完整链路：

```ts
// 内部自动处理：
// 1. 调 dataSource() 拿到数据源原始数据（flat / grouped / twoseg 三种任意）
// 2. normalizeToFlat() 把任意格式统一成 { 'cellId:device:dataPoint': value, ... }
//    - flat → 直接接受
//    - grouped → 展平成三段式
//    - twoseg → 扫 bindingRegistry 反查 cellId，自动补全
// 3. 返回的 fetchData() 可直接传给 setBindingConfig({ fetchData })

// 即使数据源返回 twoseg（最省带宽）：
//   { 'ct:ia': 31.31, 'feeder_breaker_02:switch_status': 2 }
// buildFetchData 也能根据 bindingRegistry 反查出哪些 cell 绑了 ct:ia，
// 自动展开成：
//   { 'node-A:ct:ia': 31.31, 'node-B:ct:ia': 31.31, 'node-C:feeder_breaker_02:switch_status': 2 }
```

**绑定执行器自动流程**：
1. 预览组件每隔 `pollInterval` 毫秒调一次 `fetchData()`
2. 归一化为三段式 cache，写入 `tagValueCache`
3. Phase 1 遍历多状态元件 → 命中 `elementStateMapping` 绑定 → 用 `stateRule` JEXL 表达式驱动 SVG 状态切换
4. Phase 2 遍历普通绑定 → 根据 `targetProperty`（fill/text/fontColor/nodeAnim）映射到图元属性

---

## 数据对接说明（业务系统侧实现，非库内容）

> 以下是业务系统需要实现的后端接口规范，不属于 `@mollu/koru` 的导出 API。列出是为了让业务方理解 bindingRegistry 在前后端之间的完整链路。

### 基础路径

```
/your-api/topology/...
```

### 保存图纸（POST）

```
POST /your-api/topology/diagrams/key/{diagram_key}
Body:
{
  "diagramData": { "cells": [...], "canvas": {...} },
  "bindingRegistry": [
    {
      "cellId": "3d3389f6-...",
      "cellLabel": "02#馈线断路器",
      "shape": "breaker",
      "bindings": [
        {
          "id": "b-001",
          "device": "feeder_breaker_02",
          "deviceLabel": "02#馈线断路器",
          "dataPoint": "switch_status",
          "targetProperty": "elementStateMapping",
          "mappingRules": "",
          "refreshInterval": 0,
          "triggerCount": 0
        }
      ]
    }
  ]
}
Response: { "success": true, "diagramKey": "device_5" }
```

### 实时数据（GET）

```
GET /your-api/topology/diagrams/{diagram_key}/realtime

Response (扁平三段式):
{
  "cellId:device:dataPoint": value,
  "3d3389f6-...:feeder_breaker_02:switch_status": 2,
  "478ac6a7-...:ct:ia": 31.31
}

Response (分组格式):
[
  { "cellId": "3d3389f6-...", "data": [{"device": "feeder_breaker_02", "dataPoint": "switch_status", "value": 2}] }
]

Response (两段式):
{
  "feeder_breaker_02:switch_status": 2,
  "ct:ia": 31.31
}
```

**后端处理流程**：
1. 查 `图纸存储表.binding_registry` → 拿到所有 cell 的绑定
2. 提取唯一的 `(device_key, data_point)` 对（去重）
3. 批量校验 device 存在性
4. 调数据源层 `source.fetch_batch(pairs)` 查值（simulate.py / mqtt）
5. 按约定的格式组装返回

### 设备目录（GET）

```
GET /your-api/topology/devices/catalog

Response: [
  {
    "value": "feeder_breaker_02",
    "label": "02#馈线断路器",
    "device_type": "breaker",
    "points": [
      { "value": "switch_status", "label": "开关状态" },
      { "value": "pf", "label": "功率因数" }
    ]
  },
  {
    "value": "ct",
    "label": "电流互感器CT",
    "device_type": "transformer",
    "points": [
      { "value": "ia", "label": "A相电流" },
      { "value": "ib", "label": "B相电流" }
    ]
  }
]
```

绑定面板 dataPoint 下拉的数据源就是这里的 `points` 数组。

---

## 多状态元件完整链路

```
                    编辑器配置                      运行时链路
                    
[设备管理]    measure_points = [{                     
  value: "switch_status",                             
  label: "开关状态"                                   
}]                                                    
         ↓                                            
[绑定面板]    binding = {                             
  device: "feeder_breaker_02",                        
  dataPoint: "switch_status",                         
  targetProperty: "elementStateMapping"               
}                  ↓                                  
[多状态编辑器]  stateRule = {                          
  "state_1": "${point} == 1",   // 合闸               
  "state_2": "${point} == 2",   // 分闸               
  "state_3": "${point} == 3",   // 检修               
  ...                                                 
}                  ↓                                  
        ──────── 保存图纸 ────────                   
                                                     
[后端 realtime]  collector 扫 binding_registry        
  → 提取 ("feeder_breaker_02", "switch_status")       
  → source.fetch_batch → 随机值 1-5                   
  → 以两段式返回 {"feeder_breaker_02:switch_status": 2}
                                                     
[executor]      normalizeToFlat("twoseg")             
  → 扫 graph binding 反查 cellId                      
  → "3d3389f6-...:feeder_breaker_02:switch_status" = 2
  → cache 入三段式 key                                 
                                                     
[Phase 1]       遍历 multiState cells                 
  → 用 binding 的 device + dataPoint 拼 cacheKey      
  → cache.get("3d3389f6-...:feeder_breaker_02:switch_status") ✅ 命中
  → applyMultiStateByPoint(graph, parent, tagVal=2)   
  → stateRule["state_2"]: "${point} == 2" → true      
  → parent.setData({ activeStateId: "state_2" })      
  → SVG 切换到分闸态 ✅                               
```

---

## 格式兼容性

| 输入格式 | executor 处理 | 最终 cacheKey |
|---|---|---|
| 三段式 `{cellId:device:point}` | 直接接受 | 原样 |
| 分组数组 `[{cellId, data:[...]}]` | 展平成三段式 | `cellId:device:point` |
| 两段式 `{device:point}` | 扫 graph 反查 cellId | 自动补全成三段式 |
| camelCase key | `normalizeKey()` 转 snake_case | 统一 snake_case |

---

## API 速查表（库导出）

| 函数 | 用途 | 输入 | 输出 |
|---|---|---|---|
| `collectBindingRegistry(graph)` | 从 graph 采集注册表 | Graph 实例 | `BindingRegistryItem[]` |
| `normalizeToFlat(data, graph?)` | 任意格式→三段式 | 原始数据 + graph（可选，两段式需要） | `Record<string, any>` |
| `applyMultiStateByPoint(graph, parent, pointValue)` | 驱动多状态切换 | graph, cell, 测点值 | — |
| `useBindingExecutor(deps)` | 创建 executor composable | `{ fetchData, getGraph }` | executor 实例 |

---

## 类型导出

```ts
import type {
  BindingRegistryItem,
  BindingRegistryEntry,
  FlatBindingData,
  GroupedBindingDataItem,
} from '@mollu/koru/topology'
```

---

## 注意事项

1. **toCamelCase 跳过**：`/topology/diagrams/*/realtime` 路径上的 key 不应被 axios 拦截器转 camelCase。检查 `request.ts` 里的正则是否覆盖新路径。

2. **两段式冗余**：两个 cell 绑同一个 device:dataPoint，两段式返回只有一条，executor 自动展开——**数据不重复，功能不冲突**。

3. **pointCode 已废弃**：多状态元件不再需要 `pointBind.pointCode`，stateRule 的 `${point}` 值来自 binding 的 dataPoint。设备测点唯一事实源是**业务系统侧**的设备/测点配置（通过 `setDeviceConfig` 静态注入到 Koru）。

4. **targetProperty 区分通道**：`elementStateMapping` 走 Phase 1（多状态专用通道），其他走 Phase 2（普通属性映射）。不要给多状态元件配 text/fill——那是 Phase 2 干的事。
