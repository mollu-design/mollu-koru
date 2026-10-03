/**
 * 图元动画应用与清理逻辑。
 *
 * 核心发现：
 *  1. X6 v3 的 fromJSON 只存 attrs 到内部，不自动渲染 className 到 DOM 的 class-name 属性
 *     → 必须显式调 cell.attr('svg-body/className', ...) 才会触发渲染
 *  2. svg-node markup 只声明了 svg-body/svg-hitarea/svg-root —— 没有 'body' selector！
 *     → mainSelectorsOf 里 'body' 是 no-op，必须去掉
 *  3. DOM 查找用 graph.findViewByCell(cell).container —— X6 原生 API，比 querySelector 可靠
 *  4. 初始化路径（fromJSON 后）不传 graph → 纯 cell.attr
 *     trigger 路径传 graph → cell.attr + DOM 强制同步双写
 */
import { type AnimationConfig } from './AnimationTypes'
import { ANIMATION_TEMPLATES, animationClassFor } from './animationConfig'

/** 主元素 selector 列表（动画 class 设在这些元素上） */
const mainSelectorsOf = (cell: any): string[] => {
  const shape = cell?.shape || ''
  if (shape === 'shape-line') return ['line']
  if (typeof shape === 'string' && shape.startsWith('svg-node-')) return ['svg-body']
  if (cell && cell.isEdge && cell.isEdge()) return ['line']
  if (shape === 'custom-image') return ['image']
  return ['body']
}

/** 文本/label 元素 selector 列表（仅在文本本身就是主体时才返回） */
const textSelectorsOf = (cell: any): string[] => {
  if (!cell) return []
  const shape = cell.shape || ''
  if (shape === 'custom-text') return ['label']
  if (shape === 'custom-button') return ['text']
  if (shape === 'custom-split') return ['leftText', 'rightText']
  return []
}

/**
 * 清除 cell 的 selector 上的动画 class（X6 内部）。
 * 读 → 过滤 anim- → set 回去 —— 让 X6 检测到 old→new 变化
 */
const clearAnimAttr = (cell: any, sel: string) => {
  try {
    const cur = String(cell?.attr?.(`${sel}/className`) || '')
    const filtered = cur.split(/\s+/).filter((c) => c && !c.startsWith('anim-')).join(' ')
    cell?.attr?.(`${sel}/className`, filtered)
  } catch { /* ignore */ }
}

/**
 * 强制 DOM 同步 class-name 属性。
 * 用 graph.container + data-cell-id 全局查找，不走 findViewByCell（那个 container 可能是空的）。
 */
const forceDomClassname = (cell: any, graph?: any) => {
  if (!graph) return
  try {
    const root: HTMLElement | null = typeof graph.container === 'string'
      ? document.querySelector(graph.container)
      : graph.container || null
    if (!root || !cell?.id) return
    // 按 data-cell-id 找 cell DOM
    const cellDom = root.querySelector(`[data-cell-id="${cell.id}"]`)
    if (!cellDom) return
    // 查 markup 里声明的有效 selector
    const sel = mainSelectorsOf(cell)[0] || 'svg-body'
    const targets = cellDom.querySelectorAll(`[data-selector="${sel}"]`)
    if (targets.length === 0) return
    const cn = String(cell?.attr?.(`${sel}/className`) || '')
    targets.forEach((el) => {
      const curDom = (el as Element).getAttribute('class-name') || ''
      ;(el as Element).setAttribute('class-name', cn)
      if (curDom !== cn) {
        console.log(`[forceDom] cell=${cell?.id?.slice?.(-8)} sel=${sel} "${curDom || '(空)'}" → "${cn || '(空)'}"`)
      }
    })
  } catch { /* ignore */ }
}

/** 为 cell 设置动画 class */
const setAnimClass = (cell: any, className: string, graph?: any) => {
  const selectors = [...mainSelectorsOf(cell), ...textSelectorsOf(cell)]
  const seen = new Set<string>()
  selectors.forEach((sel) => {
    if (seen.has(sel)) return
    seen.add(sel)
    const cur = String(cell?.attr?.(`${sel}/className`) || '')
    const cleaned = cur
      .split(/\s+/)
      .filter((c) => c && !c.startsWith('anim-'))
      .join(' ')
    const next = [cleaned, className].filter(Boolean).join(' ')
    try {
      cell?.attr?.(`${sel}/className`, next || '')
      // DEBUG: 立即读回验证 X6 是否存了
      const after = String(cell?.attr?.(`${sel}/className`) || '')
      console.log(`[setAnimClass] cell=${cell?.id?.slice?.(-8)} sel=${sel} "${cur}" → "${next}" (X6读后="${after}")`)
    } catch { /* ignore */ }
  })
  // DOM 强制同步
  forceDomClassname(cell, graph)
}

/** 清除 cell 上所有 selector 的动画 class */
const clearAnimClass = (cell: any, graph?: any) => {
  const selectors = [...mainSelectorsOf(cell), ...textSelectorsOf(cell)]
  const seen = new Set<string>()
  selectors.forEach((sel) => {
    if (seen.has(sel)) return
    seen.add(sel)
    clearAnimAttr(cell, sel)
  })
  // DOM 强制同步（清除后 X6 内部是空，写 DOM 也会是空 → 生效）
  forceDomClassname(cell, graph)
}

