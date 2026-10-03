# 可视化绑定模板（10种）

> **源码位置**：`src/topology/composables/bindingConfig.ts:L121-L178` + `src/topology/composables/bindingTypes.ts:L79-L92`
> **运行时引擎**：Jexl 表达式引擎（`useJexl`），根据 `templateType` 对测点值做不同的映射转换。

---

## 总览

10 种模板分 3 大类——**文本类**（输出文字）、**样式类**（输出颜色/动画控制）、**状态类**（输出多状态切换信号）。

| # | templateType | 分类 | 目标 targetProperty | 效果 |
|---|-------------|------|---------------------|------|
| 1 | `rawValue` | text | text / label / 任意 | 原样输出测点值 |
| 2 | `textFormat` | text | text / label | 加 prefix + suffix + decimals 控制 |
| 3 | `boolText` | text | text / label | 0/1 → 自定义 trueText/falseText |
| 4 | `statusTextMapping` | text | text / label | 任意 key → 任意 label |
| 5 | `colorMap` | style | fill / stroke | 等值匹配：`==` value → color |
| 6 | `threshold` | style | fill / stroke | 阈值判断：`>` / `<` / `between` → color |
| 7 | `threshold_color` | style | fill / stroke | 阈值 + 颜色组合（正常/告警双色） |
| 8 | `elementStateMapping` | state | 多状态节点 | value → 多状态切换信号 |
| 9 | `boolAnim` | style | nodeAnim | value==1 启动动画，==0 停止 |
| 10 | `statusAnimMapping` | style | nodeAnim | 不同 value → 不同动画模板 |

---

## 模板类型按 targetProperty 自动过滤

源码 `allowedTemplateTypesFor()`（`bindingConfig.ts:L186-L200`）会根据绑定的 targetProperty 限制可用模板：

| targetProperty | 只允许的模板 |
|----------------|-------------|
| `text` / `label` | rawValue, textFormat, boolText, statusTextMapping |
| `fill` / `stroke` | rawValue, colorMap, threshold, threshold_color |
| `nodeAnim` | rawValue, boolAnim, statusAnimMapping |
| 多状态节点 | **只有** elementStateMapping |
| 其他（未知） | 全部开放 |

这个白名单是为了防止"把颜色模板选成文本属性"这种错误组合。

---

## 1. rawValue — 原始值直接输出

**适用**：电流表、电压表等直接显示测点数值的场景。

**配置字段**（`JexlTemplateState`）：无额外字段，直接透传。

```jsonc
// BindingItem 示例
{
  "device": "ct",
  "dataPoint": "ia",
  "targetProperty": "text",
  "templateType": "rawValue"
}
```

**运行效果**：
```
fetchData 返回 { "ct.ia": 27.1 }
→ 节点 text 直接变成 "27.1"
```

---

## 2. textFormat — 数值文本格式化

**适用**：要加单位、控制小数位的数值显示。

**配置字段**：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `prefix` | string | 前缀字符串 | `"约 "` |
| `suffix` | string | 后缀字符串 | `" A"` |
| `decimals` | number | 保留小数位 | `1`（四舍五入） |

```jsonc
{
  "device": "ct",
  "dataPoint": "ia",
  "targetProperty": "text",
  "templateType": "textFormat",
  "textMapping": {
    "prefix": "",
    "suffix": " A",
    "decimals": 1,
    "defaultText": "—"
  }
}
```

**运行效果**：
```
27.1456 A → "27.1 A"
null     → "—"（defaultText 兜底）
```

---

## 3. boolText — 布尔文本转换

**适用**：分合位、开关量等 0/1 显示。

**配置字段**：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `trueText` | string | 值为 truthy（非 0、非空、非 null）时显示 | `"合"` |
| `falseText` | string | 值为 falsy 时显示 | `"分"` |
| `defaultText` | string | 值不存在时兜底 | `""` |

```jsonc
{
  "device": "breaker_1",
  "dataPoint": "state",
  "targetProperty": "text",
  "templateType": "boolText",
  "textMapping": {
    "trueText": "合",
    "falseText": "分",
    "defaultText": "—"
  }
}
```

**运行效果**：
```
1 / "closed" / true  → "合"
0 / "open"  / false → "分"
null               → "—"
```

> truthy 判断：`!!value === true`，所以字符串 `"open"` 是 truthy——需要注意。

---

## 4. statusTextMapping — 状态文本映射

**适用**：任意离散值 → 任意 label，灵活度最高。

