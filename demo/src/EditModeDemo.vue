<template>
  <div class="demo-page">
    <!-- 独立调用示例：绑定注册表相关 API -->
    <div class="demo-actions">
      <button class="demo-btn" @click="handleGetBindingRegistry">1. 获取绑定注册表</button>
      <button class="demo-btn" @click="handleExtractKeys">2. 提取订阅 Keys</button>
      <button class="demo-btn" @click="handleBuildFetchData">3. 构建 fetchData</button>
      <button class="demo-btn" @click="handleTestFlatten">4. 测试数据展平</button>
    </div>
    <div class="demo-canvas-wrapper">
      <koru-graph-editor
        ref="canvasRef"
        v-model:graph="graphData"
        mode="edit"
        @save="handleSave"
        @preview="handlePreview"
        @template="onTemplate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  KoruGraphEditor,
  registerSvgNode,
  mountSvgDefs,
  createSvgPreviewNode,
  useBindingRegistry,
  extractBindingKeys,
  flattenBindingData,
  buildFetchData,
  useCanvasStore,
  setMultiStateConfig,
  setBindingConfig,
  setDeviceConfig,
  setComponentConfig,
} from '@mollu/koru/topology'
import type { KoruGraphData, CustomShapeItem, GroupedBindingDataItem } from '@mollu/koru/topology'

const canvasRef = ref<InstanceType<typeof KoruGraphEditor>>()

// ============ 画布 Store ============
const store = useCanvasStore()

// 空画布启动（持久化开启时，会自动从 IndexedDB 恢复）
const graphData = ref<KoruGraphData>({ nodes: [], edges: [] })

// ============ 多状态配置（全局注册，一次设置、全组件生效） ============
// 使用位置：
//   - KoruMultiStateEditorModal（组合为状态弹窗）: pointOptions 作为"状态点"下拉选项
//   - KoruMultiStateEditorModal: deviceOptions 作为"设备"下拉选项
//   - KoruMultiStateEditorModal: statePresets 作为状态名称快捷预设
//   - KoruGraphEditor（via multiStatePointOptions prop 回退）: 透传给多状态编辑器
setMultiStateConfig({
  // 测点/数据点候选列表 — 多状态编辑器中"状态点"字段的下拉选项
  pointOptions: [
    { value: 'breaker_state', label: '断路器状态' },
    { value: 'switch_state', label: '刀闸状态' },
    { value: 'fault_state', label: '故障状态' },
    { value: 'maintain_state', label: '检修状态' },
    { value: 'position', label: '位置/档位' },
    { value: 'temperature', label: '温度' },
    { value: 'pressure', label: '压力' },
  ],
  // 设备候选列表 — 多状态编辑器中"设备"字段的下拉选项
  deviceOptions: [
    { value: 'main_transformer', label: '主变压器' },
    { value: 'breaker_1', label: '1#断路器' },
    { value: 'breaker_2', label: '2#断路器' },
    { value: 'disconnector', label: '隔离开关' },
  ],
  // 状态名称预设 — 多状态编辑器中新增状态时的快捷名称
  statePresets: ['合闸', '分闸', '故障', '检修', '备用'],
})

// ============ 绑定/测试全局配置（消费方统一注册，一次设置、全组件生效） ============
// 使用位置：
//   - KoruTestToolsPanel（测试工具面板）: values 显示绑定值、setValue 写入值、tick 触发刷新、runTest 运行测试
//   - KoruPreview（预览组件）: fetchData 拉取实时数据、pollInterval 定时轮询、values 共享绑定值
setBindingConfig({
  // 绑定值缓存（key = "cellId:device:dataPoint"），测试面板 & 预览组件共享
  values: {},
  // 写入绑定值 — 测试面板"写入值"按钮的回调，消费方对接实时数据库
  setValue: (cellId, device, dataPoint, value) => {
    const key = `${cellId}:${device}:${dataPoint}`
    console.log(`[Demo] setBindingValue ${key} =`, value)
    // 这里可以接入实际的实时数据库/测点值管理系统
  },
  // 手动触发画布绑定刷新 — 测试面板"刷新"按钮回调
  tick: () => {
    console.log('[Demo] binding tick - 触发画布绑定刷新')
    // 通过 store.propActiveTab 或其他机制通知画布刷新
    const s = useCanvasStore()
    s.propActiveTab.value = Date.now() + ''
  },
  // 绑定测试 — 测试面板"运行测试"按钮回调，返回命中的绑定报告
  runTest: (val) => {
    console.log('[Demo] runBindingTest, value =', val)
    // 实际项目中这里返回命中的绑定报告
    return []
  },
  // 预览模式数据源 — 预览组件按注册表拉取实时数据的函数
  fetchData: async () => {
    console.log('[Demo] fetchData - 拉取测点数据')
    return {}
  },
  // 预览模式轮询间隔（毫秒），0 表示不轮询，由消费方按场景设置
  pollInterval: 0,
})

