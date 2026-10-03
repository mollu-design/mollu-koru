import { Graph } from '@antv/x6'
import type { Graph as GraphType } from '@antv/x6'

// ========== defs 自动收集（给 getRegisteredDefs 用） ==========
// 不管是 registerSvgGlob 还是手动 forEach registerSvgNode，
// 都会把每个 shape 的 defs 收集到这里，让业务侧 mountAllDefs 无需自己维护 getAllDefs()
const _collectedDefs: string[] = []

/** 获取所有已注册 SVG shape 的 defs 拼接（内部用 + 业务侧 mountAllDefs 用） */
export function getRegisteredDefs(): string {
  return _collectedDefs.join('\n')
}

/** 获取已注册的所有 CustomShapeItem（带 shapeName / defs / vbWidth 等） */
const _registeredShapes: CustomShapeItem[] = []
export function getRegisteredShapes(): CustomShapeItem[] {
  return _registeredShapes
}
// =============================================================

/** SVG 自定义形状项 */
export interface CustomShapeItem {
  label: string
  svg: string
  shapeName?: string
  innerHtml?: string
  viewBox?: string
  vbWidth?: number
  vbHeight?: number
  vbX?: number
  vbY?: number
  defs?: string
  markup?: any[]
  hasFill?: boolean
  hasStroke?: boolean
  strokeWidth?: number
}

/** 四方向连接桩配置 */
export const ports = {
  groups: {
    top: {
      position: 'top',
      attrs: {
        circle: {
          r: 4,
          magnet: true,
          stroke: '#5F95FF',
          strokeWidth: 1,
          fill: '#fff',
          style: { visibility: 'hidden' },
        },
      },
    },
    right: {
      position: 'right',
      attrs: {
        circle: {
          r: 4,
          magnet: true,
          stroke: '#5F95FF',
          strokeWidth: 1,
          fill: '#fff',
          style: { visibility: 'hidden' },
        },
      },
    },
    bottom: {
      position: 'bottom',
      attrs: {
        circle: {
          r: 4,
          magnet: true,
          stroke: '#5F95FF',
          strokeWidth: 1,
          fill: '#fff',
          style: { visibility: 'hidden' },
        },
      },
    },
    left: {
      position: 'left',
      attrs: {
        circle: {
          r: 4,
          magnet: true,
          stroke: '#5F95FF',
          strokeWidth: 1,
          fill: '#fff',
          style: { visibility: 'hidden' },
        },
      },
    },
  },
  items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
}

const INVISIBLE_TAGS = new Set(['title', 'desc', 'metadata', 'sodipodi:namedview'])

/** 将 SVG 元素递归转换为 X6 JSON markup */
const svgElementToMarkup = (el: Element): any => {
  const tag = el.tagName.toLowerCase()
  if (INVISIBLE_TAGS.has(tag)) return null

  const attrs: Record<string, string> = {}
  Array.from(el.attributes).forEach((attr) => {
    attrs[attr.name] = attr.value
  })
  const node: any = { tagName: tag, attrs }
  const children = Array.from(el.children)
    .filter((child) => child.tagName.toLowerCase() !== 'defs')
    .map(svgElementToMarkup)
    .filter(Boolean)
  if (children.length > 0) {
    node.children = children
  }
  if (tag === 'text' || tag === 'tspan') {
    const textContent = el.textContent
    if (textContent != null) {
      node.textContent = textContent
    }
  }
  return node
}

/**
 * 清洗 SVG，输出可用于 X6 自定义节点的 JSON markup + defs
 */
