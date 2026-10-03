import type { App } from 'vue'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
// 额外引入图标库
import ArcoVueIcon from '@arco-design/web-vue/es/icon'
// 全局样式
import '../style/reset.scss'
import '../style/variables.scss'
import '../style/global.scss'
import '../style/anim.scss'
import { registerBasicShapes } from './presets'
import {
  KoruGraphEditor,
  KoruToolbar,
  KoruMinimap,
  KoruContextMenu,
  KoruPropertyPanel,
} from './components'

/**
 * Vue 全局注册插件
 * 自动注册 arco-design 组件、Koru 组件和基础节点形状
 */
export const KoruTopologyPlugin = {
  install(app: App): void {
    // 运行时检查 @antv/x6 依赖是否已安装
    // 未安装时输出清晰提示，避免消费方遇到晦涩的模块解析错误
    import('@antv/x6')
      .then(() => {
        // 注册基础节点形状（custom-rect、custom-circle、custom-text 等）
        registerBasicShapes()
      })
      .catch(() => {
        console.error(
          '[Koru-Topology] 缺少依赖：@antv/x6 未安装。\n' +
            '请执行：pnpm add @antv/x6@^3.1.7\n' +
            '或执行：npm install @antv/x6@^3.1.7',
        )
      })

    // 注册 arco-design 组件
    app.use(ArcoVue)
    // 注册图标库
    app.use(ArcoVueIcon)

    // 注册 Koru 组件
    app.component('KoruGraphEditor', KoruGraphEditor)
    app.component('KoruToolbar', KoruToolbar)
    app.component('KoruMinimap', KoruMinimap)
    app.component('KoruContextMenu', KoruContextMenu)
    app.component('KoruPropertyPanel', KoruPropertyPanel)
  },
}
