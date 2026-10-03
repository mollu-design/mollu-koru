<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  getNodeProp,
  getNodePropsByShape,
  nodePropsToOptions,
  type NodePropKind,
} from '../../composables/nodeProps'

/** 单条属性更改（目标图形 / 目标属性 / 期望值） */
export interface PropertyChange {
  id: string
  /** 目标节点 cellId；'__self__' 表示触发节点自身 */
  targetCellId: string
  /** 目标属性（对应 cell 属性 / data 业务字段） */
  targetProperty: string
  /** 期望值（依属性类型保存为 string/number/bool） */
  expectedValue: any
}

interface NodeOption {
  value: string
  label: string
  shape?: string
  /** 节点 data 数据（用于动态生成业务自定义属性） */
  data?: Record<string, any>
}

const props = defineProps<{
  visible: boolean
  /** 弹窗标题 */
  title?: string
  /** 画布上所有可选节点 */
  allNodes: NodeOption[]
  /** 当前触发节点 cellId */
  selfCellId?: string
  /** 新组的默认目标图元 cellId */
  defaultTargetCellId?: string
  /** 已有的属性更改配置 */
  modelValue: PropertyChange[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'update:modelValue', v: PropertyChange[]): void
}>()

/** 生成内部 id */
const newId = () => `pc-${Date.now()}-${Math.floor(Math.random() * 1000)}`

/** 一条空白的属性更改行 */
const emptyChange = (): PropertyChange => {
  const def = props.defaultTargetCellId
  return {
    id: newId(),
    targetCellId: def && def !== props.selfCellId ? def : '__self__',
    targetProperty: '',
    expectedValue: '',
  }
}

/** 内部待编辑数据（深拷贝，避免直接修改） */
const draft = ref<PropertyChange[]>([])

/** 打开时重置 draft */
watch(
  () => props.visible,
  (v) => {
    if (v) {
      draft.value = (props.modelValue || []).map((c) => ({ ...c }))
      if (draft.value.length === 0) draft.value = [emptyChange()]
    }
  },
  { immediate: true },
)

/** 节点选项（含"自身"） */
const targetOptions = computed<NodeOption[]>(() => {
  const selfNode = props.allNodes.find((n) => n.value === props.selfCellId)
  const selfLabel = selfNode?.label || '自身'
  const others = props.allNodes.filter((n) => n.value !== props.selfCellId)
  return [{ value: '__self__', label: selfLabel }, ...others]
})

/** 解析真实 cellId */
const resolveTargetCellId = (id: string) => (id === '__self__' ? props.selfCellId || '' : id)

/** 找到目标图形的 shape */
const shapeOfTarget = (c: PropertyChange): string | undefined => {
  const cellId = resolveTargetCellId(c.targetCellId)
  if (!cellId) return undefined
  const node = props.allNodes.find((n) => n.value === cellId)
  return node?.shape
}

/** 找到目标图形的 data（业务自定义字段） */
const dataOfTarget = (c: PropertyChange): Record<string, any> | undefined => {
  const cellId = resolveTargetCellId(c.targetCellId)
  if (!cellId) return undefined
  const node = props.allNodes.find((n) => n.value === cellId)
  return node?.data
}

/** 某组的『目标属性』下拉选项：根据所选目标图形的类型动态生成 */
const targetPropertyOptions = (c: PropertyChange) => {
  const shape = shapeOfTarget(c)
  const data = dataOfTarget(c)
  return nodePropsToOptions(getNodePropsByShape(shape, data))
}

/** 属性定义查找（含动态生成的业务字段） */
const propOf = (c: PropertyChange, targetProperty: string) =>
  getNodePropsByShape(shapeOfTarget(c), dataOfTarget(c)).find((p) => p.value === targetProperty)

/** 当前行的属性类型 */
const kindOf = (c: PropertyChange, targetProperty: string): NodePropKind | undefined =>
  propOf(c, targetProperty)?.kind ?? getNodeProp(targetProperty)?.kind

/** 类型判断工具 */
const isNumberKind = (k?: NodePropKind) => k === 'number'
const isColorKind = (k?: NodePropKind) => k === 'color'
const isStateKind = (k?: NodePropKind) => k === 'state'
const isBoolKind = (k?: NodePropKind) => k === 'bool'

/** 状态型枚举值 */
const stateOptions = (c: PropertyChange, targetProperty: string) => {
  const item = propOf(c, targetProperty) ?? getNodeProp(targetProperty)
  const labels = item?.stateLabels ?? {}
  return (item?.states ?? []).map((s) => ({ label: labels[s] ?? s, value: s }))
}

/** 切换属性时按新类型规整 expectedValue */
const onPropChange = (id: string, newProp: string) => {
  const c = draft.value.find((x) => x.id === id)
  const k = c ? kindOf(c, newProp) : undefined
  let coerced: any = ''
  if (k === 'number') coerced = 0
  else if (k === 'bool') coerced = false
  updateChange(id, { targetProperty: newProp, expectedValue: coerced })
}

/** 添加一组 */
const addGroup = () => {
  draft.value = [...draft.value, emptyChange()]
}

/** 删除一组 */
const removeGroup = (id: string) => {
  const next = draft.value.filter((c) => c.id !== id)
  draft.value = next.length === 0 ? [emptyChange()] : next
}

/** 更新一行 */
const updateChange = (id: string, patch: Partial<PropertyChange>) => {
  draft.value = draft.value.map((c) => (c.id === id ? { ...c, ...patch } : c))
}

