/**
 * 构建前脚本：把 src/assets/svg/*.svg 转成 TypeScript 文件
 * 输出: src/topology/presets/generated-electrical-symbols.ts
 *
 * 运行时机: pnpm build 时自动先跑
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(
  process.cwd()
)
const SVG_DIR = path.join(ROOT, 'src', 'assets', 'svg')
const OUTPUT = path.join(ROOT, 'src', 'topology', 'presets', 'generated-electrical-symbols.ts')

// 按文件名排序，保证每次构建 shapeName 编号一致
const files = fs
  .readdirSync(SVG_DIR)
  .filter((f) => f.endsWith('.svg'))
  .sort()

const items = files.map((file) => {
  const label = file.replace(/\.svg$/, '')
  const svg = fs.readFileSync(path.join(SVG_DIR, file), 'utf-8')
  // JSON.stringify 会处理转义，适合直接嵌入 TS 字符串字面量
  return `  { label: ${JSON.stringify(label)}, svg: ${JSON.stringify(svg)} },`
})

const header = `/**
 * 本文件由 scripts/gen-electrical-symbols.mjs 自动生成，请勿手动修改
 * 数据源: src/assets/svg/*.svg (${files.length} 个文件)
 */
import type { CustomShapeItem } from './registerSvgNodes'

/** 内置默认电气符号 SVG 列表 — 构建时自动生成 */
export const DEFAULT_ELECTRICAL_SYMBOLS: CustomShapeItem[] = [
${items.join('\n')}
]
`

fs.writeFileSync(OUTPUT, header, 'utf-8')
console.log(`[gen] ✅ 生成 ${files.length} 个电气符号 → ${path.relative(ROOT, OUTPUT)}`)
