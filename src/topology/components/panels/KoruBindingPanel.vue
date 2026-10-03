<script setup lang="ts">
import { computed } from 'vue'
import {
  getNodeProp,
  getNodePropsByShape,
  nodePropsToOptions,
  type NodePropKind,
} from '../../composables/nodeProps'
import { useBinding } from '../../composables/useBinding'
import { useTrigger } from '../../composables/useTrigger'
import { useJexl } from '../../composables/useJexl'
import type { BindingItem } from '../../composables/bindingTypes'
import KoruBindingItemForm from './KoruBindingItemForm.vue'
import KoruJexlEditorModal from './KoruJexlEditorModal.vue'
import KoruTriggerEditorModal from './KoruTriggerEditorModal.vue'
import KoruButtonMappingModal from './KoruButtonMappingModal.vue'

const props = defineProps<{
  cellProps: Record<string, any>
  allNodes?: { value: string; label: string; shape?: string; data?: Record<string, any> }[]
  deviceOptions?: { value: string; label: string }[]
  deviceCatalog?: { value: string; label: string; points: { value: string; label: string }[] }[]
}>()

const emit = defineEmits<{
  (e: 'update', key: string, value: any): void
}>()

const emitUpdate = (key: string, value: any) => emit('update', key, value)

// === Binding CRUD ===
const {
  config,
  updateBinding,
  addBinding,
  removeBinding,
  deviceSelectOptions,
  onDeviceChange,
  dataPointOptionsOf,
  writePointControlPointOptions,
  writePointDeviceOptions,
  targetNodeOptions,
  bindingHeader,
} = useBinding(
  () => props.cellProps,
  emitUpdate,
  props.allNodes,
  props.deviceOptions,
  props.deviceCatalog,
)

const nodePropOptions = computed(() => {
  const shape = props.cellProps?.shape
  if (shape) return nodePropsToOptions(getNodePropsByShape(shape))
  return []
})

const nodePropOptionsByTarget = (targetId: string): { value: string; label: string }[] => {
  const node = (props.allNodes ?? []).find((n) => n.value === targetId)
  if (node?.shape) return nodePropsToOptions(getNodePropsByShape(node.shape))
  return nodePropOptions.value
}

const nodePropKindOf = (targetId: string, propKey: string): NodePropKind | undefined => {
  const node = (props.allNodes ?? []).find((n) => n.value === targetId)
  if (node?.shape) {
    const p = getNodePropsByShape(node.shape).find((x) => x.value === propKey)
    if (p) return p.kind
  }
  return getNodeProp(propKey)?.kind
}

const nodePropStatesOf = (
  targetId: string,
  propKey: string,
): { label: string; value: string }[] => {
  const node = (props.allNodes ?? []).find((n) => n.value === targetId)
  const prop = node?.shape
    ? getNodePropsByShape(node.shape).find((x) => x.value === propKey)
    : undefined
  const p = prop || getNodeProp(propKey)
  if (!p?.states) return []
  const labels = p.stateLabels ?? {}
  return p.states.map((s) => ({ label: labels[s] ?? s, value: s }))
}

// === Trigger logic ===
const {
  triggerEditor,
  triggerModalVisible,
  triggerModalTitle,
  openTriggerModal,
  onActionTypeChange,
  saveTriggerModal,
  removeTrigger,
  toggleTrigger,
  triggerSummary,
} = useTrigger(() => config.value.bindings, updateBinding)

// === JEXL logic ===
const {
  jexlEditor,
  jexlVisible,
  jexlValidateResult,
  openJexl,
  onTemplateTypeChange,
  applyTemplate,
  onAdvancedInput,
  checkJexl,
  saveJexl,
  addColorPair,
  removeColorPair,
  addThresholdRule,
  removeThresholdRule,
  addMappingItem,
  removeMappingItem,
  buttonMapping,
  buttonMappingVisible,
  openButtonMapping,
  applyButtonTextTemplate,
  applyButtonStyleTemplate,
  onButtonTextTypeChange,
  onButtonStyleTypeChange,
  addButtonTextItem,
  removeButtonTextItem,
  addButtonStyleColorPair,
  removeButtonStyleColorPair,
  saveButtonMapping,
} = useJexl(updateBinding)

const openMappingEditor = (b: BindingItem, shape?: string) => {
  if (shape === 'custom-button') {
    openButtonMapping(b, shape)
  } else {
    openJexl(b, shape, stateOptions.value)
  }
}

const closeJexl = () => {
  jexlEditor.value = null
}
const closeButtonMapping = () => {
  buttonMapping.value = null
}

const stateOptions = computed(() => {
  if (!props.cellProps?.stateList) return undefined
  return props.cellProps.stateList.map((s: any) => ({ stateId: s.stateId, stateName: s.stateName }))
})

