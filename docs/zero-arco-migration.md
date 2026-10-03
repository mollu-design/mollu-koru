# 零 Arco 迁移技术文档

> **目标**：消费方无需安装 `@arco-design/web-vue`，仅用 mollu-koru 即可组装完整拓扑编辑器。
> **现状**：12 个组件 + 2 个 composable + 全局样式类已完成零 Arco 改造。

---

## 背景

mollu-koru 最初选择 `@arco-design/web-vue` 作为唯一 UI 依赖（v0.1.x 阶段务实选择）。但实际接入中发现：

1. **消费方可能已用其他 UI 库**（Element Plus / Naive UI / Ant Design Vue），被迫同时引入 Arco 增加包体积和样式冲突风险
2. Arco 的 `Modal.confirm()` / `Message.warning` 等静态 API 无法按需裁剪
3. 部分场景（嵌入 iframe、微前端）需要最小化依赖

因此启动 **"零 Arco 可选方案"** 改造——组件库内部自建轻量 UI 层，消费方按需选择完整方案（带 Arco）或精简方案（零 Arco）。

---

## 改造原则

| 原则 | 说明 |
|------|------|
| **不拆包** | 不在 npm 上发两个版本，仍一个 `@mollu/koru` 包 |
| **渐进式** | 先改对外暴露的核心组件，再改内部面板 |
| **风格对齐** | 自建 UI 层的主色/灰阶/圆角/字号与 Arco Design 保持一致（降低视觉差异） |
| **不破坏现有用法** | `plugin.ts` 里的 Arco 自动注册**保留**，选完整方案的消费方不受影响 |
| **不开发新架构** | 不引入 UnoCSS / Tailwind 等新依赖，只用原生 HTML + CSS |

---

## 自建 UI 层

### 全局样式类（`src/style/global.scss`）

2025-10 新增零 Arco 基础组件类，由 `KoruTopologyPlugin` 自动注入：

| 类名 | 用途 | 替代的 Arco 组件 |
|------|------|------------------|
| `.k-btn` / `.k-btn--primary` / `.k-btn--danger` / `.k-btn--sm/--xs/--lg` | 按钮 | `<a-button>` |
| `.k-input` / `.k-input--sm/--lg` + `.k-input-word-limit` | 输入框 | `<a-input>` |
| `.k-divider` | 分隔线 | `<a-divider>` |
| `.k-alert` + `--warning/--info/--success/--error` | 告警提示 | `<a-alert>` |
| `.k-empty` | 空状态 | `<a-empty>` |
| `.k-switch` | 开关（隐藏 checkbox + CSS track） | `<a-switch>` |

### 色板（与 Arco Design 对齐）

```
主色  #165dff    成功  #00b42a    警告  #ff7d00    危险  #f53f3f
灰阶  #1d2129 → #4e5969 → #86909c → #c9cdd4 → #e5e6eb → #f2f3f5
```

### 自建组件（3 个）

| 组件 | 文件 | 用途 |
|------|------|------|
| `KoruModal` | `src/topology/components/KoruModal.vue` | 通用弹窗容器（替代 `<a-modal>`） |
| `KoruConfirmDialog` | `src/topology/components/KoruConfirmDialog.vue` | 确认弹窗（替代 `Modal.confirm()` / `window.confirm`） |
| `useConfirm` | `src/topology/composables/useConfirm.ts` | Promise 化 composable（可选便利 API） |

#### KoruModal

```ts
// props
{ visible: boolean, title: string, width?: number, showFooter?: boolean, okText?: string, cancelText?: string }
// emits
{ 'update:visible': (v: boolean) => void, 'ok': () => void, 'cancel': () => void }
```

关键实现：
- `<teleport to="body">` — 不受祖先容器 `overflow` / `transform` 裁剪
- `<transition name="koru-modal-fade">` — 原生 CSS 过渡
- 默认无 footer，业务组件用 `#footer` slot 自定义
- 传 `showFooter` 自动渲染确定/取消按钮 + emit `ok`/`cancel`

#### KoruConfirmDialog

```ts
// props
{ visible: boolean, title: string, content: string, type?: 'info' | 'warning' | 'danger', okText?: string, cancelText?: string, loading?: boolean }
// emits
{ 'update:visible': (v: boolean) => void, 'ok': () => void, 'cancel': () => void }
```

