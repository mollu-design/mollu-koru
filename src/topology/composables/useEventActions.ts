/**
 * 事件动作执行逻辑（供预览页使用）。
 *
 * 职责：
 *  - 触发条件求值（evalCondition）
 *  - 各事件动作的执行（打开页面 / 发送指令 / 显示弹窗 / 控制设备 / 更改属性 / 自定义代码）
 *  - 节点事件绑定（单击/双击/移入/键盘等）
 *
 * 通过依赖注入解耦：graph 与宿主回调由外部传入。
 */
import type { Cell } from '@antv/x6'
import { getNodeProp } from './nodeProps'
import { applyCellAnimation, stopCellAnimations } from './useAnimation'
import { buildScriptContext } from './useScriptLib'

// ============ 依赖接口 ============

export interface EventActionDeps {
  /** 获取当前 Graph 实例 */
  getGraph: () => any
  /** 展示动作提示消息 */
  showActionMessage: (msg: string) => void
  /** 请求弹出确认弹窗 */
  requestConfirm: (req: ConfirmRequest) => void
  /** 发送指令接口 */
  sendCommandApi?: (command: string) => void | Promise<void>
  /** 控制设备接口 */
  controlDeviceApi?: (device: {
    deviceId: string
    command: string
    param: string
  }) => void | Promise<void>
  /** 显示弹窗接口 */
  showDialogApi?: (content: string) => void | Promise<void>
  /** 设备下拉选项 [{ label, value }]，用于把 deviceId 映射到中文名称。
   *  既可以直接传数组，也可以传 getter 函数（延迟求值，适合异步加载场景）。
   */
  deviceOptions?: { label: string; value: string }[] | (() => { label: string; value: string }[])
  /** 事件订阅回调（对应 $topoEventCallBack）：type + 当前图元 + 额外参数 */
  eventBus?: (type: string, item: any, ...extras: any[]) => void
  /** 图元事件回调：每次节点事件触发时调用 */
  onCellEvent?: (cell: Cell, eventType: string, rawEvent?: any) => void
  /** 自定义代码执行日志回调 */
  onCustomCodeExec?: (level: 'info' | 'warn' | 'error', msg: string) => void
  /** 外部前置请求 API：返回 true 表示成功，false/throw 表示失败（放弃后续动作） */
  outerRequestApi?: (config: OuterRequestRuntimeConfig) => Promise<boolean>
  /** 外部请求结果回调（通知宿主） */
  onOuterRequestResult?: (result: OuterRequestResult) => void
}

/** 运行时外部请求配置（传递给宿主 outerRequestApi） */
export interface OuterRequestRuntimeConfig {
  enable: boolean
  /** 当前图元 */
  node: Cell
  /** 事件配置项（完整，宿主自行决定请求内容） */
  eventItem: any
  /** 宿主可能配置的附加信息 */
  url?: string
  method?: string
  timeout?: number
  headers?: Record<string, string>
  body?: string
}

/** 外部请求结果 */
export interface OuterRequestResult {
  evtId: string
  success: boolean
  durationMs: number
  error?: string
}

export interface ConfirmRequest {
  kind: 'showDialog' | 'sendCommand' | 'controlDevice' | 'openDialog'
  title: string
  content: string
  confirmText?: string
  onConfirm: () => void
  /** 可选：来源 trigger 上下文（confirm 事件会带回） */
  cellId?: string
  triggerId?: string
  actionType?: string
  tagValue?: number | string | null
  /** 可选：controlDevice 专用结构化数据，Modal 可用卡片美化渲染 */
  devicePayload?: {
    deviceId: string
    deviceName?: string
    command: string
    param: string
    cmdObj?: any
    paramObj?: any
  }
}

// ============ 动作执行器 ============

type ActionExecutor = (node: Cell, evt: any, deps: EventActionDeps) => string

/** 打开页面 */
const execOpenUrl: ActionExecutor = (_node, evt) => {
  const url = String(evt.actionParam ?? '')
  if (url) window.open(url, '_blank')
  return url ? `打开页面：${url}` : ''
}