// ============ 设备/属性面板全局配置 ============
// 使用位置：
//   - KoruPropertyPanel（右侧属性面板）: deviceOptions 绑定/触发器中"设备"下拉
//   - KoruPropertyPanel: deviceCatalog 绑定面板的设备树数据（设备 → 测点层级）
setDeviceConfig({
  // 绑定-触发器-下发控制指令（下拉数据）
  deviceOptions: [
    { value: 'main_transformer', label: '主变压器' },
    { value: 'breaker_1', label: '1#断路器' },
    { value: 'breaker_2', label: '2#断路器' },
    { value: 'disconnector', label: '隔离开关' },
  ],
  // 绑定-设备树数据（在绑定面板中使用）
  deviceCatalog: [
    {
      value: 'main_transformer',
      label: '主变压器',
      points: [
        { value: 'temperature', label: '温度' },
        { value: 'oil_pressure', label: '油压' },
        { value: 'winding_temperature', label: '绕组温度' },
      ],
    },
    {
      value: 'breaker_1',
      label: '1#断路器',
      points: [
        { value: 'breaker_state', label: '断路器状态' },
        { value: 'current', label: '电流' },
        { value: 'voltage', label: '电压' },
      ],
    },
    {
      value: 'breaker_2',
      label: '2#断路器',
      points: [
        { value: 'breaker_state', label: '断路器状态' },
        { value: 'current', label: '电流' },
        { value: 'voltage', label: '电压' },
      ],
    },
    {
      value: 'disconnector',
      label: '隔离开关',
      points: [{ value: 'switch_state', label: '刀闸状态' }],
    },
  ],
})

// ============ UI 组件配置（全局注册，一次设置、全组件生效） ============
// 使用位置：
//   - KoruToolbar: toolbarName 显示标题、toolbarLogo 显示 Logo、fullscreenTarget 全屏根节点
//   - KoruStencil: stencilGroups 分组数据、customShapes SVG 自定义节点、stencilWidth 面板宽度
//   - KoruGraphEditor: showToolbar/showStencil/showPropertyPanel/showMinimap 控制子组件显隐
setComponentConfig({
  // 左侧 Stencil 面板宽度
  stencilWidth: 210,
  // 是否显示工具栏
  showToolbar: true,
  // 库名称
  toolbarName: 'Mollu-Koru',
  // 工具栏 Logo
  toolbarLogo: '/logo.png',
  // 全屏模式的 CSS 选择器（工具栏全屏按钮作用的根元素）
  fullscreenTarget: '.demo-canvas-wrapper',
  // Stencil 分组数据 — 左侧面板的分组 + 节点定义
  // stencilGroups:[],
  // SVG 自定义节点列表 — 由 SVG 注册完成后动态注入
  customShapes: [],
})

// 供 KoruStencil.getDropNode 查找 svg-node-* 的落点尺寸
const customShapes = ref<CustomShapeItem[]>([])

// ============ 初始化（SVG 注册 + 持久化恢复由 KoruGraphEditor 内部处理） ============

// ============ 工具栏回调 ============
function handleSave(data: { diagramData: any; bindingRegistry: any[] }) {
  console.log('[Demo] 保存画布数据:', data.diagramData)
  console.log('[Demo] 绑定注册表:', data.bindingRegistry)
  // TODO: 发送到后端 — data.diagramData 含 { cells, canvas }, data.bindingRegistry 为绑定注册表
}

function handlePreview(data: { diagramData: any; bindingRegistry: any[] }) {
  console.log('[Demo] 预览画布:', data.diagramData)
  console.log('[Demo] 绑定注册表:', data.bindingRegistry)
  // TODO: 打开预览弹窗，将 data 传给预览组件
}

