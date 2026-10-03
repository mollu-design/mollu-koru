<script setup lang="ts">
import { computed } from 'vue'
import type { BindingItem, TriggerItem } from '../../composables/bindingTypes'

const props = defineProps<{
  binding: BindingItem
  index: number
  isMultiStateElement?: boolean
  nodePropOptions: { value: string; label: string }[]
  deviceSelectOptions: { value: string; label: string }[]
  dataPointOptionsOf: (b: BindingItem) => { value: string; label: string }[]
  onDeviceChange: (b: BindingItem, v: any) => void
  updateBinding: (id: string, patch: Partial<BindingItem>) => void
  openJexl: (b: BindingItem) => void
  openTriggerModal: (bId: string, tId?: string) => void
  removeTrigger: (bId: string, tId: string) => void
  toggleTrigger: (b: BindingItem, t: TriggerItem, enabled: boolean) => void
  triggerSummary: (t: TriggerItem) => string
}>()

const keepValues = ['fill', 'nodeAnim', 'state', 'text', 'fontColor']

const filteredPropOptions = computed(() => {
  return props.nodePropOptions.filter((item) => keepValues.includes(item.value))
})
</script>

<template>
  <a-form layout="vertical" size="small" :model="binding">
    <a-form-item label="绑定设备">
      <a-select
        size="medium"
        :model-value="binding.device"
        @update:model-value="onDeviceChange(binding, $event)"
        :options="deviceSelectOptions"
        placeholder="选择设备"
        allow-clear
      />
    </a-form-item>

    <a-form-item label="绑定数据点">
      <a-select
        size="medium"
        :model-value="binding.dataPoint"
        @update:model-value="updateBinding(binding.id, { dataPoint: String($event) })"
        :options="dataPointOptionsOf(binding)"
        :disabled="!binding.device"
        placeholder="选择或输入测点编号"
        allow-clear
        allow-create
        :filter="true"
      />
    </a-form-item>

    <a-form-item v-if="!isMultiStateElement" label="图元属性">
      <a-select
        size="medium"
        :model-value="binding.targetProperty"
        @update:model-value="updateBinding(binding.id, { targetProperty: String($event) })"
        :options="filteredPropOptions"
        placeholder="选择图元属性"
        allow-clear
      />
    </a-form-item>

    <!-- 多状态元件：提示去编辑多状态弹窗配置 -->
    <a-form-item v-if="isMultiStateElement" label="状态切换规则">
      <a-alert type="info" :bordered="false" style="margin-bottom: 0">
        <template #icon><icon-info-circle /></template>
        请在<b>属性</b>下<b>「编辑多状态」</b> 中配置
      </a-alert>
    </a-form-item>

    <template v-if="!isMultiStateElement && binding.device && binding.dataPoint && binding.targetProperty">
      <a-form-item label="映射规则">
        <template #label>
          映射规则
          <template v-if="binding.textMapping && binding.styleMapping">
            <a-tag size="small" color="purple" style="margin-left: 4px">双映射</a-tag>
          </template>
          <template v-else-if="binding.textMapping">
            <a-tag size="small" color="blue" style="margin-left: 4px">文本映射</a-tag>
          </template>
          <template v-else-if="binding.styleMapping">
            <a-tag size="small" color="orange" style="margin-left: 4px">颜色映射</a-tag>
          </template>
        </template>
        <a-button
          :disabled="!binding.dataPoint"
          type="outline"
          long
          size="small"
          @click="openJexl(binding)"
        >
          <template #icon><icon-code /></template>
          编辑映射规则{{ binding.mappingRules ? '（已配置）' : '' }}
        </a-button>
      </a-form-item>

      <a-form-item label="只读">
        <a-switch
          :model-value="!!binding.readOnly"
          @update:model-value="updateBinding(binding.id, { readOnly: !!$event })"
        />
      </a-form-item>
    </template>

    <template v-if="binding.device && binding.dataPoint">
      <a-form-item label="刷新频率 (ms)">
        <a-input-number
          :model-value="binding.refreshInterval"
          @update:model-value="updateBinding(binding.id, { refreshInterval: $event })"
          :min="200"
          :max="60000"
          :step="100"
          mode="button"
          size="medium"
        />
      </a-form-item>

      <div class="trigger-block">
        <div class="trigger-header">
          <span class="trigger-title">
            触发器
            <a-tooltip
              content="当绑定点数据满足条件时自动执行动作（如弹窗告警、下发指令、跳转页面等）"
            >
              <icon-info-circle class="trigger-hint" />
            </a-tooltip>
          </span>
          <a-button type="outline" size="mini" @click="openTriggerModal(binding.id)">
            <template #icon><icon-plus /></template>
            添加触发器
          </a-button>
        </div>

        <div v-if="binding.triggers.length === 0" class="trigger-empty">
          暂无触发器，点击"添加触发器"创建
        </div>

        <div
          v-for="(t, ti) in binding.triggers"
          :key="t.id"
          class="trigger-item"
          :class="{ disabled: !t.enabled }"
        >
          <div class="trigger-item-header">
            <span class="trigger-item-title">
              <a-switch
                :model-value="!!t.enabled"
                size="small"
                @update:model-value="toggleTrigger(binding, t, !!$event)"
              />
              <span>触发器 {{ ti + 1 }}</span>
              <a-tag v-if="t.triggerMode === 'always'" size="small" color="orange">持续</a-tag>
              <a-tag v-if="t.actionType === 'writePoint'" size="small" color="red">遥控</a-tag>
            </span>
            <span class="trigger-item-actions">
              <a-button type="text" size="mini" @click="openTriggerModal(binding.id, t.id)">
                <template #icon><icon-edit /></template>
              </a-button>
              <a-button
                type="text"
                size="mini"
                status="danger"
                @click="removeTrigger(binding.id, t.id)"
              >
                <template #icon><icon-delete /></template>
              </a-button>
            </span>
          </div>
          <div class="trigger-summary" @click="openTriggerModal(binding.id, t.id)">
            {{ triggerSummary(t) }}
          </div>
        </div>
      </div>
    </template>
  </a-form>
</template>

<style scoped>
.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
}
.trigger-block {
  margin-top: 8px;
  border-top: 1px dashed #e5e6eb;
  padding-top: 8px;
}
.trigger-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.trigger-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.trigger-hint {
  color: #86909c;
  cursor: help;
  font-size: 14px;
}
.trigger-empty {
  padding: 12px 8px;
  text-align: center;
  font-size: 12px;
  color: #86909c;
  border: 1px dashed #e5e6eb;
  border-radius: 4px;
}
.trigger-item {
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
}
.trigger-item.disabled {
  opacity: 0.6;
}
.trigger-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 12px;
  color: #86909c;
  background: #f7f8fa;
}
.trigger-item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #1d2129;
}
.trigger-item-actions {
  display: flex;
  align-items: center;
}
.trigger-summary {
  padding: 6px 8px;
  font-size: 12px;
  color: #4e5969;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trigger-summary:hover {
  background: #f2f3f5;
}
</style>
