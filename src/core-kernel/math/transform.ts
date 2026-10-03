import type { KoruPoint, KoruTransform } from '../types'

/** 创建单位矩阵 */
export function identityTransform(): KoruTransform {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

/** 应用变换到点 */
export function applyTransform(point: KoruPoint, t: KoruTransform): KoruPoint {
  return {
    x: point.x * t.a + point.y * t.c + t.e,
    y: point.x * t.b + point.y * t.d + t.f,
  }
}

/** 矩阵乘法 */
export function multiplyTransform(a: KoruTransform, b: KoruTransform): KoruTransform {
  return {
    a: a.a * b.a + a.b * b.c,
    b: a.a * b.b + a.b * b.d,
    c: a.c * b.a + a.d * b.c,
    d: a.c * b.b + a.d * b.d,
    e: a.e * b.a + a.f * b.c + b.e,
    f: a.e * b.b + a.f * b.d + b.f,
  }
}

/** 创建平移矩阵 */
export function translateTransform(dx: number, dy: number): KoruTransform {
  return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy }
}

/** 创建缩放矩阵 */
export function scaleTransform(sx: number, sy: number): KoruTransform {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }
}
