<script setup lang="ts">
import { computed, ref } from 'vue'
import KoruMappingModal from './KoruMappingModal.vue'
import type { PropertyChange } from './KoruMappingModal.vue'
import KoruConditionEditorModal, { type Condition } from './KoruConditionEditorModal.vue'
import { getNodeProp, getNodePropsByShape, operatorsByKind } from '../../composables/nodeProps'

// ============ 类型定义 ============

/** 单组属性更改配置（本地扩展） */
interface LocalPropertyChange {
  id: string
  targetCellId: string
  targetProperty: string
  expectedValue: any
}

/** 外部前置请求配置（仅开关，请求逻辑由宿主 outerRequestApi 处理） */
interface OuterRequestConfig {
  /** 是否开启前置请求 */
  enable: boolean
  /** 以下字段为运行时内部使用，不在 UI 中暴露 */
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: string
  timeout?: number
  headers?: string
}

/** 单个事件项 */
interface EventItem {
  id: string
  enabled: boolean
  type: string
  action: string
  targetNode?: string
  propertyChanges?: PropertyChange[]
  actionParam?: string
  deviceId?: string
  deviceCommand?: string
  deviceParam?: string
  codes?: string[]
  condition: Condition
  /** 外部前置请求（可选） */
  outerRequest?: OuterRequestConfig
}

interface EventConfig {
  enabled: boolean
  list: EventItem[]
}

const DEFAULT_CONDITION: Condition = {
  targetCellId: '',
  relation: 'none',
  field: '',
  operator: '',
  value: '',
}

const newEvent = (selfCellId?: string): EventItem => ({
  id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  enabled: true,
  type: 'click',
  action: 'changeProperty',
  targetNode: selfCellId || '',
  propertyChanges: [],
  condition: { ...DEFAULT_CONDITION },
})

// ============ 节点属性定义（简化版 useNodeProps） ============
// 已迁移至 ../../composables/node.ts，通过上方 import 引入。

// ============ Props & Emits ============

interface NodeOption {
  value: string
  label: string
  shape?: string
  data?: Record<string, any>
}

const props = defineProps<{
  cellProps: Record<string, any>
  allNodes?: NodeOption[]
  selfCellId?: string
  deviceOptions?: NodeOption[]
}>()

const emit = defineEmits<{
  (e: 'update', key: string, value: any): void
}>()

// ============ 事件配置管理 ============

const targetNodeOptions = computed<NodeOption[]>(() => {
  const nodes = (props.allNodes ?? []).slice()
  const selfId = props.selfCellId
  if (selfId && !nodes.some((n) => n.value === selfId)) {
    nodes.unshift({ value: selfId, label: '当前元素' })
  }
  return nodes
})

const config = computed<EventConfig>(() => {
  const raw = props.cellProps.eventConfig
  if (raw && Array.isArray(raw.list)) {
    return { enabled: !!raw.enabled, list: raw.list }
  }
  return { enabled: true, list: [] }
})

const updateConfig = (list: EventItem[]) => {
  emit('update', 'eventConfig', { enabled: config.value.enabled, list })
}

const updateEvent = (id: string, patch: Partial<EventItem>) => {
  const list = config.value.list.map((e) => (e.id === id ? { ...e, ...patch } : e))
  updateConfig(list)
}

const updateCondition = (id: string, patch: Partial<Condition>) => {
  const list = config.value.list.map((e) => {
    if (e.id !== id) return e
    const mergedCondition: Condition = { ...e.condition, ...patch }
    // 切换条件类型时清理不相关的残留数据
    if (patch.relation !== undefined) {
      if (patch.relation === 'none') {
        // 无条件：清空所有条件字段
        mergedCondition.field = ''
        mergedCondition.operator = ''
        mergedCondition.value = ''
        mergedCondition.targetCellId = ''
        mergedCondition.codes = undefined
      } else if (patch.relation === 'custom-code') {
        // 自定义代码条件：清空关系运算字段
        mergedCondition.field = ''
        mergedCondition.operator = ''
        mergedCondition.value = ''
        mergedCondition.targetCellId = ''
      } else if (patch.relation === 'relation') {
        // 关系运算条件：清空自定义代码字段
        mergedCondition.codes = undefined
      }
    }
    return { ...e, condition: mergedCondition }
  })
  updateConfig(list)
}

const addEvent = () => {
  updateConfig([...config.value.list, newEvent(props.selfCellId)])
}

const removeEvent = (id: string) => {
  updateConfig(config.value.list.filter((e) => e.id !== id))
}

