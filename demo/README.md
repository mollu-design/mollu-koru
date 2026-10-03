# @mollu/koru Demo

Koru 组件库的可视化演示项目，用 Vite + Vue 3 + TypeScript 构建。

## 启动

```bash
# 1. 回到 mollu-koru 目录安装依赖
cd mollu-koru
pnpm install

# 2. 开发期监听编译（库文件变更时自动重编译）
pnpm dev

# 3. 另开一个终端启动 Demo 站点
pnpm dev:demo

# 或者只跑 Demo（库文件需先 build 过）
cd demo
pnpm dev
```

## Demo 页面

Demo 有三个 tab：

| Tab | 对应文件 | 说明 |
|-----|---------|------|
| 编辑模式 | `EditModeDemo.vue` | 完整编辑器：Stencil 拖拽、属性面板、绑定面板、保存/预览、绑定注册表工具 API 演示 |
| 预览模式 | `PreviewModeDemo.vue` | 只读预览器：`setBindingConfig` 实时数据源对接、绑定测试面板、设备高亮、告警事件 |
| 全局注册 | `GlobalRegisterDemo.vue` | 通过 `KoruTopologyPlugin` 全局注册，在任何模板直接使用组件 |

## 构建生产包

```bash
cd mollu-koru
pnpm build       # 输出 dist/
```
