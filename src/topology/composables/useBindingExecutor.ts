/**
 * 绑定 + 触发器运行时执行器。
 *
 * 职责：
 *  1. 遍历画布节点的绑定配置（cell.data.binding.bindings）；
 *  2. 获取测点值（默认 mock，可通过外部数据源注入）；
 *  3. 应用 JEXL 映射，实时驱动图元属性（持续性渲染）；
 *  4. 判断触发器条件（once_change 仅跳变 / always 持续），命中后执行对应行为；
 *  5. 行为分发：弹窗告警、下发控制指令、启动/停止图元动画等。
 *
 * 移植自 webtopo 的 useBindingExecutor.ts，适配 koru 项目结构。
 */
import {
  applyCellAnimation,
  startCellAnimation,
  stopCellAnimation,
  stopCellAnimations,
  stopAllAnimations,
  applyAnimationFromData,
} from './useAnimation'
import { triggerActionLabel } from './bindingConfig'
import { applyChangeProperty, evalCondition } from './useEventActions'
import { parseTemplateFromJexl } from './useJexl'
import {
  applyMultiStateVisibility,
  applyMultiStateByPoint,
  findMultiStateParents,
} from './useMultiState'

// ============ 依赖接口 ============

export interface BindingExecutorDeps {
  getGraph: () => any
  /** 测点值获取：默认返回 mock 数据，可替换为 WebSocket/后端。 */
  readTagValue?: (cellId: string, device: string, dataPoint: string) => number | string | null
  /** 行为提示 */
  showActionMessage?: (msg: string) => void
  /** 下发控制指令（mock 接口，可替换） */
  sendCommand?: (cmd: string) => Promise<void>
  /** 请求打开确认弹窗（用于 openDialog / writePoint 等行为） */
  requestConfirm?: (req: {
    kind?: string
    title?: string
    content: string
    confirmText?: string
    onConfirm: () => void
    /** 可选：来源 trigger 上下文（confirm 事件会带回） */
    cellId?: string
    triggerId?: string
    actionType?: string
    tagValue?: number | string | null
  }) => void
  /** 触发器动作执行回调（用于外部监听） */
  onActionTriggered?: (info: {
    cellId: string
    triggerId: string
    actionType: string
    actionValue: any
    tagValue: number | string | null
    matched: boolean
    /** 触发该动作的绑定配置 */
    binding?: any
    /** 触发该动作的触发器配置 */
    triggerConfig?: any
    /** 图元完整数据（含 binding、eventConfig 等） */
    cellData?: Record<string, any>
    /** 图元 shape */
    shape?: string
  }) => void
  /** 外部数据源：支持三种格式，内部自动归一化为三段式
   *  - 格式 A 三段式: { "cellId:device:dataPoint": val }
   *  - 格式 B 分组:   [{ cellId, data: [{ device, dataPoint, value }] }]
   *  - 两段式:        { "device:dataPoint": val }（内部从 graph binding 反查 cellId）
   */
  fetchData?: () => Promise<any>
  /** 数据更新回调：每次 fetchData 返回后触发 */
  onDataUpdate?: (data: Record<string, number | string | null>) => void
  /** Phase 1 新增：一轮 tick 结束后回调（用于外部 flush 告警缓冲等） */
  onTickComplete?: () => void
}

// ============ 条件判断 ============

/** 触发条件运算符判断 */
const matchCondition = (
  operator: string,
  compareValue: string | number,
  tagVal: number | string | null,
): boolean => {
  if (tagVal === null || tagVal === undefined) return false
  const v = Number(tagVal)
  const c = Number(compareValue)
  const opMap: Record<string, string> = {
    eq: '==',
    neq: '!=',
    gt: '>',
    lt: '<',
    gte: '>=',
    lte: '<=',
  }
  const op = opMap[operator] || operator
  switch (op) {
    case '==':
      return String(tagVal) === String(compareValue)
    case '!=':
      return String(tagVal) !== String(compareValue)
    case '>':
      return v > c
    case '<':
      return v < c
    case '>=':
      return v >= c
    case '<=':
      return v <= c
    default:
      return false
  }
}

// ============ JEXL 映射 ============

/** 数值格式化函数，用于 JEXL 表达式中的 format(tagVal, decimals) */
const formatNumber = (val: any, decimals?: number): string => {
  const n = Number(val)
  if (isNaN(n)) return String(val ?? '')
  const d = decimals ?? 0
  return n.toFixed(d)
}

/** 纯 JEXL 表达式求值（不写入图元），返回求值结果字符串 */
const evaluateStateJexl = (expr: string, tagVal: number | string | null): string | null => {
  if (!expr || !expr.trim()) return null
  const code = expr.trim()
  if (code === 'tagVal') return String(tagVal ?? '')
  try {
    const fn = new Function('tagVal', 'format', `return (${code});`)
    const result = fn(tagVal, formatNumber)
    return result !== undefined && result !== null ? String(result) : null
  } catch {
    return null
  }
}

/** 应用 JEXL 映射（沙箱执行，仅注入 tagVal） */
export const applyMapping = (
  cell: any,
  expr: string,
  tagVal: number | string | null,
  targetProperty?: string,
): void => {
  if (!cell || !expr) return
  const code = expr.trim()
  if (!code || code === 'tagVal') {
    applyMappingResult(cell, String(tagVal ?? ''), targetProperty)
    return
  }
  let result: unknown
  try {
    const fn = new Function('tagVal', 'format', `return (${code});`)
    result = fn(tagVal, formatNumber)
  } catch {
    try {
      const fn = new Function('tagVal', 'format', `${code}; return tagVal;`)
      result = fn(tagVal, formatNumber)
    } catch {
      result = null
    }
  }
  if (result === undefined || result === null) return
  applyMappingResult(cell, String(result), targetProperty)
}