/** 开启/关闭外部前置请求（仅开关，请求逻辑由宿主 outerRequestApi 处理） */
const toggleOuterRequest = (id: string, enable: boolean) => {
  const list = config.value.list.map((e) => {
    if (e.id !== id) return e
    return {
      ...e,
      outerRequest: { ...e.outerRequest, enable },
    }
  })
  updateConfig(list)
}

/** 删除条件：完全重置为默认状态 */
const removeCondition = (id: string) => {
  updateConfig(
    config.value.list.map((e) =>
      e.id === id
        ? {
            ...e,
            condition: {
              ...DEFAULT_CONDITION,
            },
          }
        : e,
    ),
  )
}

// ============ 代码编辑弹窗 ============

/** 脚本内置变量元数据（对齐 useScriptLib.ts 的 scriptInnerLib） */
interface ScriptVarMeta {
  name: string
  type: string
  desc: string
  example: string
}

const scriptVars: ScriptVarMeta[] = [
  {
    name: '$topoItem',
    type: 'Cell',
    desc: '当前触发事件的图元对象（X6 Cell）',
    example: '$topoItem.get("fill")',
  },
  {
    name: '$topoCanvas',
    type: 'Graph',
    desc: '画布实例（AntV X6 Graph）',
    example: '$topoCanvas.getCells()',
  },
  { name: '$topoArgs', type: 'Object', desc: '事件参数集合', example: '$topoArgs.type' },
  {
    name: '$topoEventCallBack',
    type: 'Function',
    desc: '触发外部订阅回调',
    example: '$topoEventCallBack("alarm", $topoItem)',
  },
  {
    name: '$topoLog',
    type: 'Object',
    desc: '脚本日志输出（info/warn/error）',
    example: '$topoLog.info("执行完成")',
  },
  {
    name: '$topoMessage',
    type: 'Object',
    desc: '消息提示（success/error/warning）',
    example: '$topoMessage.success("操作成功")',
  },
  {
    name: '$topoCanvasApi',
    type: 'Object',
    desc: '画布操作 API（查询/修改图元）',
    example: '$topoCanvasApi.getItemById("node-id")',
  },
  {
    name: '$topoStore',
    type: 'Object',
    desc: '全局业务状态，读写全局变量',
    example: '$topoStore.myKey = "value"',
  },
  {
    name: '$topoTime',
    type: 'Object',
    desc: '时间工具（now/format）',
    example: '$topoTime.now()',
  },
  {
    name: '$topoUtil',
    type: 'Object',
    desc: '通用工具（clone/isEmpty）',
    example: '$topoUtil.isEmpty(val)',
  },
]

/** 条件代码示例（返回 boolean） */
const codeSnippets: { label: string; code: string }[] = [
  {
    label: '图元填充色为红色',
    code: `$topoItem.get('fill') === 'red'`,
  },
  {
    label: '图元宽度大于 100',
    code: `$topoItem.get('width') > 100`,
  },
  {
    label: '多条件组合',
    code: `$topoItem.get('fill') === 'red' && $topoItem.get('width') > 100`,
  },
  {
    label: '图元 ID 匹配',
    code: `$topoItem.id === 'target-id'`,
  },
  {
    label: '画布中图元数量 > 5',
    code: `$topoCanvas.getCells().length > 5`,
  },
]

/** 动作代码示例（执行操作） */
const actionCodeSnippets: { label: string; code: string }[] = [
  {
    label: '输出日志',
    code: `$topoLog.info('按钮被点击了')`,
  },
  {
    label: '获取图元 fill 属性',
    code: `$topoLog.info('当前填充色: ' + $topoItem.get('fill'))`,
  },
  {
    label: '触发外部事件',
    code: `$topoEventCallBack('custom-event', $topoItem.id)`,
  },
  {
    label: '修改图元属性',
    code: `$topoItem.attr('body/fill', '#FF0000')`,
  },
  {
    label: '查找并修改其他图元',
    code: `const target = $topoCanvas.getItemById('target-id'); if (target) target.attr('body/fill', '#00FF00')`,
  },
  {
    label: '遍历所有图元',
    code: `$topoCanvas.getCells().forEach(c => $topoLog.info(c.id + ': ' + c.shape))`,
  },
]

/** 将选中的文本或模板代码插入到 textarea 光标位置 */
const insertIntoDraft = (text: string) => {
  // Arco a-textarea 组件内部才是原生 <textarea>，需要穿透查询
  const wrapper = document.querySelector('.code-editor-textarea')
  const el = wrapper?.querySelector('textarea') as HTMLTextAreaElement | null
  if (!el) {
    codeEditorDraft.value = text
    return
  }
  // 点击 dropdown 时 textarea 已失焦，selectionStart 可能为 0，
  // 此时将文本追加到末尾更合理
  const isFocused = document.activeElement === el
  const start = isFocused
    ? (el.selectionStart ?? codeEditorDraft.value.length)
    : codeEditorDraft.value.length
  const end = isFocused
    ? (el.selectionEnd ?? codeEditorDraft.value.length)
    : codeEditorDraft.value.length
  const before = codeEditorDraft.value.substring(0, start)
  const after = codeEditorDraft.value.substring(end)
  codeEditorDraft.value = before + text + after
  // 恢复光标到插入位置之后
  requestAnimationFrame(() => {
    el.focus()
    const pos = start + text.length
    el.setSelectionRange(pos, pos)
  })
}

