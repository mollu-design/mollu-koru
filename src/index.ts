/**
 * @mollu/koru 根入口
 *
 * 对外暴露核心内核类型和工具，不包含业务模块。
 * 业务模块请从子模块路径导入：
 *   - @mollu/koru/topology
 *   - @mollu/koru/plugins/flow
 */

// 核心内核
export { KoruEventBus } from './core-kernel/event-bus'
export { KoruEvent } from './core-kernel/types'
export type {
  KoruPoint,
  KoruSize,
  KoruRect,
  KoruTransform,
  KoruZoomLevel,
  KoruEventHandler,
} from './core-kernel/types'

// 几何工具
export { distance, vector, add, sub, scale } from './core-kernel/math/point'
export {
  createRect,
  rectContainsPoint,
  rectIntersect,
  rectUnion,
  boundingRect,
  rectToSize,
} from './core-kernel/math/rect'
export {
  identityTransform,
  applyTransform,
  multiplyTransform,
  translateTransform,
  scaleTransform,
} from './core-kernel/math/transform'

// 渲染抽象层
export type { KoruRenderer } from './core-kernel/renderer'
