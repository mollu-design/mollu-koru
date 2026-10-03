/**
 * 图元动画的 TS 类型定义。
 * 仅包含纯类型（type / interface），动画字典与运行时辅助函数见 animationConfig.ts。
 */

/** 动画模板标识（7 种内置模板） */
export type AnimationTemplateId =
  | 'opacityBreath'
  | 'motorSpin'
  | 'scaleBounce'
  | 'glowBreath'
  | 'rotateOnce'
  | 'fadeIn'
  | 'fadeOut'

/** 模板类别：循环无限 / 一次性过渡 */
export type AnimationCycle = 'loop' | 'once'

/** 适用对象 */
export type AnimationTarget = 'node' | 'edge'

/** 模板参数类型 */
export type AnimParamType = 'number' | 'color'

/** 模板参数定义（用于生成动态表单） */
export interface AnimationParamDef {
  key: string
  label: string
  type: AnimParamType
  min?: number
  max?: number
  step?: number
  default: number | string
}

/** 动画模板元信息 */
export interface AnimationTemplateDef {
  id: AnimationTemplateId
  label: string
  cycle: AnimationCycle
  target: AnimationTarget
  params: AnimationParamDef[]
  desc: string
}

/** 动画配置（存储于 cell.data.animation） */
export interface AnimationConfig {
  enabled: boolean
  templateId: AnimationTemplateId | ''
  options: Record<string, number | string>
}
