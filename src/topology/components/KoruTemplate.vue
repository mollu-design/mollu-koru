<template>
  <KoruModal
    :visible="visible"
    title="模板管理"
    :width="720"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @cancel="handleCancel"
  >
    <div class="koru-template-body">
      <div class="koru-template-header">
        <span class="koru-template-count">
          共 {{ displayTemplates.length }} 个模板
          <span v-if="sourceType !== 'local'" class="koru-template-source">
            （{{ sourceType === 'external' ? '外部数据' : '接口数据' }}）
          </span>
        </span>
        <div class="koru-template-actions">
          <button class="k-btn k-btn--sm" :disabled="fetching" @click="handleRefresh">
            {{ fetching ? '加载中...' : '刷新' }}
          </button>
          <button
            v-if="canClear"
            class="k-btn k-btn--sm k-btn--danger"
            :disabled="displayTemplates.length === 0"
            @click="confirmClearAll"
          >
            清空全部
          </button>
        </div>
      </div>

      <div v-if="!fetching && displayTemplates.length === 0" class="k-empty">
        {{ emptyText }}
      </div>

      <div v-else class="koru-template-list">
        <div
          v-for="(tpl, index) in displayTemplates"
          :key="tpl.name + '_' + index"
          class="koru-template-item"
        >
          <div
            class="koru-template-thumb"
            @mouseenter="(e: MouseEvent) => onThumbEnter(e, tpl)"
            @mouseleave="onThumbLeave"
          >
            <img
              v-if="tpl.thumbnail"
              :src="tpl.thumbnail"
              :alt="tpl.name"
            />
            <span v-else>{{ tpl.name.slice(0, 1) }}</span>
          </div>
          <div class="koru-template-info">
            <input
              v-if="editingIndex === index"
              v-model="editingName"
              class="k-input k-input--sm"
              type="text"
              size="small"
              @press-enter="confirmRename"
              @blur="confirmRename"
            />
            <span v-else class="koru-template-name">{{ tpl.name }}</span>
          </div>
          <div class="koru-template-actions-btns">
            <button class="k-btn k-btn--xs k-btn--primary" @click="applyTemplate(tpl)">应用</button>
            <button class="k-btn k-btn--xs" :disabled="isReadonly" @click="startRename(index, tpl.name)">
              重命名
            </button>
            <button
              v-if="!isReadonly"
              class="k-btn k-btn--xs k-btn--danger"
              @click="confirmDelete(index)"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- teleport 到 body 的放大预览（不受父容器 overflow 限制） -->
    <teleport to="body">
      <Transition name="koru-template-preview-fade">
        <div
          v-if="hoveredTpl && hoveredTpl.thumbnail"
          class="koru-template-preview"
          :style="previewStyle"
        >
          <img :src="hoveredTpl.thumbnail" :alt="hoveredTpl.name" />
        </div>
      </Transition>
    </teleport>

    <!-- 确认弹窗（teleport to body，不受 KoruModal 遮挡） -->
    <koru-confirm-dialog
      :visible="confirmState.visible"
      :title="confirmState.title"
      :content="confirmState.content"
      :type="confirmState.type"
      :ok-text="confirmState.okText"
      @update:visible="(v: boolean) => confirmState.visible = v"
      @ok="confirmState.resolve?.(true)"
      @cancel="confirmState.resolve?.(false)"
    />
  </KoruModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import KoruModal from './KoruModal.vue'
import KoruConfirmDialog from './KoruConfirmDialog.vue'
import { dbGet, dbSet } from '../utils/storage'