/** 发送指令 */
const execSendCommand: ActionExecutor = (node, evt, deps) => {
  const cmd = String(evt.actionParam ?? '')
  if (!cmd) return ''
  deps.requestConfirm({
    kind: 'sendCommand',
    title: '发送指令',
    content: cmd,
    confirmText: '发送',
    cellId: node?.id || '',
    triggerId: evt?.id || '',
    actionType: 'sendCommand',
    tagValue: evt?.type || null,
    onConfirm: () => deps.sendCommandApi?.(cmd),
  })
  return ''
}

/** 显示弹窗 */
const execShowDialog: ActionExecutor = (node, evt, deps) => {
  const msg = String(evt.actionParam ?? '') || '显示弹窗'
  deps.requestConfirm({
    kind: 'showDialog',
    title: '消息提示',
    content: msg,
    confirmText: '知道了',
    cellId: node?.id || '',
    triggerId: evt?.id || '',
    actionType: 'showDialog',
    tagValue: evt?.type || null,
    onConfirm: () => deps.showDialogApi?.(msg),
  })
  return ''
}

/** 尝试 JSON.parse，失败返回 null */
const tryParseJson = (str: string): any | null => {
  if (!str) return null
  try { return JSON.parse(str) } catch { return null }
}

/** 控制设备 */
const execControlDevice: ActionExecutor = (node, evt, deps) => {
  const device = {
    deviceId: String(evt.deviceId ?? ''),
    command: String(evt.deviceCommand ?? ''),
    param: String(evt.deviceParam ?? ''),
  }
  if (!device.command && !device.deviceId) return ''
  const cmdObj = tryParseJson(device.command) || undefined
  const paramObj = tryParseJson(device.param) || undefined
  // 从 deviceOptions 查找中文名称（支持数组或 getter）
  const opts = typeof deps.deviceOptions === 'function' ? deps.deviceOptions() : (deps.deviceOptions || [])
  const deviceName = opts.find((o) => o.value === device.deviceId)?.label
  // content 保留原始拼接（纯文本 fallback），美化交给 Modal 按 devicePayload 渲染
  const parts = [`设备：${deviceName ? `${deviceName}（${device.deviceId}）` : device.deviceId || '未指定'}`, `指令：${device.command}`]
  if (device.param) parts.push(`参数：${device.param}`)
  deps.requestConfirm({
    kind: 'controlDevice',
    title: '设备操作确认',
    content: parts.join('\n'),
    confirmText: '确认执行',
    cellId: node?.id || '',
    triggerId: evt?.id || '',
    actionType: 'controlDevice',
    tagValue: evt?.type || null,
    devicePayload: { ...device, deviceName, cmdObj, paramObj },
    onConfirm: () => deps.controlDeviceApi?.(device),
  })
  return ''
}

/** 执行自定义代码（对齐原始 webtopo 的 buildScriptContext） */
const execCustomCode: ActionExecutor = (node, evt, deps) => {
  const codes = Array.isArray(evt.codes) ? evt.codes : []
  if (codes.length === 0) {
    deps.onCustomCodeExec?.(
      'warn',
      '事件动作为 customCode 但 codes 数组为空，请在属性面板中添加代码段',
    )
    return ''
  }
  const graph = deps.getGraph()
  const ctx = buildScriptContext({
    item: node,
    graph,
    args: { type: evt?.type, action: evt?.action },
    eventBus: deps.eventBus,
    logCallback: deps.onCustomCodeExec,
  })
  const ctxKeys = Object.keys(ctx)
  const ctxValues = Object.values(ctx)
  let successCount = 0
  codes.forEach((code: string, idx: number) => {
    if (!code || !code.trim()) return
    try {
      const fn = new Function(...ctxKeys, code)
      fn(...ctxValues)
      successCount++
      deps.onCustomCodeExec?.('info', `执行代码段${idx + 1}成功：${code.substring(0, 60)}`)
    } catch (e) {
      console.warn(`[execCustomCode] 第${idx + 1}段代码执行失败：`, code, e)
      deps.onCustomCodeExec?.(
        'error',
        `第${idx + 1}段执行失败：${code.substring(0, 60)} — ${(e as Error).message}`,
      )
    }
  })
  if (successCount === 0) return ''
  return `执行自定义代码（${successCount}/${codes.length} 段成功）`
}

