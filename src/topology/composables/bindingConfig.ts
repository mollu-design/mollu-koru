/**
 * 绑定相关的运行时常量与选项字典。
 * 类型定义见 bindingTypes.ts。
 */
import type { TriggerActionType, JexlTemplateType, TriggerItem } from './bindingTypes'
import { animationTemplateOptions } from './animationConfig'

/** 动画模板下拉选项（含"无动画/停止"） */
const _animOpts = animationTemplateOptions('node')
export const ANIMATION_TEMPLATE_OPTIONS: { label: string; value: string }[] = [
  { label: '无动画（停止）', value: 'none' },
  ..._animOpts,
]

/** 布尔动画下拉：启动时用什么动画 */
export const ANIM_START_OPTIONS: { label: string; value: string }[] = _animOpts

/** 触发器行为下拉选项（完整） */
export const triggerActionOptions: { label: string; value: TriggerActionType }[] = [
  { label: '弹窗告警', value: 'alert' },
  { label: '下发控制指令', value: 'writePoint' },
  { label: '跳转页面', value: 'jumpPage' },
  { label: '记录日志', value: 'addLog' },
  { label: '修改图元属性', value: 'setGraphAttr' },
  { label: '播放声音告警', value: 'playAudio' },
  { label: '发送消息通知', value: 'sendMsg' },
  { label: '打开业务弹窗', value: 'openDialog' },
  { label: '执行HTTP请求', value: 'httpRequest' },
  { label: '执行脚本', value: 'runScript' },
  { label: '启动图元动画', value: 'startAnimation' },
  { label: '停止图元动画', value: 'stopAnimation' },
]

/** 普通行为类型（常用，前置显示） */
export const normalActionTypes: TriggerActionType[] = [
  'alert',
  'writePoint',
  'jumpPage',
  'addLog',
  'setGraphAttr',
  'playAudio',
  'startAnimation',
  'stopAnimation',
]

/** 高级行为类型 */
export const advancedActionTypes: TriggerActionType[] = [
  'sendMsg',
  'openDialog',
  'httpRequest',
  'runScript',
]

/** 行为类型 → 中文标签 */
export const triggerActionLabel: Record<string, string> = {
  alert: '弹窗告警',
  writePoint: '下发控制指令',
  jumpPage: '跳转页面',
  addLog: '记录日志',
  setGraphAttr: '修改图元属性',
  playAudio: '播放声音告警',
  sendMsg: '发送消息通知',
  openDialog: '打开业务弹窗',
  httpRequest: '执行HTTP请求',
  runScript: '执行脚本',
  startAnimation: '启动图元动画',
  stopAnimation: '停止图元动画',
}

/** 条件操作符下拉选项 */
export const triggerOperators: { label: string; value: string }[] = [
  { label: '大于', value: '>' },
  { label: '小于', value: '<' },
  { label: '等于', value: '==' },
  { label: '大于等于', value: '>=' },
  { label: '小于等于', value: '<=' },
  { label: '不等于', value: '!=' },
]

/** 操作符符号 → 显示标签 */
export const operatorLabel = (op: string): string => {
  const map: Record<string, string> = {
    '==': '=',
    '=': '=',
    '!=': '≠',
    '>': '>',
    '<': '<',
    '>=': '≥',
    '<=': '≤',
    eq: '=',
    neq: '≠',
    gt: '>',
    lt: '<',
    gte: '≥',
    lte: '≤',
  }
  return map[op] || op
}

/** 触发模式选项 */
export const triggerModeOptions = [
  { label: '仅状态跳变', value: 'once_change' },
  { label: '持续满足', value: 'always' },
]

/** HTTP 方法选项 */
export const httpMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
]

/** 日志级别选项 */
export const logLevelOptions = [
  { label: '信息', value: 'info' },
  { label: '告警', value: 'warning' },
  { label: '严重', value: 'error' },
]

