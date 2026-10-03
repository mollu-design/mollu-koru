# 编辑器 API 参考（KoruGraphEditor 模块）

> 预览模式 API 见 [preview-api.md](./preview-api.md)。共享的工具函数、Composables、通用类型见 [component-api.md · 共享部分](./component-api.md)。

---

## KoruGraphEditor（编辑器主组件）

编辑模式下的核心组件，集成了 Stencil、工具栏、画布、属性面板、小地图等所有子组件。

### Props

| Prop                     | 类型                                         | 默认值                     | 说明                                                    |
| ------------------------ | -------------------------------------------- | -------------------------- | ------------------------------------------------------- |
| `graph`                  | `KoruGraphData`                              | `{ nodes: [], edges: [] }` | 画布数据（支持 `v-model:graph`）                        |
| `mode`                   | `'edit' \| 'preview'`                        | `'edit'`                   | 画布模式                                                |
| `options`                | `Partial<KoruGraphEditorOptions>`            | `{}`                       | 扩展配置（网格、缩放、权限等）                          |
| `persistenceKey`         | `string`                                     | `'koru-diagram-data'`      | 持久化存储 key，空字符串禁用持久化                      |
| `persistenceConfirm`     | `(savedData) => Promise<boolean> \| boolean` | —                          | 恢复数据前的确认回调                                    |
| `persistenceAdapter`     | `PersistenceStorageAdapter`                  | IndexedDB                  | 自定义存储适配器                                        |
| `stencilGroups`          | `KoruStencilGroup[]`                         | 内置默认 5 个分组          | Stencil 分组数据（自动与默认合并，见 global-config.md） |
| `stencilWidth`           | `number`                                     | `210`                      | Stencil 面板宽度（优先于全局配置）                      |
| `customShapes`           | `CustomShapeItem[]`                          | `[]`                       | SVG 自定义形状列表                                      |
| `toolbarLogo`            | `string`                                     | `''`                       | 工具栏 Logo URL                                         |
| `toolbarName`            | `string`                                     | `''`                       | 工具栏名称                                              |
| `fullscreenTarget`       | `string`                                     | `''`                       | 全屏模式 CSS 选择器                                     |
| `showToolbar`            | `boolean`                                    | `true`                     | 是否显示工具栏                                          |
| `saveDefaultName`        | `string`                                     | `''`                       | 保存对话框默认名称（运行时值，如从业务方 onReady 传入） |
| `savePlaceholder`        | `string`                                     | `'留空则自动使用"设备名+图纸"'` | 保存对话框命名输入框 placeholder                       |
| `showStencil`            | `boolean`                                    | `true`                     | 是否显示 Stencil 面板                                   |
| `showPropertyPanel`      | `boolean`                                    | `true`                     | 是否显示属性面板                                        |
| `showMinimap`            | `boolean`                                    | `false`                    | 是否显示小地图                                          |
| `multiStatePointOptions` | `{value, label}[]`                           | —                          | ⚠️ 已废弃，请使用 `setMultiStateConfig()`               |

### Emits

| 事件           | Payload                                                             | 说明                                                          |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `update:graph` | `KoruGraphData`                                                     | 画布数据变更（v-model 同步）                                  |
| `update:mode`  | `'edit' \| 'preview'`                                               | 模式变更                                                      |
| `save`         | `{ diagramData, bindingRegistry, name? }`                          | 用户点击保存按钮，`name` 为用户输入的图纸命名（可能为空字符串） |
| `preview`      | `{ diagramData, bindingRegistry }`                                  | 用户点击预览按钮                                              |
| `template`     | `{ action: 'save' \| 'delete' \| 'clear', template?, templates? }`  | 模板操作事件（保存/删除/清空），组件内部已完成 IndexedDB 操作 |
| `rendered`     | —                                                                   | 画布渲染完成                                                  |
| `ready`        | `Record<string, any>`                                               | 编辑器初始化完成（init + persistence + SVG 全局注册全就绪），payload 为组件暴露的 API 对象（等同 `ref.value`） |
| `destroyed`    | —                                                                   | 画布销毁                                                      |

### Slots

| 插槽             | 默认内容              | 说明                |
| ---------------- | --------------------- | ------------------- |
| `toolbar`        | `<KoruToolbar>`       | 自定义工具栏        |
| `stencil`        | `<KoruStencil>`       | 自定义 Stencil 面板 |
| `property-panel` | `<KoruPropertyPanel>` | 自定义属性面板      |
| `minimap`        | `<KoruMinimap>`       | 自定义小地图        |
| `context-menu`   | `<KoruContextMenu>`   | 自定义右键菜单      |

### 实例方法（通过 ref 调用）

> `KoruGraphEditor` 通过 `defineExpose` 暴露 **`_exposedAPI` 对象**：
> ```ts
> const koruRef = ref<InstanceType<typeof KoruGraphEditor>>()
> koruRef.value.getGraph()                // X6 Graph 实例
> koruRef.value.getBindingRegistry()      // 绑定注册表
> koruRef.value.loadDiagram(data)         // 灌入图纸（X6 原生 JSON）
> koruRef.value.instance.zoomIn()         // 编辑器实例方法
> ```