export interface TemplateItem {
  name: string
  data: any
  thumbnail?: string
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    externalTemplates?: TemplateItem[]
    fetchTemplates?: () => Promise<TemplateItem[]>
    useExternal?: boolean
    editableExternal?: boolean
  }>(),
  {
    externalTemplates: () => [],
    fetchTemplates: undefined,
    useExternal: false,
    editableExternal: false,
  },
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'apply', tpl: TemplateItem): void
  (e: 'change', templates: TemplateItem[]): void
  /** 模板事件：统一对外分发，组件内部已完成 IndexedDB 操作 */
  (e: 'template', payload: { action: 'save' | 'delete' | 'clear'; template?: TemplateItem; templates?: TemplateItem[] }): void
}>()

const LOCAL_KEY = 'koru-templates'
const localTemplates = ref<TemplateItem[]>([])
const fetching = ref(false)
const editingIndex = ref(-1)
const editingName = ref('')

// hover 放大预览状态
const hoveredTpl = ref<TemplateItem | null>(null)
const previewPos = ref({ left: 0, top: 0 })

// 通用确认弹窗状态
const confirmState = ref<{
  visible: boolean
  title: string
  content: string
  type: 'info' | 'warning' | 'danger'
  okText: string
  resolve: ((ok: boolean) => void) | null
}>({
  visible: false,
  title: '',
  content: '',
  type: 'info',
  okText: '确定',
  resolve: null,
})

function showConfirm(opts: {
  title: string
  content: string
  type?: 'info' | 'warning' | 'danger'
  okText?: string
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmState.value = {
      visible: true,
      title: opts.title,
      content: opts.content,
      type: opts.type || 'info',
      okText: opts.okText || '确定',
      resolve,
    }
  })
}

const sourceType = computed<'local' | 'external' | 'api'>(() => {
  if (props.useExternal && props.externalTemplates && props.externalTemplates.length > 0) {
    return 'external'
  }
  if (props.useExternal && props.fetchTemplates) {
    return 'api'
  }
  return 'local'
})

const displayTemplates = computed<TemplateItem[]>(() => {
  if (sourceType.value === 'local') return localTemplates.value
  return props.externalTemplates || []
})

const isReadonly = computed(() => {
  if (sourceType.value === 'local') return false
  return !props.editableExternal
})

const canClear = computed(() => sourceType.value === 'local')

const emptyText = computed(() => {
  if (fetching.value) return ''
  if (sourceType.value === 'external') return '暂无外部模板数据'
  if (sourceType.value === 'api') return '接口未返回模板数据'
  return '暂无模板，可在保存时「保存为模板」'
})

// teleport 预览：固定定位，防边界溢出
const PREVIEW_SIZE = 220
const previewStyle = computed(() => ({
  left: previewPos.value.left + 'px',
  top: previewPos.value.top + 'px',
}))

function onThumbEnter(e: MouseEvent, tpl: TemplateItem) {
  if (!tpl.thumbnail) return
  hoveredTpl.value = tpl
  // 计算位置：缩略图右侧居中，不超出视口
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  let left = rect.right + 12
  let top = rect.top + rect.height / 2 - PREVIEW_SIZE / 2
  // 右边溢出 → 显示在左侧
  if (left + PREVIEW_SIZE > window.innerWidth - 8) {
    left = rect.left - PREVIEW_SIZE - 12
  }
  // 上下边界夹紧
  top = Math.max(8, Math.min(top, window.innerHeight - PREVIEW_SIZE - 8))
  previewPos.value = { left, top }
}

function onThumbLeave() {
  hoveredTpl.value = null
}

const loadLocal = async () => {
  try {
    const raw = await dbGet(LOCAL_KEY)
    localTemplates.value = raw ? JSON.parse(raw) : []
  } catch {
    localTemplates.value = []
  }
}

const persistLocal = async () => {
  await dbSet(LOCAL_KEY, JSON.stringify(localTemplates.value))
  emit('change', [...localTemplates.value])
}

const loadFromApi = async () => {
  if (!props.fetchTemplates) return
  fetching.value = true
  try {
    const data = await props.fetchTemplates()
    if (Array.isArray(data)) {
      emit('change', data)
    }
  } catch (e) {
    console.error('加载模板失败', e)
  } finally {
    fetching.value = false
  }
}

