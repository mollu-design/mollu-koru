/**
 * 内置默认 Stencil 分组配置
 *
 * 由 registerBasicShapes() 注册的基础节点形状，自动提供默认的 Stencil 面板分组。
 * 消费方无需定义即可使用，也可通过 setComponentConfig({ stencilGroups }) 覆盖。
 */
import type { KoruStencilGroup } from '../types'

/** 基础图形分组 — 包含自定义样式节点和 X6 原生内置节点 */
const BASIC_GROUP: KoruStencilGroup = {
  name: 'basic',
  label: '基础图形',
  graphHeight: 0,
  layoutOptions: { columns: 3, columnWidth: 60, rowHeight: 50 },
  items: [
    // ========== 自定义样式节点（registerBasicShapes 注册） ==========
    {
      shape: 'custom-rect',
      label: '长方形',
      width: 46,
      height: 30,
      dropWidth: 66,
      dropHeight: 36,
    },
    {
      shape: 'custom-circle',
      label: '圆形',
      width: 40,
      height: 40,
      dropWidth: 45,
      dropHeight: 45,
    },
    {
      shape: 'shape-line',
      label: '线条',
      width: 55,
      height: 5,
      dropWidth: 55,
      dropHeight: 5,
    },
    {
      shape: 'custom-split',
      label: '左右分栏',
      width: 50,
      height: 28,
      dropWidth: 160,
      dropHeight: 40,
      attrs: {
        body: { rx: 4, ry: 4, fill: '#EFF4FF', stroke: '#5F95FF', strokeWidth: 1 },
        leftText: {
          display: 'auto',
          text: '键值对',
          fontSize: 11,
          fill: '#262626',
          refX2: 26,
          refY: 0.5,
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
        },
        rightText: { display: 'none' },
        divider: { display: 'none' },
        dividerHandle: { display: 'none' },
      },
    },
    {
      shape: 'custom-text',
      label: '文本',
      width: 50,
      height: 24,
      dropWidth: 100,
      dropHeight: 30,
      attrs: {
        body: { fill: 'transparent', stroke: 'none' },
        label: { x: 1, y: 1, textAnchor: 'middle', textVerticalAnchor: 'middle', text: '文本' },
      },
      data: { label: '文本' },
    },
    {
      shape: 'custom-button',
      label: '按钮',
      width: 56,
      height: 24,
      dropWidth: 80,
      dropHeight: 32,
      attrs: { text: { text: '按钮' } },
      data: { label: '按钮' },
    },
    {
      shape: 'ellipse',
      label: '椭圆',
      width: 46,
      height: 30,
      dropWidth: 80,
      dropHeight: 50,
      attrs: {
        ellipse: { fill: '#EFF4FF', stroke: '#5F95FF', strokeWidth: 1 },
        text: { fontSize: 12, fill: '#262626', text: '' },
      },
    },
  ],
}

/** 自定义图片分组（空占位，由消费方动态填充实际图片） */
const IMAGE_GROUP: KoruStencilGroup = {
  name: 'images',
  label: '自定义图片',
  graphHeight: 110,
  layoutOptions: { columns: 3, columnWidth: 60, rowHeight: 60 },
  items: [],
}

/** 电气符号分组（空占位，由消费方注册 SVG 节点后动态填充） */
const SVG_GROUP: KoruStencilGroup = {
  name: 'electrical',
  label: '电气符号',
  graphHeight: 0,
  layoutOptions: { columns: 4, columnWidth: 45, rowHeight: 45 },
  items: [],
}

/** 我的模板分组（空占位） */
const TEMPLATE_GROUP: KoruStencilGroup = {
  name: 'templates',
  label: '我的模板',
  graphHeight: 0,
  layoutOptions: { columns: 2, columnWidth: 80, rowHeight: 50 },
  items: [],
}

/** 默认 Stencil 分组配置 — 消费方可直接使用，无需自行定义 */
export const DEFAULT_STENCIL_GROUPS: KoruStencilGroup[] = [BASIC_GROUP, SVG_GROUP, TEMPLATE_GROUP]
