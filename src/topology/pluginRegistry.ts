/**
 * 插件生命周期注册中心
 *
 * 解决的问题：
 *   Vue 插件 install() 时，X6 Graph 还没创建（KoruGraphEditor 还没挂载）。
 *   插件想拿 graph 实例、往 Stencil 加 shape、注册右键菜单项，都得等 editor ready。
 *
 * 用法（插件内）：
 *   import { registerPluginHooks } from '@mollu/koru/topology'
 *   registerPluginHooks({
 *     onReady: ({ graph, store }) => { ... },
 *   })
 *
 * 触发时机（主包内部）：
 *   KoruGraphEditor emit('ready', api) 之后，遍历所有已注册的 hooks.onReady
 */

import type { Graph } from '@antv/x6'

/**
 * 故意用 interface 而不是 import CanvasStore——避免循环依赖。
 * 字段只要跟 canvasStore.ts 的 CanvasStore 接口兼容就行。
 */
export interface PluginContext {
  /** X6 Graph 实例 */
  graph: Graph
  /** CanvasStore 实例（结构兼容即可） */
  store: any
}

export interface PluginHooks {
  onReady?: (ctx: PluginContext) => void
  onDestroy?: (ctx: PluginContext) => void
  name?: string
}

const registry: PluginHooks[] = []

export function registerPluginHooks(hooks: PluginHooks): void {
  registry.push(hooks)
  console.log(
    `[Koru PluginRegistry] registered: ${hooks.name ?? '(anonymous)'} — ` +
      `${registry.length} plugin(s) waiting for editor ready`,
  )
}

/** 主包内部：editor ready 后触发所有 onReady */
export function _firePluginReady(ctx: PluginContext): void {
  if (registry.length === 0) return
  console.log(`[Koru PluginRegistry] firing onReady for ${registry.length} plugin(s)`)
  for (const hooks of registry) {
    try {
      hooks.onReady?.({ ...ctx })
    } catch (err) {
      console.error(`[Koru PluginRegistry] ${hooks.name ?? '(anonymous)'} onReady error:`, err)
    }
  }
}

/** 主包内部：editor 销毁时触发所有 onDestroy */
export function _firePluginDestroy(ctx: PluginContext): void {
  if (registry.length === 0) return
  for (const hooks of registry) {
    try {
      hooks.onDestroy?.({ ...ctx })
    } catch (err) {
      console.error(`[Koru PluginRegistry] ${hooks.name ?? '(anonymous)'} onDestroy error:`, err)
    }
  }
}

/** 调试用 */
export function _listRegisteredPlugins(): string[] {
  return registry.map((h) => h.name ?? '(anonymous)')
}