const resetEditing = () => {
  editingIndex.value = -1
  editingName.value = ''
}

const handleCancel = () => {
  resetEditing()
  emit('update:visible', false)
}

const handleRefresh = async () => {
  if (sourceType.value === 'api') {
    await loadFromApi()
  } else if (sourceType.value === 'local') {
    await loadLocal()
  }
  resetEditing()
}

/** 清空全部：KoruConfirmDialog 替代 window.confirm */
async function confirmClearAll() {
  const ok = await showConfirm({
    title: '清空全部模板',
    content: '确认清空全部模板？此操作不可撤销。',
    type: 'danger',
    okText: '确认清空',
  })
  if (!ok) return
  clearAllTemplates()
}

const clearAllTemplates = async () => {
  if (isReadonly.value) return
  const all = [...localTemplates.value]
  localTemplates.value = []
  await persistLocal()
  emit('template', { action: 'clear', templates: all })
}

const applyTemplate = (tpl: TemplateItem) => {
  emit('apply', tpl)
}

const startRename = (index: number, name: string) => {
  if (isReadonly.value) return
  editingIndex.value = index
  editingName.value = name
}

const confirmRename = async () => {
  const name = editingName.value.trim()
  const index = editingIndex.value
  if (index < 0 || index >= localTemplates.value.length) {
    resetEditing()
    return
  }
  if (!name) {
    resetEditing()
    return
  }
  if (localTemplates.value.some((t, i) => i !== index && t.name === name)) {
    resetEditing()
    return
  }
  localTemplates.value[index] = { ...localTemplates.value[index], name }
  await persistLocal()
  resetEditing()
}

/** 删除单个：KoruConfirmDialog 替代 window.confirm */
async function confirmDelete(index: number) {
  const name = localTemplates.value[index]?.name || ''
  const ok = await showConfirm({
    title: '删除模板',
    content: `确认删除模板 "${name}"？此操作不可撤销。`,
    type: 'danger',
    okText: '确认删除',
  })
  if (!ok) return
  deleteTemplate(index)
}

const deleteTemplate = async (index: number) => {
  if (isReadonly.value) return
  if (index < 0 || index >= localTemplates.value.length) return
  const tpl = localTemplates.value[index]
  localTemplates.value.splice(index, 1)
  await persistLocal()
  emit('template', { action: 'delete', template: tpl })
}

const upsertTemplate = async (tpl: TemplateItem) => {
  const idx = localTemplates.value.findIndex((t) => t.name === tpl.name)
  if (idx >= 0) {
    localTemplates.value[idx] = tpl
  } else {
    localTemplates.value.push(tpl)
  }
  await persistLocal()
}

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      if (sourceType.value === 'api') {
        await loadFromApi()
      } else if (sourceType.value === 'local') {
        await loadLocal()
      }
      resetEditing()
    }
  },
)

defineExpose({ loadLocal, upsertTemplate, localTemplates })
</script>

<style scoped>
.koru-template-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 70vh;
  overflow-y: auto;
}

.koru-template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.koru-template-actions {
  display: flex;
  gap: 8px;
}

.koru-template-count {
  font-size: 13px;
  color: #86909c;
}

.koru-template-source {
  font-size: 12px;
  color: #165dff;
}

.koru-template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
}

.koru-template-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
}

.koru-template-thumb {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  overflow: hidden;
  background: #f7f8fa;
  font-size: 20px;
  color: #4e5969;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.koru-template-preview {
  position: fixed;
  width: 220px;
  height: 220px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.koru-template-preview-fade-enter-active,
.koru-template-preview-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.koru-template-preview-fade-enter-from,
.koru-template-preview-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.koru-template-info {
  flex: 1;
  min-width: 0;
}

.koru-template-name {
  font-size: 14px;
  color: #1d2129;
  word-break: break-all;
}

.koru-template-actions-btns {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
</style>
