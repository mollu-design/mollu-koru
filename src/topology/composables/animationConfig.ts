/**
 * 图元动画的运行时字典与辅助函数。
 * 类型定义见 AnimationTypes.ts。
 */
import type { AnimationConfig, AnimationTemplateDef, AnimationTemplateId } from './AnimationTypes'

/**
 * 动画模板字典
 * CSS 类名格式：anim-{templateId}，已在 anim.scss 中预定义。
 */
export const ANIMATION_TEMPLATES: Record<AnimationTemplateId, AnimationTemplateDef> = {
  opacityBreath: {
    id: 'opacityBreath',
    label: '透明度呼吸',
    cycle: 'loop',
    target: 'node',
    params: [
      {
        key: 'duration',
        label: '呼吸周期(ms)',
        type: 'number',
        min: 200,
        max: 10000,
        step: 100,
        default: 2000,
      },
    ],
    desc: '节点透明度在 1 与 0.35 间渐变，用于遥信变位、待确认告警。',
  },
  motorSpin: {
    id: 'motorSpin',
    label: '电机旋转',
    cycle: 'loop',
    target: 'node',
    params: [
      {
        key: 'duration',
        label: '旋转周期(ms)',
        type: 'number',
        min: 500,
        max: 10000,
        step: 100,
        default: 3000,
      },
    ],
    desc: '节点持续旋转 360°，用于电机运行状态指示。',
  },
  scaleBounce: {
    id: 'scaleBounce',
    label: '缩放弹动',
    cycle: 'loop',
    target: 'node',
    params: [
      {
        key: 'duration',
        label: '动画时长(ms)',
        type: 'number',
        min: 200,
        max: 5000,
        step: 100,
        default: 1200,
      },
    ],
    desc: '节点循环缩放弹动效果，用于选中提示、交互反馈。',
  },
  glowBreath: {
    id: 'glowBreath',
    label: '外发光呼吸',
    cycle: 'loop',
    target: 'node',
    params: [
      {
        key: 'duration',
        label: '呼吸周期(ms)',
        type: 'number',
        min: 300,
        max: 10000,
        step: 100,
        default: 2000,
      },
      { key: 'glowColor', label: '发光颜色', type: 'color', default: '#ff3b30' },
    ],
    desc: '节点外发光光晕呼吸渐变，重要故障、越限告警强提醒。',
  },
  rotateOnce: {
    id: 'rotateOnce',
    label: '旋转一次',
    cycle: 'once',
    target: 'node',
    params: [
      {
        key: 'duration',
        label: '动画时长(ms)',
        type: 'number',
        min: 100,
        max: 5000,
        step: 100,
        default: 1200,
      },
    ],
    desc: '节点执行一次 360° 旋转动画。',
  },
  fadeIn: {
    id: 'fadeIn',
    label: '渐入显示',
    cycle: 'once',
    target: 'node',
    params: [
      {
        key: 'duration',
        label: '动画时长(ms)',
        type: 'number',
        min: 100,
        max: 5000,
        step: 100,
        default: 1000,
      },
    ],
    desc: '节点从透明渐变完全显示。',
  },
  fadeOut: {
    id: 'fadeOut',
    label: '渐隐消失',
    cycle: 'once',
    target: 'node',
    params: [
      {
        key: 'duration',
        label: '动画时长(ms)',
        type: 'number',
        min: 100,
        max: 5000,
        step: 100,
        default: 1000,
      },
    ],
    desc: '节点逐渐透明消失。',
  },
}

/** 动画模板下拉选项（按类型过滤） */
export const animationTemplateOptions = (target: 'node' | 'edge' | 'all') =>
  Object.values(ANIMATION_TEMPLATES)
    .filter((t) => target === 'all' || t.target === target)
    .map((t) => ({ label: t.label, value: t.id }))

/** 默认动画配置 */
export const defaultAnimationConfig = (): AnimationConfig => ({
  enabled: true,
  templateId: 'opacityBreath',
  options: {},
})

/**
 * 获取动画模板对应的固定 CSS 类名。
 * 类名格式：anim-{templateId}
 * 这些类名已在 useAnimation.ts 的全局 CSS 中预定义。
 */
export const animationClassFor = (templateId: AnimationTemplateId | string): string => {
  return `anim-${templateId}`
}
