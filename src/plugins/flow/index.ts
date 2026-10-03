/**
 * @mollu/koru/plugins/flow 流程图插件
 *
 * 提供流程图专用的节点形状、连线类型、布局算法等扩展能力。
 * 依赖 topology 主包的 registerNodeModule + registerPluginHooks。
 *
 * 使用：
 *   app.use(KoruTopologyPlugin)   // 先装主插件
 *   app.use(FlowPlugin)           // 再装 Flow 插件
 *
 *   editor ready 后，6 个流程节点 shape 自动注册到 X6 Graph，
 *   Stencil 自动出现「流程图」分组。
 */

import type { App } from 'vue'
import { registerPluginHooks, registerNodeModule, setComponentConfig } from '../../topology'
import type { NodeConfig } from '@antv/x6'

/** 流程图节点 shape 名称常量 */
export const FlowNodeShapes = {
  START: 'flow-start',
  END: 'flow-end',
  PROCESS: 'flow-process',
  DECISION: 'flow-decision',
  SUBPROCESS: 'flow-subprocess',
  DOCUMENT: 'flow-document',
} as const

/** 流程图配置 */
export interface FlowPluginOptions {
  /** 是否启用自动布局（dagre）——待实现 */
  autoLayout?: boolean
  /** 是否启用泳道——待实现 */
  swimlane?: boolean
}

// ── 6 个流程节点的 X6 NodeConfig ────────────────────────

const COMMON_PORTS = {
  groups: {
    top: { position: 'top', attrs: { circle: { r: 4, magnet: true, fill: '#fff', stroke: '#333' } } },
    bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, fill: '#fff', stroke: '#333' } } },
    left: { position: 'left', attrs: { circle: { r: 4, magnet: true, fill: '#fff', stroke: '#333' } } },
    right: { position: 'right', attrs: { circle: { r: 4, magnet: true, fill: '#fff', stroke: '#333' } } },
  },
  items: [
    { id: 'p-top', group: 'top' },
    { id: 'p-bottom', group: 'bottom' },
    { id: 'p-left', group: 'left' },
    { id: 'p-right', group: 'right' },
  ],
}

const FLOW_NODES: Record<string, NodeConfig> = {
  [FlowNodeShapes.START]: {
    width: 100,
    height: 40,
    markup: [
      { tagName: 'ellipse', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: { cx: 50, cy: 20, rx: 50, ry: 20, fill: '#e8ffea', stroke: '#00b42a', strokeWidth: 2 },
      label: { text: '开始', fontSize: 13, fontWeight: 'bold', fill: '#00b42a', refX: '50%', refY: '50%', textAnchor: 'middle' },
    },
    ports: COMMON_PORTS,
    data: { flowRole: 'start' },
  },

  [FlowNodeShapes.END]: {
    width: 100,
    height: 40,
    markup: [
      { tagName: 'ellipse', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: { cx: 50, cy: 20, rx: 50, ry: 20, fill: '#ffece8', stroke: '#f53f3f', strokeWidth: 2 },
      label: { text: '结束', fontSize: 13, fontWeight: 'bold', fill: '#f53f3f', refX: '50%', refY: '50%', textAnchor: 'middle' },
    },
    ports: COMMON_PORTS,
    data: { flowRole: 'end' },
  },

  [FlowNodeShapes.PROCESS]: {
    width: 120,
    height: 60,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: { x: 0, y: 0, width: 120, height: 60, rx: 4, ry: 4, fill: '#e8f3ff', stroke: '#165dff', strokeWidth: 2 },
      label: { text: '任务', fontSize: 13, fill: '#1d2129', refX: '50%', refY: '50%', textAnchor: 'middle' },
    },
    ports: COMMON_PORTS,
    data: { flowRole: 'process' },
  },

  [FlowNodeShapes.DECISION]: {
    width: 100,
    height: 80,
    markup: [
      { tagName: 'polygon', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        points: '50,0 100,40 50,80 0,40',
        fill: '#fff7e8',
        stroke: '#ff7d00',
        strokeWidth: 2,
      },
      label: { text: '判断', fontSize: 12, fill: '#1d2129', refX: '50%', refY: '50%', textAnchor: 'middle' },
    },
    ports: COMMON_PORTS,
    data: { flowRole: 'decision' },
  },

  [FlowNodeShapes.SUBPROCESS]: {
    width: 120,
    height: 60,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'boundary-left' },
      { tagName: 'rect', selector: 'boundary-right' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: { x: 0, y: 0, width: 120, height: 60, fill: '#f5e8ff', stroke: '#722ed1', strokeWidth: 2 },
      'boundary-left': { x: 8, y: 8, width: 8, height: 44, fill: 'none', stroke: '#722ed1', strokeWidth: 2 },
      'boundary-right': { x: 104, y: 8, width: 8, height: 44, fill: 'none', stroke: '#722ed1', strokeWidth: 2 },
      label: { text: '子流程', fontSize: 12, fill: '#1d2129', refX: '50%', refY: '50%', textAnchor: 'middle' },
    },
    ports: COMMON_PORTS,
    data: { flowRole: 'subprocess' },
  },

  [FlowNodeShapes.DOCUMENT]: {
    width: 100,
    height: 80,
    markup: [
      { tagName: 'path', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        d: 'M10,0 L80,0 L100,20 L100,80 L10,80 Z',
        fill: '#e8f7ff',
        stroke: '#0fc6c2',
        strokeWidth: 2,
      },
      label: { text: '文档', fontSize: 12, fill: '#1d2129', refX: '45%', refY: '55%', textAnchor: 'middle' },
    },
    ports: COMMON_PORTS,
    data: { flowRole: 'document' },
  },
}

// ── 插件注册 ────────────────────────────────────────────

/**
 * 注册流程图的 6 个节点 shape + Stencil 分组。
 * 必须在 editor ready 后执行——这时 setComponentConfig 才能正确合并分组。
 */
function registerFlowShapes(): void {
  // 1. 注册到 X6 Graph（全局静态注册，任何 graph 实例都能识别）
  for (const [shapeName, config] of Object.entries(FLOW_NODES)) {
    registerNodeModule(shapeName, config, true)
    console.log(`[Koru FlowPlugin] registered node: ${shapeName}`)
  }

  // 2. 往 Stencil 加一个「流程图」分组（追加到末尾，不覆盖默认分组）
  setComponentConfig({
    stencilGroups: [
      {
        name: 'flow',
        label: '🔀 流程图',
        layoutOptions: { columns: 2, columnWidth: 140, rowHeight: 100 },
        graphHeight: 260,
        items: Object.entries(FLOW_NODES).map(([shape, cfg]) => ({
          shape,
          label: (cfg.attrs?.label as any)?.text ?? shape,
          width: cfg.width,
          height: cfg.height,
        })),
      },
    ],
  })
}

/** 流程图插件 Vue 插件壳 */
export const FlowPlugin = {
  install(app: App, options?: FlowPluginOptions): void {
    console.log('[Koru FlowPlugin] installing...', options)

    // 注册生命周期钩子——等 editor ready 后再做实际初始化
    registerPluginHooks({
      name: 'FlowPlugin',
      onReady() {
        registerFlowShapes()
      },
      onDestroy() {
        console.log('[Koru FlowPlugin] onDestroy')
      },
    })
  },
}

export default FlowPlugin