/** 统一模板事件：组件内部已完成 IndexedDB 操作，这里负责后端同步 */
function onTemplate(payload: { action: 'save' | 'delete' | 'clear'; template?: any; templates?: any[] }) {
  switch (payload.action) {
    case 'save':
      console.log('[Demo] 模板已保存:', payload.template?.name)
      break
    case 'delete':
      console.log('[Demo] 模板已删除:', payload.template?.name)
      break
    case 'clear':
      console.log('[Demo] 模板已清空:', payload.templates?.length, '个')
      break
  }
}

// ============ 独立调用示例：绑定注册表 API ============

// 通过 useBindingRegistry composable 获取
const { getBindingRegistry } = useBindingRegistry(
  () => canvasRef.value?.instance?.getGraph?.() || null,
)

/**
 * 示例 1：获取绑定注册表
 * 演示三种获取方式
 */
function handleGetBindingRegistry() {
  console.log('===== 示例 1：获取绑定注册表 =====')

  // 方式 A：通过 composable
  const fromComposable = getBindingRegistry()
  console.log('方式 A (composable):', fromComposable)

  // 方式 B：通过组件 ref
  const fromRef = canvasRef.value?.getBindingRegistry() || []
  console.log('方式 B (组件 ref):', fromRef)

  // 方式 C：通过 toolbar save/preview 回调（已在 handleSave 中演示）

  // 统计信息
  const totalBindings = fromRef.reduce((s, i) => s + i.bindings.length, 0)
  const hasTriggers = fromRef.filter((i) => i.bindings.some((b) => b.triggerCount > 0))
  console.log(
    `统计: ${fromRef.length} 个图元, ${totalBindings} 条绑定, ${hasTriggers.length} 个有触发器`,
  )

  console.log(`绑定注册表: ${fromRef.length} 个图元, ${totalBindings} 条绑定`)
}

/**
 * 示例 2：提取订阅 Keys
 * 将注册表转换为 "cellId:device:dataPoint" 格式的 key 列表
 * 用于：发送给后端作为订阅清单 / 校验数据源返回值完整性
 */
function handleExtractKeys() {
  console.log('===== 示例 2：提取订阅 Keys =====')
  const registry = canvasRef.value?.getBindingRegistry() || []
  const keys = extractBindingKeys(registry)
  console.log('订阅 Keys:', keys)
  console.log(`共 ${keys.length} 个订阅项`)
  if (keys.length > 0) {
    console.log(
      `订阅 Keys (共 ${keys.length} 个):\n${keys.slice(0, 5).join('\n')}${keys.length > 5 ? '\n...' : ''}`,
    )
  } else {
    console.log('暂无绑定配置，请先在画布上添加图元并配置绑定')
  }
}

/**
 * 示例 3：构建 fetchData 函数
 * 基于绑定注册表 + 数据源函数，构建 KoruPreview 可用的 fetchData
 * 支持扁平格式和分组格式两种输入
 */
function handleBuildFetchData() {
  console.log('===== 示例 3：构建 fetchData =====')
  const registry = canvasRef.value?.getBindingRegistry() || []
  if (registry.length === 0) {
    alert('暂无绑定配置，请先在画布上添加图元并配置绑定')
    return
  }

  // 模拟：从后端获取实时数据的数据源函数
  // 实际项目中，这里应该是调用后端 API / WS 的函数
  const mockDataSource = async () => {
    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 100))
    // 用 registry 生成模拟扁平数据
    const result: Record<string, number | string | null> = {}
    const now = Date.now()
    registry.forEach((item) => {
      item.bindings.forEach((b) => {
        const key = `${item.cellId}:${b.device}:${b.dataPoint}`
        if (b.targetProperty === 'fill' || b.targetProperty === 'stroke') {
          const colors = ['#165dff', '#00b42a', '#ff7d00', '#f53f3f']
          result[key] = colors[((now / 1000) % 4) | 0]
        } else {
          result[key] = Math.round(50 + Math.random() * 50)
        }
      })
    })
    console.log('数据源返回:', result)
    return result
  }

  // 方式 A：扁平格式（默认）
  const fetchDataFlat = buildFetchData(registry, mockDataSource)
  fetchDataFlat().then((data) => {
    console.log('fetchData (扁平格式) 执行结果:', data)
  })

  // 方式 B：分组格式（从后端返回分组数据）
  const groupedDataSource = async () => {
    await new Promise((r) => setTimeout(r, 100))
    const result: GroupedBindingDataItem[] = registry.map((item) => ({
      cellId: item.cellId,
      data: item.bindings.map((b) => ({
        device: b.device,
        dataPoint: b.dataPoint,
        value: Math.round(Math.random() * 100),
      })),
    }))
    console.log('分组数据源返回:', result)
    return result
  }

  const fetchDataGrouped = buildFetchData(registry, groupedDataSource, { inputFormat: 'grouped' })
  fetchDataGrouped().then((data) => {
    console.log('fetchData (分组格式自动展平) 执行结果:', data)
    alert(`构建的 fetchData 函数执行成功，返回 ${Object.keys(data).length} 个测点值`)
  })
}

