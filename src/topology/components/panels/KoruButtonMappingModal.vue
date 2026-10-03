<template>
  <a-modal
    v-if="editor"
    :visible="visible"
    title="编辑按钮映射规则"
    :width="680"
    :ok-text="'保存'"
    :cancel-text="'取消'"
    @ok="save"
    @cancel="close"
  >
    <div class="btn-mapping-tip">按钮组件需要分别配置【文本映射】和【样式映射】</div>

    <a-tabs
      v-model:active-key="editor.activeTab"
      type="rounded"
      class="btn-mapping-tabs"
      @tab-click="handleTabChange"
    >
      <!-- ===== Tab 1：文本映射 ===== -->
      <a-tab-pane key="text" title="① 文本映射（必填）">
        <template v-if="!editor.textEditable">
          <a-result status="warning" title="当前表达式为自定义高级脚本，无法可视化编辑" />
        </template>
        <template v-else>
          <div class="btn-mapping-section">
            <a-form layout="vertical" size="small" :model="editor.textTemplate">
              <a-form-item label="模板类型">
                <a-select
                  :model-value="editor.textTemplate.type"
                  disabled
                  :options="textTypeOptions"
                  size="medium"
                />
              </a-form-item>
              <a-form-item label="数据源值 → 显示文本">
                <div class="color-map-list">
                  <div
                    v-for="(p, i) in editor.textTemplate.mappingItems"
                    :key="i"
                    class="color-map-row"
                  >
                    <a-input
                      :model-value="String(p.sourceValue)"
                      @update:model-value="
                        ((editor.textTemplate.mappingItems[i].sourceValue = $event),
                        applyTextTemplate())
                      "
                      placeholder="值，如 1"
                      style="width: 120px"
                      size="medium"
                    />
                    <a-input
                      :model-value="p.showText"
                      @update:model-value="
                        ((editor.textTemplate.mappingItems[i].showText = $event),
                        applyTextTemplate())
                      "
                      placeholder="显示文本，如 启动"
                      style="flex: 1"
                      size="medium"
                    />
                    <a-button type="text" size="mini" status="danger" @click="removeTextItem(i)">
                      <template #icon><icon-delete /></template>
                    </a-button>
                  </div>
                </div>
                <a-button type="outline" size="mini" @click="addTextItem">
                  <template #icon><icon-plus /></template>
                  添加映射
                </a-button>
              </a-form-item>
              <a-form-item label="缺省文本（无匹配时展示）">
                <a-input
                  :model-value="editor.textTemplate.defaultText"
                  @update:model-value="
                    ((editor.textTemplate.defaultText = $event), applyTextTemplate())
                  "
                  placeholder="如：未知状态"
                  size="medium"
                />
              </a-form-item>
            </a-form>
            <div class="jexl-preview">
              <div class="jexl-preview-label">生成文本表达式：</div>
              <code>{{ editor.textDraft }}</code>
            </div>
          </div>
        </template>
      </a-tab-pane>

      <!-- ===== Tab 2：样式映射 ===== -->
      <a-tab-pane key="style" title="② 样式映射（可选）">
        <template v-if="!editor.styleEditable">
          <a-result status="warning" title="当前表达式为自定义高级脚本，无法可视化编辑" />
        </template>
        <template v-else>
          <div class="btn-mapping-section">
            <a-form layout="vertical" size="small" :model="editor.styleTemplate">
              <a-form-item label="模板类型">
                <a-select
                  :model-value="editor.styleTemplate.type"
                  @update:model-value="onStyleTypeChange($event as string as JexlTemplateType)"
                  :options="styleTypeOptions"
                  size="medium"
                />
              </a-form-item>

              <!-- 状态颜色映射 -->
              <template v-if="editor.styleTemplate.type === 'colorMap'">
                <a-form-item label="状态 → 颜色映射">
                  <div class="color-map-list">
                    <div
                      v-for="(p, i) in editor.styleTemplate.colorPairs"
                      :key="i"
                      class="color-map-row"
                    >
                      <a-input
                        :model-value="String(p.value)"
                        @update:model-value="
                          ((editor.styleTemplate.colorPairs[i].value = $event),
                          applyStyleTemplate())
                        "
                        :placeholder="
                          i === editor.styleTemplate.colorPairs.length - 1
                            ? '默认色（留空）'
                            : '值，如 1'
                        "
                        style="width: 120px"
                        size="medium"
                      />
                      <a-color-picker
                        :model-value="p.color"
                        @update:model-value="
                          ((editor.styleTemplate.colorPairs[i].color = $event),
                          applyStyleTemplate())
                        "
                        size="medium"
                      />
                      <a-input
                        :model-value="p.color"
                        @update:model-value="
                          ((editor.styleTemplate.colorPairs[i].color = $event),
                          applyStyleTemplate())
                        "
                        style="width: 110px"
                        size="medium"
                      />
                      <a-tag
                        v-if="i === editor.styleTemplate.colorPairs.length - 1"
                        size="small"
                        color="arcoblue"
                        >默认</a-tag
                      >
                      <a-button
                        type="text"
                        size="mini"
                        status="danger"
                        @click="removeStyleColorPair(i)"
                      >
                        <template #icon><icon-delete /></template>
                      </a-button>
                    </div>
                  </div>
                  <a-button type="outline" size="mini" @click="addStyleColorPair">
                    <template #icon><icon-plus /></template>
                    添加映射
                  </a-button>
                </a-form-item>
                <div class="field-hint" style="margin-top: -8px">
                  最后一行「值留空」作为默认（兜底）颜色
                </div>
              </template>

              <!-- 阈值颜色 -->
              <template v-if="editor.styleTemplate.type === 'threshold'">
                <a-form-item label="阈值">
                  <div class="trigger-modal-row">
                    <a-select
                      :model-value="editor.styleTemplate.thresholdOp"
                      @update:model-value="
                        ((editor.styleTemplate.thresholdOp = String($event) as 'gt' | 'lt'),
                        applyStyleTemplate())
                      "
                      :options="[
                        { label: '大于', value: 'gt' },
                        { label: '小于', value: 'lt' },
                      ]"
                      style="width: 110px"
                    />
                    <a-input-number
                      :model-value="Number(editor.styleTemplate.thresholdValue)"
                      @update:model-value="
                        ((editor.styleTemplate.thresholdValue = String($event ?? '')),
                        applyStyleTemplate())
                      "
                      placeholder="阈值"
                      style="flex: 1"
                    />
                  </div>
                </a-form-item>
                <a-form-item label="正常颜色">
                  <div class="trigger-modal-row">
                    <a-color-picker
                      :model-value="editor.styleTemplate.normalColor"
                      @update:model-value="
                        ((editor.styleTemplate.normalColor = $event), applyStyleTemplate())
                      "
                      size="small"
                    />
                    <a-input
                      :model-value="editor.styleTemplate.normalColor"
                      @update:model-value="
                        ((editor.styleTemplate.normalColor = $event), applyStyleTemplate())
                      "
                    />
                  </div>
                </a-form-item>
                <a-form-item label="告警颜色">
                  <div class="trigger-modal-row">
                    <a-color-picker
                      :model-value="editor.styleTemplate.alarmColor"
                      @update:model-value="
                        ((editor.styleTemplate.alarmColor = $event), applyStyleTemplate())
                      "
                      size="small"
                    />
                    <a-input
                      :model-value="editor.styleTemplate.alarmColor"
                      @update:model-value="
                        ((editor.styleTemplate.alarmColor = $event), applyStyleTemplate())
                      "
                    />
                  </div>
                </a-form-item>
              </template>
            </a-form>
            <div class="jexl-preview">
              <div class="jexl-preview-label">生成样式表达式：</div>
              <code>{{ editor.styleDraft }}</code>
            </div>
          </div>
        </template>
      </a-tab-pane>

      <!-- ===== Tab 3：高级 JEXL ===== -->
      <a-tab-pane key="advanced" title="JEXL 表达式（高级）">
        <div class="jexl-validate warning" style="margin-bottom: 8px">
          <icon-exclamation-circle />
          按钮组件：文本表达式请勿直接输出原始业务值；颜色表达式控制按钮样式。
        </div>
        <div class="jexl-tip">文本表达式（控制按钮文字）：</div>
        <a-textarea
          :model-value="editor.textAdvanced"
          @update:model-value="
            ((editor.textAdvanced = $event),
            (editor.textDraft = $event),
            (editor.textEditable = false))
          "
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="输入文本 JEXL 表达式"
        />
        <div class="jexl-tip" style="margin-top: 12px">样式颜色表达式（控制按钮颜色）：</div>
        <a-textarea
          :model-value="editor.styleAdvanced"
          @update:model-value="
            ((editor.styleAdvanced = $event),
            (editor.styleDraft = $event),
            (editor.styleEditable = false))
          "
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="输入样式颜色 JEXL 表达式"
        />
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { jexlTemplateTypeOptions } from '../../composables/bindingConfig'
import type { ButtonMappingState } from '../../composables/useJexl'
import type { JexlTemplateType } from '../../composables/bindingTypes'

