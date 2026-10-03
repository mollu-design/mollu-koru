# 持久化与存储指南

Koru 提供自动持久化能力，支持画布数据的保存、恢复和自定义存储适配器。

---

## 默认行为

### 自动保存

KoruGraphEditor 默认启用持久化，会自动将画布数据保存到 **IndexedDB**：

- **触发时机**：图元数据变更后 500ms 防抖保存
- **存储 Key**：`persistenceKey` prop 指定，默认 `'koru-diagram-data'`
- **存储内容**：完整的 `KoruGraphData`（包含 nodes、edges、canvas 配置）

### 自动恢复

组件挂载时，会自动从 IndexedDB 读取上次保存的数据并恢复。

---

## 配置持久化

### 启用/禁用

通过 `persistenceKey` prop 控制：

```vue
<!-- 启用持久化（默认 key） -->
<koru-graph-editor v-model:graph="graphData" />

<!-- 启用持久化（自定义 key） -->
<koru-graph-editor v-model:graph="graphData" persistence-key="my-diagram-v1" />

<!-- 禁用持久化 -->
<koru-graph-editor v-model:graph="graphData" persistence-key="" />
```

### 恢复确认回调

当检测到已保存数据时，可以弹出确认对话框让用户选择是否恢复：

```vue
<template>
  <koru-graph-editor
    v-model:graph="graphData"
    persistence-key="my-diagram"
    :persistence-confirm="confirmRestore"
  />
</template>

<script setup lang="ts">
import { Notification } from '@arco-design/web-vue'
import type { PersistenceData } from '@mollu/koru/topology'

async function confirmRestore(savedData: PersistenceData): Promise<boolean> {
  // 弹出确认对话框
  return new Promise((resolve) => {
    Notification.info({
      title: '检测到未完成的画布',
      content: `上次编辑时间: ${new Date(savedData.timestamp).toLocaleString()}`,
      duration: 0,
    })
    // 返回 true = 恢复数据，false = 跳过恢复
    console.log('已保存的图元数量:', savedData.cellCount)
    resolve(true) // 自动恢复
  })
}
</script>
```

### PersistenceData 结构

```ts
interface PersistenceData {
  cells: any[]          // X6 cells 数组
  canvas: any           // 画布配置
  timestamp: number     // 保存时间戳
  cellCount: number     // 图元数量
}
```

---

## 自定义存储适配器

如果不想使用 IndexedDB（如需要存入 localStorage、远程服务器等），可以通过 `persistenceAdapter` prop 实现自定义存储。

### PersistenceStorageAdapter 接口

```ts
interface PersistenceStorageAdapter {
  /** 保存数据 */
  save(key: string, data: PersistenceData): Promise<void>
  /** 加载数据 */
  load(key: string): Promise<PersistenceData | null>
  /** 删除数据 */
  remove(key: string): Promise<void>
}
```

### 内置适配器

#### IndexedDB 适配器（默认）

```ts
import { createIndexedDBAdapter } from '@mollu/koru/topology'

// 使用默认配置
const adapter = createIndexedDBAdapter()

// 自定义数据库和仓库名
const adapter = createIndexedDBAdapter({
  databaseName: 'my-app-db',
  storeName: 'diagrams',
})
```

#### LocalStorage 适配器

```ts
import type { PersistenceStorageAdapter } from '@mollu/koru/topology'

const localStorageAdapter: PersistenceStorageAdapter = {
  async save(key: string, data: PersistenceData) {
    localStorage.setItem(`koru:${key}`, JSON.stringify(data))
  },
  async load(key: string) {
    const raw = localStorage.getItem(`koru:${key}`)
    return raw ? JSON.parse(raw) : null
  },
  async remove(key: string) {
    localStorage.removeItem(`koru:${key}`)
  },
}
```

#### 远程存储适配器

