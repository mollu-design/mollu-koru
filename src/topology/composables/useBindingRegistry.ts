/**
 * 绑定注册表采集 composable。
 *
 * 职责：
 *  遍历画布所有图元，提取有 binding 属性的图元，汇总为绑定注册表。
 *  注册表供后端接收 / WS 订阅依据，无需本地持久化，
 *  在保存时通过回调/事件回传给外部系统。
 *
 * 同时提供后端数据转换工具：
 *  - flattenBindingData(): 将后端分组格式转换为前端 fetchData 可用的扁平格式
 *  - buildFetchData(): 基于 bindingRegistry 构建 fetchData 函数
 */
import type { BindingRegistryItem, BindingRegistryEntry } from './bindingTypes'

/**
 * 从画布 Graph 实例中采集绑定注册表。
 * 遍历所有 cells，提取有 binding.bindings[] 的图元。
 *
 * 兼容两种输入：
 * 1. X6 Graph 实例 → graph.getCells() 返回 Cell 实例（有 getData() 方法）
 * 2. 纯 JSON 对象   → { getCells: () => CellJSON[] } （直接读 cell.data）
 */
export function collectBindingRegistry(graph: any): BindingRegistryItem[] {
  if (!graph) return []
  const cells = graph.getCells?.() || []
  const registry: BindingRegistryItem[] = []

  cells.forEach((cell: any) => {
    // 兼容 X6 Cell 实例（有 getData()）和纯 JSON 对象（直接读 data）
    const data = cell?.getData?.() ?? cell?.data ?? {}
    const binding = data.binding
    const isMultiState = cell.isNode?.() && !!data.isMultiState

    // 普通图元 & multiState 元件：都必须有 binding.bindings[]
    const bindings: any[] =
      binding && Array.isArray(binding.bindings) ? binding.bindings : []
    if (bindings.length === 0) return

    // 图元名称
    let label = ''
    if (data.label != null) {
      label = typeof data.label === 'object' ? String(data.label.text ?? '') : String(data.label)
    } else if (cell.getProp?.('label')?.text != null) {
      label = String(cell.getProp('label').text)
    } else {
      label = String(cell.getAttr?.('text/text') ?? '')
    }

    const entries: BindingRegistryEntry[] = bindings.map((b: any) => ({
      id: b.id || '',
      device: b.device || '',
      deviceLabel: b.deviceLabel || b.device || '',
      dataPoint: b.dataPoint || '',
      targetProperty: b.targetProperty || '',
      mappingRules: b.mappingRules || '',
      refreshInterval: Number(b.refreshInterval) || 1000,
      triggerCount: Array.isArray(b.triggers)
        ? b.triggers.filter((t: any) => t?.enabled !== false).length
        : 0,
      triggers: Array.isArray(b.triggers) ? b.triggers : [],
    }))

    registry.push({
      cellId: cell.id,
      cellLabel: label,
      shape: cell.shape || '',
      bindings: entries,
    })
  })

  return registry
}

// ============ 后端数据格式转换工具 ============

/** 扁平 key-value 格式：{ "cellId:device:dataPoint": value } */
export type FlatBindingData = Record<string, number | string | null>

/** 分组格式：[{ cellId, data: [{ device, dataPoint, value }] }] */
export interface GroupedBindingDataItem {
  cellId: string
  data: Array<{ device: string; dataPoint: string; value: number | string | null }>
}

/**
 * 将后端分组格式（格式 B）展平为前端 fetchData 可用的格式（格式 A）。
 *
 * 使用场景：后端返回按 cell 分组的数据时，调用此函数转换后直接喂给 KoruPreview 的 fetchData。
 *
 * @example
 *   // 后端返回
 *   const grouped = [{ cellId: "n1", data: [{ device: "WS-1", dataPoint: "temp", value: 23.5 }] }]
 *   // 转换
 *   const flat = flattenBindingData(grouped)
 *   // => { "n1:WS-1:temp": 23.5 }
 *   // 作为 fetchData 返回值使用
 *   const fetchData = async () => flat
 */
export function flattenBindingData(grouped: GroupedBindingDataItem[]): FlatBindingData {
  const result: FlatBindingData = {}
  if (!Array.isArray(grouped)) return result
  grouped.forEach((item) => {
    if (!item?.cellId || !Array.isArray(item.data)) return
    item.data.forEach((d) => {
      if (!d?.device || !d?.dataPoint) return
      result[`${item.cellId}:${d.device}:${d.dataPoint}`] = d.value ?? null
    })
  })
  return result
}

/**
 * 基于 bindingRegistry 构建 fetchData 函数。
 *
 * 使用场景：已知绑定注册表 + 一个数据获取函数（如后端 WS/HTTP），
 * 自动组装成 KoruPreview 可用的 fetchData。
 *
 * @param registry   绑定注册表（来自 getBindingRegistry()）
 * @param dataSource 数据源函数，返回扁平或分组格式数据
 * @param options    转换选项
 *
 * @example
 *   const registry = getBindingRegistry()
 *   const fetchData = buildFetchData(registry, async () => {
 *     // 调用后端接口，返回分组格式
 *     return await api.getRealtimeData(registry)
 *   }, { inputFormat: 'grouped' })
 *   // 直接传给 KoruPreview
 *   <koru-preview :fetch-data="fetchData" />
 */
export function buildFetchData(
  registry: BindingRegistryItem[],
  dataSource: () => Promise<FlatBindingData | GroupedBindingDataItem[]>,
  options: { inputFormat?: 'flat' | 'grouped' } = {},
): () => Promise<FlatBindingData> {
  const format = options.inputFormat ?? 'flat'
  return async () => {
    const raw = await dataSource()
    if (format === 'grouped') {
      return flattenBindingData(raw as GroupedBindingDataItem[])
    }
    return raw as FlatBindingData
  }
}

/**
 * 从 bindingRegistry 提取所有订阅 key 列表。
 * 用于：1) 发送给后端作为订阅清单  2) 验证数据源返回值的完整性
 *
 * @example
 *   const keys = extractBindingKeys(registry)
 *   // => ["n1:WS-1:temp", "n1:WS-1:status", "n2:WS-2:current"]
 */
export function extractBindingKeys(registry: BindingRegistryItem[]): string[] {
  const keys: string[] = []
  registry.forEach((item) => {
    item.bindings.forEach((b) => {
      keys.push(`${item.cellId}:${b.device}:${b.dataPoint}`)
    })
  })
  return keys
}

/**
 * 绑定注册表 Hook。
 *
 * 使用方式：
 *   const registry = useBindingRegistry(() => graph)
 *   registry.getBindingRegistry()  // 随时调用获取当前画布的绑定注册表
 *
 * 保存时调用：
 *   const data = registry.getBindingRegistry()
 *   // 回传给外部（emit / callback / 直接使用）
 */
export function useBindingRegistry(getGraph: () => any) {
  /** 获取当前画布的绑定注册表（可随时调用） */
  function getBindingRegistry(): BindingRegistryItem[] {
    const graph = getGraph()
    if (!graph) return []
    return collectBindingRegistry(graph)
  }

  return {
    /** 获取当前画布的绑定注册表 */
    getBindingRegistry,
    /** 内部实现：从 graph 采集（可单独使用） */
    collectBindingRegistry,
    /** 将后端分组数据展平为 fetchData 格式 */
    flattenBindingData,
    /** 基于注册表 + 数据源构建 fetchData 函数 */
    buildFetchData,
    /** 提取所有订阅 key 列表 */
    extractBindingKeys,
  }
}