#### 视口控制

| 方法                     | 说明           |
| ------------------------ | -------------- |
| `zoomIn()`               | 放大一级       |
| `zoomOut()`              | 缩小一级       |
| `resetView()`            | 重置视图       |
| `fitView()`              | 适应画布内容   |
| `setZoom(scale: number)` | 设置指定缩放值 |

#### 图元操作

| 方法                                  | 说明                   |
| ------------------------------------- | ---------------------- |
| `addNode(node)`                       | 添加节点，返回节点 ID  |
| `removeNode(nodeId)`                  | 删除节点               |
| `updateNode(nodeId, data)`            | 更新节点属性           |
| `addEdge(edge)`                       | 添加连线，返回连线 ID  |
| `removeEdge(edgeId)`                  | 删除连线               |
| `updateEdge(edgeId, data)`            | 更新连线属性           |
| `getCell(cellId)`                     | 获取 cell 实例         |
| `updateCellProp(cellId, key, value)`  | 更新 cell 单个属性     |
| `readCellProps(cellId)`               | 读取 cell 全部属性     |
| `updateSelectedCellsProp(key, value)` | 批量更新选中 cell 属性 |

#### 选区操作

| 方法                 | 说明                    |
| -------------------- | ----------------------- |
| `selectNode(nodeId)` | 选中指定节点            |
| `selectAll()`        | 全选                    |
| `clearSelection()`   | 清除选区                |
| `selection` (getter) | 当前选中的 cell ID 列表 |

#### 撤销/重做

| 方法                    | 说明            |
| ----------------------- | --------------- |
| `undo()`                | 撤销一步        |
| `redo()`                | 重做一步        |
| `canUndo` (getter)      | 是否可撤销      |
| `canRedo` (getter)      | 是否可重做      |
| `removeSelectedCells()` | 删除选中的 cell |

#### 数据操作（顶层方法 + instance 方法）

| 方法                          | 位置           | 说明                                      |
| ----------------------------- | -------------- | ----------------------------------------- |
| `getGraph()`                  | 顶层 + instance | 获取底层 X6 Graph 实例                    |
| `getBindingRegistry()`       | 顶层 + instance | 获取绑定注册表（供后端 WS 订阅）          |
| `loadDiagram(data)`           | 顶层           | 灌入图纸数据（X6 原生 JSON `{ cells, canvas }`） |
| `loadTemplates(list)`         | 顶层           | 加载模板到 IndexedDB + 刷新 Stencil 分组  |
| `getGraphData()`              | instance       | 获取当前 `KoruGraphData`                  |
| `setGraphData(data)`          | instance       | 设置画布数据                              |
| `exportJSON()`                | instance       | 导出 JSON 字符串                          |

#### 模式管理

| 方法              | 说明         |
| ----------------- | ------------ |
| `getMode()`       | 获取当前模式 |
| `setMode(mode)`   | 切换模式     |
| `isEditMode()`    | 是否编辑模式 |
| `isPreviewMode()` | 是否预览模式 |

#### 事件订阅

| 方法                  | 说明         |
| --------------------- | ------------ |
| `on(event, handler)`  | 订阅画布事件 |
| `off(event, handler)` | 取消订阅     |

---

## KoruToolbar（工具栏）

顶部工具栏，提供保存、预览、撤销/重做、缩放、全屏等按钮。

### Props

| Prop                 | 类型                              | 默认值 | 说明                          |
| -------------------- | --------------------------------- | ------ | ----------------------------- |
| `logo`               | `string`                          | `''`   | 工具栏 Logo（优先于全局配置） |
| `name`               | `string`                          | `''`   | 工具栏名称（优先于全局配置）  |
| `fullscreenTarget`   | `string \| string[]`              | —      | 全屏容器 CSS 选择器           |
| `onFullscreenChange` | `(isFullscreen: boolean) => void` | —      | 全屏状态变更回调              |

### Emits

| 事件             | Payload                            | 说明       |
| ---------------- | ---------------------------------- | ---------- |
| `save`           | `{ diagramData, bindingRegistry }` | 点击保存   |
| `preview`        | `{ diagramData, bindingRegistry }` | 点击预览   |
| `saveAsTemplate` | `(name: string, data: any)`        | 保存为模板 |

---

## KoruStencil（元件面板）

左侧元件拖拽面板。

### Props

| Prop           | 类型                 | 默认值   | 说明                                              |
| -------------- | -------------------- | -------- | ------------------------------------------------- |
| `groups`       | `KoruStencilGroup[]` | 全局配置 | 分组数据（优先于全局）                            |
| `width`        | `number`             | `210`    | 面板宽度（优先于全局）                            |
| `customShapes` | `CustomShapeItem[]`  | `[]`     | SVG 自定义形状列表（用于 svg-node-\* 的落点尺寸） |

---

## KoruPropertyPanel（属性面板）

右侧属性编辑面板，支持基础属性、动效、事件、绑定四个 tab。

### Props

| Prop      | 类型      | 默认值 | 说明                               |
| --------- | --------- | ------ | ---------------------------------- |
| `visible` | `boolean` | `true` | 是否可见（支持 `v-model:visible`） |