/** 将映射结果写入图元 */
const applyMappingResult = (cell: any, value: string, targetProperty?: string): void => {
  if (!cell?.isNode?.()) return
  if (
    targetProperty &&
    ['fill', 'stroke', 'strokeWidth', 'opacity', 'fontSize', 'color'].includes(targetProperty)
  ) {
    const shape = cell.shape || ''
    const isSvgNode = typeof shape === 'string' && shape.startsWith('svg-node-')
    // svg-node 形状使用 svg-body 选择器，且需同步 color 以支持 currentColor
    const selector = isSvgNode ? 'svg-body' : targetProperty === 'color' ? 'text' : 'body'
    const attr = targetProperty === 'color' ? 'fill' : targetProperty
    cell.attr(`${selector}/${attr}`, value)
    // svg-node: fill/stroke 变化时同步 color，同时 fill 也影响 stroke（轮廓型 SVG）
    if (isSvgNode) {
      if (targetProperty === 'fill') {
        cell.attr('svg-body/color', value)
        cell.attr('svg-body/stroke', value)
      } else if (targetProperty === 'stroke') {
        cell.attr('svg-body/color', value)
      }
    }
    return
  }
  // visible 特殊处理：X6 v3 使用 setVisible() 方法
  if (targetProperty === 'visible') {
    const show = value === 'true' || value === '1' || value === 'true'
    if (typeof cell.setVisible === 'function') {
      cell.setVisible(show)
    } else {
      cell.visible = show
    }
    return
  }
  // nodeAnim 特殊处理：切换动画模板
  if (targetProperty === 'nodeAnim') {
    const templateId = String(value || 'none')
    if (typeof cell.replaceData === 'function') {
      const curData = cell.getData?.() || {}
      const curAnim = curData.animation || { enabled: false, templateId: 'none', options: {} }
      const newAnim =
        templateId === 'none'
          ? { enabled: false, templateId: 'none', options: {} }
          : { ...curAnim, enabled: true, templateId }
      cell.replaceData({ ...curData, animation: newAnim })
    }
    if (templateId === 'none') {
      stopCellAnimations(cell)
    } else {
      applyCellAnimation(cell, { enabled: true, templateId: templateId as any, options: {} })
    }
    return
  }
  writeTextValue(cell, value)
}

/** 写文本到节点 */
const writeTextValue = (cell: any, text: string): void => {
  if (!cell?.isNode?.()) return
  const shape = cell.shape || ''
  if (shape === 'custom-text') {
    cell.attr('label/text', text)
  } else if (shape === 'custom-button') {
    cell.attr('text/text', text)
  } else if (shape === 'custom-split') {
    cell.attr('rightText/text', text)
  } else if (shape === 'custom-rect' || shape === 'custom-circle') {
    cell.attr('text/text', text)
  }
}

// ============ 按钮双映射 ============

/** 从按钮样式映射配置生成 JEXL 表达式 */
const buildStyleJexl = (styleMapping: any): string => {
  if (!styleMapping) return 'tagVal'
  if (styleMapping.templateType === 'colorMap') {
    const items = styleMapping.mappingItems || []
    if (items.length === 0) return `'${styleMapping.defaultColor || '#909399'}'`
    let expr = ''
    items.forEach((p: any) => {
      expr += `tagVal=='${p.sourceValue}'?'${p.color}':`
    })
    expr += `'${styleMapping.defaultColor || '#909399'}'`
    return expr
  }
  if (styleMapping.templateType === 'threshold_color') {
    const rules = styleMapping.rules || []
    if (rules.length === 0) return `'${styleMapping.defaultColor || '#333333'}'`
    let expr = `'${styleMapping.defaultColor || '#333333'}'`
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = rules[i]
      if (r.operator === 'between') {
        expr = `tagVal>=${Number(r.min)}&&tagVal<=${Number(r.max)}?'${r.color}':(${expr})`
      } else {
        expr = `tagVal${r.operator}${Number(r.value)}?'${r.color}':(${expr})`
      }
    }
    return expr
  }
  if (styleMapping.templateType === 'threshold') {
    const op = styleMapping.thresholdOp === 'lt' ? '<' : '>'
    return `tagVal${op}${Number(styleMapping.thresholdValue)}?'${styleMapping.alarmColor}':'${styleMapping.normalColor}'`
  }
  return 'tagVal'
}

/** 从按钮文本映射配置生成 JEXL 表达式 */
const buildTextJexl = (textMapping: any): string => {
  if (!textMapping) return 'tagVal'
  const items = textMapping.mappingItems || []
  if (items.length === 0) return `'${textMapping.defaultText || ''}'`
  let expr = ''
  items.forEach((p: any) => {
    expr += `tagVal=='${p.sourceValue}'?'${p.showText}':`
  })
  expr += `'${textMapping.defaultText || ''}'`
  return expr
}

/** 应用按钮双映射（文本 + 样式） */
const applyButtonMappings = (cell: any, b: any, tagVal: number | string | null): void => {
  if (b.textMapping) {
    const textExpr = buildTextJexl(b.textMapping)
    applyMapping(cell, textExpr, tagVal)
  }
  if (b.styleMapping) {
    const styleExpr = buildStyleJexl(b.styleMapping)
    applyMapping(cell, styleExpr, tagVal, 'fill')
  }
}

/** 应用 custom-text 文本颜色映射 */
const applyTextStyleMapping = (cell: any, b: any, tagVal: number | string | null): void => {
  if (!b.styleMapping) return
  const styleExpr = buildStyleJexl(b.styleMapping)
  try {
    const fn = new Function('tagVal', `return (${styleExpr});`)
    const color = fn(tagVal)
    cell.attr('label/fill', String(color))
  } catch (e) {
    console.warn('[applyTextStyleMapping] 颜色表达式执行失败', styleExpr, e)
  }
}

// ============ 触发器行为分发 ============

/** setGraphAttr 原始值快照（模块级，供 executeTrigger 闭包访问） */
const _originals = new Map<string, Record<string, any>>()

/** changeProperty 原始值快照（key: `${cellId}:${prop}`, value: 原始值） */
const _changeOriginals = new Map<string, any>()

/**
 * 读取 cell 当前的某个属性值（快照用）。
 * 优先读 cell.attr 路径（fill/stroke 等），fallback 到 cell.position / size 等 getter。
 */
const _readCellPropValue = (cell: any, prop: string): any => {
  try {
    const shape = cell.shape || ''
    const isSvgNode = shape.startsWith('svg-node-')
    const mainSel = isSvgNode ? 'svg-body' : shape === 'shape-line' ? 'line' : 'body'
    if (['fill', 'stroke', 'strokeWidth'].includes(prop)) {
      return cell.attr?.(`${mainSel}/${prop}`) ?? cell.attr?.(`body/${prop}`)
    }
    if (prop === 'visible') {
      return typeof cell.isVisible === 'function' ? cell.isVisible() : cell.visible
    }
    if (prop === 'x' || prop === 'y') {
      const pos = cell.getPosition?.() || {}
      return pos[prop]
    }
    if (prop === 'width' || prop === 'height') {
      const size = cell.getSize?.() || {}
      return size[prop]
    }
    return cell.attr?.(`${mainSel}/${prop}`) ?? cell.attr?.(`label/${prop}`)
  } catch {
    return undefined
  }
}