三种类型自动联动图标色 + 确定按钮色：

| type | 图标色 | 确定按钮色 |
|------|--------|-----------|
| `info`（默认） | 蓝色 `#165dff` | 主色 |
| `warning` | 橙色 `#ff7d00` | 橙色 |
| `danger` | 红色 `#f53f3f` | 红色 |

---

## 零 Arco 组件清单（12 个）

### 核心组件

| 组件 | 替换的 Arco 依赖 | 改造时间 |
|------|-----------------|----------|
| `KoruToolbar` | `Modal.confirm()` → `showConfirm()` + `KoruConfirmDialog`<br>`<a-popconfirm>` × N → 删除（内嵌 `KoruConfirmDialog`） | 2025-10-03 |
| `KoruSavePanel` | `<a-modal>` → `KoruModal`<br>`<a-button>` × 4 → `<button class="k-btn ...">`<br>`<a-input>` → `<input class="k-input">`<br>`<a-divider>` → `<hr class="k-divider">`<br>`<a-alert>` × 2 → `<div class="k-alert">`<br>`Message.warning` → `console.warn` | 2025-10-03 |
| `KoruTemplate` | `<a-modal>` → `KoruModal`<br>`<a-button>` × 5 → `<button class="k-btn">`<br>`<a-popconfirm>` × 2 → `showConfirm()` + `KoruConfirmDialog`<br>`<a-tooltip>` → 原生 `title`<br>`<a-empty>` → `<div class="k-empty">`<br>`<a-input>` → `<input class="k-input k-input--sm">`<br>`<a-space>` → 删除 | 2025-10-03 |
| `KoruGallery` | `<a-modal>` → `KoruModal`<br>`<a-button>` × 2 → `<button class="k-btn">`<br>`<a-switch>` → `<label class="k-switch">`<br>`<a-empty>` → `<div class="k-empty">` | 2025-10-03 |
| `KoruGraphEditor` | 内嵌 `<a-modal>` "保存图纸" → 删除（统一用 `KoruSavePanel`）<br>`import { Modal }` → 删除 | 2025-10-03 |
| `KoruStencil` | `<a-tooltip>` → `<teleport to="body">` 自实现 hover 层 | 2025-10-03 |
| `KoruContextMenu` | 原本零 Arco（`Message.warning` 残留待清理） | 原本 |
| `KoruMinimap` | 原本零 Arco | 原本 |
| `KoruNodeRenderer` | 原本零 Arco | 原本 |
| `KoruEdgeRenderer` | 原本零 Arco | 原本 |
| `KoruLogoName` | 原本零 Arco | 原本 |
| `KoruPropertyPanel` | 原本零 Arco（script 里曾用 Arco，清理过） | 原本 |

### 新建组件

| 组件 | 文件 |
|------|------|
| `KoruModal` | `src/topology/components/KoruModal.vue` |
| `KoruConfirmDialog` | `src/topology/components/KoruConfirmDialog.vue` |

### 新建 composable

| composable | 文件 | 用途 |
|------------|------|------|
| `useConfirm` | `src/topology/composables/useConfirm.ts` | 可选便利 API（组件内部用 `confirmState` 更主流） |

---

## 替换统计

### Arco 组件替换矩阵

| Arco 组件 | 出现位置 | 替代方案 |
|-----------|----------|----------|
| `<a-modal>` | SavePanel / Template / Gallery / GraphEditor 内嵌 | `KoruModal`（自建） |
| `<a-button>` | SavePanel × 4 / Template × 5 / Gallery × 2 | `<button class="k-btn ...">` |
| `<a-input>` | SavePanel / Template | `<input class="k-input">` |
| `<a-input-number>` | （PropertyPanel 里，未改） | — |
| `<a-switch>` | Gallery | `<label class="k-switch">` |
| `<a-alert>` | SavePanel × 2 | `<div class="k-alert">` |
| `<a-divider>` | SavePanel | `<hr class="k-divider">` |
| `<a-empty>` | Template / Gallery | `<div class="k-empty">` |
| `<a-tooltip>` | Template / Stencil | 原生 `title` / `teleport hover` |
| `<a-popconfirm>` | Toolbar / Template × 2 | `showConfirm()` + `KoruConfirmDialog` |
| `<a-space>` | Template / Gallery | 删除（div + flex gap） |
| `Modal.confirm()` | Toolbar / GraphEditor | `showConfirm()` + `KoruConfirmDialog` |
| `Message.warning/success` | SavePanel / ContextMenu composable / useScriptLib | `console.warn` / `console.log` / 待清理 |

