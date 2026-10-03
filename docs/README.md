# Mollu-Koru

> **电力组态 & 工业监控拓扑图组件库** — 开箱即用的编辑器 + 运行时绑定引擎，从画布绘制到实时数据驱动的完整链路。

如果你还没有使用过 Mollu-Koru，建议先通过 [快速上手](./quick-start) 抢先体验。

---

## ✨ 特性

- **🎨 开箱即用的编辑器** — 一套组件搞定画布绘制、节点连线、属性编辑、模板图库、撤销重做。内置 Stencil 拖拽、网格吸附、对齐辅助线、快捷键、右键菜单、Minimap 等 10+ 图编辑配套能力。

- **⚡ 运行时数据绑定** — 图纸上的节点/连线直接跟后端实时数据打通。前端配一次绑定规则（10 种可视化模板）、后端推数据，运行时自动改颜色/改文字/切状态/点动画，不用写一行 DOM 操作代码。

- **🔌 多状态 + 动画引擎** — 断路器分/合位、刀闸开/闭位等电力设备多状态节点（一个节点多张 SVG，运行时自动切换）；7 种内置动画模板（闪烁/流动/脉冲/旋转…），告警时自动点亮。

- **🧩 灵活扩展** — `registerNodeModule` / `registerEdgeModule` 注册业务专属节点；`registerPluginHooks` 注册生命周期钩子；`setComponentConfig` 全局覆盖组件行为。SVG、X6 NodeConfig、Vue 组件三种方式自定义节点样式。

- **💾 持久化 & Core Kernel** — IndexedDB 自动保存 + 自定义存储适配器，图纸换浏览器能恢复。`@mollu/koru/core` 纯 TypeScript 核心内核，不依赖 X6，Node.js 后端可直接解析和处理图纸。

- **🏗️ Vue 3 + TypeScript 原生** — 基于 AntV X6 底层引擎，向上封装为 Vue 3 Composition API 风格组件，完整类型推导，ESM + CJS + DTS 一套源码三种构建产物。

- **🪶 零 Arco 可选** — 消费方无需安装 `@arco-design/web-vue`：12 个核心组件已完成零 Arco 改造（KoruToolbar / KoruSavePanel / KoruTemplate / KoruGallery / KoruStencil / KoruContextMenu / KoruModal / KoruConfirmDialog 等），自建轻量 UI 层（`.k-btn` / `.k-input` / `.k-switch` …），完整风格对齐 Arco Design。详见 [零 Arco 迁移技术文档](./zero-arco-migration)。

---

## 🍉 文档导航

文档严格分为 **📚 文档（教程）** 和 **📖 API（检索）** 两套体系，与左侧侧边栏完全对应：

### 📚 文档（Guide — 顺序阅读）

| 阶段 | 目标 | 入口 |
|------|------|------|
| **简介** | 先建立认知：库是什么、能做什么、架构长什么样 | [简介](./README) · [架构说明](./architecture) · [功能清单](./feature-list) |
| **快速上手** | 立刻跑起来画第一张图 | [快速开始](./quick-start) |
| **基础** | 掌握画布操作 + 两个核心容器 | KoruGraphEditor · KoruPreview · 调试面板 · 全局/画布配置 · 节点连线 · SVG 自定义节点 |
| **进阶** | 学习绑定系统（库的差异化王牌）+ 电力组态特色能力 | 绑定注册表 · 10 种绑定模板 · 12 种触发器动作 · 多状态节点 · 动画系统 · 模板/图库/右键菜单 |
| **扩展** | 二次开发 + 内核定制 | Canvas Store · 持久化 · Core Kernel · 模块注册 · 插件系统 |
| **可选方案** | 零 Arco 精简方案（消费方不引 Arco） | [零 Arco 迁移技术文档](./zero-arco-migration) |

### 📖 API（Reference — 纯检索）

| 文档 | 内容 |
|------|------|
| [组件 API 完整清单](./component-api) | 15 个组件的 Props/Emits/Slots/实例方法 + 40+ 类型定义 + 工具函数签名 + 四大 Config 接口 |
| [Composables 完整索引](./composables-reference) | 15 个 composable 的内部实现、参数签名、返回值、典型用法 |