/** playAudio 运行中的音频实例（按 trigger.id 存引用，恢复时可暂停） */
const _activeAudios = new Map<string, HTMLAudioElement>()
const audioRefKey = (triggerId: string) => `audio:${triggerId}`

/**
 * 浏览器自动播放策略解锁：
 * Chrome/Edge/Safari 要求 HTMLAudioElement.play() 必须在用户手势（click/keydown/touchstart）
 * 的同步调用栈里首次调用。即使之前点过页面，setInterval/setTimeout 回调里的 play() 仍可能被拦。
 *
 * 解法：用户第一次交互时，在 DOM 事件处理器（真正的手势上下文）里立即创建一个静默 Audio
 * 并 play()+pause()。这会解锁整个页面的 audio context，之后任何上下文里的 play() 都能成功。
 */
let _audioUnlocked = false
function _unlockAudioOnFirstGesture(): void {
  if (_audioUnlocked || typeof document === 'undefined' || typeof Audio === 'undefined') return
  _audioUnlocked = true
  try {
    // 用一个极小的 WAV 数据 URL（静默 1 秒），不依赖任何外部资源
    const silent = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
    silent.volume = 0
    // 在手势同步栈里 play() → 立即 pause() → 解锁成功
    silent.play().then(() => { silent.pause(); silent.src = '' }).catch(() => {})
  } catch { /* ignore */ }
  document.removeEventListener('click', _unlockAudioOnFirstGesture, true)
  document.removeEventListener('keydown', _unlockAudioOnFirstGesture, true)
  document.removeEventListener('touchstart', _unlockAudioOnFirstGesture, true)
}
if (typeof document !== 'undefined') {
  // capture 阶段监听，确保 KoruPreview 内部任何元素的点击都能触发
  document.addEventListener('click', _unlockAudioOnFirstGesture, true)
  document.addEventListener('keydown', _unlockAudioOnFirstGesture, true)
  document.addEventListener('touchstart', _unlockAudioOnFirstGesture, true)
}

/** 保存 setGraphAttr 目标 cell 的原始 attrs */
const _snapshotOriginalAttrs = (cell: any, propKey: string): Record<string, any> => {
  const shape = cell.shape || ''
  if (shape.startsWith('svg-node-')) {
    return {
      color: cell.attr('svg-body/color'),
      fill: cell.attr('svg-body/fill'),
      stroke: cell.attr('svg-body/stroke'),
    }
  }
  if (shape === 'shape-line') {
    return { stroke: cell.attr('line/stroke') }
  }
  if (shape === 'custom-text') {
    return { fill: cell.attr('label/fill') }
  }
  if (shape === 'custom-split') {
    return { fill: cell.attr('leftText/fill'), stroke: cell.attr('body/stroke') }
  }
  return {
    fill: cell.attr('body/fill'),
    stroke: cell.attr('body/stroke'),
    strokeWidth: cell.attr('body/strokeWidth'),
  }
}

/** 将原始 attrs 还原到 cell */
const _restoreOriginalAttrs = (cell: any, snapshot: Record<string, any>, propKey: string): void => {
  const shape = cell.shape || ''
  if (shape.startsWith('svg-node-')) {
    if (snapshot.color != null) cell.attr('svg-body/color', snapshot.color)
    if (propKey === 'fill') {
      if (snapshot.fill != null) cell.attr('svg-body/fill', snapshot.fill)
      if (snapshot.stroke != null) cell.attr('svg-body/stroke', snapshot.stroke)
    } else if (propKey === 'stroke') {
      if (snapshot.stroke != null) cell.attr('svg-body/stroke', snapshot.stroke)
    }
  } else if (shape === 'shape-line') {
    if (snapshot.stroke != null) cell.attr('line/stroke', snapshot.stroke)
  } else if (shape === 'custom-text') {
    if (snapshot.fill != null) cell.attr('label/fill', snapshot.fill)
  } else if (shape === 'custom-split') {
    if (propKey === 'fill' && snapshot.fill != null) cell.attr('leftText/fill', snapshot.fill)
    if (propKey === 'stroke' && snapshot.stroke != null) cell.attr('body/stroke', snapshot.stroke)
  } else {
    if (snapshot.fill != null) cell.attr('body/fill', snapshot.fill)
    if (snapshot.stroke != null) cell.attr('body/stroke', snapshot.stroke)
  }
}