export const sanitizeSvgForX6 = (rawSvgStr: string) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawSvgStr, 'image/svg+xml')
  const rootSvg = doc.querySelector('svg')
  if (!rootSvg)
    return {
      markup: [],
      viewBox: '0 0 512 512',
      defs: '',
      vbWidth: 512,
      vbHeight: 512,
      vbX: 0,
      vbY: 0,
      hasFill: false,
      hasStroke: false,
    }

  let viewBox = rootSvg.getAttribute('viewBox')
  let vbWidth = 512
  let vbHeight = 512
  let vbX = 0
  let vbY = 0

  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number)
    if (parts.length === 4) {
      vbX = parts[0]
      vbY = parts[1]
      vbWidth = parts[2]
      vbHeight = parts[3]
    }
  } else {
    const w = parseFloat(rootSvg.getAttribute('width') || '512')
    const h = parseFloat(rootSvg.getAttribute('height') || '512')
    vbWidth = w
    vbHeight = h
    viewBox = `0 0 ${w} ${h}`
  }

  // 提取 defs
  const allDefs = rootSvg.querySelectorAll('defs')
  let defsHtml = ''
  if (allDefs.length > 0) {
    defsHtml = Array.from(allDefs)
      .map((d) => d.innerHTML)
      .join('\n')
  }

  // 递归标记 data-selector + 设置 inherit + 修复 URL 引用
  let seed = Date.now()
  let hasFill = false
  let hasStroke = false
  let maxStrokeWidth = 1
  const normalizeElement = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    // 清除无效属性值
    if (el.getAttribute('stroke') === 'null') el.removeAttribute('stroke')
    if (el.getAttribute('fill') === 'null') el.removeAttribute('fill')

    if (['path', 'ellipse', 'circle', 'rect', 'polygon', 'polyline', 'line'].includes(tag)) {
      el.setAttribute('data-selector', `svg-${tag}-${seed++}`)
      const strokeVal = el.getAttribute('stroke')
      if (strokeVal && strokeVal !== 'none') {
        el.setAttribute('stroke', 'inherit')
        hasStroke = true
      } else {
        el.setAttribute('stroke', 'none')
      }
      // fill 逻辑：保留原始 SVG 的 fill 语义
      // - fill="none" 保持不变（轮廓符号不填充）
      // - 其他（有 fill 颜色或无 fill 属性）设为 inherit，跟随 svg-body
      const fillVal = el.getAttribute('fill')
      if (fillVal !== 'none') {
        el.setAttribute('fill', 'inherit')
        hasFill = true
      } else {
        el.setAttribute('fill', 'none')
      }
      // stroke-width 逻辑：收集最大 stroke-width，设为 inherit 跟随 svg-body
      const sw = el.getAttribute('stroke-width')
      if (sw) {
        const num = parseFloat(sw)
        if (!Number.isNaN(num) && num > maxStrokeWidth) {
          maxStrokeWidth = num
        }
        el.setAttribute('stroke-width', 'inherit')
      }
    } else if (tag === 'text') {
      el.setAttribute('data-selector', `svg-${tag}-${seed++}`)
      // text 元素：fill 跟随 svg-body，stroke 必须显式设 none 防止继承父级描边
      const textFill = el.getAttribute('fill')
      if (textFill !== 'none') {
        el.setAttribute('fill', 'inherit')
        hasFill = true
      } else {
        el.setAttribute('fill', 'none')
      }
      // text 元素默认无 stroke，显式设 none 防止继承父级的 stroke/stroke-width
      el.setAttribute('stroke', 'none')
    } else if (tag === 'g' || tag === 'svg') {
      // 容器元素：必须设置 fill/stroke/color=inherit，
      // 否则 SVG 默认 fill=black 会阻断继承链，导致子元素的 inherit 无法生效
      el.setAttribute('fill', 'inherit')
      el.setAttribute('stroke', 'inherit')
      el.setAttribute('color', 'inherit')
    }

    if (el.id) {
      const newId = `x6-${seed++}`
      el.setAttribute('data-old-id', el.id)
      el.id = newId
    }

    Array.from(el.attributes).forEach((attr) => {
      const val = attr.value
      const match = val.match(/^url\(#(.+)\)$/)
      if (match) {
        const oldId = match[1]
        const target = doc.getElementById(oldId)
        if (target?.id) {
          attr.value = `url(#${target.id})`
        }
      }
    })

    Array.from(el.children).forEach(normalizeElement)
  }
  normalizeElement(rootSvg)

  // 转换为 X6 JSON markup
  const markupChildren = Array.from(rootSvg.children)
    .filter((el) => el.tagName.toLowerCase() !== 'defs')
    .map(svgElementToMarkup)
    .filter(Boolean)

  return {
    markup: markupChildren,
    viewBox: viewBox || `0 0 ${vbWidth} ${vbHeight}`,
    defs: defsHtml,
    vbWidth,
    vbHeight,
    vbX,
    vbY,
    hasFill,
    hasStroke,
    strokeWidth: maxStrokeWidth,
  }
}

/**
 * 将 defs 挂载到画布顶层 SVG
 */
