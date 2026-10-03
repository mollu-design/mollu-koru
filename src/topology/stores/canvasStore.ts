/**
 * 全局画布状态 Store
 *
 * 替代 provide/inject 用于跨 slot 通信。
 * Vue 3 中 slot 内容组件无法访问 slot 出口组件的 provide，
 * 因此使用全局 store 模式共享画布实例和 X6 Graph 引用。
 */
import { shallowRef, ref, reactive } from 'vue'
import type { Graph } from '@antv/x6'
import type { KoruGraphEditorInstance, KoruCanvasConfig, KoruStencilGroup } from '../types'
import type { CustomShapeItem } from '../presets'
import { DEFAULT_STENCIL_GROUPS } from '../presets'
import type { ContextMenuStateData } from '../composables/useContextMenu'
import { defaultKoruCanvasConfig } from '../types'
import { createDefaultContextMenuState } from '../composables/useContextMenu'

// ==================== 配置接口 ====================

/** 多状态配置（消费方统一注册，全局共享） */
export interface MultiStateConfig {
  /** 设备候选列表（可选） */
  deviceOptions?: { value: string; label: string }[]
  /** 自定义状态标签预设（可选） */
  statePresets?: string[]
  /** 扩展数据，消费方可挂载任意自定义字段 */
  extra?: Record<string, any>
}

/** 绑定/测试配置（消费方统一注册，全局共享） */
export interface BindingConfig {
  /** 当前测点值映射（cellId::pointCode → value） */
  values: Record<string, string | number | null>
  /** 设置单个绑定值 */
  setValue: (
    cellId: string,
    device: string,
    dataPoint: string,
    value: string | number | null,
  ) => void
  /** 通知画布刷新（通常调用 store.propActiveTab 的某个 trigger） */
  tick: () => void
  /** 执行绑定测试，返回命中报告 */
  runTest: (val: string | number | null) => any[]
  /** 远程拉取测点数据（可选，预览模式轮询使用） */
  fetchData?: (points: string[]) => Promise<Record<string, any>>
  /** 轮询间隔（毫秒），0 表示不轮询 */
  pollInterval?: number
  /** 扩展数据 */
  extra?: Record<string, any>
}

/** 设备/属性面板配置 */
export interface DeviceConfig {
  /** 设备候选列表 */
  deviceOptions: { value: string; label: string }[]
  /** 设备目录数据 */
  deviceCatalog?: any
  /** 扩展数据 */
  extra?: Record<string, any>
}

/** UI 组件配置（工具栏、元件面板等外观配置） */
export interface ComponentConfig {
  /** Stencil 元件分组数据 */
  stencilGroups: import('../types').KoruStencilGroup[]
  /** SVG 自定义形状列表 */
  customShapes: CustomShapeItem[]
  /** 工具栏 Logo */
  toolbarLogo: string
  /** 工具栏名称 */
  toolbarName: string
  /** 全屏容器选择器 */
  fullscreenTarget: string
  /** Stencil 面板宽度 */
  stencilWidth: number
  /** 是否显示工具栏 */
  showToolbar: boolean
  /** 是否显示 Stencil */
  showStencil: boolean
  /** 是否显示属性面板 */
  showPropertyPanel: boolean
  /** 是否显示小地图 */
  showMinimap: boolean
  /** 是否启用保存命名对话框（默认 true，false 则跳过弹框直接保存） */
  saveEnabled: boolean
  /** 应用模板到画布前是否弹确认框（默认 true） */
  confirmTemplateApply: boolean
  /** 恢复本地保存数据前是否弹确认框（默认 true，false 则自动恢复） */
  confirmRestoreData: boolean
  /** 加载图纸后是否自动居中（默认 true，false 则保持图纸原始坐标位置） */
  centerContent: boolean
  /** 扩展数据 */
  extra?: Record<string, any>
}

/** 默认内置多状态配置 */
const DEFAULT_MULTI_STATE_CONFIG: MultiStateConfig = {
}

const DEFAULT_BINDING_CONFIG: BindingConfig = {
  values: {},
  setValue: () => {},
  tick: () => {},
  runTest: () => [],
  pollInterval: 0,
}

const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  deviceOptions: [],
}

const DEFAULT_COMPONENT_CONFIG: ComponentConfig = {
  stencilGroups: DEFAULT_STENCIL_GROUPS.map((g) => ({ ...g })),
  customShapes: [],
  toolbarLogo: '',
  toolbarName: '',
  fullscreenTarget: '',
  stencilWidth: 210,
  showToolbar: true,
  showStencil: true,
  showPropertyPanel: true,
  showMinimap: false,
  saveEnabled: true,
  confirmTemplateApply: true,
  confirmRestoreData: true,
  centerContent: true,
}

// ==================== Store 接口 ====================