/** 取消 */
const handleCancel = () => emit('update:visible', false)

/** 保存 */
const handleOk = () => {
  const cleaned = draft.value
    .filter((c) => c.targetCellId && c.targetProperty)
    .map((c) => ({
      ...c,
      targetCellId: resolveTargetCellId(c.targetCellId),
    }))
  emit('update:modelValue', cleaned)
  emit('update:visible', false)
}
</script>

<template>
  <a-drawer
    :visible="visible"
    :title="title || '属性更改配置'"
    :width="'50%'"
    :ok-text="'保存'"
    :cancel-text="'取消'"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <div class="prop-change-modal">
      <!-- 新增一组按钮 -->
      <a-button long class="add-group-btn" @click="addGroup">
        <template #icon><icon-plus /></template>
        新增一组
      </a-button>

      <!-- 数据行 -->
      <div v-for="(c, idx) in draft" :key="c.id" class="prop-change-row">
        <div class="row-label">第{{ idx + 1 }}组</div>
        <div class="row-fields">
          <div class="field">
            <span class="field-label">目标图形</span>
            <a-select
              size="medium"
              :model-value="
                c.targetCellId === (selfCellId || '') && c.targetCellId
                  ? '__self__'
                  : c.targetCellId
              "
              @update:model-value="
                updateChange(c.id, {
                  targetCellId: String($event),
                  targetProperty: '',
                  expectedValue: '',
                })
              "
              :options="targetOptions"
              placeholder="选择目标图形"
              :allow-create="false"
              allow-clear
            />
          </div>

          <div class="field">
            <span class="field-label">目标属性</span>
            <a-select
              size="medium"
              :model-value="c.targetProperty"
              @update:model-value="onPropChange(c.id, String($event))"
              :options="targetPropertyOptions(c)"
              placeholder="选择目标属性"
              allow-clear
            />
          </div>

          <div class="field">
            <span class="field-label">属性值</span>
            <!-- 颜色：色板（Arco ColorPicker 空值会内部 fallback 到 #FF0000，
                 所以给它传永远合法的 fallback 值 + 自定义 slot 区分空/非空外观） -->
            <a-color-picker
              v-if="isColorKind(kindOf(c, c.targetProperty))"
              :model-value="c.expectedValue || '#165DFF'"
              @update:model-value="updateChange(c.id, { expectedValue: $event })"
            >
              <div class="color-picker-trigger" :class="{ empty: !c.expectedValue }">
                <span
                  class="trigger-swatch"
                  :style="{
                    background: c.expectedValue || 'transparent',
                    borderColor: c.expectedValue ? 'transparent' : '#C9CDD4',
                  }"
                />
                <span class="trigger-text">{{ c.expectedValue || '点击选色' }}</span>
              </div>
            </a-color-picker>
            <!-- 状态：枚举下拉 -->
            <a-select
              v-else-if="isStateKind(kindOf(c, c.targetProperty))"
              size="medium"
              :model-value="String(c.expectedValue ?? '')"
              @update:model-value="updateChange(c.id, { expectedValue: $event })"
              :options="stateOptions(c, c.targetProperty)"
              placeholder="选择状态"
              allow-clear
            />
            <!-- 开关：switch -->
            <a-switch
              style="width: 40px"
              v-else-if="isBoolKind(kindOf(c, c.targetProperty))"
              size="medium"
              :model-value="!!c.expectedValue"
              @update:model-value="updateChange(c.id, { expectedValue: $event })"
            />
            <!-- 数值：数字输入 -->
            <a-input-number
              v-else-if="isNumberKind(kindOf(c, c.targetProperty))"
              size="medium"
              mode="button"
              :model-value="Number(c.expectedValue ?? 0)"
              @update:model-value="updateChange(c.id, { expectedValue: $event })"
              :step="propOf(c, c.targetProperty)?.step ?? 1"
              :min="propOf(c, c.targetProperty)?.min"
              :max="propOf(c, c.targetProperty)?.max"
            />
            <!-- 默认：文本输入 -->
            <a-input
              v-else
              size="medium"
              :model-value="String(c.expectedValue ?? '')"
              @update:model-value="updateChange(c.id, { expectedValue: $event })"
              placeholder="属性值"
            />
          </div>

          <a-button
            type="text"
            size="mini"
            status="danger"
            class="del-btn"
            @click="removeGroup(c.id)"
          >
            <template #icon><icon-delete /></template>
          </a-button>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<style scoped>
.prop-change-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-group-btn {
  margin-bottom: 4px;
}

.prop-change-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border: 1px solid #f0f1f3;
  border-radius: 4px;
  background: #fff;
}

.row-label {
  font-size: 12px;
  color: #86909c;
  padding-top: 4px;
  min-width: 40px;
  flex-shrink: 0;
  margin-top: 20px;
}

.row-fields {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.field-label {
  font-size: 12px;
  color: #86909c;
}

.del-btn {
  flex-shrink: 0;
  align-self: center;
  margin-top: 18px;
}

/* 颜色选择器自定义触发元素 */
.color-picker-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #c9cdd4;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s;
  box-sizing: border-box;
  min-width: 160px;
  font-size: 14px;
  color: #1d2129;
}
.color-picker-trigger:hover {
  border-color: #165dff;
}
.color-picker-trigger.empty {
  color: #86909c;
  border-style: dashed;
}
.trigger-swatch {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid;
  box-sizing: border-box;
}
.trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
