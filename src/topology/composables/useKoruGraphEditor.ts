import { ref, type Ref } from 'vue'
import { Graph, Shape, Node, Edge, Cell } from '@antv/x6'
import { Clipboard, Export, History, Keyboard, Selection, Snapline, Transform } from '@antv/x6'
import { KoruEventBus } from '../../core-kernel/event-bus'
import { KoruEvent } from '../../core-kernel/types'
import { registerBasicShapes } from '../presets/registerBasicShapes'
import { useCanvasStore } from '../stores/canvasStore'
import { applyCellAnimation, stopCellAnimations } from './useAnimation'
import { collectBindingRegistry } from './useBindingRegistry'
import { createDefaultContextMenuState } from './useContextMenu'
import { applyMultiStateVisibility } from './useMultiState'
import type {
  KoruGraphEditorMode,
  KoruGraphEditorOptions,
  KoruGraphEditorInstance,
  KoruGraphData,
  KoruNodeData,
  KoruEdgeData,
  KoruPortData,
} from '../types'
import { KORU_DEFAULT_OPTIONS } from '../types'

// ========== 数据格式转换 ==========

/** KoruGraphData → X6 JSON 格式（彻底 X6 parent-child 模式）
 *  - 容器排在子元素前（fromJSON 要求父先于子）
 *  - 子元素补 parent 字段 + 坐标转相对容器（X6 toJSON 原生格式）
 */
function toX6JSON(data: KoruGraphData): { cells: any[] } {
  // 注意：sortedNodes 先放容器、后放成员，下面 forEach 会先处理容器
  const sortedNodes = [...data.nodes].sort((a, b) => {
    const aIsContainer = !!(a.data as any)?.isGroup || !!(a.data as any)?.isMultiState
    const bIsContainer = !!(b.data as any)?.isGroup || !!(b.data as any)?.isMultiState
    if (aIsContainer && !bIsContainer) return -1
    if (!aIsContainer && bIsContainer) return 1
    return 0
  })

  // 第一轮：只收集容器坐标（容器或独立节点 —— 没有 parent 的）
  const containerNodeMap = new Map<string, { x: number; y: number }>() // containerId → absPos
  sortedNodes.forEach((n) => {
    const nd = (n.data as any) || {}
    if (nd.parent) return // 成员不参与第一轮
    // 容器或独立节点（没有 parent 也没有 groupId）
    containerNodeMap.set(n.id, { x: n.x, y: n.y })
  })

  // 第二轮：构建 cells，子元素补 parent + 转相对坐标
  const cells: any[] = []
  sortedNodes.forEach((n) => {
    const nd = (n.data as any) || {}
    const cell: any = {
      id: n.id,
      shape: n.shape || 'rect',
      position: { x: n.x, y: n.y },
      size: { width: n.width, height: n.height },
      attrs: n.attrs || {},
    }

    // ===== 关键：补 parent 字段 + 转相对坐标 =====
    // 只有 data.parent 分支（X6 原生 parent-child 模式）
    if (nd.parent && containerNodeMap.has(nd.parent)) {
      const parentAbs = containerNodeMap.get(nd.parent)!
      cell.parent = nd.parent
      cell.position = { x: n.x - parentAbs.x, y: n.y - parentAbs.y }
    }

    if (n.label != null) {
      cell.attrs = { ...cell.attrs, text: { ...cell.attrs.text, text: n.label } }
    }
    if (n.ports && n.ports.length > 0) {
      cell.ports = {
        items: n.ports.map((p) => ({
          id: p.id,
          group: p.group,
          args: p.position ? { x: p.position.x, y: p.position.y } : undefined,
        })),
      }
    }
    if (n.data) {
      // data.parent 不需要存（cell.parent 已经有了），避免混淆
      const { parent, ...rest } = nd
      cell.data = rest
    }
    cells.push(cell)
  })

  data.edges.forEach((e) => {
    const cell: any = {
      id: e.id,
      shape: 'edge',
      source: { cell: e.source, ...(e.sourcePort ? { port: e.sourcePort } : {}) },
      target: { cell: e.target, ...(e.targetPort ? { port: e.targetPort } : {}) },
      attrs: e.attrs || {},
    }
    if (e.label) cell.labels = [{ attrs: { text: { text: e.label } } }]
    if (e.data) cell.data = e.data
    cells.push(cell)
  })

  return { cells }
}

/** X6 JSON 格式 → KoruGraphData */
function fromX6JSON(x6Data: { cells?: any[] }): KoruGraphData {
  const nodes: KoruNodeData[] = []
  const edges: KoruEdgeData[] = []

  // 预先收集所有容器的绝对坐标（用于把 parent-child 模式下的相对坐标转绝对）
  const parentAbsPosMap = new Map<string, { x: number; y: number }>()
  ;(x6Data?.cells || []).forEach((cell: any) => {
    if (cell?.shape && cell.shape !== 'edge' && !cell.parent) {
      // 没有 parent 的节点（容器、独立节点）绝对位置
      const pos = cell.position || { x: 0, y: 0 }
      parentAbsPosMap.set(cell.id, { x: pos.x, y: pos.y })
    }
  })

  ;(x6Data?.cells || []).forEach((cell: any) => {
    if (!cell) return
    if (cell.shape && cell.shape !== 'edge') {
      const pos = cell.position || { x: 0, y: 0 }
      // parent-child 模式下 cell.position 是相对父容器的，转绝对
      let absX = pos.x
      let absY = pos.y
      if (cell.parent) {
        const pAbs = parentAbsPosMap.get(cell.parent)
        if (pAbs) {
          absX = pos.x + pAbs.x
          absY = pos.y + pAbs.y
        }
      }
      const size = cell.size || { width: 100, height: 60 }
      const attrs = cell.attrs || {}
      let label: string | undefined
      if (attrs.text?.text != null) label = attrs.text.text
      let ports: KoruPortData[] | undefined
      if (cell.ports?.items?.length) {
        ports = cell.ports.items.map((item: any) => ({ id: item.id, group: item.group }))
      }
      // parent 字段存到 data 里，下次 toX6JSON 能识别
      const outData: Record<string, any> = { ...(cell.data || {}) }
      if (cell.parent) outData.parent = cell.parent
      nodes.push({
        id: cell.id,
        shape: cell.shape,
        x: absX,
        y: absY,
        width: size.width,
        height: size.height,
        label,
        attrs,
        ports,
        data: outData,
      })
    }
    if (cell.shape === 'edge') {
      const src = cell.source || {}
      const tgt = cell.target || {}
      let label: string | undefined
      if (cell.labels?.[0]?.attrs?.text?.text != null) label = cell.labels[0].attrs.text.text
      edges.push({
        id: cell.id,
        source: src.cell || src.id || '',
        target: tgt.cell || tgt.id || '',
        sourcePort: src.port,
        targetPort: tgt.port,
        label,
        attrs: cell.attrs || {},
        data: cell.data || {},
      })
    }
  })

  return { nodes, edges }
}

// ========== X6 Parent-Child 重建与拆解 ==========

// Legacy fallback removed — patchedFromJSON now uses hasParentField detection

/**
 * 保存前拆解 parent-child：把子元素的相对坐标转回绝对，移除 parent
 * 这样 graph.toJSON() 输出的还是旧格式平铺 JSON，向后兼容
 */
function _detachGroupParentChild(graph: any): void {
  if (!graph) return
  const nodes = graph.getNodes?.() || []

  // 1. 找出有 parent 的成员
  const membersWithParent: { cell: any; parentAbs: { x: number; y: number } }[] = []
  nodes.forEach((n: any) => {
    const parent = n.getParent?.()
    if (parent) {
      const pAbs = parent.position()
      membersWithParent.push({ cell: n, parentAbs: { x: pAbs.x, y: pAbs.y } })
    }
  })

  if (membersWithParent.length === 0) return

  // 2. 逐个拆 parent，坐标转绝对
  membersWithParent.forEach(({ cell, parentAbs }) => {
    const relPos = cell.position() // 相对坐标
    const absX = relPos.x + parentAbs.x
    const absY = relPos.y + parentAbs.y
    cell.position(absX, absY) // 先设回绝对坐标
    cell.setParent(null) // 再拆 parent
  })

  console.log(`[Koru][parent-child] detached ${membersWithParent.length} members for save`)
}

// ========== 线条 className 工具 ==========

/** 设置 shape-line 节点 line 的 className（同时通过 X6 attr 和 DOM 兜底） */
function setLineClassName(cell: Node, cls: string): void {
  cell.attr('line/className', cls || null)
  try {
    const view = (cell.findView as (() => any) | undefined)?.()
    if (view) {
      const pathElem = view.container?.querySelector?.('path')
      if (pathElem) {
        if (cls) {
          pathElem.setAttribute('class-name', cls)
        } else {
          pathElem.removeAttribute('class-name')
        }
      }
    }
  } catch {
    /* ignore */
  }
}

// ========== 主 Hook ==========