---

> **设计理念**：教程体系讲**流程、概念、场景、用法**，适合顺序学习；API 体系讲**参数、类型、签名、返回值**，适合日常开发快速查阅。两套体系完全独立，互不重复。

---

## 📦 包结构

```
@mollu/koru
├── 根入口 (index)
│   ├── 核心内核、几何工具、渲染抽象
│   ├── 类型定义（KoruNodeData / KoruEdgeData / BindingRule ...）
│   └── 全局配置（setComponentConfig / setBindingConfig / setMultiStateConfig / setDeviceConfig）
│
├── @mollu/koru/topology
│   ├── KoruGraphEditor    编辑器主组件（编辑模式）
│   ├── KoruPreview        预览组件（只读模式）
│   ├── KoruToolbar        工具栏
│   ├── KoruStencil        元件拖拽面板
│   ├── KoruPropertyPanel  属性面板（右侧）
│   ├── KoruMinimap        小地图
│   ├── KoruContextMenu    右键菜单
│   ├── KoruGallery        图库
│   └── ...                更多面板、弹窗、工具
│
├── @mollu/koru/plugins/flow    流程图插件（6 种节点）
└── @mollu/koru/core           Core Kernel（纯 TS，不依赖 X6，Node.js 可用）
```

---

## 🛠️ 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Vue 3.4+ / TypeScript 5+ |
| 底层图编辑引擎 | @antv/x6 v3 |
| UI 组件库 | **@arco-design/web-vue v2.58+（可选）** — 12 个核心组件已完成零 Arco 改造，消费方无需安装即可使用 |
| 构建 | Vite Library Mode（ESM + CJS + DTS，一套源码三种产物） |

---

## ❤️ 如何交流

如果您有任何的问题、建议、反馈或者交流意愿，可以通过如下方式联系我们：

- **官方推荐：** [GitHub Issues](https://github.com/mollu-design/mollu-koru/issues)  — 提 bug、提功能需求、讨论实现方案
- **功能反馈：** 在 Issues 里带上最小复现（一段代码 + 一张截图），会大幅加快问题定位
- **设计讨论：** 复杂的架构设计或技术选型建议，先开一个 Discussion 再开 Issue

> ⚠️ 项目正在快速迭代，文档和代码可能不同步。如发现文档错误，欢迎提 Issue 或直接 PR 修正。

---

## 🤝 参与贡献

欢迎任何形式的贡献！包括但不限于：代码提交、文档修正、Bug 反馈、功能建议、使用案例分享。

### Bugs

如果你在使用过程中碰到问题，请先通过 GitHub Issues 搜索有没有类似的 bug 或建议。在报告 bug 之前，请确保：

1. 已搜索过已有的 Issues（包括已关闭的）
2. 阅读了相关文档章节（特别是 [组件 API 完整清单](./component-api) 的参数说明）
3. 提供了**最小复现**（一段代码片段 + 预期行为 + 实际行为 + 截图）

### 如何贡献代码

```bash
# 1. Fork 本仓库到你的 GitHub
# 2. Clone 你 fork 的仓库
git clone https://github.com/your-name/mollu-koru.git
cd mollu-koru

# 3. 创建特性分支
git checkout -b feature/your-feature-name

# 4. 提交你的改动
git commit -m "feat: add xxx feature"

# 5. 推送到你的仓库
git push origin feature/your-feature-name

# 6. 发起 Pull Request
```

### 贡献清单

- [ ] 代码必须通过 TypeScript 类型检查（`pnpm typecheck`）
- [ ] 新功能必须在文档中补充使用说明
- [ ] 修改 Props / Emits 等公开 API 时，同步更新 [组件 API 完整清单](./component-api)
- [ ] SVG 自定义节点需附完整图形文件（放到 `packages/mollu-koru/src/assets/symbols/`）

---

## 📄 License

[MIT](https://opensource.org/licenses/MIT)