export interface CanvasStore {
  /** KoruGraphEditor 实例 */
  instance: ReturnType<typeof ref<KoruGraphEditorInstance | null>>
  /** X6 Graph 实例引用 */
  x6GraphRef: ReturnType<typeof shallowRef<Graph | null>>
  /** Stencil 实例引用 */
  stencilRef: ReturnType<typeof ref<any>>
  /** 自定义形状列表 */
  customShapesRef: ReturnType<typeof ref<CustomShapeItem[]>>
  /** 加载组节点函数 */
  loadGroupNodesRef: ReturnType<
    typeof ref<((groupName: string, nodes: any[], opts?: { replace?: boolean }) => void) | null>
  >
  /** 拖拽中的模板数据（Stencil dnd start 时设置，node:added 时消费） */
  draggingTemplateRef: ReturnType<
    typeof ref<{ data: any; templateName: string; thumbnail?: string } | null>
  >
  /** 画布配置（由 KoruCanvasPropertyPanel 读取/修改，持久化时自动保存） */
  canvasConfig: ReturnType<typeof ref<KoruCanvasConfig>>
  /** 右键菜单状态 */
  ctxMenu: ReturnType<typeof ref<ContextMenuStateData>>
  /** 属性面板激活 tab（用于右键菜单"编辑属性/动效/事件/绑定"切换） */
  propActiveTab: ReturnType<typeof ref<string>>
  /** 当前选中的 cell（供属性面板使用） */
  selectedCell: ReturnType<typeof ref<any | null>>
  /** 多状态编辑弹窗：目标父节点 cell ID（string），用时通过 graph.getCellById 解引用 */
  multiStateEditTarget: ReturnType<typeof ref<string | null>>
  /** 多状态编辑弹窗：是否可见 */
  multiStateEditVisible: ReturnType<typeof ref<boolean>>
  /** 多状态全局配置 */
  multiStateConfig: MultiStateConfig
  /** 绑定/测试全局配置 */
  bindingConfig: BindingConfig
  /** 设备/属性面板全局配置 */
  deviceConfig: DeviceConfig
  /** UI 组件全局配置 */
  componentConfig: ComponentConfig
}

const store: CanvasStore = {
  instance: ref<KoruGraphEditorInstance | null>(null),
  x6GraphRef: shallowRef<Graph | null>(null),
  stencilRef: ref<any>(null),
  customShapesRef: ref<CustomShapeItem[]>([]),
  loadGroupNodesRef: ref<((groupName: string, nodes: any[]) => void) | null>(null),
  /** 拖拽中的模板数据（Stencil dnd start 时设置，node:added 时消费） */
  draggingTemplateRef: ref<{ data: any; templateName: string; thumbnail?: string } | null>(null),
  canvasConfig: ref<KoruCanvasConfig>(defaultKoruCanvasConfig()),
  ctxMenu: ref<ContextMenuStateData>(createDefaultContextMenuState()),
  propActiveTab: ref<string>('basic'),
  selectedCell: ref<any | null>(null),
  multiStateEditTarget: ref<string | null>(null),
  multiStateEditVisible: ref<boolean>(false),
  multiStateConfig: reactive<MultiStateConfig>({
    ...DEFAULT_MULTI_STATE_CONFIG,
  }),
  bindingConfig: reactive<BindingConfig>({
    ...DEFAULT_BINDING_CONFIG,
    values: { ...DEFAULT_BINDING_CONFIG.values },
  }),
  deviceConfig: reactive<DeviceConfig>({
    ...DEFAULT_DEVICE_CONFIG,
    deviceOptions: [...DEFAULT_DEVICE_CONFIG.deviceOptions],
  }),
  componentConfig: reactive<ComponentConfig>({
    ...DEFAULT_COMPONENT_CONFIG,
    stencilGroups: [...DEFAULT_COMPONENT_CONFIG.stencilGroups],
    customShapes: [...DEFAULT_COMPONENT_CONFIG.customShapes],
  }),
}

// ==================== Store 访问 ====================

/** 获取全局画布 store */
export function useCanvasStore(): CanvasStore {
  return store
}

// ==================== 多状态配置 ====================

/** 全局注册多状态配置 */
export function setMultiStateConfig(config: Partial<MultiStateConfig>): void {
  if (config.deviceOptions !== undefined) {
    store.multiStateConfig.deviceOptions = config.deviceOptions
  }
  if (config.statePresets !== undefined) {
    store.multiStateConfig.statePresets = [...config.statePresets]
  }
  if (config.extra) {
    store.multiStateConfig.extra = { ...config.extra }
  }
}

/** 重置多状态配置为默认值 */
export function resetMultiStateConfig(): void {
  store.multiStateConfig.deviceOptions = undefined
  store.multiStateConfig.statePresets = undefined
  store.multiStateConfig.extra = undefined
}

// ==================== 绑定/测试配置 ====================

/** 全局注册绑定/测试配置 */
export function setBindingConfig(config: Partial<BindingConfig>): void {
  if (config.values) {
    store.bindingConfig.values = { ...config.values }
  }
  if (config.setValue) {
    store.bindingConfig.setValue = config.setValue
  }
  if (config.tick) {
    store.bindingConfig.tick = config.tick
  }
  if (config.runTest) {
    store.bindingConfig.runTest = config.runTest
  }
  if (config.fetchData !== undefined) {
    store.bindingConfig.fetchData = config.fetchData
  }
  if (config.pollInterval !== undefined) {
    store.bindingConfig.pollInterval = config.pollInterval
  }
  if (config.extra) {
    store.bindingConfig.extra = { ...config.extra }
  }
}

