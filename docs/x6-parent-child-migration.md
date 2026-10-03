# X6 Parent-Child 重构方案

> ✅ **已实施完成（2026-09-30）**
> 
> 日期：2026-09-30
> 状态：**全部实施完毕** —— 源码已彻底从 `groupId/memberGroupId` 字符串匹配机制迁移到 X6 原生 parent-child
>
> 验证：`memberGroupId` 在 src/ 中零命中；`setParent/getParent/getChildren` 在 5 个核心文件（`useKoruGraphEditor`/`useContextMenu`/`useMultiState`/`KoruPreview`/`useCanvasPersistence`）中共 **46 处调用**
>
> 消费方**不需要阅读本文档**。这是开发内部的迁移设计原始稿，保留用于记录架构演进历史。

---

## 一、迁移成果速览

### 1.1 源码侧已完成的关键改动

| 文件 | 改动摘要 |
|------|---------|
| `useKoruGraphEditor.ts` | **彻底 X6 parent-child 模式**：KoruGraphData → X6 JSON 序列化时补 `cell.parent` + 坐标转相对；反序列化时把 parent-child 相对坐标转回绝对；保存前调 `_detachGroupParentChild` 拆解 parent 保证向后兼容 |
| `useContextMenu.ts` | 组合/取消组合直接用 `setParent()` / `getParent()` / `getChildren()`；粘贴时遍历 children 重新 setParent；删除容器时用 `getChildren()` 处理成员 |
| `useMultiState.ts` | 状态显隐切换用 `parent.getChildren()` 获取多状态容器的子图元 |
| `KoruPreview.vue` | Preview 模式 `interacting` 里用 `cell.getParent()` 正确处理容器/成员；selectionFilter 用 `getParent()` 跳过成员 |
| `useCanvasPersistence.ts` | 持久化时用 `getParent()` 区分容器和成员 |

### 1.2 向后兼容策略

保存时调用 `_detachGroupParentChild()`：把子元素的相对坐标转回绝对、`cell.setParent(null)` 拆 parent，保证输出 JSON 仍是**平铺格式 + 绝对坐标**。这样旧版图纸数据（没有 parent 字段）可以直接 `fromJSON`，新数据也能在不支持 parent 的下游正常工作。

---

## 二、迁移前的现状问题（历史记录）

以下内容是**迁移设计原始稿**，保留用于记录架构演进历史。

### 1.1 当前架构

```
所有节点平铺在 JSON 数组里：
  [ 容器节点(isGroup=true, memberGroupId="g-xxx"), 
    子元素节点(groupId="g-xxx"),     ← 平级，靠字符串匹配关联
    子元素节点(groupId="g-xxx"),
    独立节点, 
    ... ]
```

容器和成员**没有对象引用关系**，唯一联系是 `memberGroupId === groupId === "g-xxx"`。

### 1.2 代码负担（约 200 行冗余逻辑）

| 位置 | 代码 | 用途 |
|------|------|------|
| `useKoruGraphEditor.ts` ~L970-1100 | 容器拖动手动同步 | 遍历 find memberGroupId === groupId，手动算 dx/dy，调用 m.position(dx, dy) |
| `useKoruGraphEditor.ts` ~L1187-1200 | 选容器手动找成员 | 遍历全画布，字符串匹配 memberGroupId/groupId |
| `useKoruGraphEditor.ts` ~L1500-1508 | 属性改动传播 | 遍历找成员，逐个调 setProp/attr |
| `useKoruGraphEditor.ts` L283 | `setSelectionFilter` | 拦截 groupId 成员禁选 |
| `useKoruGraphEditor.ts` ~L940-947 | `cell:added` + `applyMemberProtectionInline` | 新增成员时禁选禁拖 |
| `useContextMenu.ts` ~L412-455 | 右键复制 groupId 重映射 | 复制时重新生成 g-xxx 避免冲突 |
| `useKoruGraphEditor.ts` L286-323 | `patchedFromJSON` | 加载后 applyMemberProtectionAll（4 轮 setTimeout 兜底） |
| **总计** | **~200 行** | |