/** 代码编辑器状态（scope 区分触发条件 / 自定义代码行为） */
type CodeEditorScope = 'condition' | 'action'
interface CodeEditorState {
  evtId: string
  index: number
  scope: CodeEditorScope
}

const codeEditorState = ref<CodeEditorState | null>(null)
const codeEditorDraft = ref('')

const codeEditorVisible = computed({
  get: () => codeEditorState.value !== null,
  set: (v: boolean) => {
    if (!v) codeEditorState.value = null
  },
})

const openCodeEditor = (evtId: string, index: number, scope: CodeEditorScope = 'condition') => {
  const evt = config.value.list.find((e) => e.id === evtId)
  if (!evt) return
  codeEditorState.value = { evtId, index, scope }
  const codes = scope === 'condition' ? (evt.condition.codes ?? []) : (evt.codes ?? [])
  codeEditorDraft.value = codes[index] ?? ''
}

const saveCodeEditor = () => {
  const st = codeEditorState.value
  if (!st) return
  if (st.scope === 'condition') {
    updateCode(st.evtId, st.index, codeEditorDraft.value)
  } else {
    updateActionCode(st.evtId, st.index, codeEditorDraft.value)
  }
  codeEditorState.value = null
}

const closeCodeEditor = () => {
  codeEditorState.value = null
}

const codeEditorTitle = computed(() => {
  if (!codeEditorState.value) return '代码编辑器'
  const scope = codeEditorState.value.scope
  const label = scope === 'condition' ? '触发条件' : '自定义代码'
  return `${label} 代码段${codeEditorState.value.index + 1}编写`
})

/** 当前模式对应的示例代码 */
const currentSnippets = computed(() => {
  if (!codeEditorState.value) return codeSnippets
  return codeEditorState.value.scope === 'action' ? actionCodeSnippets : codeSnippets
})

/** 当前模式对应的 placeholder */
const codeEditorPlaceholder = computed(() => {
  if (!codeEditorState.value) return '在此输入 JavaScript 代码'
  return codeEditorState.value.scope === 'action'
    ? '在此输入 JavaScript 代码（如：$topoLog.info("执行成功")），代码会直接执行'
    : '在此输入 JavaScript 代码，返回 true 表示满足触发条件'
})

// ============ 自定义代码管理 ============

const addCode = (evtId: string) => {
  const evt = config.value.list.find((e) => e.id === evtId)
  if (!evt) return
  const codes = [...(evt.condition.codes ?? []), 'return true;']
  updateCondition(evtId, { codes })
}

const removeCode = (evtId: string, index: number) => {
  const evt = config.value.list.find((e) => e.id === evtId)
  if (!evt) return
  const codes = (evt.condition.codes ?? []).filter((_, i) => i !== index)
  updateCondition(evtId, { codes })
}

const updateCode = (evtId: string, index: number, value: string) => {
  const evt = config.value.list.find((e) => e.id === evtId)
  if (!evt) return
  const codes = [...(evt.condition.codes ?? [])]
  codes[index] = value
  updateCondition(evtId, { codes })
}

// 行为自定义代码
const addActionCode = (evtId: string) => {
  const evt = config.value.list.find((e) => e.id === evtId)
  if (!evt) return
  const codes = [...(evt.codes ?? []), `$topoLog.info('执行成功')`]
  updateEvent(evtId, { codes })
}

const removeActionCode = (evtId: string, index: number) => {
  const evt = config.value.list.find((e) => e.id === evtId)
  if (!evt) return
  const codes = (evt.codes ?? []).filter((_, i) => i !== index)
  updateEvent(evtId, { codes })
}

const updateActionCode = (evtId: string, index: number, value: string) => {
  const evt = config.value.list.find((e) => e.id === evtId)
  if (!evt) return
  const codes = [...(evt.codes ?? [])]
  codes[index] = value
  updateEvent(evtId, { codes })
}

// ============ 选项常量 ============

const eventTypes = [
  { label: '单击', value: 'click' },
  { label: '双击', value: 'dblclick' },
  { label: '鼠标移入', value: 'mouseenter' },
  { label: '鼠标移出', value: 'mouseleave' },
  { label: '鼠标按下', value: 'mousedown' },
  { label: '鼠标松开', value: 'mouseup' },
  { label: '鼠标移动', value: 'mousemove' },
  { label: '鼠标悬浮', value: 'mouseover' },
  { label: '鼠标离开', value: 'mouseout' },
]

