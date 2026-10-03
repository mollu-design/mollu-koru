<template>
  <div class="koru-animation-panel">
    <!-- 元素动画：node 通用（X6 动画模板） -->
    <a-form
      v-if="cellType === 'node' && !isLineNode"
      :model="localDraft"
      layout="vertical"
      size="small"
    >
      <a-divider :margin="8">元素动画</a-divider>
      <a-form-item label="启用动画">
        <a-switch
          :model-value="!!localDraft.enabled"
          @update:model-value="onEnabledChange($event)"
        />
      </a-form-item>
      <a-form-item label="动画模板">
        <a-select
          size="medium"
          :model-value="localDraft.templateId"
          @update:model-value="onTemplateChange($event)"
          :options="nodeTemplateOptions"
          placeholder="选择动画模板"
        />
        <template #extra>
          <div v-if="currentDef" class="anim-hint">{{ currentDef.desc }}</div>
        </template>
      </a-form-item>

      <!-- 动态模板参数 -->
      <a-form-item v-for="p in currentParams" :key="p.key" :label="p.label">
        <a-input-number
          v-if="p.type === 'number'"
          size="medium"
          :model-value="Number(paramValue(p.key) ?? p.default)"
          @update:model-value="(v) => onParamChange(p.key, v)"
          :min="p.min"
          :max="p.max"
          :step="p.step"
          style="width: 100%"
          mode="button"
        />
        <a-color-picker
          v-else-if="p.type === 'color'"
          size="small"
          :model-value="String(paramValue(p.key) ?? p.default)"
          @update:model-value="(v) => onParamChange(p.key, v)"
        />
      </a-form-item>

      <div class="anim-hint">
        循环告警动画可手动关闭；故障恢复后停止。一次性过渡动画播放完成自动结束。
      </div>
    </a-form>

    <!-- 连线动画：edge 特有 -->
    <a-form v-else-if="cellType === 'edge'" :model="localDraft" layout="vertical" size="small">
      <a-divider :margin="8">连线动画</a-divider>
      <a-form-item label="启用动画">
        <a-switch
          :model-value="!!localDraft.enabled"
          @update:model-value="onEnabledChange($event)"
        />
      </a-form-item>
      <a-form-item label="动画模板">
        <a-select
          size="medium"
          :model-value="localDraft.templateId"
          @update:model-value="onTemplateChange($event)"
          :options="edgeTemplateOptions"
          placeholder="选择连线动画"
        />
        <div v-if="currentDef" class="anim-hint">{{ currentDef.desc }}</div>
      </a-form-item>
      <a-form-item v-for="p in currentParams" :key="p.key" :label="p.label">
        <a-input-number
          v-if="p.type === 'number'"
          size="medium"
          :model-value="Number(paramValue(p.key) ?? p.default)"
          @update:model-value="(v) => onParamChange(p.key, v)"
          :min="p.min"
          :max="p.max"
          :step="p.step"
          style="width: 100%"
          mode="button"
        />
        <a-color-picker
          v-else-if="p.type === 'color'"
          size="small"
          :model-value="String(paramValue(p.key) ?? p.default)"
          @update:model-value="(v) => onParamChange(p.key, v)"
        />
      </a-form-item>
    </a-form>

    <!-- 线条动画：shape-line 节点特有 -->
    <a-form v-else-if="isLineNode" :model="{}" layout="vertical" size="small">
      <a-divider :margin="8">线条动画</a-divider>
      <a-form-item label="动画效果">
        <a-select
          size="medium"
          :model-value="lineAnimValue"
          @update:model-value="(v: any) => onLineAnimChange(String(v ?? 'none'))"
          placeholder="选择线条动画"
          :options="lineAnimOptions"
        />
      </a-form-item>
      <div class="anim-hint">通过 CSS 动画驱动线条运动，模拟介质流动效果。</div>
    </a-form>

    <div v-else class="anim-hint">此图元类型暂不支持动画</div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  ANIMATION_TEMPLATES,
  animationTemplateOptions,
  defaultAnimationConfig,
} from '../../composables/animationConfig'
import {
  type AnimationConfig,
  type AnimationTemplateId,
  type AnimationTemplateDef,
} from '../../composables/AnimationTypes'

