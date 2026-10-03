/**
 * 画布数据持久化 composable
 *
 * 统一存储格式：{ cells: any[], canvas: KoruCanvasConfigStorage }
 * 默认使用 IndexedDB（通过 dbGet/dbSet/dbRemove），与 KoruSavePanel 保持一致。
 * 同时提供存储适配器接口，支持 API 远程存储。
 *
 * 通过 persistence-key prop 启用（内置到 KoruGraphEditor）。
 */
import { watch, computed } from 'vue'
import type { KoruGraphEditorInstance, KoruCanvasConfigStorage } from '../types'
import { serializeKoruCanvasConfig, deserializeKoruCanvasConfig } from '../types'
import { applyKoruCanvasConfig } from '../composables/useKoruCanvasConfig'
import { dbGet, dbSet, dbRemove } from '../utils/storage'
import { useCanvasStore } from '../stores/canvasStore'
import { Modal } from '@arco-design/web-vue'

// ========== 统一存储格式 ==========

export interface PersistenceData {
  /** X6 Graph cells（from graph.toJSON()） */
  cells: any[]
  /** 画布配置（序列化后） */
  canvas?: KoruCanvasConfigStorage
}

// ========== 存储适配器接口 ==========

/**
 * 存储适配器
 * 默认使用 IndexedDB，可传入自定义实现（如 API 远程存储）
 */
export interface PersistenceStorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/** 创建默认 IndexedDB 适配器 */
export function createIndexedDBAdapter(): PersistenceStorageAdapter {
  return {
    async getItem(key) {
      return dbGet(key)
    },
    async setItem(key, value) {
      await dbSet(key, value)
    },
    async removeItem(key) {
      await dbRemove(key)
    },
  }
}

// ========== 选项类型 ==========

export interface UseCanvasPersistenceOptions {
  /** 存储 key（默认 'koru-diagram-data'） */
  storageKey: string
  /** 是否启用自动保存（默认 true） */
  autoSave?: boolean
  /** 自动保存防抖间隔（毫秒，默认 500） */
  autoSaveDebounceMs?: number
  /**
   * 存储适配器，默认使用 IndexedDB
   * 传入自定义适配器可实现 API 远程存储
   */
  storageAdapter?: PersistenceStorageAdapter
  /**
   * 恢复数据的确认回调
   * 返回 true 则恢复数据，返回 false 则忽略
   * 默认使用 window.confirm
   */
  confirmRestore?: (savedData: PersistenceData) => Promise<boolean> | boolean
}

// ========== Composable ==========