const actionTypes = [
  { label: '更改属性', value: 'changeProperty' },
  { label: '打开页面', value: 'openUrl' },
  { label: '发送指令', value: 'sendCommand' },
  { label: '显示弹窗', value: 'showDialog' },
  { label: '控制设备', value: 'controlDevice' },
  { label: '执行自定义代码', value: 'customCode' },
  { label: '无动作', value: 'none' },
]

const relations = [
  { label: '无', value: 'none' },
  { label: '关系运算', value: 'relation' },
  { label: '自定义代码', value: 'custom-code' },
]

/** 行为参数字段配置 */
interface ActionField {
  key: string
  label: string
  type?: 'input' | 'select'
  placeholder: string
  optionsKey?: 'deviceOptions'
}

const actionFieldConfig: Record<string, ActionField[] | undefined> = {
  openUrl: [{ key: 'actionParam', label: '页面地址', placeholder: 'https:// 或相对路径' }],
  sendCommand: [{ key: 'actionParam', label: '指令内容', placeholder: '请输入要发送的指令' }],
  showDialog: [{ key: 'actionParam', label: '弹窗内容', placeholder: '请输入弹窗显示的内容' }],
  controlDevice: [
    {
      key: 'deviceId',
      label: '设备ID',
      type: 'select',
      optionsKey: 'deviceOptions',
      placeholder: '选择目标设备',
    },
    { key: 'deviceCommand', label: '设备指令', placeholder: '请输入控制设备的指令' },
    { key: 'deviceParam', label: '指令参数', placeholder: '指令附加参数，可选' },
  ],
}

const readActionField = (evt: EventItem, key: string): string => String((evt as any)[key] ?? '')

// ============ 触发条件摘要 ============

const conditionSummary = (evt: EventItem): string => {
  const c = evt.condition
  if (c.relation === 'custom-code') {
    const n = c.codes?.length || 0
    return `自定义代码（${n} 段）`
  }
  if (c.relation === 'relation') {
    // 目标图元名称
    const targetNode = (props.allNodes ?? []).find((n) => n.value === c.targetCellId)
    const nodeLabel = targetNode?.label ?? (c.targetCellId ? c.targetCellId : '当前图元')

    // 先查通用属性，再按 targetCell 的 shape 查扩展属性
    let prop = getNodeProp(c.field)
    if (!prop && c.targetCellId && targetNode?.shape) {
      prop = getNodePropsByShape(targetNode.shape).find((p) => p.value === c.field)
    }
    if (!prop) {
      const shape = props.cellProps.shape
      if (shape) {
        prop = getNodePropsByShape(shape).find((p) => p.value === c.field)
      }
    }

    const fieldLabel = prop?.label ?? c.field ?? ''
    const opLabel =
      operatorsByKind(prop?.kind).find((o) => o.value === c.operator)?.label ?? c.operator ?? ''

    // valLabel：state 类型查中文标签，其他类型直接字符串化
    const rawVal = c.value
    let valLabel: string
    if (rawVal === undefined || rawVal === null) {
      valLabel = ''
    } else if (prop?.kind === 'state' && prop.stateLabels) {
      valLabel = prop.stateLabels[String(rawVal)] ?? String(rawVal)
    } else {
      valLabel = String(rawVal)
    }

    if (!fieldLabel || !opLabel || !valLabel) {
      return ''
    }
    return `当【${nodeLabel}】的【${fieldLabel}】${opLabel}【${valLabel}】时执行事件`
  }
  return '无条件'
}

/** 属性更改数量 */
const changeCount = (evt: EventItem) => (evt.propertyChanges || []).length

// ============ 属性更改弹窗 ============

/** 当前打开弹窗对应的事件 id */
const openChangeId = ref<string | null>(null)

const openChangeModal = (id: string) => {
  openChangeId.value = id
}

const closeChangeModal = () => {
  openChangeId.value = null
}

const changeModalVisible = computed({
  get: () => openChangeId.value !== null,
  set: (v: boolean) => {
    if (!v) openChangeId.value = null
  },
})

/** 当前编辑的事件项（弹窗绑定） */
const editingEvent = computed<EventItem | undefined>(() =>
  config.value.list.find((e) => e.id === openChangeId.value),
)

const editingEventIndex = computed(() =>
  config.value.list.findIndex((e) => e.id === openChangeId.value),
)