const props = defineProps<{
  editor: ButtonMappingState | null
  visible: boolean
  applyTextTemplate: () => void
  applyStyleTemplate: () => void
  onStyleTypeChange: (type: JexlTemplateType) => void
  addTextItem: () => void
  removeTextItem: (i: number) => void
  addStyleColorPair: () => void
  removeStyleColorPair: (i: number) => void
  save: () => void
  close: () => void
}>()

/** 文本模板选项：仅 statusTextMapping */
const textTypeOptions = computed(() =>
  jexlTemplateTypeOptions
    .filter((o) => o.value === 'statusTextMapping')
    .map((o) => ({ ...o, disabled: false })),
)

/** 样式模板选项：colorMap + threshold */
const styleTypeOptions = computed(() =>
  jexlTemplateTypeOptions.filter((o) => o.value === 'colorMap' || o.value === 'threshold'),
)

const handleTabChange = () => {}
</script>

<style scoped>
.btn-mapping-tip {
  padding: 8px 12px;
  background: #e8f3ff;
  border: 1px solid #b1d0f0;
  border-radius: 4px;
  font-size: 13px;
  color: #165dff;
  margin-bottom: 12px;
}
.btn-mapping-section {
  padding: 4px 0;
}
.btn-mapping-tabs {
  margin-top: -8px;
}
.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
}
.trigger-modal-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.color-map-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.color-map-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.jexl-preview {
  margin-top: 12px;
  padding: 8px 10px;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
}
.jexl-preview-label {
  font-size: 12px;
  color: #86909c;
  margin-bottom: 4px;
}
.jexl-preview code {
  display: block;
  font-size: 12px;
  color: #1d2129;
  word-break: break-all;
  white-space: pre-wrap;
}
.jexl-tip {
  margin-bottom: 8px;
  font-size: 13px;
  color: #86909c;
  line-height: 1.8;
}
.jexl-validate {
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.jexl-validate.warning {
  color: #ff7d00;
  background: #fff7e8;
  border: 1px solid #ffcf8b;
}
</style>