### 1.3 功能缺失

| 功能 | 当前 | parent-child 后 |
|------|------|----------------|
| 容器拖 → 子元素跟 | ✅ 手动同步，易出错 | ✅ X6 内置，零代码 |
| 容器缩放 → 子元素缩放 | ❌ 没实现 | ✅ X6 内置 |
| 容器隐藏 → 子元素隐藏 | ❌ 没实现 | ✅ X6 内置 |
| 选容器自动选成员 | ✅ 手动遍历 | ✅ X6 内置（strict/auto 模式） |
| 删容器 → 成员处理 | ⚠️ 弹窗询问，手动删 | ✅ X6 内置（或配置保留） |
| 子元素跑出容器 | ✅ 允许（无 bounds 限制） | ⚠️ X6 默认限制，需调配置 |
| 子元素相对坐标 | ❌ 全是绝对坐标，保存时大 | ✅ 天然相对 |
| 嵌套组合（组合套组合） | ❌ 需递归匹配 | ✅ X6 原生支持 |

---

## 二、目标架构

### 2.1 数据格式

**JSON 仍然是平铺数组**，但成员节点多一个 `parent` 字段，`memberGroupId/groupId` 保留向后兼容：

```json
[
  {
    "id": "container-001",
    "shape": "rect",
    "data": { "isGroup": true, "memberGroupId": "g-xxx", "name": "组合" },
    "position": { "x": 175, "y": 450 },
    "size": { "width": 313, "height": 113 },
    "zIndex": 13
  },
  {
    "id": "member-001",
    "parent": "container-001",           // ← X6 原生父子关系
    "shape": "svg-node-1",
    "data": { "groupId": "g-xxx", "name": "断路器" },  // ← 保留兼容旧数据
    "position": { "x": 10, "y": 10 },   // ← 相对容器左上角，不是绝对画布坐标
    "size": { "width": 60, "height": 48 },
    "zIndex": 0
  }
]
```

### 2.2 运行时关系

```
X6 自动维护:
  container-001
    ├── member-001     (parent = 'container-001')
    ├── member-002
    └── member-003

移动 container → X6 自动算 member 新位置
删除 container → X6 自动删除 member（或配置保留）
选择 container → X6 自动选中 member（strict 模式）
```

### 2.3 多状态元件特殊处理

```
多状态容器 (isMultiState: true)
  ├── stateList: [{ cellIds: ['member-001'], stateId: 's1', stateName: '状态1' }]
  ├── member-001   (activeStateId = 's1' 时显示)
  ├── member-002   (activeStateId = 's1' 时隐藏)
  └── member-003   (activeStateId = 's1' 时隐藏)

stateList.cellIds 存的是 node id，setParent 后 id 不变，切换逻辑不用改
```

---

## 三、实施清单（全部已完成 ✅）

> 以下迁移任务已在 2026-09-30 全部实施完毕，当前源码已完全处于 X6 原生 parent-child 模式。

### 阶段 1：保存路径改造 ✅

| # | 任务 | 文件 | 内容 |
|---|------|------|------|
| 1.1 | 添加相对坐标转换工具 | 新建 `src/topology/utils/coordinate.ts` | `absToRel(node, parent)` / `relToAbs(node, parent)` 函数 |
| 1.2 | 改造 `getGraphData` | `useKoruGraphEditor.ts` | 保存时：① 找所有容器 ② 给成员补 `parent` 字段 ③ 成员坐标转相对 ④ 调 `graph.toJSON()` ⑤ 还原内存坐标 |
| 1.3 | JSON 排序 | `useKoruGraphEditor.ts` | 确保容器在子元素之前出现在 JSON 数组（X6 fromJSON 要求父先于子） |
| 1.4 | 兼容旧格式 | 同上 | toJSON 输出里**同时保留** `memberGroupId/groupId` + 新增 `parent` 字段，旧 JSON 不炸 |