const editingChanges = computed<PropertyChange[]>({
  get: () => editingEvent.value?.propertyChanges ?? [],
  set: (v: PropertyChange[]) => {
    if (editingEvent.value) updateEvent(editingEvent.value.id, { propertyChanges: v })
  },
})

/** 弹窗标题 */
const modalTitle = computed(() => {
  if (editingEventIndex.value < 0) return '属性更改配置'
  return `事件${editingEventIndex.value + 1}属性更改配置`
})

// ============ 触发条件编辑弹窗 ============

/** 当前打开条件弹窗对应的事件 id */
const openConditionId = ref<string | null>(null)

const openConditionModal = (id: string) => {
  openConditionId.value = id
}

const closeConditionModal = () => {
  openConditionId.value = null
}

const conditionModalVisible = computed({
  get: () => openConditionId.value !== null,
  set: (v: boolean) => {
    if (!v) openConditionId.value = null
  },
})

/** 当前编辑条件的事件项 */
const editingConditionEvent = computed<EventItem | undefined>(() =>
  config.value.list.find((e) => e.id === openConditionId.value),
)

const editingCondition = computed<Condition>({
  get: () =>
    editingConditionEvent.value?.condition ?? {
      relation: 'relation',
      field: '',
      operator: '',
      value: '',
    },
  set: (v: Condition) => {
    if (editingConditionEvent.value) updateCondition(editingConditionEvent.value.id, v)
  },
})

const conditionModalTitle = computed(() => {
  if (!editingConditionEvent.value) return '触发条件编辑'
  const idx = config.value.list.findIndex((e) => e.id === editingConditionEvent.value!.id)
  return `事件${idx + 1}触发条件编辑`
})
</script>