/** 停止 cell 上的全部动画 */
export const stopCellAnimations = (cell: any, graph?: any) => {
  if (!cell) return
  clearAnimClass(cell, graph)
}

/** 依据 cell.data.animation 配置应用动画 */
export const applyCellAnimation = (cell: any, cfg?: AnimationConfig | null, graph?: any): boolean => {
  if (!cell) return false

  // 先清除旧动画
  clearAnimClass(cell, graph)

  if (!cfg || !cfg.enabled) return false
  const templateId = cfg.templateId
  if (!templateId) return false
  const tpl = ANIMATION_TEMPLATES[templateId]
  if (!tpl) return false

  const cellType: 'edge' | 'node' = cell.isEdge && cell.isEdge() ? 'edge' : 'node'
  if (tpl.target !== cellType) return false

  const className = animationClassFor(templateId)
  setAnimClass(cell, className, graph)
  return true
}

/**
 * 依据 cell 的 data 数据自动应用动画。
 * fromJSON 后必须遍历 cells 调此函数 —— X6 不自动渲染 className 到 DOM！
 */
export const applyAnimationFromData = (cell: any, graph?: any) => {
  const data = cell?.getData?.()
  if (!data) return
  applyCellAnimation(cell, data.animation, graph)
}

/** 触发器行为：启动图元动画 */
export const startCellAnimation = (
  cell: any,
  templateId: string,
  opts: Record<string, number | string> = {},
  graph?: any,
): boolean => {
  if (!cell) return false
  const cfg: AnimationConfig = { enabled: true, templateId: templateId as any, options: opts }
  return applyCellAnimation(cell, cfg, graph)
}

/** 触发器行为：停止图元动画 */
export const stopCellAnimation = (cell: any, graph?: any): void => {
  stopCellAnimations(cell, graph)
}

/**
 * 扫全图清所有 anim- 开头的动画 class。
 * stopAnimation trigger 专用 —— targetCellId 可能配错。
 */
export const stopAllAnimations = (graph?: any): number => {
  if (!graph) return 0

  let cleared = 0

  try {
    const cells = graph.getCells?.() || []
    console.log(`[stopAllAnimations] 🎯 开始扫 ${cells.length} 个 cells`)
    cells.forEach((cell: any) => {
      // Step 1: 清 X6 内部 attrs
      const selectors = [...mainSelectorsOf(cell), ...textSelectorsOf(cell)]
      selectors.forEach((sel) => {
        const cur = String(cell?.attr?.(`${sel}/className`) || '')
        const animClasses = cur.split(/\s+/).filter((c) => c.startsWith('anim-'))
        if (animClasses.length > 0) {
          clearAnimAttr(cell, sel)
          console.log(`[stopAllAnimations] ✅ X6 cell=${cell?.id?.slice?.(-8)} sel=${sel} 清 ${animClasses.join(',')}`)
          cleared += animClasses.length
        }
      })
      // Step 2: DOM 强制同步（清掉）
      forceDomClassname(cell, graph)
    })
  } catch (e) {
    console.warn('[stopAllAnimations] 出错:', e)
  }

  console.log(`[stopAllAnimations] 📊 共清了 ${cleared} 个`)
  return cleared
}

/** 扫 graph 所有 cell 的 DOM（调试用） */
export const dumpAllAnimClasses = (graph?: any) => {
  if (!graph) return
  console.log('======== [anim-dom-dump] ========')
  try {
    const root: HTMLElement | null = typeof graph.container === 'string'
      ? document.querySelector(graph.container)
      : graph.container || null
    if (!root) { console.log('  root=null!'); return }

    // 打印 root 的 children（前3层）
    const svg = root.querySelector('svg')
    console.log(`  root.tag=${root.tagName} 有svg=${!!svg}`)
    // 全局搜所有层级
    const deepDS = root.querySelectorAll('[data-selector]').length
    const deepCN = root.querySelectorAll('[class-name]').length
    const deepCellID = root.querySelectorAll('[data-cell-id]').length
    const allTags = Array.from(root.querySelectorAll('*')).map(el => el.tagName.toLowerCase())
    console.log(`  全局: [data-selector]=${deepDS} [class-name]=${deepCN} [data-cell-id]=${deepCellID} 总元素=${allTags.length}`)
    console.log(`  所有标签: ${[...new Set(allTags)].join(', ')}`)
    // 如果有 svg，dump svg 前500字符
    if (svg) {
      console.log(`  svg outerHTML 前500字符:`, (svg as Element).outerHTML.slice(0, 500))
    }
    // 直接搜 x6-node 或 x6-edge
    const x6nodes = root.querySelectorAll('.x6-node, .x6-edge')
    console.log(`  .x6-node/.x6-edge 数量: ${x6nodes.length}`)
    x6nodes.forEach((el, i) => {
      console.log(`    node[${i}] tag=${el.tagName} cls="${(el as Element).className?.slice?.(0,60) || ''}" data-cell-id="${(el as Element).getAttribute('data-cell-id') || '(无)'}"`)
    })
  } catch (e) {
    console.warn('[anim-dom-dump] 出错:', e)
  }
  console.log('===================================')
}
