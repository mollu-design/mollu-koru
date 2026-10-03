<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { genStateId, validateMultiStateJexl, safeEvalPointExpr } from '../composables/useMultiState'
import { nodeToSvgThumbnail, svgToDataUrl } from '../utils/svgThumbnail'

interface MultiStateItem {
  stateId: string
  stateName: string
  cellIds: string[]
}

const props = defineProps<{
  visible: boolean
  /** 多状态父节点（cell） */
  parent: any
  /** 子图元列表 */
  children: any[]
  /** SVG 自定义形状列表（用于 svg-node-* 图元的缩略图） */
  customShapes?: { svg: string; label: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save', data: any): void
  (e: 'preview', stateId: string, stateList: MultiStateItem[]): void
}>()

/** v-model:visible 计算属性，供模板使用（自动解包 props） */
const visibleModel = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const objectUrls = new Set<string>()

/** 统一处理图标 URL：
 *  - 原始 SVG 字符串 → data URL
 *  - data: 开头 → 直接使用
 *  - 其他（图片 URL / blob URL 等） → 直接使用
 */
const resolveIconSrc = (icon: string): string => {
  if (!icon) return ''
  if (icon.startsWith('data:') || icon.startsWith('blob:')) return icon
  if (icon.startsWith('<')) {
    // 原始 SVG → 转为 data URL
    const url = svgToDataUrl(icon)
    if (url.startsWith('blob:')) objectUrls.add(url)
    return url
  }
  return icon
}

const revokeObjectUrls = () => {
  objectUrls.forEach((u) => {
    try {
      URL.revokeObjectURL(u)
    } catch {
      /* 忽略 */
    }
  })
  objectUrls.clear()
}
onBeforeUnmount(revokeObjectUrls)

const stateList = ref<MultiStateItem[]>([])
const activeStateId = ref<string>('')
const stateRule = ref<Record<string, string>>({})

// 双模式：默认简易模式（等值匹配，零代码），高级模式保留自定义 JEXL
const advancedMode = ref(false)
// 简易模式配置：stateId -> { op(比较符), value(目标值) }
interface SimpleRule {
  op: string
  value: string
}
const simpleConfig = ref<Record<string, SimpleRule>>({})
const simpleOps = [
  { value: '==', label: '等于' },
  { value: '!=', label: '不等于' },
  { value: '>', label: '大于' },
  { value: '>=', label: '大于等于' },
  { value: '<', label: '小于' },
  { value: '<=', label: '小于等于' },
]

/** 简易配置 → JEXL 表达式（${point} == 1） */
const simpleToJexl = (op: string, value: string): string => {
  if (!op || value === '') return ''
  return `\${point} ${op} ${value}`
}

/** 尝试把 JEXL 解析回简易配置；无法解析返回 null */
const jexlToSimple = (expr: string): SimpleRule | null => {
  if (!expr) return { op: '==', value: '' }
  const m = expr.trim().match(/^\$\{point\}\s*(==|!=|>=|<=|>|<)\s*(.+)$/)
  if (!m) return null
  return { op: m[1], value: m[2].trim() }
}

/** 切到简易模式：若存在无法解析的表达式，提示并阻止 */
const enterSimpleMode = () => {
  for (const st of stateList.value) {
    const expr = stateRule.value[st.stateId] || ''
    const parsed = jexlToSimple(expr)
    if (!parsed && expr.trim()) {
      Message.warning(`状态「${st.stateName}」为自定义表达式，无法切换简易视图`)
      return
    }
    simpleConfig.value = {
      ...simpleConfig.value,
      [st.stateId]: parsed || { op: '==', value: '' },
    }
  }
  advancedMode.value = false
}

/** 切到高级模式：把简易配置翻译为 JEXL */
const enterAdvancedMode = () => {
  const next: Record<string, string> = { ...stateRule.value }
  for (const st of stateList.value) {
    const cfg = simpleConfig.value[st.stateId]
    if (cfg) next[st.stateId] = simpleToJexl(cfg.op, cfg.value)
  }
  stateRule.value = next
  advancedMode.value = true
}

/** 简易模式切换比较符/值时，同步更新 JEXL */
const onSimpleChange = (stateId: string) => {
  const cfg = simpleConfig.value[stateId]
  if (cfg) stateRule.value = { ...stateRule.value, [stateId]: simpleToJexl(cfg.op, cfg.value) }
}

// 逐行 JEXL 校验结果：stateId -> { ok, message }
const jexlCheck = ref<Record<string, { ok: boolean; message: string }>>({})

// 打开时初始化表单（深拷贝，避免直接改父节点 data）
watch(
  () => props.visible,
  (v) => {
    if (v && props.parent) {
      const d = props.parent.getData?.() || {}
      stateList.value = JSON.parse(JSON.stringify(d.stateList || []))
      activeStateId.value = d.activeStateId || stateList.value[0]?.stateId || ''
      const pb = d.pointBind || {}
      // pointBind 只保留 stateRule；device + dataPoint 从 binding.bindings[] 取
      stateRule.value = JSON.parse(JSON.stringify(pb.stateRule || {}))
      jexlCheck.value = {}
      // 初始化：若所有表达式都能解析为等值匹配，默认进入简易模式
      const allSimple = stateList.value.every((st) => {
        const expr = stateRule.value[st.stateId] || ''
        return !expr.trim() || jexlToSimple(expr) !== null
      })
      advancedMode.value = !allSimple
      const nextSimple: Record<string, SimpleRule> = {}
      for (const st of stateList.value) {
        const parsed = jexlToSimple(stateRule.value[st.stateId] || '')
        nextSimple[st.stateId] = parsed || { op: '==', value: '' }
      }
      simpleConfig.value = nextSimple
    }
  },
)

/** 新增状态：默认勾选全部子图元 */
const addState = () => {
  const sid = genStateId()
  stateList.value.push({
    stateId: sid,
    stateName: `状态${stateList.value.length + 1}`,
    cellIds: props.children.map((c: any) => c.id),
  })
  stateRule.value = { ...stateRule.value, [sid]: '' }
  simpleConfig.value = { ...simpleConfig.value, [sid]: { op: '==', value: '' } }
}

/** 删除状态（二次确认；仅剩 1 条时禁用） */
const removeState = (state: MultiStateItem) => {
  if (stateList.value.length <= 1) {
    Message.warning('至少保留 1 个状态')
    return
  }
  const idx = stateList.value.findIndex((s) => s.stateId === state.stateId)
  if (idx === -1) return
  stateList.value.splice(idx, 1)
  const rule = { ...stateRule.value }
  delete rule[state.stateId]
  stateRule.value = rule
  const check = { ...jexlCheck.value }
  delete check[state.stateId]
  jexlCheck.value = check
  const sc = { ...simpleConfig.value }
  delete sc[state.stateId]
  simpleConfig.value = sc
  if (activeStateId.value === state.stateId) {
    activeStateId.value = stateList.value[0].stateId
    emit('preview', activeStateId.value, stateList.value)
  }
}

/** 切换激活状态（预览） */
const switchActive = (stateId: string) => {
  activeStateId.value = stateId
  emit('preview', stateId, stateList.value)
}

/** 勾选某个状态下的子图元 */
const toggleChild = (state: MultiStateItem, childId: string) => {
  const i = state.cellIds.indexOf(childId)
  if (i === -1) state.cellIds.push(childId)
  else state.cellIds.splice(i, 1)
}

/** 校验某状态的表达式并记录结果 */
const checkExpr = (stateId: string) => {
  const expr = stateRule.value[stateId] || ''
  jexlCheck.value = { ...jexlCheck.value, [stateId]: validateMultiStateJexl(expr) }
}

/** 全部校验 */
const checkAll = () => {
  const next: Record<string, { ok: boolean; message: string }> = {}
  let errCount = 0
  for (const st of stateList.value) {
    const r = validateMultiStateJexl(stateRule.value[st.stateId] || '')
    next[st.stateId] = r
    if (!r.ok) errCount++
  }
  jexlCheck.value = next
  if (errCount > 0) Message.warning(`共 ${errCount} 条表达式语法错误`)
  else Message.success('全部表达式语法通过')
}

/** 用模拟测点值测试 */
const testValue = ref<number>(1)
const testPoint = () => {
  const v = Number(testValue.value)
  if (Number.isNaN(v)) {
    Message.warning('请输入合法的模拟测点值')
    return
  }
  for (const st of stateList.value) {
    const expr = stateRule.value[st.stateId]
    if (!expr || !expr.trim()) continue
    if (safeEvalPointExpr(expr, v)) {
      activeStateId.value = st.stateId
      emit('preview', st.stateId, stateList.value)
      Message.success(`模拟 point=${v} → 命中「${st.stateName}」`)
      return
    }
  }
  Message.info(`模拟 point=${v} 未命中任何状态，保持当前激活状态`)
}

/** 保存：前置校验 */
const handleOk = () => {
  // 简易模式下先同步到 JEXL
  if (!advancedMode.value) {
    const next: Record<string, string> = {}
    for (const st of stateList.value) {
      const cfg = simpleConfig.value[st.stateId]
      next[st.stateId] = cfg ? simpleToJexl(cfg.op, cfg.value) : ''
    }
    stateRule.value = next
  }
  if (!stateList.value.length) {
    Message.warning('至少保留 1 个状态')
    return
  }
  for (const st of stateList.value) {
    if (!st.stateName.trim()) {
      Message.warning('状态名称不能为空')
      return
    }
  }
  // 保存时自动执行校验
  const next: Record<string, { ok: boolean; message: string }> = {}
  let errCount = 0
  for (const st of stateList.value) {
    const r = validateMultiStateJexl(stateRule.value[st.stateId] || '')
    next[st.stateId] = r
    if (!r.ok) errCount++
  }
  jexlCheck.value = next
  if (errCount > 0) {
    const first = stateList.value.find((st) => next[st.stateId]?.ok === false)
    if (first) Message.error(`「${first.stateName}」表达式${next[first.stateId].message}`)
    else Message.warning(`共 ${errCount} 条表达式语法错误`)
    return
  }
  // 存在完全未勾选子图元的状态时，二次确认
  const emptyStates = stateList.value.filter((st) => !st.cellIds.length)
  if (emptyStates.length) {
    Modal.confirm({
      title: '保存确认',
      content: `状态「${emptyStates.map((s) => s.stateName).join('、')}」未勾选任何子图元，激活后元件将完全隐藏，是否确认保存？`,
      okText: '确认保存',
      cancelText: '取消',
      onOk: doSave,
    })
    return
  }
  doSave()
}

const doSave = () => {
  emit('save', {
    activeStateId: activeStateId.value,
    stateList: JSON.parse(JSON.stringify(stateList.value)),
    pointBind: {
      // pointCode 已废弃：device + dataPoint 从 binding.bindings[] 统一取
      stateRule: { ...stateRule.value },
    },
  })
  emit('update:visible', false)
}

const handleCancel = () => {
  emit('update:visible', false)
}

/** 子图元显示数据接口 */
interface ChildItem {
  id: string
  label: string
  icon?: string
}

/** 获取子图元显示名（兼容 X6 cell 和纯数据对象） */
const getChildLabel = (ch: ChildItem | any): string => {
  // 1. 纯数据对象（来自 multiStateChildren 的预处理结果）
  if (ch && typeof ch.label === 'string' && ch.label) return ch.label
  // 2. 优先读 data.name（最可靠，node:added 时已同步）
  try {
    const d = ch?.getData?.()
    if (d?.name != null) return String(d.name)
    if (d?.label != null) return String(d.label)
  } catch {
    /* ignore */
  }
  // 3. X6 label getter
  try {
    if (ch?.label?.text) return String(ch.label.text)
  } catch {
    /* ignore */
  }
  // 4. X6 getLabels API
  try {
    const labels = ch?.getLabels?.()
    if (Array.isArray(labels) && labels[0]?.text) return String(labels[0].text)
  } catch {
    /* ignore */
  }
  // 5. markup text selector
  try {
    const t = ch?.attr?.('text/text')
    if (t != null && String(t)) return String(t)
  } catch {
    /* ignore */
  }
  // 6. markup label selector
  try {
    const t = ch?.attr?.('label/text')
    if (t != null && String(t)) return String(t)
  } catch {
    /* ignore */
  }
  // 7. 直接读 attrs 对象
  try {
    if (ch?.attrs?.text?.text) return String(ch.attrs.text.text)
    if (ch?.attrs?.label?.text) return String(ch.attrs.label.text)
  } catch {
    /* ignore */
  }
  // 8. getProp('label')
  try {
    const p = ch?.getProp?.('label')
    if (typeof p === 'string' && p) return p
    if (p && typeof p === 'object' && p.text) return String(p.text)
  } catch {
    /* ignore */
  }
  return ch?.id ? String(ch.id).slice(0, 8) : '未命名'
}

/** 获取子图元图标/缩略图（兼容 X6 cell 和纯数据对象） */
const getChildIcon = (ch: ChildItem | any): string => {
  // 纯数据对象
  if (ch?.icon && typeof ch.icon === 'string') return ch.icon
  // X6 cell：按 shape 类型获取图标
  try {
    const shape = ch?.shape || ch?.getData?.()?.shape || ''
    if (typeof shape === 'string' && shape.startsWith('svg-node-')) {
      const idx = parseInt(String(shape).replace('svg-node-', ''), 10)
      if (!Number.isNaN(idx) && props.customShapes?.[idx]?.svg) {
        return props.customShapes[idx].svg
      }
    }
    if (shape === 'custom-image') {
      // X6 custom-image 图片节点：尝试多种路径获取图片 URL
      let href = ''
      // 路径1：直接读 attrs 对象（最可靠，registerSvgNodes.ts / Toolbar 均存储于此）
      try {
        const a = ch?.attrs
        if (a?.image && (a.image['xlink:href'] || a.image.href)) {
          href = a.image['xlink:href'] || a.image.href || ''
        }
      } catch {
        /* ignore */
      }
      // 路径2：X6 attr() API
      if (!href) {
        try {
          href = ch?.attr?.('image/xlink:href') || ''
        } catch {
          /* ignore */
        }
      }
      // 路径3：getProp()
      if (!href) {
        try {
          href = ch?.getProp?.('attrs/image/xlink:href') || ''
        } catch {
          /* ignore */
        }
      }
      if (href) return String(href)
    }
    // 兜底：data.icon
    const d = ch?.getData?.()
    if (d?.icon && typeof d.icon === 'string') return d.icon
    // 最终兜底：X6 cell 生成节点缩略图
    if (ch?.getSize && ch?.attr) {
      return nodeToSvgThumbnail(ch)
    }
  } catch {
    /* ignore */
  }
  return ''
}
</script>

<template>
  <a-drawer
    v-model:visible="visibleModel"
    title="编辑多状态元件"
    ok-text="保存"
    cancel-text="取消"
    :width="'50%'"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <div class="ms-editor">
      <!-- 模块1：状态定义管理 -->
      <div class="ms-section">
        <div class="ms-section-title">状态定义管理</div>
        <div class="ms-tip">
          单选圆圈：选择预览激活的状态（全局仅可选择一个）；复选框：配置当前状态生效时，需要同时展示的多个子图元（支持多选）。
        </div>

        <div class="ms-states">
          <div
            v-for="st in stateList"
            :key="st.stateId"
            class="ms-state-card"
            :class="{ active: st.stateId === activeStateId }"
          >
            <div class="ms-state-head">
              <a-radio
                :model-value="st.stateId === activeStateId"
                @change="switchActive(st.stateId)"
                size="medium"
              />
              <a-input
                v-model="st.stateName"
                size="medium"
                placeholder="请输入状态名称（如：合闸）"
                style="flex: 1"
              />
              <a-popconfirm
                position="tr"
                content="确认删除该状态及其对应的表达式配置吗?"
                @ok="removeState(st)"
              >
                <a-button type="text" size="mini" status="danger" :disabled="stateList.length <= 1">
                  删除
                </a-button>
              </a-popconfirm>
            </div>

            <div class="ms-state-children">
              <a-checkbox
                v-for="ch in children"
                :key="ch.id"
                :model-value="st.cellIds.includes(ch.id)"
                @change="toggleChild(st, ch.id)"
                size="medium"
              >
                <span class="ms-child-item">
                  <span class="ms-child-thumb">
                    <img
                      v-if="getChildIcon(ch)"
                      :src="resolveIconSrc(getChildIcon(ch))"
                      class="ms-child-img"
                    />
                  </span>
                  <span class="ms-child-name">{{ getChildLabel(ch) }}</span>
                </span>
              </a-checkbox>
            </div>
          </div>
        </div>
        <a-button size="small" type="outline" long @click="addState">+ 新增状态</a-button>
      </div>

      <!-- 模块2：测点绑定 & 自动切换 -->
      <a-divider />
      <div class="ms-section">
        <div class="ms-section-title">测点绑定 & 自动切换</div>
        <div class="ms-tip" v-if="!advancedMode">
          选择测点，配置每个状态对应的测点数值，测点变化时自动切换图形；留空则不自动切换，仅支持手动预览。
        </div>
        <div class="ms-tip" v-else>
          绑定测点并配置各状态的 JEXL
          判断表达式，运行时根据测点值自动切换图形；留空则不自动切换，仅支持手动预览。
        </div>
        <div class="ms-form">
          <div class="ms-form-label">测点绑定</div>
          <div class="ms-tip" style="margin-bottom:0">
            请在属性面板「绑定」tab 中为该元件绑定 device + dataPoint，运行时 executor 会自动读取。
            本面板只需配置各状态的 JEXL 判断表达式，内置变量 <code>${point}</code> = 绑定测点实时值。
          </div>
        </div>

        <!-- 模式切换开关 -->
        <a-switch
          :model-value="advancedMode"
          @change="advancedMode ? enterSimpleMode() : enterAdvancedMode()"
          :style="{ marginBottom: '8px' }"
          size="medium"
        >
          <template #checked>高级自定义表达式</template>
          <template #unchecked>简易模式（等值匹配）</template>
        </a-switch>

        <!-- 简易模式 -->
        <template v-if="!advancedMode">
          <div class="ms-rule-head">
            状态 ↔ 测点值匹配
            <span class="ms-var-tip">当测点值满足以下条件时，自动切换到对应状态</span>
          </div>
          <div v-for="st in stateList" :key="st.stateId" class="ms-rule-row">
            <span class="ms-rule-name">{{ st.stateName || '未命名' }}</span>
            <span class="ms-simple-arrow">当测点值</span>
            <a-select
              v-model="simpleConfig[st.stateId].op"
              :options="simpleOps"
              size="medium"
              style="width: 120px"
              @change="onSimpleChange(st.stateId)"
            />
            <a-input
              v-model="simpleConfig[st.stateId].value"
              size="medium"
              placeholder="值（例：1）"
              style="width: 200px"
              @input="onSimpleChange(st.stateId)"
            />
          </div>
        </template>

        <!-- 高级模式 -->
        <template v-else>
          <div class="ms-rule-head">
            JEXL 判断表达式
            <span class="ms-var-tip"
              >内置变量 ${point} = 绑定测点实时值，表达式返回 true/false</span
            >
            <a-button size="mini" style="margin-left: auto" @click="checkAll">全部校验</a-button>
          </div>
          <div v-for="st in stateList" :key="st.stateId" class="ms-rule-row">
            <span class="ms-rule-name">{{ st.stateName || '未命名' }}</span>
            <a-input
              v-model="stateRule[st.stateId]"
              placeholder="例如：${point} == 1"
              size="medium"
              :status="jexlCheck[st.stateId]?.ok === false ? 'error' : undefined"
            />
            <a-button
              size="mini"
              :type="jexlCheck[st.stateId]?.ok === false ? 'secondary' : 'primary'"
              :status="jexlCheck[st.stateId]?.ok === false ? 'danger' : undefined"
              @click="checkExpr(st.stateId)"
            >
              校验
            </a-button>
            <span v-if="jexlCheck[st.stateId]?.ok === false" class="ms-rule-row-err">
              {{ jexlCheck[st.stateId]?.message }}
            </span>
          </div>
          <div v-if="Object.values(jexlCheck).some((r) => !r.ok)" class="ms-rule-error">
            存在语法错误，请修正后再保存。
          </div>
        </template>

        <div class="ms-warn">
          ⚠️ 同一测点下，多个状态表达式不建议同时满足 true，运行时只会匹配第一个命中的状态。
        </div>
        <div class="ms-test-row">
          <span>模拟测点值</span>
          <a-input-number v-model="testValue" size="medium" style="width: 200px" />
          <a-button size="medium" @click="testPoint">测试切换</a-button>
        </div>
        <div class="ms-test-tip">
          填写模拟测点值并点击【测试切换】，画布预览测点驱动的自动切换效果
        </div>
      </div>
    </div>

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" @click="handleOk">保存</a-button>
    </template>
  </a-drawer>
</template>

<style scoped>
.ms-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ms-section-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.ms-tip {
  font-size: 12px;
  color: #86909c;
  margin-bottom: 10px;
}

.ms-states {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.ms-state-card {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  padding: 10px;
}

.ms-state-card.active {
  border-color: #165dff;
  background: rgba(22, 93, 255, 0.04);
}

.ms-state-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ms-state-children {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding-left: 4px;
}

.ms-child-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ms-child-thumb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 37px;
  height: 37px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.ms-child-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  border-radius: 2px;
}

.ms-child-shape {
  font-size: 10px;
  color: #86909c;
  padding: 0 2px;
}

.ms-child-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-form {
  margin-top: 8px;
  margin-bottom: 15px;
}

.ms-form-label {
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}

.ms-rule-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4e5969;
  margin: 4px 0 8px;
}

.ms-var-tip {
  font-size: 12px;
  color: #86909c;
}

.ms-rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ms-rule-name {
  width: 80px;
  font-size: 12px;
  color: #4e5969;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-simple-arrow {
  font-size: 12px;
  color: #86909c;
}

.ms-warn {
  font-size: 12px;
  color: #d25f00;
  background: rgba(255, 125, 0, 0.08);
  border-radius: 4px;
  padding: 6px 8px;
  margin-top: 10px;
}

.ms-rule-row-err {
  font-size: 12px;
  color: #f53f3f;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-rule-error {
  color: #f53f3f;
  font-size: 12px;
  margin-top: 4px;
}

.ms-test-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 13px;
  color: #4e5969;
}

.ms-test-tip {
  font-size: 12px;
  color: #86909c;
  margin-top: 8px;
}
</style>