<template>
  <div class="koru-event-panel">
    <!-- <a-switch
      :model-value="config.enabled"
      @update:model-value="(v) => emit('update', 'eventConfig', { ...config, enabled: v })"
    >
      <template #checked>事件已启用</template>
      <template #unchecked>事件已禁用</template>
    </a-switch>

    <a-divider :margin="8" /> -->

    <a-button type="primary" long size="medium" class="add-event-btn" @click="addEvent">
      添加事件
    </a-button>

    <a-empty v-if="config.list.length === 0" description='暂无事件，点击上方"添加事件"创建' />

    <a-collapse v-else :expand-icon-position="'right'" :show-expand-icon="true">
      <a-collapse-item v-for="(evt, idx) in config.list" :key="evt.id" :header="'事件' + (idx + 1)">
        <template #extra>
          <!-- 外部前置请求开关 -->
          <a-tooltip position="lt" content="开启后，触发时会先调宿主外部接口，成功才执行内部动作">
            <a-switch
              style="margin-right: 12px"
              size="small"
              :model-value="!!evt.outerRequest?.enable"
              @click.stop
              @update:model-value="toggleOuterRequest(evt.id, $event as boolean)"
            >
              <template #checked>前置请求</template>
            </a-switch>
          </a-tooltip>
          <a-switch
            size="small"
            :model-value="!!evt.enabled"
            @click.stop
            @update:model-value="updateEvent(evt.id, { enabled: $event as boolean })"
          />
          <a-popconfirm
            content="删除该事件？"
            :ok-text="'删除'"
            :cancel-text="'取消'"
            position="tr"
            @ok="removeEvent(evt.id)"
          >
            <a-button @click.stop style="margin-left: 6px" type="text" size="mini" status="danger">
              <template #icon><icon-delete /></template>
            </a-button>
          </a-popconfirm>
        </template>

        <a-form :model="evt" layout="vertical" size="small">
          <!-- 事件类型 -->
          <a-form-item label="事件类型">
            <a-select
              size="medium"
              :model-value="String(evt.type ?? 'click')"
              @update:model-value="updateEvent(evt.id, { type: $event as string })"
              :options="eventTypes"
              placeholder="选择事件类型"
            />
          </a-form-item>

          <!-- 事件行为 -->
          <a-form-item label="事件行为">
            <a-select
              size="medium"
              :model-value="String(evt.action ?? 'changeProperty')"
              @update:model-value="updateEvent(evt.id, { action: $event as string })"
              :options="actionTypes"
              placeholder="选择触发行为"
            />
          </a-form-item>

          <!-- 目标图元 -->
          <a-form-item label="目标图元" v-if="evt.action === 'changeProperty'">
            <a-select
              size="medium"
              :model-value="String(evt.targetNode || selfCellId || '')"
              @update:model-value="updateEvent(evt.id, { targetNode: $event as string })"
              :options="targetNodeOptions"
              placeholder="选择目标图元"
              allow-clear
            />
          </a-form-item>

          <!-- 行为: 更改属性（弹窗编辑） -->
          <template v-if="evt.action === 'changeProperty'">
            <a-form-item>
              <a-button
                type="outline"
                long
                size="medium"
                class="open-change-btn"
                @click="openChangeModal(evt.id)"
              >
                <template #icon><icon-settings /></template>
                属性配置（已有 {{ changeCount(evt) }} 组）
              </a-button>
            </a-form-item>
          </template>

          <!-- 行为: 自定义代码 -->
          <template v-if="evt.action === 'customCode'">
            <a-form-item label="自定义代码">
              <div class="code-editor-block">
                <div class="code-editor-header">
                  <a-button type="outline" size="mini" @click="addActionCode(evt.id)">
                    <template #icon><icon-plus /></template>
                    新增代码段
                  </a-button>
                </div>
                <!-- 空状态 -->
                <div v-if="!evt.codes || evt.codes.length === 0" class="code-editor-empty">
                  暂无代码，点击"新增代码段"添加
                </div>
                <!-- 代码段列表 -->
                <div v-for="(c, cIdx) in evt.codes || []" :key="cIdx" class="code-editor-item">
                  <div class="code-editor-item-header">
                    <span>代码段 {{ cIdx + 1 }}</span>
                    <span class="code-editor-item-actions">
                      <a-button
                        type="text"
                        size="mini"
                        @click="openCodeEditor(evt.id, cIdx, 'action')"
                      >
                        <template #icon><icon-edit /></template>
                        编辑
                      </a-button>
                      <a-popconfirm
                        position="tr"
                        content="删除该代码段？"
                        :ok-text="'删除'"
                        :cancel-text="'取消'"
                        @ok="removeActionCode(evt.id, cIdx)"
                      >
                        <a-button type="text" size="mini" status="danger">
                          <template #icon><icon-delete /></template>
                          删除
                        </a-button>
                      </a-popconfirm>
                    </span>
                  </div>
                  <!-- 代码内容预览（点击编辑） -->
                  <div class="code-editor-preview" @click="openCodeEditor(evt.id, cIdx, 'action')">
                    {{
                      String(c ?? '')
                        .replace(/\n/g, ' ')
                        .slice(0, 80) || '（空代码）'
                    }}
                  </div>
                </div>
              </div>
            </a-form-item>
          </template>

          <!-- 其他行为参数 -->
          <template v-if="actionFieldConfig[evt.action]">
            <a-form-item
              v-for="field in actionFieldConfig[evt.action]"
              :key="field.key"
              :label="field.label"
            >
              <a-select
                v-if="field.type === 'select'"
                size="medium"
                :model-value="readActionField(evt, field.key)"
                @update:model-value="updateEvent(evt.id, { [field.key]: $event as string })"
                :options="field.optionsKey ? (props[field.optionsKey] ?? []) : []"
                :placeholder="field.placeholder"
                allow-clear
              />
              <a-textarea
                v-else
                auto-size
                size="medium"
                :model-value="readActionField(evt, field.key)"
                @update:model-value="updateEvent(evt.id, { [field.key]: $event as string })"
                :placeholder="field.placeholder"
                allow-clear
              />
            </a-form-item>
          </template>

          <!-- 触发条件 -->
          <a-divider :margin="8" />
          <a-form-item>
            <template #label>
              触发条件
              <a-tooltip
                content="设置事件触发的前置条件，满足条件时事件才会执行。可选：无条件 / 属性关系 / 自定义代码"
              >
                <icon-info-circle class="label-hint" />
              </a-tooltip>
            </template>
            <a-select
              size="medium"
              :model-value="String(evt.condition.relation ?? 'none')"
              @update:model-value="updateCondition(evt.id, { relation: $event as string })"
              :options="relations"
              placeholder="选择触发条件类型"
              style="width: 100%"
            />
          </a-form-item>

          <!-- 关系运算：弹窗编辑 -->
          <template v-if="evt.condition.relation === 'relation'">
            <div class="condition-edit-block">
              <div class="condition-summary-row">
                <a-alert
                  :show-icon="false"
                  v-if="conditionSummary(evt)"
                  class="condition-summary-desc"
                  @click="openConditionModal(evt.id)"
                  type="warning"
                >
                  {{ conditionSummary(evt) }}
                  <template v-if="conditionSummary(evt)">
                    <a-button type="text" size="mini" @click="openConditionModal(evt.id)">
                      <template #icon><icon-edit /></template>
                    </a-button>
                    <a-button
                      type="text"
                      size="mini"
                      status="danger"
                      @click="removeCondition(evt.id)"
                    >
                      <template #icon><icon-delete /></template>
                    </a-button>
                  </template>
                </a-alert>
                <a-button type="outline" size="small" v-else @click="openConditionModal(evt.id)">
                  点击配置条件
                </a-button>
              </div>
            </div>
          </template>

          <!-- 自定义代码条件 -->
          <template v-if="evt.condition.relation === 'custom-code'">
            <div class="code-editor-block">
              <div class="code-editor-title code-editor-title-top">
                自定义代码（返回 true 即满足条件）
              </div>
              <div class="code-editor-header">
                <a-button type="outline" size="mini" @click="addCode(evt.id)">
                  <template #icon><icon-plus /></template>
                  新增代码段
                </a-button>
              </div>
              <!-- 空状态 -->
              <div
                v-if="!evt.condition.codes || evt.condition.codes.length === 0"
                class="code-editor-empty"
              >
                暂无代码，点击"新增代码段"添加
              </div>
              <!-- 代码段列表 -->
              <div
                v-for="(c, cIdx) in evt.condition.codes || []"
                :key="cIdx"
                class="code-editor-item"
              >
                <div class="code-editor-item-header">
                  <span>代码段 {{ cIdx + 1 }}</span>
                  <span class="code-editor-item-actions">
                    <a-button
                      type="text"
                      size="mini"
                      @click="openCodeEditor(evt.id, cIdx, 'condition')"
                    >
                      <template #icon><icon-edit /></template>
                      编辑
                    </a-button>
                    <a-popconfirm
                      position="tr"
                      content="删除该代码段？"
                      :ok-text="'删除'"
                      :cancel-text="'取消'"
                      @ok="removeCode(evt.id, cIdx)"
                    >
                      <a-button type="text" size="mini" status="danger">
                        <template #icon><icon-delete /></template>
                        删除
                      </a-button>
                    </a-popconfirm>
                  </span>
                </div>
                <!-- 代码内容预览（点击编辑） -->
                <div class="code-editor-preview" @click="openCodeEditor(evt.id, cIdx, 'condition')">
                  {{
                    String(c ?? '')
                      .replace(/\n/g, ' ')
                      .slice(0, 80) || '（空代码）'
                  }}
                </div>
              </div>
            </div>
          </template>
        </a-form>
      </a-collapse-item>
    </a-collapse>

    <!-- 属性更改独立弹窗 -->
    <KoruMappingModal
      v-if="editingEvent"
      v-model:visible="changeModalVisible"
      v-model:model-value="editingChanges"
      :title="modalTitle"
      :all-nodes="allNodes ?? []"
      :self-cell-id="selfCellId"
      :default-target-cell-id="editingEvent.targetNode"
      @update:visible="closeChangeModal"
    />

    <!-- 触发条件独立弹窗 -->
    <KoruConditionEditorModal
      v-if="editingConditionEvent"
      v-model:visible="conditionModalVisible"
      v-model:model-value="editingCondition"
      :title="conditionModalTitle"
      :all-nodes="allNodes ?? []"
      @update:visible="closeConditionModal"
    />

    <!-- 自定义代码编辑弹窗 -->
    <a-modal
      :visible="codeEditorVisible"
      :title="codeEditorTitle"
      :width="720"
      :top="'10px'"
      :ok-text="'保存'"
      :cancel-text="'取消'"
      :destroy-on-close="true"
      @ok="saveCodeEditor"
      @cancel="closeCodeEditor"
    >
      <!-- 顶部提示 + 帮助 -->
      <div class="code-editor-tip-bar">
        <span v-if="codeEditorState?.scope === 'action'">
          编写 JavaScript 代码，代码会直接执行（如：<code>$topoLog.info('msg')</code>）
        </span>
        <span v-else>编写 JavaScript 代码，返回 <code>true</code> 表示满足触发条件</span>
        <a-popover position="br" :content-style="{ maxWidth: 340 }">
          <template #content>
            <div class="code-editor-help">
              <h4>可用变量</h4>
              <div v-for="v in scriptVars" :key="v.name" class="var-row">
                <div class="var-name">{{ v.name }}</div>
                <div class="var-type">{{ v.type }}</div>
                <div class="var-desc">{{ v.desc }}</div>
                <div class="var-example">示例：{{ v.example }}</div>
              </div>
            </div>
          </template>
          <a-button size="mini" type="text">
            <template #icon><icon-info-circle /></template>
            变量说明
          </a-button>
        </a-popover>
      </div>

      <!-- 变量快捷插入 tag 条 -->
      <div class="code-editor-var-bar">
        <span class="var-bar-label">快速插入：</span>
        <a-tooltip
          v-for="v in scriptVars"
          :key="v.name"
          :content="`${v.desc} | 示例：${v.example}`"
        >
          <a-tag
            class="var-tag"
            :bordered="false"
            :color="'arcoblue'"
            @click="insertIntoDraft(v.name)"
          >
            {{ v.name }}
          </a-tag>
        </a-tooltip>
      </div>

      <!-- 示例代码下拉插入 -->
      <a-dropdown :trigger="['click']" class="code-editor-snippets">
        <a-button size="mini" type="outline">
          <template #icon><icon-code /></template>
          插入示例代码
        </a-button>
        <template #content>
          <div
            v-for="s in currentSnippets"
            :key="s.label"
            class="snippet-item"
            @click="insertIntoDraft(s.code)"
          >
            <span class="snippet-label">{{ s.label }}</span>
            <code class="snippet-code">{{ s.code }}</code>
          </div>
        </template>
      </a-dropdown>

      <a-textarea
        v-model="codeEditorDraft"
        class="code-editor-textarea"
        :placeholder="codeEditorPlaceholder"
        :auto-size="{ minRows: 10, maxRows: 20 }"
      />
    </a-modal>
  </div>
