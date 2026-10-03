# API 完整参考

本文档是 **@mollu/koru** 的 API 索引页。组件 Props/Emits/实例方法已按职责拆分到独立文档：

| 模块 | 内容 | 文档 |
|------|------|------|
| **编辑器** | KoruGraphEditor + 9 个子组件（Toolbar / Stencil / PropertyPanel / Minimap / ContextMenu / MultiState / Gallery / Template / CanvasPropertyPanel / Modal / ConfirmDialog） | [editor-api.md](./editor-api.md) |
| **预览模式** | KoruPreview + 事件 Payload 类型（CellEventPayload / DeviceClickPayload / Alarm / ActionTriggeredPayload） | [preview-api.md](./preview-api.md) |
| **共享** | 导出清单、工具函数、Composables、配置函数、插件、通用类型 | **本文档** ↓ |

---

## 导出清单

### 对外公开组件（16 个）

> 以下组件从 `@mollu/koru/topology` 路径直接导出，可独立使用。
> 🪶 标注表示该组件**零 Arco 依赖**（可在不安装 `@arco-design/web-vue` 的精简方案中使用）。

```
KoruGraphEditor            编辑器主组件（编辑模式）           → editor-api.md
KoruPreview                预览组件（只读模式）               → preview-api.md
KoruToolbar                顶部工具栏 🪶                      → editor-api.md
KoruStencil                左侧元件拖拽面板 🪶                → editor-api.md
KoruPropertyPanel          右侧属性面板（依赖 Arco）          → editor-api.md
KoruMinimap                右下角小地图 🪶                    → editor-api.md
KoruContextMenu            右键菜单 🪶                        → editor-api.md
KoruMultiStateEditorModal  多状态编辑器弹窗（依赖 Arco）      → editor-api.md
KoruGallery                图库面板 🪶                        → editor-api.md
KoruTemplate               模板面板 🪶                        → editor-api.md
KoruCanvasPropertyPanel    画布属性面板（依赖 Arco）          → editor-api.md
KoruNodeRenderer           节点渲染器（内部，预留） 🪶        → editor-api.md
KoruEdgeRenderer           连线渲染器（内部，预留） 🪶        → editor-api.md
KoruLogoName               Logo+名称组件（内部） 🪶           → editor-api.md
KoruModal                  通用弹窗 🪶                        → editor-api.md
KoruConfirmDialog          确认弹窗 🪶                        → editor-api.md
```

### 内部面板组件（3 个，不对外导出）

```
KoruAnimationPanel         动画配置面板（KoruPropertyPanel 子面板）
KoruSavePanel              保存面板（KoruToolbar 子面板）
KoruPreviewDebugPanel      预览调试面板（KoruPreview 子面板）
```

### 类型（40+ 个）

```
KoruGraphData / KoruNodeData / KoruEdgeData / KoruPortData
KoruStencilGroup / KoruStencilNodeItem / CustomShapeItem
KoruCanvasConfig / KoruCanvasGrid / KoruCanvasBackground
KoruCanvasMousewheel / KoruCanvasPanning / KoruCanvasSnapline / KoruCanvasTranslating / KoruCanvasScroller / KoruCanvasConfigStorage
KoruGraphEditorMode / KoruGraphEditorOptions / KoruGraphEditorInstance
KoruNodeEvent / KoruEdgeEvent
BindingRegistryItem / BindingRegistryEntry / FlatBindingData
GroupedBindingDataItem / ContextMenuStateData / ContextMenuDeps
MultiStateConfig / BindingConfig / DeviceConfig / ComponentConfig
UseCanvasPersistenceOptions / PersistenceStorageAdapter / PersistenceData
GalleryResourceItem / TemplateItem
... 等
```

### 工具函数（20+ 个）

```
# 形状注册与工厂
registerBasicShapes / registerSvgNode / registerSvgGlob / getRegisteredDefs / getRegisteredShapes
createDefaultNode / createDefaultCircleNode / createDefaultTextNode
createDefaultButtonNode / createDefaultEdge / createSvgPreviewNode

# 模块注册（外部自定义节点/连线）
registerNodeModule / registerNodeModules / registerEdgeModule / registerEdgeModules / registerModules

# 存储
dbGet / dbSet / dbRemove / createIndexedDBAdapter

# 其他
uid / DEFAULT_STENCIL_GROUPS
```

### Composables（15 个）

```
useKoruGraphEditor / useZoom / useNodeDrag / useSelection
useClipboard / useUndoRedo / useContextMenu
useKoruCanvasConfig (applyKoruCanvasConfig / koruCanvasConfigToGraphOptions)
useCanvasPersistence
useBindingRegistry (collectBindingRegistry / flattenBindingData / buildFetchData / extractBindingKeys)
useMultiState (genStateId / findMultiStateParents / ... / applyMultiStateByPoint)
useCanvasStore
```

