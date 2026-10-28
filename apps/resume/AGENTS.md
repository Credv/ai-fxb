# AGENTS.md — Resume React 项目 AI 入口导航

> 本文件为 AI Agent 提供项目结构化知识，帮助快速理解项目架构与开发规范。

## 项目概述

- **项目名称**：resume-react
- **描述**：陈鸿 - 前端开发工程师个人简历网站
- **技术栈**：React 18 + TypeScript + Vite + ECharts
- **构建工具**：Vite 5.4
- **样式方案**：全局 CSS（CSS Variables + 响应式媒体查询）

## 项目结构

```
resume-react/
├── index.html              # Vite 入口 HTML
├── package.json            # 项目依赖与脚本
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 构建配置
├── public/
│   └── avatar.png          # 静态资源（证件照）
── src/
│   ├── main.tsx            # React 入口
│   ├── App.tsx             # 根组件（页面布局 + 数据）
│   ├── index.css           # 全局样式（含响应式）
│   ├── vite-env.d.ts       # Vite 类型声明
│   ── components/
│       ├── Sidebar.tsx      # 侧边栏（头像/联系方式/技能/教育）
│       ├── ProjectCard.tsx  # 项目卡片（可复用）
│       └── Dashboard.tsx    # ECharts 数据可视化看板
├── scripts/
│   └── harness-check.js    # Harness 约束检查脚本
└── .qoder/
    └── rules/              # Qoder AI 规则配置
```

## 分层架构

| 层级 | 目录/文件 | 说明 |
|------|----------|------|
| Layer 4 - 页面 | `src/App.tsx` | 根组件，组合所有子组件 |
| Layer 3 - 组件 | `src/components/` | 可复用 UI 组件 |
| Layer 2 - 样式 | `src/index.css` | 全局样式 + 响应式 |
| Layer 1 - 配置 | `vite.config.ts`, `tsconfig.json` | 构建与类型配置 |

## 组件契约

### Sidebar
- **职责**：展示个人信息、联系方式、技能清单、教育背景
- **Props**：无（静态数据内嵌）
- **依赖**：`/avatar.png` 静态资源

### ProjectCard
- **职责**：展示单个项目的完整信息
- **Props**：
  ```typescript
  interface ProjectCardProps {
    title: string
    role: string
    desc: string
    sections: { title: string; items: string[] }[]
    valueTags?: string[]
    githubUrl?: string
  }
  ```

### Dashboard
- **职责**：ECharts 数据可视化看板（技能雷达/项目分布/工作Timeline）
- **Props**：无
- **依赖**：`echarts` npm 包
- **注意**：使用 `useRef` + `useEffect` 初始化图表，组件卸载时 `dispose`

## 开发规范

1. **组件命名**：PascalCase，文件名与组件名一致
2. **样式方案**：全局 CSS Variables，不使用 CSS Modules
3. **响应式断点**：1024px（平板）、768px（手机横屏）、480px（手机竖屏）
4. **TypeScript**：strict 模式，禁止 `any`
5. **ESLint**：遵循 `eslint.config.js` 规则

## 常用命令

```bash
npm run dev          # 启动开发服务器（port 3000）
npm run build        # 生产构建
npm run preview      # 预览生产构建
npm run lint         # ESLint 检查
npm run harness:check  # Harness 约束检查
```