/** 无动作 */
const execNone: ActionExecutor = (_node, evt) => `触发事件：${evt.type}`

/** 动作 → 执行器 注册表 */
const ACTION_EXECUTORS: Record<string, ActionExecutor> = {
  openUrl: execOpenUrl,
  sendCommand: execSendCommand,
  showDialog: execShowDialog,
  controlDevice: execControlDevice,
  customCode: execCustomCode,
  none: execNone,
}

// ============ 属性读取与比较 ============

/** 读取节点当前属性值 */
export function readNodeProp(cell: Cell, field: string): any {
  const data = (cell as any).getData?.() || {}
  switch (field) {
    case 'label':
    case 'text':
      return (cell as any).attr?.('label/text') ?? data.label ?? ''
    case 'fill':
    case 'stroke':
    case 'strokeWidth': {
      const shape = (cell as any).shape || ''
      const sel =
        typeof shape === 'string' && shape.startsWith('svg-node-')
          ? 'svg-body'
          : shape === 'shape-line'
            ? 'line'
            : 'body'
      return (cell as any).attr?.(`${sel}/${field}`) ?? data[field] ?? ''
    }
    case 'fontColor':
      return (cell as any).attr?.('label/fill') ?? data.fontColor ?? ''
    case 'x':
      return (cell as any).getPosition?.()?.x ?? data.x ?? 0
    case 'y':
      return (cell as any).getPosition?.()?.y ?? data.y ?? 0
    case 'width':
      return (cell as any).getSize?.()?.width ?? data.width ?? 0
    case 'height':
      return (cell as any).getSize?.()?.height ?? data.height ?? 0
    case 'angle':
      return ((((cell as any).getAngle?.() ?? 0) % 360) + 360) % 360
    default:
      return data[field]
  }
}

/** 数值/文本比较运算 */
export function compareValue(operator: string, actual: any, expect: any): boolean {
  const op = String(operator || '==')
  if (op === '==') return String(actual) === String(expect)
  if (op === '!=') return String(actual) !== String(expect)
  const a = Number(actual)
  const b = Number(expect)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  switch (op) {
    case '>':
      return a > b
    case '<':
      return a < b
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    default:
      return false
  }
}

/** 判断触发条件是否满足 */
export function evalCondition(
  cell: Cell,
  condition: any,
  graph?: any,
  eventBus?: (type: string, item: any, ...extras: any[]) => void,
): boolean {
  const c = condition || {}

  // 无条件：直接返回 true（同时兼容残留 field 数据的情况）
  if (c.relation === 'none') return true

  // 自定义代码条件
  if (c.relation === 'custom-code') {
    const codes = Array.isArray(c.codes) ? c.codes : []
    if (codes.length === 0) return true
    const ctx = buildScriptContext({
      item: cell,
      graph,
      args: { relation: 'custom-code' },
      eventBus,
    })
    const ctxKeys = Object.keys(ctx)
    const ctxValues = Object.values(ctx)
    return codes.every((code: string) => {
      if (!code || !code.trim()) return true
      try {
        const fnExpr = new Function(...ctxKeys, `"use strict"; return (${code});`)
        return !!fnExpr(...ctxValues)
      } catch {
        try {
          const fnStmt = new Function(...ctxKeys, `"use strict";\n${code}\nreturn true;`)
          return !!fnStmt(...ctxValues)
        } catch {
          return false
        }
      }
    })
  }

  const field = String(c.field ?? '')
  if (!field || field === '自身') return true
  const actual = readNodeProp(cell, field)
  return compareValue(String(c.operator ?? '=='), actual, c.value)
}

/** 解析条件判断的目标 cell */
export function resolveConditionCell(
  triggerNode: Cell,
  targetNode: string | undefined,
  graph?: any,
): Cell {
  if (!targetNode || targetNode === '__self__') return triggerNode
  try {
    let target = graph?.getCellById?.(targetNode)
    if (!target && graph?.getCells) {
      target = graph.getCells().find((c: any) => c && String(c.id) === String(targetNode))
    }
    return target || triggerNode
  } catch {
    return triggerNode
  }
}

