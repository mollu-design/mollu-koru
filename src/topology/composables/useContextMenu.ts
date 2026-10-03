/**
 * 画布右键菜单（Vue composable）。
 *
 * 集中管理画布右键菜单的展示与动作处理：
 * - showContextMenu: 命中检测/组合判定/菜单状态
 * - handleContextAction: 属性/层级/旋转翻转/组合多状态/锁定/删除/历史/剪贴板
 * - doAlign / doFlip: 对齐/等尺寸/翻转
 */
import type { Cell, Graph } from '@antv/x6'
import { Message } from '@arco-design/web-vue'
import { genStateId as _genStateId, getMultiStateChildren } from './useMultiState'

/** 右键菜单状态（与 KoruContextMenu.vue 的 ContextMenuState 一致） */
export interface ContextMenuStateData {
  visible: boolean
  x: number
  y: number
  /** 右键落在图元上（有选中）还是空白处 */
  onNode: boolean
  /** 是否多选 */
  multi: boolean
  /** 是否锁定的图元 */
  locked: boolean
  /** 触发右键的图元 id（若无则为空） */
  cellId: string
  /** 选中的图元是否属于某个组合（有父节点） */
  grouped: boolean
  /** 命中/选中的是否是多状态元件父节点 */
  isMultiState: boolean
  /** 命中/选中的是否为多状态元件成员 */
  isMultiStateMember: boolean
  /** 是否允许"组合为多状态"（选中 ≥2 节点且不含多状态父节点） */
  canMultiState: boolean
  /** 剪贴板是否有内容（无内容时禁用"粘贴"） */
  canPaste: boolean
}

export interface ContextMenuDeps {
  /** 获取当前画布实例 */
  getGraph: () => Graph | null
  /** 画布容器 DOM（用于清理 Transform 手柄残留） */
  getContainer?: () => HTMLElement | null
  /** 右键菜单状态（ref） */
  ctxMenu: { value: ContextMenuStateData }
  /** 读取当前选中图元 */
  getSelectedCell: () => Cell | null
  /** 更新选中图元 */
  setSelectedCell: (cell: Cell | null) => void
  /** 更新属性面板内容 */
  updateCellProps: (cell: Cell) => void
  /** 切换属性面板激活 tab */
  setPropActiveTab: (tab: string) => void
  /** 获取 KoruGraphEditorInstance */
  getInstance: () => any
}

/** 默认菜单状态 */
export function createDefaultContextMenuState(): ContextMenuStateData {
  return {
    visible: false,
    x: 0,
    y: 0,
    onNode: false,
    multi: false,
    locked: false,
    cellId: '',
    grouped: false,
    isMultiState: false,
    isMultiStateMember: false,
    canMultiState: false,
    canPaste: false,
  }
}