export function useKoruGraphEditor(options?: Partial<KoruGraphEditorOptions>) {
  const eventBus = new KoruEventBus()
  let _x6Graph: Graph | null = null
  let _contextMenuHandler: ((e: MouseEvent) => void) | null = null
  let _globalKeyHandler: ((e: KeyboardEvent) => void) | null = null
  let inHistoryOperation = false
  let isDragging = false
  const containerRef: Ref<HTMLElement | null> = ref(null)
  const mode = ref<KoruGraphEditorMode>(options?.mode ?? KORU_DEFAULT_OPTIONS.mode)
  const zoomScale = ref(1)
  const selectedIds = ref<string[]>([])
  const canUndo = ref(false)
  const canRedo = ref(false)

  const config: KoruGraphEditorOptions = {
    ...KORU_DEFAULT_OPTIONS,
    ...options,
    zoom: { ...KORU_DEFAULT_OPTIONS.zoom, ...options?.zoom },
  }

  const store = useCanvasStore()

  function getGraph(): Graph | null {
    return _x6Graph
  }

  // 安全的 toJSON 包装，防止 X6 内部 null/undefined 导致崩溃
  function safeToJSON(cell: any): any {
    try {
      return cell?.toJSON?.() ?? null
    } catch {
      return null
    }
  }

  // ========== 生命周期 ==========

  function init(container: HTMLElement): void {
    if (_x6Graph) return
    containerRef.value = container

    // 注册基础节点形状
    registerBasicShapes()

    _x6Graph = new Graph({
      container,
      autoResize: true,
      background: { color: '#fafafa' },
      grid: config.grid || false,
      mousewheel: {
        enabled: config.mouseWheel,
        zoomAtMousePosition: true,
        modifiers: 'ctrl',
        minScale: config.zoom.min,
        maxScale: config.zoom.max,
      },
      panning: { enabled: config.panning, modifiers: 'ctrl' },
      connecting: {
        router: 'manhattan',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'anchor',
        allowBlank: false,
        snap: { radius: 20 },
        createEdge() {
          return new Shape.Edge({
            attrs: {
              line: {
                stroke: '#A2B1C3',
                strokeWidth: 2,
                targetMarker: { name: 'block', width: 12, height: 8 },
              },
            },
            zIndex: 0,
          })
        },
        validateConnection({ targetMagnet }) {
          return !!targetMagnet
        },
      },
      highlighting: {
        magnetAdsorbed: { name: 'stroke', args: { attrs: { fill: '#5F95FF', stroke: '#5F95FF' } } },
      },
      // interacting 改为函数形式：按 cell 粒度动态控制交互能力
      // 注意：X6 parent-child 模式下，父容器拖动时会自动传播位移给子元素，
      //       interacting 不能对子元素返回 nodeMovable: false，否则传播被阻断 → 子元素不跟随！
      //       改用 node:mousedown 事件拦截：用户点到子元素时自动选中父容器。
      interacting: (cellView: any) => {
        const hasParent = !!cellView?.cell?.getParent?.()
        const isEdit = mode.value === 'edit'
        return {
          nodeMovable: isEdit,     // 子元素也可被 X6 内部 parent-child 传播移动
          edgeMovable: isEdit,
          // 子元素禁用连线能力（但不禁用 nodeMovable）
          magnetConnectable: hasParent ? false : isEdit,
          toolsAddable: hasParent ? false : isEdit,
        }
      },
    })

    // ===== X6 parent-child 只自动传播 translate，resize/rotate 需手动 =====
    // monkey-patch Node.prototype —— 每个节点只同步**直接 children**
    // 子节点的 resize/rotate 会自动触发 patched → 同步孙子 → 自然递归到底层
    // 不会无限循环：永远只向下同步，不会从 child 回调到 parent

    // resize → 子元素 size + position 按比例缩放
    // 关键：resize 前后 container.position 可能变（direction 不是 right/bottom 时）
    // 所以取 prevPos + newPos，算 child 新绝对位置 = newPos + (childAbs - prevPos) * scale
    const MIN_CONTAINER_SIZE = 50 // 容器最小尺寸（有子元素的才 clamp）
    const origResize = (Node.prototype as any).resize
    ;(Node.prototype as any).resize = function patchedResize(
      width: number, height: number, options: any = {},
    ) {
      // 只对有子元素的容器限制最小尺寸，子元素不 clamp
      // 用 _skipClamp 标记避免递归时重复 clamp
      if (!options._skipClamp && this.getChildren?.()?.length) {
        width = Math.max(MIN_CONTAINER_SIZE, width)
        height = Math.max(MIN_CONTAINER_SIZE, height)
      }
      const prevSize = this.size()
      const prevPos = this.position() // resize 前的容器绝对位置
      const result = origResize.call(this, width, height, options)
      const newPos = this.position() // resize 后的容器绝对位置（可能因 direction 变了！）
      const children = this.getChildren?.() || []
      if (!children.length) return result
      const pw = prevSize.width
      const ph = prevSize.height
      if (!pw || !ph) return result
      const sx = width / pw
      const sy = height / ph
      children.forEach((child: any) => {
        // size 缩放 → 传 _skipClamp 不让子元素再 clamp
        const s = child.size()
        child.resize(s.width * sx, s.height * sy, { _skipClamp: true })
        // 位置缩放
        const childAbs = child.position()
        const offsetX = childAbs.x - prevPos.x
        const offsetY = childAbs.y - prevPos.y
        child.setPosition(newPos.x + offsetX * sx, newPos.y + offsetY * sy)
      })
      return result
    }

    // rotate → 子元素 angle 同步（absolute 模式让 angle 直接覆盖）
    const origRotate = (Node.prototype as any).rotate
    ;(Node.prototype as any).rotate = function patchedRotate(angle: number, options: any = {}) {
      const result = origRotate.call(this, angle, options)
      const children = this.getChildren?.() || []
      if (!children.length) return result
      const currentAngle = this.getAngle?.() || 0
      children.forEach((child: any) => {
        // 必须用 { absolute: true }：让 child 直接设成这个 angle（不是累加）
        // → child.rotate() 会自动触发 patchedRotate → 同步孙子
        child.rotate(currentAngle, { absolute: true })
      })
      return result
    }

    _x6Graph
      .use(
        new Transform({
          resizing: {
            enabled: true,
            minWidth: 20,
            minHeight: 20,
            // 动态锁定宽高比：根据节点 data.lockAspect 实时判断是否等比缩放
            preserveAspectRatio: (node: any) => !!node.getData?.()?.lockAspect,
          },
          rotating: true,
        }),
      )
      .use(
        new Selection({
          rubberband: true,
          showNodeSelectionBox: true,
          following: true,
          movable: true,  // Selection movable 负责拖拽（包括整体拖动），内部调 cell.translate
                           // parent-child translate 传播依赖 X6 原生关联（setParent/addChild 已建）
        }),
      )
      .use(new Snapline())
      .use(new Keyboard())
      .use(new Clipboard())
      .use(new History())
      .use(new Export())

    // ===== 封装：拦截所有 fromJSON 路径（内部 setGraphData / 外部父组件 graph.fromJSON）=====
    // X6 fromJSON 只做了单向 child.parent = parentId，没做 parent.addChild(child)
    // 导致 parent.getChildren() 空数组 → translate 不传播给子元素
    // 这里在 fromJSON 完成后，遍历所有节点补 addChild，重建双向关联
    const origFromJSON = _x6Graph.fromJSON.bind(_x6Graph)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _x6Graph.fromJSON = function patchedFromJSON(this: any, ...args: any[]) {
      const input = args[0]
      const hasParentField =
        input &&
        (input as any).cells?.some?.((c: any) => c?.parent != null)
      const result = origFromJSON(...(args as [any]))
      if (!hasParentField) return result
      const nodes = _x6Graph?.getNodes?.() || []
      nodes.forEach((n: any) => {
        const parent = n.getParent?.()
        if (!parent) return
        const siblings = parent.getChildren?.() || []
        if (!siblings.includes(n)) {
          parent.addChild?.(n)
        }
      })
      return result
    }

    // 全局键盘拦截：Ctrl+A 全选、Delete/Backspace 删除选中图元
    // 跳过输入框/textarea/contenteditable 场景（保留原生行为）
    const isTypingTarget = (el: EventTarget | null) => {
      const t = el as HTMLElement
      if (!t) return false
      const tag = t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (t.isContentEditable) return true
      return false
    }
    _globalKeyHandler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      // Ctrl/Cmd + A → 全选图元
      const isCtrlA = (e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')
      if (isCtrlA) {
        e.preventDefault()
        const nodes = _x6Graph?.getNodes() || []
        if (nodes.length > 0) {
          _x6Graph!.select(nodes)
        } else {
          _x6Graph?.cleanSelection()
        }
        return
      }

      // Delete / Backspace → 删除选中图元
      const isDelete = e.key === 'Delete' || e.key === 'Backspace'
      if (isDelete && !e.ctrlKey && !e.metaKey) {
        const selectedCells = _x6Graph?.getSelectedCells() || []
        if (selectedCells.length > 0) {
          e.preventDefault()
          _x6Graph?.removeCells(selectedCells)
        }
      }
    }
    document.addEventListener('keydown', _globalKeyHandler)

    // 监听 History 变更以更新 canUndo/canRedo
    const history = _x6Graph.getPlugin('history') as any
    if (history) {
      const updateUndoRedo = () => {
        canUndo.value = history.canUndo()
        canRedo.value = history.canRedo()
        eventBus.emit(KoruEvent.UNDO_CHANGED, { canUndo: canUndo.value, canRedo: canRedo.value })
      }
      updateUndoRedo()
      history.on('change', updateUndoRedo)

      // undo/redo 期间抑制 GRAPH_CHANGED，完成后统一触发一次
      history.on('undo', () => {
        inHistoryOperation = true
      })
      history.on('redo', () => {
        inHistoryOperation = true
      })
      history.on('undo', () => {
        requestAnimationFrame(() => {
          inHistoryOperation = false
          eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
        })
      })
      history.on('redo', () => {
        requestAnimationFrame(() => {
          inHistoryOperation = false
          eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
        })
      })
      // ✅ history change 里的 syncGroupMemberProtection / syncSingleCellProtection 已删除
      // parent-child 后 History 原生恢复父子关系，不需要手动同步 DOM 保护
    }

    bridgeX6Events()

    // 画布右键菜单事件：命中检测 + 状态填充
    if (container) {
      _contextMenuHandler = (e: MouseEvent) => {
        if (mode.value !== 'edit') return
        e.preventDefault()
        e.stopPropagation()
        // 抑制右键操作触发的 GRAPH_CHANGED（右键 mousedown 可能改变选中状态）
        // rAF 延迟一帧，确保 X6 的选中变更事件被抑制
        inHistoryOperation = true
        requestAnimationFrame(() => {
          inHistoryOperation = false
        })
        const g = _x6Graph
        if (!g) return

        // 命中检测
        let hitCell: Cell | null = null
        try {
          const local = g.clientToLocal({ x: e.clientX, y: e.clientY })
          hitCell = (g as any).getCellAt?.(local.x, local.y) ?? null
        } catch {
          hitCell = null
        }

        const selected = g.getSelectedCells()
        const selectedIds = new Set(selected.map((c) => c.id))
        let targetId = hitCell?.id ?? ''
        if (!targetId && selected.length > 0) {
          targetId = selected[0].id
        }

        const lockCell = hitCell || (selected.length ? selected[0] : null)
        const locked = lockCell ? !!lockCell.getData?.()?.locked : false

        const inGroup = (c: any) => !!c?.getData?.()?.isGroup || !!c?.getParent?.()
        const grouped = (hitCell && inGroup(hitCell)) || selected.some(inGroup)

        const hitIsMultiState = !!hitCell?.getData?.()?.isMultiState
        const isMultiStateTarget =
          (hitCell && hitCell.getData?.()?.isMultiState) ||
          selected.some((c: any) => c.getData?.()?.isMultiState)

        const nodeSel = selected.filter((c: any) => c.isNode?.())
        const canMultiState =
          nodeSel.length >= 2 && !nodeSel.some((c: any) => c.getData?.()?.isMultiState)

        // 更新 store 中的右键菜单状态
        store.ctxMenu.value = {
          visible: true,
          x: e.clientX,
          y: e.clientY,
          onNode: !!targetId,
          multi: selectedIds.size > 1,
          locked,
          cellId: targetId,
          grouped,
          isMultiState: !!isMultiStateTarget,
          isMultiStateMember: !!hitIsMultiState || !!hitCell?.getParent?.(),
          canMultiState,
          canPaste: g.isClipboardEmpty ? !g.isClipboardEmpty() : false,
        }
      }
      container.addEventListener('contextmenu', _contextMenuHandler)
    }

    applyMode(mode.value)
    eventBus.emit(KoruEvent.RENDERED)

    // 对已有的 custom-split 节点补绑分隔条拖拽
    // node:added 事件已在 bridgeX6Events 注册，这里通过 emit 触发即可
    setTimeout(() => {
      if (!_x6Graph) return
      _x6Graph.getNodes().forEach((n: any) => {
        if (n.shape === 'custom-split') {
          ;(_x6Graph as any).emit?.('node:added', { node: n })
        }
      })
    }, 100)
  }

  function destroy(): void {
    // 清理全局键盘监听（Ctrl+A / Delete / Backspace）
    if (_globalKeyHandler) {
      document.removeEventListener('keydown', _globalKeyHandler)
      _globalKeyHandler = null
    }
    // 清理右键菜单事件监听
    if (containerRef.value && _contextMenuHandler) {
      containerRef.value.removeEventListener('contextmenu', _contextMenuHandler)
      _contextMenuHandler = null
    }
    // 重置右键菜单状态
    store.ctxMenu.value = createDefaultContextMenuState()

    if (_x6Graph) {
      _x6Graph.dispose()
      _x6Graph = null
    }
    eventBus.emit(KoruEvent.DESTROYED)
    eventBus.clear()
    containerRef.value = null
  }

  // ========== 事件桥接 ==========

  function bridgeX6Events(): void {
    const g = _x6Graph
    if (!g) return

    // ========== 左右分栏节点（custom-split）：分隔条拖拽调整 ==========
    let splitDragState: { node: any; startX: number; ratio: number } | null = null

    /** 更新 split 节点左右栏布局（按 data.splitRatio 定位分割条、手柄和文本） */
    const updateSplitLayout = (node: any) => {
      const { width, height } = node.getSize?.() || { width: 160, height: 40 }
      const data = node.getData?.() as any
      const ratio = data?.splitRatio ?? 0.5
      const dividerX = width * ratio
      node.attr('divider/x1', dividerX)
      node.attr('divider/x2', dividerX)
      node.attr('divider/y2', height)
      node.attr('dividerHandle/x', dividerX - 6)
      node.attr('dividerHandle/y', height / 2 - 6)
      node.attr('leftText/refX2', dividerX / 2)
      node.attr('rightText/refX2', dividerX + (width - dividerX) / 2)
    }

    /** 给 split 节点的分割线/手柄绑定原生 mousedown 拖拽 */
    const bindSplitDividerDrag = (node: any) => {
      const container = _x6Graph?.container
      if (!container) return
      const nodeEl = container.querySelector(`[data-cell-id="${node.id}"]`)
      if (!nodeEl) return
      const dividerEl = nodeEl.querySelector(
        '[data-role="split-divider"]',
      ) as SVGGraphicsElement | null
      const handleEl = nodeEl.querySelector(
        '[data-role="split-handle"]',
      ) as SVGGraphicsElement | null
      const elements = [dividerEl, handleEl].filter(Boolean) as SVGGraphicsElement[]

      const setVisible = (v: boolean) => {
        elements.forEach((el) => el.setAttribute('display', v ? 'block' : 'none'))
      }

      if (!(nodeEl as any).__splitHoverBound) {
        ;(nodeEl as any).__splitHoverBound = true
        setVisible(false)
        nodeEl.addEventListener('mouseenter', () => setVisible(true))
        nodeEl.addEventListener('mouseleave', () => {
          if (!splitDragState || splitDragState.node.id !== node.id) setVisible(false)
        })
        document.addEventListener('mouseup', () => {
          if (!splitDragState) setVisible(false)
        })
      }

      elements.forEach((el) => {
        if ((el as any).__splitBound) return
        ;(el as any).__splitBound = true
        el.addEventListener('mousedown', (ev: MouseEvent) => {
          ev.stopPropagation()
          ev.preventDefault()
          splitDragState = {
            node,
            startX: ev.clientX,
            ratio: (node.getData?.() as any)?.splitRatio ?? 0.5,
          }

          const onMove = (me: MouseEvent) => {
            if (!splitDragState || splitDragState.node.id !== node.id) return
            const pos = node.position()
            const curSize = node.getSize?.() || { width: 160, height: 40 }
            const local = _x6Graph?.localToClient(pos.x, pos.y)
            if (!local) return
            const delta = me.clientX - local.x
            const newRatio = Math.min(0.85, Math.max(0.15, delta / curSize.width))
            node.setData?.({ splitRatio: newRatio }, { silent: true })
            updateSplitLayout(node)
          }
          const onUp = (me: MouseEvent) => {
            splitDragState = null
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            // 拖拽结束后通知持久化系统保存
            eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
            const pos = node.position()
            const s = node.getSize?.() || { width: 160, height: 40 }
            const client = _x6Graph?.localToClient(pos.x, pos.y)
            if (!client) return
            const inside =
              me.clientX >= client.x &&
              me.clientX <= client.x + s.width &&
              me.clientY >= client.y &&
              me.clientY <= client.y + s.height
            setVisible(inside)
          }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        })
      })
    }

    /** 延迟绑定分割条拖拽（确保节点 DOM 渲染完成后） */
    const bindSplitDelayed = (node: any) => {
      setTimeout(() => {
        try {
          bindSplitDividerDrag(node)
        } catch {
          // 绑定失败忽略
        }
      }, 50)
    }

    // ========== 左右分栏节点：双击编辑键名/键值 ==========
    let splitEditEl: HTMLInputElement | null = null
    const removeSplitEdit = () => {
      if (splitEditEl) {
        splitEditEl.remove()
        splitEditEl = null
      }
    }

    /** 双击 split 节点：在对应栏弹出一个输入框编辑文本 */
    const startSplitEdit = (node: any, side: 'left' | 'right') => {
      removeSplitEdit()
      const pos = node.position()
      const size = node.getSize?.() || { width: 160, height: 40 }
      const ratio = (node.getData?.() as any)?.splitRatio ?? 0.5
      const dividerX = size.width * ratio

      const topLeft = _x6Graph?.localToClient(pos.x, pos.y)
      const scale = _x6Graph?.scale()?.sx ?? 1
      if (!topLeft) return

      const input = document.createElement('input')
      input.type = 'text'
      input.style.position = 'fixed'
      input.style.zIndex = '9999'
      input.style.border = '1px solid #165DFF'
      input.style.borderRadius = '3px'
      input.style.fontSize = '12px'
      input.style.padding = '2px 4px'
      input.style.boxSizing = 'border-box'
      input.style.background = '#fff'
      input.value =
        side === 'left'
          ? (node.attr?.('leftText/text') ?? '')
          : (node.attr?.('rightText/text') ?? '')

      const left = topLeft.x
      const top = topLeft.y
      if (side === 'left') {
        input.style.left = `${left + 4}px`
        input.style.width = `${Math.max(30, dividerX * scale - 8)}px`
        input.style.top = `${top + (size.height * scale) / 2 - 10}px`
      } else {
        input.style.left = `${left + dividerX * scale + 4}px`
        input.style.width = `${Math.max(30, (size.width - dividerX) * scale - 8)}px`
        input.style.top = `${top + (size.height * scale) / 2 - 10}px`
      }

      const commit = () => {
        const val = input.value
        removeSplitEdit()
        if (side === 'left') {
          node.attr?.('leftText/text', val)
        } else {
          node.attr?.('rightText/text', val)
        }
      }

      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault()
          commit()
        } else if (ev.key === 'Escape') {
          removeSplitEdit()
        }
      })
      input.addEventListener('blur', commit)
      input.addEventListener('mousedown', (ev) => ev.stopPropagation())

      document.body.appendChild(input)
      splitEditEl = input
      input.focus()
      input.select()
    }

    // X6 parent-child: 用户点到子元素时自动选中父容器
    // 注意：不能 e.stopPropagation() —— 会杀死 X6 内部的 drag 启动链路
    g.on('node:mousedown', ({ node }: { node: any }) => {
      const parent = node.getParent?.()
      if (parent) {
        g.cleanSelection?.()
        g.select?.(parent)
      }
    })

    g.on('selection:changed', (args: { added: any[]; removed: any[]; selected: any[] }) => {
      selectedIds.value = args.selected.map((c: any) => c.id)
      eventBus.emit(KoruEvent.SELECTION_CHANGED, selectedIds.value)
    })
    g.on('scale', ({ sx }: { sx: number }) => {
      zoomScale.value = sx
      eventBus.emit(KoruEvent.ZOOM_CHANGED, sx)
    })
    g.on('node:click', ({ node, e }: { node: any; e: MouseEvent }) =>
      eventBus.emit(KoruEvent.NODE_CLICK, {
        nodeId: node.id,
        node: safeToJSON(node),
        originalEvent: e,
      }),
    )
    g.on('node:dblclick', ({ node, e }: { node: any; e: MouseEvent }) => {
      // 左右分栏节点：双击分别编辑键名/键值
      if (node.shape === 'custom-split') {
        const pos = node.position()
        const size = node.getSize?.() || { width: 160, height: 40 }
        const ratio = (node.getData?.() as any)?.splitRatio ?? 0.5
        const dividerX = size.width * ratio
        const local = _x6Graph?.localToClient(pos.x, pos.y)
        if (local) {
          const localX = e.clientX - local.x
          startSplitEdit(node, localX < dividerX ? 'left' : 'right')
          return
        }
      }
      eventBus.emit(KoruEvent.NODE_DBLCLICK, {
        nodeId: node.id,
        node: safeToJSON(node),
        originalEvent: e,
      })
    })
    g.on('node:mouseenter', ({ node }: { node: any }) =>
      eventBus.emit(KoruEvent.NODE_MOUSEOVER, { nodeId: node.id }),
    )
    g.on('node:mouseleave', ({ node }: { node: any }) =>
      eventBus.emit(KoruEvent.NODE_MOUSEOUT, { nodeId: node.id }),
    )
    g.on('node:added', ({ node }: { node: any }) => {
      // 模板节点：由 KoruToolbar 的 handleDraggedTemplateAdded 统一处理
      // （它会弹确认框，用户点确定后才 applyTemplateToCanvas）
      // 这里不再自动展开，避免抢在确认框之前把模板内容加进画布
      const nodeData = node.getData?.() as any
      if (nodeData?.isTemplate) {
        return
      }
      // 左右分栏节点：延迟绑定分隔条拖拽
      if (node.shape === 'custom-split') {
        updateSplitLayout(node)
        bindSplitDelayed(node)
      }
      eventBus.emit(KoruEvent.NODE_ADDED, { nodeId: node.id, node: safeToJSON(node) })

      // 确保节点 label 同步到 data.name，方便后续读取（如多状态编辑器的子图元列表）
      try {
        const existingData = node.getData?.() || {}
        if (!existingData?.name) {
          // 尝试从多种来源提取 label 文本
          let labelText = ''
          // 1. X6 label getter
          if (node.label?.text) labelText = String(node.label.text)
          // 2. X6 getLabels API
          if (!labelText) {
            const labels = node.getLabels?.()
            if (Array.isArray(labels) && labels[0]?.text) labelText = String(labels[0].text)
          }
          // 3. data.label（writeNodeLabel 存储）
          if (!labelText && existingData?.label) labelText = String(existingData.label)
          // 4. attr('text/text')
          if (!labelText) {
            const t = node.attr?.('text/text')
            if (t != null) labelText = String(t)
          }
          // 5. getProp('label')
          if (!labelText) {
            const p = node.getProp?.('label')
            if (typeof p === 'string' && p) labelText = p
            else if (p?.text) labelText = String(p.text)
          }
          if (labelText) {
            node.setData?.({ ...existingData, name: labelText })
          }
        }
      } catch {
        /* ignore */
      }
    })
    g.on('node:removed', ({ node }: { node: any }) =>
      eventBus.emit(KoruEvent.NODE_REMOVED, node.id),
    )
    g.on('node:move', ({ node }: { node: any }) =>
      eventBus.emit(KoruEvent.NODE_DRAG, { nodeId: node.id }),
    )
    // 拖拽过程中位置实时变化（node:move 只触发一次，change:position 持续触发）
    g.on('node:change:position', ({ node }: { node: any }) => {
      eventBus.emit(KoruEvent.NODE_DRAG, { nodeId: node.id })
    })
    // 画布手柄缩放：shape-line 节点需手动更新 path 的 d 属性
    g.on('node:resized', ({ node }: { node: any }) => {
      if (node.shape === 'shape-line') {
        const { width, height } = node.getSize?.() || { width: 55, height: 2 }
        node.attr('body/fill', 'transparent')
        node.attr('body/stroke', 'none')
        node.attr('line/d', `M0 ${height / 2} L${width} ${height / 2}`)
      }
      if (node.shape === 'custom-split') {
        updateSplitLayout(node)
        bindSplitDelayed(node)
      }
      eventBus.emit(KoruEvent.NODE_RESIZED, { nodeId: node.id })
    })
    g.on('node:resizing', ({ node }: { node: any }) => {
      if (node.shape === 'shape-line') {
        const { width, height } = node.getSize?.() || { width: 55, height: 2 }
        node.attr('body/fill', 'transparent')
        node.attr('body/stroke', 'none')
        node.attr('line/d', `M0 ${height / 2} L${width} ${height / 2}`)
      }
      if (node.shape === 'custom-split') {
        updateSplitLayout(node)
      }
      eventBus.emit(KoruEvent.NODE_RESIZING, { nodeId: node.id })
    })
    // 锁定宽高比变化时，重建当前选中节点 Transform 控件，使 preserveAspectRatio 即时生效
    g.on('node:change:data', ({ node }: { node: any }) => {
      // 仅对当前选中的节点重建控件，避免不必要的性能开销
      if (!selectedIds.value.includes(node.id)) return
      const curCell = _x6Graph?.getCellById(node.id)
      if (curCell && curCell.isNode?.()) {
        try {
          const plugin = (_x6Graph as any)?.getPlugin?.('transform')
          if (plugin && typeof plugin.createWidget === 'function') {
            plugin.createWidget(node)
          }
        } catch {
          /* ignore */
        }
      }
    })
    // 画布手柄旋转：同步属性面板角度
    g.on('node:rotated', ({ node }: { node: any }) => {
      eventBus.emit(KoruEvent.NODE_ROTATED, { nodeId: node.id })
    })
    g.on('node:rotating', ({ node }: { node: any }) => {
      eventBus.emit(KoruEvent.NODE_ROTATING, { nodeId: node.id })
    })
    g.on('edge:click', ({ edge, e }: { edge: any; e: MouseEvent }) =>
      eventBus.emit(KoruEvent.EDGE_CLICK, {
        edgeId: edge.id,
        edge: safeToJSON(edge),
        originalEvent: e,
      }),
    )
    g.on('edge:added', ({ edge }: { edge: any }) =>
      eventBus.emit(KoruEvent.EDGE_ADDED, { edgeId: edge.id, edge: safeToJSON(edge) }),
    )
    g.on('edge:removed', ({ edge }: { edge: any }) =>
      eventBus.emit(KoruEvent.EDGE_REMOVED, edge.id),
    )
    // 选中变更不触发 GRAPH_CHANGED（仅 UI 状态变化，非数据变化）
    g.on('cell:change:selected', () => {
      console.log('[GRAPH_CHANGED] skip: cell:change:selected')
    })
    // 实际数据变更才触发 GRAPH_CHANGED
    g.on('cell:change:*', ({ key }: { key?: string }) => {
      if (inBatchOperation || inHistoryOperation || isDragging) return
      if (key === 'selected') {
        console.log('[GRAPH_CHANGED] skip: key=selected via wildcard')
        return
      }
      console.log(`[GRAPH_CHANGED] trigger: cell:change:* key=${key}`)
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    })
    g.on('cell:added', () => {
      if (inBatchOperation || inHistoryOperation) return
      console.log('[GRAPH_CHANGED] trigger: cell:added')
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    })
    g.on('cell:removed', () => {
      if (inBatchOperation || inHistoryOperation) return
      console.log('[GRAPH_CHANGED] trigger: cell:removed')
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    })
    g.on('batch:stop', ({ name }: { name?: string }) => {
      if (inHistoryOperation) return
      // 只对数据变更相关的 batch 触发保存，过滤选中/拖拽等 UI 操作的 batch
      const DATA_BATCHES = new Set(['combine', 'combineState', 'uncombine', 'uncombineMultiState'])
      if (!name || !DATA_BATCHES.has(name)) {
        console.log(`[GRAPH_CHANGED] skip: batch:stop name=${name} (not a data batch)`)
        return
      }
      console.log(`[GRAPH_CHANGED] trigger: batch:stop name=${name}`)
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    })
    g.on('node:dragend', () => {
      console.log('[GRAPH_CHANGED] trigger: node:dragend')
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    })
    g.on('edge:dragend', () => {
      console.log('[GRAPH_CHANGED] trigger: edge:dragend')
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    })

    // ---- 组合容器拖动联动 ----
    // 由 X6 原生 parent-child 机制自动处理：移动父 → 子自动跟随，零代码
    let groupSyncing = false
    // startBatch/stopBatch 操作期间，抑制位置/选中事件处理
    let inBatchOperation = false
    const BATCH_NAMES = new Set(['combine', 'combineState', 'uncombine', 'uncombineMultiState'])
    g.on('batch:start', ({ name }: { name: string }) => {
      if (BATCH_NAMES.has(name)) inBatchOperation = true
    })
    g.on('batch:stop', ({ name }: { name: string }) => {
      if (BATCH_NAMES.has(name)) inBatchOperation = false
    })
    // ✅ 拖动联动已由 X6 parent-child 自动处理（移动父 → 子自动跟随）
    // ✅ 缩放联动已由 X6 parent-child 自动处理（父 resize → 子自动缩放）

    // 容器选中时移除其 Transform 手柄（容器仅整体移动，不显示缩放方块）
    g.on('cell:selected', ({ cell }: any) => {
      if (inBatchOperation) return
      if (cell?.getData?.()?.isGroup || cell?.getData?.()?.isMultiState) {
        const view = g.findViewByCell?.(cell)
        const el = view?.container as HTMLElement | undefined
        if (el?.classList) {
          el.classList.remove('has-widget-transform')
          el.classList.remove('x6-node-selected')
        }
        try {
          view?.removeTools?.()
        } catch {
          /* ignore */
        }
        // 清理 DOM 中残留的 transform widget 元素
        const graphContainer = g.container as HTMLElement | undefined
        if (graphContainer) {
          graphContainer
            .querySelectorAll?.('.x6-widget-transform')
            ?.forEach((e: Element) => e.remove())
        }
        if (typeof document !== 'undefined') {
          document.querySelectorAll?.('.x6-widget-transform')?.forEach((e: Element) => {
            if (!graphContainer?.contains?.(e)) e.remove()
          })
        }
      }
    })

    // 拦截成员选中：一旦成员被选中，立即改选其 group 容器
    let interceptSyncing = false
    g.on('cell:selected', ({ cell }: any) => {
      if (inBatchOperation) return
      if (interceptSyncing) return
      if (cell?.getData?.()?.isGroup || cell?.getData?.()?.isMultiState) return
      const parent = cell?.getParent?.()
      if (!parent) return
      interceptSyncing = true
      try {
        g.cleanSelection?.()
        g.select?.(parent)
      } finally {
        setTimeout(() => (interceptSyncing = false), 0)
      }
    })
  }

  // ========== 模式管理 ==========

  function applyMode(newMode: KoruGraphEditorMode): void {
    const g = _x6Graph
    if (!g) return
    const isEdit = newMode === 'edit'
    // interacting 保持 init 时设置的函数形式（含 group 成员保护），
    // 只更新函数内对非成员 cell 返回的 nodeMovable/edgeMovable 值
    const prevFn = g.options.interacting as any
    if (typeof prevFn === 'function') {
      // 把简单值包成闭包 —— 调用时 group 成员仍返回全 false，其他成员返回下面的值
      // X6 parent-child: interacting 不能对子元素返回 nodeMovable: false，否则传播被阻断
      g.options.interacting = (cellView: any) => {
        const hasParent = !!cellView?.cell?.getParent?.()
        return {
          nodeMovable: isEdit && config.allowDragNode,   // 子元素也允许被 parent-child 传播移动
          edgeMovable: isEdit && config.allowCreateEdge,
          magnetConnectable: hasParent ? false : (isEdit && config.allowCreateEdge),
          toolsAddable: hasParent ? false : true,
        }
      }
    } else {
      g.options.interacting = (cellView: any) => {
        const hasParent = !!cellView?.cell?.getParent?.()
        return {
          nodeMovable: isEdit && config.allowDragNode,
          edgeMovable: isEdit && config.allowCreateEdge,
          magnetConnectable: hasParent ? false : (isEdit && config.allowCreateEdge),
        }
      }
    }
    if (isEdit) {
      g.enablePanning?.()
      g.enableMouseWheel?.()
    } else {
      g.disablePanning?.()
    }
  }

  function getMode(): KoruGraphEditorMode {
    return mode.value
  }
  function setMode(newMode: KoruGraphEditorMode): void {
    mode.value = newMode
    applyMode(newMode)
    eventBus.emit(KoruEvent.MODE_CHANGED, newMode)
  }
  function isEditMode(): boolean {
    return mode.value === 'edit'
  }
  function isPreviewMode(): boolean {
    return mode.value === 'preview'
  }

  function undo(): void {
    const history = _x6Graph?.getPlugin('history') as any
    history?.undo()
  }
  function redo(): void {
    const history = _x6Graph?.getPlugin('history') as any
    history?.redo()
  }
  function removeSelectedCells(): void {
    if (!_x6Graph) return
    const cells = _x6Graph.getSelectedCells()
    if (cells.length === 0) return
    // 组合感知：删除时展开容器/成员，确保整个组合一起删除
    const expanded = expandGroupCellsLocal(cells)
    _x6Graph.removeCells(expanded)
    selectedIds.value = []
  }

  /** 本地版 expandGroupCells（不依赖 useContextMenu）
   * X6 原生 parent-child：parent 找根容器，容器找全部 descendants
   */
  function expandGroupCellsLocal(cells: any[]): any[] {
    if (!_x6Graph) return cells
    const graph = _x6Graph
    const result = new Set<string>()
    cells.forEach((c: any) => {
      if (!c?.id) return
      // 成员节点：向上找父容器 → 把整个 descendants 都加进来
      const parent = c.getParent?.()
      if (parent) {
        result.add(parent.id)
        parent.getDescendants?.().forEach((d: any) => result.add(d.id))
      } else {
        // 容器或独立节点
        result.add(c.id)
        c.getDescendants?.().forEach((d: any) => result.add(d.id))
      }
    })
    return Array.from(result)
      .map((id) => graph.getCellById(id))
      .filter(Boolean)
  }

  // ✅ 成员保护相关函数已删除（applyMemberProtectionInline / setDomPointerEventsNone /
  //    syncSingleCellProtection / syncGroupMemberProtection / getAllSelectorsLocal）
  // parent-child 后成员不再需要手动 selectable / pointer-events 保护

  // ========== 视口控制 ==========

  function zoomIn(): void {
    const g = _x6Graph
    if (!g) return
    g.zoomTo(Math.min(g.zoom() * 1.2, config.zoom.max))
  }
  function zoomOut(): void {
    const g = _x6Graph
    if (!g) return
    g.zoomTo(Math.max(g.zoom() / 1.2, config.zoom.min))
  }
  function resetView(): void {
    const g = _x6Graph
    if (!g) return
    g.zoomTo(1)
    g.centerContent()
  }
  function fitView(): void {
    const g = _x6Graph
    if (!g) return
    g.zoomToFit({ padding: 40, maxScale: 1 })
  }
  function setZoom(scale: number): void {
    const g = _x6Graph
    if (!g) return
    g.zoomTo(Math.min(Math.max(scale, config.zoom.min), config.zoom.max))
  }

  // ========== 图数据操作 ==========

  function addNode(node: Partial<KoruNodeData>): string {
    const g = _x6Graph
    if (!g) return ''
    const id = node.id || `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const x6Node = g.addNode({
      id,
      shape: node.shape || 'rect',
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 100,
      height: node.height ?? 60,
      label: node.label,
      attrs: node.attrs,
      data: node.data,
      ports: node.ports
        ? { items: node.ports.map((p) => ({ id: p.id, group: p.group })) }
        : undefined,
    })
    // 应用动画配置（如果有）
    if (node.data?.animation) {
      applyCellAnimation(x6Node, node.data.animation)
    }
    return x6Node.id
  }

  function removeNode(nodeId: string): void {
    _x6Graph?.removeNode(nodeId)
  }

  function getCell(cellId: string): Node | Edge | undefined {
    return (_x6Graph?.getCellById(cellId) as Node | Edge) || undefined
  }

  function updateNode(nodeId: string, data: Partial<KoruNodeData>): void {
    const n = _x6Graph?.getCellById(nodeId) as Node | undefined
    if (!n) return
    if (data.x != null || data.y != null)
      n.position(data.x ?? n.position().x, data.y ?? n.position().y)
    if (data.width != null || data.height != null)
      n.setSize(data.width ?? n.getSize().width, data.height ?? n.getSize().height)
    if (data.label != null) writeNodeLabel(n, data.label)
    if (data.attrs) Object.entries(data.attrs).forEach(([sel, a]) => n.attr(sel, a))
    if (data.data) {
      n.replaceData({ ...n.getData(), ...data.data })
      // 同步持久化：replaceData 已触发 cell:change:*（L635 已监听），此处作为冗余安全保障
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    }
  }

  /** 读取节点标签（兼容多种存储位置） */
  function readNodeLabel(cell: Node | Edge): string {
    // 1. data.name（node:added 时已同步，最可靠）
    try {
      const d = (cell as any).getData?.()
      if (d?.name != null) return String(d.name)
      if (d?.label != null) return String(d.label)
    } catch {
      // ignore
    }
    // 2. cell.attr('text/text')
    try {
      const t = cell.attr('text/text')
      if (t != null) return String(t)
    } catch {
      // ignore
    }
    // 3. getProp('label')
    try {
      const p = (cell as any).getProp?.('label')
      if (typeof p === 'string') return p
      if (p && typeof p === 'object' && p.text != null) return String(p.text)
    } catch {
      // ignore
    }
    // 4. c.label.text（X6 label getter）
    try {
      if ((cell as any)?.label?.text != null) return String((cell as any).label.text)
    } catch {
      // ignore
    }
    // 5. getLabels API
    try {
      const labels = (cell as any)?.getLabels?.()
      if (Array.isArray(labels) && labels[0]?.text != null) return String(labels[0].text)
    } catch {
      // ignore
    }
    return ''
  }

  /** 写入节点标签（按形状选择存储位置） */
  function writeNodeLabel(cell: Node | Edge, value: any): void {
    const v = String(value)
    if (cell.shape === 'custom-text') {
      cell.attr('label/text', v)
      // 同步到 data.name，确保多状态编辑器等场景能可靠读取
      const d = (cell as any).getData?.() || {}
      ;(cell as any).setData?.({ ...d, name: v })
    } else if (cell.shape === 'custom-button') {
      cell.attr('text/text', v)
      const d = (cell as any).getData?.() || {}
      ;(cell as any).setData?.({ ...d, name: v })
    } else if (cell.shape === 'custom-split') {
      cell.attr('leftText/text', v)
      const d = (cell as any).getData?.() || {}
      ;(cell as any).setData?.({ ...d, name: v })
    } else if (cell.shape === 'shape-line') {
      const d = (cell as any).getData?.() || {}
      ;(cell as any).setData?.({ ...d, label: v, name: v })
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    } else if (cell.shape?.startsWith('svg-node-')) {
      const d = (cell as any).getData?.() || {}
      ;(cell as any).setData?.({ ...d, label: v, name: v })
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    } else {
      cell.attr('text/text', v)
      const d = (cell as any).getData?.() || {}
      ;(cell as any).setData?.({ ...d, name: v })
    }
  }

  /** 单属性更新（供属性面板使用） */
  function updateCellProp(cellId: string, key: string, value: any): void {
    const cell = _x6Graph?.getCellById(cellId) as any
    if (!cell) return

    // 业务配置存于 data（使用 replaceData 而非 setData，避免深度合并导致删除失效）
    if (key === 'lockAspect' || key === 'animation' || key === 'eventConfig' || key === 'binding') {
      const cur = cell.getData?.() || {}
      cell.replaceData?.({
        ...cur,
        [key]: typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value,
      })
      // 注意：不再额外 emit GRAPH_CHANGED —— replaceData 已触发 cell:change:* 通配符（L831），
      // 此处若重复发射会导致 graphChangePending 守卫失效，触发 setGraphData 全量重建节点
      // 动画配置变化时立即应用
      if (key === 'animation') {
        applyCellAnimation(cell, value)
      }
      return
    }

    // ---- 组合容器属性传播：容器设视觉属性 → 同步到所有成员 ----
    // 必须在 cell.isNode() 处理之前检查，避免容器自身被修改
    const cellData = cell.getData?.() || {}
    const isContainer = cellData.isGroup || cellData.isMultiState
    if (isContainer) {
      const visualKeys = [
        'fill',
        'stroke',
        'strokeWidth',
        'fontSize',
        'fontColor',
        'leftFontSize',
        'leftFontColor',
        'rightFontSize',
        'rightFontColor',
        'leftText',
        'rightText',
        'text',
        'label',
        'dashed',
        'lineDashed',
        'lineAnim',
        'lineAnimDir',
      ]
      if (visualKeys.includes(key)) {
        const members = (cell.getChildren?.() || []).filter(
          (c: any) => c.isNode?.() && c.id !== cell.id,
        )
        // 用 batchUpdate 包裹成员属性更新，确保 undo 一次撤销所有成员变更
        _x6Graph?.batchUpdate?.(() => {
          members.forEach((m: any) => {
            // 成员不是容器，isContainer 检查会跳过传播，不会递归
            updateCellProp(m.id, key, value)
          })
        })
        return // 不修改容器自身的视觉属性
      }
    }

    if (cell.isNode?.()) {
      if (key === 'label') {
        writeNodeLabel(cell, value)
      } else if (key === 'text') {
        if (cell.shape === 'custom-text') cell.attr('label/text', value)
        else if (cell.shape === 'custom-button') cell.attr('text/text', value)
        else cell.attr('text/text', value)
      } else if (key === 'fontSize') {
        const sel = cell.shape === 'custom-text' ? 'label' : 'text'
        cell.attr(`${sel}/fontSize`, value)
      } else if (key === 'fontColor') {
        const sel = cell.shape === 'custom-text' ? 'label' : 'text'
        cell.attr(`${sel}/fill`, value)
      } else if (key === 'leftText') {
        cell.attr('leftText/text', value)
      } else if (key === 'rightText') {
        cell.attr('rightText/text', value)
      } else if (key === 'leftFontSize' || key === 'leftFontColor') {
        const attr = key === 'leftFontSize' ? 'fontSize' : 'fill'
        cell.attr(`leftText/${attr}`, value)
      } else if (key === 'rightFontSize' || key === 'rightFontColor') {
        const attr = key === 'rightFontSize' ? 'fontSize' : 'fill'
        cell.attr(`rightText/${attr}`, value)
      } else if (key === 'fill' || key === 'stroke') {
        if (cell.shape === 'shape-line') {
          cell.attr('body/fill', 'transparent')
          cell.attr('body/stroke', 'none')
          cell.attr('line/stroke', value)
          // 兜底：确保 path 有 d 属性
          if (!cell.attr('line/d')) {
            const { width, height } = cell.getSize?.() || { width: 55, height: 2 }
            cell.attr('line/d', `M0 ${height / 2} L${width} ${height / 2}`)
          }
        } else if (cell.shape?.startsWith('svg-node-')) {
          const shapeIdx = parseInt(cell.shape.replace('svg-node-', ''))
          const item = store.customShapesRef.value?.[shapeIdx]
          // 始终同步 color（SVG 内部 currentColor 元素跟随变色）
          cell.attr('svg-body/color', value)
          if (key === 'fill') {
            // 填充色：同时作用于 fill + stroke（如符号支持）
            if (item?.hasFill) cell.attr('svg-body/fill', value)
            if (item?.hasStroke) cell.attr('svg-body/stroke', value)
          } else if (key === 'stroke' && item?.hasStroke) {
            // 边框色：独立控制 stroke
            cell.attr('svg-body/stroke', value)
          }
        } else {
          cell.attr(`body/${key}`, value)
        }
      } else if (key === 'strokeWidth') {
        if (cell.shape === 'shape-line') {
          cell.attr('body/fill', 'transparent')
          cell.attr('body/stroke', 'none')
          cell.attr('line/strokeWidth', value)
          // 兜底：确保 path 有 d 属性
          if (!cell.attr('line/d')) {
            const { width, height } = cell.getSize?.() || { width: 55, height: 2 }
            cell.attr('line/d', `M0 ${height / 2} L${width} ${height / 2}`)
          }
        } else if (cell.shape?.startsWith('svg-node-')) {
          cell.attr('svg-body/stroke-width', value)
        } else {
          cell.attr('body/strokeWidth', value)
        }
      } else if (key === 'lineDashed') {
        if (cell.shape === 'shape-line') {
          cell.attr('body/fill', 'transparent')
          cell.attr('body/stroke', 'none')
          // 兜底：确保 path 有 d 属性
          if (!cell.attr('line/d')) {
            const { width, height } = cell.getSize?.() || { width: 55, height: 2 }
            cell.attr('line/d', `M0 ${height / 2} L${width} ${height / 2}`)
          }
          if (value) {
            cell.attr('line/strokeDasharray', '6 4')
          } else {
            cell.attr('line/strokeDasharray', null)
          }
        }
      } else if (key === 'width' || key === 'height') {
        const size = cell.getSize?.() || { width: 100, height: 60 }
        const lockAspect = !!cell.getData?.()?.lockAspect
        let w = key === 'width' ? Number(value) : size.width
        let h = key === 'height' ? Number(value) : size.height
        // 锁定宽高比时，按比例计算另一边
        if (lockAspect) {
          const ratio = size.width / size.height
          if (key === 'width') {
            h = Math.max(1, Math.round(w / ratio))
          } else {
            w = Math.max(1, Math.round(h * ratio))
          }
        }
        cell.resize?.(Math.max(1, w), Math.max(1, h))
        // shape-line 节点：resize 后显式更新 path 的 d 属性
        if (cell.shape === 'shape-line') {
          cell.attr('body/fill', 'transparent')
          cell.attr('body/stroke', 'none')
          cell.attr('line/d', `M0 ${h / 2} L${w} ${h / 2}`)
        }
      } else if (key === 'x' || key === 'y') {
        const pos = cell.getPosition?.() || { x: 0, y: 0 }
        const x = key === 'x' ? Number(value) : pos.x
        const y = key === 'y' ? Number(value) : pos.y
        cell.position?.(x, y)
      } else if (key === 'angle') {
        cell.rotate?.(Number(value), { absolute: true })
      } else if (key === 'dashed') {
        // 普通节点线型：实线/虚线
        if (cell.shape === 'shape-line') return
        if (value) {
          if (cell.shape?.startsWith('svg-node-')) {
            cell.attr('svg-body/stroke-dasharray', '6 4')
          } else {
            cell.attr('body/strokeDasharray', '6 4')
          }
        } else {
          if (cell.shape?.startsWith('svg-node-')) {
            cell.attr('svg-body/stroke-dasharray', null)
          } else {
            cell.attr('body/strokeDasharray', null)
          }
        }
      } else if (key === 'lineAnim') {
        // 线条节点动画：通过 line className 控制 CSS 动画
        if (cell.shape === 'shape-line') {
          const curClass = String(cell.attr('line/className') || '')
          const others = curClass
            .split(/\s+/)
            .filter((c) => !/^shape-line-anim-(flow|bead|trail|current)$/.test(c))
            .join(' ')
          const cls = [others, value !== 'none' ? `shape-line-anim-${value}` : '']
            .filter(Boolean)
            .join(' ')
          setLineClassName(cell, cls)
        }
      } else if (key === 'lineAnimDir') {
        // 线条节点动画方向控制：通过 line className 添加/移除 reverse 标记
        if (cell.shape === 'shape-line') {
          const curClass = String(cell.attr('line/className') || '')
          const others = curClass
            .split(/\s+/)
            .filter((c) => !/^shape-line-anim-reverse$/.test(c))
            .join(' ')
          const cls = [others, value === 'reverse' ? 'shape-line-anim-reverse' : '']
            .filter(Boolean)
            .join(' ')
          setLineClassName(cell, cls)
        }
      }
    } else if (cell.isEdge?.()) {
      if (key === 'label') {
        const text = String(value || '')
        if (text) {
          cell.labels = [{ attrs: { text: { text } } }]
        } else {
          cell.labels = []
        }
      } else if (key === 'stroke') {
        cell.attr('line/stroke', value)
      } else if (key === 'strokeWidth') {
        cell.attr('line/strokeWidth', value)
      } else if (key === 'dashed') {
        cell.attr('line/strokeDasharray', value ? '5 3' : undefined)
      } else if (key === 'hasArrow') {
        if (value) {
          cell.attr('line/targetMarker', { name: 'block', width: 12, height: 8 })
        } else {
          cell.attr('line/targetMarker', undefined)
          cell.attr('line/sourceMarker', undefined)
        }
      } else if (key === 'arrowDirection') {
        const dir = value || 'target'
        const marker = { name: 'block', width: 12, height: 8 }
        if (dir === 'source') {
          cell.attr('line/sourceMarker', marker)
          cell.attr('line/targetMarker', undefined)
        } else if (dir === 'target') {
          cell.attr('line/sourceMarker', undefined)
          cell.attr('line/targetMarker', marker)
        } else if (dir === 'both') {
          cell.attr('line/sourceMarker', marker)
          cell.attr('line/targetMarker', marker)
        } else {
          cell.attr('line/sourceMarker', undefined)
          cell.attr('line/targetMarker', undefined)
        }
      }
    }
  }

  /** 读取 cell 属性到属性面板数据 */
  function readCellProps(cellId: string): Record<string, any> {
    const cell = _x6Graph?.getCellById(cellId) as any
    if (!cell) return {}

    const data: Record<string, any> = {
      id: cell.id,
      type: cell.isNode?.() ? 'node' : cell.isEdge?.() ? 'edge' : 'unknown',
      shape: cell.shape,
    }

    if (cell.isNode?.()) {
      const pos = cell.getPosition?.() || { x: 0, y: 0 }
      const size = cell.getSize?.() || { width: 100, height: 60 }
      data.label = readNodeLabel(cell)
      data.x = pos.x
      data.y = pos.y
      data.width = size.width
      data.height = size.height
      data.angle = Math.round((((cell.getAngle?.() ?? 0) % 360) + 360) % 360)

      // 组合容器：从第一个成员读取视觉属性（容器自身的视觉属性不代表用户实际看到的）
      const cellData = cell.getData?.() || {}
      // 暴露多状态标志，供属性面板显示"编辑多状态"入口
      data.isMultiState = !!cellData.isMultiState
      data.isGroup = !!cellData.isGroup
      // 暴露多状态配置，供绑定面板显示"状态-元件状态映射"模板
      data.stateList = cellData.stateList || []
      data.activeStateId = cellData.activeStateId || ''
      const isContainer = cellData.isGroup || cellData.isMultiState
      if (isContainer) {
        const members = (cell.getChildren?.() || []).filter(
          (c: any) => c.isNode?.() && c.id !== cell.id,
        )
        if (members.length > 0) {
          const firstMember = members[0]
          // 从第一个成员读取视觉相关属性
          const memberData = readCellProps(firstMember.id)
          // 保留容器自身的结构属性（位置/尺寸/旋转/标签），覆盖视觉属性
          const visualKeys = [
            'fill',
            'stroke',
            'strokeWidth',
            'fontSize',
            'fontColor',
            'leftFontSize',
            'leftFontColor',
            'rightFontSize',
            'rightFontColor',
            'leftText',
            'rightText',
            'text',
            'dashed',
          ]
          visualKeys.forEach((k) => {
            if (memberData[k] !== undefined) data[k] = memberData[k]
          })
          // 同步 shape（用于面板判断节点类型）
          data.shape = memberData.shape || data.shape
        }
      } else if (cell.shape === 'shape-line') {
        data.fill = cell.attr('line/stroke') || '#333333'
        data.stroke = cell.attr('line/stroke') || '#333333'
        data.strokeWidth = Number(cell.attr('line/strokeWidth') || 5)
        data.lineDashed = !!cell.attr('line/strokeDasharray')
        // 线条动画：从 line/className 解析
        const lineClass = String(cell.attr('line/className') || '')
        data.lineAnim = /shape-line-anim-(flow|bead|trail|current)/.exec(lineClass)?.[1] || 'none'
        data.lineAnimDir = lineClass.includes('shape-line-anim-reverse') ? 'reverse' : 'normal'
      } else if (cell.shape?.startsWith('svg-node-')) {
        // SVG 节点：颜色统一通过 svg-body/color 继承
        // 内部 currentColor 元素跟随 color，实心填充/描边元素分别跟随 fill/stroke
        const rootColor = String(cell.attr('svg-body/color') || '')
        data.fill = rootColor || '#000000'
        data.stroke = rootColor || '#000000'
        data.strokeWidth = Number(cell.attr('svg-body/stroke-width') || 1)
        data.dashed = !!cell.attr('svg-body/stroke-dasharray')
      } else {
        data.fill = cell.attr('body/fill') || '#EFF4FF'
        data.stroke = cell.attr('body/stroke') || '#5F95FF'
        data.strokeWidth = Number(cell.attr('body/strokeWidth') || 1)
        data.dashed = !!cell.attr('body/strokeDasharray')
      }

      if (cell.shape === 'custom-text') {
        data.text = cell.attr('label/text') || ''
        data.fontSize = Number(cell.attr('label/fontSize') || 14)
        data.fontColor = cell.attr('label/fill') || '#1D2129'
      } else if (cell.shape === 'custom-button') {
        data.text = cell.attr('text/text') || ''
        data.fontSize = Number(cell.attr('text/fontSize') || 13)
        data.fontColor = cell.attr('text/fill') || '#fff'
      } else if (cell.shape === 'custom-split') {
        data.leftText = cell.attr('leftText/text') || ''
        data.leftFontSize = Number(cell.attr('leftText/fontSize') || 13)
        data.leftFontColor = cell.attr('leftText/fill') || '#262626'
        data.rightText = cell.attr('rightText/text') || ''
        data.rightFontSize = Number(cell.attr('rightText/fontSize') || 13)
        data.rightFontColor = cell.attr('rightText/fill') || '#262626'
      }

      if (cell.shape === 'custom-split') {
        data.splitRatio = cellData.splitRatio ?? 0.5
      }
      // animation / eventConfig / binding / lockAspect 从自身 data 读取
      // （容器和成员都从自身 data 读取，不传播业务配置）
      data.animation = cellData.animation || null
      data.eventConfig = cellData.eventConfig || null
      data.binding = cellData.binding || null
      data.lockAspect = !!cellData.lockAspect
    } else if (cell.isEdge?.()) {
      const labels = cell.labels || []
      data.label = labels[0]?.attrs?.text?.text || ''
      data.stroke = cell.attr('line/stroke') || '#A2B1C3'
      data.strokeWidth = Number(cell.attr('line/strokeWidth') || 2)
      data.dashed = !!cell.attr('line/strokeDasharray')
      data.hasArrow = !!cell.attr('line/targetMarker')
      const hasSource = !!cell.attr('line/sourceMarker')
      const hasTarget = !!cell.attr('line/targetMarker')
      if (hasSource && hasTarget) data.arrowDirection = 'both'
      else if (hasSource) data.arrowDirection = 'source'
      else if (hasTarget) data.arrowDirection = 'target'
      else data.arrowDirection = 'none'
      const edgeData = cell.getData?.() || {}
      data.eventConfig = edgeData.eventConfig || null
      data.binding = edgeData.binding || null
    }

    return data
  }

  /** 多选批量属性更新 */
  function updateSelectedCellsProp(key: string, value: any): void {
    const g = _x6Graph
    if (!g) return
    const cells = g.getSelectedCells()
    if (cells.length === 0) return
    cells.forEach((c: any) => updateCellProp(c.id, key, value))
  }

  function addEdge(edge: Partial<KoruEdgeData>): string {
    const g = _x6Graph
    if (!g) return ''
    const id = edge.id || `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const source = {
      cell: edge.source || '',
      ...(edge.sourcePort ? { port: edge.sourcePort } : {}),
    } as any
    const target = {
      cell: edge.target || '',
      ...(edge.targetPort ? { port: edge.targetPort } : {}),
    } as any
    const x6Edge = g.addEdge({
      id,
      source,
      target,
      attrs: edge.attrs,
      labels: edge.label ? [{ attrs: { text: { text: edge.label } } }] : undefined,
      data: edge.data,
    })
    // 应用动画配置（如果有）
    if (edge.data?.animation) {
      applyCellAnimation(x6Edge, edge.data.animation)
    }
    return x6Edge.id
  }

  function removeEdge(edgeId: string): void {
    _x6Graph?.removeEdge(edgeId)
  }

  function updateEdge(edgeId: string, data: Partial<KoruEdgeData>): void {
    const e = _x6Graph?.getCellById(edgeId) as Edge | undefined
    if (!e) return
    if (data.source)
      e.setSource({ cell: data.source, ...(data.sourcePort ? { port: data.sourcePort } : {}) })
    if (data.target)
      e.setTarget({ cell: data.target, ...(data.targetPort ? { port: data.targetPort } : {}) })
    if (data.label != null) {
      const text = String(data.label || '')
      if (text) {
        e.labels = [{ attrs: { text: { text } } }]
      } else {
        e.labels = []
      }
    }
    if (data.attrs) Object.entries(data.attrs).forEach(([sel, a]) => e.attr(sel, a))
    if (data.data) {
      e.replaceData({ ...e.getData(), ...data.data })
      // 同步持久化：replaceData 已触发 cell:change:*（L635 已监听），此处作为冗余安全保障
      eventBus.emit(KoruEvent.GRAPH_CHANGED, getGraphData())
    }
  }

  // ========== 选区 ==========

  function selectNode(nodeId: string): void {
    const g = _x6Graph
    if (!g) return
    g.cleanSelection()
    const c = g.getCellById(nodeId)
    if (c) g.select(c)
  }
  function selectAll(): void {
    _x6Graph?.select(_x6Graph.getNodes())
  }
  function clearSelection(): void {
    _x6Graph?.cleanSelection()
  }

  // ========== 数据读写 ==========

  function getGraphData(): KoruGraphData {
    if (!_x6Graph) return { nodes: [], edges: [] }
    try {
      const json = _x6Graph.toJSON()
      return fromX6JSON(json || { cells: [] })
    } catch {
      return { nodes: [], edges: [] }
    }
  }
  function setGraphData(data: KoruGraphData): void {
    const g = _x6Graph
    if (!g) return
    g.clearCells()
    if (data.nodes.length > 0 || data.edges.length > 0) {
      g.fromJSON(toX6JSON(data))   // patchedFromJSON 自动处理成员保护
      // 应用所有 cell 的动画配置
      g.getCells().forEach((cell: any) => {
        const cellData = cell.getData?.() || {}
        if (cellData.animation) {
          applyCellAnimation(cell, cellData.animation)
        }
      })
      // 恢复多状态元件的成员显隐（按 activeStateId 刷新可见性）
      g.getNodes().forEach((node: any) => {
        const nodeData = node.getData?.() || {}
        if (nodeData.isMultiState) {
          applyMultiStateVisibility(g, node)
        }
      })
    }
    g.centerContent()
  }

  /**
   * 统一数据灌入入口（Phase 1 新增）
   *
   * 外部调 API 拿到 X6 原生 JSON 后调用此方法，内部统一走：
   *   clearCells → patchedFromJSON → centerContent → 恢复动画 → 恢复多状态显隐
   *
   * 与 setGraphData 的区别：
   *   setGraphData 接收 KoruGraphData（{ nodes, edges } 业务格式）
   *   loadDiagram 接收 X6 原生 JSON（{ cells, canvas } —— 后端 fromJSON 的格式）
   *
   * @param data X6 原生 JSON 数据（通常来自后端 API 或本地 IndexedDB）
   */
  /**
   * 兼容三种输入格式的统一拆解：
   *   1) { cells, canvas }                  → X6 原生 fromJSON 格式
   *   2) { diagram_data: { cells, canvas }, binding_registry?, name? }  → 后端 API 包装格式
   *   3) { nodes, edges }                   → KoruGraphData 业务格式（降级走 setGraphData）
   */
  function _unwrapDiagramInput(raw: any): {
    cells: any[]
    canvas?: any
    format: 'x6' | 'api' | 'koru' | 'empty'
  } {
    if (!raw) return { cells: [], format: 'empty' }

    // 2) 后端 API 包装格式 { diagram_data: { cells, canvas }, ... }
    if (raw.diagram_data && typeof raw.diagram_data === 'object') {
      const dd = raw.diagram_data
      return {
        cells: dd.cells || [],
        canvas: dd.canvas,
        format: 'api',
      }
    }

    // 1) X6 原生格式
    if (Array.isArray(raw.cells)) {
      return { cells: raw.cells, canvas: raw.canvas, format: 'x6' }
    }

    // 3) KoruGraphData 业务格式
    if (Array.isArray(raw.nodes)) {
      const x6 = toX6JSON(raw as KoruGraphData)
      return { cells: x6.cells, format: 'koru' }
    }

    return { cells: [], format: 'empty' }
  }

  function loadDiagram(data: any): void {
    const g = _x6Graph
    if (!g) return
    g.clearCells()

    const { cells, canvas, format } = _unwrapDiagramInput(data)
    console.log(`[Koru][loadDiagram] format=${format}, cells=${cells.length}`)

    // 注册表预检 + shape 降级保护：
    // X6 fromJSON 遇到未注册的 shape 会抛 "shape should be specified" 导致整个加载失败
    // 这里把未注册的 shape 降级成基础形状（node→rect, edge→edge），保留位置/尺寸/data
    const FALLBACK_NODE_SHAPE = 'rect'
    const FALLBACK_EDGE_SHAPE = 'edge'
    const fallbackCells: any[] = []
    const missingShapeLog: Array<{ id: string; originalShape: string }> = []

    for (const c of cells) {
      if (!c || !c.shape) {
        // 完全缺 shape 的无效 cell → 丢弃
        console.warn(`[Koru][loadDiagram] 丢弃无 shape 的无效 cell:`, c)
        continue
      }

      const isEdge = c.shape === 'edge' || (c.source && c.target && !c.width && !c.height)
      const registry = isEdge ? Edge.registry : Node.registry
      const fallbackShape = isEdge ? FALLBACK_EDGE_SHAPE : FALLBACK_NODE_SHAPE

      if (registry.get(c.shape)) {
        // shape 已注册 → 正常保留
        fallbackCells.push(c)
      } else {
        // shape 未注册 → 降级为基础形状
        // 原始自定义 shape 的 attrs selector / labels / lineText 等跟 rect/edge 不兼容
        // 必须彻底清洗，避免渲染异常（[object Object] 等）
        const originalShape = c.shape
        if (isEdge) {
          // edge：原始自定义 edge 可能带 labels / lineText / label 等文字配置
          // 这些字段里可能嵌对象，X6 edge 默认 label 渲染时会把对象转成 [object Object]
          // 必须一并清除，只保留 edge 结构必需的字段
          const {
            attrs: _omitAttrs,
            labels: _omitLabels,
            label: _omitLabel,
            lineText: _omitLineText,
            data: _origData,
            ...rest
          } = c
          fallbackCells.push({
            ...rest,
            shape: fallbackShape,
            data: { __fallback_shape: originalShape },
          })
        } else {
          // node：降级成 rect，attrs 彻底替换为 rect 标准配置（无 text）
          // 同时清除 labels / lineText 等所有可能的文字来源
          const {
            attrs: _omitAttrs,
            labels: _omitLabels,
            label: _omitLabel,
            lineText: _omitLineText,
            data: _origData,
            ...restNoAttrs
          } = c
          fallbackCells.push({
            ...restNoAttrs,
            shape: fallbackShape,
            attrs: {
              body: {
                refWidth: '100%',
                refHeight: '100%',
                fill: '#EFF4FF',
                stroke: '#5F95FF',
                strokeWidth: 1,
                rx: 4,
                ry: 4,
              },
            },
            data: { __fallback_shape: originalShape },
          })
        }
        missingShapeLog.push({ id: c.id, originalShape })
      }
    }

    if (missingShapeLog.length > 0) {
      const uniqueShapes = [...new Set(missingShapeLog.map((m) => m.originalShape))]
      console.warn(
        `[Koru][loadDiagram] ⚠️ 有 ${missingShapeLog.length} 个 cell 的 shape 未注册，已降级为基础形状:`,
        uniqueShapes,
        `\n→ 请检查 koruBootstrap 的 SVG 符号是否正确注册`,
        missingShapeLog,
      )
    }

    // 用 container visibility 隐藏，避免 fromJSON → centerContent 两帧闪烁
    const container: HTMLElement | undefined = g.container
    if (fallbackCells.length || canvas) {
      if (container) container.style.visibility = 'hidden'
      const x6Input = { cells: fallbackCells, ...(canvas ? { canvas } : {}) }
      g.fromJSON(x6Input as any)  // patchedFromJSON 自动判断 parent-child 模式
      // 应用所有 cell 的动画配置
      g.getCells().forEach((cell: any) => {
        const cellData = cell.getData?.() || {}
        if (cellData.animation) {
          applyCellAnimation(cell, cellData.animation)
        }
      })
      // 恢复多状态元件的成员显隐（按 activeStateId 刷新可见性）
      g.getNodes().forEach((node: any) => {
        const nodeData = node.getData?.() || {}
        if (nodeData.isMultiState) {
          applyMultiStateVisibility(g, node)
        }
      })
      // 居中图纸（和 loadDiagram 对齐）
      // g.centerContent()
      if (container) container.style.visibility = ''
    } else {
      g.centerContent()
    }
  }
  function exportJSON(): string {
    return JSON.stringify(_x6Graph?.toJSON() || {}, null, 2)
  }

  /** 采集当前画布绑定注册表（供后端订阅 WS 推送） */
  function getBindingRegistry() {
    return collectBindingRegistry(_x6Graph)
  }

  // ========== 事件订阅 ==========

  function on(event: string, handler: (...args: any[]) => void): void {
    eventBus.on(event, handler)
  }
  function off(event: string, handler: (...args: any[]) => void): void {
    eventBus.off(event, handler)
  }

  // ========== 实例 ==========

  const instance: KoruGraphEditorInstance = {
    zoomIn,
    zoomOut,
    resetView,
    fitView,
    setZoom,
    undo,
    redo,
    removeSelectedCells,
    addNode,
    removeNode,
    updateNode,
    addEdge,
    removeEdge,
    updateEdge,
    getCell,
    updateCellProp,
    readCellProps,
    updateSelectedCellsProp,
    selectNode,
    selectAll,
    clearSelection,
    get selection() {
      return selectedIds.value
    },
    get canUndo() {
      return canUndo.value
    },
    get canRedo() {
      return canRedo.value
    },
    getGraphData,
    setGraphData,
    loadDiagram,
    exportJSON,
    getBindingRegistry,
    getGraph,
    getMode,
    setMode,
    isEditMode,
    isPreviewMode,
    on,
    off,
  }

  return {
    instance,
    containerRef,
    getGraph,
    eventBus,
    mode,
    zoomScale,
    selectedIds,
    canUndo,
    canRedo,
    config,
    init,
    destroy,
  }
}
