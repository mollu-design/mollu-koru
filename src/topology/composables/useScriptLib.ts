/**
 * 脚本内置变量/函数元数据
 *
 * 一源三用：
 * 1. 代码编辑器变量提示（hover 提示 + 语法校验）
 * 2. 运行时注入上下文对象（new Function 形参注入）
 * 3. TS 类型提示（通过 tsDeclare 字段）
 *
 * 新增内置变量流程：
 *   1. 在 scriptInnerLib 数组增加一条配置（name / type / detail / tsDeclare）
 *   2. 在 buildScriptContext() 中增加运行时实现
 *   → 无需修改其他代码，自动生效
 */
import { Message } from '@arco-design/web-vue'

export interface ScriptLibMeta {
  name: string
  type: 'variable' | 'function'
  detail: string
  tsDeclare: string
}

/** 脚本内置变量元数据（供 UI 展示 + 代码提示） */
export const scriptInnerLib: ScriptLibMeta[] = [
  {
    name: '$topoArgs',
    type: 'variable',
    detail: '默认回调参数，事件触发原始参数集合',
    tsDeclare: 'declare var $topoArgs: Record<string, any>;',
  },
  {
    name: '$topoItem',
    type: 'variable',
    detail: '当前触发事件的图元对象（X6 Cell）',
    tsDeclare: 'declare var $topoItem: Record<string, any>;',
  },
  {
    name: '$topoMessage',
    type: 'variable',
    detail: '消息提示（success / error / warning）',
    tsDeclare: `declare var $topoMessage: {
      success(msg: string): void
      error(msg: string): void
      warning(msg: string): void
    };`,
  },
  {
    name: '$topoEventCallBack',
    type: 'function',
    detail: '触发外部订阅回调（type + 当前图元 + 额外参数）',
    tsDeclare:
      'declare function $topoEventCallBack(type: string, item: any, ...extras: any[]): void;',
  },
  {
    name: '$topoCanvas',
    type: 'variable',
    detail: '当前画布实例（AntV X6 Graph）',
    tsDeclare: 'declare var $topoCanvas: Record<string, any>;',
  },
  {
    name: '$topoStore',
    type: 'variable',
    detail: '全局业务状态，读写全局变量',
    tsDeclare: 'declare var $topoStore: Record<string, any>;',
  },
  {
    name: '$topoLog',
    type: 'variable',
    detail: '脚本日志输出，支持 info / warn / error 三种级别',
    tsDeclare: `declare var $topoLog: {
      info(...args: any[]): void
      warn(...args: any[]): void
      error(...args: any[]): void
    };`,
  },
  {
    name: '$topoCanvasApi',
    type: 'variable',
    detail: '画布操作 API：查询/修改图元属性',
    tsDeclare: `declare var $topoCanvasApi: {
      getItemById(id: string): any
      setItemProp(id: string, props: Record<string, any>): void
      selectItem(id: string): void
      unSelectAll(): void
      getAllItems(): any[]
      removeItem(id: string): void
    };`,
  },
  {
    name: '$topoTime',
    type: 'variable',
    detail: '时间工具函数',
    tsDeclare: `declare var $topoTime: {
      now(): number
      format(timestamp?: number, fmt?: string): string
    };`,
  },
  {
    name: '$topoUtil',
    type: 'variable',
    detail: '通用工具：拷贝、判空等',
    tsDeclare: `declare var $topoUtil: {
      clone(obj: any): any
      isEmpty(v: any): boolean
    };`,
  },
]

// ============ 运行时上下文构建 ============

/**
 * 运行时上下文构建参数（由调用方传入真实值）。
 * 每个字段都可选，缺省时使用安全兜底（不会报 undefined）。
 */
