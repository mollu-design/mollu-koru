<script setup lang="ts">
import { computed } from 'vue'
import {
  type TriggerItem,
  advancedActionTypes,
  httpMethodOptions,
  logLevelOptions,
  normalActionTypes,
  triggerActionOptions,
  triggerModeOptions,
  triggerOperators,
} from '../../composables/bindingConfig'
import { getNodeProp, nodePropSelectOptions, type NodePropKind } from '../../composables/nodeProps'
import { ANIMATION_TEMPLATES, animationTemplateOptions } from '../../composables/animationConfig'
import { type AnimationTemplateId } from '../../composables/AnimationTypes'

/** 行为下拉选项（平铺，普通在前、高级在后，避免依赖未注册的 optgroup 组件） */
const groupedActionOptions = computed(() => [
  ...triggerActionOptions
    .filter((o) => normalActionTypes.includes(o.value))
    .map((o) => ({ ...o, label: o.label })),
  ...triggerActionOptions
    .filter((o) => advancedActionTypes.includes(o.value))
    .map((o) => ({ ...o, label: `${o.label}（高级）` })),
])

/** 启动图元动画：动画模板下拉（node/edge 通用全部） */
const startAnimTemplateOptions = computed(() => animationTemplateOptions('all'))

/** 启动图元动画：当前选中模板定义（用于渲染动态参数） */
const startAnimTemplateDef = computed(() => {
  const id = props.editor?.draft.actionValue?.animateTemplate as AnimationTemplateId
  return (id && ANIMATION_TEMPLATES[id]) || null
})

/** 启动图元动画：模板参数值读取 */
const startAnimParamValue = (key: string) => {
  const draft = props.editor?.draft
  const v = draft?.actionValue?.animateOptions?.[key]
  return v === undefined
    ? (startAnimTemplateDef.value?.params.find((p) => p.key === key)?.default ?? '')
    : v
}

/** 启动图元动画：设置模板（重置参数；edge 模板对节点无意义，拦截提示） */
const setStartAnimTemplate = (id: string) => {
  const draft = props.editor?.draft
  if (!draft) return
  const tpl = ANIMATION_TEMPLATES[id as AnimationTemplateId]
  if (tpl && tpl.target === 'edge') {
    // 该动画仅支持连线：目标图元若为节点则无效果，给出提示
    ;(window as any).$arco?.Message?.warning?.('该动画仅支持连线')
    return
  }
  draft.actionValue = { ...draft.actionValue, animateTemplate: id, animateOptions: {} }
}

/** 启动图元动画：设置参数 */
const setStartAnimParam = (key: string, val: any) => {
  const draft = props.editor?.draft
  if (!draft) return
  draft.actionValue = {
    ...draft.actionValue,
    animateOptions: { ...draft.actionValue?.animateOptions, [key]: val },
  }
}

const props = defineProps<{
  editor: { bId: string; index: number | null; draft: TriggerItem } | null
  visible: boolean
  title: string
  onActionTypeChange: (t: TriggerItem, actionType: any) => void
  save: () => void
  close: () => void
  /** 下发控制指令：受控设备下拉 */
  writePointDeviceOptions: () => { value: string; label: string }[]
  /** 下发控制指令：控制点下拉（设备联动） */
  writePointControlPointOptions: (deviceValue: string) => { value: string; label: string }[]
  /** 修改图元属性：目标图元下拉 */
  targetNodeOptions: () => { value: string; label: string }[]
  /** 修改图元属性：属性 key 下拉（根据目标图元动态生成；无目标时返回通用列表） */
  nodePropOptionsByTarget: (targetId: string) => { value: string; label: string }[]
  /** 修改图元属性：查询某属性在目标图元下的类型（color/state/bool/number/text） */
  nodePropKindOf: (targetId: string, propKey: string) => NodePropKind | undefined
  /** 修改图元属性：查询某 state 类型属性的可选枚举（含中文 label） */
  nodePropStatesOf: (targetId: string, propKey: string) => { label: string; value: string }[]
}>()

/** 属性 key 下拉：优先按当前选中的目标图元动态生成，未选目标时用通用属性列表兜底 */
const propKeyOptions = computed(() => {
  const raw = props.editor?.draft.actionValue?.target
  const target = Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : undefined
  if (target) return props.nodePropOptionsByTarget(target)
  return nodePropSelectOptions
})

