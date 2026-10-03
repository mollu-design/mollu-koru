# 插件系统（Flow / Whiteboard）

> **源码位置**：`src/plugins/flow/index.ts` + `src/plugins/whiteboard/index.ts`
> 两个可选插件，不随主入口自动加载，按需 `import`。

---

## Flow 流程插件

**路径**：`import { FlowPlugin } from '@mollu/koru/plugins/flow'`

### 功能

在 KoruGraphEditor 基础上增加**流程编排能力**：

| 功能 | 说明 |
|------|------|
| 流程节点形状 | 6 个内置 shape：开始 / 结束 / 任务 / 判断 / 子流程 / 文档 |
| 动作面板 | 在工具栏增加「流程配置」按钮，点击后打开流程配置弹窗 |
| 审批流 | 节点上可以配置审批人、审批条件、回退路径 |
| 分支/条件路由 | 节点出边可以加条件（JEXL 表达式） |
| 流程图导出 | 导出为 BPMN / Mermaid 格式 |

### 注册

```ts
import { createApp } from 'vue'
import { KoruTopologyPlugin } from '@mollu/koru/topology'
import { FlowPlugin } from '@mollu/koru/plugins/flow'

const app = createApp(App)
app.use(KoruTopologyPlugin)
app.use(FlowPlugin)   // 在主插件之后注册
app.mount('#app')
```

### FlowNodeShapes

```ts
import { FlowNodeShapes } from '@mollu/koru/plugins/flow'

// 内置的 6 个流程 shape 常量
// FlowNodeShapes.START       — 开始节点（椭圆，绿色）
// FlowNodeShapes.END         — 结束节点（椭圆，红色）
// FlowNodeShapes.PROCESS     — 任务节点（圆角矩形，蓝色）
// FlowNodeShapes.DECISION    — 判断节点（菱形，橙色）
// FlowNodeShapes.SUBPROCESS  — 子流程节点（带双竖线边界，紫色）
// FlowNodeShapes.DOCUMENT    — 文档节点（折角矩形，青色）
```

注册后这些 shape 自动注册到 X6 全局，并在 Stencil 追加一个「🔀 流程图」分组（6 个节点）。

---

## Whiteboard 白板插件

**路径**：`import { WhiteboardPlugin } from '@mollu/koru/plugins/whiteboard'`

### 功能状态

⚠️ **当前为插件壳**（已导出 `WhiteboardPlugin` + `WhiteboardTools` 常量 + 空 install），实际标注/激光笔/便签等功能待后续实现。

### WhiteboardTools 常量

```ts
import { WhiteboardTools } from '@mollu/koru/plugins/whiteboard'

// 工具类型常量（当前仅导出，功能待实现）
// WhiteboardTools.SELECT    — 选择
// WhiteboardTools.PEN       — 画笔
// WhiteboardTools.TEXT      — 文字
// WhiteboardTools.STICKY    — 便签
// WhiteboardTools.ERASER    — 橡皮
// WhiteboardTools.LASSO     — 套索
```

### 注册（当前无效，占位）

```ts
import { WhiteboardPlugin } from '@mollu/koru/plugins/whiteboard'
app.use(WhiteboardPlugin)
```

注册后仅输出 `[Koru WhiteboardPlugin] installed` 日志，不产生实际 UI 变化。

---

## 两个插件的共存

FlowPlugin 和 WhiteboardPlugin 可以**同时注册**：

```ts
app.use(KoruTopologyPlugin)
app.use(FlowPlugin)
app.use(WhiteboardPlugin)
```

Flow 流程节点出现在 Stencil 里；白板工具在工具栏里有独立的开关。两者互不干扰（白板叠加层在节点层之上）。

---

## 开发自己的插件

插件结构约定：

```ts
// plugins/my-plugin/index.ts
export const MyPlugin = {
  install(app: App) {
    // 1. 注册组件
    app.component('KoruMyFeature', MyFeature)

    // 2. 注册节点 shape
    registerNodeModule('my-shape', { /* ... */ })

    // 3. 向 canvasStore 注入配置
    setComponentConfig({
      customToolbarItems: [
        { label: '我的功能', icon: 'MyIcon', onClick: () => ... }
      ]
    })
  }
}
```

插件之间通过 `canvasStore` 通信（全局 reactive store），不直接耦合。

---

## 源码位置参考

| 文件 | 行数 | 说明 |
|------|------|------|
| `plugins/flow/index.ts` | 31 行 | FlowPlugin + FlowNodeShapes 导出 |
| `plugins/whiteboard/index.ts` | 31 行 | WhiteboardPlugin + WhiteboardTools 导出 |

两个插件都很薄——核心逻辑委托给 `topology/` 里的 composable 和 Canvas Store。

---

## 相关文档

- Canvas Store：[global-config.md](./global-config.md)
- 模块注册：[module-registration.md](./module-registration.md)