export interface ScriptContextOverrides {
  /** 事件触发原始参数（对应 $topoArgs） */
  args?: Record<string, any>
  /** 当前触发事件的图元对象（对应 $topoItem） */
  item?: any
  /** 画布实例 AntV X6 Graph（对应 $topoCanvas） */
  graph?: any
  /** 全局业务状态（对应 $topoStore） */
  store?: Record<string, any>
  /** 事件订阅回调（对应 $topoEventCallBack）：type + 当前图元 + 额外参数 */
  eventBus?: (type: string, item: any, ...extras: any[]) => void
  /** 通知函数（对应 $topoMessage） */
  notify?: {
    success: (msg: string) => void
    error: (msg: string) => void
    warning: (msg: string) => void
  }
  /** 外部 API 集合 */
  apis?: {
    getItemById?: (id: string) => any
    setItemProp?: (id: string, props: Record<string, any>) => void
    selectItem?: (id: string) => void
    unSelectAll?: () => void
    getAllItems?: () => any[]
    removeItem?: (id: string) => void
  }
  /** 日志回调：$topoLog 每条记录会同步回调（供宿主收集脚本日志） */
  logCallback?: (level: 'info' | 'warn' | 'error', msg: string) => void
}

/**
 * 构建运行时上下文对象。
 *
 * 返回的 key/value 可以直接展开为 `new Function(...keys, body)` 的形参。
 *
 * @example
 * const ctx = buildScriptContext({ item: node, graph: g })
 * const fn = new Function(...Object.keys(ctx), code)
 * fn(...Object.values(ctx))
 */
export function buildScriptContext(overrides: ScriptContextOverrides = {}): Record<string, any> {
  // 默认使用 Arco Message 作为通知（peerDependency 已保证可用）
  const notify = overrides.notify ?? {
    success: (msg: string) => Message.success(msg),
    error: (msg: string) => Message.error(msg),
    warning: (msg: string) => Message.warning(msg),
  }

  const graph = overrides.graph

  return {
    $topoArgs: overrides.args ?? {},
    $topoItem: overrides.item ?? null,
    $topoMessage: notify,
    $topoEventCallBack: (type: string, item: any, ...extras: any[]) => {
      if (overrides.eventBus) {
        overrides.eventBus(type, item, ...extras)
      } else {
        console.log('[eventCallback]', type, item, ...extras)
      }
    },
    $topoCanvas: graph ?? null,
    $topoStore: overrides.store ?? {},
    $topoLog: {
      info: (...args: any[]) => {
        console.log('[topo-script]', ...args)
        overrides.logCallback?.('info', args.join(' '))
      },
      warn: (...args: any[]) => {
        console.warn('[topo-script]', ...args)
        overrides.logCallback?.('warn', args.join(' '))
      },
      error: (...args: any[]) => {
        console.error('[topo-script]', ...args)
        overrides.logCallback?.('error', args.join(' '))
      },
    },
    $topoCanvasApi: {
      getItemById: (id: string) => graph?.getCellById?.(id) ?? null,
      setItemProp: (id: string, props: Record<string, any>) => {
        const cell = graph?.getCellById?.(id)
        if (cell && typeof cell.prop === 'function') {
          cell.prop(props)
        }
      },
      selectItem: (id: string) => {
        graph?.cleanSelection?.()
        graph?.select?.(id)
      },
      unSelectAll: () => graph?.cleanSelection?.(),
      getAllItems: () => graph?.getCells?.() ?? [],
      removeItem: (id: string) => {
        const cell = graph?.getCellById?.(id)
        if (cell) cell.remove()
      },
    },
    $topoTime: {
      now: () => Date.now(),
      format: (timestamp?: number, fmt?: string) => {
        const d = timestamp ? new Date(timestamp) : new Date()
        if (!fmt) return d.toISOString()
        const pad = (n: number) => String(n).padStart(2, '0')
        return fmt
          .replace('yyyy', String(d.getFullYear()))
          .replace('MM', pad(d.getMonth() + 1))
          .replace('dd', pad(d.getDate()))
          .replace('HH', pad(d.getHours()))
          .replace('mm', pad(d.getMinutes()))
          .replace('ss', pad(d.getSeconds()))
      },
    },
    $topoUtil: {
      clone: (obj: any) => {
        try {
          return JSON.parse(JSON.stringify(obj))
        } catch {
          return Object.assign({}, obj)
        }
      },
      isEmpty: (v: any) => {
        if (v == null) return true
        if (typeof v === 'string') return v.trim() === ''
        if (Array.isArray(v)) return v.length === 0
        if (typeof v === 'object') return Object.keys(v).length === 0
        return false
      },
    },
  }
}
