/**
 * 渲染抽象层
 *
 * 定义渲染引擎接口，底层实现可替换为 SVG / Canvas / WebGL。
 * 当前为接口定义层，具体实现在 topology 模块中。
 */

export interface KoruRenderer {
  /** 初始化渲染器 */
  init(container: HTMLElement): void
  /** 渲染 */
  render(): void
  /** 清除 */
  clear(): void
  /** 销毁 */
  destroy(): void
  /** 获取容器元素 */
  getContainer(): HTMLElement | null
}
