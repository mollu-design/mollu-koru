/**
 * 批量注册 SVG 节点的便捷函数（一行搞定）
 *
 * 消费方用法：
 * ```ts
 * import { registerSvgGlob } from '@mollu/koru/topology'
 * const modules = import.meta.glob('/path/to/*.svg', { query: '?raw', eager: true })
 * registerSvgGlob(modules)
 * ```
 *
 * 比手动遍历少 4 行代码：自动从文件名提取 label、自动 setComponentConfig({ customShapes })
 */
import { registerSvgNode, type CustomShapeItem } from './registerSvgNodes'
import { setComponentConfig } from '../stores/canvasStore'

export interface RegisterSvgGlobOptions {
  /** 从路径中提取 label 的函数，默认从文件名去掉 .svg 后缀 */
  extractLabel?: (filePath: string) => string
  /** 是否自动调 setComponentConfig({ customShapes })，默认 true */
  setGlobalConfig?: boolean
}

/**
 * 批量注册 SVG 节点
 *
 * @param modules import.meta.glob 的返回值
 *   结构：Record<string, string> — key=文件路径, value=SVG 原始字符串
 * @param options 可选配置
 * @returns 注册后的 CustomShapeItem 数组（带 shapeName / defs / vbWidth 等清洗后数据）
 */
export function registerSvgGlob(
  modules: Record<string, string>,
  options: RegisterSvgGlobOptions = {},
): CustomShapeItem[] {
  const {
    extractLabel,
    setGlobalConfig = true,
  } = options

  // 默认从文件名提取 label：'/path/to/breaker-vacuum.svg' → 'breaker-vacuum'
  const defaultExtract = (filePath: string): string => {
    const match = filePath.match(/\/([^/]+)\.svg$/)
    return match ? match[1] : filePath
  }
  const labelFn = extractLabel || defaultExtract

  // 构建 CustomShapeItem[] 并批量注册
  const items: CustomShapeItem[] = Object.entries(modules).map(([filePath, svg]) => ({
    label: labelFn(filePath),
    svg: svg as string,
  }))

  items.forEach((item, index) => registerSvgNode(item, index))

  // 自动同步到全局配置（Stencil 通过此数据查找落点尺寸）
  if (setGlobalConfig) {
    setComponentConfig({ customShapes: items })
  }

  console.log(`[Koru] registerSvgGlob: 注册 ${items.length} 个 SVG shape`)
  return items
}