### Emits

| 事件               | Payload   | 说明                 |
| ------------------ | --------- | -------------------- |
| `update:visible`   | `boolean` | 可见性变更           |
| `edit-multi-state` | —         | 点击"组合为状态"按钮 |

---

## KoruMinimap（小地图）

右下角小地图，显示画布缩略图和视口位置。无必须 props。

---

## KoruContextMenu（右键菜单）

### Props

| Prop    | 类型                   | 默认值 | 说明                          |
| ------- | ---------------------- | ------ | ----------------------------- |
| `state` | `ContextMenuStateData` | —      | 菜单状态数据（必须为 Object） |

### Emits

| 事件     | Payload  | 说明               |
| -------- | -------- | ------------------ |
| `action` | `string` | 菜单项 action 名称 |
| `close`  | —        | 菜单关闭           |

---

## KoruMultiStateEditorModal（多状态编辑器弹窗）

> 👉 完整使用方式与配置说明见 [multi-state.md](./multi-state.md)

### Props

| Prop      | 类型      | 默认值  | 说明                                 |
| --------- | --------- | ------- | ------------------------------------ |
| `visible` | `boolean` | `false` | 弹窗可见性（支持 `v-model:visible`） |
| `nodes`   | `Node[]`  | `[]`    | 待组合的节点列表（X6 Node 实例）     |

### Emits

| 事件      | Payload | 说明                   |
| --------- | ------- | ---------------------- |
| `confirm` | `any`   | 确认组合（含状态配置） |
| `cancel`  | —       | 取消操作               |

---

## KoruGallery（图库管理弹窗）

### Props

| Prop      | 类型                     | 默认值  | 说明                          |
| --------- | ------------------------ | ------- | ----------------------------- |
| `visible` | `boolean`                | —       | 是否显示弹窗（支持 `v-model`）|
| `items`   | `GalleryResourceItem[]`  | `[]`    | 图元资源列表                  |

### Emits

| Event          | Payload                                   | 说明             |
| -------------- | ----------------------------------------- | ---------------- |
| `toggleGroup`  | `(groupKey: string, visible: boolean)`    | 切换分组可见性   |
| `showAll`      | —                                         | 一键全部显示     |
| `hideAll`      | —                                         | 一键全部隐藏     |

---

## KoruTemplate（模板面板）

### Props

| Prop        | 类型             | 默认值 | 说明               |
| ----------- | ---------------- | ------ | ------------------ |
| `templates` | `TemplateItem[]` | `[]`   | 模板列表           |
| `allowSave` | `boolean`        | `true` | 是否允许保存为模板 |

---

## KoruCanvasPropertyPanel（画布属性面板）

### Props

| Prop      | 类型      | 默认值 | 说明                               |
| --------- | --------- | ------ | ---------------------------------- |
| `visible` | `boolean` | `true` | 是否可见（支持 `v-model:visible`） |

---

## KoruModal（通用弹窗）🪶

零 Arco 自建弹窗容器，替代 `<a-modal>`。

**Props**

| 名称 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `visible` | `boolean` | — | 是否可见（配合 `v-model:visible`） |
| `title` | `string` | — | 弹窗标题 |
| `width` | `number` | `480` | 弹窗宽度（px） |
| `showFooter` | `boolean` | `false` | 是否显示自动 footer |
| `okText` | `string` | `确定` | 确定按钮文本 |
| `cancelText` | `string` | `取消` | 取消按钮文本 |

**Emits**

| 名称 | 参数 | 说明 |
|------|------|------|
| `update:visible` | `(v: boolean)` | visible 变化 |
| `ok` | — | 点击确定 |
| `cancel` | — | 点击取消 / 遮罩 / Esc |

**Slots**

| 名称 | 说明 |
|------|------|
| `default` | 弹窗内容 |
| `footer` | 自定义 footer |

---

## KoruConfirmDialog（确认弹窗）🪶

零 Arco 自建确认弹窗，替代 `Modal.confirm()` / `window.confirm`。

**Props**

| 名称 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `visible` | `boolean` | — | 是否可见 |
| `title` | `string` | — | 确认弹窗标题 |
| `content` | `string` | — | 确认描述内容 |
| `type` | `'info' \| 'warning' \| 'danger'` | `'info'` | 类型（联动图标色 + 按钮色） |
| `okText` | `string` | `确定` | 确定按钮文本 |
| `cancelText` | `string` | `取消` | 取消按钮文本 |
| `loading` | `boolean` | `false` | 确定按钮 loading |

**Emits**

| 名称 | 参数 | 说明 |
|------|------|------|
| `update:visible` | `(v: boolean)` | 关闭弹窗 |
| `ok` | — | 点击确定 |
| `cancel` | — | 点击取消 / 遮罩 |

---

## 内部子组件

| 组件 | 说明 |
|------|------|
| `KoruNodeRenderer` | 节点渲染器 |
| `KoruEdgeRenderer` | 连线渲染器 |
| `KoruLogoName` | Logo + 名称展示 |
| `KoruSavePanel` | 保存面板（KoruToolbar 子面板） |
