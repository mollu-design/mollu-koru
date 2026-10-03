/**
 * JEXL 映射规则弹窗逻辑。
 * 移植自 webtopo 的 useJexl.ts。
 */
import { computed, ref } from 'vue'
import {
  type BindingItem,
  type JexlTemplateState,
  type JexlTemplateType,
  type TextMappingConfig,
  type StyleMappingConfig,
  type ThresholdRule,
} from './bindingTypes'

export interface JexlEditorState {
  bId: string
  draft: string
  activeTab: 'template' | 'advanced'
  template: JexlTemplateState
  templateEditable: boolean
  shape?: string
  stateOptions?: { stateId: string; stateName: string }[]
  /** 是否为多状态元件（是则模板类型仅显示 elementStateMapping） */
  isMultiState?: boolean
  /** 目标属性（如 'fill'、'nodeAnim'、'text'），用于 UI 过滤可用模板类型 */
  targetProperty?: string
}

export interface ButtonMappingState {
  bId: string
  textDraft: string
  styleDraft: string
  textTemplate: JexlTemplateState
  styleTemplate: JexlTemplateState
  textEditable: boolean
  styleEditable: boolean
  activeTab: 'text' | 'style' | 'advanced'
  textAdvanced: string
  styleAdvanced: string
  shape: string
}

export interface JexlValidateResult {
  type: 'success' | 'error'
  message: string
}

export const normalizedJexl = (expr: string) => (expr && expr.trim() ? expr.trim() : 'tagVal')

export const newJexlTemplate = (): JexlTemplateState => ({
  type: 'colorMap',
  colorPairs: [
    { value: '1', color: '#28a745' },
    { value: '', color: '#333333' },
  ],
  thresholdRules: [
    { operator: '>', value: 100, min: null, max: null, color: '#f5222d' },
    { operator: '<', value: 0, min: null, max: null, color: '#1677ff' },
  ],
  defaultColor: '#333333',
  thresholdValue: '100',
  thresholdOp: 'gt',
  normalColor: '#333333',
  alarmColor: '#f5222d',
  prefix: 'I=',
  suffix: 'A',
  decimals: 1,
  trueText: '合闸',
  falseText: '分闸',
  mappingItems: [
    { sourceValue: '1', showText: '运行' },
    { sourceValue: '0', showText: '停止' },
  ],
  defaultText: '未知',
})

