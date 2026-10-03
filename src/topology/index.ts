/**
 * @mollu/koru/topology 子模块入口
 *
 * 仅对外暴露公开 API，内部工具函数通过深路径按需引入。
 */

// ── 组件 ──────────────────────────────────────────────
export {
  KoruGraphEditor,
  KoruToolbar,
  KoruMinimap,
  KoruContextMenu,
  KoruPropertyPanel,
  KoruStencil,
  KoruNodeRenderer,
  KoruEdgeRenderer,
  KoruLogoName,
  KoruModal,
  KoruConfirmDialog,
  KoruGallery,
  KoruTemplate,
  KoruCanvasPropertyPanel,
  KoruPreview,
  KoruMultiStateEditorModal,
} from './components'
export type { GalleryResourceItem, TemplateItem } from './components'

// ── 类型 ──────────────────────────────────────────────
export type {
  KoruGraphEditorMode,
  KoruGraphEditorOptions,
  KoruGraphEditorInstance,
  KoruGraphData,
  KoruNodeData,
  KoruEdgeData,
  KoruPortData,
  KoruNodeEvent,
  KoruEdgeEvent,
  KoruStencilNodeItem,
  KoruStencilGroup,
  KoruCanvasBackground,
  KoruCanvasGrid,
  KoruCanvasMousewheel,
  KoruCanvasPanning,
  KoruCanvasSnapline,
  KoruCanvasTranslating,
  KoruCanvasScroller,
  KoruCanvasConfig,
  KoruCanvasConfigStorage,
} from './types'

// ── 常量 ──────────────────────────────────────────────
export {
  KORU_DEFAULT_OPTIONS,
  defaultKoruCanvasConfig,
  deserializeKoruCanvasConfig,
  serializeKoruCanvasConfig,
} from './types'

// ── 核心 ──────────────────────────────────────────────
export { KoruEvent } from '../core-kernel'
export { KoruGraph, KoruSelection } from './core'

// ── Composables ───────────────────────────────────────
export {
  useKoruGraphEditor,
  useZoom,
  useNodeDrag,
  useSelection,
  useClipboard,
  useUndoRedo,
  useContextMenu,
  applyKoruCanvasConfig,
  koruCanvasConfigToGraphOptions,
  useCanvasPersistence,
  createIndexedDBAdapter,
  useBindingRegistry,
  // 绑定注册表工具函数（demo + 文档示例需要）
  collectBindingRegistry,
  flattenBindingData,
  buildFetchData,
  extractBindingKeys,
} from './composables'
export type {
  UseCanvasPersistenceOptions,
  PersistenceStorageAdapter,
  PersistenceData,
  BindingRegistryItem,
  BindingRegistryEntry,
  FlatBindingData,
  GroupedBindingDataItem,
  ContextMenuStateData,
  ContextMenuDeps,
} from './composables'

// ── 预设（节点/连线工厂 + 模块注册） ──────────────────
export {
  createDefaultNode,
  createDefaultCircleNode,
  createDefaultTextNode,
  createDefaultButtonNode,
  createDefaultEdge,
  registerBasicShapes,
  registerSvgNode,
  registerSvgGlob,  // 🆕 一行搞定批量 SVG 注册（接受 import.meta.glob 结果）
  getRegisteredDefs,  // 🆕 获取已注册 shape 的所有 defs（业务侧 mountAllDefs 用）
  getRegisteredShapes,  // 🆕 获取已注册的 CustomShapeItem[]（带 shapeName / defs / vbWidth 等）
  mountSvgDefs,  // 应用层给每个 graph 实例挂 SVG defs
  // SVG 预览节点工厂（demo 需要）
  createSvgPreviewNode,
  // 默认 Stencil 分组（供消费方扩展或参考）
  DEFAULT_STENCIL_GROUPS,
  // 通用模块注册（外部注册完整节点/连线模块）
  registerNodeModule,
  registerNodeModules,
  registerEdgeModule,
  registerEdgeModules,
  registerModules,
} from './presets'
export type { CustomShapeItem } from './presets'

// ── 工具函数（demo + 文档示例需要） ────────────────────
export { uid, dbGet, dbSet, dbRemove } from './utils'

// ── Stores ────────────────────────────────────────────
export {
  useCanvasStore,
  setMultiStateConfig,
  resetMultiStateConfig,
  setBindingConfig,
  resetBindingConfig,
  setDeviceConfig,
  resetDeviceConfig,
  setComponentConfig,
  resetComponentConfig,
} from './stores'
export type { MultiStateConfig, BindingConfig, DeviceConfig, ComponentConfig } from './stores'

// ── 插件 ──────────────────────────────────────────────
export { KoruTopologyPlugin, KoruTopologyPlugin as defaultPlugin } from './plugin'

// ── 插件生命周期注册中心 ────────────────────────────────
export { registerPluginHooks } from './pluginRegistry'
export type { PluginHooks } from './pluginRegistry'
