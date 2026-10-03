# 工具栏、右键菜单与历史操作

> **源码位置**：`src/topology/composables/useContextMenu.ts`、`src/topology/composables/useClipboard.ts`、`src/topology/composables/useUndoRedo.ts`、`src/topology/components/KoruContextMenu.vue`

---

## 右键菜单

### 触发方式

画布上**选中图元后点右键** → `useContextMenu` 拦截 contextmenu 事件 → 计算菜单项 → 弹出 KoruContextMenu。

### 菜单项列表（源码 `useContextMenu.ts:L474-L539`）

根据选中状态动态组合：

#### 多选（含 2 个以上节点）

| # | 项 | handler | 说明 |
|---|-----|---------|------|
| 1 | 到顶层 | `toFront()` | `node.toFront()` |
| 2 | 到底层 | `toBack()` | `node.toBack()` |
| 3 | 上移一层 | `upLayer()` | `node.setZIndex(node.getZIndex() + 1)` |
| 4 | 下移一层 | `downLayer()` | `node.setZIndex(node.getZIndex() - 1)` |
| 5 | ─ ─ 分隔线 ─ ─ | | |
| 6 | 组合 | `group()` | Selection 选中的节点 → 创建一个父容器（X6 group 插件） |
| 7 | 取消组合 | `ungroup()` | 把父容器下的子节点释放出来，删除父容器 |
| 8 | ─ ─ 分隔线 ─ ─ | | |
| 9 | 复制 | `copy()` | Clipboard |
| 10 | 删除 | `remove()` | 删除所有选中 |

#### 单选节点时**额外**出现

| # | 项 | handler | 说明 |
|---|-----|---------|------|
| 11 | 属性 | `openProperty()` | 聚焦右侧属性面板，滚动到对应节点 |
| 12 | 动效 | `editAnim()` | 打开 KoruAnimationPanel |
| 13 | 绑定 | `editBinding()` | 打开 KoruBindingPanel |
| 14 | 触发器 | `editTrigger()` | 打开 KoruTriggerEditorModal |

#### 只选中连线时

| # | 项 | handler |
|---|-----|---------|
| 1 | 编辑边 | `openProperty()` |
| 2 | 删除 | `remove()` |

#### 点画布空白处

| # | 项 | handler |
|---|-----|---------|
| 1 | 粘贴 | `paste()` |
| 2 | 全选 | `selectAll()` |

### 禁用状态

| 项 | 什么时候禁用 |
|---|------------|
| 组合 | 选中只有 1 个时 |
| 取消组合 | 没有选中 group 节点时 |
| 粘贴 | 剪贴板为空时 |
| 全选 | 画布没图元时 |

### 自定义菜单项

`canvasStore.contextMenuExtraItems` 可以注入额外项：

```ts
setComponentConfig({
  contextMenuExtraItems: [
    {
      label: '自定义动作',
      icon: 'StarOutlined',
      handler: (selectedCells) => {
        console.log('选中:', selectedCells)
      },
      disabled: (selectedCells) => selectedCells.length !== 1,
    },
  ],
})
```

---

## 剪贴板

### useClipboard.ts 实现（L7-L50）

| 操作 | X6 方法 | 额外处理 |
|------|---------|----------|
| `copy()` | `graph.copy(selectedCells)` | — |
| `cut()` | `copy()` → `remove(selectedCells)` | — |
| `paste()` | `graph.paste()` | **自动 +20px 偏移**避免重叠 + 给节点加 `_copy` 后缀 |

### +20px 偏移策略

```ts
// useClipboard.ts 内部
graph.paste()
const pasted = graph.getCells().filter(c => c.getData('_copy'))
pasted.forEach(cell => {
  cell.translate(20, 20)  // 右下偏移 20px
  cell.removeData('_copy')
  // 重新生成 id（避免冲突）
  cell.setId(uid('node'))
})
```

### Ctrl+A 全选跳过输入框

