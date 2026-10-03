<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  getNodeProp,
  getNodePropsByShape,
  operatorsByKind,
  type NodePropKind,
} from '../../composables/nodeProps'

/** 触发条件（与 EventPanel 的 Condition 结构一致） */
export interface Condition {
  targetCellId?: string
  relation: string
  field: string
  operator: string
  value: any
  codes?: string[]
}

interface NodeOption {
  value: string
  label: string
  shape?: string
}

const props = defineProps<{
  visible: boolean
  title?: string
  /** 画布上全部可选节点 */
  allNodes: NodeOption[]
  /** 触发条件当前值（v-model） */
  modelValue: Condition
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'update:modelValue', v: Condition): void
}>()

/** 目标图元选项 */
const targetOptions = computed<NodeOption[]>(() => props.allNodes)

/** 内部编辑值 */
const draft = ref<Condition>({ relation: 'relation', field: '', operator: '', value: '' })

watch(
  () => props.visible,
  (v) => {
    if (v) {
      draft.value = { ...props.modelValue }
    }
  },
  { immediate: true },
)

/** 目标图元的 shape（基于 draft.targetCellId） */
const targetShape = computed(() => {
  const id = draft.value.targetCellId
  if (!id) return undefined
  const node = props.allNodes.find((n) => n.value === id)
  return node?.shape
})

/** 属性名下拉：根据目标图元 shape 动态生成 */
const fieldOptions = computed(() => {
  if (targetShape.value) {
    return getNodePropsByShape(targetShape.value).map((p) => ({ value: p.value, label: p.label }))
  }
  return []
})

/** 当前选中属性的类型 */
const kindOf = (): NodePropKind | undefined => {
  const field = draft.value.field
  if (!field) return 'text'
  const dynamic = getNodePropsByShape(targetShape.value).find((p) => p.value === field)
  return dynamic?.kind ?? getNodeProp(field)?.kind
}

/** 类型判断工具 */
const isNumberKind = (k?: NodePropKind) => k === 'number'
const isColorKind = (k?: NodePropKind) => k === 'color'
const isStateKind = (k?: NodePropKind) => k === 'state'
const isBoolKind = (k?: NodePropKind) => k === 'bool'

/** 状态型枚举 */
const stateOptions = computed(() => {
  const field = draft.value.field
  const dynamic = getNodePropsByShape(targetShape.value).find((p) => p.value === field)
  const item = dynamic ?? getNodeProp(field)
  const labels = item?.stateLabels ?? {}
  return (item?.states ?? []).map((s) => ({ label: labels[s] ?? s, value: s }))
})

/** 当前属性定义（用于数字型 step/min/max） */
const propOf = computed(() => {
  const field = draft.value.field
  return getNodePropsByShape(targetShape.value).find((p) => p.value === field)
})

/** 切换目标图元时重置字段 */
const onTargetChange = (cellId: string) => {
  draft.value = {
    ...draft.value,
    targetCellId: cellId,
    field: '',
    operator: '',
    value: '',
  }
}

/** 切换属性名时重置运算符/值 */
const onFieldChange = (field: string) => {
  draft.value = {
    ...draft.value,
    field,
    operator: '',
    value: '',
  }
}

/** 属性值变化：只更新 value 字段 */
const onValueChange = (v: any) => {
  draft.value = { ...draft.value, value: v }
}

/** 运算符变化 */
const onOperatorChange = (v: any) => {
  draft.value = { ...draft.value, operator: String(v) }
}

const handleCancel = () => emit('update:visible', false)
const handleOk = () => {
  emit('update:modelValue', { ...draft.value })
  emit('update:visible', false)
}

/** 计算属性：用于 v-model 绑定 value 字段，按属性类型做值转换 */
const valueModel = computed({
  get: () => {
    const v = draft.value.value
    const kind = kindOf()
    if (kind === 'number') {
      // a-input-number 需要 Number，空串转 undefined（显示为空）
      return v === '' || v == null ? undefined : Number(v)
    }
    if (kind === 'bool') return !!v
    return v
  },
  set: (v: any) => {
    draft.value = { ...draft.value, value: v }
  },
})
</script>

<template>
  <a-modal
    :visible="visible"
    :title="title || '触发条件编辑'"
    :width="520"
    :ok-text="'保存'"
    :cancel-text="'取消'"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form :model="draft" layout="vertical" size="small">
      <!-- 目标图元 -->
      <a-form-item label="目标图元">
        <a-select
          size="medium"
          :model-value="draft.targetCellId"
          @update:model-value="onTargetChange($event as string)"
          :options="targetOptions"
          placeholder="选择目标图元"
          allow-clear
        />
      </a-form-item>

      <!-- 属性名 -->
      <a-form-item label="属性名">
        <a-select
          size="medium"
          :model-value="String(draft.field ?? '')"
          @update:model-value="onFieldChange($event as string)"
          :options="fieldOptions"
          :allow-create="true"
          allow-clear
          placeholder="选择或输入属性名"
        />
      </a-form-item>

      <!-- 运算符 -->
      <a-form-item label="条件">
        <a-select
          size="medium"
          :model-value="String(draft.operator ?? '')"
          @update:model-value="onOperatorChange"
          :options="operatorsByKind(kindOf())"
          style="width: 100%"
          placeholder="选择条件"
        />
      </a-form-item>

      <!-- 属性值：按属性类型显示控件 -->
      <a-form-item label="属性值">
        <!-- 颜色 -->
        <a-color-picker v-if="isColorKind(kindOf())" size="medium" show-text v-model="valueModel" />
        <!-- 状态枚举 -->
        <a-select
          v-else-if="isStateKind(kindOf())"
          size="medium"
          v-model="valueModel"
          :options="stateOptions"
          placeholder="选择状态"
          allow-clear
        />
        <!-- 开关 -->
        <a-switch
          v-else-if="isBoolKind(kindOf())"
          style="width: 40px"
          size="medium"
          v-model="valueModel"
        />
        <!-- 数值 -->
        <a-input-number
          v-else-if="isNumberKind(kindOf())"
          size="medium"
          mode="button"
          v-model="valueModel"
          :step="propOf?.step ?? 1"
          :min="propOf?.min"
          :max="propOf?.max"
          style="width: 100%"
        />
        <!-- 文本 -->
        <a-input v-else size="medium" v-model="valueModel" placeholder="属性值" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