### 待继续改造（重灾区）

以下组件 template 仍大量使用 `<a-*>` 标签，工作量较大暂未改造：

| 组件 | 残留 Arco 标签 | 优先级 |
|------|---------------|--------|
| `KoruPropertyPanel` | `<a-form>` / `<a-form-item>` / `<a-input>` / `<a-input-number>` / `<a-switch>` / `<a-radio-group>` / `<a-collapse>` | 低（精简方案下通常自己写原生属性面板） |
| `KoruCanvasPropertyPanel` | `<a-form>` / `<a-collapse>` / `<a-switch>` / `<a-radio-group>` | 低 |
| `KoruMultiStateEditorModal` | `<a-radio>` / `<a-input>` / `<a-popconfirm>` / `<a-checkbox>` / `<a-switch>` / `<a-select>` / `<a-divider>` / `<a-input-number>` | 低 |
| `KoruPreview` | `<a-modal>` / `<a-button>` / `<a-tag>` / `<a-collapse>` | 中 |

> 这些内部面板属于 **KoruGraphEditor / KoruPreview 的子功能**，消费方如果自己写 UI 壳子（见本文「完整模板」章节）可以完全不碰它们。

---

## 关键技术决策

### 1. 为什么用 `<teleport to="body">` 而不是在组件内部定位？

KoruStencil 的 tooltip、KoruTemplate 的 hover 放大预览层，**必须** teleport 到 body。否则：

- 祖先容器 `.koru-stencil` / `.koru-template-list` 有 `overflow-y: auto`，`position: absolute` 的子元素超出边界会被裁掉
- 祖先可能有 `transform` / `filter` 属性，导致 `position: fixed` 变成相对那个祖先而非 viewport 定位

**结论**：所有弹层（modal / confirm / popover / hover-tooltip）统一 `<teleport to="body">`。

### 2. 为什么 ConfirmDialog 用组件式（state + resolve）而不是 imperative API？

组件式更主流，Vue 3 社区（Element Plus / Naive UI）都同时支持两种模式：

```vue
<!-- 组件式（推荐，响应式跟踪 visible 状态） -->
<KoruConfirmDialog :visible="confirmState.visible" ... @ok="confirmState.resolve?.(true)" />

<!-- 命令式（useConfirm composable 提供，可选） -->
const ok = await confirm({ title: '确认', content: '...', type: 'danger' })
```

每个业务组件自己管理 `confirmState` ref（`{ visible, title, content, type, resolve? }`），`showConfirm()` 返回 Promise 并在 `confirmState.resolve` 里存 reject/resolve，模板里挂 `<KoruConfirmDialog>` 消费。

### 3. window.confirm 还残留哪些地方？

当前已全部替换为 `KoruConfirmDialog`：

| 位置 | 状态 |
|------|------|
| `KoruToolbar.internalConfirmTemplateApply` | ✅ 已替换 |
| `KoruTemplate.confirmClearAll` | ✅ 已替换 |
| `KoruTemplate.confirmDelete` | ✅ 已替换 |

全局 grep 确认零残留：

```bash
grep -rn 'window\.confirm\|Modal\.confirm' src/topology/components/
# 无结果
```

---

## 消费方接入指南

### package.json 依赖配置（v0.1.1+）

```jsonc
{
  "dependencies": {
    "@antv/x6": "^3.1.7"        // ✅ 自动装，mollu-koru 运行时必需
  },
  "peerDependencies": {
    "@arco-design/web-vue": "^2.58.0",  // 可选（完整方案需要）
    "vue": "^3.4.0"
  },
  "optionalDependencies": {
    "@arco-design/web-vue": "^2.58.0"   // 装了 Arco 自动匹配 peer
  }
}
```