</template>

<style lang="scss" scoped>
.koru-event-panel {
  padding: 4px 0;
}

.add-event-btn {
  margin-bottom: 12px;
}

.empty-tip {
  padding: 8px;
  text-align: center;
  font-size: 12px;
  color: #86909c;
  border: 1px dashed #e5e6eb;
  border-radius: 4px;
  margin-top: 8px;
}

.open-change-btn {
  margin-top: 4px;
}

/* 触发条件编辑块 */
.condition-edit-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.condition-summary-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.condition-summary {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  font-size: 12px;
  color: #4e5969;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* 触发条件 label 提示图标 */
.label-hint {
  margin-left: 4px;
  color: #86909c;
  font-size: 14px;
  cursor: help;
}

.condition-summary-desc {
  font-size: 12px;
  color: #86909c;
}

.condition-summary--empty {
  color: #86909c;
  font-style: normal;
  justify-content: center;
  display: flex;
  align-items: center;
}

.condition-summary:hover {
  background: #f2f3f5;
}

/* 代码编辑器 */
.code-editor-block {
  margin-top: 4px;
}

.code-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.code-editor-title {
  font-size: 12px;
  color: #4e5969;
}

.code-editor-title-top {
  margin-top: -10px;
  margin-bottom: 12px;
}

.code-editor-empty {
  padding: 16px 8px;
  text-align: center;
  font-size: 13px;
  color: #86909c;
  border: 1px dashed #e5e6eb;
  border-radius: 4px;
}

.code-editor-item {
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
}

.code-editor-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 12px;
  color: #86909c;
  background: #f7f8fa;
}

