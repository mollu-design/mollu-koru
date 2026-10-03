import type { KoruPoint } from '../types'

/** 两点间距离 */
export function distance(a: KoruPoint, b: KoruPoint): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

/** 两点间向量 */
export function vector(from: KoruPoint, to: KoruPoint): KoruPoint {
  return { x: to.x - from.x, y: to.y - from.y }
}

/** 点加法 */
export function add(a: KoruPoint, b: KoruPoint): KoruPoint {
  return { x: a.x + b.x, y: a.y + b.y }
}

/** 点减法 */
export function sub(a: KoruPoint, b: KoruPoint): KoruPoint {
  return { x: a.x - b.x, y: a.y - b.y }
}

/** 点缩放 */
export function scale(p: KoruPoint, s: number): KoruPoint {
  return { x: p.x * s, y: p.y * s }
}