export const mountSvgDefs = (graph: GraphType, defStr: string) => {
  if (!defStr) return
  const container = graph.container
  const svgEl = container.querySelector('svg')
  if (!svgEl) return
  let $defs = svgEl.querySelector(':scope > defs')
  if (!$defs) {
    $defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svgEl.insertBefore($defs, svgEl.firstChild)
  }
  $defs.insertAdjacentHTML('beforeend', defStr)
}

/**
 * 注册一个 SVG 为 X6 自定义节点（shapeName = svg-node-${index}）
 */
export const registerSvgNode = (item: CustomShapeItem, index: number) => {
  const { markup, defs, vbWidth, vbHeight, vbX, vbY, viewBox, hasFill, hasStroke, strokeWidth } =
    sanitizeSvgForX6(item.svg)
  const shapeName = `svg-node-${index}`

  // 存储清洗后的数据
  item.markup = markup
  item.vbWidth = vbWidth
  item.vbHeight = vbHeight
  item.vbX = vbX
  item.vbY = vbY
  item.viewBox = viewBox
  item.defs = defs
  item.hasFill = hasFill
  item.hasStroke = hasStroke
  item.strokeWidth = strokeWidth

  // 自动收集 defs（去重）——不管哪种注册方式都会走这里
  if (defs && !_collectedDefs.includes(defs)) {
    _collectedDefs.push(defs)
  }

  Graph.registerNode(
    shapeName,
    {
      markup: [
        {
          tagName: 'g',
          selector: 'svg-body',
          children: [
            {
              tagName: 'rect',
              selector: 'svg-hitarea',
              attrs: {
                fill: 'transparent',
                stroke: 'none',
                'pointer-events': 'fill',
              },
            },
            {
              tagName: 'svg',
              selector: 'svg-root',
              attrs: {
                viewBox: item.viewBox || `0 0 ${vbWidth} ${vbHeight}`,
                xmlns: 'http://www.w3.org/2000/svg',
                preserveAspectRatio: 'xMidYMid meet',
              },
              children: markup,
            },
          ],
        },
      ],
      attrs: {
        'svg-body': {
          color: '#000000',
          stroke: '#000000',
          fill: '#000000',
          'stroke-width': strokeWidth,
        },
        'svg-hitarea': {
          refWidth: '100%',
          refHeight: '100%',
        },
        'svg-root': {
          refWidth: '100%',
          refHeight: '100%',
          fill: 'inherit',
          stroke: 'inherit',
          color: 'inherit',
        },
      },
      ports: { ...ports },
    },
    true,
  )

  item.shapeName = shapeName

  // 自动收集已注册的 shape（让 getRegisteredShapes 能拿到）
  _registeredShapes.push(item)
}

/**
 * 创建 Stencil 中 SVG 图元的预览节点（等比缩放，限制在 30×30 内）
 */
export const createSvgPreviewNode = (graph: GraphType, item: CustomShapeItem) => {
  const vbW = item.vbWidth || 512
  const vbH = item.vbHeight || 512
  const maxW = 30
  const maxH = 30
  const scale = Math.min(maxW / vbW, maxH / vbH)
  const nodeW = Math.max(14, vbW * scale)
  const nodeH = Math.max(14, vbH * scale)

  return graph.createNode({
    shape: item.shapeName!,
    width: nodeW,
    height: nodeH,
    label: {
      text: item.label,
      position: 'bottom',
      offset: 1,
      style: { fontSize: 10, fill: '#333', textAnchor: 'middle' },
    },
    attrs: {
      'svg-body': {
        color: '#000000',
        stroke: '#000000',
        fill: '#000000',
      },
    },
  })
}

/**
 * 创建本地图片的 Stencil 预览节点
 */
export const createLocalImagePreviewNodes = (
  graph: GraphType,
  images: Array<{ label: string; dataUrl: string }>,
) => {
  return images.map((img) =>
    graph.createNode({
      shape: 'custom-image',
      width: 40,
      height: 40,
      label: {
        text: img.label,
        position: 'bottom',
        offset: 1,
        style: { fontSize: 10, fill: '#333', textAnchor: 'middle' },
      },
      attrs: {
        image: {
          'xlink:href': img.dataUrl,
          refWidth: '100%',
          refHeight: '100%',
          preserveAspectRatio: 'xMidYMid meet',
        },
        label: { text: img.label },
      },
    }),
  )
}
