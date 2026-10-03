<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  jexlTemplateTypeOptions,
  thresholdOperatorOptions,
  ANIMATION_TEMPLATE_OPTIONS,
  ANIM_START_OPTIONS,
  allowedTemplateTypesFor,
} from '../../composables/bindingConfig'
import type { JexlEditorState, JexlValidateResult } from '../../composables/useJexl'
import type { JexlTemplateType } from '../../composables/bindingTypes'

const props = defineProps<{
  /** useJexl 返回的编辑器状态 */
  editor: JexlEditorState | null
  visible: boolean
  validateResult: JexlValidateResult | null
  onTemplateTypeChange: (type: JexlTemplateType) => void
  applyTemplate: () => void
  onAdvancedInput: () => void
  checkJexl: () => void
  saveJexl: () => void
  addColorPair: () => void
  removeColorPair: (i: number) => void
  addThresholdRule: () => void
  removeThresholdRule: (i: number) => void
  addMappingItem: () => void
  removeMappingItem: (i: number) => void
  close: () => void
}>()

/** 当前模板类型下拉选项：按 targetProperty.kind 严格过滤 */
const templateTypeOptions = computed(() => {
  const isButton = props.editor?.shape === 'custom-button'
  const hasStateOptions = !!(props.editor?.stateOptions && props.editor.stateOptions.length > 0)
  const allowed = allowedTemplateTypesFor(props.editor?.targetProperty, hasStateOptions)
  return jexlTemplateTypeOptions
    .filter((opt) => allowed.has(opt.value))
    .map((opt) => ({
      ...opt,
      disabled: isButton && opt.value === 'rawValue',
    }))
})

/** 是否按钮组件 */
const isButton = computed(() => props.editor?.shape === 'custom-button')

/** 当前选中选项的 tooltip */
const currentOptionTooltip = computed(() => {
  const t = props.editor?.template?.type
  const opt = jexlTemplateTypeOptions.find((o) => o.value === t)
  return opt?.tooltip || ''
})

/** 当前选中选项的类别 */
const currentCategory = computed(() => {
  const t = props.editor?.template?.type
  const opt = jexlTemplateTypeOptions.find((o) => o.value === t)
  return opt?.category || 'text'
})

/** 多状态元件状态选项（用于 elementStateMapping 模板的目标状态下拉） */
const stateOptionItems = computed(() => {
  return (props.editor?.stateOptions || []).map((s) => ({
    label: s.stateName,
    value: s.stateId,
  }))
})

/** 帮助面板折叠状态 */
const helpActiveKeys = ref<string[]>([])
</script>