// ============ 更改属性 ============

/** 把节点指定属性改为目标值 */
export function applyChangeProperty(cell: Cell, property: string, value: any): void {
  if (!property) return
  // 空值 / undefined 不应用——避免把 fill/stroke 设成空字符串或 'undefined'
  if (value === undefined || value === null || value === '') return
  const prop = getNodeProp(property)
  const target = value
  const data = (cell as any).getData?.() || {}

  switch (property) {
    case 'x':
    case 'y': {
      const pos = (cell as any).getPosition?.() || { x: 0, y: 0 }
      if (property === 'x') (cell as any).position?.(Number(target), pos.y)
      else (cell as any).position?.(pos.x, Number(target))
      break
    }
    case 'width':
    case 'height': {
      const size = (cell as any).getSize?.() || { width: 0, height: 0 }
      if (property === 'width') (cell as any).resize?.(Number(target), size.height)
      else (cell as any).resize?.(size.width, Number(target))
      break
    }
    case 'angle': {
      if (typeof (cell as any).prop === 'function') {
        const deg = ((Number(target) % 360) + 360) % 360
        ;(cell as any).prop('angle', deg)
      }
      break
    }
    case 'visible': {
      // X6 v3: visible 是 getter/setter 属性（非方法），用 setVisible() 或直接赋值
      const show = target === true || String(target) === 'true' || target === '1'
      if (typeof (cell as any).setVisible === 'function') {
        ;(cell as any).setVisible(show)
      } else {
        // 兜底：使用属性 setter
        ;(cell as any).visible = show
      }
      break
    }
    case 'fill':
    case 'stroke':
    case 'strokeWidth': {
      const shape = (cell as any).shape || ''
      const isSvgNode = typeof shape === 'string' && shape.startsWith('svg-node-')
      const mainSel = isSvgNode ? 'svg-body' : shape === 'shape-line' ? 'line' : 'body'
      if (isSvgNode) {
        // svg-node 特殊处理：
        // 1. 始终同步 color，让 SVG 内部 currentColor 的元素跟随
        // 2. fill 同时作用于 fill + stroke（兼顾实心填充与描边轮廓两种 SVG 符号）
        // 3. stroke 独立控制 stroke
        if (property !== 'strokeWidth') {
          ;(cell as any).attr?.(`${mainSel}/color`, String(target))
        }
        if (property === 'fill') {
          ;(cell as any).attr?.(`${mainSel}/fill`, String(target))
          ;(cell as any).attr?.(`${mainSel}/stroke`, String(target))
        } else if (property === 'stroke') {
          ;(cell as any).attr?.(`${mainSel}/stroke`, String(target))
        } else {
          ;(cell as any).attr?.(`${mainSel}/stroke-width`, Number(target))
        }
      } else {
        const sel = `${mainSel}/${property}`
        if ((cell as any).attr)
          (cell as any).attr(sel, property === 'strokeWidth' ? Number(target) : String(target))
      }
      break
    }
    case 'fontColor': {
      if ((cell as any).attr) (cell as any).attr('label/fill', String(target))
      break
    }
    case 'label':
    case 'text': {
      if ((cell as any).attr) (cell as any).attr('label/text', String(target))
      break
    }
    case 'lineDashed': {
      if ((cell as any).shape === 'shape-line' && (cell as any).attr) {
        const dashed = target === 'dashed' || String(target) === 'true'
        ;(cell as any).attr('line/strokeDasharray', dashed ? '6 4' : null)
      }
      break
    }
    case 'lineAnim': {
      if ((cell as any).shape === 'shape-line' && (cell as any).attr) {
        const val = String(target || 'none')
        const cur = String((cell as any).attr('line/className') || '')
        const others = cur
          .split(/\s+/)
          .filter((c) => c && !/^shape-line-anim-(flow|bead|trail|current)$/.test(c))
          .join(' ')
        const next =
          val === 'none' ? others : [others, `shape-line-anim-${val}`].filter(Boolean).join(' ')
        ;(cell as any).attr('line/className', next || null)
      }
      break
    }
    case 'leftText':
    case 'rightText': {
      if ((cell as any).attr) (cell as any).attr(`${property}/text`, String(target))
      break
    }
    case 'splitRatio': {
      if (typeof (cell as any).updateData === 'function') {
        ;(cell as any).updateData({ splitRatio: Number(target) })
      }
      break
    }
    case 'nodeAnim': {
      // 切换节点动画模板：更新 data.animation 并重新应用动画
      const templateId = String(target || 'none')
      if (typeof (cell as any).replaceData === 'function') {
        const curData = (cell as any).getData?.() || {}
        const curAnim = curData.animation || { enabled: false, templateId: 'none', options: {} }
        const newAnim =
          templateId === 'none'
            ? { enabled: false, templateId: 'none', options: {} }
            : { ...curAnim, enabled: true, templateId }
        ;(cell as any).replaceData({ ...curData, animation: newAnim })
      }
      // 立即应用/停止动画
      if (templateId === 'none') {
        stopCellAnimations(cell)
      } else {
        applyCellAnimation(cell, { enabled: true, templateId: templateId as any, options: {} })
      }
      break
    }
    default: {
      if (typeof (cell as any).replaceData === 'function') {
        ;(cell as any).replaceData({
          ...data,
          [property]: prop?.kind === 'number' ? Number(target) : target,
        })
      }
    }
  }
}

