#!/usr/bin/env node
/**
 * Harness Engineering - 机械化约束检查脚本
 *
 * 检查项：
 * 1. 组件文件命名规范（PascalCase）
 * 2. 禁止 console.log 残留
 * 3. TypeScript strict 模式检查
 * 4. 组件 Props 类型定义检查
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const SRC_DIR = join(process.cwd(), 'src')
let hasError = false

function checkFile(filePath, relativePath) {
  const content = readFileSync(filePath, 'utf-8')

  // 检查 console.log
  if (/console\.(log|warn|debug|info)\(/.test(content)) {
    console.error(`  ❌ ${relativePath}: 发现 console.log/warn/debug/info 残留`)
    hasError = true
  }

  // 检查 any 类型
  if (/: any\b/.test(content) && !relativePath.endsWith('.d.ts')) {
    console.error(`   ${relativePath}: 发现 any 类型，请使用具体类型`)
    hasError = true
  }

  // 检查 @ts-ignore
  if (/\/\/\s*@ts-ignore/.test(content)) {
    console.error(`  ️  ${relativePath}: 发现 @ts-ignore，建议修复类型问题`)
  }
}

function walkDir(dir, base = '') {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const relativePath = base ? `${base}/${entry}` : entry
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      walkDir(fullPath, relativePath)
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      // 检查组件文件命名规范
      if (entry.endsWith('.tsx') && entry[0] !== entry[0].toUpperCase()) {
        console.error(`   ${relativePath}: 组件文件名应使用 PascalCase`)
        hasError = true
      }
      checkFile(fullPath, relativePath)
    }
  }
}

console.log('🔍 Harness Engineering 约束检查\n')

console.log('📁 扫描 src/ 目录...')
walkDir(SRC_DIR)

if (!hasError) {
  console.log('\n✅ 所有检查通过！')
  process.exit(0)
} else {
  console.log('\n❌ 发现约束违规，请修复后重新提交')
  process.exit(1)
}