/** JEXL 模板类型下拉选项（带 tooltip 与分类） */
export const jexlTemplateTypeOptions: {
  label: string
  value: JexlTemplateType
  tooltip: string
  category: 'text' | 'style' | 'state'
}[] = [
  {
    label: '原始值直接输出',
    value: 'rawValue',
    tooltip: '直接展示测点采集回来的原始数值',
    category: 'text',
  },
  {
    label: '数值文本格式化',
    value: 'textFormat',
    tooltip: '设置小数位数、拼接单位',
    category: 'text',
  },
  {
    label: '布尔文本转换',
    value: 'boolText',
    tooltip: '0/False 显示关闭文字，1/True 显示开启文字',
    category: 'text',
  },
  {
    label: '状态-文本映射',
    value: 'statusTextMapping',
    tooltip: '按测点值显示对应文字',
    category: 'text',
  },
  { label: '状态颜色映射', value: 'colorMap', tooltip: '等值匹配，仅支持 == （如 1→绿色、0→灰色），适合开关量/离散状态', category: 'style' },
  {
    label: '阈值颜色 ⭐',
    value: 'threshold',
    tooltip: '支持 >、<、>=、<=、between 区间判断（如温度>80变红、<20变蓝），适合连续量',
    category: 'style',
  },
  {
    label: '状态-元件状态映射',
    value: 'elementStateMapping',
    tooltip: '配置测点值对应元件展示状态',
    category: 'state',
  },
  // ===== 动画专用模板（仅 targetProperty === 'nodeAnim' 时显示） =====
  {
    label: '布尔-动画映射',
    value: 'boolAnim',
    tooltip: '测点为1启动指定动画，为0停止动画',
    category: 'style',
  },
  {
    label: '状态-动画映射',
    value: 'statusAnimMapping',
    tooltip: '按测点值选择不同动画模板，支持"无动画"停止',
    category: 'style',
  },
]

/**
 * 按 targetProperty 返回允许的模板类型白名单。
 * ——严格按 kind 隔离：color 属性只给 color 模板，text 属性只给 text 模板，等等。
 * ——rawValue 永远允许（测点原始值直接塞进去，保留后门）。
 * ——多状态元件（hasStateOptions）优先级最高：只给 elementStateMapping。
 */
export const allowedTemplateTypesFor = (
  targetProperty?: string,
  hasStateOptions?: boolean,
): Set<JexlTemplateType> => {
  // 1. 多状态元件：只给 elementStateMapping
  if (hasStateOptions) return new Set(['elementStateMapping'])

  // 2. 未知 targetProperty：保守策略，只给 rawValue
  if (!targetProperty) {
    return new Set(jexlTemplateTypeOptions.map((o) => o.value))
  }

  // 3. 按 targetProperty 精确匹配
  switch (targetProperty) {
    // —— 颜色类：输出颜色字符串 ——
    case 'fill':
    case 'stroke':
    case 'fontColor':
      return new Set(['rawValue', 'colorMap', 'threshold'])

    // —— 文本类：输出文本字符串 ——
    case 'text':
    case 'label':
      return new Set(['rawValue', 'textFormat', 'boolText', 'statusTextMapping'])

    // —— 多状态元件：输出元件状态 ID ——
    case 'state':
      return new Set(['rawValue', 'elementStateMapping'])

    // —— 节点动画：输出动画模板 ID / 'none' ——
    case 'nodeAnim':
      return new Set(['rawValue', 'boolAnim', 'statusAnimMapping'])

    // —— 线条动画：输出动画枚举值 ——
    case 'lineAnim':
      return new Set(['rawValue', 'boolAnim', 'statusAnimMapping'])

    // —— 布尔属性（可见性等）——
    case 'visible':
      return new Set(['rawValue', 'boolText'])

    // —— 数值类属性（位置/大小/旋转/透明度/进度）——
    // 数值属性理论上应映射数值，但文本格式化模板 textFormat 也能凑活（比如透明度要显示带单位的文本）
    case 'opacity':
    case 'progress':
    case 'x':
    case 'y':
    case 'width':
    case 'height':
    case 'angle':
    case 'strokeWidth':
    case 'fontSize':
      return new Set(['rawValue', 'textFormat', 'threshold', 'colorMap'])

    // —— 兜底：只给 rawValue ——
    default:
      return new Set(['rawValue'])
  }
}

/** 阈值操作符选项 */
export const thresholdOperatorOptions: { label: string; value: string }[] = [
  { label: '大于', value: '>' },
  { label: '大于等于', value: '>=' },
  { label: '小于', value: '<' },
  { label: '小于等于', value: '<=' },
  { label: '区间[min,max]', value: 'between' },
]

// 重新导出类型，方便组件从同一模块导入
export type { TriggerItem }
