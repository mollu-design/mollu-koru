/**
 * 节点属性定义 & 操作符工具。
 * 供事件面板、属性面板等多处复用。
 * 与 webtopo/src/composables/useNodeProps.ts 保持功能对齐。
 */

/** 属性类型 */
export type NodePropKind = 'color' | 'number' | 'text' | 'bool' | 'state'

/** 单个属性选项 */
export interface NodePropOption {
  /** 显示名称（中文） */
  label: string
  /** 实际存储的属性名（对应 X6 data 或业务字段） */
  value: string
  /** 属性值类型，用于决定『条件』运算符与编辑控件 */
  kind: NodePropKind
  /** 数值型时的取值范围/步长（可选） */
  min?: number
  max?: number
  step?: number
  /** 状态型可选值 */
  states?: string[]
  /** 状态型值 → 中文显示名（下拉选项友好显示） */
  stateLabels?: Record<string, string>
}

// ========== 通用节点属性清单 ==========

/** 节点通用可用属性清单 */
export const NODE_PROP_OPTIONS: NodePropOption[] = [
  { label: '图元名称', value: 'label', kind: 'text' },
  { label: '文本内容', value: 'text', kind: 'text' },
  { label: '填充颜色', value: 'fill', kind: 'color' },
  { label: '边框颜色', value: 'stroke', kind: 'color' },
  { label: '边框大小', value: 'strokeWidth', kind: 'number', min: 0, max: 50, step: 1 },
  { label: '文字颜色', value: 'fontColor', kind: 'color' },
  { label: 'X 坐标', value: 'x', kind: 'number', min: -100000, max: 100000, step: 1 },
  { label: 'Y 坐标', value: 'y', kind: 'number', min: -100000, max: 100000, step: 1 },
  { label: '宽度', value: 'width', kind: 'number', min: 1, max: 100000, step: 1 },
  { label: '高度', value: 'height', kind: 'number', min: 1, max: 100000, step: 1 },
  { label: '旋转角度', value: 'angle', kind: 'number', min: 0, max: 360, step: 1 },
  { label: '显示', value: 'visible', kind: 'bool' },
  { label: '透明度', value: 'opacity', kind: 'number', min: 0, max: 1, step: 0.1 },
  { label: '进度值', value: 'progress', kind: 'number', min: 0, max: 100, step: 1 },
  {
    label: '设备状态',
    value: 'state',
    kind: 'state',
    states: ['normal', 'running', 'warning', 'error'],
    stateLabels: { normal: '正常', running: '运行', warning: '告警', error: '故障' },
  },
  { label: '字体大小', value: 'fontSize', kind: 'number', min: 8, max: 100, step: 1 },
]

// ========== 线条属性 ==========

/** 线条类型（shape-line）属性项 */
export const LINE_DASHED_OPTION: NodePropOption = {
  label: '线条类型',
  value: 'lineDashed',
  kind: 'state',
  states: ['solid', 'dashed'],
  stateLabels: { solid: '实线', dashed: '虚线' },
}

/** 线条动画（shape-line）属性项 */
export const LINE_ANIM_OPTION: NodePropOption = {
  label: '线条动画',
  value: 'lineAnim',
  kind: 'state',
  states: ['none', 'flow', 'bead', 'trail', 'current'],
  stateLabels: { none: '无动画', flow: '流光', bead: '水珠', trail: '轨迹', current: '电流' },
}

/** 线条动画下拉选项 */
export const lineAnimSelectOptions = LINE_ANIM_OPTION.states!.map((s) => ({
  label: LINE_ANIM_OPTION.stateLabels![s] ?? s,
  value: s,
}))

/** 线条类型下拉选项 */
export const lineDashedSelectOptions = LINE_DASHED_OPTION.states!.map((s) => ({
  label: LINE_DASHED_OPTION.stateLabels![s] ?? s,
  value: s,
}))

// ========== 动画属性 ==========

import { ANIMATION_TEMPLATES } from './animationConfig'

/** 节点动画属性项 —— 从动画模板动态构建，与动画面板保持一致 */
const _nodeTemplates = Object.values(ANIMATION_TEMPLATES).filter((t) => t.target === 'node')
const _nodeAnimStates = ['none', ..._nodeTemplates.map((t) => t.id)]
const _nodeAnimStateLabels: Record<string, string> = { none: '无动画' }
_nodeTemplates.forEach((t) => {
  _nodeAnimStateLabels[t.id] = t.label
})

export const NODE_ANIM_OPTION: NodePropOption = {
  label: '动画',
  value: 'nodeAnim',
  kind: 'state',
  states: _nodeAnimStates,
  stateLabels: _nodeAnimStateLabels,
}

/** 节点动画下拉选项（与 NODE_ANIM_OPTION 保持同步） */
export const nodeAnimSelectOptions = _nodeAnimStates.map((s) => ({
  label: _nodeAnimStateLabels[s] ?? s,
  value: s,
}))

// ========== 反查 / 下拉选项工具 ==========

/** 由属性名反查属性项（找不到返回 undefined） */
export const getNodeProp = (value: string): NodePropOption | undefined =>
  NODE_PROP_OPTIONS.find((p) => p.value === value)

/** 属性下拉选项（label/value），供 a-select 使用 */
export const nodePropSelectOptions = NODE_PROP_OPTIONS.map((p) => ({
  label: p.label,
  value: p.value,
}))