interface Props {
  /** 当前 cell 类型：node / edge */
  cellType: 'node' | 'edge'
  /** 是否为 shape-line 节点 */
  isLineNode: boolean
  /** 动画配置（node/edge 通用） */
  animation?: AnimationConfig | null
  /** shape-line 动画值 */
  lineAnim?: string
  /** shape-line 动画方向 */
  lineAnimDir?: string
}

const props = withDefaults(defineProps<Props>(), {
  animation: null,
  lineAnim: 'none',
  lineAnimDir: 'normal',
})

const emit = defineEmits<{
  (e: 'update:animation', value: AnimationConfig): void
  (e: 'update:lineAnim', value: string): void
}>()

/** 防止 prop → setter → emit 回环的标志 */
let skipEmit = false

/** 本地动画草稿（双向绑定 props.animation） */
const localDraft = computed<AnimationConfig>({
  get() {
    if (props.animation) {
      return {
        enabled: !!props.animation.enabled,
        templateId: (props.animation.templateId || '') as AnimationTemplateId | '',
        options: { ...props.animation.options },
      }
    }
    return { ...defaultAnimationConfig(), enabled: false }
  },
  set(val) {
    if (skipEmit) return
    emit('update:animation', { ...val, options: { ...val.options } })
  },
})

/** 线条动画值（双向绑定 + 防回环） */
let skipLineEmit = false
const lineAnimValue = computed({
  get() {
    return props.lineAnim || 'none'
  },
  set(val: string) {
    if (skipLineEmit) return
    emit('update:lineAnim', val)
  },
})

/** lineAnim prop 同步 */
watch(
  () => props.lineAnim,
  () => {
    skipLineEmit = true
    try {
      // 触发 getter 同步
      const _ = lineAnimValue.value
      void _
    } finally {
      skipLineEmit = false
    }
  },
)

/** 模板选项 */
const nodeTemplateOptions = computed(() => animationTemplateOptions('node'))
const edgeTemplateOptions = computed(() => animationTemplateOptions('edge'))

const lineAnimOptions = [
  { label: '无', value: 'none' },
  { label: '流动', value: 'flow' },
  { label: '水珠', value: 'bead' },
  { label: '拖尾', value: 'trail' },
  { label: '电流', value: 'current' },
]

/** 当前模板定义 */
const currentDef = computed<AnimationTemplateDef | null>(() => {
  const id = localDraft.value.templateId
  if (!id) return null
  return ANIMATION_TEMPLATES[id] || null
})

/** 当前模板的参数列表 */
const currentParams = computed(() => currentDef.value?.params || [])

/** 参数值读写 */
const paramValue = (key: string) => localDraft.value.options[key]

const onEnabledChange = (v: boolean | string | number) => {
  localDraft.value = { ...localDraft.value, enabled: !!v }
}

const onTemplateChange = (id: string | number | boolean | Record<string, any> | any[]) => {
  localDraft.value = {
    ...localDraft.value,
    templateId: (String(id ?? '') || '') as AnimationTemplateId | '',
    options: {},
  }
}

const onParamChange = (key: string, val: any) => {
  localDraft.value = {
    ...localDraft.value,
    options: { ...localDraft.value.options, [key]: val },
  }
}

const onLineAnimChange = (val: string) => {
  emit('update:lineAnim', val)
}

/** 外部 animation prop 变化时同步本地草稿（用 skipEmit 阻断回环） */
watch(
  () => props.animation,
  (val) => {
    skipEmit = true
    try {
      if (val) {
        localDraft.value = {
          enabled: !!val.enabled,
          templateId: (val.templateId || '') as AnimationTemplateId | '',
          options: { ...val.options },
        }
      } else {
        localDraft.value = { ...defaultAnimationConfig(), enabled: false }
      }
    } finally {
      skipEmit = false
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.koru-animation-panel {
  padding: 2px 0;
}

.anim-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
  line-height: 1.6;
}
</style>