/** 画布右键菜单 */
export function useContextMenu(deps: ContextMenuDeps) {
  const { getGraph, ctxMenu, getContainer } = deps

  /** 显示右键菜单：根据点击位置与选中状态填充菜单状态 */
  function showContextMenu(e: MouseEvent): void {
    const graph = getGraph()
    if (!graph || !e) return

    // 命中检测：优先取右键位置命中的图元
    let hitCell: Cell | null = null
    try {
      const local = graph.clientToLocal({ x: e.clientX, y: e.clientY })
      hitCell = (graph as any).getCellAt?.(local.x, local.y) ?? null
    } catch {
      hitCell = null
    }

    // 选中的图元集合
    const selected = graph.getSelectedCells()
    const selectedIds = new Set(selected.map((c) => c.id))
    let targetId = hitCell?.id ?? ''

    // 若右键处无图元，但已有选中，则针对选中集操作
    if (!targetId && selected.length > 0) {
      targetId = selected[0].id
    }

    // 锁定判断
    const lockCell = hitCell || (selected.length ? selected[0] : null)
    const locked = lockCell ? !!lockCell.getData?.()?.locked : false

    // 是否属于组合（容器 = isGroup/isMultiState，成员 = 有 parent）
    const inGroup = (c: any) =>
      !!c?.getData?.()?.isGroup || !!c?.getData?.()?.isMultiState || !!c?.getParent?.()
    const grouped = (hitCell && inGroup(hitCell)) || selected.some(inGroup)

    // 多状态元件判断
    const hitIsMultiState = !!hitCell?.getData?.()?.isMultiState
    const isMultiStateTarget =
      (hitCell && hitCell.getData?.()?.isMultiState) ||
      selected.some((c: any) => c.getData?.()?.isMultiState)

    // 组合为多状态：选中 ≥2 节点，且不含已有多状态父节点
    const nodeSel = selected.filter((c: any) => c.isNode?.())
    const canMultiState =
      nodeSel.length >= 2 && !nodeSel.some((c: any) => c.getData?.()?.isMultiState)

    ctxMenu.value = {
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
      canPaste: graph.isClipboardEmpty ? !graph.isClipboardEmpty() : false,
    }
  }

  /** 隐藏菜单 */
  function hideContextMenu(): void {
    ctxMenu.value = { ...ctxMenu.value, visible: false }
  }

  /** 确保目标图元被选中，使属性面板能渲染并切换对应 tab */
  function selectForPanel(cells: Cell[]): void {
    if (!cells || cells.length === 0) return
    const cell = cells[0]
    const cur = deps.getSelectedCell()
    if (!cur || cur.id !== cell.id) {
      deps.setSelectedCell(cell)
      deps.updateCellProps(cell)
    }
  }

  /** 对齐：以选中集为整体计算目标值，应用到每个图元 */
  function doAlign(action: string, cells: Cell[]): void {
    if (cells.length < 2) return
    const nodes = cells.filter((c) => c.isNode())
    const boxes = nodes.map((c: any) => (c.getBBox ? c.getBBox() : null))
    if (boxes.some((b) => !b)) return
    const left = Math.min(...boxes.map((b: any) => b.x))
    const right = Math.max(...boxes.map((b: any) => b.x + b.width))
    const top = Math.min(...boxes.map((b: any) => b.y))
    const bottom = Math.max(...boxes.map((b: any) => b.y + b.height))
    const centerX = (left + right) / 2
    const centerY = (top + bottom) / 2
    const maxW = Math.max(...boxes.map((b: any) => b.width))
    const maxH = Math.max(...boxes.map((b: any) => b.height))
    nodes.forEach((n: any, i: number) => {
      const b = boxes[i]
      if (!b) return
      const pos = n.position()
      let nx = pos.x
      let ny = pos.y
      switch (action) {
        case 'alignLeft':
          nx = left
          break
        case 'alignRight':
          nx = right - b.width
          break
        case 'alignTop':
          ny = top
          break
        case 'alignBottom':
          ny = bottom - b.height
          break
        case 'alignCenterH':
          nx = centerX - b.width / 2
          break
        case 'alignCenterV':
          ny = centerY - b.height / 2
          break
        case 'sameWidth':
          n.resize(maxW, b.height)
          break
        case 'sameHeight':
          n.resize(b.width, maxH)
          break
      }
      n.position(nx, ny)
    })
  }

  /** 对齐入口 */
  function handleAlign(action: string): void {
    const graph = getGraph()
    if (!graph) return
    const selected = graph.getSelectedCells()
    doAlign(action, selected)
  }

  /** 翻转：通过 scale 镜像 */
  function doFlip(action: string, cells: Cell[]): void {
    cells
      .filter((c) => c.isNode())
      .forEach((n: any) => {
        const b = n.getBBox?.()
        if (!b) return
        const ox = b.x + b.width / 2
        const oy = b.y + b.height / 2
        if (action === 'flipH') {
          const cur = n.getScale?.() || { sx: 1, sy: 1 }
          n.scale(-(cur.sx || 1), cur.sy || 1, ox, oy)
        } else {
          const cur = n.getScale?.() || { sx: 1, sy: 1 }
          n.scale(cur.sx || 1, -(cur.sy || 1), ox, oy)
        }
      })
  }

  /** 收集节点所有可交互的 selector（从 markup 动态获取 + 兜底常用） */
  function allSelectors(cell: any): string[] {
    const sels: string[] = []
    try {
      const markup = cell?.markup || []
      if (Array.isArray(markup)) {
        markup.forEach((m: any) => {
          if (m && m.selector) sels.push(m.selector)
        })
      }
    } catch {
      /* ignore */
    }
    // 兜底常用 selector
    const shape: string = cell?.shape || ''
    const mainSel = shape.startsWith('svg-node-')
      ? 'svg-body'
      : shape === 'shape-line'
        ? 'line'
        : 'body'
    const base = [mainSel, 'text', 'label']
    if (shape.startsWith('svg-node-')) base.push('svg-root', 'svg')
    base.forEach((s) => {
      if (s && !sels.includes(s)) sels.push(s)
    })
    return sels
  }

  /** 禁用组合成员交互：设置 magnet=false（防止被单独拖拽连线）+ selectable=false（防止被单独选中）。
   *  不设 pointer-events=none —— X6 parent-child 整体拖动依赖事件穿透到父容器，
   *  如果子节点完全不响应 pointer 事件，translate 不会传播，整体拖不动。 */
  function disableMemberInteraction(cell: any): boolean {
    const graph = getGraph()
    const view = graph?.findViewByCell?.(cell)
    const el = view?.container as HTMLElement | undefined
    if (el) {
      // 恢复 pointer-events 让事件穿透到父容器（整体拖动必需）
      try {
        el.setAttribute('pointer-events', 'auto')
        el.querySelectorAll?.('*').forEach((sub: Element) => {
          sub.setAttribute('pointer-events', 'auto')
        })
      } catch {
        /* ignore */
      }
    }
    try {
      cell.selectable = false  // 防止被单独选中（但事件仍可穿透到父容器）
      cell.magnet = false      // 防止被单独拖拽连线
    } catch {
      /* ignore */
    }
    return true
  }

  /** 设置成员的 attrs 级 magnet（必须在 batchUpdate 内调用）
   *  注意：不设置 pointer-events，改由 DOM 级操作处理，
   *  避免 X6 History undo 时恢复不一致的 attrs 导致 toJSON 崩溃 */
  function setMemberAttrs(cell: any): void {
    const sels = allSelectors(cell)
    sels.forEach((sel) => {
      try {
        cell.attr(`${sel}/magnet`, false)
      } catch {
        /* ignore */
      }
    })
  }

  /** 启用组合成员交互：恢复 magnet/pointer-events，并清理 view 强制不可点选
   *  返回 true 表示 DOM 级操作已应用，false 表示 view 尚未渲染 */
  function enableMemberInteraction(cell: any): boolean {
    const graph = getGraph()
    const view = graph?.findViewByCell?.(cell)
    const el = view?.container as HTMLElement | undefined
    if (!el) return false

    // 恢复 view 下所有后代的 pointer-events（DOM 级）
    try {
      el.removeAttribute('pointer-events')
      el.style?.removeProperty?.('pointer-events')
      el.querySelectorAll?.('*').forEach((sub: Element) => {
        sub.removeAttribute('pointer-events')
        ;(sub as HTMLElement).style?.removeProperty?.('pointer-events')
      })
      // 触发重绘，确保 X6 按当前 attr 重新渲染
      ;(view as any)?.update?.()
    } catch {
      /* ignore */
    }
    try {
      cell.selectable = true
      cell.magnet = true
    } catch {
      /* ignore */
    }
    return true
  }

  /** 恢复成员的 attrs 级 magnet（必须在 batchUpdate 内调用） */
  function restoreMemberAttrs(cell: any): void {
    const sels = allSelectors(cell)
    sels.forEach((sel) => {
      try {
        cell.attr(`${sel}/magnet`, null)
      } catch {
        /* ignore */
      }
    })
  }

  /** 移除指定 cells 的 Transform 手柄：清除 CSS class 标记 + 仅移除这些 cells 的残留手柄 */
  function removeTransformWidgets(cells: any[]): void {
    const graph = getGraph()
    if (!graph) return
    // 1) 移除指定 cells 的 has-widget-transform / x6-node-selected 标记
    cells.forEach((c: any) => {
      const view = graph.findViewByCell?.(c)
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
    })
    // 2) 仅移除这些 cells 对应的 .x6-widget-transform 元素
    //    不再做全局清理，避免误删其他节点（如组合容器）的 transform 手柄
    const cellIds = new Set(cells.map((c: any) => c.id))
    const graphContainer = graph.container as HTMLElement | undefined
    const container = graphContainer || getContainer?.()
    if (container) {
      container.querySelectorAll?.('.x6-widget-transform').forEach((el: Element) => {
        const cellId = el.getAttribute?.('data-cell-id')
        if (cellId && cellIds.has(cellId)) {
          el.remove()
        }
      })
    }
  }

  /** 带重试的 DOM 级操作：对一组 cells 执行操作，若有 cell view 未就绪则重试 */
  function withRenderRetry(
    cells: any[],
    action: (cell: any) => boolean,
    onAllReady: () => void,
    maxAttempts = 10,
  ): void {
    let attempts = 0
    const tryOnce = () => {
      attempts++
      let allDone = true
      cells.forEach((c) => {
        const ok = action(c)
        if (!ok) allDone = false
      })
      if (allDone) {
        onAllReady()
        return
      }
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryOnce)
      } else {
        // 超时后仍然执行 onAllReady（可能部分成功）
        onAllReady()
      }
    }
    requestAnimationFrame(tryOnce)
  }

  /** 获取组合默认名称 */
  function getGroupDefaultName(isMultiState: boolean): string {
    return isMultiState ? '多状态元件' : '组合'
  }

  /** 生成状态 ID（使用 useMultiState 中的统一实现） */
  const genStateId: () => string = _genStateId

  /** 扩展组合成员（剪切/复制/删除时将整个组合作为一个整体）
   * X6 原生 parent-child：parent 找根容器，容器找全部 descendants
   */
  function expandGroupCells(cells: any[]): any[] {
    const graph = getGraph()
    if (!graph) return cells
    const result = new Set<string>()
    cells.forEach((c: any) => {
      if (!c?.id) return
      // 成员节点：向上找根容器 → 把整个 descendants 都加进来
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

  /** 粘贴后修复 parent-child：X6 clipboard 粘贴会生成新 id，但 parent 引用可能指向旧 id
   *  遍历粘贴出的容器，把它的 children 重新 setParent 到它身上
   */
  function repairClipboardParentChild(pastedCells: any[]): void {
    const graph = getGraph()
    if (!graph) return
    // 收集粘贴出的新容器（isGroup / isMultiState）
    const containers = pastedCells.filter(
      (c: any) => c?.getData?.()?.isGroup || c?.getData?.()?.isMultiState,
    )
    if (containers.length === 0) return
    // 建立旧 id → 新 cell 的映射（从 paste 输出的 cells 里）
    // 但 X6 paste 已经改了 id，我们靠 parent 字段在粘贴出的 cells 里找关系
    // 简单策略：遍历每个新容器，找粘贴出的 cells 里哪些 child.getParent() 是旧容器（大概率）
    // 更保险：遍历粘贴出的所有 cells，对有 parent 字段的，检查 parent cell 是否在粘贴结果里
    pastedCells.forEach((c: any) => {
      if (!c.isNode?.()) return
      const parent = c.getParent?.()
      if (!parent) return
      // 如果 parent 不在粘贴结果里（旧容器），找一个新容器挂上去
      if (!pastedCells.includes(parent)) {
        // 最简单粗暴：直接 detach，然后挂到第一个粘贴出来的容器
        // 更精确的做法：用 setParent 后 X6 会自动改 parent 引用
        c.detach?.()
        // 找粘贴出的哪个容器最适合（这里简单选第一个）
        if (containers[0]) {
          const absPos = c.position()
          c.setParent(containers[0], { relative: false })
          containers[0].unfreeze?.()
          c.position(absPos) // 保持绝对位置不变，X6 会自动转相对
        }
      } else {
        // parent 在粘贴结果里 → 修复 bounds
        parent.unfreeze?.()
      }
    })
  }

  /** 处理菜单项动作 */
  function handleContextAction(action: string): void {
    const graph = getGraph()
    if (!graph) return
    const instance = deps.getInstance()

    // 目标图元：优先右键命中的图元；否则用当前选中集
    const ctxId = ctxMenu.value.cellId
    const ctxCell = ctxId ? graph.getCellById(ctxId) : null
    let selected = graph.getSelectedCells()
    if (ctxCell) {
      selected = [ctxCell, ...selected.filter((c) => c.id !== ctxCell.id)]
    } else if (selected.length === 0 && ctxId) {
      const cell = graph.getCellById(ctxId)
      if (cell) selected = [cell]
    }

    switch (action) {
      // ---- 业务入口 ----
      case 'openProperty':
        selectForPanel(selected)
        deps.setPropActiveTab('basic')
        break
      case 'editAnim':
        selectForPanel(selected)
        deps.setPropActiveTab('anim')
        break
      case 'editTrigger':
        selectForPanel(selected)
        deps.setPropActiveTab('event')
        break
      case 'editBinding':
        selectForPanel(selected)
        deps.setPropActiveTab('binding')
        break

      // ---- 图层层级 ----
      case 'toFront':
        selected.forEach((c: any) => c.toFront?.())
        break
      case 'toBack':
        selected.forEach((c: any) => c.toBack?.())
        break
      case 'upLayer': {
        const zs = graph
          .getCells()
          .filter((c: any) => c.isNode?.())
          .sort((a: any, b: any) => (a.getZIndex?.() || 0) - (b.getZIndex?.() || 0))
        const targetIds = new Set(selected.map((c: any) => c.id))
        for (let i = zs.length - 1; i >= 0; i--) {
          if (targetIds.has(zs[i].id) && i < zs.length - 1) {
            const cur = (zs[i] as any).getZIndex?.()
            const next = (zs[i + 1] as any).getZIndex?.()
            ;(zs[i] as any).setZIndex?.(next)
            ;(zs[i + 1] as any).setZIndex?.(cur)
            break
          }
        }
        break
      }
      case 'downLayer': {
        const zs = graph
          .getCells()
          .filter((c: any) => c.isNode?.())
          .sort((a: any, b: any) => (a.getZIndex?.() || 0) - (b.getZIndex?.() || 0))
        const targetIds = new Set(selected.map((c: any) => c.id))
        for (let i = 0; i < zs.length; i++) {
          if (targetIds.has(zs[i].id) && i > 0) {
            const cur = (zs[i] as any).getZIndex?.()
            const prev = (zs[i - 1] as any).getZIndex?.()
            ;(zs[i] as any).setZIndex?.(prev)
            ;(zs[i - 1] as any).setZIndex?.(cur)
            break
          }
        }
        break
      }

      // ---- 旋转 / 翻转 ----
      case 'rotateCW':
        selected.forEach((c: any) => c.rotate?.(90, { absolute: true }))
        break
      case 'flipH':
      case 'flipV':
        doFlip(action, selected)
        break

      // ---- 组合 ----
      case 'combine': {
        const nodes = selected.filter((c: any) => c.isNode())
        if (nodes.length < 2) {
          Message.warning('请至少选择 2 个图元进行组合')
          break
        }
        try {
          const boxes = nodes.map((n: any) => {
            const bbox = n.getBBox?.()
            if (bbox) return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
            const pos = n.position()
            const size = n.size ? n.size() : { width: 0, height: 0 }
            return { x: pos.x, y: pos.y, width: size.width, height: size.height }
          })
          const left = Math.min(...boxes.map((b: any) => b.x))
          const top = Math.min(...boxes.map((b: any) => b.y))
          const right = Math.max(...boxes.map((b: any) => b.x + b.width))
          const bottom = Math.max(...boxes.map((b: any) => b.y + b.height))
          const containerW = Math.max(1, right - left + 20)
          const containerH = Math.max(1, bottom - top + 20)

          // 使用 startBatch/stopBatch 将所有操作包裹为单个 history 命令
          graph.startBatch?.('combine')
          graph.cleanSelection?.()
          const container = graph.addNode({
            x: left - 10,
            y: top - 10,
            width: containerW,
            height: containerH,
            shape: 'rect',
            selectable: true,
            attrs: {
              body: {
                fill: 'transparent',
                stroke: 'none',
                cursor: 'pointer',
              },
            },
            data: {
              isGroup: true,
              name: getGroupDefaultName(false),
            },
          })
          // X6 原生 parent-child：显式 addChild（官方推荐方式，内部会调 child.setParent）
          nodes.forEach((n: any) => {
            const childPos = n.position() // 记录绝对位置
            container.addChild(n)          // 建立双向关联（addChild 内部自动调 setParent）
            n.position(childPos)          // 恢复绝对位置（addChild 默认转相对，我们用绝对）
            ;(container as any)?.unfreeze?.() // 解除 bounds 限制
            setMemberAttrs(n)
            // 同步写入 data.parent —— getMultiStateChildren / toJSON 链路依赖此字段
            const curData = n.getData?.() || {}
            n.setData?.({ ...curData, parent: container.id })
          })
          graph.stopBatch?.('combine')

          // 诊断：验证 parent-child 双向关联是否正确建立
          const verifyOk = nodes.every((n: any) => {
            const p = n.getParent?.()
            const children = container.getChildren?.() || []
            return p?.id === container.id && children.includes(n)
          })
          if (!verifyOk) {
            console.warn('[combine] parent-child 关联异常！', {
              parentId: container.id,
              parentChildren: container.getChildren?.()?.map((c: any) => c.id),
              childParents: nodes.map((n: any) => n.getParent?.()?.id),
            })
          }

          // 确保容器节点 selectable 属性为 true
          try {
            ;(container as any).selectable = true
          } catch {
            /* ignore */
          }

          // DOM 级操作（在 stopBatch 后，仅处理旧节点的残留手柄）
          // 使用 withRenderRetry 确保 view 就绪后再操作，同时在回调中创建新容器的 transform 手柄
          withRenderRetry(
            nodes,
            (n) => disableMemberInteraction(n),
            () => {
              // 仅移除旧节点的 transform 残留手柄
              removeTransformWidgets(nodes)
              // 确保新容器在 DOM 级也是可交互的 + 创建 transform 手柄
              const view = graph.findViewByCell?.(container)
              const el = view?.container as HTMLElement | undefined
              if (el) {
                el.setAttribute('pointer-events', 'auto')
                el.style.cursor = 'pointer'
              }
              // Transform 插件只监听 node:click 事件，不响应程序化选中
              // 需要显式调用 createWidget 为新容器创建 transform 手柄
              const transformPlugin = graph.getPlugin?.('transform') as any
              if (transformPlugin && typeof transformPlugin.createWidget === 'function') {
                transformPlugin.createWidget(container)
              }
            },
          )

          // 在 batch 外选中容器（通过 Selection 插件直接 API，避免 batch 冲突）
          const selection = graph.getPlugin?.('selection') as any
          if (selection) {
            selection.clearSelection?.()
            selection.select?.(container)
          } else {
            graph.cleanSelection?.()
            graph.select?.(container)
          }
        } catch (e: any) {
          try {
            graph.stopBatch?.('combine')
          } catch {
            /* ignore */
          }
          Message.warning('组合失败：' + (e?.message || String(e)))
        }
        break
      }

      // ---- 多状态组合 ----
      case 'combineState': {
        const nodes = selected.filter((c: any) => c.isNode())
        if (nodes.length < 2) {
          Message.warning('请至少选择 2 个图元进行组合')
          break
        }
        if (nodes.some((n: any) => n.getData?.()?.isMultiState)) {
          Message.warning('不支持嵌套多状态元件')
          break
        }
        const stateId = genStateId()
        try {
          // 使用 getBBox 获取绝对坐标
          const boxes = nodes.map((n: any) => {
            const bbox = n.getBBox?.()
            if (bbox) return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
            const pos = n.position()
            const size = n.size ? n.size() : { width: 0, height: 0 }
            return { x: pos.x, y: pos.y, width: size.width, height: size.height }
          })
          const left = Math.min(...boxes.map((b: any) => b.x))
          const top = Math.min(...boxes.map((b: any) => b.y))
          const right = Math.max(...boxes.map((b: any) => b.x + b.width))
          const bottom = Math.max(...boxes.map((b: any) => b.y + b.height))
          const containerW = Math.max(1, right - left + 20)
          const containerH = Math.max(1, bottom - top + 20)

          graph.startBatch?.('combineState')
          graph.cleanSelection?.()
          const container = graph.addNode({
            x: left - 10,
            y: top - 10,
            width: containerW,
            height: containerH,
            shape: 'rect',
            selectable: true,
            attrs: {
              body: {
                fill: 'transparent',
                stroke: 'none',
                cursor: 'pointer',
              },
            },
            data: {
              isMultiState: true,
              name: getGroupDefaultName(true),
              activeStateId: stateId,
              stateList: [
                {
                  stateId,
                  stateName: '状态1',
                  cellIds: nodes.map((n: any) => n.id),
                },
              ],
            },
            zIndex: -1,
          })
          // X6 原生 parent-child：显式 addChild（官方推荐方式）
          nodes.forEach((n: any) => {
            const childPos = n.position()
            container.addChild(n)
            n.position(childPos)
            ;(container as any)?.unfreeze?.()
            setMemberAttrs(n)
            const curData = n.getData?.() || {}
            n.setData?.({ ...curData, parent: container.id })
          })
          graph.stopBatch?.('combineState')

          // 诊断：验证 parent-child 双向关联
          const verifyOk2 = nodes.every((n: any) => {
            const p = n.getParent?.()
            const children = container.getChildren?.() || []
            return p?.id === container.id && children.includes(n)
          })
          if (!verifyOk2) {
            console.warn('[combineState] parent-child 关联异常！', {
              parentId: container.id,
              parentChildren: container.getChildren?.()?.map((c: any) => c.id),
              childParents: nodes.map((n: any) => n.getParent?.()?.id),
            })
          }

          // 确保容器节点 selectable 属性为 true
          try {
            ;(container as any).selectable = true
          } catch {
            /* ignore */
          }

          // DOM 级操作（在 stopBatch 后，仅处理旧节点的残留手柄）
          // 使用 withRenderRetry 确保 view 就绪后再操作，同时在回调中创建新容器的 transform 手柄
          withRenderRetry(
            nodes,
            (n) => disableMemberInteraction(n),
            () => {
              // 仅移除旧节点的 transform 残留手柄
              removeTransformWidgets(nodes)
              // 确保新容器在 DOM 级也是可交互的 + 创建 transform 手柄
              const view = graph.findViewByCell?.(container)
              const el = view?.container as HTMLElement | undefined
              if (el) {
                el.setAttribute('pointer-events', 'auto')
                el.style.cursor = 'pointer'
              }
              // Transform 插件只监听 node:click 事件，不响应程序化选中
              // 需要显式调用 createWidget 为新容器创建 transform 手柄
              const transformPlugin = graph.getPlugin?.('transform') as any
              if (transformPlugin && typeof transformPlugin.createWidget === 'function') {
                transformPlugin.createWidget(container)
              }
            },
          )

          // 在 batch 外选中容器（通过 Selection 插件直接 API，避免 batch 冲突）
          const selection = graph.getPlugin?.('selection') as any
          if (selection) {
            selection.clearSelection?.()
            selection.select?.(container)
          } else {
            graph.cleanSelection?.()
            graph.select?.(container)
          }
          Message.success('已组合为多状态元件')
        } catch (e: any) {
          try {
            graph.stopBatch?.('combineState')
          } catch {
            /* ignore */
          }
          Message.warning('组合失败：' + (e?.message || String(e)))
        }
        break
      }

      // ---- 取消多状态组合 ----
      case 'uncombineMultiState': {
        const target = selected.find((c: any) => c.isNode?.() && c.getData?.()?.isMultiState)
        if (!target) break
        try {
          // 用 getMultiStateChildren 统一查（内部已兜底 data.parent + getParent）
          const membersToRestore = getMultiStateChildren(graph, target)
          graph.startBatch?.('uncombineMultiState')
          membersToRestore.forEach((ch: any) => {
            ch.detach?.() // 解父子，相对坐标自动转回绝对
            // 清除 data.parent（detach 不会自动清）
            const curData = ch.getData?.() || {}
            const { parent: _omit, ...rest } = curData
            ch.setData?.(rest)
            restoreMemberAttrs(ch)
            try {
              ch.selectable = true
            } catch {
              /* ignore */
            }
            ch.setVisible?.(true)
          })
          graph.removeCell?.(target)
          graph.cleanSelection?.()
          graph.stopBatch?.('uncombineMultiState')

          withRenderRetry(
            membersToRestore,
            (ch) => enableMemberInteraction(ch),
            () => {
              /* 所有成员已恢复交互 */
            },
          )
          Message.success('已取消多状态组合')
        } catch (e: any) {
          try {
            graph.stopBatch?.('uncombineMultiState')
          } catch {
            /* ignore */
          }
          Message.warning('取消多状态组合失败：' + (e?.message || String(e)))
        }
        break
      }

      // ---- 取消组合 ----
      case 'uncombine': {
        if (!selected.length) break
        try {
          // 用 getMultiStateChildren 统一查（兜底 data.parent + getParent）
          const containers = selected.filter(
            (c: any) =>
              c.isNode?.() &&
              (c.getData?.()?.isGroup || c.getData?.()?.isMultiState) &&
              getMultiStateChildren(graph, c).length > 0,
          )
          const restoreTargets: any[] = []
          containers.forEach((container: any) => {
            const members = getMultiStateChildren(graph, container)
            restoreTargets.push(...members)
          })

          graph.startBatch?.('uncombine')
          containers.forEach((container: any) => {
            const members = getMultiStateChildren(graph, container)
            members.forEach((ch: any) => {
              ch.detach?.() // 解父子，相对坐标自动转回绝对
              // 清除 data.parent（detach 不会自动清）
              const curData = ch.getData?.() || {}
              const { parent: _omit, ...rest } = curData
              ch.setData?.(rest)
              restoreMemberAttrs(ch)
              try {
                ch.selectable = true
              } catch {
                /* ignore */
              }
            })
            graph.removeCell?.(container)
          })
          graph.cleanSelection?.()
          graph.stopBatch?.('uncombine')

          withRenderRetry(
            restoreTargets,
            (ch) => enableMemberInteraction(ch),
            () => {
              /* 所有成员已恢复交互 */
            },
          )
          Message.success('已解除组合')
        } catch (e: any) {
          try {
            graph.stopBatch?.('uncombine')
          } catch {
            /* ignore */
          }
          Message.warning('解除组合失败：' + (e?.message || String(e)))
        }
        break
      }

      // ---- 锁定 / 解锁 ----
      case 'lock': {
        const c = selected[0]
        if (c) {
          const data = (c as any).getData?.() || {}
          ;(c as any).setData?.({ ...data, locked: true })
          ;(c as any).disable?.(true)
          Message.success('已锁定图元')
        }
        break
      }
      case 'unlock': {
        const c = selected[0]
        if (c) {
          const data = (c as any).getData?.() || {}
          ;(c as any).setData?.({ ...data, locked: false })
          ;(c as any).enable?.()
          Message.success('已解锁图元')
        }
        break
      }

      // ---- 删除 ----
      case 'delete': {
        const cells = expandGroupCells(selected)
        if (cells.length > 0) {
          graph.removeCells?.(cells)
          try {
            graph.cleanSelection?.()
          } catch {
            /* ignore */
          }
        }
        break
      }

      // ---- 历史 ----
      case 'undo':
        if (instance?.undo) {
          instance.undo()
        }
        break
      case 'redo':
        if (instance?.redo) {
          instance.redo()
        }
        break

      // ---- 剪贴板 ----
      case 'cut': {
        const cells = expandGroupCells(selected)
        graph.cut?.(cells)
        break
      }
      case 'copy': {
        const cells = expandGroupCells(selected)
        graph.copy?.(cells)
        break
      }
      case 'paste': {
        const cells: any[] =
          graph.batchUpdate(() => {
            const cs: any[] = graph.paste?.({ offset: 24 }) || []
            // X6 原生 parent-child：粘贴后自动重连
            repairClipboardParentChild(cs)
            cs.forEach((c: any) => {
              if (c.isNode?.() && c.getParent?.()) {
                setMemberAttrs(c)
              }
            })
            return cs
          }) || []
        graph.cleanSelection?.()
        if (cells.length > 0) {
          graph.select?.(cells)
          // 粘贴后对成员应用 DOM 级保护（view 渲染后）
          const members = cells.filter((c: any) => c.isNode?.() && c.getParent?.())
          if (members.length > 0) {
            withRenderRetry(
              members,
              (c) => disableMemberInteraction(c),
              () => {
                const container = cells.find(
                  (c: any) =>
                    c.isNode?.() && (c.getData?.()?.isGroup || c.getData?.()?.isMultiState),
                )
                if (container) {
                  graph.cleanSelection?.()
                  graph.select?.(container)
                  // 为粘贴后的容器创建 transform 手柄
                  const transformPlugin = graph.getPlugin?.('transform') as any
                  if (transformPlugin && typeof transformPlugin.createWidget === 'function') {
                    transformPlugin.createWidget(container)
                  }
                }
              },
            )
          }
        }
        break
      }

      default:
        break
    }

    // 隐藏菜单
    hideContextMenu()
  }

  return {
    showContextMenu,
    hideContextMenu,
    handleContextAction,
    handleAlign,
    doAlign,
    doFlip,
  }
}
