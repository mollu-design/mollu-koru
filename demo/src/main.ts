import { createApp } from 'vue'
import { KoruTopologyPlugin } from '@mollu/koru/topology'
import App from './App.vue'

const app = createApp(App)

// 全局注册所有 Koru 组件（KoruGraphEditor, KoruToolbar, KoruMinimap 等）
// 自动注册 arco-design 组件
app.use(KoruTopologyPlugin)

app.mount('#app')