<template>
  <a-drawer
    v-if="editor"
    :visible="visible"
    title="编辑映射规则"
    :width="800"
    :ok-text="'保存'"
    :cancel-text="'取消'"
    @ok="saveJexl"
    @cancel="close"
  >
    <a-tabs v-model:active-key="editor.activeTab" type="rounded" class="jexl-tabs">
      <!-- ===== Tab 1：可视化模板（默认） ===== -->
      <a-tab-pane key="template" title="可视化模板">
        <template v-if="!editor.templateEditable">
          <a-result status="warning" title="当前表达式为自定义高级脚本，无法可视化编辑">
            <template #subtitle
              >请在「JEXL表达式」高级模式修改，或清空后重新通过模板配置。</template
            >
          </a-result>
        </template>

        <template v-else>
          <!-- 顶部总提示 -->
          <div class="jexl-tip-banner" style="margin-bottom: 12px">
            <icon-info-circle />
            <span
              ><b>文本输出</b
              >：控制组件展示什么文字；<b>样式颜色</b>：只改变字体/按钮颜色，不会修改显示的文字内容。</span
            >
          </div>

          <!-- 按钮组件提示 -->
          <div v-if="isButton" class="jexl-validate warning" style="margin-bottom: 8px">
            <icon-exclamation-circle />
            按钮不能直接展示原始测点数字，必须使用【状态-文本映射】映射业务文字；可搭配样式颜色实现按钮背景变色。
          </div>
          <a-form layout="vertical" size="small" :model="editor.template">
            <a-form-item label="模板类型">
              <a-select
                :model-value="editor.template.type"
                @update:model-value="onTemplateTypeChange($event as string as JexlTemplateType)"
                :options="templateTypeOptions"
                size="medium"
              >
                <template #option="{ data }">
                  <a-tooltip
                    :content="
                      data.disabled
                        ? '按钮组件不支持该文本模板，请使用【状态-文本映射】，把测点值映射为业务文字。'
                        : data.tooltip
                    "
                  >
                    <span :style="data.disabled ? 'color: #c9cdd4; cursor: not-allowed' : ''">{{
                      data.label
                    }}</span>
                  </a-tooltip>
                </template>
              </a-select>
              <template #extra>
                <div v-if="currentOptionTooltip" class="field-hint" style="margin-top: 2px">
                  {{ currentCategory === 'text' ? '📄' : '🎨' }} {{ currentOptionTooltip }}
                </div>
              </template>
            </a-form-item>

            <!-- ===== 状态颜色映射 ===== -->
            <template v-if="editor.template.type === 'colorMap'">
              <a-alert
                type="info"
                :bordered="false"
                style="margin-bottom: 12px"
                show-icon
              >
                <template #title>
                  <b>当前模式：等值匹配</b>
                </template>
                测点值<strong>完全等于</strong>左边输入值时使用对应颜色。
                <br />
                适合：开关量（0/1）、离散状态（运行/停止/故障）。
                <br />
                <template v-if="templateTypeOptions.some(o => o.value === 'threshold')">
                  👉 需要 <b>大于/小于/区间</b>（如温度>80变红）？
                  <a-button
                    type="text"
                    size="mini"
                    @click="onTemplateTypeChange('threshold')"
                    style="padding: 0 4px"
                    >切换到【阈值颜色】</a-button
                  >
                </template>
              </a-alert>
              <a-form-item label="状态 → 颜色映射">
                <div class="color-map-list">
                  <div v-for="(p, i) in editor.template.colorPairs" :key="i" class="color-map-row">
                    <a-input
                      :model-value="String(p.value)"
                      @update:model-value="
                        ((editor.template.colorPairs[i].value = $event), applyTemplate())
                      "
                      :placeholder="
                        i === editor.template.colorPairs.length - 1 ? '默认色（留空）' : '值，如 1'
                      "
                      style="width: 120px"
                      size="medium"
                    />
                    <a-color-picker
                      :model-value="p.color"
                      @update:model-value="
                        ((editor.template.colorPairs[i].color = $event), applyTemplate())
                      "
                      size="medium"
                    />
                    <a-input
                      :model-value="p.color"
                      @update:model-value="
                        ((editor.template.colorPairs[i].color = $event), applyTemplate())
                      "
                      style="width: 110px"
                      size="medium"
                    />
                    <a-tag
                      v-if="i === editor.template.colorPairs.length - 1"
                      size="small"
                      color="arcoblue"
                      >默认</a-tag
                    >
                    <a-button type="text" size="mini" status="danger" @click="removeColorPair(i)">
                      <template #icon><icon-delete /></template>
                    </a-button>
                  </div>
                </div>
                <a-button type="outline" size="mini" @click="addColorPair">
                  <template #icon><icon-plus /></template>
                  添加映射
                </a-button>
              </a-form-item>
              <div class="field-hint" style="margin-top: -8px">
                每行：状态值 → 颜色；最后一行「值留空」作为默认（兜底）颜色
              </div>
            </template>

            <!-- ===== 阈值颜色（多行可增删规则） ===== -->
            <template v-if="editor.template.type === 'threshold'">
              <div class="jexl-validate info" style="margin-bottom: 8px">
                <icon-info-circle />
                规则从上往下依次判断，命中第一条规则就使用该颜色；全部不命中，使用下方默认颜色。<br />
                ✨ 适合：大于XX变红、小于XX变蓝、多段温度区间配色。
              </div>
              <div class="field-hint" style="margin-bottom: 8px; color: #86909c">
                注意：前面规则会优先命中，请把范围更小的条件放到上方。
              </div>

              <a-form-item label="阈值规则列表">
                <div class="threshold-rule-list">
                  <div
                    v-for="(r, i) in editor.template.thresholdRules"
                    :key="i"
                    class="threshold-rule-row"
                  >
                    <a-select
                      :model-value="r.operator"
                      @update:model-value="
                        ((editor.template.thresholdRules[i].operator = String($event)),
                        String($event) === 'between'
                          ? (editor.template.thresholdRules[i].value = null)
                          : ((editor.template.thresholdRules[i].min = null),
                            (editor.template.thresholdRules[i].max = null)),
                        applyTemplate())
                      "
                      :options="thresholdOperatorOptions"
                      style="width: 150px"
                      size="medium"
                    />
                    <template v-if="r.operator === 'between'">
                      <a-input-number
                        :model-value="r.min ?? undefined"
                        @update:model-value="
                          ((editor.template.thresholdRules[i].min = $event ?? null),
                          applyTemplate())
                        "
                        placeholder="min"
                        style="width: 110px"
                        size="medium"
                      />
                      <span class="threshold-range-sep">~</span>
                      <a-input-number
                        :model-value="r.max ?? undefined"
                        @update:model-value="
                          ((editor.template.thresholdRules[i].max = $event ?? null),
                          applyTemplate())
                        "
                        placeholder="max"
                        style="width: 110px"
                        size="medium"
                      />
                    </template>
                    <template v-else>
                      <a-input-number
                        :model-value="r.value ?? undefined"
                        @update:model-value="
                          ((editor.template.thresholdRules[i].value = $event ?? null),
                          applyTemplate())
                        "
                        placeholder="阈值"
                        style="flex: 1"
                        size="medium"
                      />
                    </template>
                    <a-color-picker
                      :model-value="r.color"
                      @update:model-value="
                        ((editor.template.thresholdRules[i].color = $event), applyTemplate())
                      "
                      size="medium"
                    />
                    <a-input
                      :model-value="r.color"
                      @update:model-value="
                        ((editor.template.thresholdRules[i].color = $event), applyTemplate())
                      "
                      style="width: 110px"
                      size="medium"
                    />
                    <a-button
                      type="text"
                      size="mini"
                      status="danger"
                      @click="removeThresholdRule(i)"
                    >
                      <template #icon><icon-delete /></template>
                    </a-button>
                  </div>
                </div>
                <a-button
                  style="margin-left: 12px"
                  type="outline"
                  size="mini"
                  @click="addThresholdRule"
                >
                  <template #icon><icon-plus /></template>
                  新增阈值规则
                </a-button>
              </a-form-item>

              <a-form-item label="默认颜色">
                <div class="trigger-modal-row">
                  <a-color-picker
                    :model-value="editor.template.defaultColor"
                    @update:model-value="((editor.template.defaultColor = $event), applyTemplate())"
                    size="small"
                  />
                  <a-input
                    :model-value="editor.template.defaultColor"
                    @update:model-value="((editor.template.defaultColor = $event), applyTemplate())"
                  />
                </div>
              </a-form-item>

              <!-- 阈值颜色示例 -->
              <a-collapse :default-active-key="[]" :bordered="false" style="margin-top: 4px">
                <a-collapse-item key="threshold-example" header="查看示例">
                  <div class="help-example">
                    <div>示例：大于100红色，小于0蓝色，其余黑色</div>
                    <div class="help-example-row">第1行：大于&nbsp;&nbsp;100&nbsp;&nbsp;红色</div>
                    <div class="help-example-row">第2行：小于&nbsp;&nbsp;0&nbsp;&nbsp;蓝色</div>
                    <div class="help-example-row">默认颜色：黑色</div>
                  </div>
                </a-collapse-item>
              </a-collapse>
            </template>

            <!-- ===== 数值文本格式化 ===== -->
            <template v-if="editor.template.type === 'textFormat'">
              <div class="jexl-validate info" style="margin-bottom: 8px">
                <icon-info-circle />
                配置保留小数位数、后缀单位；示例：保留1位小数，单位℃ → 23.5 ℃
              </div>
              <a-form-item label="文本格式">
                <div class="trigger-modal-row">
                  <a-input
                    :model-value="editor.template.prefix"
                    @update:model-value="((editor.template.prefix = $event), applyTemplate())"
                    placeholder="前缀，如 I="
                    style="width: 130px"
                  />
                  <a-input-number
                    :model-value="editor.template.decimals"
                    @update:model-value="
                      ((editor.template.decimals = $event ?? 0), applyTemplate())
                    "
                    :min="0"
                    :max="6"
                    placeholder="小数位"
                    style="width: 100px"
                  />
                  <a-input
                    :model-value="editor.template.suffix"
                    @update:model-value="((editor.template.suffix = $event), applyTemplate())"
                    placeholder="后缀，如 A"
                    style="width: 130px"
                  />
                </div>
              </a-form-item>
              <div class="field-hint">例：前缀「I=」+ 保留1位小数 + 后缀「A」→ 显示 I=12.3A</div>
            </template>

            <!-- ===== 布尔文本转换 ===== -->
            <template v-if="editor.template.type === 'boolText'">
              <div class="jexl-validate info" style="margin-bottom: 8px">
                <icon-info-circle />
                测点为1/True输出开启文本；测点为0/False输出关闭文本。
              </div>
              <a-form-item label="真值显示文本">
                <a-input
                  :model-value="editor.template.trueText"
                  @update:model-value="((editor.template.trueText = $event), applyTemplate())"
                  placeholder="条件成立时显示，如：合闸"
                />
              </a-form-item>
              <a-form-item label="假值显示文本">
                <a-input
                  :model-value="editor.template.falseText"
                  @update:model-value="((editor.template.falseText = $event), applyTemplate())"
                  placeholder="条件不成立时显示，如：分闸"
                />
              </a-form-item>
            </template>

            <!-- ===== 状态-文本映射 ===== -->
            <template v-if="editor.template.type === 'statusTextMapping'">
              <div class="jexl-validate info" style="margin-bottom: 8px">
                <icon-info-circle />
                按测点等于下面的值输出对应文字；从上往下匹配，都不命中使用默认文本。<br />
                ⚠️ 只能做等值匹配，数值区间请使用【样式颜色-阈值颜色】。
              </div>
              <a-form-item label="数据源值 → 显示文本">
                <div class="color-map-list">
                  <div
                    v-for="(p, i) in editor.template.mappingItems"
                    :key="i"
                    class="color-map-row"
                  >
                    <a-input
                      :model-value="String(p.sourceValue)"
                      @update:model-value="
                        ((editor.template.mappingItems[i].sourceValue = $event), applyTemplate())
                      "
                      placeholder="值，如 1"
                      style="width: 120px"
                      size="medium"
                    />
                    <a-input
                      :model-value="p.showText"
                      @update:model-value="
                        ((editor.template.mappingItems[i].showText = $event), applyTemplate())
                      "
                      placeholder="显示文本，如 运行"
                      style="flex: 1"
                      size="medium"
                    />
                    <a-button type="text" size="mini" status="danger" @click="removeMappingItem(i)">
                      <template #icon><icon-delete /></template>
                    </a-button>
                  </div>
                </div>
                <a-button type="outline" size="mini" @click="addMappingItem">
                  <template #icon><icon-plus /></template>
                  添加映射
                </a-button>
              </a-form-item>
              <a-form-item label="缺省文本（无匹配时展示）">
                <a-input
                  :model-value="editor.template.defaultText"
                  @update:model-value="
                    ((editor.template.defaultText = String($event)), applyTemplate())
                  "
                  placeholder="如：未知状态"
                  size="medium"
                />
              </a-form-item>
            </template>

            <!-- ===== 原始值直接输出 ===== -->
            <template v-if="editor.template.type === 'rawValue'">
              <div class="jexl-raw-hint">
                直接输出绑定测点的原始值，不做任何转换。适用于文本图元动态填充文字。
              </div>
            </template>

            <!-- ===== 状态-元件状态映射 ===== -->
            <template v-if="editor.template.type === 'elementStateMapping'">
              <div class="jexl-validate info" style="margin-bottom: 8px">
                <icon-info-circle />
                该模板用于配置测点值对应元件展示状态，控制元件整体状态切换。<br />
                此规则为全局唯一规则，运行优先级最高。
              </div>
              <a-form-item label="数据源值 → 目标状态">
                <div class="color-map-list">
                  <div
                    v-for="(p, i) in editor.template.mappingItems"
                    :key="i"
                    class="color-map-row"
                  >
                    <a-input
                      :model-value="String(p.sourceValue)"
                      @update:model-value="
                        ((editor.template.mappingItems[i].sourceValue = $event), applyTemplate())
                      "
                      placeholder="值，如 1"
                      style="width: 160px"
                      size="medium"
                    />
                    <a-select
                      :model-value="p.showText"
                      @update:model-value="
                        ((editor.template.mappingItems[i].showText = String($event)),
                        applyTemplate())
                      "
                      :options="stateOptionItems"
                      placeholder="选择目标状态"
                      style="width: 140px"
                      size="medium"
                    />
                    <a-button type="text" size="mini" status="danger" @click="removeMappingItem(i)">
                      <template #icon><icon-delete /></template>
                    </a-button>
                  </div>
                </div>
                <a-button type="outline" size="mini" @click="addMappingItem">
                  <template #icon><icon-plus /></template>
                  添加映射
                </a-button>
              </a-form-item>
              <a-form-item label="缺省状态（无匹配时展示）">
                <a-select
                  :model-value="editor.template.defaultText"
                  @update:model-value="
                    ((editor.template.defaultText = String($event)), applyTemplate())
                  "
                  :options="stateOptionItems"
                  placeholder="选择缺省状态"
                />
              </a-form-item>
              <div class="field-hint" style="margin-top: -12px">
                缺省状态固定为「默认状态」，不可修改不可删除（运行时无匹配则使用默认状态）。
              </div>
            </template>

            <!-- ===== 布尔-动画映射 ===== -->
            <template v-if="editor.template.type === 'boolAnim'">
              <div class="jexl-validate info" style="margin-bottom: 8px">
                <icon-info-circle />
                测点为 1/true 时启动指定动画，为 0/false 时停止动画。
              </div>
              <a-form-item label="启动动画（真值）">
                <a-select
                  :model-value="editor.template.trueText"
                  @update:model-value="
                    ((editor.template.trueText = String($event)), applyTemplate())
                  "
                  :options="ANIM_START_OPTIONS"
                  placeholder="选择启动的动画模板"
                />
              </a-form-item>
              <div class="field-hint">假值自动输出 <code>'none'</code>（停止动画），无需配置。</div>
            </template>

            <!-- ===== 状态-动画映射 ===== -->
            <template v-if="editor.template.type === 'statusAnimMapping'">
              <div class="jexl-validate info" style="margin-bottom: 8px">
                <icon-info-circle />
                按测点值选择不同动画模板；从上往下匹配，都不命中使用缺省动画。
              </div>
              <a-form-item label="数据源值 → 动画模板">
                <div class="color-map-list">
                  <div
                    v-for="(p, i) in editor.template.mappingItems"
                    :key="i"
                    class="color-map-row"
                  >
                    <a-input
                      :model-value="String(p.sourceValue)"
                      @update:model-value="
                        ((editor.template.mappingItems[i].sourceValue = $event), applyTemplate())
                      "
                      placeholder="值，如 1"
                      style="width: 120px"
                      size="medium"
                    />
                    <a-select
                      :model-value="p.showText"
                      @update:model-value="
                        ((editor.template.mappingItems[i].showText = String($event)),
                        applyTemplate())
                      "
                      :options="ANIMATION_TEMPLATE_OPTIONS"
                      placeholder="选择动画模板"
                      style="flex: 1"
                      size="medium"
                    />
                    <a-button type="text" size="mini" status="danger" @click="removeMappingItem(i)">
                      <template #icon><icon-delete /></template>
                    </a-button>
                  </div>
                </div>
                <a-button type="outline" size="mini" @click="addMappingItem">
                  <template #icon><icon-plus /></template>
                  添加映射
                </a-button>
              </a-form-item>
              <a-form-item label="缺省动画（无匹配时）">
                <a-select
                  :model-value="editor.template.defaultText"
                  @update:model-value="
                    ((editor.template.defaultText = String($event)), applyTemplate())
                  "
                  :options="ANIMATION_TEMPLATE_OPTIONS"
                  placeholder="选择缺省动画（通常选'无动画'）"
                />
              </a-form-item>
            </template>
          </a-form>

          <!-- ===== 常用组合场景帮助面板 ===== -->
          <a-collapse
            v-model:active-key="helpActiveKeys"
            :bordered="false"
            style="margin-top: 12px"
          >
            <a-collapse-item key="help-panel" header="📌 常用配置组合参考">
              <div class="help-combos">
                <div class="help-combo">
                  <div class="help-combo-title">1. 展示原始数值，超过100文字变红</div>
                  <div class="help-combo-desc">
                    文本输出：原始值直接输出 &nbsp;|&nbsp; 样式颜色：阈值颜色
                  </div>
                </div>
                <div class="help-combo">
                  <div class="help-combo-title">2. 开关测点：0=断开，1=合闸，运行显示绿色</div>
                  <div class="help-combo-desc">
                    文本输出：布尔文本转换 &nbsp;|&nbsp; 样式颜色：状态颜色映射
                  </div>
                </div>
                <div class="help-combo">
                  <div class="help-combo-title">3. 状态码：0离线 1运行 2告警，文字和颜色都区分</div>
                  <div class="help-combo-desc">
                    文本输出：状态-文本映射 &nbsp;|&nbsp; 样式颜色：状态颜色映射
                  </div>
                </div>
                <div class="help-combo">
                  <div class="help-combo-title">4. 温度多段配色：>85红，70-85橙，<40蓝</div>
                  <div class="help-combo-desc">
                    文本输出：原始值直接输出 &nbsp;|&nbsp; 样式颜色：阈值颜色
                  </div>
                </div>
                <div class="help-combo">
                  <div class="help-combo-title">5. 只格式化数值带单位，不需要变色</div>
                  <div class="help-combo-desc">
                    文本输出：数值文本格式化 &nbsp;|&nbsp; 样式颜色：—不配置样式—
                  </div>
                </div>
              </div>
            </a-collapse-item>
          </a-collapse>

          <!-- 校验结果反馈（可视化 Tab 也可见） -->
          <div
            v-if="validateResult"
            class="jexl-validate"
            :class="validateResult.type"
            style="margin-top: 12px"
          >
            <icon-check-circle v-if="validateResult.type === 'success'" />
            <icon-exclamation-circle v-else />
            {{ validateResult.message }}
          </div>

          <!-- 模板实时生成的表达式预览 -->
          <div class="jexl-preview" style="margin-top: 12px">
            <div class="jexl-preview-label">生成表达式：</div>
            <code>{{ editor.draft }}</code>
          </div>
        </template>
      </a-tab-pane>

      <!-- ===== Tab 2：JEXL 表达式（高级） ===== -->
      <a-tab-pane key="advanced" title="JEXL 表达式（高级）">
        <div class="jexl-tip">
          <div><b>文本表达式</b>：输出组件展示的文字结果</div>
          <div>
            <b>颜色表达式</b>：输出颜色字符串，例如 <code>'#f5222d'</code>；留空代表不做颜色处理。
          </div>
          <div>⚠️ 注意：颜色表达式只控制颜色，不会改变显示文字。</div>
        </div>
        <div class="jexl-tip">
          <div>内置变量：<code>tagVal</code> = 当前绑定测点返回的原始值</div>
        </div>
        <div class="jexl-tip">
          <div>示例：</div>
          <div class="jexl-example">
            tagVal == 1 ? '#28a745' : '#333333' <span>// 0=分闸，1=合闸</span>
          </div>
          <div class="jexl-example">
            tagVal > 100 ? '#f5222d' : '#333333' <span>// 大于阈值变红</span>
          </div>
          <div class="jexl-example">"I=" + tagVal + "A" <span>// 数值直接输出文本</span></div>
        </div>
        <div class="jexl-tip">
          提示：表达式输入为空时，视为使用默认值 <code>tagVal</code>（直接输出测点原始值，不做转换）
        </div>
        <a-textarea
          :model-value="editor.draft"
          @update:model-value="((editor.draft = $event), onAdvancedInput())"
          :auto-size="{ minRows: 5, maxRows: 12 }"
          placeholder="输入 JEXL 表达式（留空 = 使用默认值 tagVal）"
        />
        <div v-if="validateResult" class="jexl-validate" :class="validateResult.type">
          <icon-check-circle v-if="validateResult.type === 'success'" />
          <icon-exclamation-circle v-else />
          {{ validateResult.message }}
        </div>
      </a-tab-pane>
    </a-tabs>

    <template #footer>
      <a-button @click="checkJexl">
        <template #icon><icon-safe /></template>
        校验
      </a-button>
      <a-button @click="close">取消</a-button>
      <a-button type="primary" @click="saveJexl">保存</a-button>
    </template>
  </a-drawer>
