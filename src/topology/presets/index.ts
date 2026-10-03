import type { KoruNodeData, KoruEdgeData } from '../types'

let _uidCounter = 0

/**
 * 生成唯一 ID
 */
export function uid(prefix = 'cell'): string {
  return `${prefix}_${Date.now()}_${++_uidCounter}`
}

/**
 * 创建默认矩形节点
 */
export function createDefaultNode(data?: Partial<KoruNodeData>): KoruNodeData {
  return {
    id: uid('node'),
    shape: 'custom-rect',
    x: 160,
    y: 120,
    width: 66,
    height: 36,
    label: '矩形',
    attrs: {},
    ...data,
  }
}

/**
 * 创建默认圆形节点
 */
export function createDefaultCircleNode(data?: Partial<KoruNodeData>): KoruNodeData {
  return {
    id: uid('node'),
    shape: 'custom-circle',
    x: 240,
    y: 200,
    width: 45,
    height: 45,
    label: '圆形',
    attrs: {},
    ...data,
  }
}

/**
 * 创建默认文本节点
 */
export function createDefaultTextNode(data?: Partial<KoruNodeData>): KoruNodeData {
  return {
    id: uid('node'),
    shape: 'custom-text',
    x: 160,
    y: 120,
    width: 100,
    height: 30,
    label: '文本',
    attrs: {},
    ...data,
  }
}

/**
 * 创建默认按钮节点
 */
export function createDefaultButtonNode(data?: Partial<KoruNodeData>): KoruNodeData {
  return {
    id: uid('node'),
    shape: 'custom-button',
    x: 160,
    y: 120,
    width: 80,
    height: 32,
    label: '按钮',
    attrs: {},
    ...data,
  }
}

/**
 * 创建默认连线
 */
export function createDefaultEdge(data?: Partial<KoruEdgeData>): KoruEdgeData {
  return {
    id: uid('edge'),
    source: '',
    target: '',
    label: '',
    attrs: {
      line: {
        stroke: '#A2B1C3',
        strokeWidth: 2,
        targetMarker: { name: 'block', width: 12, height: 8 },
      },
    },
    ...data,
  }
}

export { ports } from './ports'
export { registerBasicShapes } from './registerBasicShapes'
export { DEFAULT_STENCIL_GROUPS } from './defaultStencilGroups'
export {
  registerSvgNode,
  sanitizeSvgForX6,
  mountSvgDefs,
  createSvgPreviewNode,
  createLocalImagePreviewNodes,
  ports as svgPorts,
  getRegisteredDefs,
  getRegisteredShapes,
} from './registerSvgNodes'
export type { CustomShapeItem } from './registerSvgNodes'
export { registerSvgGlob } from './registerSvgGlob'
export type { RegisterSvgGlobOptions } from './registerSvgGlob'
export {
  registerNodeModule,
  registerNodeModules,
  registerEdgeModule,
  registerEdgeModules,
  registerModules,
} from './registerNodeModule'
