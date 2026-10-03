<template>
  <a-modal
    :visible="visible"
    title="映射规则测试"
    :width="800"
    :footer="false"
    draggable
    @cancel="emit('update:visible', false)"
  >
    <div class="mapping-test-modal">
      <!-- 单条测试 -->
      <div class="mapping-test-row">
        <a-select
          v-model="selectedBindingKey"
          :options="bindingOptions"
          placeholder="选择绑定..."
          size="medium"
          allow-clear
          style="width: 320px; margin-right: 8px"
        />
        <a-input
          v-model="testMappingValue"
          size="medium"
          placeholder="输入测试值，如 1 或 #ff0000"
          style="width: 280px; margin-right: 8px"
          @press-enter="handleSingleMappingTest"
        />
        <a-button type="primary" size="medium" @click="handleSingleMappingTest">执行</a-button>
      </div>
      <pre v-if="singleMappingResult" class="mapping-test-result">{{ singleMappingResult }}</pre>

      <a-divider />

      <!-- 全面测试 -->
      <div class="mapping-test-row">
        <a-button type="primary" size="medium" @click="handleFullMappingTest">全面测试</a-button>
        <span class="mapping-test-tip">将对所有绑定执行映射，优先使用已注入的绑定数据</span>
      </div>
      <pre v-if="mappingTestReport" class="mapping-test-report">{{ mappingTestReport }}</pre>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { applyMapping } from '../../composables/useBindingExecutor'
import { parseTemplateFromJexl } from '../../composables/useJexl'
import { jexlTemplateTypeOptions } from '../../composables/bindingConfig'

/** 从按钮样式映射配置生成 JEXL 表达式 */
const buildStyleJexl = (styleMapping: any): string => {
  if (!styleMapping) return 'tagVal'
  if (styleMapping.templateType === 'colorMap') {
    const items = styleMapping.mappingItems || []
    if (items.length === 0) return `'${styleMapping.defaultColor || '#909399'}'`
    let expr = ''
    items.forEach((p: any) => {
      expr += `tagVal=='${p.sourceValue}'?'${p.color}':`
    })
    expr += `'${styleMapping.defaultColor || '#909399'}'`
    return expr
  }
  if (styleMapping.templateType === 'threshold_color') {
    const rules = styleMapping.rules || []
    if (rules.length === 0) return `'${styleMapping.defaultColor || '#333333'}'`
    let expr = `'${styleMapping.defaultColor || '#333333'}'`
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = rules[i]
      if (r.operator === 'between') {
        expr = `tagVal>=${Number(r.min)}&&tagVal<=${Number(r.max)}?'${r.color}':(${expr})`
      } else {
        expr = `tagVal${r.operator}${Number(r.value)}?'${r.color}':(${expr})`
      }
    }
    return expr
  }
  if (styleMapping.templateType === 'threshold') {
    const op = styleMapping.thresholdOp === 'lt' ? '<' : '>'
    return `tagVal${op}${Number(styleMapping.thresholdValue)}?'${styleMapping.alarmColor}':'${styleMapping.normalColor}'`
  }
  return 'tagVal'
}

