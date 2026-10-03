/**
 * 画布配置应用 —— 将 KoruCanvasConfig 写入 X6 Graph 实例。
 *
 * 与 webtopo useCanvasConfig 一致，组件化版本。
 * 编辑模式：全部配置生效
 * 预览/运行模式：网格强制隐藏，snapline/translating 关闭，
 *               缩放/平移保留用户配置。
 *
 * ⚠️ 注意：X6 v3.1.7 API 说明：
 *  - drawBackground() 替代 setBackground()
 *  - drawGrid() / setGridSize() / showGrid() / hideGrid() 替代 setGrid()
 *  - enableMouseWheel() / disableMouseWheel() 替代 setMousewheel()
 *  - enablePanning() / disablePanning() 替代 setPanning()
 *  - 缩放范围、鼠标/平移修饰键：通过 graph.options 运行时修改
 */
import type { Graph } from '@antv/x6'
import type { KoruCanvasConfig } from '../types/KoruCanvasConfig'

/**
 * 将 canvasConfig 应用到 graph 实例（编辑模式）。
 * @param graph  X6 Graph 实例
 * @param config 画布配置
 * @param isPreview 是否预览模式，预览模式下网格强制隐藏、snapline/translating 关闭
 */
export const applyKoruCanvasConfig = (
  graph: Graph,
  config: KoruCanvasConfig,
  isPreview = false,
) => {
  // 1. 背景色/背景图
  try {
    graph.drawBackground({
      color: config.background.color,
      ...(config.background.image ? { image: config.background.image } : {}),
    })
  } catch {
    /* ignore */
  }

  // 2. 网格（预览模式强制隐藏）
  if (isPreview) {
    graph.hideGrid()
  } else {
    graph.setGridSize(config.grid.size)
    // 网格类型/颜色
    const gridOpts: Record<string, any> = {}
    if (config.grid.type) gridOpts.type = config.grid.type
    if (config.grid.color) gridOpts.args = { color: config.grid.color }
    if (Object.keys(gridOpts).length > 0) {
      try {
        graph.drawGrid(gridOpts)
      } catch {
        /* ignore */
      }
    }
    // 显示/隐藏
    if (config.grid.visible) {
      graph.showGrid()
    } else {
      graph.hideGrid()
    }
  }

  // 3. 滚轮缩放
  const mw = config.mousewheel
  if (mw) {
    if (mw.enabled) {
      graph.enableMouseWheel()
    } else {
      graph.disableMouseWheel()
    }
    // 修饰键：运行时修改 options
    try {
      ;(graph.options as any).mousewheel.modifiers =
        mw.modifiers === 'none' ? undefined : mw.modifiers
    } catch {
      /* ignore */
    }
  }

  // 4. 缩放范围（运行时修改 options）
  try {
    ;(graph.options as any).mousewheel.minScale = config.minScale ?? 0.5
    ;(graph.options as any).mousewheel.maxScale = config.maxScale ?? 3
    ;(graph.options as any).scaling.min = config.minScale ?? 0.5
    ;(graph.options as any).scaling.max = config.maxScale ?? 3
  } catch {
    /* ignore */
  }

  // 5. 画布平移
  const pan = config.panning
  if (pan) {
    if (pan.enabled) {
      graph.enablePanning()
    } else {
      graph.disablePanning()
    }
    // 修饰键：运行时修改 options
    try {
      ;(graph.options as any).panning.modifiers =
        pan.modifiers === 'none' ? undefined : pan.modifiers
    } catch {
      /* ignore */
    }
  }

  // 6. 对齐辅助线（仅编辑模式生效）
  const sn = config.snapline
  if (sn && !isPreview) {
    try {
      // X6 的 Snapline 插件通过 getPlugin 访问
      const plugin = (graph as any).getPlugin?.('snapline')
      if (plugin) {
        plugin.setEnabled(sn.enabled)
      }
    } catch {
      /* ignore */
    }
  }

  // 7. 限制节点移出画布（仅编辑模式）
  try {
    ;(graph.options as any).translating.restrict =
      !isPreview && config.translating ? config.translating.restrict : false
  } catch {
    /* ignore */
  }
}

/**
 * 获取图形配置兼容的 canvasConfig 子集（用于 createGraphInstance 初始化）。
 */
export const koruCanvasConfigToGraphOptions = (config: KoruCanvasConfig) => ({
  grid: config.grid.visible,
  minScale: config.minScale,
  maxScale: config.maxScale,
  panning: config.panning?.enabled,
  snapRadius: 20,
})
