<template>
  <KoruModal
    :visible="visible"
    title="保存"
    :width="520"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @cancel="handleClose"
  >
    <div class="koru-save-panel">
      <!-- 保存到本地 -->
      <div class="koru-save-section">
        <div class="koru-save-section-title">保存数据</div>
        <p class="koru-save-desc">将当前画布数据保存到本地浏览器存储，刷新页面后可从本地恢复。</p>
        <div class="koru-save-form-item">
          <label class="koru-save-form-label">图纸名称</label>
          <input
            v-model="diagramName"
            class="k-input k-input--lg"
            type="text"
            :placeholder="diagramPlaceholder"
            :maxlength="50"
            :disabled="!hasCanvasContent || saving"
          />
          <span class="k-input-word-limit">{{ diagramName.length }}/50</span>
        </div>
        <div class="koru-save-actions">
          <button
            class="k-btn k-btn--primary k-btn--lg"
            :disabled="!hasCanvasContent || saving"
            @click="handleSave"
          >
            {{ saving ? '保存中...' : '保存设计图' }}
          </button>
          <button v-if="hasLocalData" class="k-btn k-btn--lg" :disabled="restoring" @click="handleRestore">
            {{ restoring ? '恢复中...' : '从本地恢复' }}
          </button>
          <button
            v-if="hasLocalData"
            class="k-btn k-btn--danger k-btn--lg"
            :disabled="clearing"
            @click="handleClear"
          >
            {{ clearing ? '清除中...' : '清空本地数据' }}
          </button>
        </div>
      </div>

      <hr class="k-divider" />

      <!-- 另存为模板 -->
      <div class="koru-save-section">
        <div class="koru-save-section-title">另存为模板</div>
        <p class="koru-save-desc">保存后将在左侧「我的模板」分组中显示，可拖拽到画布使用。</p>
        <div class="koru-save-template-form">
          <input
            v-model="templateName"
            class="k-input k-input--lg"
            type="text"
            placeholder="请输入模板名称"
            :maxlength="50"
            @keyup.enter="handleSaveAsTemplate"
            :disabled="!hasCanvasContent || saving"
          />
          <span class="k-input-word-limit">{{ templateName.length }}/50</span>
          <button
            class="k-btn k-btn--primary k-btn--lg"
            :disabled="!templateName.trim() || !hasCanvasContent"
            @click="handleSaveAsTemplate"
          >
            保存为模板
          </button>
        </div>
      </div>

      <!-- 空画布提示 -->
      <div
        v-if="visible && !hasCanvasContent"
        class="k-alert k-alert--warning koru-save-empty-hint"
      >
        画布为空，请先添加图元后再保存
      </div>

      <!-- 自动保存提示 -->
      <div
        v-if="autoSaveEnabled"
        class="k-alert k-alert--info koru-save-autosave-hint"
      >
        自动保存已开启，画布变更将在 {{ autoSaveDebounceMs }}ms 后自动保存
      </div>
    </div>
  </KoruModal>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, type Ref } from 'vue'
import type { Graph } from '@antv/x6'
import KoruModal from './KoruModal.vue'
import { useCanvasStore } from '../stores/canvasStore'
import { dbGet, dbSet, dbRemove } from '../utils/storage'
import { serializeKoruCanvasConfig, deserializeKoruCanvasConfig } from '../types'
import { applyKoruCanvasConfig } from '../composables/useKoruCanvasConfig'
import { collectBindingRegistry } from '../composables/useBindingRegistry'

const SAVE_KEY = 'koru-diagram-data'

const props = withDefaults(
  defineProps<{
    visible: boolean
    graphRef?: Ref<Graph | null>
    autoSaveEnabled?: boolean
    autoSaveDebounceMs?: number
    /** 默认图纸名称（弹窗打开时预填） */
    defaultName?: string
    /** 图纸名称输入框 placeholder */
    diagramPlaceholder?: string
  }>(),
  {
    autoSaveEnabled: false,
    autoSaveDebounceMs: 1500,
    defaultName: '',
    diagramPlaceholder: '留空则自动使用默认图纸名称',
  },
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save', data: { diagramData: any; bindingRegistry: any[]; name: string }): void
  (e: 'saveTemplate', name: string): void
  (e: 'restore', data: any): void
}>()

