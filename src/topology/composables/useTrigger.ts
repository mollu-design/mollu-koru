/**
 * 触发器的新增/编辑/删除/启用逻辑。
 * 移植自 webtopo。
 */
import { computed, ref } from 'vue'
import { type BindingItem, type TriggerActionType, type TriggerItem } from './bindingTypes'
import { operatorLabel, triggerActionLabel } from './bindingConfig'

const newId = () => `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`

export const newTrigger = (): TriggerItem => ({
  id: newId(),
  enabled: true,
  triggerMode: 'once_change',
  operator: '==',
  compareValue: '',
  actionType: 'alert',
  actionValue: {},
  debounceMs: 0,
  confirmBefore: false,
})

export const useTrigger = (
  getBindings: () => BindingItem[],
  updateBinding: (id: string, patch: Partial<BindingItem>) => void,
) => {
  const triggerEditor = ref<{ bId: string; index: number | null; draft: TriggerItem } | null>(null)
  const triggerModalVisible = computed({
    get: () => triggerEditor.value !== null,
    set: (v: boolean) => {
      if (!v) triggerEditor.value = null
    },
  })
  const triggerModalTitle = computed(() => {
    if (!triggerEditor.value) return '触发器'
    return triggerEditor.value.index === null ? '新增触发器' : '编辑触发器'
  })

  const openTriggerModal = (bId: string, tId?: string) => {
    const b = getBindings().find((x) => x.id === bId)
    if (!b) return
    const existing = tId ? b.triggers.find((t) => t.id === tId) : undefined
    const draft: TriggerItem = existing
      ? { ...existing, actionValue: { ...existing.actionValue } }
      : newTrigger()
    triggerEditor.value = {
      bId,
      index: tId ? b.triggers.findIndex((t) => t.id === tId) : null,
      draft,
    }
  }

  const onActionTypeChange = (t: TriggerItem, actionType: TriggerActionType) => {
    t.actionType = actionType
    t.actionValue = {}
  }

  const validateTrigger = (draft: TriggerItem): string | null => {
    const av = draft.actionValue || {}
    switch (draft.actionType) {
      case 'alert':
        if (!av.message) return '弹窗告警内容不能为空'
        break
      case 'writePoint':
        if (!av.device) return '请选择受控设备'
        if (!av.controlPoint) return '请选择受控控制点'
        if (av.value === undefined || av.value === '') return '请填写输出控制值'
        break
      case 'jumpPage':
        if (!av.url) return '跳转页面 URL 不能为空'
        break
      case 'addLog':
        if (!av.content) return '日志内容不能为空'
        break
      case 'setGraphAttr':
        if (!av.target) return '请选择画布目标图元'
        if (!av.propKey) return '请选择属性'
        break
      case 'playAudio':
        if (!av.src) return '请选择音频资源'
        break
      case 'sendMsg':
        if (!av.content) return '通知内容不能为空'
        break
      case 'openDialog':
        if (!av.dialogType) return '请选择弹窗类型'
        break
      case 'httpRequest':
        if (!av.url) return '请求地址不能为空'
        break
      case 'runScript':
        if (!av.script) return '脚本内容不能为空'
        break
      case 'startAnimation':
        if (!av.targetCellId) return '请选择目标图元'
        if (!av.animateTemplate) return '请选择动画模板'
        break
      case 'stopAnimation':
        if (!av.targetCellId) return '请选择目标图元'
        break
    }
    return null
  }

  const saveTriggerModal = () => {
    const ed = triggerEditor.value
    if (!ed) return
    const err = validateTrigger(ed.draft)
    if (err) {
      ;(window as any).$arco?.Message?.error?.(err)
      return
    }
    const b = getBindings().find((x) => x.id === ed.bId)
    if (!b) return
    if (ed.index === null) {
      updateBinding(ed.bId, { triggers: [...b.triggers, ed.draft] })
    } else {
      updateBinding(ed.bId, {
        triggers: b.triggers.map((t, i) => (i === ed.index ? ed.draft : t)),
      })
    }
    triggerEditor.value = null
  }

  const removeTrigger = (bId: string, tId: string) => {
    const b = getBindings().find((x) => x.id === bId)
    if (!b) return
    updateBinding(bId, { triggers: b.triggers.filter((t) => t.id !== tId) })
  }

  const toggleTrigger = (b: BindingItem, t: TriggerItem, enabled: boolean) => {
    updateBinding(b.id, {
      triggers: b.triggers.map((tr) => (tr.id === t.id ? { ...tr, enabled } : tr)),
    })
  }

  const triggerSummary = (t: TriggerItem) => {
    const op = operatorLabel(t.operator)
    const val = String(t.compareValue ?? '')
    const act = triggerActionLabel[t.actionType] || t.actionType
    return `当测点 ${op} ${val || '?'} → ${act}`
  }

  return {
    triggerEditor,
    triggerModalVisible,
    triggerModalTitle,
    openTriggerModal,
    onActionTypeChange,
    saveTriggerModal,
    removeTrigger,
    toggleTrigger,
    triggerSummary,
  }
}
