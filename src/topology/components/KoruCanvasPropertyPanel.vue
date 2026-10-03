<template>
  <div class="koru-canvas-property-panel">
    <div class="koru-canvas-property-panel__header">
      <span class="koru-canvas-property-panel__title">画布属性</span>
    </div>
    <div class="koru-canvas-property-panel__body">
      <a-form :model="draft" layout="vertical" size="small">
        <a-form-item label="背景颜色">
          <a-color-picker
            size="small"
            :model-value="draft.background.color"
            @update:model-value="setBgColor"
            showAlpha
          />
        </a-form-item>

        <a-form-item label="背景图片">
          <div class="koru-canvas-property-panel__btn-row">
            <a-button size="mini" @click="handleUploadBgImage">上传图片</a-button>
            <a-button
              v-if="draft.background.image"
              size="mini"
              status="danger"
              @click="clearBgImage"
            >
              清除
            </a-button>
          </div>
          <template #extra>
            <span class="koru-canvas-property-panel__hint">上传工艺底图，上层摆放图元</span>
          </template>
        </a-form-item>

        <a-form-item label="显示网格">
          <a-switch
            size="medium"
            :model-value="draft.grid.visible"
            @update:model-value="setGridVisible"
          />
          <template #extra>
            <span class="koru-canvas-property-panel__hint"
              >仅编辑排版时可见，预览运行画面不会显示网格</span
            >
          </template>
        </a-form-item>

        <a-form-item label="网格大小">
          <a-input-number
            size="medium"
            mode="button"
            :model-value="draft.grid.size"
            @update:model-value="setGridSize"
            :min="5"
            :max="100"
            :step="5"
            style="width: 100%"
          />
        </a-form-item>

        <!-- ===== 高级设置（折叠） ===== -->
        <a-collapse
          :default-active-key="[]"
          :expand-icon-position="'right'"
          :show-expand-icon="true"
        >
          <a-collapse-item key="advanced" header="高级设置">
            <template #expand-icon>
              <icon-down />
            </template>

            <a-form-item label="网格类型">
              <a-radio-group
                size="medium"
                :model-value="draft.grid.type || 'mesh'"
                @update:model-value="setGridType"
              >
                <a-radio value="mesh">网状</a-radio>
                <a-radio value="dot">点状</a-radio>
              </a-radio-group>
            </a-form-item>

            <a-form-item label="网格颜色">
              <a-color-picker
                size="small"
                :model-value="draft.grid.color || '#cccccc'"
                @update:model-value="setGridColor"
              />
            </a-form-item>

            <a-form-item label="滚轮缩放">
              <a-switch
                size="medium"
                :model-value="draft.mousewheel?.enabled ?? true"
                @update:model-value="setMousewheelEnabled"
              />
            </a-form-item>

            <a-form-item label="缩放修饰键">
              <a-radio-group
                size="medium"
                :model-value="draft.mousewheel?.modifiers || 'ctrl'"
                @update:model-value="setMousewheelModifiers"
              >
                <a-radio value="ctrl">Ctrl</a-radio>
                <a-radio value="none">无</a-radio>
              </a-radio-group>
            </a-form-item>

            <a-form-item label="最小缩放">
              <a-input-number
                size="medium"
                mode="button"
                :model-value="draft.minScale ?? 0.5"
                @update:model-value="setMinScale"
                :min="0.1"
                :max="1"
                :step="0.1"
                :precision="1"
              />
            </a-form-item>

            <a-form-item label="最大缩放">
              <a-input-number
                size="medium"
                mode="button"
                :model-value="draft.maxScale ?? 3"
                @update:model-value="setMaxScale"
                :min="1"
                :max="10"
                :step="0.5"
                :precision="1"
              />
            </a-form-item>

            <a-form-item label="画布平移拖拽">
              <a-switch
                size="medium"
                :model-value="draft.panning?.enabled ?? true"
                @update:model-value="setPanningEnabled"
              />
            </a-form-item>

            <a-form-item label="平移修饰键">
              <a-radio-group
                size="medium"
                :model-value="draft.panning?.modifiers || 'alt'"
                @update:model-value="setPanningModifiers"
              >
                <a-radio value="alt">Alt</a-radio>
                <a-radio value="none">无</a-radio>
              </a-radio-group>
            </a-form-item>

            <span class="koru-canvas-property-panel__hint-block"
              >以下配置仅编辑模式生效，预览运行模式自动关闭</span
            >

            <a-form-item label="对齐辅助线">
              <a-switch
                size="medium"
                :model-value="draft.snapline?.enabled ?? true"
                @update:model-value="setSnaplineEnabled"
              />
            </a-form-item>

            <a-form-item label="限制节点移出画布">
              <a-switch
                size="medium"
                :model-value="draft.translating?.restrict ?? false"
                @update:model-value="setTranslatingRestrict"
              />
            </a-form-item>

            <a-form-item label="无限滚动画布">
              <a-switch
                size="medium"
                :model-value="draft.scroller?.enabled ?? false"
                @update:model-value="setScrollerEnabled"
              />
            </a-form-item>
          </a-collapse-item>
        </a-collapse>
      </a-form>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 画布属性面板 —— 基于 Arco Design 的组件化版本。
 * 通过 props 接收当前画布配置，通过 emit 通知父组件更新。
 */
import { ref, computed, watch } from 'vue'
import type { Graph } from '@antv/x6'
import { type KoruCanvasConfig, defaultKoruCanvasConfig } from '../types/KoruCanvasConfig'
import { applyKoruCanvasConfig } from '../composables/useKoruCanvasConfig'
import { useCanvasStore } from '../stores/canvasStore'

