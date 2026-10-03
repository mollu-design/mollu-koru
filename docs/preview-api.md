# 预览模式 API 参考（KoruPreview 模块）

> 编辑器 API 见 [editor-api.md](./editor-api.md)。共享的工具函数、Composables、通用类型见 [component-api.md](./component-api.md)。

---

## KoruPreview（预览模式组件）

只读预览组件，支持实时数据绑定、事件触发和触发器执行。

### Props

| Prop               | 类型                                                                 | 默认值                     | 说明                                                       |
| ------------------ | -------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| `graph`            | `{ nodes?, edges?, cells? }`                                         | `{ nodes: [], edges: [] }` | 画布数据（支持 `v-model:graph`）                           |
| `autoFit`          | `boolean`                                                            | `false`                    | 是否自动缩放适配画布                                       |
| `showTestTools`    | `boolean`                                                            | `false`                    | 是否显示调试面板（含绑定测试+日志）                        |
| `allowCanvasPan`   | `boolean`                                                            | `true`                     | 是否允许鼠标拖动画布（平移）                               |
| `customShapes`     | `CustomShapeItem[]`                                                  | `[]`                       | SVG 自定义形状列表，用于注册 svg-node-\* 形状              |
| `enableHighlight`  | `boolean`                                                            | `true`                     | 是否启用 `highlightDevice` / `clearAllHighlights` / `scrollToCell` 便捷 API |
| `enableAlarmEmit`  | `boolean`                                                            | `false`                    | 是否启用 `alarm` 事件（绑定执行器检测到阈值越限时 emit）   |
| `outerRequestApi`  | `(cfg: OuterRequestRuntimeConfig) => Promise<boolean>`               | —                          | 触发器前置请求 API，返回 true 表示成功；宿主实现后事件的"外部前置请求"开关才能生效 |

> **注意**：`fetchData` 和 `pollInterval` 不在 KoruPreview 的直接 props 中，需要通过 `setBindingConfig()` 全局配置。

### Emits

| 事件               | Payload                                    | 说明                                                          |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------- |
| `update:graph`     | `any`                                      | 画布数据变更                                                  |
| `ready`            | `Record<string, any>`                      | 预览组件初始化完成，payload 为组件暴露的 API 对象（等同 `ref.value`） |
| `destroyed`        | —                                          | 预览组件销毁                                                  |
| `cell-event`       | `CellEventPayload`                         | 图元事件（click/dblclick/mouseenter 等）                      |
| `data-updated`     | `Record<string, number \| string \| null>` | 实时数据更新                                                  |
| `action-triggered` | `ActionTriggeredPayload`                   | 触发器动作执行                                                |
| `device-click`     | `DeviceClickPayload`                       | 点击设备节点（自动向上找父容器，返回容器级信息）              |
| `alarm`            | `Alarm[]`                                  | 一轮 bindingTick 结束后统一 emit 本轮检测到的告警列表（需 `enableAlarmEmit: true`） |

### 实例方法（通过 ref 调用）

> 以下方法由 `defineExpose(_exposedAPI)` 直接挂在 `ref.value` 顶层：
> ```ts
> const previewRef = ref<InstanceType<typeof KoruPreview>>()
> previewRef.value?.refresh()
> previewRef.value?.loadDiagram(data)
> ```

#### 数据 & 图元操作

| 方法                                     | 说明                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| `getGraph()`                             | 获取底层 X6 Graph 实例                                     |
| `loadDiagram(data)`                      | 灌入图纸数据（X6 原生 JSON：`{ cells?, canvas? }`）        |
| `getAllCells()`                          | 获取全部图元（id/shape/position/size/data）                |
| `getCellBindings(cellId)`                | 获取指定 cell 的绑定信息                                   |

#### 绑定执行 & 数据更新

| 方法                                              | 说明                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `refresh()`                                       | 手动触发一次数据刷新（拉取 + 绑定执行）                             |
| `startPolling(interval?)`                         | 启动自动轮询（间隔优先取参数，否则取 `setBindingConfig` 的配置）    |
| `stopPolling()`                                   | 停止自动轮询                                                        |
| `tick()`                                          | 手动执行一轮绑定 tick（不拉新数据，仅重跑绑定逻辑）                 |
| `runBindingTest()`                                | 执行绑定测试                                                        |
| `setPointValue(cellId, device, dataPoint, value)` | 更新单个测点值并立即执行绑定                                        |
| `setPointValues(values)`                          | 批量更新测点值并立即执行绑定                                        |

#### 设备高亮（需 `enableHighlight: true`）

| 方法                               | 说明                                        |
| ---------------------------------- | ------------------------------------------- |
| `highlightDevice(deviceKey, opts?)` | 按 deviceKey 高亮设备节点（自动找父容器） |
| `clearAllHighlights()`             | 清除所有高亮                                |
| `scrollToCell(cellId)`             | 滚动视图到指定 cellId                       |

#### 告警查询（需 `enableAlarmEmit: true`）

| 方法                | 说明                                         |
| ------------------- | -------------------------------------------- |
| `getActiveAlarms()` | 查询当前告警缓冲区（Array\<Alarm\>）         |

#### 运行时开关

| 方法                         | 说明                                                  |
| ---------------------------- | ----------------------------------------------------- |
| `setPanningEnabled(enabled)` | 运行时开启/禁用鼠标平移画布（`allowCanvasPan` 动态版） |

---

## 事件 Payload 类型

### CellEventPayload

```ts
interface CellEventPayload {
  eventType: string // click / dblclick / mouseenter / ...
  cellId: string
  shape: string
  data: Record<string, any> // cell.getData()
  rawEvent?: any // 原始 X6 事件
}
```

### ActionTriggeredPayload

```ts
interface ActionTriggeredPayload {
  cellId: string
  triggerId: string
  actionType: string
  actionValue: Record<string, any>
  tagValue: number | string | null
  matched: boolean
  binding?: any
  triggerConfig?: any
  cellData?: Record<string, any>
  shape?: string
}
```

### DeviceClickPayload

```ts
interface DeviceClickPayload {
  cellId: string              // 实际被点击的 cellId
  deviceCellId: string        // 设备/容器 cellId（可能是父容器）
  deviceKey: string           // 设备标识
  deviceName?: string         // 设备名称
  bindings: any[]             // 该设备的测点绑定
  cellData: Record<string, any> // 原始 cell 数据
  rawEvent?: any              // 原始 X6 事件
}
```

### Alarm

```ts
interface Alarm {
  deviceKey: string            // 设备标识
  cellId: string               // 告警发生的 cellId
  level: 'warning' | 'critical' // 告警级别
  message: string              // 告警消息
  pointName?: string           // 触发告警的测点名
  currentValue?: number | string | null // 测点当前值
  threshold?: number | string | null    // 告警阈值
  triggerId?: string           // 告警来源触发器 ID
  timestamp: number            // 时间戳
}
```
