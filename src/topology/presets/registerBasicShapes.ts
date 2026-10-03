/**
 * 注册基础节点形状
 *
 * 从 webtopo 项目移植，提供以下自定义节点：
 * - custom-rect: 矩形
 * - custom-circle: 圆形
 * - custom-image: 图片节点
 * - custom-split: 左右分栏节点
 * - custom-text: 文本节点
 * - custom-button: 按钮节点
 * - shape-line: 线条节点
 */

import { Graph } from '@antv/x6'
import { ports } from './ports'

export function registerBasicShapes(): void {
  // ========== custom-rect ==========
  Graph.registerNode(
    'custom-rect',
    {
      inherit: 'rect',
      width: 66,
      height: 36,
      attrs: {
        body: {
          strokeWidth: 1,
          stroke: '#5F95FF',
          fill: '#EFF4FF',
        },
        text: {
          fontSize: 12,
          fill: '#262626',
        },
      },
    },
    true,
  )

  // ========== custom-circle ==========
  Graph.registerNode(
    'custom-circle',
    {
      inherit: 'circle',
      width: 45,
      height: 45,
      attrs: {
        body: {
          strokeWidth: 1,
          stroke: '#5F95FF',
          fill: '#EFF4FF',
        },
        text: {
          fontSize: 12,
          fill: '#262626',
        },
      },
      ports: { ...ports },
    },
    true,
  )

  // ========== custom-image ==========
  Graph.registerNode(
    'custom-image',
    {
      inherit: 'rect',
      width: 52,
      height: 52,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'image', selector: 'image' },
      ],
      attrs: {
        body: { stroke: 'none', fill: 'none' },
        image: {
          refWidth: '100%',
          refHeight: '100%',
          refX: 0,
          refY: 0,
          preserveAspectRatio: 'xMidYMid meet',
        },
        label: {
          refX: 3,
          refY: 2,
          textAnchor: 'left',
          textVerticalAnchor: 'top',
          fontSize: 12,
          fill: '#fff',
          display: 'none',
        },
      },
      ports: { ...ports },
    },
    true,
  )

  // ========== custom-split（左右分栏节点） ==========
  Graph.registerNode(
    'custom-split',
    {
      inherit: 'rect',
      width: 160,
      height: 40,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'line', selector: 'divider' },
        { tagName: 'rect', selector: 'dividerHandle' },
        { tagName: 'text', selector: 'leftText' },
        { tagName: 'text', selector: 'rightText' },
      ],
      attrs: {
        body: {
          strokeWidth: 1,
          stroke: '#5F95FF',
          fill: 'transparent',
          rx: 4,
          ry: 4,
        },
        divider: {
          x1: 80,
          y1: 0,
          x2: 80,
          y2: 40,
          stroke: '#5F95FF',
          strokeWidth: 1,
          strokeDasharray: '4 3',
          cursor: 'col-resize',
          'data-role': 'split-divider',
          display: 'none',
        },
        dividerHandle: {
          x: 74,
          y: 14,
          width: 12,
          height: 12,
          rx: 2,
          ry: 2,
          fill: '#5F95FF',
          stroke: '#fff',
          strokeWidth: 1.5,
          cursor: 'col-resize',
          opacity: 0.6,
          'data-role': 'split-handle',
          display: 'none',
        },
        leftText: {
          refX: 0,
          refX2: 40,
          refY: 0.5,
          text: '键名',
          fontSize: 13,
          fill: '#262626',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          cursor: 'text',
        },
        rightText: {
          refX: 0,
          refX2: 120,
          refY: 0.5,
          text: '键值',
          fontSize: 13,
          fill: '#262626',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          cursor: 'text',
        },
      },
      ports: { ...ports },
    },
    true,
  )

  // ========== custom-text ==========
  Graph.registerNode(
    'custom-text',
    {
      inherit: 'rect',
      width: 100,
      height: 30,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: { strokeWidth: 0, fill: 'none' },
        label: {
          text: '文本',
          fontSize: 14,
          fill: '#1D2129',
          x: 8,
          y: 0.5,
          textAnchor: 'start',
          textVerticalAnchor: 'middle',
        },
      },
      ports: { ...ports },
    },
    true,
  )

  // ========== custom-button ==========
  Graph.registerNode(
    'custom-button',
    {
      inherit: 'rect',
      width: 80,
      height: 32,
      attrs: {
        body: {
          strokeWidth: 1,
          stroke: '#165DFF',
          fill: '#165DFF',
          rx: 4,
          ry: 4,
        },
        text: {
          text: '按钮',
          fontSize: 13,
          fill: '#fff',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
        },
      },
      ports: { ...ports },
    },
    true,
  )

  // ========== shape-line（线条节点） ==========
  Graph.registerNode(
    'shape-line',
    {
      inherit: 'rect',
      width: 55,
      height: 2,
      markup: [
        { tagName: 'rect', selector: 'body', attrs: { fill: 'transparent' } },
        { tagName: 'path', selector: 'line' },
      ],
      attrs: {
        body: { fill: 'transparent', stroke: 'none' },
        line: { stroke: '#333333', strokeWidth: 5, d: 'M0 1 L55 1' },
      },
      afterSetSize(this: any) {
        const { width, height } = this.getSize()
        this.setAttrs({
          line: { d: `M0 ${height / 2} L${width} ${height / 2}` },
        })
      },
    },
    true,
  )
}