/** 把属性列表转成 a-select 下拉选项（label/value） */
export const nodePropsToOptions = (props: NodePropOption[]) =>
  props.map((p) => ({ label: p.label, value: p.value }))

// ========== 按 shape 动态生成属性列表 ==========

/** 按 shape 分类的扩展属性（直接匹配 shape 名） */
const SHAPE_SPECIFIC_PROPS: Record<string, NodePropOption[]> = {
  'custom-split': [
    { value: 'leftText', label: '键名文本', kind: 'text' },
    { value: 'rightText', label: '键值文本', kind: 'text' },
    { value: 'splitRatio', label: '分割比例', kind: 'number', step: 0.05, min: 0.15, max: 0.85 },
  ],
}

/**
 * 根据节点 shape 与 data 动态生成该节点的可用属性列表。
 * 不同节点类型（线/SVG/文本/split/普通）暴露不同的可操作属性。
 */
export const getNodePropsByShape = (
  shape: string | undefined,
  data?: Record<string, any>,
): NodePropOption[] => {
  const isLine = shape === 'shape-line'
  const isSvg = !!shape && shape.startsWith('svg-node-')
  const isSplit = shape === 'split' || shape === 'custom-split'
  const isText = shape === 'text' || shape === 'custom-text' || isSplit
  const isButton = shape === 'custom-button'

  const opts: NodePropOption[] = []

  // 线节点专属
  if (isLine) {
    opts.push(
      { label: '线条大小', value: 'strokeWidth', kind: 'number', min: 1, max: 50, step: 1 },
      { label: '线条颜色', value: 'stroke', kind: 'color' },
      LINE_DASHED_OPTION,
      LINE_ANIM_OPTION,
    )
  }

  // 文本类节点（custom-text / text / split）没有填充色；按钮和图元有
  if (!isLine && !isText) {
    opts.push({ label: '填充颜色', value: 'fill', kind: 'color' })
  }
  // 非线节点都有动画
  if (!isLine) {
    opts.push(NODE_ANIM_OPTION)
  }
  // 文本/按钮节点可改文字
  if (isText || isButton) {
    opts.push(
      { label: '文本内容', value: 'text', kind: 'text' },
      { label: '文字颜色', value: 'fontColor', kind: 'color' },
      { label: '字体大小', value: 'fontSize', kind: 'number', min: 8, max: 100, step: 1 },
    )
  }

  // 通用属性（所有节点）
  opts.push(
    { label: 'X 坐标', value: 'x', kind: 'number', min: -100000, max: 100000, step: 1 },
    { label: 'Y 坐标', value: 'y', kind: 'number', min: -100000, max: 100000, step: 1 },
  )
  if (!isLine) {
    opts.push(
      { label: '宽度', value: 'width', kind: 'number', min: 1, max: 100000, step: 1 },
      { label: '高度', value: 'height', kind: 'number', min: 1, max: 100000, step: 1 },
    )
  }
  opts.push(
    { label: '旋转角度', value: 'angle', kind: 'number', min: 0, max: 360, step: 1 },
    { label: '显示', value: 'visible', kind: 'bool' },
    // { label: '透明度', value: 'opacity', kind: 'number', min: 0, max: 1, step: 0.1 },
    // { label: '进度值', value: 'progress', kind: 'number', min: 0, max: 100, step: 1 },
    // {
    //   label: '设备状态',
    //   value: 'state',
    //   kind: 'state',
    //   states: ['normal', 'running', 'warning', 'error'],
    //   stateLabels: { normal: '正常', running: '运行', warning: '告警', error: '故障' },
    // },
  )

  // shape 专属属性
  if (shape && SHAPE_SPECIFIC_PROPS[shape]) {
    opts.push(...SHAPE_SPECIFIC_PROPS[shape])
  }

  // 业务自定义字段（data 中存在但未在固定清单中的字段）
  if (data) {
    const fixedKeys = new Set(opts.map((o) => o.value))
    const skipKeys = [
      'label',
      'eventConfig',
      'binding',
      'device',
      'lockAspect',
      'animation',
      'ports',
      'position',
      'size',
      'attrs',
      'zIndex',
      'id',
      'shape',
      'visible',
      'data',
      'label',
    ]
    Object.keys(data).forEach((k) => {
      if (fixedKeys.has(k) || skipKeys.includes(k)) return
      const v = data[k]
      const kind: NodePropKind =
        typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'bool' : 'text'
      opts.push({ label: k, value: k, kind })
    })
  }

  return opts
}

/**
 * 依据属性类型返回合适的『条件』运算符选项。
 */
export const operatorsByKind = (kind?: NodePropKind) => {
  // 状态 / 开关：仅等于/不等于
  if (kind === 'state' || kind === 'bool') {
    return [
      { label: '等于', value: '==' },
      { label: '不等于', value: '!=' },
    ]
  }
  // 颜色 / 文本：仅等于/不等于
  if (kind === 'color' || kind === 'text') {
    return [
      { label: '等于', value: '==' },
      { label: '不等于', value: '!=' },
    ]
  }
  // 数值型：支持大小比较
  return [
    { label: '大于', value: '>' },
    { label: '小于', value: '<' },
    { label: '等于', value: '==' },
    { label: '大于等于', value: '>=' },
    { label: '小于等于', value: '<=' },
    { label: '不等于', value: '!=' },
  ]
}
