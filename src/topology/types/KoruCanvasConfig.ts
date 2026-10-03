/**
 * 画布配置类型定义 —— 与 webtopo CanvasConfigTypes 一致，组件化版本。
 *
 * 分类：
 *  - 外观（必存）：background
 *  - 网格（必存）：grid.visible, grid.size
 *  - 高级（选存，仅用户修改后写入）：grid.type, grid.color, mousewheel, panning, snapline, translating, scroller
 */

export interface KoruCanvasBackground {
  color: string
  /** 背景图片 dataUrl 或 URL */
  image: string
}

export interface KoruCanvasGrid {
  visible: boolean
  size: number
  /** 网格类型，默认 mesh */
  type?: 'mesh' | 'dot'
  /** 网格颜色，默认 #cccccc */
  color?: string
}

export interface KoruCanvasMousewheel {
  enabled: boolean
  /** 缩放修饰键，默认 ctrl */
  modifiers?: 'ctrl' | 'none'
}

export interface KoruCanvasPanning {
  enabled: boolean
  /** 平移修饰键，默认 alt */
  modifiers?: 'alt' | 'none'
}

export interface KoruCanvasSnapline {
  /** 对齐辅助线，仅编辑模式生效 */
  enabled: boolean
}

export interface KoruCanvasTranslating {
  /** 限制节点移出画布，仅编辑模式生效 */
  restrict: boolean
}

export interface KoruCanvasScroller {
  /** 无限滚动画布 */
  enabled: boolean
}

/** 画布配置（完整结构，含高级项默认值） */
export interface KoruCanvasConfig {
  /** 画布逻辑宽度，导出图片尺寸以此为准 */
  width: number
  /** 画布逻辑高度 */
  height: number
  /** 背景色/背景图 */
  background: KoruCanvasBackground
  /** 网格配置 */
  grid: KoruCanvasGrid
  // ---- 以下为高级配置，用户修改后才序列化 ----
  /** 滚轮缩放 */
  mousewheel?: KoruCanvasMousewheel
  /** 最小缩放 */
  minScale?: number
  /** 最大缩放 */
  maxScale?: number
  /** 画布平移拖拽 */
  panning?: KoruCanvasPanning
  /** 对齐辅助线（仅编辑） */
  snapline?: KoruCanvasSnapline
  /** 限制节点移出画布（仅编辑） */
  translating?: KoruCanvasTranslating
  /** 无限滚动画布 */
  scroller?: KoruCanvasScroller
}

/** 序列化到 JSON 的最小结构（仅核心字段，高级项存异） */
export interface KoruCanvasConfigStorage {
  background: { color: string; image: string }
  grid: { visible: boolean; size: number }
  // 高级项：仅当用户修改后才写入，保持 JSON 轻量
  gridType?: 'mesh' | 'dot'
  gridColor?: string
  mousewheelEnabled?: boolean
  mousewheelModifiers?: 'ctrl' | 'none'
  minScale?: number
  maxScale?: number
  panningEnabled?: boolean
  panningModifiers?: 'alt' | 'none'
  snaplineEnabled?: boolean
  translatingRestrict?: boolean
  scrollerEnabled?: boolean
}

/** 默认画布配置 */
export const defaultKoruCanvasConfig = (): KoruCanvasConfig => ({
  width: 1200,
  height: 800,
  background: { color: '#ffffff', image: '' },
  grid: { visible: true, size: 20 },
  mousewheel: { enabled: true, modifiers: 'ctrl' },
  minScale: 0.5,
  maxScale: 3,
  panning: { enabled: true, modifiers: 'alt' },
  snapline: { enabled: true },
  translating: { restrict: false },
  scroller: { enabled: false },
})

/**
 * 从存储格式反序列化为完整 KoruCanvasConfig。
 * 缺失字段用默认值填充。
 */
export const deserializeKoruCanvasConfig = (
  storage: KoruCanvasConfigStorage | null | undefined,
): KoruCanvasConfig => {
  const def = defaultKoruCanvasConfig()
  if (!storage) return { ...def }
  return {
    width: def.width,
    height: def.height,
    background: {
      color: storage.background?.color ?? def.background.color,
      image: storage.background?.image ?? def.background.image,
    },
    grid: {
      visible: storage.grid?.visible ?? def.grid.visible,
      size: storage.grid?.size ?? def.grid.size,
      type: storage.gridType ?? def.grid.type,
      color: storage.gridColor ?? def.grid.color,
    },
    mousewheel: {
      enabled: storage.mousewheelEnabled ?? def.mousewheel!.enabled,
      modifiers: storage.mousewheelModifiers ?? def.mousewheel!.modifiers,
    },
    minScale: storage.minScale ?? def.minScale,
    maxScale: storage.maxScale ?? def.maxScale,
    panning: {
      enabled: storage.panningEnabled ?? def.panning!.enabled,
      modifiers: storage.panningModifiers ?? def.panning!.modifiers,
    },
    snapline: {
      enabled: storage.snaplineEnabled ?? def.snapline!.enabled,
    },
    translating: {
      restrict: storage.translatingRestrict ?? def.translating!.restrict,
    },
    scroller: {
      enabled: storage.scrollerEnabled ?? def.scroller!.enabled,
    },
  }
}

/**
 * 序列化为最小存储结构（仅核心字段 + 高级项异于默认才写入）。
 */
export const serializeKoruCanvasConfig = (config: KoruCanvasConfig): KoruCanvasConfigStorage => {
  const def = defaultKoruCanvasConfig()
  const result: KoruCanvasConfigStorage = {
    background: { ...config.background },
    grid: { visible: config.grid.visible, size: config.grid.size },
  }
  // 高级项：仅当异于默认值才写入
  if (config.grid.type !== def.grid.type) result.gridType = config.grid.type
  if (config.grid.color !== def.grid.color) result.gridColor = config.grid.color
  if (config.mousewheel!.enabled !== def.mousewheel!.enabled)
    result.mousewheelEnabled = config.mousewheel!.enabled
  if (config.mousewheel!.modifiers !== def.mousewheel!.modifiers)
    result.mousewheelModifiers = config.mousewheel!.modifiers
  if (config.minScale !== def.minScale) result.minScale = config.minScale
  if (config.maxScale !== def.maxScale) result.maxScale = config.maxScale
  if (config.panning!.enabled !== def.panning!.enabled)
    result.panningEnabled = config.panning!.enabled
  if (config.panning!.modifiers !== def.panning!.modifiers)
    result.panningModifiers = config.panning!.modifiers
  if (config.snapline!.enabled !== def.snapline!.enabled)
    result.snaplineEnabled = config.snapline!.enabled
  if (config.translating!.restrict !== def.translating!.restrict)
    result.translatingRestrict = config.translating!.restrict
  if (config.scroller!.enabled !== def.scroller!.enabled)
    result.scrollerEnabled = config.scroller!.enabled
  return result
}
