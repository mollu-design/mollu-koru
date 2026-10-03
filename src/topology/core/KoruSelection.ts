import { KoruEvent } from '../../core-kernel/types'
import { KoruEventBus } from '../../core-kernel/event-bus'

/**
 * 选区管理器
 * 管理节点选中状态，支持单选/多选/框选
 */
export class KoruSelection {
  private _selected: Set<string> = new Set()
  private _eventBus: KoruEventBus

  constructor(eventBus: KoruEventBus) {
    this._eventBus = eventBus
  }

  /** 选中节点 */
  select(id: string, additive: boolean = false): void {
    if (!additive) {
      this._selected.clear()
    }
    this._selected.add(id)
    this._notify()
  }

  /** 批量选中 */
  selectAll(ids: string[]): void {
    this._selected.clear()
    ids.forEach((id) => this._selected.add(id))
    this._notify()
  }

  /** 取消选中 */
  deselect(id: string): void {
    this._selected.delete(id)
    this._notify()
  }

  /** 清空选区 */
  clear(): void {
    this._selected.clear()
    this._notify()
  }

  /** 是否选中 */
  isSelected(id: string): boolean {
    return this._selected.has(id)
  }

  /** 获取选中节点 ID 列表 */
  get selected(): string[] {
    return Array.from(this._selected)
  }

  /** 选中数量 */
  get count(): number {
    return this._selected.size
  }

  /** 是否为空 */
  get isEmpty(): boolean {
    return this._selected.size === 0
  }

  /** 切换选中状态 */
  toggle(id: string): void {
    if (this._selected.has(id)) {
      this._selected.delete(id)
    } else {
      this._selected.add(id)
    }
    this._notify()
  }

  private _notify(): void {
    this._eventBus.emit(KoruEvent.SELECTION_CHANGED, this.selected)
  }
}