const props = defineProps<{
  graph: any
  bindingValues: Record<string, string | number | null>
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const mappingTestReport = ref('')
const selectedBindingKey = ref('')
const testMappingValue = ref('')
const singleMappingResult = ref('')

/** 所有绑定选项列表 */
const bindingOptions = computed(() => {
  const g = props.graph
  if (!g) return []
  const cells = g.getCells?.() || []
  const opts: { label: string; value: string }[] = []
  cells.forEach((cell: any) => {
    if (!cell.isNode?.()) return
    const data = cell?.getData?.() || {}
    const config = data.binding
    if (!config || !Array.isArray(config.bindings)) return
    config.bindings.forEach((b: any) => {
      if (!b.mappingRules) return
      const key = `${cell.id}:${b.device}:${b.dataPoint}`
      const label = `${data.label || cell.id.slice(0, 8)}:${b.device}:${b.dataPoint}`
      opts.push({ label, value: key })
    })
  })
  return opts
})

/** 获取模板类型中文名 */
const getTemplateTypeLabel = (expr: string, templateType?: string): string => {
  if (templateType === 'elementStateMapping') return '状态-元件状态映射'
  const template = parseTemplateFromJexl(expr)
  if (!template) return '高级表达式'
  const opt = jexlTemplateTypeOptions.find((o) => o.value === template.type)
  return opt ? opt.label : template.type
}

/** 读取图元属性值 */
const readCellProp = (cell: any, targetProperty?: string): string => {
  if (targetProperty === 'visible') {
    return String(cell.visible ?? false)
  }
  if (targetProperty === 'nodeAnim') {
    const data = cell.getData?.() || {}
    return data.animation?.templateId || 'none'
  }
  if (
    targetProperty &&
    ['fill', 'stroke', 'strokeWidth', 'opacity', 'fontSize', 'color'].includes(targetProperty)
  ) {
    const selector = targetProperty === 'color' ? 'text' : 'body'
    const attr = targetProperty === 'color' ? 'fill' : targetProperty
    return String(cell.attr(`${selector}/${attr}`) ?? '')
  }
  const shape = cell.shape || ''
  if (shape === 'custom-text') return cell.attr('label/text') || ''
  if (
    shape === 'custom-button' ||
    shape === 'custom-rect' ||
    shape === 'custom-circle'
  ) {
    return cell.attr('text/text') || ''
  }
  if (shape === 'custom-split') return cell.attr('rightText/text') || ''
  return cell.attr('label/text') || ''
}

/** 单条映射测试 */
const handleSingleMappingTest = () => {
  const g = props.graph
  if (!g) {
    singleMappingResult.value = '画布未就绪'
    return
  }
  if (!selectedBindingKey.value) {
    singleMappingResult.value = '请先选择绑定'
    return
  }

  const [cellId, device, dataPoint] = selectedBindingKey.value.split(':')
  const cell = g.getCellById(cellId)
  if (!cell) {
    singleMappingResult.value = '未找到图元'
    return
  }

  const data = cell?.getData?.() || {}
  const config = data.binding
  if (!config || !Array.isArray(config.bindings)) {
    singleMappingResult.value = '未找到绑定'
    return
  }
  const b = config.bindings.find((b: any) => b.device === device && b.dataPoint === dataPoint)
  if (!b || !b.mappingRules) {
    singleMappingResult.value = '未找到绑定'
    return
  }

  const expr = b.mappingRules.trim()
  const val = testMappingValue.value || ''
  const shape = cell.shape || ''
  const hasButtonMapping = shape === 'custom-button' && (b.textMapping || b.styleMapping)
  const hasTextStyleMapping = shape === 'custom-text' && b.styleMapping

  if (hasButtonMapping) {
    applyMapping(cell, expr, val)
    if (b.styleMapping) {
      const styleExpr = buildStyleJexl(b.styleMapping)
      applyMapping(cell, styleExpr, val, 'fill')
    }
    const textResult = readCellProp(cell) || '(空)'
    const colorResult = readCellProp(cell, 'fill') || '(空)'
    singleMappingResult.value = `tagVal=${val} → 文本：${textResult}，颜色：${colorResult}`
  } else if (hasTextStyleMapping) {
    applyMapping(cell, expr, val)
    if (b.styleMapping) {
      const styleExpr = buildStyleJexl(b.styleMapping)
      try {
        const fn = new Function('tagVal', `return (${styleExpr});`)
        const color = fn(val)
        cell.attr('label/fill', String(color))
      } catch {
        /* ignore */
      }
    }
    const textResult = readCellProp(cell) || '(空)'
    const colorResult = cell.attr('label/fill') || '(空)'
    singleMappingResult.value = `tagVal=${val} → 文本：${textResult}，颜色：${colorResult}`
  } else {
    applyMapping(cell, expr, val, b.targetProperty)
    const resultText = readCellProp(cell, b.targetProperty) || '(空)'
    singleMappingResult.value = `tagVal=${val} → ${resultText}`
  }
}

/** 全面映射测试 */
const handleFullMappingTest = () => {
  const g = props.graph
  if (!g) {
    mappingTestReport.value = '画布未就绪'
    return
  }

  const cells = g.getCells?.() || []
  const lines: string[] = []

  cells.forEach((cell: any) => {
    if (!cell.isNode?.()) return
    const data = cell?.getData?.() || {}
    const config = data.binding
    if (!config || !Array.isArray(config.bindings)) return

    config.bindings.forEach((b: any) => {
      if (!b.mappingRules) return
      const expr = b.mappingRules.trim()
      const template = parseTemplateFromJexl(expr)
      const templateLabel = getTemplateTypeLabel(expr, b.templateType)
      const target = b.targetProperty || 'text'
      const cellLabel = data.label || cell.id.slice(0, 8)
      const key = `${cell.id}:${b.device}:${b.dataPoint}`
      const injectedVal = props.bindingValues[key]

      lines.push(
        `\n【${cellLabel}】设备=${b.device}:${b.dataPoint} 属性=${target} 模板=${templateLabel}`,
      )
      lines.push(`  表达式: ${expr || 'tagVal'}`)

      // 生成测试值
      const testValues: { val: string | number; source: string }[] = []
      if (injectedVal !== undefined && injectedVal !== null) {
        testValues.push({ val: injectedVal, source: '注入' })
      }

      if (template && template.type === 'colorMap') {
        ;['1', '0', '2'].forEach((v) => {
          if (!testValues.some((t) => String(t.val) === v))
            testValues.push({ val: v, source: '样本' })
        })
      } else if (
        template &&
        (template.type === 'threshold' || template.type === 'threshold_color')
      ) {
        const rules = template.thresholdRules || []
        if (rules.length > 0) {
          rules.forEach((r: any) => {
            const val = Number(r.value || 50)
            ;[val - 10, val + 10].forEach((v) => {
              if (!testValues.some((t) => String(t.val) === String(v)))
                testValues.push({ val: v, source: '样本' })
            })
          })
        } else {
          ;[90, 110].forEach((v) => {
            if (!testValues.some((t) => String(t.val) === String(v)))
              testValues.push({ val: v, source: '样本' })
          })
        }
      } else if (template && template.type === 'boolText') {
        ;[1, 0].forEach((v) => {
          if (!testValues.some((t) => String(t.val) === String(v)))
            testValues.push({ val: v, source: '样本' })
        })
      } else if (template && template.type === 'statusTextMapping') {
        const firstVal = template.mappingItems?.[0]?.sourceValue
        const secondVal = template.mappingItems?.[1]?.sourceValue
        ;[firstVal || '1', secondVal || '0', 'nonexistent'].forEach((v) => {
          if (!testValues.some((t) => String(t.val) === String(v)))
            testValues.push({ val: v, source: '样本' })
        })
      } else {
        ;[120, 'test'].forEach((v) => {
          if (!testValues.some((t) => String(t.val) === String(v)))
            testValues.push({ val: v, source: '样本' })
        })
      }

      testValues.forEach(({ val, source }) => {
        const shape = cell.shape || ''
        const hasButtonMapping = shape === 'custom-button' && (b.textMapping || b.styleMapping)
        const hasTextStyleMapping = shape === 'custom-text' && b.styleMapping
        let resultText = ''

        if (hasButtonMapping) {
          applyMapping(cell, expr, val)
          if (b.styleMapping) {
            const styleExpr = buildStyleJexl(b.styleMapping)
            applyMapping(cell, styleExpr, val, 'fill')
          }
          const textVal = readCellProp(cell) || '(空)'
          const colorVal = readCellProp(cell, 'fill') || '(空)'
          resultText = `文本：${textVal}，颜色：${colorVal}`
        } else if (hasTextStyleMapping) {
          applyMapping(cell, expr, val)
          if (b.styleMapping) {
            const styleExpr = buildStyleJexl(b.styleMapping)
            try {
              const fn = new Function('tagVal', `return (${styleExpr});`)
              const color = fn(val)
              cell.attr('label/fill', String(color))
            } catch {
              /* ignore */
            }
          }
          const textVal = readCellProp(cell) || '(空)'
          const colorVal = cell.attr('label/fill') || '(空)'
          resultText = `文本：${textVal}，颜色：${colorVal}`
        } else {
          applyMapping(cell, expr, val, b.targetProperty)
          resultText = readCellProp(cell, b.targetProperty) || '(空)'
        }
        const tag = source === '注入' ? '★注入值' : '样本值'
        lines.push(`  ${tag} tagVal=${val} → ${resultText || '(空)'}`)
      })
    })
  })

  if (lines.length === 0) {
    mappingTestReport.value = '未找到任何绑定的映射规则'
  } else {
    mappingTestReport.value = lines.join('\n')
  }
}
</script>

<style scoped>
.mapping-test-modal {
  padding: 4px 0;
}
.mapping-test-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.mapping-test-tip {
  font-size: 12px;
  color: #86909c;
  margin-left: 8px;
}
.mapping-test-result {
  margin: 8px 0 0 0;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
}
.mapping-test-report {
  margin: 8px 0 0 0;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  max-height: 400px;
  overflow: auto;
}
</style>
