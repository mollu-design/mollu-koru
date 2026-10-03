/**
 * 拓扑模块专属类型
 */

import type { KoruPoint, KoruSize, KoruEvent } from '../../core-kernel/types'

// ========== 画布模式 ==========

export type KoruGraphEditorMode = 'edit' | 'preview'

// ========== 画布配置 ==========

export interface KoruGraphEditorOptions {
  /** 画布模式 */
  mode: KoruGraphEditorMode
  /** 是否显示网格 */
  grid: boolean
  /** 网格大小 */
  gridSize?: number
  /** 缩放范围 */
  zoom: { min: number; max: number }
  /** 是否启用平移 */
  panning: boolean
  /** 是否启用鼠标滚轮缩放 */
  mouseWheel: boolean

  // 编辑模式细粒度权限
  /** 是否允许拖拽节点 */
  allowDragNode: boolean
  /** 是否允许创建连线 */
  allowCreateEdge: boolean
  /** 是否允许删除 */
  allowDelete: boolean
  /** 是否允许选中 */
  allowSelect: boolean
}

// ========== 图数据模型 ==========

export interface KoruPortData {
  id: string
  group?: string
  position?: KoruPoint
}

export interface KoruNodeData {
  id: string
  /** 节点类型标识 */
  shape: string
  /** 节点位置 */
  x: number
  y: number
  /** 节点尺寸 */
  width: number
  height: number
  /** 节点标签 */
  label?: string
  /** 节点样式 */
  attrs?: Record<string, any>
  /** 连接桩 */
  ports?: KoruPortData[]
  /** 自定义数据 */
  data?: Record<string, any>
}

export interface KoruEdgeData {
  id: string
  /** 源节点 ID */
  source: string
  /** 目标节点 ID */
  target: string
  /** 源连接桩 ID */
  sourcePort?: string
  /** 目标连接桩 ID */
  targetPort?: string
  /** 连线标签 */
  label?: string
  /** 连线样式 */
  attrs?: Record<string, any>
  /** 自定义数据 */
  data?: Record<string, any>
}

export interface KoruGraphData {
  nodes: KoruNodeData[]
  edges: KoruEdgeData[]
}

// ========== 实例类型 ==========

export interface KoruGraphEditorInstance {
  /** 视口控制 */
  zoomIn(): void
  zoomOut(): void
  resetView(): void
  fitView(): void
  setZoom(scale: number): void

  /** 图数据操作 */
  addNode(node: Partial<KoruNodeData>): string
  removeNode(nodeId: string): void
  updateNode(nodeId: string, data: Partial<KoruNodeData>): void
  addEdge(edge: Partial<KoruEdgeData>): string
  removeEdge(edgeId: string): void
  updateEdge(edgeId: string, data: Partial<KoruEdgeData>): void

  /** Cell 访问与细粒度属性操作 */
  getCell(cellId: string): any
  updateCellProp(cellId: string, key: string, value: any): void
  readCellProps(cellId: string): Record<string, any>
  updateSelectedCellsProp(key: string, value: any): void

  /** 选区 */
  selectNode(nodeId: string): void
  selectAll(): void
  clearSelection(): void
  readonly selection: string[]
  readonly canUndo: boolean
  readonly canRedo: boolean

  /** 撤销/重做/删除 */
  undo(): void
  redo(): void
  removeSelectedCells(): void

  /** 数据读写 */
  getGraphData(): KoruGraphData
  setGraphData(data: KoruGraphData): void
  /** Phase 1 新增：接收 X6 原生 JSON（{ cells, canvas }），统一灌入入口 */
  loadDiagram(data: { cells?: any[]; canvas?: any } | null | undefined): void
  exportJSON(): string

  /** 模式管理 */
  getMode(): KoruGraphEditorMode
  setMode(mode: KoruGraphEditorMode): void
  isEditMode(): boolean
  isPreviewMode(): boolean

  /** 获取底层 X6 Graph 实例 */
  getGraph(): any

  /** 事件订阅 */
  on(event: KoruEvent | string, handler: (...args: any[]) => void): void
  off(event: KoruEvent | string, handler: (...args: any[]) => void): void

  /** 绑定注册表采集：获取当前画布所有有绑定属性的图元清单（供后端订阅 WS 推送） */
  getBindingRegistry(): import('../composables/bindingTypes').BindingRegistryItem[]
}

// ========== 事件类型 ==========

export interface KoruNodeEvent {
  nodeId: string
  node: KoruNodeData
  originalEvent?: MouseEvent
}

export interface KoruEdgeEvent {
  edgeId: string
  edge: KoruEdgeData
  originalEvent?: MouseEvent
}

// ========== 画布配置类型 ==========

export type {
  KoruCanvasBackground,
  KoruCanvasGrid,
  KoruCanvasMousewheel,
  KoruCanvasPanning,
  KoruCanvasSnapline,
  KoruCanvasTranslating,
  KoruCanvasScroller,
  KoruCanvasConfig,
  KoruCanvasConfigStorage,
} from './KoruCanvasConfig'

export {
  defaultKoruCanvasConfig,
  deserializeKoruCanvasConfig,
  serializeKoruCanvasConfig,
} from './KoruCanvasConfig'

// ========== 默认常量 ==========

export const KORU_DEFAULT_OPTIONS: KoruGraphEditorOptions = {
  mode: 'edit',
  grid: true,
  gridSize: 20,
  zoom: { min: 0.1, max: 5 },
  panning: true,
  mouseWheel: true,
  allowDragNode: true,
  allowCreateEdge: true,
  allowDelete: true,
  allowSelect: true,
}

// ========== Stencil 类型 ==========

/** Stencil 分组中的单个节点项定义 */
export interface KoruStencilNodeItem {
  /** 节点形状名（对应 registerBasicShapes 注册的 shape） */
  shape: string
  /** 显示标签 */
  label: string
  /** 缩略图宽 */
  width?: number
  /** 缩略图高 */
  height?: number
  /** 额外属性（覆盖默认 attrs） */
  attrs?: Record<string, any>
  /** 落点放大后的宽 */
  dropWidth?: number
  /** 落点放大后的高 */
  dropHeight?: number
  /** 自定义数据 */
  data?: Record<string, any>
}

/** Stencil 分组定义 */
export interface KoruStencilGroup {
  /** 分组名称 */
  name: string
  /** 分组显示标题 */
  label: string
  /** 分组内的节点项 */
  items: KoruStencilNodeItem[]
  /** 分组高度 */
  graphHeight?: number
  /** 布局选项 */
  layoutOptions?: {
    columns: number
    columnWidth: number
    rowHeight: number
    dx?: number
  }
  /** 分组是否折叠 */
  collapsed?: boolean
}