/** 当前"目标值"属性类型：优先按目标图元动态查，未选目标时用静态表兜底 */
const propKind = computed<NodePropKind | undefined>(() => {
  const av = props.editor?.draft.actionValue
  const propKey = av?.propKey as string
  if (!propKey) return undefined
  const raw = av?.target
  const target = Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : undefined
  if (target) return props.nodePropKindOf(target, propKey)
  return getNodeProp(propKey)?.kind
})

/** setGraphAttr target 兼容：旧数据 target 可能是 string，统一归一化为 string[] */
const normalizeTargetArray = (t: unknown): string[] => {
  if (Array.isArray(t)) return t.filter((x) => typeof x === 'string')
  if (typeof t === 'string' && t) return [t]
  return []
}

/** 属性类型判断 */
const isColorKind = (k?: NodePropKind) => k === 'color'
const isStateKind = (k?: NodePropKind) => k === 'state'
const isBoolKind = (k?: NodePropKind) => k === 'bool'
const isNumberKind = (k?: NodePropKind) => k === 'number'

/** state 类型属性的可选枚举（含中文 label）：优先按目标图元动态查 */
const propStateOptions = computed(() => {
  const av = props.editor?.draft.actionValue
  const propKey = av?.propKey as string
  if (!propKey) return []
  const raw = av?.target
  const target = Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : undefined
  if (target) return props.nodePropStatesOf(target, propKey)
  // 未选目标：用静态表（含 states/stateLabels）
  const p = getNodeProp(propKey)
  const labels = p?.stateLabels ?? {}
  return (p?.states ?? []).map((s) => ({ label: labels[s] ?? s, value: s }))
})
</script>