// ============ 脚本上下文已迁移至 useScriptLib.ts 的 buildScriptContext ============

// ============ 动作执行 ============

/** 执行单条事件动作 */
export function executeSingleAction(node: Cell, evt: any, deps: EventActionDeps): string {
  if (evt.action === 'changeProperty') {
    const changes = Array.isArray(evt.propertyChanges) ? evt.propertyChanges : []
    const g = deps.getGraph()
    const summary: string[] = []
    changes.forEach((c: any) => {
      if (!c || !c.targetCellId || !c.targetProperty) return
      let target: Cell | undefined
      if (c.targetCellId === node.id) {
        target = node
      } else {
        target = g?.getCellById(c.targetCellId) as Cell | undefined
      }
      if (!target) {
        summary.push(`${c.targetCellId}.${c.targetProperty}=? (未找到)`)
        return
      }
      applyChangeProperty(
        target,
        String(c.targetProperty),
        c.expectedValue !== undefined && c.expectedValue !== '' ? c.expectedValue : undefined,
      )
      // expectedValue 为空时显示原始值（避免 fill= 空 让用户困惑）
      const dispVal = c.expectedValue !== undefined && c.expectedValue !== '' ? c.expectedValue : '(未配置值)'
      summary.push(
        `${readNodeProp(target, 'label') || target.id}.${c.targetProperty}=${dispVal}`,
      )
    })
    return summary.length > 0 ? `已更改属性：${summary.join('；')}` : `触发事件：${evt.type}`
  }

  const executor = ACTION_EXECUTORS[evt.action] || execNone
  return executor(node, evt, deps)
}

// ============ Hook 入口 ============

/**
 * 构建运行时外部请求配置（将 EventItem.outerRequest + node + 原始 evt 打包传给宿主）。
 */
function buildOuterRequestRuntimeConfig(evt: any, node: Cell): OuterRequestRuntimeConfig | null {
  const cfg = evt?.outerRequest
  if (!cfg || !cfg.enable) return null

  // 解析宿主可能配置的附加字段（向后兼容旧数据）
  let headers: Record<string, string> | undefined
  if (cfg.headers) {
    try {
      headers = JSON.parse(cfg.headers)
    } catch {
      /* ignore */
    }
  }
  let body: string | undefined
  if (cfg.body) {
    try {
      body = JSON.stringify(JSON.parse(cfg.body))
    } catch {
      body = cfg.body
    }
  }

  return {
    enable: true,
    node,
    eventItem: evt,
    url: cfg.url,
    method: cfg.method,
    timeout: cfg.timeout,
    headers,
    body,
  }
}

/**
 * 执行外部前置请求：委托给宿主 outerRequestApi。
 * 宿主未提供时跳过（不阻塞后续动作）。
 */
