# 模板系统

> **源码位置**：`src/topology/components/KoruTemplate.vue`（模板管理弹窗）、`src/topology/components/KoruSavePanel.vue`（保存面板）、`src/topology/components/KoruStencil.vue`（模板缩略图拖拽）、`src/topology/utils/storage.ts`（IndexedDB 存储）

---

## 存储结构

模板存在 IndexedDB `koru-templates` 表（key-value）：

```ts
interface TemplateItem {
  id: string              // 唯一 id（uid()）
  name: string            // 用户输入的名称
  thumbnail: string       // base64 data URL（PNG 缩略图，nodeToSvgThumbnail 生成）
  diagramData: any        // X6 原生 JSON（{ cells, canvas }）
  createdAt: number       // Date.now()
  updatedAt: number
}
```

---

## 保存为模板

### 操作路径

```
编辑器 → 工具栏「保存」按钮 → KoruSavePanel 弹出
  ├─ 输入名称
  └─ 勾「保存为模板」→ ✅
```

### 内部流程

```
1. 用户点保存 → confirmSave()
2. graph.toJSON() → diagramData
3. svgToDataUrl(节点合并 SVG) → thumbnail
4. dbSet('koru-templates', { id, name, thumbnail, diagramData })
5. emit('template', { action: 'save', template })
6. Stencil 自动刷新 → 模板缩略图出现在「我的模板」分组
```

### 代码触发保存

```ts
import { dbSet, uid } from '@mollu/koru/topology'

async function saveCurrentAsTemplate(name: string, graph: GraphType) {
  const diagramData = graph.toJSON()
  const thumbnail = svgToDataUrl(/* 当前画布 SVG 截图 */)
  const template = {
    id: uid('tpl'),
    name,
    thumbnail,
    diagramData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await dbSet('koru-templates', template.id, template)
  return template
}
```

---

## 应用模板

### 方式 1：Stencil 拖拽

```
Stencil 「我的模板」分组里的缩略图
  → 按住左键拖到画布
  → getDropNode() 检测到 shape 是模板 id
  → 弹确认框（confirmTemplateApply 默认 true）
  → graph.clearCells()
  → graph.fromJSON(template.diagramData)
  → emit('template', { action: 'apply', template })
```

### 方式 2：双击缩略图

```ts
// KoruStencil 内部
stencil.on('node:drop', ({ node }) => {
  if (node.shape.startsWith('template:')) {
    applyTemplate(node.shape.split(':')[1])
  }
})
```

双击画布上的模板缩略图 → 直接应用（不走拖拽逻辑，但也弹确认）。

### 方式 3：模板管理弹窗

```
工具栏「模板管理」按钮 → KoruTemplate.vue
  ├─ 列表显示所有模板缩略图
  ├─ 点击某一项 → 应用（同样弹确认）
  ├─ 「重命名」按钮 → 改 name
  └─ 「删除」按钮 → dbRemove('koru-templates', id) + 弹确认
```

### 确认开关

```ts
setComponentConfig({
  confirmTemplateApply: false  // 关掉 → 拖拽/应用时不弹确认，直接覆盖
})
```

**默认 true**——应用模板会清空当前画布，怕误操作所以默认有确认。

---

## Stencil 里的模板缩略图

模板保存后，`KoruStencil` 的 `templates` 分组自动填充：

```ts
// defaultStencilGroups.ts TEMPLATE_GROUP
{
  name: 'templates',
  label: '我的模板',
  columns: 2,
  items: async () => {
    // 从 IndexedDB 读
    const templates = await dbAll('koru-templates')
    return templates.map(t => ({
      shape: `template:${t.id}`,
      label: t.name,
      dropWidth: 120,
      dropHeight: 120,
      // thumbnail 是 SVG shape 的 data
    }))
  },
}
```

### 模板在画布上的 drop 特殊处理

`getDropNode(cell, graph)`（`KoruStencil.vue:L143-L234`）：

| shape 匹配 | 行为 |
|------------|------|
| `template:*` | 不创建节点 → 直接覆盖画布（弹确认） |
| `custom-split` | dropWidth=160, dropHeight=80（放大） |
| `svg-node-*` | dropWidth/Height 用注册时指定值 |
| 普通 shape | dropWidth *= 1.2 放大 |

---

## TemplateItem CRUD API

```ts
import { dbGet, dbSet, dbRemove } from '@mollu/koru/topology'

// 读取所有模板
const all = await dbAll('koru-templates')

// 按 id 读
const one = await dbGet('koru-templates', 'tpl-abc123')

// 更新模板
await dbSet('koru-templates', 'tpl-abc123', {
  ...one,
  name: '新名称',
  updatedAt: Date.now(),
})

// 删除模板
await dbRemove('koru-templates', 'tpl-abc123')

// 清空所有模板
// await Promise.all(all.map(t => dbRemove('koru-templates', t.id)))
```

---

## 与 IndexedDB 持久化的区别

| 持久化（persistenceKey） | 模板（koru-templates） |
|-------------------------|----------------------|
| 存最近一次编辑进度 | 存多个可复用的预设 |
| 一个 key 一份数据 | 一个 store 多份数据 |
| 自动恢复（打开编辑器时） | 手动应用（拖拽/双击） |
| 不是 Stencil 元件 | 是 Stencil 元件 |
| `persistenceKey` 为空串禁用 | 无总开关，dbRemove 清空 |

**两张不同的 IndexedDB 表**，互不干扰。

---

## 事件监听

```ts
// 监听模板操作
function onTemplate(payload: {
  action: 'save' | 'apply' | 'delete' | 'clear'
  template?: TemplateItem
  templates?: TemplateItem[]
}) {
  switch (payload.action) {
    case 'save':
      console.log('新模板:', payload.template?.name)
      // 可以同步给后端
      break
    case 'delete':
      console.log('删除了')
      break
    case 'clear':
      console.log('全部清空')
      break
  }
}
```

---

## 相关文档

- 持久化：[persistence.md](./persistence.md)
- Stencil：见 [editor-user-guide.md](./editor-user-guide.md) Stencil 章节
- IndexedDB 存储适配器：[global-config.md](./global-config.md) `persistenceAdapter`