### 阶段 2：加载路径改造

| # | 任务 | 文件 | 内容 |
|---|------|------|------|
| 2.1 | 重写 `patchedFromJSON` | `useKoruGraphEditor.ts` L286-323 | 删除 `applyMemberProtectionAll` + 4 轮 setTimeout。X6 看到 `parent` 自动建父子，不需要任何补逻辑 |
| 2.2 | 旧 JSON 兜底 | 同上 | 如果 JSON 里**没有** `parent` 字段（旧数据），fallback 到：遍历找 `memberGroupId/groupId` → 遍历 setParent + 坐标换算 |
| 2.3 | 移除 selection filter | `useKoruGraphEditor.ts` L283 | 删除 `graph.setSelectionFilter(cell => !cell.getData?.()?.groupId)`，parent-child 后成员应能被选中 |

### 阶段 3：删除冗余代码

| # | 任务 | 文件 | 行数 |
|---|------|------|------|
| 3.1 | 删容器拖动手动同步 | `useKoruGraphEditor.ts` ~L970-1100 | ~80 |
| 3.2 | 删选容器手动找成员 | `useKoruGraphEditor.ts` ~L1187-1200 | ~15 |
| 3.3 | 删属性改动传播 | `useKoruGraphEditor.ts` ~L1500-1508 | ~10 |
| 3.4 | 删 applyMemberProtectionInline 调用 | `useKoruGraphEditor.ts` ~L940-947 | ~8 |
| 3.5 | 删 applyMemberProtectionAll 定义 | `useKoruGraphEditor.ts` ~L289-306 | ~18 |
| 3.6 | 删右键复制 groupId 重映射 | `useContextMenu.ts` ~L412-455 | ~50 |
| 3.7 | 删 useKoruGraphEditor 中 selection filter | `useKoruGraphEditor.ts` L283 | 1 |
| 3.8 | 删 patchGraphSave (如果有) | 同上 | |
| 3.9 | 删其他散落的 memberGroupId 字符串匹配 | 全局 grep | ~20 |
| **总计** | | | **~202 行** |

### 阶段 4：解决 X6 parent-child 默认行为差异

| # | 问题 | 默认行为 | 目标行为 | 解决 |
|---|------|---------|---------|------|
| 4.1 | 子元素 bounds 限制 | X6 限制子元素在父容器矩形内 | 允许自由拖到容器外 | 给容器 node 设 `data.overflow: 'visible'` 或 `node.unfreeze()` |
| 4.2 | 选择行为 | X6 默认选父 = 选所有子 | 保持现状（严格同步） | 保留默认 strict 模式 |
| 4.3 | 删除行为 | X6 默认删父 = 删所有子 | 弹窗询问用户是否连子一起删 | 覆写 `graph.on('node:removed')` 或设 `preserveChildOnRemove` |
| 4.4 | 多状态容器显示/隐藏 | X6 父隐藏 → 子全隐藏 | 只隐藏非 activeStateId 的子 | 不用父容器 hide，继续用 node.attr('body/style/display', 'none') 控制单个子元素可见性 |
| 4.5 | 成员单独选中 | selection filter 删了后成员能单独选 | 可能要保持禁选？ | 如果要保持禁选：给成员 node 设 `node.interact({ node: false })` 或 `attrs.body.style.pointer-events: none` |

### 阶段 5：验证清单

