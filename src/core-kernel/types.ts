/**
 * 内核基础通用类型
 */

/** 坐标点 */
export interface KoruPoint {
  x: number
  y: number
}

/** 尺寸 */
export interface KoruSize {
  width: number
  height: number
}

/** 矩形区域 */
export interface KoruRect extends KoruPoint, KoruSize {}

/** 2D 变换矩阵 */
export interface KoruTransform {
  a: number // scale X
  b: number // skew Y
  c: number // skew X
  d: number // scale Y
  e: number // translate X
  f: number // translate Y
}

/** 视图缩放级别 */
export interface KoruZoomLevel {
  min: number
  max: number
  current: number
}

/** 全局事件类型 */
export enum KoruEvent {
  /** 视图事件 */
  VIEWPORT_CHANGED = 'viewport:changed',
  ZOOM_CHANGED = 'zoom:changed',
  PAN_CHANGED = 'pan:changed',

  /** 节点事件 */
  NODE_CLICK = 'node:click',
  NODE_DBLCLICK = 'node:dblclick',
  NODE_MOUSEDOWN = 'node:mousedown',
  NODE_MOUSEUP = 'node:mouseup',
  NODE_MOUSEOVER = 'node:mouseover',
  NODE_MOUSEOUT = 'node:mouseout',
  NODE_ADDED = 'node:added',
  NODE_REMOVED = 'node:removed',
  NODE_CHANGED = 'node:changed',
  NODE_DRAG_START = 'node:drag:start',
  NODE_DRAG = 'node:drag',
  NODE_DRAG_END = 'node:drag:end',
  NODE_RESIZING = 'node:resizing',
  NODE_RESIZED = 'node:resized',
  NODE_ROTATING = 'node:rotating',
  NODE_ROTATED = 'node:rotated',

  /** 连线事件 */
  EDGE_CLICK = 'edge:click',
  EDGE_DBLCLICK = 'edge:dblclick',
  EDGE_MOUSEOVER = 'edge:mouseover',
  EDGE_MOUSEOUT = 'edge:mouseout',
  EDGE_ADDED = 'edge:added',
  EDGE_REMOVED = 'edge:removed',
  EDGE_CHANGED = 'edge:changed',

  /** 选区事件 */
  SELECTION_CHANGED = 'selection:changed',
  SELECTION_CLEARED = 'selection:cleared',

  /** 模式事件 */
  MODE_CHANGED = 'mode:changed',

  /** 撤销/重做事件 */
  UNDO_CHANGED = 'undo:changed',

  /** 画布事件 */
  GRAPH_CHANGED = 'graph:changed',
  RENDERED = 'rendered',
  DESTROYED = 'destroyed',
}

/** 事件处理器 */
export type KoruEventHandler = (...args: any[]) => void