const props = withDefaults(
  defineProps<{
    /** 当前画布配置（可选，不传则从全局 store 读取） */
    canvasConfig?: KoruCanvasConfig
  }>(),
  {},
)

const emit = defineEmits<{
  (e: 'update:canvasConfig', config: KoruCanvasConfig): void
}>()

/** 本地编辑草稿 */
const draft = ref<KoruCanvasConfig>({ ...defaultKoruCanvasConfig() })

// 使用全局 Store 获取 X6 Graph 实例和画布实例
const store = useCanvasStore()

// 是否使用外部 v-model（由父组件传入 canvasConfig 时使用）
const useExternalModel = computed(() => props.canvasConfig !== undefined)

// 实际使用的配置源：外部 v-model 或 store 内部
const configSource = computed(() =>
  useExternalModel.value ? props.canvasConfig : store.canvasConfig.value,
)

// 同步到 draft
watch(
  () => configSource.value,
  (cfg) => {
    draft.value = { ...cfg!, background: { ...cfg!.background }, grid: { ...cfg!.grid } }
  },
  { immediate: true },
)

/** 提交完整配置变更 */
const commit = () => {
  const config = {
    ...draft.value,
    background: { ...draft.value.background },
    grid: { ...draft.value.grid },
  }
  if (useExternalModel.value) {
    emit('update:canvasConfig', config)
  } else {
    store.canvasConfig.value = config
  }
}

// 监听 draft 变化，自动应用配置到 X6 Graph
watch(
  () => ({ ...draft.value }),
  (cfg) => {
    const graph = store.x6GraphRef?.value
    if (graph) {
      const isPreview = store.instance?.value?.isPreviewMode?.() ?? false
      applyKoruCanvasConfig(graph, cfg, isPreview)
    }
  },
  { deep: true, immediate: true },
)

/** 设置背景颜色 */
const setBgColor = (color: string) => {
  draft.value.background.color = color
  commit()
}

/** 设置网格可见 */
const setGridVisible = (v: boolean | string | number) => {
  draft.value.grid.visible = !!v
  commit()
}

/** 设置网格大小 */
const setGridSize = (val: number | undefined) => {
  if (val != null && val > 0) {
    draft.value.grid.size = val
    commit()
  }
}

/** 设置网格类型 */
const setGridType = (val: string | number | boolean) => {
  draft.value.grid.type = val as 'mesh' | 'dot'
  commit()
}

/** 设置网格颜色 */
const setGridColor = (color: string) => {
  draft.value.grid.color = color
  commit()
}

/** 设置滚轮缩放 */
const setMousewheelEnabled = (v: boolean | string | number) => {
  const mw = draft.value.mousewheel || { enabled: true, modifiers: 'ctrl' as const }
  draft.value.mousewheel = { ...mw, enabled: !!v }
  commit()
}

const setMousewheelModifiers = (v: string | number | boolean) => {
  const mw = draft.value.mousewheel || { enabled: true, modifiers: 'ctrl' as const }
  draft.value.mousewheel = { ...mw, modifiers: v as 'ctrl' | 'none' }
  commit()
}

/** 设置最小/最大缩放 */
const setMinScale = (val: number | undefined) => {
  if (val != null && val > 0) {
    draft.value.minScale = val
    commit()
  }
}

const setMaxScale = (val: number | undefined) => {
  if (val != null && val > 0) {
    draft.value.maxScale = val
    commit()
  }
}

/** 设置平移 */
const setPanningEnabled = (v: boolean | string | number) => {
  const pan = draft.value.panning || { enabled: true, modifiers: 'alt' as const }
  draft.value.panning = { ...pan, enabled: !!v }
  commit()
}

const setPanningModifiers = (v: string | number | boolean) => {
  const pan = draft.value.panning || { enabled: true, modifiers: 'alt' as const }
  draft.value.panning = { ...pan, modifiers: v as 'alt' | 'none' }
  commit()
}

/** 设置对齐辅助线 */
const setSnaplineEnabled = (v: boolean | string | number) => {
  const sn = draft.value.snapline || { enabled: false }
  draft.value.snapline = { ...sn, enabled: !!v }
  commit()
}

/** 设置限制移出画布 */
const setTranslatingRestrict = (v: boolean | string | number) => {
  const tr = draft.value.translating || { restrict: false }
  draft.value.translating = { ...tr, restrict: !!v }
  commit()
}

/** 设置无限滚动画布 */
const setScrollerEnabled = (v: boolean | string | number) => {
  const sc = draft.value.scroller || { enabled: false }
  draft.value.scroller = { ...sc, enabled: !!v }
  commit()
}

/** 上传背景图片（隐藏 input + FileReader） */
const handleUploadBgImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (re: ProgressEvent<FileReader>) => {
      const dataUrl = (re.target as FileReader).result as string
      if (dataUrl) {
        draft.value.background.image = dataUrl
        commit()
      }
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

/** 清除背景图片 */
const clearBgImage = () => {
  draft.value.background.image = ''
  commit()
}
</script>

<style lang="scss">
.koru-canvas-property-panel {
  width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #dfe3e8;
  background: #fff;

  &__header {
    flex-shrink: 0;
    padding: 10px 14px;
    border-bottom: 1px solid #e8e8e8;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
  }

  &__btn-row {
    display: flex;
    gap: 6px;
  }

  &__hint {
    font-size: 12px;
    color: #999;
  }

  &__hint-block {
    display: block;
    font-size: 12px;
    color: #999;
    margin: 8px 0;
    padding: 6px 8px;
    background: #fafafa;
    border-radius: 4px;
  }
}
</style>