### 配置函数（8 个）

```
setMultiStateConfig / resetMultiStateConfig
setBindingConfig / resetBindingConfig
setDeviceConfig / resetDeviceConfig
setComponentConfig / resetComponentConfig
```

### 核心类

```
KoruGraph / KoruSelection      数据模型类（从 @mollu/koru/topology 导出）
KoruEventBus                   事件总线（从 @mollu/koru 根入口导出）
```

### 常量

```
KORU_DEFAULT_OPTIONS           编辑器默认选项
defaultKoruCanvasConfig        画布默认配置
serializeKoruCanvasConfig / deserializeKoruCanvasConfig
DEFAULT_STENCIL_GROUPS         内置默认 Stencil 分组（5 个）
```

### 插件

```
KoruTopologyPlugin             主插件（组件注册 + 基础形状）—— 也以 defaultPlugin 别名导出
plugins/flow                   流程编排插件（可选，@mollu/koru/plugins/flow）
plugins/whiteboard             白板标注插件（可选，@mollu/koru/plugins/whiteboard）
```

---

## 工具函数 & Composables

> 完整用法和场景示例见对应教程文档。

### 存储工具

| 函数 | 签名 | 说明 |
|------|------|------|
| `dbGet` | `(key: string) => Promise<string \| null>` | 从 IndexedDB 读取 |
| `dbSet` | `(key: string, value: string) => Promise<void>` | 写入 IndexedDB |
| `dbRemove` | `(key: string) => Promise<void>` | 删除 IndexedDB 条目 |
| `createIndexedDBAdapter` | `() => PersistenceStorageAdapter` | 创建 IndexedDB 适配器实例 |

👉 完整用法见 [persistence.md](./persistence.md)

### 绑定注册表工具

| 函数 | 签名 | 说明 |
|------|------|------|
| `collectBindingRegistry` | `(graph: Graph) => BindingRegistryItem[]` | 从 Graph 实例采集绑定注册表 |
| `extractBindingKeys` | `(registry: BindingRegistryItem[]) => string[]` | 提取 `cellId:device:dataPoint` 格式的订阅 Keys |
| `flattenBindingData` | `(grouped: GroupedBindingDataItem) => Record<string, any>` | 分组格式 → 扁平格式 |
| `buildFetchData` | `(registry, dataSource, opts?) => Promise<Record<string, any>>` | 构建 fetchData 函数（自动对接绑定注册表） |
| `useBindingRegistry` | `(graphRef) => { getBindingRegistry, ... }` | Composable，返回绑定注册表操作方法 |

👉 完整用法见 [binding-registry.md](./binding-registry.md)

### Canvas Store

> 👉 **完整架构、四大配置详解、多实例注意事项见 [canvas-store.md](./canvas-store.md)**

```ts
import { useCanvasStore } from '@mollu/koru/topology'
const store = useCanvasStore()
```

#### Store 实例引用字段

这些是内部组件共享状态用的 ref，消费方通常只读不写：

| 字段 | 类型 | 说明 |
|------|------|------|
| `instance` | `ref<KoruGraphEditorInstance \| null>` | KoruGraphEditor 实例引用，`@ready` 时赋值 |
| `x6GraphRef` | `shallowRef<Graph \| null>` | X6 Graph 实例 |
| `stencilRef` | `ref<any>` | Stencil 面板实例 |
| `customShapesRef` | `ref<CustomShapeItem[]>` | 当前注册的 SVG 自定义形状列表 |
| `loadGroupNodesRef` | `ref<(groupName, nodes, opts?) => void \| null>` | 运行时动态替换某个分组的图元 |
| `draggingTemplateRef` | `ref<{ data; templateName; thumbnail } \| null>` | Stencil 拖拽模板时暂存 |
| `canvasConfig` | `ref<KoruCanvasConfig>` | 画布配置（网格/背景/缩放等） |
| `ctxMenu` | `ref<ContextMenuStateData>` | 右键菜单状态 |
| `selectedCell` | `ref<any \| null>` | 当前选中的 cell |
| `propActiveTab` | `ref<string>` | 属性面板 active tab。**改它可强制刷新面板** |
| `multiStateEditTarget` | `ref<any \| null>` | 多状态编辑器弹窗目标节点 |
| `multiStateEditVisible` | `ref<boolean>` | 多状态编辑器弹窗可见性 |

#### ComponentConfig（UI 组件配置）