```ts
// useKoruGraphEditor.ts:L415-L484
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'a') {
    // 如果焦点在 <input> / <textarea> / [contenteditable="true"] 内 → 跳过
    const target = e.target as HTMLElement
    if (['INPUT', 'TEXTAREA'].includes(target.tagName) ||
        target.isContentEditable) {
      return  // 保留浏览器原生 Ctrl+A（选中输入框文字）
    }
    e.preventDefault()
    graph.selectAll()
  }
})
```

### Delete / Backspace 同理

```ts
if (e.key === 'Delete' || e.key === 'Backspace') {
  const target = e.target as HTMLElement
  if (['INPUT', 'TEXTAREA'].includes(target.tagName) ||
      target.isContentEditable) {
    return  // 保留原生（删除输入框字符）
  }
  // 跳过 confirmDelete？
  if (confirmDelete) {
    Modal.confirm({ content: `确定删除选中的 ${graph.getSelectedCells().length} 个图元？` })
  }
  graph.removeCells(graph.getSelectedCells())
}
```

---

## 撤销 / 重做

### useUndoRedo.ts（L7-L49）

| 方法 | 实现 |
|------|------|
| `push(action)` | action 对象入栈 → canUndo = true |
| `undo()` | 弹出栈顶 action → 执行 `action.inverse()` |
| `redo()` | 正向执行 → 重新入栈 |
| `clear()` | 清空历史栈 |
| `canUndo / canRedo` | reactive boolean |
| `maxHistory = 100` | 超过 100 条自动丢弃最旧的 |

### X6 History 插件接入

```ts
// useKoruGraphEditor.ts:L486-L584
graph.on('history:change', ({ cmds }) => {
  // 同步 canUndo / canRedo
  canUndo.value = graph.canUndo()
  canRedo.value = graph.canRedo()
})

graph.on('history:undo', () => {
  eventBus.emit('UNDO_CHANGED')
})

graph.on('history:redo', () => {
  eventBus.emit('UNDO_CHANGED')
})
```

### History 记录了什么

**自动记录**（X6 History 插件内置）：
- 节点增 / 删 / 改
- 连线增 / 删 / 改
- 节点 attrs 变化（fill/stroke/text 等）
- 节点拖拽位置变化
- 选中 / 取消选中

**不记录**：
- 画布平移 / 缩放
- 实时数据刷新（setBindingConfig 的 fetchData）
- 手动 tick / refresh
- 粘贴操作内部的偏移（只有 paste 整个入栈）

### GRAPH_CHANGED 抑制

某些内部操作（比如模板应用前的 `graph.clearCells()`）不应该被 History 记录，否则会产生"撤销 → 回到空画布"的怪行为。

```ts
// useKoruGraphEditor.ts
graph.stopBatch('clearCells')  // 或 graph.withoutHistory(fn)
graph.clearCells()
graph.startBatch()
```

### 工具栏按钮状态自动同步

```vue
<!-- KoruToolbar.vue -->
<button :disabled="!canUndo" @click="doUndo">
  <UndoOutlined /> 撤销
</button>
<button :disabled="!canRedo" @click="doRedo">
  <RedoOutlined /> 重做
</button>
```

---

## 快捷键完整表

| 快捷键 | 来源 | 实现位置 |
|--------|------|----------|
| Ctrl/Cmd + Z | useUndoRedo | `graph.undo()` |
| Ctrl/Cmd + Shift + Z | useUndoRedo | `graph.redo()` |
| Ctrl/Cmd + A | useKoruGraphEditor | `graph.selectAll()`（跳过输入框） |
| Ctrl/Cmd + C | useClipboard | `graph.copy()` |
| Ctrl/Cmd + V | useClipboard | `graph.paste()` → 自动 +20px 偏移 |
| Ctrl/Cmd + X | useClipboard | `graph.cut()` |
| Delete / Backspace | useKoruGraphEditor | `graph.removeCells(selected)`（跳过输入框） |
| Ctrl + 滚轮 | X6 原生 | `zoomAtPoint()` |
| Shift + 点击 | X6 Selection 原生 | 追加选中 |

---

## 相关文档

- 编辑器操作：[editor-user-guide.md](./editor-user-guide.md)
- 模板系统（清空后撤销是什么行为）：[template-system.md](./template-system.md)