**配置字段**（`TextMappingConfig`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mappingItems` | `JexlMappingItem[]` | 数组，每项 `{ sourceValue, showText }` |
| `defaultText` | string | 没有匹配的 sourceValue 时兜底 |

```jsonc
{
  "device": "main_tr",
  "dataPoint": "run_status",
  "targetProperty": "text",
  "templateType": "statusTextMapping",
  "textMapping": {
    "mappingItems": [
      { "sourceValue": "running",   "showText": "运行中" },
      { "sourceValue": "stopped",   "showText": "已停机" },
      { "sourceValue": "fault",     "showText": "故障" },
      { "sourceValue": "maintenance", "showText": "检修" }
    ],
    "defaultText": "未知"
  }
}
```

**运行效果**：
```
"running"     → "运行中"
"fault"       → "故障"
"initializing" → "未知"（没配）
```

**注意**：`sourceValue` 必须是**字符串完全匹配**（`===`），数字 `1` 不会匹配字符串 `"1"`。

---

## 5. colorMap — 状态颜色映射

**适用**：开关量/离散状态对应不同填充色。

**配置字段**（`StyleMappingConfig`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mappingItems` | `{ sourceValue, color }[]` | 等值匹配表 |
| `defaultColor` | string | 没有匹配时的颜色 |

```jsonc
{
  "device": "breaker_1",
  "dataPoint": "state",
  "targetProperty": "fill",
  "templateType": "colorMap",
  "styleMapping": {
    "mappingItems": [
      { "sourceValue": "closed", "color": "#10b981" },  // 合 = 绿
      { "sourceValue": "open",   "color": "#9ca3af" },  // 分 = 灰
      { "sourceValue": "fault",  "color": "#ef4444" }   // 故障 = 红
    ],
    "defaultColor": "#d1d5db"
  }
}
```

**运行效果**：
```
"closed" → fill 变成 #10b981（SVG 节点填充）
"open"   → fill 变成 #9ca3af
```

> 匹配也是严格 `===`，数字 vs 字符串要注意。

---

## 6. threshold — 阈值颜色（连续量）⭐

**适用**：电流、电压、温度等连续量，根据范围显示不同颜色。**最常用的模板**。

**配置字段**（`ThresholdRule[]`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `operator` | string | `gt` / `lt` / `gte` / `lte` / `between` |
| `value` | number \| null | 单边阈值 |
| `min` / `max` | number \| null | between 区间阈值 |
| `color` | string | 命中时用的颜色 |
| `normalColor` | string | 所有规则都不命中时的颜色 |

```jsonc
{
  "device": "ct",
  "dataPoint": "ia",
  "targetProperty": "fill",
  "templateType": "threshold",
  "styleMapping": {
    "rules": [
      { "operator": "gt",     "value": 25, "color": "#ef4444" },   // > 25A 红
      { "operator": "between","min": 15, "max": 25, "color": "#f59e0b" }, // 15~25A 黄
      { "operator": "lt",     "value": 15, "color": "#22c55e" }    // < 15A 绿
    ],
    "normalColor": "#9ca3af"
  }
}
```

**运行效果**：
```
27A  → 命中 gt 25 → fill = #ef4444（红）
18A  → 命中 between 15-25 → fill = #f59e0b（黄）
12A  → 命中 lt 15 → fill = #22c55e（绿）
```

**规则匹配顺序**：数组从上到下，**第一个命中即返回**（短路求值）。写规则时注意顺序——越具体的越靠前。

**操作符实现**（`useBindingExecutor.ts:L84-L118`）：

| operator | 符号 | 判断 |
|----------|------|------|
| `gt` | `>` | `current > value` |
| `lt` | `<` | `current < value` |
| `gte` | `>=` | `current >= value` |
| `lte` | `<=` | `current <= value` |
| `between` | `[min, max]` | `current >= min && current <= max` |

**null/undefined 处理**：测点值为 null 时跳过所有规则，用 `normalColor` 兜底。

---

## 7. threshold_color — 阈值+颜色双色版

跟 `threshold` 逻辑一样，但额外有 `alarmColor` + `thresholdValue` + `thresholdOp` 三个字段。用于只有"正常/告警"两种颜色的简单场景。

```jsonc
{
  "templateType": "threshold_color",
  "styleMapping": {
    "thresholdValue": 25,
    "thresholdOp": "gt",
    "normalColor": "#22c55e",
    "alarmColor": "#ef4444"
  }
}
```