通过 `setComponentConfig()` 设置，影响工具栏/Stencil/属性面板等外观：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `stencilGroups` | `KoruStencilGroup[]` | 4 个默认分组 | Stencil 分组数据（`replaceStencilGroups: true` 可完全替换） |
| `customShapes` | `CustomShapeItem[]` | `[]` | SVG 自定义形状 |
| `toolbarLogo` | `string` | `''` | 工具栏 Logo URL |
| `toolbarName` | `string` | `''` | 工具栏标题文字 |
| `fullscreenTarget` | `string` | `''` | 全屏容器 CSS 选择器 |
| `stencilWidth` | `number` | `210` | Stencil 面板宽度（px） |
| `showToolbar` | `boolean` | `true` | 工具栏显隐 |
| `showStencil` | `boolean` | `true` | Stencil 显隐 |
| `showPropertyPanel` | `boolean` | `true` | 属性面板显隐 |
| `showMinimap` | `boolean` | `false` | 小地图显隐 |
| `saveEnabled` | `boolean` | `true` | 保存时是否弹命名对话框 |
| `confirmTemplateApply` | `boolean` | `true` | 应用模板前是否弹确认框 |
| `confirmRestoreData` | `boolean` | `true` | 恢复本地持久化数据前是否弹确认框 |
| `centerContent` | `boolean` | `true` | 加载图纸后是否自动居中 fitView |
| `extra` | `Record<string, any>` | — | 扩展字段（自定义挂载） |

#### BindingConfig（绑定/运行时配置）

通过 `setBindingConfig()` 设置，影响预览模式数据对接：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `values` | `Record<string, any>` | `{}` | 当前测点值缓存（三段式 key: `cellId:device:dataPoint`） |
| `setValue` | `(cellId, device, point, value) => void` | `() => {}` | 手动注入单个测点值 |
| `tick` | `() => void` | `() => {}` | 手动触发一轮绑定刷新 |
| `runTest` | `(val) => any[]` | `() => []` | 绑定测试 |
| `fetchData` | `(points: string[]) => Promise<Record<string, any>>?` | — | HTTP 轮询模式：拉取测点数据 |
| `pollInterval` | `number` | `0` | 轮询间隔 ms。`0` = 不轮询（WebSocket 模式） |
| `extra` | `Record<string, any>` | — | 扩展字段 |

#### DeviceConfig（设备/属性面板配置）

通过 `setDeviceConfig()` 设置，影响属性面板绑定/触发器 tab 的设备下拉：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `deviceOptions` | `{ value: string; label: string }[]` | `[]` | 设备下拉选项 |
| `deviceCatalog` | `any` | — | 设备树数据（设备目录层级结构） |
| `extra` | `Record<string, any>` | — | 扩展字段 |

#### MultiStateConfig（多状态配置）

通过 `setMultiStateConfig()` 设置，影响多状态编辑器弹窗：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `deviceOptions` | `{ value: string; label: string }[]` | — | 多状态点的设备候选 |
| `statePresets` | `string[]` | — | 状态快捷预设（如 `['合闸', '分闸', '故障']`） |
| `extra` | `Record<string, any>` | — | 扩展字段 |

#### 配置函数

```ts
// 设置（合并同名字段）
setComponentConfig({ toolbarName: '新模式' })
setBindingConfig({ fetchData: myFetchFn, pollInterval: 2000 })
setDeviceConfig({ deviceOptions: [...] })
setMultiStateConfig({ statePresets: ['合闸', '分闸', '故障'] })

// 重置（恢复源码默认值）
resetComponentConfig() / resetBindingConfig() / resetDeviceConfig() / resetMultiStateConfig()
```

👉 详细说明见 [global-config.md](./global-config.md)

---

## 插件系统

| 插件 | 路径 | 说明 |
|------|------|------|
| Flow 流程插件 | `@mollu/koru/plugins/flow` | 为画布添加 6 种流程编排节点 |
| Whiteboard 白板插件 | `@mollu/koru/plugins/whiteboard` | 插件壳（install 预留） |

注册方式：`app.use(flowPlugin)`  /  `app.use(whiteboardPlugin)`

👉 完整插件列表、注册 API、生命周期钩子见 [plugins.md](./plugins.md) 和 [module-registration.md](./module-registration.md)

---

## 类型速查

### KoruGraphEditorOptions

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

### KoruStencilGroup

```ts
interface KoruStencilGroup {
  name: string // 分组标识
  label: string // 显示名称
  items: KoruStencilNodeItem[] // 节点项列表
  graphHeight?: number // 分组容器高度
  layoutOptions?: {
    columns: number
    columnWidth: number
    rowHeight: number
    dx?: number
  }
  collapsed?: boolean
}
```

### KoruStencilNodeItem

```ts
interface KoruStencilNodeItem {
  shape: string
  label: string
  width?: number
  height?: number
  dropWidth?: number
  dropHeight?: number
  attrs?: Record<string, any>
  data?: Record<string, any>
}
```

### CustomShapeItem

```ts
interface CustomShapeItem {
  label: string
  svg: string
  shapeName?: string
}
```
