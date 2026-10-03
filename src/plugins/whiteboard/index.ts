/**
 * @mollu/koru/plugins/whiteboard 白板插件
 *
 * 提供白板模式专用的自由绘制、便签、画笔、标尺等扩展能力。
 * 仅依赖 core-kernel，不依赖 topology 业务层。
 */

import { KoruEventBus } from '../../core-kernel/event-bus'
import { KoruEvent } from '../../core-kernel/types'
import type { App } from 'vue'

/** 白板工具 */
export const WhiteboardTools = {
  SELECT: 'select',
  PEN: 'pen',
  TEXT: 'text',
  STICKY: 'sticky',
  ERASER: 'eraser',
  LASSO: 'lasso',
} as const

/** 白板插件配置 */
export interface WhiteboardPluginOptions {
  /** 默认工具 */
  defaultTool?: string
  /** 是否启用无限画布 */
  infiniteCanvas?: boolean
}

/** 白板插件注册 */
export const WhiteboardPlugin = {
  install(app: App, options?: WhiteboardPluginOptions): void {
    // 注册白板工具
    // 注册自由绘制能力
    // 注册便签/标尺等组件
    console.log('[Koru WhiteboardPlugin] installed', options)
  },
}

export default WhiteboardPlugin