const store = useCanvasStore()
const x6GraphRef = store.x6GraphRef
const saving = ref(false)
const restoring = ref(false)
const clearing = ref(false)
const hasLocalData = ref(false)
const templateName = ref('')
const diagramName = ref('')

function getGraph(): Graph | null {
  return props.graphRef?.value || x6GraphRef?.value || null
}

/** 判断画布是否为空（无任何节点和边） */
function isGraphEmpty(): boolean {
  const graph = getGraph()
  if (!graph) return true
  const cells = graph.getCells?.() || []
  return cells.length === 0
}

/** 画布是否有内容（弹窗打开时快照） */
const hasCanvasContent = ref(false)

/** 刷新画布内容状态 */
function refreshCanvasContent() {
  hasCanvasContent.value = !isGraphEmpty()
}

async function checkLocalData() {
  const raw = await dbGet(SAVE_KEY)
  hasLocalData.value = !!raw
}

const handleClose = () => {
  emit('update:visible', false)
}

const handleSave = async () => {
  const graph = getGraph()
  if (!graph) return
  if (isGraphEmpty()) {
    console.warn('[KoruSavePanel] 画布为空，请先添加图元后再保存')
    return
  }
  saving.value = true
  try {
    const diagramData = {
      cells: graph.toJSON().cells || [],
      canvas: serializeKoruCanvasConfig(store.canvasConfig.value!),
    }
    // 采集绑定注册表，供后端接收 / WS 订阅依据
    const bindingRegistry = collectBindingRegistry(graph)
    await dbSet(SAVE_KEY, JSON.stringify(diagramData))
    hasLocalData.value = true
    const finalName = diagramName.value.trim() || props.defaultName || '未命名图纸'
    emit('save', { diagramData, bindingRegistry, name: finalName })
    handleClose()
  } catch (e) {
    console.error('保存失败', e)
  } finally {
    saving.value = false
  }
}

const handleRestore = async () => {
  restoring.value = true
  try {
    const raw = await dbGet(SAVE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    const graph = getGraph()
    if (graph) {
      graph.fromJSON({ cells: data.cells || [] })
    }
    // 恢复画布配置
    if (data.canvas) {
      const restored = deserializeKoruCanvasConfig(data.canvas)
      store.canvasConfig.value = { ...restored }
      if (graph) {
        applyKoruCanvasConfig(graph, restored)
      }
    }
    emit('restore', data)
    handleClose()
  } catch (e) {
    console.error('恢复失败', e)
  } finally {
    restoring.value = false
  }
}

const handleClear = async () => {
  clearing.value = true
  try {
    await dbRemove(SAVE_KEY)
    hasLocalData.value = false
    handleClose()
  } catch (e) {
    console.error('清空失败', e)
  } finally {
    clearing.value = false
  }
}

const handleSaveAsTemplate = () => {
  const name = templateName.value.trim()
  if (!name) return
  if (isGraphEmpty()) {
    console.warn('[KoruSavePanel] 画布为空，无法保存为模板')
    return
  }
  emit('saveTemplate', name)
  templateName.value = ''
  handleClose()
}

onMounted(() => {
  checkLocalData()
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      checkLocalData()
      refreshCanvasContent()
      diagramName.value = props.defaultName || ''
    }
  },
)
</script>

<style scoped>
.koru-save-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.koru-save-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.koru-save-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d2129;
}

.koru-save-desc {
  font-size: 13px;
  color: #86909c;
  margin: 0;
  line-height: 1.5;
}

.koru-save-form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.koru-save-form-label {
  font-size: 12px;
  color: #4e5969;
  font-weight: 500;
}

.koru-save-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.koru-save-template-form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.koru-save-template-form .k-input {
  flex: 1;
  min-width: 0;
}

.koru-save-empty-hint {
  margin-top: 8px;
}

.koru-save-autosave-hint {
  margin-top: 8px;
}
</style>
