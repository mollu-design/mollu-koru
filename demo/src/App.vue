<template>
  <div class="app">
    <header class="app-header">
      <h1>@mollu/koru Demo</h1>
      <nav class="app-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['app-nav__btn', { 'app-nav__btn--active': activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </header>
    <main class="app-main">
      <EditModeDemo v-if="activeTab === 'edit'" />
      <PreviewModeDemo v-if="activeTab === 'preview'" />
      <GlobalRegisterDemo v-if="activeTab === 'global'" />
      <CustomUIDemo v-if="activeTab === 'custom'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import EditModeDemo from './EditModeDemo.vue'
import PreviewModeDemo from './PreviewModeDemo.vue'
import GlobalRegisterDemo from './GlobalRegisterDemo.vue'
import CustomUIDemo from './CustomUIDemo.vue'

const activeTab = ref('edit')
const tabs = [
  { id: 'edit', label: '编辑模式' },
  { id: 'preview', label: '预览模式' },
  { id: 'global', label: '全局注册' },
  { id: 'custom', label: '自定义 UI（零 Arco）' },
]
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}
.app-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  z-index: 10;
}
.app-header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}
.app-nav {
  display: flex;
  gap: 4px;
}
.app-nav__btn {
  padding: 6px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #666;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.app-nav__btn:hover {
  color: #1890ff;
  border-color: #1890ff;
}
.app-nav__btn--active {
  color: #fff;
  background: #1890ff;
  border-color: #1890ff;
}
.app-nav__btn--active:hover {
  background: #1890ff;
  color: #fff;
}
.app-nav__btn--active:focus {
  outline: none;
}
.app-nav__btn--active:active {
  background: #1469a7;
}
.app-nav__btn--active:active {
  background: #1469a7;
}
.app-main {
  flex: 1;
  overflow: hidden;
}
</style>
