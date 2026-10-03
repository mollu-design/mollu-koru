<template>
  <div class="koru-test-tools">
    <!-- 绑定数据注入 -->
    <div class="test-bar">
      <span class="test-label" style="color: #165dff">绑定数据</span>
      <a-input
        v-model="bindingInputCellId"
        size="medium"
        placeholder="图元ID"
        style="width: 140px"
      />
      <a-input
        v-model="bindingInputDevice"
        size="medium"
        placeholder="设备名"
        style="width: 90px"
      />
      <a-input v-model="bindingInputPoint" size="medium" placeholder="测点名" style="width: 90px" />
      <a-input
        v-model="bindingInputValue"
        size="medium"
        placeholder="值"
        style="width: 100px"
        @press-enter="handleSetBindingValue"
      />
      <a-button size="medium" type="primary" @click="handleSetBindingValue">设置值</a-button>
      <span v-if="bindingStatus" class="test-status">{{ bindingStatus }}</span>
    </div>

    <!-- 绑定测试 -->
    <div class="test-bar">
      <span class="test-label">绑定测试</span>
      <a-input
        v-model="testTagValue"
        size="medium"
        placeholder="测点值，如 120 或 #18c1e2"
        style="width: 280px"
        @press-enter="handleBindingTest"
      />
      <a-button size="medium" type="primary" @click="handleBindingTest">执行绑定测试</a-button>
      <pre v-if="testReport" class="test-report">{{ testReport }}</pre>
    </div>

    <!-- 映射规则测试 -->
    <div class="test-bar">
      <span class="test-label" style="color: #722ed1">映射规则测试</span>
      <a-button size="medium" type="primary" @click="mappingTestVisible = true">
        打开映射测试
      </a-button>
      <KoruMappingTestModal
        :graph="graph"
        :binding-values="bindingValues"
        :visible="mappingTestVisible"
        @update:visible="mappingTestVisible = $event"
      />
    </div>

    <!-- 多状态元件测试 -->
    <div class="test-bar">
      <span class="test-label" style="color: #ff7d00">多状态测试</span>
      <a-input
        v-model="testMultiStateValue"
        size="medium"
        placeholder="模拟测点值，如 1 / 0 / 2"
        style="width: 180px"
        @press-enter="handleMultiStateTest"
      />
      <a-button type="primary" size="medium" @click="handleMultiStateTest">测试状态切换</a-button>
      <a-button
        type="primary"
        size="medium"
        @click="restoreAllMultiState"
        v-if="multiStateParents.length"
      >
        全部恢复
      </a-button>
      <pre v-if="multiStateTestReport" class="test-report">{{ multiStateTestReport }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import KoruMappingTestModal from './KoruMappingTestModal.vue'
import { useCanvasStore } from '../../stores/canvasStore'
import {
  findMultiStateParents,
  applyMultiStateByPoint,
  applyMultiStateVisibility,
} from '../../composables/useMultiState'

const props = defineProps<{
  graph: any
  pauseMultiState?: () => void
  resumeMultiState?: () => void
}>()

const store = useCanvasStore()

const bindingValues = computed(() => store.bindingConfig.values)

// ============ 绑定数据注入 ============

const bindingInputCellId = ref('')
const bindingInputDevice = ref('')
const bindingInputPoint = ref('')
const bindingInputValue = ref('')
const bindingStatus = ref('')

const handleSetBindingValue = () => {
  const cellId = bindingInputCellId.value.trim()
  const device = bindingInputDevice.value.trim()
  const point = bindingInputPoint.value.trim()
  const raw = bindingInputValue.value.trim()
  if (!cellId || !device || !point || !raw) {
    bindingStatus.value = '请填写完整信息'
    return
  }
  let val: string | number
  if (!Number.isNaN(Number(raw)) && raw !== '') val = Number(raw)
  else val = raw
  store.bindingConfig.setValue(cellId, device, point, val)
  store.bindingConfig.tick()
  bindingStatus.value = `已设置 ${cellId}:${device}:${point} = ${val}`
  setTimeout(() => (bindingStatus.value = ''), 3000)
}

// ============ 绑定测试 ============

const testTagValue = ref('')
const testReport = ref('')

const handleBindingTest = () => {
  const g = props.graph
  if (!g) {
    testReport.value = '画布未就绪'
    return
  }
  const raw = testTagValue.value.trim()
  if (raw === '') {
    testReport.value = '请先输入测试的测点值'
    return
  }
  let val: string | number
  if (!Number.isNaN(Number(raw)) && raw !== '') val = Number(raw)
  else val = raw

  const report = store.bindingConfig.runTest(val)
  if (report.length === 0) {
    testReport.value = '未找到任何启用的绑定/触发器'
    return
  }
  const lines = report.map((r: any) => {
    const target = r.targetProperty ? `→${r.targetProperty}` : ''
    const cond = `${r.operator ?? '?'} ${String(r.compareValue ?? '')}`
    return (
      `节点[${String(r.cellId ?? '').slice(0, 8)}] ${target} 条件(${cond}) ` +
      `命中=${r.matched} 行为=${r.actionLabel ?? '-'}`
    )
  })
  testReport.value =
    `注入值=${JSON.stringify(val)}\n` +
    lines.join('\n') +
    '\n提示：once_change(状态跳变)模式下，条件首次命中即执行。'
}

// ============ 映射规则测试 ============

const mappingTestVisible = ref(false)

// ============ 多状态元件测试 ============

const testMultiStateValue = ref('')
const multiStateTestReport = ref('')
const multiStateSnapshot = new Map<string, string>()

const multiStateParents = computed<any[]>(() => {
  return findMultiStateParents(props.graph)
})

const handleMultiStateTest = () => {
  const g = props.graph
  if (!g) {
    multiStateTestReport.value = '画布未就绪'
    return
  }
  const parents = multiStateParents.value
  if (!parents.length) {
    multiStateTestReport.value = '画布中未找到任何多状态元件'
    return
  }

  const raw = testMultiStateValue.value.trim()
  if (raw === '') {
    multiStateTestReport.value = '请先输入模拟测点值'
    return
  }
  let val: string | number
  if (!Number.isNaN(Number(raw)) && raw !== '') val = Number(raw)
  else val = raw

  // 暂停 executor Phase 1，防止轮询覆盖手动测试结果
  props.pauseMultiState?.()

  // 记录快照
  multiStateSnapshot.clear()
  for (const p of parents) {
    const id = p.getData?.()?.activeStateId || ''
    multiStateSnapshot.set(p.id, id)
  }

  const lines: string[] = []
  parents.forEach((p: any) => {
    const data = p.getData?.() || {}
    const stateName = (stId: string) =>
      (data.stateList || []).find((s: any) => s.stateId === stId)?.stateName || stId
    const before = data.activeStateId
    applyMultiStateByPoint(g, p, val)
    const after = p.getData?.()?.activeStateId || before
    const changed = before !== after
    lines.push(
      `多状态元件[${(p.id || '').slice(0, 8)}] 测点=${JSON.stringify(val)} ` +
        `状态：${stateName(before)} → ${stateName(after)}${changed ? ' （已切换）' : ''}`,
    )
  })
  multiStateTestReport.value = lines.join('\n')
}

const restoreAllMultiState = () => {
  for (const p of multiStateParents.value) {
    const original = multiStateSnapshot.get(p.id)
    if (original === undefined) continue
    const data = p.getData?.() || {}
    data.activeStateId = original
    p.setData?.({ ...data }, { overwrite: true })
    applyMultiStateVisibility(props.graph, p)
  }
  multiStateTestReport.value = '已恢复所有多状态元件到初始状态'
  // 恢复 executor Phase 1
  props.resumeMultiState?.()
}

onBeforeUnmount(() => {
  restoreAllMultiState()
})
</script>

<style scoped>
.koru-test-tools {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.test-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}
.test-label {
  font-size: 12px;
  font-weight: 600;
  min-width: 60px;
  color: var(--color-text-2);
}
.test-report {
  width: 100%;
  margin: 4px 0 0 0;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  max-height: 200px;
  overflow: auto;
}
.test-status {
  font-size: 12px;
  color: var(--color-text-3);
}
</style>