export function useCanvasPersistence(
  instance: KoruGraphEditorInstance | null,
  options: UseCanvasPersistenceOptions,
) {
  const {
    storageKey,
    autoSave = true,
    autoSaveDebounceMs = 500,
    storageAdapter = createIndexedDBAdapter(),
    confirmRestore,
  } = options

  const store = useCanvasStore()
  // 是否弹恢复确认框：prop confirmRestore > config.confirmRestoreData > 默认 true
  const shouldConfirmRestore = computed(() => {
    if (confirmRestore) return true  // 业务传了回调，肯定要弹
    return store.componentConfig.confirmRestoreData  // 全局配置
  })

  // 自动保存防抖
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  /** 缓存上次保存的 JSON，数据未变化时跳过 IndexedDB 写入 */
  let lastSavedJson: string | null = null

  /** 构建统一存储数据 */
  function buildStorageData(): PersistenceData {
    const graph = instance?.getGraph?.()
    const canvasCfg = store.canvasConfig.value!
    if (!graph) {
      return { cells: [], canvas: serializeKoruCanvasConfig(canvasCfg) }
    }
    let rawCells: any[] = []
    try {
      const json = graph.toJSON()
      rawCells = json?.cells || []
    } catch {
      // toJSON 可能在 undo/redo 等中间状态失败，跳过本次保存
      return { cells: [], canvas: serializeKoruCanvasConfig(canvasCfg) }
    }
    const cells = sanitizeCellsData(rawCells)
    const data: PersistenceData = {
      cells,
      canvas: serializeKoruCanvasConfig(canvasCfg),
    }
    return data
  }

  /** 重新应用组合成员保护：遍历所有 cells，对有父节点的成员禁用交互 */
  function reapplyGroupMemberProtection(graph: any): void {
    if (!graph) return
    const cells = graph.getCells?.() || []
    const memberCells = cells.filter((c: any) => {
      return c.getParent?.() // 有父节点的是成员（不含容器）
    })
    if (!memberCells.length) return

    // 等待 view 渲染完成后再做 DOM 级操作
    let attempts = 0
    const tryApply = () => {
      attempts++
      let hasPendingView = false
      memberCells.forEach((c: any) => {
        const view = graph.findViewByCell?.(c)
        if (!view?.container) {
          hasPendingView = true
          return
        }
        // 只设置 cell 级 selectable（不使用 cell.attr()，因为 fromJSON 已恢复 attrs）
        try {
          c.selectable = false
        } catch {
          /* ignore */
        }
        // DOM 级强制覆盖（pointer-events:none 不在 fromJSON 中序列化）
        const el = view.container as HTMLElement
        if (el) {
          try {
            el.setAttribute('pointer-events', 'none')
            el.querySelectorAll?.('*').forEach((sub: Element) => {
              sub.setAttribute('pointer-events', 'none')
            })
          } catch {
            /* ignore */
          }
        }
      })
      if (hasPendingView && attempts < 10) {
        requestAnimationFrame(tryApply)
      } else if (hasPendingView) {
        console.warn('[Persistence] reapplyGroupMemberProtection: 部分 view 渲染超时')
      }
    }
    requestAnimationFrame(tryApply)
  }

  /** 清理 cell 数据中的无效尺寸（负 width/height 会导致 X6 渲染报错） */
  function sanitizeCellsData(cells: any[]): any[] {
    const issues: string[] = []
    const sanitized = cells.map((cell: any) => {
      const c = { ...cell }
      // 修复 size 中的负宽高
      if (c.size) {
        if (typeof c.size.width === 'number' && c.size.width <= 0) {
          issues.push(`${c.id || '?'}: size.width=${c.size.width}`)
          c.size.width = Math.abs(c.size.width) || 1
        }
        if (typeof c.size.height === 'number' && c.size.height <= 0) {
          issues.push(`${c.id || '?'}: size.height=${c.size.height}`)
          c.size.height = Math.abs(c.size.height) || 1
        }
      }
      // 修复根级 width/height（部分 shape 将尺寸放在顶层）
      if (typeof c.width === 'number' && c.width <= 0) {
        issues.push(`${c.id || '?'}: width=${c.width}`)
        c.width = Math.abs(c.width) || 1
      }
      if (typeof c.height === 'number' && c.height <= 0) {
        issues.push(`${c.id || '?'}: height=${c.height}`)
        c.height = Math.abs(c.height) || 1
      }
      // 修复 attrs.body 中的负宽高
      if (c.attrs?.body) {
        const body = { ...c.attrs.body }
        if (typeof body.width === 'number' && body.width <= 0) {
          issues.push(`${c.id || '?'}: attrs.body.width=${body.width}`)
          body.width = Math.abs(body.width) || 1
        }
        if (typeof body.height === 'number' && body.height <= 0) {
          issues.push(`${c.id || '?'}: attrs.body.height=${body.height}`)
          body.height = Math.abs(body.height) || 1
        }
        c.attrs = { ...c.attrs, body }
      }
      // 修复其他 attrs 中的负宽高（svg-body、image 等）
      if (c.attrs) {
        for (const key of ['svg-body', 'image']) {
          const sub = c.attrs[key]
          if (sub && typeof sub === 'object') {
            const ns = { ...sub }
            let changed = false
            if (typeof ns.width === 'number' && ns.width <= 0) {
              issues.push(`${c.id || '?'}: attrs.${key}.width=${ns.width}`)
              ns.width = Math.abs(ns.width) || 1
              changed = true
            }
            if (typeof ns.height === 'number' && ns.height <= 0) {
              issues.push(`${c.id || '?'}: attrs.${key}.height=${ns.height}`)
              ns.height = Math.abs(ns.height) || 1
              changed = true
            }
            if (changed) c.attrs = { ...c.attrs, [key]: ns }
          }
        }
      }
      return c
    })
    if (issues.length > 0) {
      console.warn('[Persistence] sanitizeCellsData 修复了以下负尺寸:', issues)
    }
    return sanitized
  }

  /** 从存储数据恢复画布 */
  function applyStorageData(data: PersistenceData): void {
    const graph = instance?.getGraph?.()
    console.log('[Persistence] applyStorageData:', {
      hasGraph: !!graph,
      cellsLength: data.cells?.length,
      hasCanvas: !!data.canvas,
    })
    if (graph && data.cells?.length) {
      console.log('[Persistence] applying cells...')
      graph.clearCells()
      // 清理持久化数据中的无效尺寸（防止负尺寸导致渲染异常）
      const sanitized = sanitizeCellsData(data.cells)
      try {
        graph.fromJSON({ cells: sanitized })
      } catch (e: any) {
        console.error('[Persistence] fromJSON 失败，已清空画布:', e?.message || e)
        graph.clearCells()
      }
      // 注意：不再调用 graph.centerContent()
      // 原因：centerContent() 会调整视口使内容居中，导致用户保存时的布局位置在重新加载后发生偏移
      // 用户希望节点保持原有的视觉位置，因此保持 fromJSON 后的默认视口即可
      // fromJSON 完成后，对有父节点的成员恢复 DOM 级交互禁用（确保组合后成员不可单独拖拽）
      reapplyGroupMemberProtection(graph)
      // 清除 fromJSON 创建的 history 命令，确保 undo 栈干净
      try {
        const history = graph.getPlugin?.('history')
        if (history?.clear) history.clear()
        else graph.cleanHistory?.()
      } catch {
        /* ignore */
      }
      console.log('[Persistence] cells applied, cell count:', graph.getCells().length)
    }
    if (data.canvas) {
      const restored = deserializeKoruCanvasConfig(data.canvas)
      store.canvasConfig.value = { ...restored }
      // 将画布配置应用到 graph 实例
      if (graph) {
        applyKoruCanvasConfig(graph, restored)
      }
      console.log('[Persistence] canvas config restored')
    }
  }

  /** 保存数据 */
  async function saveToLocal(): Promise<void> {
    if (!instance) {
      console.warn('[Persistence] saveToLocal skipped: no instance')
      return
    }
    try {
      const data = buildStorageData()
      const json = JSON.stringify(data)
      // 注意：不再使用 json === lastSavedJson 去重。
      // 原因：在 setData 触发 cell:change:* + 手动 GRAPH_CHANGED 双事件源的场景下，
      // 加上 debounce 时序竞态，会导致合法的数据变更被误判为"未变化"而跳过保存。
      // IndexedDB 写入开销极小，始终保存即可。
      lastSavedJson = json
      console.log('[Persistence] saveToLocal \u2192 dbSet', {
        key: storageKey,
        size: json.length,
      })
      await storageAdapter.setItem(storageKey, json)
      console.log('[Persistence] saveToLocal done')
    } catch (e) {
      console.warn('[Persistence] saveToLocal error:', e)
    }
  }

  /** 从存储加载数据 */
  async function loadFromLocal(): Promise<PersistenceData | null> {
    try {
      const raw = await storageAdapter.getItem(storageKey)
      console.log('[Persistence] loadFromLocal:', { key: storageKey, hasData: !!raw })
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  /** 清除存储的数据 */
  async function clearLocal(): Promise<void> {
    try {
      await storageAdapter.removeItem(storageKey)
    } catch {
      // ignore
    }
  }

  /** 检查并恢复数据，返回恢复后的数据（或 null） */
  async function checkAndRestore(): Promise<PersistenceData | null> {
    const saved = await loadFromLocal()
    console.log('[Persistence] checkAndRestore:', { hasSavedData: !!saved, key: storageKey })
    if (!saved) return null

    let shouldRestore: boolean
    if (!shouldConfirmRestore.value) {
      // 全局关闭确认 → 自动恢复
      shouldRestore = true
    } else if (confirmRestore) {
      shouldRestore = await confirmRestore(saved)
    } else {
      shouldRestore = await new Promise<boolean>((resolve) => {
        Modal.open({
          width: 350,
          title: '恢复数据',
          content: '检测到本地有已保存的画布数据，是否应用？',
          okText: '应用',
          cancelText: '不应用',
          maskClosable: false,
          simple: false,
          okButtonProps: {
            type: 'primary',
          },
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
    }
    console.log('[Persistence] checkAndRestore shouldRestore:', shouldRestore)

    if (shouldRestore) {
      applyStorageData(saved)
      return saved
    }

    return null
  }

  /**
   * 设置自动保存监听（防抖）
   * 返回清理函数，组件销毁时调用
   */
  function setupAutoSave(): () => void {
    if (!instance || !autoSave) return () => {}

    const debouncedSave = () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      console.log('[Persistence] graph:changed fired, scheduling save in', autoSaveDebounceMs)
      autoSaveTimer = setTimeout(() => {
        console.log('[Persistence] executing debounced save')
        saveToLocal()
      }, autoSaveDebounceMs)
    }

    console.log('[Persistence] setupAutoSave: registering graph:changed handler')
    instance.on('graph:changed', debouncedSave)

    // 监听画布配置变化触发保存
    // 注意：commit() 替换整个对象，无需 deep
    const canvasConfigWatcher = watch(store.canvasConfig, () => {
      console.log('[Persistence] canvasConfig changed, scheduling save')
      debouncedSave()
    })

    return () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      instance.off('graph:changed', debouncedSave)
      canvasConfigWatcher()
    }
  }

  return {
    saveToLocal,
    loadFromLocal,
    clearLocal,
    checkAndRestore,
    setupAutoSave,
  }
}