const hasElementStateMapping = computed(() => {
  return config.value.bindings.some((b) => b.templateType === 'elementStateMapping')
})

const hasDevicePoint = computed(() => {
  return config.value.bindings.some((b) => b.device && b.dataPoint)
})
</script>

<template>
  <div class="binding-panel">
    <div
      v-if="hasElementStateMapping && !hasDevicePoint"
      class="jexl-validate warning"
      style="margin-bottom: 8px"
    >
      <icon-exclamation-circle />
      请先为元件绑定设备与驱动测点，才可配置状态切换规则
    </div>

    <a-tooltip v-if="hasElementStateMapping" content="状态切换规则仅允许配置一条">
      <a-button type="primary" long size="medium" class="add-binding-btn" disabled>
        添加绑定
      </a-button>
    </a-tooltip>
    <a-button v-else type="primary" long size="medium" class="add-binding-btn" @click="addBinding">
      添加绑定
    </a-button>

    <a-empty description='暂无绑定，点击上方"添加绑定"创建' v-if="config.bindings.length === 0" />

    <a-collapse
      :default-active-key="['0']"
      :expand-icon-position="'right'"
      :show-expand-icon="true"
      v-else
    >
      <a-collapse-item
        v-for="(b, idx) in config.bindings"
        :key="b.id"
        :header="bindingHeader(b, idx)"
      >
        <template #extra>
          <a-popconfirm
            content="删除该绑定？"
            :ok-text="'删除'"
            :cancel-text="'取消'"
            position="tr"
            @ok="removeBinding(b.id)"
          >
            <a-button type="text" size="mini" status="danger" @click.stop>
              <template #icon><icon-delete /></template>
            </a-button>
          </a-popconfirm>
        </template>

        <KoruBindingItemForm
          :binding="b"
          :index="idx"
          :is-multi-state-element="!!props.cellProps?.isMultiState"
          :node-prop-options="nodePropOptions"
          :device-select-options="deviceSelectOptions"
          :data-point-options-of="dataPointOptionsOf"
          :on-device-change="onDeviceChange"
          :update-binding="updateBinding"
          :open-jexl="(b: BindingItem) => openMappingEditor(b, props.cellProps?.shape)"
          :open-trigger-modal="openTriggerModal"
          :remove-trigger="removeTrigger"
          :toggle-trigger="toggleTrigger"
          :trigger-summary="triggerSummary"
        />
      </a-collapse-item>
    </a-collapse>

    <KoruJexlEditorModal
      :editor="jexlEditor"
      :visible="jexlVisible"
      :validate-result="jexlValidateResult"
      :on-template-type-change="onTemplateTypeChange"
      :apply-template="applyTemplate"
      :on-advanced-input="onAdvancedInput"
      :check-jexl="checkJexl"
      :save-jexl="saveJexl"
      :add-color-pair="addColorPair"
      :remove-color-pair="removeColorPair"
      :add-threshold-rule="addThresholdRule"
      :remove-threshold-rule="removeThresholdRule"
      :add-mapping-item="addMappingItem"
      :remove-mapping-item="removeMappingItem"
      :close="closeJexl"
    />

    <KoruButtonMappingModal
      :editor="buttonMapping"
      :visible="buttonMappingVisible"
      :apply-text-template="applyButtonTextTemplate"
      :apply-style-template="applyButtonStyleTemplate"
      :on-style-type-change="onButtonStyleTypeChange"
      :add-text-item="addButtonTextItem"
      :remove-text-item="removeButtonTextItem"
      :add-style-color-pair="addButtonStyleColorPair"
      :remove-style-color-pair="removeButtonStyleColorPair"
      :save="saveButtonMapping"
      :close="closeButtonMapping"
    />

    <KoruTriggerEditorModal
      :editor="triggerEditor"
      :visible="triggerModalVisible"
      :title="triggerModalTitle"
      :on-action-type-change="onActionTypeChange"
      :save="saveTriggerModal"
      :close="() => (triggerEditor = null)"
      :write-point-device-options="writePointDeviceOptions"
      :write-point-control-point-options="writePointControlPointOptions"
      :target-node-options="targetNodeOptions"
      :node-prop-options-by-target="nodePropOptionsByTarget"
      :node-prop-kind-of="nodePropKindOf"
      :node-prop-states-of="nodePropStatesOf"
    />
  </div>
</template>

<style scoped>
.binding-panel {
  padding: 4px 0;
}
.add-binding-btn {
  margin-bottom: 12px;
}
:deep(.arco-collapse-item-content) {
  --color-fill-1: #fff;
  padding-left: 18px;
}
</style>