/** 行为分发：执行单个触发器 */
const executeTrigger = (
  cell: any,
  trigger: any,
  tagVal: number | string | null,
  deps: BindingExecutorDeps,
  binding?: any,
  isRecover = false,
): void => {
  const av = trigger.actionValue || {}
  const cellData = cell.getData?.() || {}
  // sendMsg / writePoint 特殊：需要 handler 里才知道最终结果（模板解析 or 用户确认），
  // 所以开头的 onActionTriggered 跳过它们，让 handler 里的 showActionMessage 成为唯一反馈
  if (!['sendMsg', 'writePoint'].includes(trigger.actionType)) {
    deps.onActionTriggered?.({
      cellId: cell.id,
      triggerId: trigger.id || '',
      actionType: trigger.actionType || '',
      actionValue: av,
      tagValue: tagVal,
      matched: !isRecover,
      isRecover,
      binding,
      triggerConfig: trigger,
      cellData,
      shape: cell.shape || '',
    })
  }
  switch (trigger.actionType) {
    case 'alert':
      deps.showActionMessage?.(`告警：${av.message || ''}`)
      break
    case 'openDialog': {
      const dialogType = av.dialogType || ''
      // deviceId 优先用用户配的，没配就 fallback 到 binding.device（触发源设备）
      const deviceId = av.deviceId || binding?.device || cellData?.deviceKey || cellData?.deviceId || cellData?.id || ''
      const typeLabels: Record<string, string> = {
        deviceDetail: '设备详情',
        history: '历史曲线',
      }
      const typeName = typeLabels[dialogType] || dialogType || '业务'
      const exec = () => {
        deps.showActionMessage?.(`已打开${typeName}${deviceId ? `：${deviceId}` : ''}`)
      }
      if (trigger.confirmBefore === true) {
        deps.requestConfirm?.({
          kind: 'openDialog',
          title: `打开${typeName}`,
          content: `将打开${typeName}弹窗${deviceId ? `（设备：${deviceId}）` : ''}。`,
          confirmText: '打开',
          cellId: cell.id,
          triggerId: trigger.id || '',
          actionType: 'openDialog',
          tagValue: tagVal,
          onConfirm: exec,
        }) || exec()
      } else {
        exec()
      }
      break
    }
    case 'writePoint': {
      // writePoint：confirmBefore=true 才弹确认（默认 false=不弹）
      const point = av.controlPoint || av.point || ''
      const val = av.value ?? ''
      const dev = av.device || binding?.device || cellData?.deviceKey || cellData?.id || ''
      const cmd = `${dev}/${point}=${val}`
      const exec = () => deps.sendCommand?.(cmd)
      if (trigger.confirmBefore === true) {
        deps.requestConfirm?.({
          kind: 'sendCommand',
          title: `下发指令`,
          content: `确认要执行指令？\n${cmd}`,
          confirmText: '发送',
          cellId: cell.id,
          triggerId: trigger.id || '',
          actionType: 'writePoint',
          tagValue: tagVal,
          onConfirm: exec,
        }) || exec()
      } else {
        exec()
      }
      break
    }
    case 'jumpPage':
      if (av.url) {
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        window.location.href = av.url.startsWith('http') ? av.url : base + av.url
      }
      break
    case 'addLog': {
      if (typeof console === 'undefined') break
      const template = av.content || ''
      const ctx: Record<string, any> = {
        tagVal,
        device: binding?.device ?? '',
        dataPoint: binding?.dataPoint ?? '',
        cellLabel: cellData?.label ?? '',
        shape: cell?.shape ?? '',
        triggerId: trigger?.id ?? '',
        compareValue: trigger?.compareValue ?? '',
        operator: trigger?.operator ?? '',
        level: av.level || 'info',
      }
      // 支持模板变量：${tagVal} ${device} ${dataPoint} ${cellLabel} ${shape} ${triggerId} ${compareValue} ${operator}
      const logText = template.replace(/\$\{(\w+)\}/g, (_m, k) => String(ctx[k] ?? ''))
      const level = (av.level || 'info') as string
      const fn: 'error' | 'warn' | 'info' | 'debug' =
        level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'debug' ? 'debug' : 'info'
      console[fn](`[trigger:addLog][${level}] ${logText}`, ctx)
      break
    }
    case 'setGraphAttr': {
      const g = deps.getGraph()
      const propKey = av.propKey

      // ── target 兼容 string（单图元）和 string[]（多图元） ──
      const targetIds: string[] = Array.isArray(av.target)
        ? av.target.filter((t: string) => t && typeof t === 'string')
        : av.target
          ? [av.target]
          : []

      if (targetIds.length === 0 || !propKey) break

      console.log(`[setGraphAttr] isRecover=${isRecover} targets=${targetIds.length} propKey=${propKey} propValue=${av.propValue}`)

      // 解析 propValue（一次解析，所有 target 共享）
      let val: any = av.propValue
      if (typeof val === 'string' && val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1)
      } else {
        try {
          val = JSON.parse(val)
        } catch {
          /* keep raw */
        }
      }

      // ── 内部：对单个 target 执行 setGraphAttr（命中或恢复） ──
      const _applyToOne = (tid: string): void => {
        const tgt = g?.getCellById?.(tid)
        if (!tgt) {
          console.warn(`[setGraphAttr] target ${tid} not found, skip`)
          return
        }
        const origKey = `${tid}:${propKey}`

        if (isRecover) {
          // 恢复分支
          const snap = _originals.get(origKey)
          if (snap) {
            _restoreOriginalAttrs(tgt, snap, propKey)
            _originals.delete(origKey)
            console.log(`[setGraphAttr] ♻️ RECOVER ${tid} propKey=${propKey} shape=${tgt.shape}`)
          } else {
            console.warn(`[setGraphAttr] RECOVER ${tid} 找不到原始快照，跳过`)
          }
          return
        }

        // 命中分支：先存快照（只存第一次）
        if (!_originals.has(origKey)) {
          _originals.set(origKey, _snapshotOriginalAttrs(tgt, propKey))
          console.log(`[setGraphAttr] 📸 保存快照 ${origKey} snap=`, _originals.get(origKey))
        }

        const shape = tgt.shape || ''

        // ── 完全复刻 useKoruGraphEditor.updateCellProp 的属性映射逻辑 ──
        if (propKey === 'visible') {
          const show = val === true || val === 'true' || val === '1'
          if (typeof tgt.setVisible === 'function') tgt.setVisible(show)
          else tgt.visible = show
        } else if (tgt.isNode?.()) {
          if (propKey === 'fill' || propKey === 'stroke') {
            if (shape === 'shape-line') {
              tgt.attr('body/fill', 'transparent')
              tgt.attr('body/stroke', 'none')
              tgt.attr('line/stroke', val)
              if (!tgt.attr('line/d')) {
                const { width, height } = tgt.getSize?.() || { width: 55, height: 2 }
                tgt.attr('line/d', `M0 ${height / 2} L${width} ${height / 2}`)
              }
            } else if (shape.startsWith('svg-node-')) {
              tgt.attr('svg-body/color', val)
              if (propKey === 'fill') {
                tgt.attr('svg-body/fill', val)
                tgt.attr('svg-body/stroke', val)
              } else if (propKey === 'stroke') {
                tgt.attr('svg-body/stroke', val)
              }
              console.log(`[setGraphAttr] ✅ ${tid} svg-node ${propKey}=${val}`)
            } else {
              tgt.attr(`body/${propKey}`, val)
              console.log(`[setGraphAttr] ✅ ${tid} standard body/${propKey}=${val}`)
            }
          } else if (propKey === 'strokeWidth') {
            if (shape === 'shape-line') {
              tgt.attr('body/fill', 'transparent')
              tgt.attr('body/stroke', 'none')
              tgt.attr('line/strokeWidth', val)
              if (!tgt.attr('line/d')) {
                const { width, height } = tgt.getSize?.() || { width: 55, height: 2 }
                tgt.attr('line/d', `M0 ${height / 2} L${width} ${height / 2}`)
              }
            } else if (shape.startsWith('svg-node-')) {
              tgt.attr('svg-body/stroke-width', val)
            } else {
              tgt.attr('body/strokeWidth', val)
            }
          } else if (propKey === 'fontSize' || propKey === 'fontColor') {
            const sel = shape === 'custom-text' ? 'label' : 'text'
            const attrName = propKey === 'fontSize' ? 'fontSize' : 'fill'
            tgt.attr(`${sel}/${attrName}`, val)
          } else if (propKey === 'text') {
            if (shape === 'custom-text') tgt.attr('label/text', val)
            else if (shape === 'custom-button') tgt.attr('text/text', val)
            else tgt.attr('text/text', val)
          } else if (propKey === 'label') {
            try { tgt.attr('label/text', val) } catch { tgt.attr('text/text', val) }
          } else if (propKey === 'opacity') {
            tgt.attr('body/opacity', val)
          } else {
            tgt.attr(`body/${propKey}`, val)
            console.log(`[setGraphAttr] ✅ ${tid} fallback body/${propKey}=${val}`)
          }
        } else if (tgt.isEdge?.()) {
          if (propKey === 'stroke') tgt.attr('line/stroke', val)
          else if (propKey === 'strokeWidth') tgt.attr('line/strokeWidth', val)
          else if (propKey === 'dashed') {
            if (val) tgt.attr('line/strokeDasharray', '6 4')
            else tgt.attr('line/strokeDasharray', null)
          } else tgt.attr(`line/${propKey}`, val)
        }
      }

      // 遍历所有 target 执行
      targetIds.forEach(_applyToOne)
      break
    }
    case 'changeProperty': {
      // changeProperty：修改 cell.data 里的业务属性（如 fill/stroke/visible 等）
      // 快照恢复逻辑类似 setGraphAttr
      const changes = Array.isArray(av.propertyChanges) ? av.propertyChanges : []
      if (changes.length === 0) break
      changes.forEach((c: any) => {
        if (!c || !c.targetProperty) return
        const prop = String(c.targetProperty)
        const val = c.expectedValue !== undefined && c.expectedValue !== '' ? c.expectedValue : tagVal
        const targets: any[] = c.targetCellId
          ? [g?.getCellById?.(c.targetCellId)].filter(Boolean)
          : [cell]
        targets.forEach((tgt) => {
          const key = `${tgt.id}:${prop}`
          if (isRecover) {
            const snap = _changeOriginals.get(key)
            if (snap != null) {
              applyChangeProperty(tgt, prop, snap)
              _changeOriginals.delete(key)
              deps.showActionMessage?.(`♻️ 恢复 ${prop}=${snap}`)
            }
          } else {
            // 存快照（只存第一次）
            if (!_changeOriginals.has(key)) {
              const cur = _readCellPropValue(tgt, prop)
              _changeOriginals.set(key, cur)
            }
            applyChangeProperty(tgt, prop, val)
            deps.showActionMessage?.(`变更 ${prop}=${String(val)}`)
          }
        })
      })
      break
    }
    case 'playAudio': {
      const key = audioRefKey(trigger.id)
      if (isRecover) {
        // 恢复分支：停掉之前启动的音频
        const a = _activeAudios.get(key)
        if (a) { a.pause(); a.currentTime = 0; _activeAudios.delete(key) }
        console.log(`[playAudio] ♻️ STOP trigger=${trigger.id}`)
        break
      }
      if (!av.src || typeof Audio === 'undefined') {
        console.warn(`[playAudio] ⚠️ 跳过：src=${av.src || '(空)'} AudioAPI=${typeof Audio !== 'undefined'}`)
        break
      }
      // 幂等保护：正在播放同一个 trigger 的音频就跳过（alwaysOnMatch 每轮都会进来）
      const existing = _activeAudios.get(key)
      if (existing && !existing.paused && !existing.ended) {
        break
      }
      if (existing) {
        existing.pause()
        existing.currentTime = 0
        _activeAudios.delete(key)
      }
      const audio = new Audio(av.src)
      audio.loop = !!av.loop
      _activeAudios.set(key, audio) // 先存引用，失败会在 catch 里清掉让下次重试
      audio.play().then(() => {
        console.log(`[playAudio] ✅ PLAYING src=${av.src.substring(0, 60)} loop=${av.loop}`)
      }).catch((err) => {
        console.warn(`[playAudio] ❌ PLAY FAILED:`, err?.message || err,
          `（浏览器自动播放策略——用户点页面后下一轮 tick 自动重试）`)
        _activeAudios.delete(key) // 失败清引用 → 下一轮 alwaysOnMatch 继续进来重试
      })
      break
    }
    case 'startAnimation': {
      const g = deps.getGraph()
      const tid = av.targetCellId
      const target = g?.getCellById?.(tid)
      if (!target) {
        console.warn(`[startAnimation] ⚠️ targetCellId=${tid} NOT FOUND in graph`)
        break
      }
      if (isRecover) {
        console.log(`[startAnimation] ♻️ RECOVER stopCellAnimation cell=${tid} shape=${target.shape}`)
        stopCellAnimation(target, g)
      } else if (av.animateTemplate) {
        console.log(`[startAnimation] ✅ START template=${av.animateTemplate} cell=${tid} shape=${target.shape}`)
        startCellAnimation(target, av.animateTemplate, av.animateOptions || {}, g)
      } else {
        console.warn(`[startAnimation] ⚠️ 跳过：animateTemplate 为空`)
      }
      break
    }
    case 'stopAnimation': {
      const g = deps.getGraph()
      if (isRecover) {
        // 下降沿：恢复每个 cell 的 data.animation 初始配置
        console.log('[stopAnimation] ♻️ RECOVER → 恢复所有 cells 的 data.animation')
        try {
          const allCells = g?.getCells?.() || []
          allCells.forEach((cell: any) => applyAnimationFromData(cell, g))
        } catch (e) {
          console.warn('[stopAnimation] RECOVER 失败:', e)
        }
      } else {
        // 上升沿：扫全图清所有 anim- 开头的 class
        stopAllAnimations(g)
      }
      break
    }
    case 'httpRequest':
      if (av.url && typeof fetch !== 'undefined') {
        fetch(av.url, {
          method: av.method || 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: av.method && av.method !== 'GET' ? av.body : undefined,
        }).catch((e) => deps.showActionMessage?.(`HTTP 请求失败：${e?.message || e}`))
      }
      break
    case 'runScript':
      if (av.script) {
        try {
          new Function('tagVal', av.script)(tagVal)
        } catch (e: any) {
          deps.showActionMessage?.(`脚本执行失败：${e?.message || e}`)
        }
      }
      break
    case 'sendMsg': {
      // sendMsg：模板替换后通过 onActionTriggered 通知（在 switch 末尾统一 emit）
      const template = String(av.content || av.message || av.text || '')
      const ctx: Record<string, any> = {
        tagVal,
        device: binding?.device ?? '',
        dataPoint: binding?.dataPoint ?? '',
        cellLabel: cellData?.label ?? '',
        shape: cell?.shape ?? '',
        triggerId: trigger?.id ?? '',
        compareValue: trigger?.compareValue ?? '',
        operator: trigger?.operator ?? '',
      }
      const msg = template
        ? template.replace(/\$\{(\w+)\}/g, (_m, k) => String(ctx[k] ?? ''))
        : `${ctx.device} ${ctx.dataPoint} = ${tagVal}`
      // 直接 emit 带最终消息，不走 showActionMessage（避免双 toast）
      deps.onActionTriggered?.({
        cellId: cell.id,
        triggerId: trigger.id || '',
        actionType: 'sendMsg',
        actionValue: { ...av, message: msg },
        tagValue: tagVal,
        matched: !isRecover,
        isRecover,
        binding,
        triggerConfig: trigger,
        cellData,
      })
      break
    }
    default:
      break
  }
}

