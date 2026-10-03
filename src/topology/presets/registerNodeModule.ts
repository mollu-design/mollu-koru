/**
 * 通用模块注册 API
 *
 * 扩展 Koru 内置预设的简化版：允许外部传入完整的 X6 NodeConfig / EdgeConfig，
 * 一次性注册复杂模块（自定义 markup / attrs / ports / 尺寸 / 默认 data 等）。
 *
 * 与 registerSvgNode 的区别：
 *   registerSvgNode → 只注册 SVG 外观 + 默认 ports（简化版）
 *   registerNodeModule → 完整 X6 模块注册（markup + attrs + ports + size + data + 交互）
 *
 * 与 registerBasicShapes 的区别：
 *   registerBasicShapes → 注册 Koru 内置 basic 系列（固定：rect/circle/polygon/text-block/button）
 *   registerNodeModule → 任意外部模块（自由传入 config）
 *
 * 与直接调 X6 Graph.registerNode 的区别：
 *   无——本质就是透传。Koru 包只是统一导出，让使用者不需要同时 import @antv/x6。
 */

import { Graph } from '@antv/x6'
import type { NodeConfig, EdgeConfig } from '@antv/x6'

/**
 * 注册一个完整模块节点
 *
 * @param name  模块名（全局唯一，fromJSON 里 data.shape === name 时自动实例化）
 * @param config  X6 NodeConfig（markup / attrs / ports / width / height / data / ...）
 * @param overwrite 若已存在同名模块是否覆盖（默认 true）
 *
 * @example
 *   import { registerNodeModule } from '@mollu/koru/topology'
 *
 *   registerNodeModule('breaker-vacuum', {
 *     markup: [
 *       { tagName: 'rect', selector: 'body', attrs: { width: 60, height: 80 } },
 *       { tagName: 'path', selector: 'contact-top' },
 *       { tagName: 'path', selector: 'contact-bottom' },
 *       { tagName: 'text', selector: 'label', attrs: { text: 'QF' } },
 *     ],
 *     attrs: {
 *       body: { fill: '#fff', stroke: '#333', strokeWidth: 2 },
 *       'contact-top': { d: 'M20,30 L20,45', stroke: '#333' },
 *       'contact-bottom': { d: 'M20,55 L20,70', stroke: '#333' },
 *       label: { fontSize: 12, refX: '50%', refY: '100%' },
 *     },
 *     width: 60,
 *     height: 80,
 *     ports: {
 *       groups: {
 *         top: { position: 'top', attrs: { circle: { r: 4, magnet: true } } },
 *         bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true } } },
 *       },
 *       items: [
 *         { id: 'p-top', group: 'top' },
 *         { id: 'p-bottom', group: 'bottom' },
 *       ],
 *     },
 *     data: { deviceType: 'breaker', voltageLevel: 10 },
 *   })
 */
export function registerNodeModule(name: string, config: NodeConfig, overwrite = true): void {
  Graph.registerNode(name, config as any, overwrite)
}

/**
 * 批量注册模块节点
 *
 * @param modules  Array<{ name, config }>
 * @param overwrite 若已存在同名模块是否覆盖（默认 true）
 *
 * @example
 *   registerNodeModules([
 *     { name: 'breaker-vacuum', config: { ... } },
 *     { name: 'breaker-air', config: { ... } },
 *     { name: 'disconnector', config: { ... } },
 *   ])
 */
export function registerNodeModules(
  modules: Array<{ name: string; config: NodeConfig }>,
  overwrite = true,
): void {
  for (const m of modules) {
    registerNodeModule(m.name, m.config, overwrite)
  }
}

/**
 * 注册一个完整模块连线
 *
 * @param name  模块名（fromJSON 里 data.shape === name 时自动实例化）
 * @param config  X6 EdgeConfig
 * @param overwrite 若已存在同名模块是否覆盖（默认 true）
 *
 * @example
 *   registerEdgeModule('cable-xlpe', {
 *     markup: [
 *       { tagName: 'path', selector: 'line', attrs: { fill: 'none', stroke: '#ff6b00', strokeWidth: 3 } },
 *       { tagName: 'circle', selector: 'start-arrow', attrs: { r: 4, fill: '#ff6b00' } },
 *       { tagName: 'circle', selector: 'end-arrow', attrs: { r: 4, fill: '#ff6b00' } },
 *     ],
 *     router: { name: 'orth' },
 *     connector: { name: 'rounded', args: { radius: 8 } },
 *   })
 */
export function registerEdgeModule(name: string, config: EdgeConfig, overwrite = true): void {
  Graph.registerEdge(name, config as any, overwrite)
}

/**
 * 批量注册模块连线
 */
export function registerEdgeModules(
  modules: Array<{ name: string; config: EdgeConfig }>,
  overwrite = true,
): void {
  for (const m of modules) {
    registerEdgeModule(m.name, m.config, overwrite)
  }
}

/**
 * 注册完整模块集（节点 + 连线 + SVG 形状）
 *
 * 一站式注册入口——适合项目初始化时一次性注册所有自定义模块。
 *
 * @example
 *   registerModules({
 *     nodes: [
 *       { name: 'breaker-vacuum', config: { ... } },
 *       { name: 'transformer-2w', config: { ... } },
 *     ],
 *     edges: [
 *       { name: 'cable-xlpe', config: { ... } },
 *     ],
 *     svgs: [
 *       { label: '避雷器', svg: '<svg viewBox="0 0 100 100">...</svg>' },
 *     ],
 *   })
 */
export function registerModules(options: {
  nodes?: Array<{ name: string; config: NodeConfig }>
  edges?: Array<{ name: string; config: EdgeConfig }>
  svgs?: Array<{ label: string; svg: string }>
  overwrite?: boolean
}): void {
  const overwrite = options.overwrite ?? true
  if (options.nodes?.length) registerNodeModules(options.nodes, overwrite)
  if (options.edges?.length) registerEdgeModules(options.edges, overwrite)
  if (options.svgs?.length) {
    // registerSvgNode 是静态全局注册（Graph.registerNode），不依赖 graph 实例
    // mountSvgDefs 才需要 graph——等 graph 就绪后由应用层调 mountSvgDefs 挂 SVG defs
    console.warn('[Koru] registerModules: svgs 请用 registerSvgNode 逐个注册 + mountSvgDefs(graph, defs) 挂 defs')
  }
}
