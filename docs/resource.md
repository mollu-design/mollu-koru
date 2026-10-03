# 资源

> 所有资源开源在 GitHub，欢迎提交补充。如果您有想推荐的模板、工具或文章，请在 [Issues](https://github.com/mollu-design/mollu-design/issues) 里提。

---

## 电气符号 SVG 包

严格遵循 **国网 35kV / 110kV / 220kV 电气主接线图符号标准**，可直接用于 mollu-koru 的 `registerSvgGlob`，也可单独用在任何设计工具或前端项目中。

### 单状态符号（29 个）

适用于不需要表达分合状态的场景（如主接线图、系统图）：

| 类别 | 符号 |
|------|------|
| **开关类** | 断路器、隔离开关、接地刀闸、负荷开关、跌落式熔断器、抽屉开关、低压抽屉式开关 |
| **互感器类** | 电压互感器、电流互感器、互感器 |
| **设备类** | 变压器、电动机、补偿器、电阻、实心电阻、电容、避雷针、带电显示器 |
| **仪表类** | 电流表、电压表 |
| **连接类** | 接地、等电位、交流-直流、上抽出 |
| **基础图形** | 长方形、正方形、三角形、圆形、图形 |

[浏览全部 29 个 SVG →](https://github.com/mollu-design/mollu-design/tree/main/assets/koru-electrical-single)

### 多状态符号（12 个）

每个设备提供 Open（分位）/ Close（合位）两个状态版本，用于实时拓扑图的动态展示：

| 设备 | 分位 | 合位 |
|------|------|------|
| 断路器 | CircuitBreakerOpen | CircuitBreakerClose |
| 隔离开关 | IsolatorOpen | IsolatorClose |
| 接地刀闸 | GroundSwitchOpen | GroundSwitchClose |
| 负荷开关 | LoadSwitchOpen | LoadSwitchClose |
| 跌落式熔断器 | DropOutFuseOpen | DropOutFuseClose |
| 低压抽屉式开关 | LVDrawerSwitchOpen | LVDrawerSwitchClose |

[浏览全部 12 个 SVG →](https://github.com/mollu-design/mollu-design/tree/main/assets/koru-electrical-switch)

### 快速集成

```ts
// main.ts 或 koruBootstrap.ts
import { registerSvgGlob } from '@mollu/koru/topology'

registerSvgGlob(import.meta.glob('@/assets/koru/**/*.svg', {
  query: '?raw', import: 'default', eager: true,
}))
```

> **完整用法 + glob 三选项说明**：参见 [SVG 自定义节点](./svg-custom-nodes.md)

---

## 业务示例项目

### PowerSubstation-Assistant

基于 mollu-koru + Vue 3 + Spring Boot 的**变电站智能运维一体化平台**，包含完整的拓扑编辑器集成、实时数据绑定、LLM 智能问答。

- 仓库：`PowerSubstation-Assistant/`（`mollu-design` monorepo 内）
- 前端技术栈：Vue 3.4 + Vite 5 + Pinia + Arco Design + mollu-koru
- 后端技术栈：Spring Boot 3 + MyBatis-Plus + MySQL + Redis
- 核心亮点：拓扑图 ↔ 实时测点双向绑定、LLM 多 Provider 配置、设备台账管理

[浏览 README →](https://github.com/mollu-design/mollu-design/tree/main/PowerSubstation-Assistant)

---

## 设计模板

### 零 Arco 自定义 UI 模板

完整展示 mollu-koru 精简方案的 UI 搭建方式——不装 `@arco-design/web-vue`，只用 12 个零 Arco 组件 + 原生 HTML/CSS 搭一个编辑器界面。

```vue
<script setup lang="ts">
import { useKoruGraphEditor, useCanvasStore, KoruToolbar, KoruStencil } from '@mollu/koru/topology'
const editor = useKoruGraphEditor({ mode: 'edit' })
</script>
```

**要点速查**：
- `useKoruGraphEditor.init()` 需手动传 DOM 元素
- `store.x6GraphRef.value` 需手动赋 graph 实例
- 属性面板自己写原生 HTML（或用 Arco Form，如果装了）

[查看完整模板 →](./zero-arco-migration.md)

### 可视化绑定模板（10 种）

针对电力系统常见场景的绑定模板，开箱即用：

| 模板 | 适用场景 |
|------|---------|
| 测点数值绑定 | 节点 label 显示实时电流/电压值 |
| 分合状态绑定 | 断路器 SVG 随测点值切换 Open/Close |
| 告警闪烁绑定 | 测点超限后节点边框闪烁 |
| 颜色映射绑定 | 节点背景色随数值变化（正常/告警/故障） |
| 动画触发绑定 | 测点触发后播放电流流动动画 |
| 设备台账绑定 | 点击节点弹出设备详情面板 |
| 历史曲线绑定 | 右键查看测点历史曲线 |
| 批量写入绑定 | 写入接口 + 多测点批量下发 |
| 指令触发绑定 | 右键菜单触发分合指令 |
| 公式计算绑定 | 多测点公式计算后显示 |

[查看模板详情 →](./binding-templates.md)

---

## 周边资源

### 组件库 npm 包

```bash
pnpm add @mollu/koru
```

| 包 | 版本 | 说明 |
|---|---|---|
| `@mollu/koru` | latest | 完整包（含 X6 依赖） |
| `@antv/x6` | ^3.1.7 | mollu-koru 核心依赖，消费方不需要单独装 |

### 文档站

VitePress 静态站，包含全部 Guide + API 参考：
- **本地运行**：`cd docs-portal && pnpm dev`
- **源码位置**：`mollu-design/docs-portal/`（md 文件通过 NTFS 硬链接同步自 `mollu-koru/docs/`）

---

## 贡献资源

如果你有 mollu-koru 相关的：
- 自定义 SVG 符号集
- Stencil 分组预设
- 完整业务案例
- 技术博客或教程

欢迎在 GitHub Issues 提交 PR 或链接，审核后会在这里收录。