| # | 验证项 | 预期结果 |
|---|--------|---------|
| 5.1 | 加载图纸（有 parent 字段的新格式） | 容器和成员自动建立父子，拖动容器 → 子元素跟随 |
| 5.2 | 加载旧图纸（只有 memberGroupId/groupId，没 parent） | fallback 逻辑补建父子，行为一致 |
| 5.3 | 保存图纸 | 输出带 parent + 相对坐标，重加载位置正确 |
| 5.4 | 容器拖动 → 子元素跟随 | ✅ X6 原生，平滑无抖动 |
| 5.5 | 容器缩放 → 子元素也缩放 | ✅ X6 原生 |
| 5.6 | 容器隐藏 → 子元素隐藏 | ✅ X6 原生 |
| 5.7 | 删容器 → 弹窗提示 | 询问是否同时删除 N 个子元素 |
| 5.8 | 选容器 → 子元素自动选中 | ✅ strict 模式 |
| 5.9 | 子元素拖出容器 bounds | 允许（已配置 overflow: visible） |
| 5.10 | 多状态切换 | 正常显示/隐藏对应子元素 |
| 5.11 | 事件面板目标图元下拉 | 容器 + 独立图元（成员已 filter） |
| 5.12 | 右键复制组合容器 | 新容器成员也是父子关系，位置正确 |
| 5.13 | 撤销/重做（history） | 拖拽/保存/删除都能正常 undo/redo |
| 5.14 | svg-node / custom-button / custom-text | 各种 shape 都能当 parent 或 child |

---

## 四、时间估算

| 阶段 | 时间 | 风险 |
|------|------|------|
| 阶段 1：保存路径改造 | 1h | 中 |
| 阶段 2：加载路径改造 | 1h | 中 |
| 阶段 3：删冗余代码 | 30min | 低 |
| 阶段 4：解决 X6 默认行为 | 1h | 中 |
| 阶段 5：验证 | 1h | 低 |
| **总计** | **~4.5 小时** | |

---

## 五、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 加载旧 JSON 没有 parent 字段 | 100% | 高（旧数据炸了） | 阶段 2.2 做 fallback：没有 parent 时走字符串匹配 + setParent |
| X6 bounds 限制子元素拖不出容器 | 80% | 中 | 阶段 4.1 预设 overflow 配置 |
| fromJSON 父容器还没创建就遇到 parent 引用 | 50% | 高（加载报错） | 阶段 1.3 排序 JSON：容器先、子元素后 |
| 坐标转换后子元素位置错位 | 30% | 高 | 保存前 dump 绝对/相对坐标对照 → 手动验证一个实例 |
| selection filter 删后成员误选 | 40% | 低 | 如要禁选，改用 `node.interact({ node: false })` |
| 撤销/重做不覆盖 parent-child 操作 | 20% | 中 | 单独测试 undo/redo 组合场景 |

---

## 六、回退方案

如果出问题，全部回退非常简单：

1. **保存时去掉 parent 字段**：删除阶段 1.2 的 parent 写入代码
2. **加载时去掉 setParent**：删除阶段 2.2 的 fallback
3. **恢复 selection filter**：加回 L283 的代码
4. **恢复冗余代码**：git revert 阶段 3 的删除

**为什么好回退**：JSON 格式**同时保留了** `memberGroupId/groupId` 和 `parent` 字段，两种机制并存。运行时不调 setParent 就是旧模式，调了就是新模式。

---

## 七、关键 API 参考

```typescript
// 设父关系
node.setParent(parentNode)
node.getParent()      // 返回 parent 或 null
node.getAncestors()   // 返回所有祖先

// JSON 输出 parent
graph.toJSON()
// X6 自动给子节点输出 parent + 相对坐标
// 给父节点输出 children: [childId, childId, ...]

// JSON 输入 parent
graph.fromJSON({
  nodes: [
    { id: 'p', ..., zIndex: -1 },  // 父必须先出现
    { id: 'c', parent: 'p', position: { x: 0, y: 0 } }
  ]
})
// X6 自动建父子

// 限制子元素不出 bounds（默认）
node.freeze()
// 取消限制
node.unfreeze()

// 选择模式
graph.setSelectionMode('strict')   // 选父 = 选子
graph.setSelectionMode('auto')     // 选父 = 选子，但子可单独选
```