// ============ Hook ============

export const useBindingExecutor = (deps: BindingExecutorDeps) => {
  /** 记录各绑定的上次测点值（用于 once_change 跳变判断） */
  const lastValues = new Map<string, { tagVal: number | string | null }>()

  // 注：_originals / _snapshotOriginalAttrs / _restoreOriginalAttrs 已提升到模块顶层，
  // 因为 executeTrigger 是模块级函数，需要直接访问（ReferenceError 修复）

  /** 轮询定时器 */
  let pollTimer: ReturnType<typeof setInterval> | null = null
  /** 是否正在拉取 */
  let fetching = false
  /** 缓存的测点值（供 readTagValue 回退使用） */
  const tagValueCache = new Map<string, number | string | null>()

  /** 多状态自动切换暂停标记（调试面板手动测试时用） */
  let multiStatePaused = false
  /** 暂停多状态自动切换 */
  const pauseMultiState = () => { multiStatePaused = true }
  /** 恢复多状态自动切换 */
  const resumeMultiState = () => { multiStatePaused = false }

  /**
   * 键归一化：保持 key 原样透传。
   *
   * 之前版本对 device / dataPoint 做 camelCase→snake_case 转换（如 "iaH"→"ia_h"），
   * 但后端 realtime 接口原样透传设计器填写的名字，两边命名风格本来就一致，
   * toSnake 反而导致 normalizeToFlat 存的 key 和 tick 拼的 key 对不上。
   * 为彻底消除这类不一致风险，本函数保持 key 不变（identity）。
   */
  function normalizeKey(key: string): string {
    return key
  }

  /**
   * 将 fetchData 返回的任意格式归一化为扁平三段式 { "cellId:device:dataPoint": value }
   *
   * 支持多种输入变化：
   * - 格式 A 三段式 / 两段式
   * - 格式 B 分组
   * - key 里的 device/dataPoint 保持原样透传（不做命名风格转换）
   */
  function normalizeToFlat(data: any): Record<string, any> {
    const result: Record<string, any> = {}
    if (!data) return result

    // 格式 B：数组 [{ cellId, data: [...] }]
    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        if (!item?.cellId || !Array.isArray(item.data)) return
        item.data.forEach((d: any) => {
          if (!d?.device || !d?.dataPoint) return
          result[`${item.cellId}:${d.device}:${d.dataPoint}`] = d.value ?? null
        })
      })
      return result
    }

    // 扁平 object —— 区分两段式 vs 三段式
    if (typeof data === 'object') {
      Object.entries(data).forEach(([key, val]) => {
        if (typeof val === 'object' && val !== null) return
        const parts = key.split(':')
        if (parts.length >= 3) {
          // 三段或以上 → 已经是 cellId:device:dataPoint，直接保留
          result[key] = val
        } else if (parts.length === 2) {
          // 两段式 → 需要 graph binding 反查 cellId
          const twoKey = key
          const g = deps.getGraph?.()
          if (g) {
            const cells = g.getCells?.() || []
            cells.forEach((cell: any) => {
              const cellData = cell?.getData?.() || {}
              const bindings: any[] =
                cellData.binding && Array.isArray(cellData.binding.bindings)
                  ? cellData.binding.bindings
                  : []
              bindings.forEach((b: any) => {
                if (`${b.device}:${b.dataPoint}` === twoKey) {
                  result[`${cell.id}:${b.device}:${b.dataPoint}`] = val
                }
              })
            })
          } else {
            result[key] = val
          }
        } else {
          result[key] = val
        }
      })
    }
    return result
  }

  /** 从 fetchData 拉取并缓存全部测点值 */
  const fetchAndCache = async (): Promise<boolean> => {
    if (fetching) return false
    // 动态读取 fetchData（支持响应式更新）
    const fetcher = deps.fetchData
    if (!fetcher || typeof fetcher !== 'function') return false
    fetching = true
    try {
      const raw = await fetcher()
      const data = normalizeToFlat(raw)
      if (Object.keys(data).length > 0) {
        tagValueCache.clear()
        Object.entries(data).forEach(([key, val]) => {
          tagValueCache.set(key, val ?? null)
        })
        deps.onDataUpdate?.(data)
        return true
      }
      return false
    } catch (e) {
      console.warn('[useBindingExecutor] fetchData 失败:', e)
      return false
    } finally {
      fetching = false
    }
  }

  /** 启动自动轮询（interval ms，设 0 则不自动启动） */
  const startPolling = (interval: number = 1000): void => {
    stopPolling()
    if (interval <= 0) return
    // 立即拉取一次并执行 tick
    fetchAndCache().then((ok) => {
      if (ok) tick()
    })
    pollTimer = setInterval(async () => {
      const ok = await fetchAndCache()
      if (ok) tick()
    }, interval)
  }

  /** 停止自动轮询 */
  const stopPolling = (): void => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  /** 手动触发一次数据拉取 + 绑定执行 */
  const refresh = async (): Promise<void> => {
    const ok = await fetchAndCache()
    if (ok) tick()
  }

  /** 执行一次全部绑定（每轮数据刷新调用） */
  const tick = (): void => {
    const g = deps.getGraph()
    if (!g) return
    const cells = g.getCells?.() || []

    // ── Phase 1: 多状态元件独立处理 ──
    // 设计：dataPoint 是唯一事实源（设备测点名），pointCode 已废弃。
    // multiState 元件的 device + dataPoint 从 binding.bindings[] 里取，
    // stateRule 里的 ${point} 变量值就是该 dataPoint 对应的实时值。
    if (!multiStatePaused) {
      const multiStateParents = findMultiStateParents(g)
      multiStateParents.forEach((parent: any) => {
        const data = parent.getData?.() || {}
        const stateRule = data.pointBind?.stateRule
        if (!stateRule) return

        // 从 binding.bindings[] 取 device + dataPoint
        const bindings: any[] =
          data.binding && Array.isArray(data.binding.bindings) ? data.binding.bindings : []

        // 优先找 targetProperty='elementStateMapping' 的 binding；没有就用第一个
        const match =
          bindings.find((b: any) => b.targetProperty === 'elementStateMapping') || bindings[0]
        if (!match?.device || !match?.dataPoint) return

        // cacheKey 原样透传：后端 realtime 原样返回设计器填的 dataPoint 名（如 iaH、pf），
        // 前端 binding 里也存原始名——两边完全一致，不需要任何命名风格转换
        const cacheKey = `${parent.id}:${match.device}:${match.dataPoint}`
        const tagVal = tagValueCache.get(cacheKey)
        if (tagVal === null || tagVal === undefined) return

        applyMultiStateByPoint(g, parent, tagVal)
      })
    }

    // ── Phase 2: 普通图元绑定（fill / text / stroke / 触发器） ──
    cells.forEach((cell: any) => {
      const data = cell?.getData?.() || {}

      // 多状态元件已经在 Phase 1 处理完毕，跳过 binding 里的 elementStateMapping
      const isMultiStateEl = cell.isNode?.() && !!data.isMultiState

      // 绑定列表
      const config = data.binding
      const bindingsToApply: any[] = config && Array.isArray(config.bindings) ? config.bindings : []

      bindingsToApply.forEach((b: any) => {
        // 多状态元件的 elementStateMapping 已在 Phase 1 处理，跳过
        if (isMultiStateEl && b.templateType === 'elementStateMapping') return

        // 优先使用外部 readTagValue，回退到 fetchData 缓存，最后用 mock
        // cache key 原样透传：后端 realtime 和前端 binding 用完全相同的 device/dataPoint 原始名
        const cacheKey = `${cell.id}:${b.device}:${b.dataPoint}`
        const tagVal = deps.readTagValue
          ? deps.readTagValue(cell.id, b.device, b.dataPoint)
          : tagValueCache.has(cacheKey)
            ? (tagValueCache.get(cacheKey) ?? null)
            : mockTagValue(b.device, b.dataPoint, b.targetProperty)
        if (tagVal === null || tagVal === undefined) return

        // 1. 应用 JEXL 映射
        const shape = cell.shape || ''
        const hasButtonMapping = shape === 'custom-button' && (b.textMapping || b.styleMapping)

        if (b.mappingRules && !hasButtonMapping) {
          applyMapping(cell, b.mappingRules, tagVal, b.targetProperty)
        }
        if (hasButtonMapping) {
          applyButtonMappings(cell, b, tagVal)
        }
        if (shape === 'custom-text' && b.styleMapping) {
          applyTextStyleMapping(cell, b, tagVal)
        }

        // 2. 判断并执行触发器
        //    triggerMode 说明（与 bindingConfig.ts triggerModeOptions 对齐）：
        //      - 'once_change' : 上升沿（不满足→满足）或 下降沿（满足→不满足） 各触发一次
        //      - 'always'      : 每次 tick 都检查 matched（持续满足就重复执行）
        const triggers = Array.isArray(b.triggers) ? b.triggers : []
        triggers.forEach((t: any) => {
          if (t.enabled === false) return
          const key = `${cell.id}:${t.id}`
          const prev = lastValues.get(key)
          const matched = matchCondition(t.operator, t.compareValue, tagVal)
          const mode = t.triggerMode || 'once_change'

          let shouldRun = false
          let isRecover = false // true = 下降沿（值回到正常，需要复原）

          // ── actionType 分类（与 triggerMode 配合决定行为） ──
          // recoverable：下降沿自动恢复（值正常时反向执行）
          //   setGraphAttr / changeProperty  → 还原原始属性
          //   startAnimation / playAudio / playVideo → 停止动画/媒体
          // alwaysOnMatch：matched=true 时每轮都确认（handler 内部幂等，防重复创建）
          //   启动型 actionType 需要持续确认：首次可能因浏览器策略失败 → 用户交互后重试
          //   条件消失 → recoverable 自动触发 isRecover=true 反向执行
          const recoverable = [
            'setGraphAttr', 'changeProperty',
            'startAnimation', 'playAudio', 'playVideo',
            'stopAnimation',  // 下降沿恢复 cell 初始 animation 配置
          ].includes(t.actionType)
          const alwaysOnMatch = [
            'startAnimation', 'playAudio', 'playVideo',
          ].includes(t.actionType)

          // 模式判定：always 配置 OR alwaysOnMatch 类型 → 每轮确认
          const effectiveAlways = (mode === 'always') || alwaysOnMatch

          if (effectiveAlways) {
            // 持续确认模式：条件满足 → 确保执行态；条件消失且之前命中过 → 确保恢复态
            shouldRun = matched || (!!prev && !matched && isMatch(t, prev.tagVal))
            isRecover = !matched && !!prev && isMatch(t, prev.tagVal)
          } else {
            // once_change：只在边沿触发一次性动作（alert / addLog / jumpPage / httpRequest ...）
            const prevMatched = prev ? isMatch(t, prev.tagVal) : false
            if (matched && !prevMatched) {
              shouldRun = true
              isRecover = false
            } else if (!matched && prevMatched) {
              // 下降沿：对 recoverable 类型自动执行恢复（幂等启动型由 alwaysOnMatch 覆盖）
              shouldRun = recoverable
              isRecover = true
            }
          }

          // ── DEBUG 日志：所有有 trigger 的 binding 都打（不再只过滤 ib/ia） ──
          if (triggers.length > 0) {
            console.log(`[trigger:debug] ${b.device}.${b.dataPoint}:`,
              `tagVal=${tagVal} op=${t.operator} cmp=${t.compareValue} matched=${matched}`,
              `prev=${prev ? prev.tagVal : 'none'}`,
              `mode=${mode} shouldRun=${shouldRun} isRecover=${isRecover} actionType=${t.actionType}`,
              `cellId=${cell.id}`)
          }
          // ── END DEBUG ──

          lastValues.set(key, { tagVal })
          if (shouldRun) {
            console.log(`[trigger:${isRecover ? 'RECOVER' : 'FIRE'}] ${b.device}.${b.dataPoint} actionType=${t.actionType}`, t)
            executeTrigger(cell, t, tagVal, deps, b, isRecover)
          }
        })
      })
    })
    // Phase 1 新增：一轮 tick 结束后回调（外部可用于 flush 告警缓冲等）
    deps.onTickComplete?.()
  }

  /** 绑定测试（手动验证） */
  const runBindingTest = (val: number | string | null): any[] => {
    const report: any[] = []
    const g = deps.getGraph?.()
    const cells = g?.getCells?.() || []
    cells.forEach((cell: any) => {
      const data = cell?.getData?.() || {}

      // 事件配置（changeProperty）测试
      const evtCfg = data.eventConfig
      if (evtCfg?.enabled && Array.isArray(evtCfg.list)) {
        evtCfg.list.forEach((evt: any) => {
          if (!evt || evt.enabled === false) return
          const cond = evt.condition || {}
          const hasCond = cond?.relation && cond.relation !== 'none' && !!cond?.operator
          let matched = true
          if (hasCond) {
            try {
              matched = evalCondition(cell, cond)
            } catch {
              matched = false
            }
          }
          if (!matched) return
          if (evt.action === 'changeProperty') {
            const changes = Array.isArray(evt.propertyChanges) ? evt.propertyChanges : []
            changes.forEach((c: any) => {
              if (!c || !c.targetCellId || !c.targetProperty) return
              const target = g?.getCellById?.(c.targetCellId)
              const targetVal =
                c.expectedValue !== undefined && c.expectedValue !== '' ? c.expectedValue : val
              if (!target) {
                report.push({
                  cellId: cell.id,
                  device: '',
                  dataPoint: '',
                  targetProperty: c.targetProperty,
                  operator: cond?.operator || '',
                  compareValue: cond?.value || '',
                  matched: true,
                  actionLabel: `${c.targetProperty}=${String(targetVal)}（目标未找到）`,
                })
                return
              }
              applyChangeProperty(target, String(c.targetProperty), targetVal)
              report.push({
                cellId: cell.id,
                device: '',
                dataPoint: '',
                targetProperty: c.targetProperty,
                operator: cond?.operator || '',
                compareValue: cond?.value || '',
                matched: true,
                actionLabel: `修改 ${c.targetProperty}=${String(targetVal)}`,
              })
            })
          }
        })
      }

      // 绑定测试
      const config = data.binding
      const bindingsToApply: any[] = config && Array.isArray(config.bindings) ? config.bindings : []

      bindingsToApply.forEach((b: any) => {
        const shape = cell.shape || ''
        const hasButtonMapping = shape === 'custom-button' && (b.textMapping || b.styleMapping)

        if (b.mappingRules && !hasButtonMapping) {
          applyMapping(cell, b.mappingRules, val, b.targetProperty)
          report.push({
            cellId: cell.id,
            device: b.device,
            dataPoint: b.dataPoint,
            targetProperty: 'mapping',
            operator: '',
            compareValue: '',
            matched: true,
            actionLabel: 'JEXL 映射已应用',
          })
        }
        if (hasButtonMapping) {
          applyButtonMappings(cell, b, val)
          if (b.textMapping) {
            report.push({
              cellId: cell.id,
              device: b.device,
              dataPoint: b.dataPoint,
              targetProperty: 'text',
              operator: '',
              compareValue: '',
              matched: true,
              actionLabel: '按钮文本映射已应用',
            })
          }
          if (b.styleMapping) {
            report.push({
              cellId: cell.id,
              device: b.device,
              dataPoint: b.dataPoint,
              targetProperty: 'fill',
              operator: '',
              compareValue: '',
              matched: true,
              actionLabel: '按钮样式映射已应用',
            })
          }
        }
        if (shape === 'custom-text' && b.styleMapping) {
          applyTextStyleMapping(cell, b, val)
          report.push({
            cellId: cell.id,
            device: b.device,
            dataPoint: b.dataPoint,
            targetProperty: 'color',
            operator: '',
            compareValue: '',
            matched: true,
            actionLabel: '文本颜色映射已应用',
          })
        }

        // 触发器
        const triggers = Array.isArray(b.triggers) ? b.triggers : []
        triggers.forEach((t: any) => {
          if (t.enabled === false) return
          const hasCond = !!t.operator
          const matched = hasCond ? matchCondition(t.operator, t.compareValue, val) : true
          if (matched) {
            executeTrigger(cell, t, val, deps, b)
            report.push({
              cellId: cell.id,
              device: b.device,
              dataPoint: b.dataPoint,
              targetProperty: t.actionValue?.propKey || '',
              operator: t.operator || '',
              compareValue: t.compareValue,
              matched: true,
              actionLabel: triggerActionLabel[t.actionType] || t.actionType || '触发器',
            })
          }
        })
      })
    })
    return report
  }

  /** 重置状态 */
  const reset = (): void => {
    lastValues.clear()
    tagValueCache.clear()
    stopPolling()
  }

  return { tick, reset, runBindingTest, startPolling, stopPolling, refresh, pauseMultiState, resumeMultiState }
}

// ============ 辅助 ============

const isMatch = (t: any, prevVal: number | string | null): boolean =>
  matchCondition(t.operator, t.compareValue, prevVal)

/** mock 测点值（实际项目替换为后端/WebSocket 数据） */
let mockPollCounter = 0
const mockTagValue = (
  device: string,
  dataPoint: string,
  targetProperty?: string,
): number | string => {
  mockPollCounter++
  if (targetProperty === 'fill' || targetProperty === 'stroke') {
    const colors = ['#165dff', '#00b42a', '#ff7d00', '#f53f3f', '#722ed1', '#13c2c2', '#eb2f96']
    const seed = `${device}-${dataPoint}`.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return colors[(seed + mockPollCounter) % colors.length]
  }
  const seed = `${device}-${dataPoint}`.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return 50 + ((seed + mockPollCounter) % 150)
}
