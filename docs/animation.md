# 动画系统

> **源码位置**：`src/topology/composables/animationConfig.ts`（模板字典）、`src/topology/composables/useAnimation.ts`（执行引擎）
> **CSS 类名格式**：`anim-{templateId}`，预定义在 `anim.scss` 里。

---

## 7 个动画模板

源码 `ANIMATION_TEMPLATES`（`animationConfig.ts:L11-L139`），全部是 **node** 级动画。

| # | templateId | label | cycle | params | 效果 | 典型用例 |
|---|-----------|-------|-------|--------|------|----------|
| 1 | `opacityBreath` | 透明度呼吸 | loop | `duration` (200-10000, 默认 2000ms) | opacity 1 ↔ 0.35 渐变 | 遥信变位、待确认告警 |
| 2 | `motorSpin` | 电机旋转 | loop | `duration` (500-10000, 默认 3000ms) | 持续旋转 360° | 电机运行状态指示 |
| 3 | `scaleBounce` | 缩放弹动 | loop | `duration` (200-5000, 默认 1200ms) | scale 1 ↔ 1.1 | 选中提示、交互反馈 |
| 4 | `glowBreath` | 外发光呼吸 | loop | `duration`, `glowColor` (默认 `#ff3b30`) | box-shadow 光晕呼吸 | 重要故障、越限强提醒 |
| 5 | `rotateOnce` | 旋转一次 | once | `duration` (默认 1200ms) | 一次 360° 旋转 | 首次加载动画 |
| 6 | `fadeIn` | 渐入显示 | once | `duration` (默认 1000ms) | opacity 0 → 1 | 节点初次出现 |
| 7 | `fadeOut` | 渐隐消失 | once | `duration` (默认 1000ms) | opacity 1 → 0 | 节点消失动画 |

### cycle 说明

| cycle | 行为 | 可被哪些触发停止 |
|-------|------|------------------|
| `loop` | 无限循环 | `stopAnimation` 动作、`setAnimationEnabled(false)` |
| `once` | 执行一次自动停 | 自己执行完就停 |

### params 类型

```ts
interface AnimParamDef {
  key: string             // options 里的 key
  label: string           // 编辑器里的显示名
  type: 'number' | 'color' | 'select'
  min?: number
  max?: number
  step?: number
  default: any
}
```

---

## 启动 / 停止动画

### 方式 1：绑定模板自动驱动（boolAnim / statusAnimMapping）

见 [binding-templates.md](./binding-templates.md) 第 9/10 节。这是最常用的方式——测点值变化自动启动/停止动画。

### 方式 2：触发器动作（startAnimation / stopAnimation）

见 [trigger-actions.md](./trigger-actions.md) 第 7 节。条件命中时手动控制动画。

**触发器 actionValue**：

```jsonc
// startAnimation
{
  "templateId": "glowBreath",
  "options": {
    "glowColor": "#ef4444",
    "duration": 1500
  }
}

// stopAnimation
{}
```

### 方式 3：代码调用（useAnimation）

```ts
import { useAnimation } from '@mollu/koru/topology'

const { startAnimation, stopAnimation, toggleAnimation } = useAnimation(graph)

// 启动
startAnimation('cell-id-123', 'glowBreath', { glowColor: '#22c55e' })

// 停止
stopAnimation('cell-id-123')

// 切换
toggleAnimation('cell-id-123', 'opacityBreath')
```

### 方式 4：节点 data 直接设置

```ts
const node = graph.getCellById('breaker-1')
node.setData({
  ...node.getData(),
  animation: {
    enabled: true,
    templateId: 'glowBreath',
    options: { glowColor: '#ef4444', duration: 1500 },
  },
})
```

---

## 编辑器里配置动画

选中节点 → 右键 → 「动效」→ KoruAnimationPanel：

```
┌─ 动画配置 ──────────────────────┐
│ 启用动画: [✓]                    │
│ 动画模板: [外发光呼吸 ▼]           │
│ 动画周期: [loop ↓]                │
│ 呼吸周期: [1500] ms               │
│ 发光颜色: [#ef4444 🎨]            │
│                                  │
│ 自动启动: [✓] 进入画布时自动启动   │
└──────────────────────────────────┘
```

保存后动画配置写入节点 data：

```jsonc
{
  "shape": "custom-circle",
  "data": {
    "animation": {
      "enabled": true,
      "templateId": "glowBreath",
      "options": { "glowColor": "#ef4444", "duration": 1500 }
    }
  }
}
```

---

## CSS 实现原理

每个模板对应一个 CSS keyframes 动画，挂载到 `.cell.anim-{templateId}` 类名上：

```css
.cell.anim-opacityBreath {
  animation: koru-breath var(--dur, 2000ms) ease-in-out infinite;
}
@keyframes koru-breath {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.35; }
}

.cell.anim-glowBreath {
  animation: koru-glow var(--dur, 2000ms) ease-in-out infinite;
  box-shadow: 0 0 20px var(--glow-color, #ff3b30);
}
@keyframes koru-glow {
  0%, 100% { box-shadow: 0 0 10px var(--glow-color); }
  50%      { box-shadow: 0 0 30px var(--glow-color); }
}
```

`useAnimation` 在启动时给节点 DOM 元素 `classList.add('anim-' + templateId)`，停止时 `classList.remove`。

---

## 新增自定义动画模板

```ts
// 1. 在 ANIMATION_TEMPLATES 里注册
import { ANIMATION_TEMPLATES } from '@mollu/koru/topology'

ANIMATION_TEMPLATES['myCustomAnim'] = {
  id: 'myCustomAnim',
  label: '自定义脉冲',
  cycle: 'loop',
  target: 'node',
  params: [
    { key: 'duration', label: '周期(ms)', type: 'number', default: 800 },
    { key: 'scaleFrom', label: '起始缩放', type: 'number', default: 1 },
    { key: 'scaleTo', label: '目标缩放', type: 'number', default: 1.2 },
  ],
  desc: '节点按自定义缩放比例循环脉冲。',
}

// 2. 在 CSS 里加对应 keyframes（全局 inject 或 scoped）
// .cell.anim-myCustomAnim { animation: ... }
```

> 模板字典是运行时全局变量，可以在应用启动时追加——不需要改源码。

---

## 触发链

```
条件命中（绑定检测）
  │
  ├─ boolAnim 模板 → useBindingExecutor 检测到 targetProperty === 'nodeAnim'
  │   → nodeAttrs.animation.enabled = true
  │   → useAnimation watcher 给 DOM 加 classList.add('anim-glowBreath')
  │
  └─ stopAnimation 动作
      → nodeAttrs.animation.enabled = false
      → classList.remove('anim-glowBreath')
```

---

## 常见问题

### Q: 动画不显示？

检查 3 件事：
1. 节点 `data.animation.enabled === true`
2. 节点 DOM 元素有 `class="anim-{templateId}"`
3. CSS keyframes 动画有没有注入（用浏览器 DevTools 搜 `@keyframes koru-breath`）

### Q: loop 动画怎么停？

```ts
stopAnimation(cellId)
// 或
node.setData({ ...node.getData(), animation: { ...anim, enabled: false } })
```

### Q: once 动画会重复触发吗？

once 动画执行完自动停。但如果 `animation.enabled` 保持 true 且触发了 DOM 重建（比如节点被重新创建），会再执行一次。

---

## 相关文档

- 绑定模板（boolAnim / statusAnimMapping）：[binding-templates.md](./binding-templates.md)
- 触发器动作（startAnimation / stopAnimation）：[trigger-actions.md](./trigger-actions.md)
- 多状态节点：[multi-state.md](./multi-state.md)