/**
 * 示例 4：测试数据展平
 * 演示 flattenBindingData 的使用
 * 用于后端返回分组格式数据时，前端自动转换
 */
function handleTestFlatten() {
  console.log('===== 示例 4：测试数据展平 =====')

  // 模拟后端返回的分组格式数据
  const grouped: GroupedBindingDataItem[] = [
    {
      cellId: 'node-1',
      data: [
        { device: 'WS-001', dataPoint: '温度', value: 23.5 },
        { device: 'WS-001', dataPoint: '状态', value: 'running' },
        { device: 'WS-002', dataPoint: '电流', value: 12.3 },
      ],
    },
    {
      cellId: 'node-2',
      data: [{ device: 'WS-003', dataPoint: '压力', value: 0.85 }],
    },
  ]

  console.log('输入（分组格式）:', grouped)
  const flat = flattenBindingData(grouped)
  console.log('输出（扁平格式）:', flat)

  // 验证
  const expectedKeys = [
    'node-1:WS-001:温度',
    'node-1:WS-001:状态',
    'node-1:WS-002:电流',
    'node-2:WS-003:压力',
  ]
  const allMatch = expectedKeys.every((k) => k in flat)
  console.log(`验证: ${allMatch ? '✅ 所有 key 正确' : '❌ key 缺失'}`)

  alert(`展平结果:\n${JSON.stringify(flat, null, 2)}\n\n验证: ${allMatch ? '✅ 通过' : '❌ 失败'}`)
}

// ============ 从 assets/svg 加载电气符号 SVG ============
const svgModules = import.meta.glob('@/assets/svg/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// 提取文件名和内容的映射
const svgMap: Record<string, string> = {}
Object.entries(svgModules).forEach(([path, content]) => {
  const match = path.match(/\/([^/]+)\.svg$/)
  if (match) {
    svgMap[match[1]] = content as string
  }
})

// 构建 CustomShapeItem 列表
const sampleSvgShapes: CustomShapeItem[] = Object.entries(svgMap).map(([fileName, svgContent]) => ({
  label: fileName,
  svg: svgContent,
}))

// 注册 SVG 自定义节点 + 加载预览节点到内置 electrical 分组
onMounted(() => {
  const tryRegister = setInterval(() => {
    const graph = canvasRef.value?.instance?.getGraph?.()
    if (graph) {
      sampleSvgShapes.forEach((item, index) => registerSvgNode(item, index))
      const allDefs = sampleSvgShapes.map(s => s.defs).filter(Boolean).join('\n')
      if (allDefs) mountSvgDefs(graph, allDefs)
      clearInterval(tryRegister)
      // 更新 customShapes（此时 shapeName 已设置）
      customShapes.value = [...sampleSvgShapes]
      // 同步到全局 componentConfig
      setComponentConfig({ customShapes: [...sampleSvgShapes] })
      // 加载 SVG 预览节点到内置 electrical 分组
      const svgNodes = sampleSvgShapes.map((item) => createSvgPreviewNode(graph, item))
      store.loadGroupNodesRef.value?.('electrical', svgNodes)
    }
  }, 50)
})
</script>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.demo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  gap: 12px;
  flex-wrap: wrap;
}
.demo-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #666;
}
.demo-badge {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}
.demo-badge--edit {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}
.demo-badge--preview {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}
.demo-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.demo-btn:hover {
  color: #1890ff;
  border-color: #1890ff;
}
.demo-btn--danger:hover {
  color: #ff4d4f;
  border-color: #ff4d4f;
}
.demo-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.demo-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
}

.demo-actions .demo-btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #d9d9d9;
  color: #333;
  cursor: pointer;
}

.demo-actions .demo-btn:hover {
  color: #1890ff;
  border-color: #1890ff;
}
</style>