.code-editor-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.code-editor-preview {
  padding: 6px 8px;
  font-size: 12px;
  color: #4e5969;
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Consolas', 'Courier New', monospace;
}

.code-editor-preview:hover {
  background: #f2f3f5;
}

/* ===== 代码编辑弹窗辅助 UI ===== */

.code-editor-tip-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
  color: #4e5969;

  code {
    padding: 1px 5px;
    background: #f2f3f5;
    border-radius: 3px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 12px;
  }
}

.code-editor-help {
  min-width: 280px;

  h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: #1d2129;
  }
}

.var-row {
  padding: 6px 0;
  border-bottom: 1px solid #f2f3f5;
  font-size: 12px;

  &:last-child {
    border-bottom: none;
  }
}

.var-name {
  font-family: 'Consolas', 'Courier New', monospace;
  font-weight: 600;
  color: #165dff;
}

.var-type {
  display: inline-block;
  margin-left: 6px;
  padding: 0 5px;
  background: #e8f3ff;
  color: #165dff;
  border-radius: 3px;
  font-size: 11px;
}

.var-desc {
  margin-top: 2px;
  color: #4e5969;
}

.var-example {
  margin-top: 2px;
  color: #86909c;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
}

.code-editor-var-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;

  .var-bar-label {
    font-size: 12px;
    color: #86909c;
    flex-shrink: 0;
  }
}

.var-tag {
  cursor: pointer;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  transition: transform 0.15s;

  &:hover {
    transform: translateY(-1px);
  }
}

.code-editor-snippets {
  margin-bottom: 8px;
}

.snippet-item {
  padding: 4px 8px;
  cursor: pointer;

  &:hover {
    background: #f2f3f5;
  }

  .snippet-label {
    display: block;
    font-size: 13px;
    color: #1d2129;
    margin-bottom: 2px;
  }

  .snippet-code {
    display: block;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
    color: #86909c;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.code-editor-textarea {
  :deep(.arco-textarea) {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    padding: 10px 12px;
    border-radius: 4px;
    border-color: #c9cdd4;
    resize: vertical;
  }

  :deep(.arco-textarea:focus) {
    border-color: #165dff;
    box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.1);
  }
}

:deep(.arco-collapse-item-content) {
  --color-fill-1: #fff;
}
</style>
