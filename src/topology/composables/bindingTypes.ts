/**
 * 绑定配置的 TS 类型定义。
 * 仅包含纯类型（type / interface），常量与运行时数据见 bindingConfig.ts。
 */

/** 触发器行为枚举 */
export type TriggerActionType =
  | 'alert'
  | 'writePoint'
  | 'jumpPage'
  | 'addLog'
  | 'setGraphAttr'
  | 'playAudio'
  | 'sendMsg'
  | 'openDialog'
  | 'httpRequest'
  | 'runScript'
  | 'startAnimation'
  | 'stopAnimation'

/** 触发器 */
export interface TriggerItem {
  id: string
  enabled: boolean
  triggerMode: 'once_change' | 'always'
  operator: string
  compareValue: string | number
  actionType: TriggerActionType
  actionValue: Record<string, any>
  debounceMs?: number
  confirmBefore?: boolean
}

/** 文本映射配置 */
export interface TextMappingConfig {
  templateType: 'statusTextMapping'
  mappingItems: JexlMappingItem[]
  defaultText: string
}

/** 阈值规则 */
export interface ThresholdRule {
  operator: string
  value: number | null
  min: number | null
  max: number | null
  color: string
}

/** 样式映射配置 */
export interface StyleMappingConfig {
  templateType: 'colorMap' | 'threshold' | 'threshold_color'
  mappingItems: { sourceValue: string; color: string }[]
  defaultColor: string
  rules?: ThresholdRule[]
  thresholdValue?: string
  thresholdOp?: 'gt' | 'lt'
  normalColor?: string
  alarmColor?: string
}

/** 单个绑定项 */
export interface BindingItem {
  id: string
  device: string
  deviceLabel: string
  dataPoint: string
  targetProperty: string
  mappingRules: string
  refreshInterval: number
  readOnly: boolean
  triggers: TriggerItem[]
  templateType?: JexlTemplateType
  textMapping?: TextMappingConfig
  styleMapping?: StyleMappingConfig
}

/** 可视化模板类型 */
export type JexlTemplateType =
  | 'colorMap'
  | 'threshold'
  | 'threshold_color'
  | 'textFormat'
  | 'boolText'
  | 'statusTextMapping'
  | 'rawValue'
  | 'elementStateMapping'
  /** 布尔-动画映射：测点为1启动动画，为0停止 */
  | 'boolAnim'
  /** 状态-动画映射：按测点值选择不同动画模板 */
  | 'statusAnimMapping'

/** 映射项 */
export interface JexlMappingItem {
  sourceValue: string
  showText: string
}

/** 模板状态 */
export interface JexlTemplateState {
  type: JexlTemplateType
  colorPairs: { value: string; color: string }[]
  thresholdRules: ThresholdRule[]
  defaultColor: string
  thresholdValue: string
  thresholdOp: 'gt' | 'lt'
  normalColor: string
  alarmColor: string
  prefix: string
  suffix: string
  decimals: number
  trueText: string
  falseText: string
  mappingItems: JexlMappingItem[]
  defaultText: string
}

/** 设备选项 */
export interface DeviceOption {
  value: string
  label: string
  points: { value: string; label: string }[]
}

// ========== 绑定注册表（供后端订阅 WS 推送 + 告警检测） ==========

/** 绑定注册表单项：图元 + 其全部测点订阅 */
export interface BindingRegistryEntry {
  id: string
  device: string
  deviceLabel: string
  dataPoint: string
  targetProperty: string
  mappingRules: string
  refreshInterval: number
  triggerCount: number
  /** 完整 triggers 数组（后端 alarm_scheduler / realtime+alarms 消费） */
  triggers?: TriggerItem[]
}

/** 绑定注册表：每个有绑定属性的图元对应一项 */
export interface BindingRegistryItem {
  cellId: string
  cellLabel: string
  shape: string
  bindings: BindingRegistryEntry[]
}
