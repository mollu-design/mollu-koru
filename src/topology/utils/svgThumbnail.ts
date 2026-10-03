/**
 * SVG / 节点缩略图生成（纯 TS，框架无关）。
 */

/** 将 SVG 源码转为 dataURL 缩略图（currentColor 兜底为黑色，确保可见） */
export function svgToDataUrl(svg: string): string {
  const withColor = svg.replace(/currentColor/g, '#000000')
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withColor)}`
}

/** 兼容 X6 Node 的最小接口（避免依赖 @antv/x6 类型） */
export interface ThumbnailNodeLike {
  getSize: () => { width: number; height: number }
  attr: (path: string) => any
  shape: string
  label?: { text?: string }
}

/** 根据节点形状生成简单的 SVG 缩略图（不依赖 toDataURLAsync，稳定可靠） */
export function nodeToSvgThumbnail(node: ThumbnailNodeLike): string {
  const w = node.getSize().width
  const h = node.getSize().height
  const pad = 2
  const sw = Math.max(10, w + pad * 2)
  const sh = Math.max(10, h + pad * 2)
  const shape = node.shape
  const label = node.attr('label/text') || node.attr('text/text') || node.label?.text || ''

  let content = ''
  if (shape.includes('circle') || shape.includes('ellipse')) {
    content = `<ellipse cx="${sw / 2}" cy="${sh / 2}" rx="${sw / 2 - pad}" ry="${sh / 2 - pad}" fill="#5F95FF" fill-opacity="0.15" stroke="#5F95FF" stroke-width="1.5"/>`
  } else if (shape.includes('polygon')) {
    content = `<polygon points="${sw / 2},${pad} ${sw - pad},${sh / 2} ${sw / 2},${sh - pad} ${pad},${sh / 2}" fill="#5F95FF" fill-opacity="0.15" stroke="#5F95FF" stroke-width="1.5"/>`
  } else if (shape.includes('polyline')) {
    content = `<polyline points="${pad},${sh - pad} ${sw - pad},${pad}" fill="none" stroke="#5F95FF" stroke-width="1.5"/>`
  } else {
    const rx = sw / 2 < 6 ? sw / 2 : 6
    content = `<rect x="${pad}" y="${pad}" width="${sw - pad * 2}" height="${sh - pad * 2}" rx="${rx}" ry="${rx}" fill="#5F95FF" fill-opacity="0.15" stroke="#5F95FF" stroke-width="1.5"/>`
  }

  if (label) {
    content += `<text x="${sw / 2}" y="${sh / 2 + 4}" text-anchor="middle" font-size="10" fill="#1D2129" font-family="sans-serif">${label}</text>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}">${content}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
