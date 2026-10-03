import { KoruEvent, type KoruEventHandler } from './types'

/**
 * 全局事件总线
 * 内核级事件发布/订阅，供所有模块复用
 */
export class KoruEventBus {
  private _handlers: Map<string, Set<KoruEventHandler>> = new Map()

  /** 订阅事件 */
  on(event: KoruEvent | string, handler: KoruEventHandler): void {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set())
    }
    this._handlers.get(event)!.add(handler)
  }

  /** 取消订阅 */
  off(event: KoruEvent | string, handler: KoruEventHandler): void {
    this._handlers.get(event)?.delete(handler)
  }

  /** 触发事件 */
  emit(event: KoruEvent | string, ...args: any[]): void {
    this._handlers.get(event)?.forEach((handler) => {
      try {
        handler(...args)
      } catch (e) {
        console.error(`[KoruEventBus] Error in handler for "${event}":`, e)
      }
    })
  }

  /** 一次性订阅 */
  once(event: KoruEvent | string, handler: KoruEventHandler): void {
    const wrapper = (...args: any[]) => {
      handler(...args)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }

  /** 清除所有订阅 */
  clear(): void {
    this._handlers.clear()
  }

  /** 获取某事件订阅数量 */
  listenerCount(event: KoruEvent | string): number {
    return this._handlers.get(event)?.size ?? 0
  }
}