async function executeOuterRequest(
  cfg: OuterRequestRuntimeConfig,
  deps: EventActionDeps,
  evtId: string,
): Promise<boolean> {
  const start = performance.now()

  if (!deps.outerRequestApi) {
    console.warn(
      '[handleEventAction] outerRequest 已开启，但宿主未提供 outerRequestApi，跳过前置请求',
    )
    return true
  }

  try {
    const ok = await deps.outerRequestApi(cfg)
    deps.onOuterRequestResult?.({
      evtId,
      success: !!ok,
      durationMs: Math.round(performance.now() - start),
    })
    return !!ok
  } catch (e: any) {
    deps.onOuterRequestResult?.({
      evtId,
      success: false,
      error: e?.message || String(e),
      durationMs: Math.round(performance.now() - start),
    })
    return false
  }
}

// ============ Hook 入口 ============

/**
 * 事件动作 Hook：提供动作执行、条件判断与节点事件绑定。
 */
export function useEventActions(deps: EventActionDeps) {
  /** 触发指定类型的节点事件（异步：含前置请求） */
  const handleEventAction = async (node: Cell, eventType: string) => {
    const data = (node as any).getData?.() || {}
    const config = data.eventConfig
    if (!config || !config.enabled || !Array.isArray(config.list)) {
      // 事件未配置或已启用，跳过（静默返回，避免控制台噪音）
      return
    }
    for (const evt of config.list) {
      if (!evt || evt.enabled === false) continue
      if (String(evt.type ?? 'click') !== eventType) continue
      const targetRef = evt.condition?.targetCellId || evt.targetNode
      const condCell = resolveConditionCell(node, targetRef, deps.getGraph())
      const condPass = evalCondition(condCell, evt.condition, deps.getGraph(), deps.eventBus)
      if (!condPass) {
        console.debug('[handleEventAction] 条件未满足，跳过事件：', evt.id, evt.condition)
        continue
      }

      // ── 前置外部请求 ──
      const outerCfg = buildOuterRequestRuntimeConfig(evt, node)
      if (outerCfg?.enable) {
        const ok = await executeOuterRequest(outerCfg, deps, evt.id)
        if (!ok) {
          console.warn('[handleEventAction] 前置请求失败，放弃执行：', evt.id, outerCfg.url)
          continue
        }
      }

      console.debug('[handleEventAction] 执行事件：', evt.id, 'action=', evt.action)
      const msg = executeSingleAction(node, evt, deps)
      if (msg) deps.showActionMessage(msg)
    }
  }

  /** 绑定节点事件 */
  const bindNodeEvents = () => {
    const g = deps.getGraph()
    if (!g) return
    // 核心交互事件：触发 onCellEvent 回调 + 事件动作执行
    const primaryMappings: Array<[string, string]> = [
      ['node:click', 'click'],
      ['node:dblclick', 'dblclick'],
    ]
    // 辅助调试事件：仅执行事件动作（绑定配置），不触发 onCellEvent 回调
    const debugMappings: Array<[string, string]> = [
      ['node:mouseenter', 'mouseenter'],
      ['node:mouseleave', 'mouseleave'],
      ['node:mousedown', 'mousedown'],
      ['node:mouseup', 'mouseup'],
      ['node:mousemove', 'mousemove'],
      ['node:mouseover', 'mouseover'],
      ['node:mouseout', 'mouseout'],
    ]
    primaryMappings.forEach(([event, type]) => {
      g.on(event, (evt: { node: Cell; e?: any }) => {
        const { node } = evt
        // 通知外部监听器（真实回调）
        deps.onCellEvent?.(node, type, evt)
        // 执行事件配置动作（异步，含前置请求）
        handleEventAction(node, type).catch((e) =>
          console.error('[handleEventAction] 未捕获异常:', e),
        )
      })
    })
    debugMappings.forEach(([event, type]) => {
      g.on(event, (evt: { node: Cell; e?: any }) => {
        const { node } = evt
        // 仅执行事件配置动作，不触发 onCellEvent 回调
        handleEventAction(node, type).catch((e) =>
          console.error('[handleEventAction] 未捕获异常:', e),
        )
      })
    })
  }

  return {
    handleEventAction,
    bindNodeEvents,
    evalCondition,
    applyChangeProperty,
    readNodeProp,
  }
}