**运行效果**：
```
current > 25 → alarmColor（红）
current <= 25 → normalColor（绿）
```

> 这是 threshold 的简化版。如果只需要越限/正常两态，用它更简洁；多区间还是用 threshold。

---

## 8. elementStateMapping — 多状态元件映射

**适用**：多状态节点（比如断路器的"合闸 SVG" / "分闸 SVG" / "故障 SVG"）。

**这个模板只在 targetProperty 指向多状态节点时自动出现**（见 `allowedTemplateTypesFor`）。

**配置字段**：

```jsonc
{
  "device": "breaker_1",
  "dataPoint": "state",
  "targetProperty": "elementState",
  "templateType": "elementStateMapping",
  "textMapping": {
    "mappingItems": [
      { "sourceValue": "closed",    "showText": "合闸" },
      { "sourceValue": "open",      "showText": "分闸" },
      { "sourceValue": "fault",     "showText": "故障" },
      { "sourceValue": "maintenance", "showText": "检修" }
    ],
    "defaultText": "—"
  }
}
```

**运行效果**：
```
"closed" → 触发 useMultiState.switchTo("closed")
          → 子图元 A/B 显示，C/D 隐藏（合闸 SVG）
          → 子图元 E/F 隐藏（分闸 SVG）
"open"   → 反过来，显示分闸 SVG
```

---

## 9. boolAnim — 布尔-动画映射

**适用**：测点为 1 启动动画、为 0 停止。**targetProperty 必须是 `nodeAnim`**。

```jsonc
{
  "device": "breaker_1",
  "dataPoint": "state",
  "targetProperty": "nodeAnim",
  "templateType": "boolAnim",
  "textMapping": {
    "mappingItems": [
      { "sourceValue": "1", "showText": "glowBreath" },
      { "sourceValue": "0", "showText": "none" }
    ],
    "defaultText": "none"
  }
}
```

**运行效果**：
```
state == 1 → startAnimation("glowBreath")  红色外发光呼吸
state == 0 → stopAnimation()
```

动画模板 id 列表见 [animation.md](./animation.md)。

---

## 10. statusAnimMapping — 状态-动画映射

**适用**：不同状态用不同动画。**targetProperty 必须是 `nodeAnim`**。

```jsonc
{
  "device": "main_tr",
  "dataPoint": "run_status",
  "targetProperty": "nodeAnim",
  "templateType": "statusAnimMapping",
  "textMapping": {
    "mappingItems": [
      { "sourceValue": "running",   "showText": "opacityBreath" },
      { "sourceValue": "fault",     "showText": "glowBreath" },
      { "sourceValue": "stopped",   "showText": "none" }
    ],
    "defaultText": "none"
  }
}
```

**运行效果**：
```
"running" → 透明度呼吸（loop 2s）
"fault"   → 外发光呼吸（loop 红）
"stopped" → 停止动画
```

---

## BindingItem 完整结构参考

```ts
interface BindingItem {
  id: string                    // 绑定唯一 id
  device: string                // 设备 key
  deviceLabel: string           // 设备显示名
  dataPoint: string             // 测点 key
  targetProperty: string        // 目标属性（text / fill / stroke / nodeAnim / elementState）
  mappingRules: string          // 映射规则（JEXL 表达式字符串，内部序列化）
  refreshInterval: number       // 刷新间隔（毫秒）
  readOnly: boolean             // 是否只读
  triggers: TriggerItem[]       // 触发器数组（可以多个）
  templateType?: JexlTemplateType
  textMapping?: TextMappingConfig
  styleMapping?: StyleMappingConfig
}
```

---

## 配置入口

编辑器里怎么配这些模板：

```
选中节点
  → 右侧属性面板
    → 「绑定」Tab
      → 添加绑定项
        → 选 device + dataPoint
        → 选 targetProperty（text / fill / stroke / nodeAnim）
        → templateType 下拉会自动过滤，显示允许的模板
        → 选完后显示对应字段表单（prefix/suffix/decimals 等）
        → 保存
```

源码实现：`KoruBindingItemForm.vue` + `KoruBindingPanel.vue`。

---

## 相关文档

- 触发器动作（12 种）：[trigger-actions.md](./trigger-actions.md)
- 动画模板：[animation.md](./animation.md)
- 绑定注册表：[binding-registry.md](./binding-registry.md)
- 绑定执行引擎源码：`useBindingExecutor.ts`
- JEXL 表达式引擎：[`useJexl()`](/src/topology/composables/useJexl.ts)