```ts
const remoteAdapter: PersistenceStorageAdapter = {
  async save(key: string, data: PersistenceData) {
    await fetch(`/your-api/diagram/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
  async load(key: string) {
    const res = await fetch(`/your-api/diagram/${key}`)
    if (!res.ok) return null
    return res.json()
  },
  async remove(key: string) {
    await fetch(`/your-api/diagram/${key}`, { method: 'DELETE' })
  },
}
```

### 使用自定义适配器

```vue
<template>
  <koru-graph-editor
    v-model:graph="graphData"
    persistence-key="my-diagram"
    :persistence-adapter="remoteAdapter"
  />
</template>

<script setup lang="ts">
import { createIndexedDBAdapter } from '@mollu/koru/topology'
import type { PersistenceStorageAdapter } from '@mollu/koru/topology'

// 使用 IndexedDB
const adapter = createIndexedDBAdapter()

// 或使用自定义适配器
const customAdapter: PersistenceStorageAdapter = {
  async save(key, data) { /* ... */ },
  async load(key) { /* ... */ },
  async remove(key) { /* ... */ },
}
</script>
```

---

## 手动数据操作

### dbGet / dbSet / dbRemove

直接操作 IndexedDB 的工具函数，可独立于组件使用：

```ts
import { dbGet, dbSet, dbRemove } from '@mollu/koru/topology'

// 读取数据
const data = await dbGet('koru-diagram-data')
if (data) {
  console.log('已保存数据:', data)
  console.log('图元数量:', data.cellCount)
}

// 写入数据
await dbSet('koru-diagram-data', {
  cells: [...],
  canvas: { /* ... */ },
  timestamp: Date.now(),
  cellCount: 42,
})

// 删除数据
await dbRemove('koru-diagram-data')
```

### 在预览模式中加载已保存数据

```vue
<!-- PreviewModeDemo.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { KoruPreview, dbGet } from '@mollu/koru/topology'

const graphData = ref<any>({ nodes: [], edges: [] })

onMounted(async () => {
  // 从 IndexedDB 读取
  const raw = await dbGet('koru-diagram-data')
  if (raw) {
    const parsed = JSON.parse(raw)
    graphData.value = parsed.cells
      ? { cells: parsed.cells, canvas: parsed.canvas }
      : { nodes: [], edges: [] }
  }
})
</script>
```

### 使用 useCanvasPersistence composable

如果需要更细粒度的控制，可以直接使用 composable：

```ts
import { useCanvasPersistence, createIndexedDBAdapter } from '@mollu/koru/topology'
import type { PersistenceData } from '@mollu/koru/topology'

const { save, load, remove, isLoading, lastSaved } = useCanvasPersistence({
  key: 'my-diagram',
  adapter: createIndexedDBAdapter(),
  autoSave: true,         // 自动保存
  autoLoad: true,         // 自动加载
  debounceMs: 500,        // 防抖时间
})

// 手动触发保存
async function manualSave() {
  await save(currentData)
  console.log('已保存:', lastSaved.value)
}

// 手动触发加载
async function manualLoad() {
  const data: PersistenceData | null = await load()
  if (data) {
    console.log('已加载:', data)
  }
}

