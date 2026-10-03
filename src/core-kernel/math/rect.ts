import type { KoruPoint, KoruRect, KoruSize } from '../types'

/** 创建矩形 */
export function createRect(x: number, y: number, width: number, height: number): KoruRect {
  return { x, y, width, height }
}

/** 矩形是否包含点 */
export function rectContainsPoint(rect: KoruRect, point: KoruPoint): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

/** 矩形交集 */
export function rectIntersect(a: KoruRect, b: KoruRect): KoruRect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const w = Math.min(a.x + a.width, b.x + b.width) - x
  const h = Math.min(a.y + a.height, b.y + b.height) - y
  if (w <= 0 || h <= 0) return null
  return { x, y, width: w, height: h }
}

/** 矩形合并 */
export function rectUnion(a: KoruRect, b: KoruRect): KoruRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.max(a.x + a.width, b.x + b.width) - x
  const h = Math.max(a.y + a.height, b.y + b.height) - y
  return { x, y, width: w, height: h }
}

/** 从点列表计算边界矩形 */
export function boundingRect(points: KoruPoint[]): KoruRect | null {
  if (points.length === 0) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** 矩形转尺寸 */
export function rectToSize(rect: KoruRect): KoruSize {
  return { width: rect.width, height: rect.height }
}