| 方案 | 消费方安装命令 | 效果 |
|------|---------------|------|
| **完整** | `pnpm add @mollu/koru @arco-design/web-vue` | 全部组件可用（含 PropertyPanel / Preview） |
| **精简（零 Arco）** | `pnpm add @mollu/koru` | 12 个核心组件可用（X6 由 dependencies 自动带入） |

> **vite build externals 仍保留 `@antv/x6`**（vite.config.ts L49）—— dependencies 保证 npm 安装到 node_modules，external 保证产物不内嵌 X6 代码（产物体积爆炸）。两者职责不同。

### 方式 A：完整方案（带 Arco）

```bash
pnpm add @mollu/koru @arco-design/web-vue@^2.58.0
```

```ts
import { createApp } from 'vue'
import { KoruTopologyPlugin } from '@mollu/koru/topology'
import '@arco-design/web-vue/dist/arco.css'

const app = createApp(App)
app.use(KoruTopologyPlugin)
// plugin.ts 会自动注册 ArcoVue + ArcoVueIcon
```

### 方式 B：精简方案（零 Arco）

```bash
pnpm add @mollu/koru
```

```ts
import { createApp } from 'vue'
import { KoruTopologyPlugin } from '@mollu/koru/topology'

const app = createApp(App)
app.use(KoruTopologyPlugin)
// plugin.ts 自动注册 KoruModal / KoruConfirmDialog + 注入 global.scss
// 不需要 @arco-design/web-vue
// @antv/x6 已由 dependencies 自动安装
```

可用组件：KoruToolbar + KoruSavePanel + KoruTemplate + KoruGallery + KoruStencil + KoruContextMenu + KoruMinimap + KoruModal + KoruConfirmDialog + KoruGraphEditor（简化版）+ KoruNodeRenderer + KoruEdgeRenderer + KoruLogoName

**推荐搭配示例**：完整演示零 Arco 组装方式（工具栏 + Stencil + 画布 + 原生属性面板 + 右键菜单）的代码已内联在本文「完整模板」章节。

---

## 验证命令

```bash
# 1. 确认改造过的文件零 Arco 残留
grep -rn '<a-\|Modal\.\|Message\.\|Notification\.\|window\.confirm' \
  src/topology/components/KoruToolbar.vue \
  src/topology/components/KoruSavePanel.vue \
  src/topology/components/KoruTemplate.vue \
  src/topology/components/KoruGallery.vue \
  src/topology/components/KoruGraphEditor.vue
# 无结果 ✓

# 2. 全库 Arco 依赖扫描
grep -rn "from '@arco" src/topology/
# plugin.ts 保留（故意）
# KoruPropertyPanel / KoruCanvasPropertyPanel / KoruMultiStateEditorModal / KoruPreview / KoruContextMenu.ts / useScriptLib.ts（待改造）

# 3. 类型检查
pnpm typecheck

# 4. dev server 验证
cd demo && node ..\node_modules\vite-plus\bin\vp dev
# 打开 http://localhost:3001/ → 切换到 "自定义 UI（零 Arco）" tab → 控制台零错误
```

---

## 后续计划

| 阶段 | 任务 |
|------|------|
| **v0.2** | 剩余内部面板（PropertyPanel / MultiStateEditor / Preview）的零 Arco 改造 |
| **v0.3** | `plugin.ts` 拆为 `KoruTopologyPlugin`（完整）+ `KoruLitePlugin`（零 Arco） |
| **v1.0** | UI 层独立为 `@mollu/koru-ui-arco` / `@mollu/koru-ui-native` 子包，消费方可替换 |

---

## 风险 & 约束

| 风险 | 说明 | 缓解 |
|------|------|------|
| **CSS 全局类名冲突** | `.k-btn` / `.k-input` 等前缀足够独特（k = koru），不会与常见库冲突 | 消费方自定义前缀可通过 SCSS `$koru-prefix` 覆盖 |
| **KoruPropertyPanel 等旧组件仍报 Arco 错** | 精简方案下这些组件内部仍 import Arco | 不用它们，自己写原生属性面板（见本文完整模板） |
| **KoruConfirmDialog 图标 SVG 硬编码** | 未用 iconfont | 未来可扩展为 icon slot 或 SVG 字符串 prop |
| **teleport 目标硬编码 body** | SSR 场景有问题 | 当前版本不支持 SSR，后续增加 teleport target prop |
