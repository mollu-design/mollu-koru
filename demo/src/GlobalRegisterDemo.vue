<template>
  <div class="demo-simple">
    <div class="demo-toolbar">
      <div class="demo-info">
        <span class="demo-badge demo-badge--edit">全局注册 + 组合使用</span>
      </div>
    </div>
    <div class="demo-canvas-wrapper">
      <!-- 使用全局注册的组件，无需 import -->
      <koru-graph-editor v-model:graph="graphData" mode="edit">
        <template #toolbar>
          <koru-toolbar />
        </template>
        <template #property-panel>
          <koru-property-panel />
        </template>
      </koru-graph-editor>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createDefaultNode, createDefaultEdge, uid } from '@mollu/koru/topology'
import type { KoruGraphData } from '@mollu/koru/topology'

const graphData = ref<KoruGraphData>({
  nodes: [],
  edges: [],
})

onMounted(() => {
  // 构建一个简单的流程图
  const labels = ['需求分析', '系统设计', '编码实现', '测试验证', '部署上线']
  const nodes = labels.map((label, i) => createDefaultNode(uid('node'), 120, 60 + i * 100, label))
  graphData.value.nodes.push(...nodes)

  for (let i = 0; i < nodes.length - 1; i++) {
    const edge = createDefaultEdge(uid('edge'), nodes[i].id, nodes[i + 1].id, `→`)
    graphData.value.edges.push(edge)
  }
})
</script>

<style scoped>
.demo-simple {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.demo-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}
.demo-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #666;
}
.demo-badge {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}
.demo-badge--edit {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}
.demo-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