</template>

<style scoped>
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

.jexl-raw-hint {
  padding: 8px 10px;
  font-size: 12px;
  color: #86909c;
  background: #f7f8fa;
  border: 1px dashed #e5e6eb;
  border-radius: 4px;
}

.jexl-tip-banner {
  padding: 8px 10px;
  font-size: 12px;
  color: #4e5969;
  background: #e8f3ff;
  border: 1px solid #bedaff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.6;
}

.jexl-tip {
  margin-bottom: 8px;
  font-size: 13px;
  color: #86909c;
  line-height: 1.8;
}

.jexl-example {
  font-family: monospace;
  font-size: 12px;
  color: #4e5969;
}

.jexl-example span {
  color: #a9aeb8;
  font-family: inherit;
}

.jexl-validate {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.6;
}

.jexl-validate.success {
  color: #00b42a;
  background: #e8ffea;
  border: 1px solid #a9f0bd;
}

.jexl-validate.error {
  color: #f53f3f;
  background: #ffece8;
  border: 1px solid #fdcdc5;
}

.jexl-validate.warning {
  color: #cc7a00;
  background: #fff7e8;
  border: 1px solid #ffdbaa;
}

.jexl-validate.info {
  color: #165dff;
  background: #e8f3ff;
  border: 1px solid #bedaff;
}

.jexl-tabs {
  margin-top: 8px;
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

.threshold-rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.threshold-rule-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.threshold-range-sep {
  color: #86909c;
  font-size: 13px;
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

.help-example {
  font-size: 12px;
  color: #4e5969;
  line-height: 1.8;
}

.help-example-row {
  padding-left: 16px;
  font-family: monospace;
}

.help-combos {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-combo {
  padding: 6px 8px;
  background: #f7f8fa;
  border-radius: 4px;
  line-height: 1.6;
}

.help-combo-title {
  font-size: 12px;
  font-weight: 500;
  color: #1d2129;
}

.help-combo-desc {
  font-size: 11px;
  color: #86909c;
  margin-top: 2px;
}
</style>