export const parseTemplateFromJexl = (expr: string): JexlTemplateState | null => {
  const code = normalizedJexl(expr)
  if (!expr || !expr.trim()) return newJexlTemplate()
  if (code === 'tagVal') {
    const t = newJexlTemplate()
    t.type = 'rawValue'
    return t
  }

  let m = code.match(/^tagVal\s*\?\s*'([^']*)'\s*:\s*'([^']*)'$/)
  if (m) {
    const t = newJexlTemplate()
    t.type = 'boolText'
    t.trueText = m[1]
    t.falseText = m[2]
    return t
  }

  m = code.match(
    /^((?:tagVal\s*==\s*'?[^'?:]+?'?\s*\?\s*'#[0-9a-fA-F]{3,8}'\s*:\s*)+)(('#[0-9a-fA-F]{3,8}')|'[^']*')$/,
  )
  if (m) {
    const pairs: { value: string; color: string }[] = []
    const segRe = /tagVal\s*==\s*'?([^'?:]+?)'?\s*\?\s*'?(#[0-9a-fA-F]{3,8})'?/g
    let seg: RegExpExecArray | null
    while ((seg = segRe.exec(m[1])) !== null) {
      pairs.push({ value: seg[1].trim(), color: seg[2] })
    }
    if (pairs.length >= 1) {
      const t = newJexlTemplate()
      t.type = 'colorMap'
      t.colorPairs = [...pairs, { value: '', color: m[2].replace(/^'|'$/g, '') }]
      return t
    }
  }

  m = code.match(
    /^((?:tagVal\s*==\s*'?[^'?:]+?'?\s*\?\s*'(?:[^'#][^']*|#[^0-9a-fA-F][^']*)'\s*:\s*)+)'([^']*)'$/,
  )
  if (m) {
    const items: { sourceValue: string; showText: string }[] = []
    const segRe = /tagVal\s*==\s*'?([^'?:]+?)'?\s*\?\s*'([^']*)'/g
    let seg: RegExpExecArray | null
    while ((seg = segRe.exec(m[1])) !== null) {
      items.push({ sourceValue: seg[1].trim(), showText: seg[2] })
    }
    if (items.length >= 1) {
      const t = newJexlTemplate()
      t.type = 'statusTextMapping'
      t.mappingItems = items
      t.defaultText = m[2]
      return t
    }
  }

  const multiThreshold = tryParseMultiThreshold(code)
  if (multiThreshold) return multiThreshold

  m = code.match(/^tagVal\s*(>|>=|<|<=)\s*([0-9.]+)\s*\?\s*'([^']*)'\s*:\s*'([^']*)'$/)
  if (m) {
    const t = newJexlTemplate()
    t.type = 'threshold'
    const op = m[1]
    t.thresholdOp = op === '>' || op === '>=' ? 'gt' : 'lt'
    t.thresholdValue = m[2]
    t.alarmColor = m[3]
    t.normalColor = m[4]
    t.thresholdRules = [
      { operator: op as any, value: Number(m[2]), min: null, max: null, color: m[3] },
    ]
    t.defaultColor = m[4]
    return t
  }

  m = code.match(/^"([^"]*)"\s*\+\s*format\(\s*tagVal\s*,\s*(\d+)\s*\)\s*\+\s*"([^"]*)"$/)
  if (m) {
    const t = newJexlTemplate()
    t.type = 'textFormat'
    t.prefix = m[1]
    t.suffix = m[3]
    t.decimals = Number(m[2])
    return t
  }

  return null
}

export const buildTemplateJexl = (t: JexlTemplateState): string => {
  switch (t.type) {
    case 'colorMap': {
      const rows = t.colorPairs || []
      const conds = rows.filter((p) => p.value !== '' && p.color)
      const defaultRow =
        rows.find((p) => p.value === '' && p.color) || (conds.length ? conds[0] : null)
      if (conds.length === 0) {
        return defaultRow ? `'${defaultRow.color}'` : 'tagVal'
      }
      let expr = ''
      conds.forEach((p) => {
        expr += `tagVal=='${p.value}'?'${p.color}':`
      })
      expr += `'${defaultRow ? defaultRow.color : '#000000'}'`
      return expr
    }
    case 'threshold':
    case 'threshold_color': {
      const rules = t.thresholdRules || []
      if (rules.length === 0) return `'${t.defaultColor || '#333333'}'`
      return buildThresholdJexl(rules, t.defaultColor || '#333333')
    }
    case 'textFormat':
      return `"${t.prefix || ''}"+format(tagVal,${t.decimals || 0})+"${t.suffix || ''}"`
    case 'boolText':
      return `tagVal?'${t.trueText || ''}':'${t.falseText || ''}'`
    case 'boolAnim':
      // 测点为1/true → 启动指定动画模板；为0/false → 停止（输出 'none'）
      return `tagVal?'${t.trueText || 'opacityBreath'}':'none'`
    case 'statusTextMapping':
    case 'elementStateMapping':
    case 'statusAnimMapping': {
      const items = t.mappingItems || []
      if (items.length === 0)
        return `'${t.defaultText || (t.type === 'statusAnimMapping' ? 'none' : '')}'`
      let expr = ''
      items.forEach((p) => {
        expr += `tagVal=='${p.sourceValue}'?'${p.showText}':`
      })
      expr += `'${t.defaultText || (t.type === 'statusAnimMapping' ? 'none' : '')}'`
      return expr
    }
    case 'rawValue':
      return 'tagVal'
    default:
      return 'tagVal'
  }
}

export const buildThresholdJexl = (rules: ThresholdRule[], defaultColor: string): string => {
  let expr = `'${defaultColor}'`
  for (let i = rules.length - 1; i >= 0; i--) {
    const r = rules[i]
    let cond = ''
    if (r.operator === 'between') {
      cond = `tagVal>=${Number(r.min)}&&tagVal<=${Number(r.max)}`
    } else {
      cond = `tagVal${r.operator}${Number(r.value)}`
    }
    expr = `${cond}?'${r.color}':(${expr})`
  }
  return expr
}

const tryParseMultiThreshold = (code: string): JexlTemplateState | null => {
  let pos = 0
  const parseExpr = (): any => {
    const trimmed = code.slice(pos)
    const colorMatch = trimmed.match(/^'((?:#[0-9a-fA-F]{3,8}|[^']*))'/)
    if (colorMatch) {
      pos += colorMatch[0].length
      return { color: colorMatch[1], rest: code.slice(pos) }
    }
    const condMatch = trimmed.match(
      /^tagVal\s*(>|>=|<|<=)\s*([0-9.]+)\s*\?\s*'((?:#[0-9a-fA-F]{3,8}|[^']*))'\s*:\s*\(/,
    )
    if (condMatch) {
      const op = condMatch[1] as ThresholdRule['operator']
      const value = Number(condMatch[2])
      const color = condMatch[3]
      pos += condMatch[0].length
      const inner = parseExpr()
      if (!inner) return null
      if (code[pos] !== ')') return null
      pos++
      return {
        color: '',
        rest: code.slice(pos),
        _rule: { operator: op, value, min: null, max: null, color },
        _inner: inner,
      }
    }
    const betweenMatch = trimmed.match(
      /^tagVal\s*>=\s*([0-9.]+)\s*&&\s*tagVal\s*<=\s*([0-9.]+)\s*\?\s*'((?:#[0-9a-fA-F]{3,8}|[^']*))'\s*:\s*\(/,
    )
    if (betweenMatch) {
      const min = Number(betweenMatch[1])
      const max = Number(betweenMatch[2])
      const color = betweenMatch[3]
      pos += betweenMatch[0].length
      const inner = parseExpr()
      if (!inner) return null
      if (code[pos] !== ')') return null
      pos++
      return {
        color: '',
        rest: code.slice(pos),
        _rule: { operator: 'between', value: null, min, max, color },
        _inner: inner,
      }
    }
    return null
  }

  const result = parseExpr()
  if (!result || pos !== code.length) return null

  const rules: ThresholdRule[] = []
  let defaultColor = '#333333'
  let current: any = result
  while (current) {
    if (current._rule) {
      rules.push(current._rule)
      current = current._inner
    } else {
      defaultColor = current.color
      break
    }
  }
  if (rules.length === 0) return null

  const t = newJexlTemplate()
  t.type = 'threshold'
  t.thresholdRules = rules
  t.defaultColor = defaultColor
  return t
}

