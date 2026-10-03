/**
 * 多状态元件工具函数：状态显隐切换 + 测点驱动自动切换 + JEXL 沙箱隔离。
 * 与普通组合共用 X6 原生 parent-child 关联机制。
 */

/** 生成唯一状态 ID */
export const genStateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 's-' + Date.now() + '-' + Math.floor(Math.random() * 100000)
}

/** 查找画布中所有多状态父节点 */
export const findMultiStateParents = (graph: any): any[] => {
  if (!graph?.getCells) return []
  return graph.getCells().filter((c: any) => c.isNode?.() && c.getData?.()?.isMultiState)
}
/**
 * 获取多状态父节点下的全部子图元。
 * 只依赖 data.parent 字段（toJSON/fromJSON 链路保证写入），
 * 不依赖 X6 原生 getChildren() —— 覆盖 fromJSON 后关联尚未重建、
 * 或 graph 引用没变导致 Vue computed 缓存旧值等场景。
 */
export const getMultiStateChildren = (graph: any, parent: any): any[] => {
  if (!graph?.getCells || !parent) return []
  const parentId = parent.id
  if (!parentId) return []
  return graph
    .getCells()
    .filter((c: any) => c?.isNode?.() && c.id !== parentId)
    .filter((c: any) => {
      // data.parent 是 toJSON/fromJSON 链路写入的（toX6JSON L64 写 cell.parent，
      // fromX6JSON L143 写 data.parent），最可靠
      if (c.getData?.()?.parent === parentId) return true
      // X6 原生 parent-child 关联（patchedFromJSON 已重建，但兜底还是查一下）
      if (c.getParent?.()?.id === parentId) return true
      return false
    })
}

/**
 * 按 activeStateId 刷新多状态父节点下各子图元的显隐：
 * 当前激活状态 cellIds 中的子图元可见，其余隐藏。使用 X6 原生 setVisible()。
 */
export const applyMultiStateVisibility = (graph: any, parent: any): void => {
  if (!parent?.getData?.()?.isMultiState) return
  const data = parent.getData?.() || {}
  const activeState = (data.stateList || []).find((s: any) => s.stateId === data.activeStateId)
  const visibleIds = new Set(activeState?.cellIds || [])
  getMultiStateChildren(graph, parent).forEach((ch: any) => {
    try {
      ch.setVisible?.(visibleIds.has(ch.id))
    } catch {
      /* 忽略 */
    }
  })
}

/** JEXL 表达式归一化：把 ${point}/${tagVal} 统一为 point 变量 */
const normalizedPointExpr = (expr: string): string =>
  String(expr)
    .replace(/\$\{point\}/g, 'point')
    .replace(/\$\{tagVal\}/g, 'point')
    .trim()

/** 表达式最大长度限制（防超长注入/DoS） */
const MAX_EXPR_LENGTH = 500

/**
 * 危险关键字黑名单（双保险，防止绕过白名单）。
 */
const DANGEROUS_RE =
  /\b(?:new|eval|Function|this|window|document|globalThis|process|require|import|constructor|prototype|__proto__|self|top|parent)\b/

/**
 * JEXL 沙箱白名单校验：整个表达式必须只由安全 token 组成。
 * 允许：point / true / false / null、数字、比较/逻辑/算术运算符、括号、字符串字面量、空白。
 * 拒绝：任何函数调用、属性访问（. 或 []）、字母标识符（除 point/true/false/null）等。
 */
const SAFE_TOKEN_RE =
  /^(?:(?:point|true|false|null)|(?:\d+(?:\.\d+)?)|(?:===|!==|==|!=|>=|<=|>|<|&&|\|\||!|\+|-|\*|\/|%|\(|\)|\s)|(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))*$/s

/**
 * 校验单条 JEXL 判断表达式：白名单 + 语法双重校验（不执行，point 以 1 试算）。
 * 返回 { ok, message }。
 */
export const validateMultiStateJexl = (expr: string): { ok: boolean; message: string } => {
  if (!expr.trim()) return { ok: true, message: '空表达式，不参与切换' }
  const code = normalizedPointExpr(expr)
  if (code.length > MAX_EXPR_LENGTH) {
    return { ok: false, message: '表达式过长' }
  }
  if (DANGEROUS_RE.test(code)) {
    return { ok: false, message: '包含危险关键字，已拦截' }
  }
  if (!SAFE_TOKEN_RE.test(code)) {
    return { ok: false, message: '包含不允许的字符/函数调用，仅支持 point 与比较逻辑运算' }
  }
  try {
    new Function('point', `return Boolean(${code});`)(1)
    return { ok: true, message: '语法通过' }
  } catch (e: any) {
    return { ok: false, message: `语法错误：${e?.message ?? '未知错误'}` }
  }
}

/**
 * 安全求值：白名单 + 危险关键字校验通过后，在受限作用域执行并返回布尔结果。
 * 校验不通过或执行异常一律返回 false（安全失败，不抛错）。
 * 供运行时驱动与编辑器"模拟测点测试"共用，保证两处行为一致且均受沙箱保护。
 */
export const safeEvalPointExpr = (expr: string, pointValue: number | string | null): boolean => {
  if (!expr || !expr.trim()) return false
  const code = normalizedPointExpr(expr)
  if (code.length > MAX_EXPR_LENGTH) return false
  if (DANGEROUS_RE.test(code)) return false
  if (!SAFE_TOKEN_RE.test(code)) return false
  try {
    return Boolean(new Function('point', `return (${code});`)(pointValue))
  } catch {
    return false
  }
}

/**
 * 运行时测点驱动：根据 pointBind.pointCode 对应测点值，遍历各状态的 JEXL 表达式，
 * 命中第一个即把 activeStateId 切换为该状态并刷新子图元显隐。供测点实时数据流调用。
 * 所有表达式经沙箱白名单 + try-catch 安全求值，无法注入危险代码。
 */
export const applyMultiStateByPoint = (
  graph: any,
  parent: any,
  pointValue: number | string | null,
): void => {
  if (!parent?.getData?.()?.isMultiState) return
  const data = parent.getData?.() || {}
  const pb = data.pointBind
  if (!pb?.stateRule) return
  for (const state of data.stateList || []) {
    const expr = pb.stateRule[state.stateId]
    if (!expr || !expr.trim()) continue
    if (safeEvalPointExpr(expr, pointValue)) {
      data.activeStateId = state.stateId
      parent.setData?.({ ...data }, { overwrite: true })
      applyMultiStateVisibility(graph, parent)
      break
    }
  }
}