// 清除保存
async function clearSaved() {
  await remove()
}
```

### UseCanvasPersistenceOptions

```ts
interface UseCanvasPersistenceOptions {
  /** 存储 key */
  key: string
  /** 存储适配器 */
  adapter?: PersistenceStorageAdapter
  /** 是否自动保存（数据变更时） */
  autoSave?: boolean
  /** 是否自动加载（初始化时） */
  autoLoad?: boolean
  /** 保存防抖时间（毫秒） */
  debounceMs?: number
  /** 保存前的确认回调 */
  confirmCallback?: (data: PersistenceData) => Promise<boolean> | boolean
}
```

---

## 持久化的数据内容

### 保存的数据格式

`PersistenceData` 包含以下字段：

```json
{
  "cells": [
    {
      "id": "node_1234567890_1",
      "shape": "custom-rect",
      "x": 160,
      "y": 120,
      "width": 66,
      "height": 36,
      "attrs": { "body": { "fill": "#EFF4FF" } },
      "data": {
        "name": "开始节点",
        "binding": { "bindings": [...] },
        "multiState": { ... }
      },
      "ports": [...]
    }
  ],
  "canvas": {
    "grid": true,
    "gridSize": 20,
    "background": { ... },
    "scroller": { ... }
  },
  "timestamp": 1700000000000,
  "cellCount": 12
}
```

### 存储内容说明

| 字段 | 说明 |
|------|------|
| `cells` | X6 序列化的图元数组（节点+连线） |
| `canvas` | 画布配置（网格、背景、滚动等） |
| `timestamp` | 保存时间戳 |
| `cellCount` | 图元总数 |

### 不存储的内容

- **绑定注册表**：需要通过 `getBindingRegistry()` 在保存时单独获取并传给后端
- **运行时状态**：如当前缩放级别、选中状态、临时操作等不会被持久化
- **组件配置**：Stencil 分组、Logo 等通过 `setComponentConfig()` 设置的全局配置不会被持久化

---

## 多画布持久化

使用不同的 `persistenceKey` 为不同画布独立存储：

```vue
<!-- 画布 A -->
<koru-graph-editor v-model:graph="graphA" persistence-key="diagram-A" />

<!-- 画布 B -->
<koru-graph-editor v-model:graph="graphB" persistence-key="diagram-B" />
```

或者在切换画布时动态更改 key：

```ts
const currentKey = ref('diagram-default')

function switchDiagram(id: string) {
  currentKey.value = `diagram-${id}`
  // 组件会自动从新 key 加载数据
}
```

---

## 版本迁移

当数据格式发生变更时，可以在加载后进行迁移：

```ts
async function loadWithMigration(key: string) {
  const raw = await dbGet(key)
  if (!raw) return null

  let data = JSON.parse(raw)

  // 版本检测
  const version = data.version || 1

  if (version < 2) {
    // 迁移旧格式
    data = migrateV1ToV2(data)
    // 保存新版本
    await dbSet(key, { ...data, version: 2 })
  }

  return data
}
```

### 建议：在 PersistenceData 中添加 version 字段

```ts
interface PersistenceData {
  version?: number       // 数据版本号
  cells: any[]
  canvas: any
  timestamp: number
  cellCount: number
}
```

---

## 最佳实践

### 1. 使用确认回调防止误覆盖

```ts
async function confirmRestore(saved) {
  // 如果保存时间过久（超过 24 小时），提示用户
  const age = Date.now() - saved.timestamp
  if (age > 24 * 60 * 60 * 1000) {
    return confirm(`检测到 ${Math.floor(age / 3600000)} 小时前的编辑记录，是否恢复？`)
  }
  return true
}
```

### 2. 配合全局配置使用

```ts
// App.vue
onMounted(async () => {
  // 先加载全局配置
  setComponentConfig({ stencilGroups: [...] })
  
  // 再加载持久化数据
  // （KoruGraphEditor 内部会自动处理顺序）
})
```

### 3. 保存时同时获取绑定注册表

```ts
function handleSave(data: { diagramData: any; bindingRegistry: any[] }) {
  // diagramData 已被持久化系统自动保存
  // bindingRegistry 需要额外发送给后端
  backend.subscribeBindings(data.bindingRegistry)
}
```

### 4. 预览模式独立加载

预览模式组件（KoruPreview）不会自动加载持久化数据，需要手动调用 `dbGet`：

```ts
onMounted(async () => {
  const data = await dbGet('koru-diagram-data')
  if (data) {
    previewGraphData.value = data.cells
      ? { cells: data.cells, canvas: data.canvas }
      : { nodes: [], edges: [] }
  }
})
```
