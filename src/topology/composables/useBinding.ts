/**
 * 绑定配置的 CRUD 逻辑与设备数据源。
 * 移植自 webtopo，供 mollu-koru 绑定面板使用。
 */
import { computed } from 'vue'
import { type BindingItem, type DeviceOption } from './bindingTypes'

/** 内置设备目录 */
const deviceCatalog: DeviceOption[] = [
  {
    value: 'PLC-01',
    label: 'PLC-01 主控PLC',
    points: [
      { value: 'current', label: '电流' },
      { value: 'voltage', label: '电压' },
      { value: 'temperature', label: '温度' },
    ],
  },
  {
    value: 'MOTOR-A',
    label: 'MOTOR-A 电机A',
    points: [
      { value: 'run', label: '运行状态' },
      { value: 'speed', label: '转速' },
      { value: 'current', label: '电流' },
    ],
  },
  {
    value: 'MOTOR-B',
    label: 'MOTOR-B 电机B',
    points: [
      { value: 'run', label: '运行状态' },
      { value: 'speed', label: '转速' },
    ],
  },
  {
    value: 'VALVE-01',
    label: 'VALVE-01 阀门',
    points: [
      { value: 'open', label: '开度' },
      { value: 'position', label: '阀位' },
    ],
  },
  {
    value: 'SENSOR-01',
    label: 'SENSOR-01 传感器',
    points: [
      { value: 'value', label: '测量值' },
      { value: 'temp', label: '温度' },
    ],
  },
]

const newId = () => `b-${Date.now()}-${Math.floor(Math.random() * 1000)}`

export const newBinding = (): BindingItem => ({
  id: newId(),
  device: '',
  deviceLabel: '',
  dataPoint: '',
  targetProperty: '',
  mappingRules: 'tagVal',
  refreshInterval: 1000,
  readOnly: false,
  triggers: [],
})

export const useBinding = (
  getCellProps: () => Record<string, any>,
  emitUpdate: (key: string, value: any) => void,
  allNodes?: { value: string; label: string }[],
  externalDeviceOptions?: { value: string; label: string }[],
  externalCatalog?: DeviceOption[],
) => {
  const catalog: DeviceOption[] =
    externalCatalog && externalCatalog.length ? externalCatalog : deviceCatalog

  const config = computed<{ bindings: BindingItem[] }>(() => {
    const cellProps = getCellProps()
    const raw = cellProps.binding
    const list = raw && Array.isArray(raw.bindings) ? raw.bindings : []
    return { bindings: list }
  })

  const emitConfig = (bindings: BindingItem[]) => {
    emitUpdate('binding', { bindings })
  }

  const updateBinding = (id: string, patch: Partial<BindingItem>) => {
    const cellProps = getCellProps()
    const raw = cellProps?.binding
    const current: BindingItem[] = raw && Array.isArray(raw.bindings) ? [...raw.bindings] : []
    const bindings = current.map((b) => (b.id === id ? { ...b, ...patch } : b))
    emitConfig(bindings)
  }

  const addBinding = () => {
    const cellProps = getCellProps()
    const raw = cellProps?.binding
    const current: BindingItem[] = raw && Array.isArray(raw.bindings) ? [...raw.bindings] : []
    const next = [...current, newBinding()]
    emitConfig(next)
  }

  const removeBinding = (id: string) => {
    // 直接从 getCellProps 读取最新数据，避免 computed 缓存导致读到旧值
    const cellProps = getCellProps()
    const raw = cellProps?.binding
    const current: BindingItem[] = raw && Array.isArray(raw.bindings) ? [...raw.bindings] : []
    const bindings = current.filter((b) => b.id !== id)
    emitConfig(bindings)
  }

  const deviceSelectOptions = catalog.map((d) => ({ label: d.label, value: d.value }))

  const deviceDisplay = (b: BindingItem) => {
    if (b.deviceLabel) return b.deviceLabel
    const dev = catalog.find((d) => d.value === b.device)
    return dev ? dev.label : b.device
  }

  const onDeviceChange = (b: BindingItem, v: any) => {
    const value = typeof v === 'object' && v !== null ? String(v?.value ?? '') : String(v ?? '')
    updateBinding(b.id, { device: value, deviceLabel: '', dataPoint: '' })
  }

  const dataPointOptionsOf = (b: BindingItem) => {
    const dev = catalog.find((d) => d.value === b.device)
    if (!dev || !dev.points) return []
    return dev.points.map((p) => ({ label: p.label, value: p.value }))
  }

  const writePointControlPointOptions = (deviceValue: string) => {
    const dev = catalog.find((d) => d.value === deviceValue)
    return dev ? dev.points.map((p) => ({ label: p.label, value: p.value })) : []
  }

  const writePointDeviceOptions = (): { value: string; label: string }[] =>
    externalDeviceOptions && externalDeviceOptions.length
      ? externalDeviceOptions
      : deviceSelectOptions

  const targetNodeOptions = () =>
    allNodes && allNodes.length ? allNodes : [{ label: '当前图元', value: 'self' }]

  const bindingHeader = (b: BindingItem, idx: number) => {
    const dev = deviceDisplay(b) || '未选设备'
    const dp = b.dataPoint ? `｜测点：${b.dataPoint}` : ''
    const tp = b.targetProperty ? ` → 属性：${b.targetProperty}` : ''
    return `绑定${idx + 1}`
  }

  return {
    config,
    updateBinding,
    addBinding,
    removeBinding,
    deviceSelectOptions,
    deviceDisplay,
    onDeviceChange,
    dataPointOptionsOf,
    writePointControlPointOptions,
    writePointDeviceOptions,
    targetNodeOptions,
    bindingHeader,
  }
}