<template>
  <a-drawer
    v-if="editor"
    :visible="visible"
    :title="title"
    :width="760"
    :ok-text="'保存'"
    :cancel-text="'取消'"
    @ok="save"
    @cancel="close"
  >
    <a-form layout="vertical" size="small" :model="editor.draft" class="trigger-form">
      <!-- 1. 启用 -->
      <a-form-item label="启用">
        <a-switch
          :model-value="!!editor.draft.enabled"
          @update:model-value="editor.draft.enabled = !!$event"
        />
        <div class="field-hint" style="margin-left: 8px">关闭后可临时停用该触发器，无需删除</div>
      </a-form-item>

      <!-- 2. 触发模式 -->
      <a-form-item label="触发模式（必选）">
        <a-select
          :model-value="editor.draft.triggerMode"
          @update:model-value="
            editor.draft.triggerMode = String($event) as 'once_change' | 'always'
          "
          :options="triggerModeOptions"
          size="medium"
        />
        <template #extra>
          <div class="field-hint" style="margin-top: 0">
            <template v-if="editor.draft.triggerMode === 'once_change'">
              条件从不满足变为满足的瞬间执行 1 次；持续满足不重复执行
            </template>
            <template v-else>
              <span class="risk-text"
                >⚠
                持续满足模式：每轮数据刷新，条件成立就重复执行，易造成重复弹窗/重复下发控制指令</span
              >
            </template>
          </div>
        </template>
      </a-form-item>

      <!-- 3. 条件区域 -->
      <a-form-item label="当测点满足">
        <div class="trigger-modal-row">
          <a-select
            :model-value="editor.draft.operator"
            @update:model-value="editor.draft.operator = String($event)"
            :options="triggerOperators"
            style="width: 130px"
            size="medium"
          />
          <a-input
            :model-value="String(editor.draft.compareValue ?? '')"
            @update:model-value="editor.draft.compareValue = $event"
            placeholder="比较值"
            style="flex: 1"
            size="medium"
          />
        </div>
        <template #extra>
          <div class="field-hint">
            <span class="risk-text">⚠ 注意：当测点值为数值时，比较值为数值，否则为字符串</span>
          </div>
        </template>
      </a-form-item>
      <!-- 4. 行为（普通 + 高级，平铺选项） -->
      <a-form-item label="行为">
        <a-select
          size="medium"
          :model-value="editor.draft.actionType"
          @update:model-value="onActionTypeChange(editor.draft, $event)"
          :options="groupedActionOptions"
        />
      </a-form-item>

      <!-- 5. 参数区域（动态表单） -->
      <a-form-item v-if="editor.draft.actionType === 'alert'" :key="'alert'" label="告警内容">
        <a-textarea
          :model-value="editor.draft.actionValue.message"
          @update:model-value="editor.draft.actionValue.message = $event"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="请输入告警内容，如：设备故障！"
        />
      </a-form-item>

      <a-form-item
        v-if="editor.draft.actionType === 'writePoint'"
        :key="'writePoint'"
        label="下发控制指令"
      >
        <div class="trigger-write-point">
          <a-select
            :model-value="editor.draft.actionValue.device"
            @update:model-value="
              ((editor.draft.actionValue.device = $event),
              (editor.draft.actionValue.controlPoint = ''))
            "
            :options="writePointDeviceOptions()"
            placeholder="受控设备"
            allow-clear
            size="medium"
          />
          <a-select
            :model-value="editor.draft.actionValue.controlPoint"
            @update:model-value="editor.draft.actionValue.controlPoint = $event"
            :options="writePointControlPointOptions(editor.draft.actionValue.device)"
            placeholder="受控控制点（可写测点）"
            :disabled="!editor.draft.actionValue.device"
            allow-clear
            size="medium"
          />
          <a-input
            :model-value="String(editor.draft.actionValue.value ?? '')"
            @update:model-value="editor.draft.actionValue.value = $event"
            placeholder="输出控制值，如：1 / 合闸"
            size="medium"
          />
        </div>
        <template #extra>
          <div class="field-hint">
            <span class="risk-text">⚠️ 警告：该行为会向现场硬件下发控制指令，请谨慎配置。</span>
          </div>
        </template>
      </a-form-item>

      <a-form-item v-if="editor.draft.actionType === 'jumpPage'" :key="'jumpPage'" label="页面地址">
        <a-input
          :model-value="editor.draft.actionValue.url"
          @update:model-value="editor.draft.actionValue.url = $event"
          placeholder="支持相对/绝对地址，如：/detail?id=1"
          size="medium"
        />
      </a-form-item>

      <a-form-item v-if="editor.draft.actionType === 'addLog'" :key="'addLog'" label="记录日志">
        <div style="flex: 1">
          <div class="field-hint" style="margin-bottom: 4px">日志级别</div>
          <a-select
            :model-value="editor.draft.actionValue.level || 'info'"
            @update:model-value="editor.draft.actionValue.level = $event"
            :options="logLevelOptions"
            size="medium"
          /><br /><br />
          <a-textarea
            :model-value="editor.draft.actionValue.content"
            @update:model-value="editor.draft.actionValue.content = $event"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :placeholder="'日志内容，支持模板变量：${tagVal} ${device} ${dataPoint} ${compareValue} ${operator}'"
          />
          <div class="field-hint" style="margin-top: 4px">
            可用模板变量：{{ '${tagVal}' }}（触发时值）、{{ '${device}' }}、{{ '${dataPoint}' }}、{{ '${compareValue}' }}、{{ '${operator}' }}、{{ '${cellLabel}' }}、{{ '${shape}' }}、{{ '${triggerId}' }}
          </div>
        </div>
      </a-form-item>

      <a-form-item
        v-if="editor.draft.actionType === 'setGraphAttr'"
        :key="'setGraphAttr'"
        label="修改图元属性"
      >
        <a-space>
          <a-select
            :model-value="normalizeTargetArray(editor.draft.actionValue.target)"
            @update:model-value="editor.draft.actionValue.target = $event"
            :options="targetNodeOptions()"
            placeholder="目标图元（可多选）"
            allow-clear
            multiple
            size="medium"
            style="width: 260px"
          />
          <a-select
            :model-value="editor.draft.actionValue.propKey"
            @update:model-value="editor.draft.actionValue.propKey = $event"
            :options="propKeyOptions"
            placeholder="属性 key"
            allow-clear
            size="medium"
            style="width: 130px"
          />
          <!-- 颜色：色板 -->
          <a-color-picker
            v-if="isColorKind(propKind)"
            :model-value="String(editor.draft.actionValue.propValue ?? '')"
            @update:model-value="editor.draft.actionValue.propValue = $event"
            showText
            size="medium"
          />
          <!-- 开关：switch -->
          <a-switch
            v-else-if="isBoolKind(propKind)"
            :model-value="!!editor.draft.actionValue.propValue"
            @update:model-value="editor.draft.actionValue.propValue = $event"
          />
          <!-- 数值：数字输入 -->
          <a-input-number
            v-else-if="isNumberKind(propKind)"
            :model-value="Number(editor.draft.actionValue.propValue ?? 0)"
            @update:model-value="editor.draft.actionValue.propValue = $event"
            size="medium"
          />
          <!-- 状态枚举：下拉（state / nodeAnim 等） -->
          <a-select
            v-else-if="isStateKind(propKind) && propStateOptions.length"
            :model-value="String(editor.draft.actionValue.propValue ?? '')"
            @update:model-value="editor.draft.actionValue.propValue = $event"
            :options="propStateOptions"
            placeholder="目标状态"
            allow-clear
            size="medium"
          />
          <!-- 默认：文本输入 -->
          <a-input
            v-else
            :model-value="String(editor.draft.actionValue.propValue ?? '')"
            @update:model-value="editor.draft.actionValue.propValue = $event"
            :placeholder="isStateKind(propKind) ? '目标状态' : '目标值'"
            size="medium"
          />
        </a-space>
        <template #extra>
          <div class="field-hint">条件满足时改属性；条件恢复后自动还原原始值（多选目标各自独立存储原始值）</div>
        </template>
      </a-form-item>

      <a-form-item
        v-if="editor.draft.actionType === 'playAudio'"
        :key="'playAudio'"
        label="播放声音告警"
      >
        <a-space>
          <a-input
            :model-value="editor.draft.actionValue.src"
            @update:model-value="editor.draft.actionValue.src = $event"
            placeholder="音频资源地址"
            size="medium"
            style="width: 510px"
          />
          <div class="field-hint" style="margin-bottom: 4px">循环播放</div>
          <a-switch
            size="medium"
            :model-value="!!editor.draft.actionValue.loop"
            @update:model-value="editor.draft.actionValue.loop = $event"
          />
        </a-space>
      </a-form-item>

      <a-form-item
        v-if="editor.draft.actionType === 'sendMsg'"
        :key="'sendMsg'"
        label="发送消息通知（高级）"
      >
        <a-space>
          <a-select
            :model-value="editor.draft.actionValue.notifyType"
            @update:model-value="editor.draft.actionValue.notifyType = $event"
            :options="[
              { label: '站内信', value: 'station' },
              { label: '短信', value: 'sms' },
            ]"
            placeholder="通知类型"
            allow-clear
            size="medium"
          />
          <a-input
            :model-value="editor.draft.actionValue.receiver"
            @update:model-value="editor.draft.actionValue.receiver = $event"
            placeholder="接收人"
            size="medium"
          />
        </a-space>
      </a-form-item>

      <a-textarea
        v-if="editor.draft.actionType === 'sendMsg'"
        :model-value="editor.draft.actionValue.content"
        @update:model-value="editor.draft.actionValue.content = $event"
        :auto-size="{ minRows: 2, maxRows: 5 }"
        placeholder="通知内容"
      />

      <a-form-item
        v-if="editor.draft.actionType === 'openDialog'"
        :key="'openDialog'"
        label="打开业务弹窗（高级）"
      >
        <a-space :fill="true">
          <a-select
            :model-value="editor.draft.actionValue.dialogType"
            @update:model-value="editor.draft.actionValue.dialogType = $event"
            :options="[
              { label: '设备详情', value: 'deviceDetail' },
              { label: '历史曲线', value: 'history' },
            ]"
            placeholder="弹窗类型"
            allow-clear
            size="medium"
            style="width: 150px;"
          />
          <a-select
            :model-value="editor.draft.actionValue.deviceId"
            @update:model-value="editor.draft.actionValue.deviceId = $event"
            :options="writePointDeviceOptions()"
            placeholder="选设备，或输入外部ID（留空=自动用触发源设备）"
            allow-clear
            show-search
            allow-create
            size="medium"
            style="width: 360px;"
          />
        </a-space>
      </a-form-item>

      <a-form-item
        v-if="editor.draft.actionType === 'httpRequest'"
        :key="'httpRequest'"
        label="执行HTTP请求（高级）"
      >
        <div class="trigger-modal-row">
          <a-select
            :model-value="editor.draft.actionValue.method || 'GET'"
            @update:model-value="editor.draft.actionValue.method = $event"
            :options="httpMethodOptions"
            style="width: 110px"
            size="medium"
          />
          <a-input
            :model-value="editor.draft.actionValue.url"
            @update:model-value="editor.draft.actionValue.url = $event"
            placeholder="请求地址"
            style="flex: 1"
            size="medium"
          />
        </div>
      </a-form-item>

      <a-textarea
        v-if="editor.draft.actionType === 'httpRequest'"
        :model-value="editor.draft.actionValue.body"
        @update:model-value="editor.draft.actionValue.body = $event"
        :auto-size="{ minRows: 2, maxRows: 5 }"
        placeholder="请求体（JSON）"
      />

      <a-form-item
        v-if="editor.draft.actionType === 'runScript'"
        :key="'runScript'"
        label="执行脚本（高级）"
      >
        <a-textarea
          :model-value="editor.draft.actionValue.script"
          @update:model-value="editor.draft.actionValue.script = $event"
          :auto-size="{ minRows: 4, maxRows: 10 }"
          placeholder="JEXL/JS 脚本，内置变量 tagVal"
        />
      </a-form-item>

      <!-- 启动图元动画 -->
      <template v-if="editor.draft.actionType === 'startAnimation'">
        <a-form-item label="目标图元">
          <a-select
            :model-value="editor.draft.actionValue.targetCellId"
            @update:model-value="editor.draft.actionValue.targetCellId = $event"
            :options="targetNodeOptions()"
            placeholder="选择目标图元"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="动画模板">
          <a-select
            :model-value="editor.draft.actionValue.animateTemplate"
            @update:model-value="setStartAnimTemplate(String($event))"
            :options="startAnimTemplateOptions"
            placeholder="选择动画模板"
          />
          <template #extra>
            <div v-if="startAnimTemplateDef" class="field-hint">{{ startAnimTemplateDef.desc }}</div>
          </template>
        </a-form-item>
        <a-form-item v-for="p in startAnimTemplateDef?.params || []" :key="p.key" :label="p.label">
          <a-input-number
            v-if="p.type === 'number'"
            :model-value="Number(startAnimParamValue(p.key))"
            @update:model-value="setStartAnimParam(p.key, $event)"
            :min="p.min"
            :max="p.max"
            :step="p.step"
            style="width: 100%"
          />
          <a-color-picker
            v-else-if="p.type === 'color'"
            size="small"
            :model-value="String(startAnimParamValue(p.key))"
            @update:model-value="setStartAnimParam(p.key, $event)"
          />
        </a-form-item>
        <div class="field-hint">条件命中时，给目标图元挂载并播放所选动画模板。</div>
      </template>

      <!-- 停止图元动画 -->
      <template v-if="editor.draft.actionType === 'stopAnimation'">
        <a-form-item label="目标图元">
          <a-select
            :model-value="editor.draft.actionValue.targetCellId"
            @update:model-value="editor.draft.actionValue.targetCellId = $event"
            :options="targetNodeOptions()"
            placeholder="选择目标图元"
            allow-clear
          />
        </a-form-item>
        <div class="field-hint">
          条件命中时，调用 cancel() 终止该节点全部动画（如故障恢复后停止闪烁）。
        </div>
      </template>

      <!-- 高危行为防护：防抖 + 二次确认（下发控制指令） -->
      <template v-if="editor.draft.actionType === 'writePoint'">
        <a-form-item label="防抖时间 (ms)">
          <a-input-number
            :model-value="editor.draft.debounceMs ?? 0"
            @update:model-value="editor.draft.debounceMs = $event"
            :min="0"
            :max="60000"
            :step="100"
            placeholder="0=不防抖"
            style="width: 100%"
            size="medium"
          />
          <template #extra>
            <div class="field-hint">条件稳定 N 毫秒后才执行，过滤测点抖动毛刺（可选）</div>
          </template>
        </a-form-item>
        <a-form-item label="执行前弹窗确认">
          <a-switch
            size="medium"
            :model-value="!!editor.draft.confirmBefore"
            @update:model-value="editor.draft.confirmBefore = !!$event"
          />
          <div class="field-hint" style="margin-left: 12px">
            开启后条件命中先弹确认框，人工确认才下发指令，防止自动误动作
          </div>
        </a-form-item>
      </template>
    </a-form>
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

.risk-text {
  margin-top: 6px;
  font-size: 12px;
  color: #f53f3f;
  line-height: 1.6;
}

.trigger-write-point {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.trigger-form :deep(.arco-form-item) {
  margin-bottom: 14px;
}
</style>