/** 重置绑定配置为默认值 */
export function resetBindingConfig(): void {
  store.bindingConfig.values = {}
  store.bindingConfig.setValue = () => {}
  store.bindingConfig.tick = () => {}
  store.bindingConfig.runTest = () => []
  store.bindingConfig.fetchData = undefined
  store.bindingConfig.pollInterval = 0
  store.bindingConfig.extra = undefined
}

// ==================== 设备/属性配置 ====================

/** 全局注册设备/属性面板配置 */
export function setDeviceConfig(config: Partial<DeviceConfig>): void {
  if (config.deviceOptions) {
    store.deviceConfig.deviceOptions = [...config.deviceOptions]
  }
  if (config.deviceCatalog !== undefined) {
    store.deviceConfig.deviceCatalog = config.deviceCatalog
  }
  if (config.extra) {
    store.deviceConfig.extra = { ...config.extra }
  }
}

/** 重置设备配置为默认值 */
export function resetDeviceConfig(): void {
  store.deviceConfig.deviceOptions = []
  store.deviceConfig.deviceCatalog = undefined
  store.deviceConfig.extra = undefined
}

// ==================== UI 组件配置 ====================

/**
 * 合并 stencilGroups：以 name 为 key，消费方分组覆盖默认分组，新分组追加到末尾
 * 支持 replaceStencilGroups: true 完全替换
 */
function mergeStencilGroups(
  custom: import('../types').KoruStencilGroup[],
  replace: boolean = false,
): import('../types').KoruStencilGroup[] {
  if (replace) return [...custom]
  const defaults = DEFAULT_STENCIL_GROUPS.map((g) => ({ ...g }))
  const customNames = new Set(custom.map((g) => g.name))
  const merged: import('../types').KoruStencilGroup[] = []
  // 默认分组：被同名消费方分组覆盖，保持原顺序
  for (const def of defaults) {
    const override = custom.find((c) => c.name === def.name)
    merged.push(override ? { ...override } : { ...def })
  }
  // 消费方自定义的新分组（不在默认中）追加到末尾
  for (const c of custom) {
    if (!defaults.find((d) => d.name === c.name)) {
      merged.push({ ...c })
    }
  }
  return merged
}

/** 全局注册 UI 组件配置 */
export function setComponentConfig(
  config: Partial<ComponentConfig> & { replaceStencilGroups?: boolean },
): void {
  if (config.stencilGroups) {
    store.componentConfig.stencilGroups = mergeStencilGroups(
      config.stencilGroups,
      !!config.replaceStencilGroups,
    )
  }
  if (config.customShapes) {
    store.componentConfig.customShapes = [...config.customShapes]
  }
  if (config.toolbarLogo !== undefined) {
    store.componentConfig.toolbarLogo = config.toolbarLogo
  }
  if (config.toolbarName !== undefined) {
    store.componentConfig.toolbarName = config.toolbarName
  }
  if (config.fullscreenTarget !== undefined) {
    store.componentConfig.fullscreenTarget = config.fullscreenTarget
  }
  if (config.stencilWidth !== undefined) {
    store.componentConfig.stencilWidth = config.stencilWidth
  }
  if (config.showToolbar !== undefined) {
    store.componentConfig.showToolbar = config.showToolbar
  }
  if (config.showStencil !== undefined) {
    store.componentConfig.showStencil = config.showStencil
  }
  if (config.showPropertyPanel !== undefined) {
    store.componentConfig.showPropertyPanel = config.showPropertyPanel
  }
  if (config.showMinimap !== undefined) {
    store.componentConfig.showMinimap = config.showMinimap
  }
  if (config.saveEnabled !== undefined) {
    store.componentConfig.saveEnabled = config.saveEnabled
  }
  if (config.confirmTemplateApply !== undefined) {
    store.componentConfig.confirmTemplateApply = config.confirmTemplateApply
  }
  if (config.confirmRestoreData !== undefined) {
    store.componentConfig.confirmRestoreData = config.confirmRestoreData
  }
  if (config.centerContent !== undefined) {
    store.componentConfig.centerContent = config.centerContent
  }
  if (config.extra) {
    store.componentConfig.extra = { ...config.extra }
  }
}

/** 重置 UI 组件配置为默认值 */
export function resetComponentConfig(): void {
  store.componentConfig.stencilGroups = DEFAULT_STENCIL_GROUPS.map((g) => ({ ...g }))
  store.componentConfig.customShapes = []
  store.componentConfig.toolbarLogo = ''
  store.componentConfig.toolbarName = ''
  store.componentConfig.fullscreenTarget = ''
  store.componentConfig.stencilWidth = 210
  store.componentConfig.showToolbar = true
  store.componentConfig.showStencil = true
  store.componentConfig.showPropertyPanel = true
  store.componentConfig.showMinimap = false
  store.componentConfig.saveEnabled = true
  store.componentConfig.centerContent = true
  store.componentConfig.extra = undefined
}