export const validateJexl = (expr: string): { ok: boolean; message: string } => {
  const code = normalizedJexl(expr)
  if (!code) return { ok: true, message: '表达式为空，将使用默认值 tagVal' }
  const sandbox = { tagVal: 1, format: (v: number, d: number) => Number(v).toFixed(d) }
  try {
    const fn = new Function('tagVal', 'format', `return (${code});`)
    const result = fn(sandbox.tagVal, sandbox.format)
    const typeOk = typeof result !== 'undefined'
    return {
      ok: true,
      message: `表达式校验通过（测试 tagVal=1 → ${JSON.stringify(result)}${typeOk ? '' : '，返回值为空'}）`,
    }
  } catch (e: any) {
    try {
      new Function('tagVal', 'format', `${code}; return tagVal;`)(sandbox.tagVal, sandbox.format)
      return { ok: true, message: '表达式校验通过' }
    } catch (e2: any) {
      return { ok: false, message: `语法错误：${e2?.message ?? e?.message ?? '未知错误'}` }
    }
  }
}

export const useJexl = (updateBinding: (id: string, patch: Partial<BindingItem>) => void) => {
  const jexlEditor = ref<JexlEditorState | null>(null)
  const jexlVisible = computed({
    get: () => jexlEditor.value !== null,
    set: (v: boolean) => {
      if (!v) jexlEditor.value = null
    },
  })
  const jexlValidateResult = ref<{ type: 'success' | 'error'; message: string } | null>(null)

  const openJexl = (
    b: BindingItem,
    shape?: string,
    stateOptions?: { stateId: string; stateName: string }[],
    isMultiState?: boolean,
  ) => {
    const useStyleMapping = shape === 'custom-text' && b.styleMapping
    if (useStyleMapping) {
      const template = buildTemplateFromStyleMapping(b.styleMapping!)
      const draft = buildTemplateJexl(template)
      jexlEditor.value = {
        bId: b.id,
        draft,
        activeTab: 'template',
        template,
        templateEditable: true,
        shape,
        stateOptions,
        isMultiState,
        targetProperty: b.targetProperty,
      }
    } else {
      const draft = b.mappingRules
      let template = parseTemplateFromJexl(draft)
      if (template && b.templateType === 'elementStateMapping') {
        template.type = 'elementStateMapping'
      }
      // 多状态元件（有 stateOptions）：首次打开时默认模板类型为 elementStateMapping
      const hasStateOpts = !!(stateOptions && stateOptions.length > 0)
      if (hasStateOpts && (!template || template.type === 'rawValue')) {
        template = newJexlTemplate()
        template.type = 'elementStateMapping'
        template.mappingItems = []
        template.defaultText = stateOptions?.[0]?.stateId || ''
      }
      // 动画目标属性：首次打开时默认用 boolAnim（最简单）
      const isAnimTarget = b.targetProperty === 'nodeAnim' || b.targetProperty === 'lineAnim'
      if (isAnimTarget && (!template || template.type === 'rawValue')) {
        template = newJexlTemplate()
        template.type = 'boolAnim'
        template.trueText = 'opacityBreath'
        template.falseText = 'none'
      }
      // 颜色目标属性（fill/stroke/fontColor）：首次打开时默认 threshold（支持大于/小于/区间）
      const isColorTarget =
        b.targetProperty === 'fill' ||
        b.targetProperty === 'stroke' ||
        b.targetProperty === 'fontColor'
      if (isColorTarget && (!template || template.type === 'rawValue')) {
        template = newJexlTemplate()
        template.type = 'threshold'
      }
      // 文本目标属性（text/label）：首次打开时默认 rawValue（直接输出测点值）
      const isTextTarget = b.targetProperty === 'text' || b.targetProperty === 'label'
      if (isTextTarget && (!template || template.type === 'rawValue')) {
        // rawValue 即为默认，不需要覆盖
      }
      jexlEditor.value = {
        bId: b.id,
        draft,
        activeTab: template ? 'template' : 'advanced',
        template: template || newJexlTemplate(),
        templateEditable: template !== null,
        shape,
        stateOptions,
        isMultiState: hasStateOpts,
        targetProperty: b.targetProperty,
      }
    }
    jexlValidateResult.value = null
  }

  const buildTemplateFromStyleMapping = (styleMapping: StyleMappingConfig): JexlTemplateState => {
    const t = newJexlTemplate()
    t.type =
      styleMapping.templateType === 'threshold_color' ? 'threshold' : styleMapping.templateType
    if (styleMapping.templateType === 'colorMap') {
      t.colorPairs = [
        ...(styleMapping.mappingItems || []).map((m) => ({ value: m.sourceValue, color: m.color })),
        { value: '', color: styleMapping.defaultColor || '#909399' },
      ]
    } else if (styleMapping.templateType === 'threshold_color') {
      t.thresholdRules =
        (styleMapping.rules || []).length > 0
          ? styleMapping.rules!.map((r) => ({ ...r }))
          : [
              { operator: '>', value: 100, min: null, max: null, color: '#f5222d' },
              { operator: '<', value: 0, min: null, max: null, color: '#1677ff' },
            ]
      t.defaultColor = styleMapping.defaultColor || '#333333'
    } else {
      const op = styleMapping.thresholdOp === 'lt' ? '<' : '>'
      t.thresholdRules = [
        {
          operator: op as any,
          value: Number(styleMapping.thresholdValue || 100),
          min: null,
          max: null,
          color: styleMapping.alarmColor || '#f53f3f',
        },
      ]
      t.defaultColor = styleMapping.normalColor || '#333333'
      t.thresholdValue = styleMapping.thresholdValue || '100'
      t.thresholdOp = styleMapping.thresholdOp || 'gt'
      t.alarmColor = styleMapping.alarmColor || '#f53f3f'
      t.normalColor = styleMapping.normalColor || '#00b42a'
    }
    return t
  }

  const onTemplateTypeChange = (type: JexlTemplateType) => {
    if (!jexlEditor.value) return
    jexlEditor.value.template = newJexlTemplate()
    jexlEditor.value.template.type = type
    if (type === 'elementStateMapping') {
      const opts = jexlEditor.value.stateOptions || []
      jexlEditor.value.template.mappingItems = []
      jexlEditor.value.template.defaultText =
        opts.find((s) => s.stateId === 'default')?.stateId || opts[0]?.stateId || ''
    }
    if (type === 'boolAnim') {
      // 布尔动画：真值启动 opacityBreath，假值停止
      jexlEditor.value.template.trueText = 'opacityBreath'
      jexlEditor.value.template.falseText = 'none'
    }
    if (type === 'statusAnimMapping') {
      // 状态动画映射：默认空映射，缺省为 none（停止）
      jexlEditor.value.template.mappingItems = []
      jexlEditor.value.template.defaultText = 'none'
    }
    applyTemplate()
  }

  const applyTemplate = () => {
    if (!jexlEditor.value) return
    jexlEditor.value.draft = buildTemplateJexl(jexlEditor.value.template)
    jexlEditor.value.templateEditable = true
  }

  const onAdvancedInput = () => {
    if (!jexlEditor.value) return
    const parsed = parseTemplateFromJexl(jexlEditor.value.draft)
    if (parsed) {
      jexlEditor.value.template = parsed
      jexlEditor.value.templateEditable = true
    } else {
      jexlEditor.value.templateEditable = false
    }
  }

  const checkJexl = () => {
    if (!jexlEditor.value) return
    const r = validateJexl(jexlEditor.value.draft)
    jexlValidateResult.value = { type: r.ok ? 'success' : 'error', message: r.message }
  }

  const saveJexl = () => {
    if (!jexlEditor.value) return
    const r = validateJexl(jexlEditor.value.draft)
    if (!r.ok) {
      ;(window as any).$arco?.Message?.error?.(r.message)
      return
    }
    const { bId, draft, template, shape } = jexlEditor.value
    const isColorTemplate = template.type === 'colorMap' || template.type === 'threshold'
    const isCustomText = shape === 'custom-text'

    if (isCustomText && isColorTemplate) {
      const styleMapping = buildStyleConfigFromTemplate(template)
      const textMapping: TextMappingConfig = {
        templateType: 'statusTextMapping',
        mappingItems: [],
        defaultText: '',
      }
      updateBinding(bId, {
        mappingRules: 'tagVal',
        textMapping,
        styleMapping,
        templateType: template.type,
      })
    } else {
      const norm = normalizedJexl(draft)
      const updates: Record<string, any> = { mappingRules: norm, templateType: template.type }
      if (isCustomText && template.type !== 'rawValue') {
        const textMapping: TextMappingConfig = {
          templateType: 'statusTextMapping',
          mappingItems: template.mappingItems || [],
          defaultText: template.defaultText || '',
        }
        updates.textMapping = textMapping
      }
      updateBinding(bId, updates)
    }
    jexlEditor.value = null
    jexlValidateResult.value = null
  }

  const buildStyleConfigFromTemplate = (template: JexlTemplateState): StyleMappingConfig => {
    if (template.type === 'colorMap') {
      const pairs = (template.colorPairs || [])
        .filter((p: any) => p.value !== '')
        .map((p: any) => ({ sourceValue: p.value, color: p.color }))
      const defaultRow = (template.colorPairs || []).find((p: any) => p.value === '')
      return {
        templateType: 'colorMap',
        mappingItems: pairs,
        defaultColor: defaultRow?.color || '#909399',
      }
    }
    const rules = (template.thresholdRules || []).map((r) => ({
      operator: r.operator,
      value: r.value,
      min: r.min,
      max: r.max,
      color: r.color,
    }))
    return {
      templateType: 'threshold_color',
      rules,
      mappingItems: [],
      defaultColor: template.defaultColor || '#333333',
    }
  }

  const addColorPair = () => {
    if (jexlEditor.value) {
      jexlEditor.value.template.colorPairs.push({ value: '', color: '#28a745' })
      applyTemplate()
    }
  }
  const removeColorPair = (i: number) => {
    if (jexlEditor.value) {
      jexlEditor.value.template.colorPairs.splice(i, 1)
      applyTemplate()
    }
  }
  const addThresholdRule = () => {
    if (jexlEditor.value) {
      jexlEditor.value.template.thresholdRules.push({
        operator: '>',
        value: 100,
        min: null,
        max: null,
        color: '#f5222d',
      })
      applyTemplate()
    }
  }
  const removeThresholdRule = (i: number) => {
    if (!jexlEditor.value) return
    if (jexlEditor.value.template.thresholdRules.length <= 1) {
      ;(window as any).$arco?.Message?.warning?.('至少保留一条规则')
      return
    }
    jexlEditor.value.template.thresholdRules.splice(i, 1)
    applyTemplate()
  }
  const addMappingItem = () => {
    if (jexlEditor.value) {
      jexlEditor.value.template.mappingItems.push({ sourceValue: '', showText: '' })
      applyTemplate()
    }
  }
  const removeMappingItem = (i: number) => {
    if (jexlEditor.value) {
      jexlEditor.value.template.mappingItems.splice(i, 1)
      applyTemplate()
    }
  }

  // === 按钮双映射 ===
  const buttonMapping = ref<ButtonMappingState | null>(null)
  const buttonMappingVisible = computed({
    get: () => buttonMapping.value !== null,
    set: (v: boolean) => {
      if (!v) buttonMapping.value = null
    },
  })

  const buildTemplateFromConfig = (
    textMapping?: TextMappingConfig,
    styleMapping?: StyleMappingConfig,
  ) => {
    const textT = newJexlTemplate()
    textT.type = 'statusTextMapping'
    if (textMapping) {
      textT.mappingItems = textMapping.mappingItems || []
      textT.defaultText = textMapping.defaultText || ''
    }
    const textDraft = buildTemplateJexl(textT)

    const styleT = newJexlTemplate()
    const rawType = styleMapping?.templateType || 'colorMap'
    styleT.type = rawType === 'threshold_color' ? 'threshold' : rawType
    if (styleMapping?.templateType === 'colorMap') {
      styleT.colorPairs = styleMapping.mappingItems?.length
        ? [
            ...styleMapping.mappingItems.map((m) => ({ value: m.sourceValue, color: m.color })),
            { value: '', color: styleMapping.defaultColor || '#909399' },
          ]
        : [
            { value: '1', color: '#00b42a' },
            { value: '0', color: '#f53f3f' },
            { value: '', color: '#909399' },
          ]
    } else if (styleMapping?.templateType === 'threshold_color' && styleMapping.rules?.length) {
      styleT.thresholdRules = styleMapping.rules.map((r) => ({ ...r }))
      styleT.defaultColor = styleMapping.defaultColor || '#333333'
    } else {
      const op = styleMapping?.thresholdOp === 'lt' ? '<' : '>'
      styleT.thresholdRules = [
        {
          operator: op as any,
          value: Number(styleMapping?.thresholdValue || 100),
          min: null,
          max: null,
          color: styleMapping?.alarmColor || '#f53f3f',
        },
      ]
      styleT.defaultColor = styleMapping?.normalColor || '#333333'
    }
    const styleDraft = buildTemplateJexl(styleT)
    return { textT, styleT, textDraft, styleDraft }
  }

  const openButtonMapping = (b: BindingItem, shape: string) => {
    const { textT, styleT, textDraft, styleDraft } = buildTemplateFromConfig(
      b.textMapping,
      b.styleMapping,
    )
    buttonMapping.value = {
      bId: b.id,
      textDraft,
      styleDraft,
      textTemplate: textT,
      styleTemplate: styleT,
      textEditable: true,
      styleEditable: true,
      activeTab: 'text',
      textAdvanced: textDraft,
      styleAdvanced: styleDraft,
      shape,
    }
  }

  const applyButtonTextTemplate = () => {
    if (buttonMapping.value) {
      buttonMapping.value.textDraft = buildTemplateJexl(buttonMapping.value.textTemplate)
      buttonMapping.value.textEditable = true
      buttonMapping.value.textAdvanced = buttonMapping.value.textDraft
    }
  }
  const applyButtonStyleTemplate = () => {
    if (buttonMapping.value) {
      buttonMapping.value.styleDraft = buildTemplateJexl(buttonMapping.value.styleTemplate)
      buttonMapping.value.styleEditable = true
      buttonMapping.value.styleAdvanced = buttonMapping.value.styleDraft
    }
  }
  const onButtonTextTypeChange = (type: JexlTemplateType) => {
    if (buttonMapping.value) {
      buttonMapping.value.textTemplate = newJexlTemplate()
      buttonMapping.value.textTemplate.type = type
      applyButtonTextTemplate()
    }
  }
  const onButtonStyleTypeChange = (type: JexlTemplateType) => {
    if (buttonMapping.value) {
      buttonMapping.value.styleTemplate = newJexlTemplate()
      buttonMapping.value.styleTemplate.type = type
      applyButtonStyleTemplate()
    }
  }
  const addButtonTextItem = () => {
    if (buttonMapping.value) {
      buttonMapping.value.textTemplate.mappingItems.push({ sourceValue: '', showText: '' })
      applyButtonTextTemplate()
    }
  }
  const removeButtonTextItem = (i: number) => {
    if (buttonMapping.value) {
      buttonMapping.value.textTemplate.mappingItems.splice(i, 1)
      applyButtonTextTemplate()
    }
  }
  const addButtonStyleColorPair = () => {
    if (buttonMapping.value) {
      buttonMapping.value.styleTemplate.colorPairs.push({ value: '', color: '#00b42a' })
      applyButtonStyleTemplate()
    }
  }
  const removeButtonStyleColorPair = (i: number) => {
    if (buttonMapping.value) {
      buttonMapping.value.styleTemplate.colorPairs.splice(i, 1)
      applyButtonStyleTemplate()
    }
  }

  const saveButtonMapping = () => {
    if (!buttonMapping.value) return
    const { textTemplate, styleTemplate, textDraft, styleDraft } = buttonMapping.value
    const textMapping: TextMappingConfig = {
      templateType: 'statusTextMapping',
      mappingItems: textTemplate.mappingItems || [],
      defaultText: textTemplate.defaultText || '',
    }
    let styleMapping: StyleMappingConfig
    if (styleTemplate.type === 'colorMap') {
      const pairs = (styleTemplate.colorPairs || [])
        .filter((p) => p.value !== '')
        .map((p) => ({ sourceValue: p.value, color: p.color }))
      const defaultRow = (styleTemplate.colorPairs || []).find((p) => p.value === '')
      styleMapping = {
        templateType: 'colorMap',
        mappingItems: pairs,
        defaultColor: defaultRow?.color || '#909399',
      }
    } else {
      const rules = (styleTemplate.thresholdRules || []).map((r) => ({
        operator: r.operator,
        value: r.value,
        min: r.min,
        max: r.max,
        color: r.color,
      }))
      styleMapping = {
        templateType: 'threshold_color',
        rules,
        mappingItems: [],
        defaultColor: styleTemplate.defaultColor || '#333333',
      }
    }
    updateBinding(buttonMapping.value.bId, { textMapping, styleMapping, mappingRules: textDraft })
    buttonMapping.value = null
  }

  return {
    jexlEditor,
    jexlVisible,
    jexlValidateResult,
    openJexl,
    onTemplateTypeChange,
    applyTemplate,
    onAdvancedInput,
    checkJexl,
    saveJexl,
    addColorPair,
    removeColorPair,
    addThresholdRule,
    removeThresholdRule,
    addMappingItem,
    removeMappingItem,
    buttonMapping,
    buttonMappingVisible,
    openButtonMapping,
    applyButtonTextTemplate,
    applyButtonStyleTemplate,
    onButtonTextTypeChange,
    onButtonStyleTypeChange,
    addButtonTextItem,
    removeButtonTextItem,
    addButtonStyleColorPair,
    removeButtonStyleColorPair,
    saveButtonMapping,
  }
}
