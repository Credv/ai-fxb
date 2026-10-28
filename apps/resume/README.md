# 陈鸿 - 前端开发工程师简历

> React + TypeScript + Vite 构建的个人简历网站，线上地址 https://3ecat.me/

本目录是 `ai-fxb` 单仓库（npm workspaces）里的一个应用，与「AI 窗口」控制台（`../console`）共用构建与部署：根路由发布简历，`/ai-fxb/` 发布控制台。安装依赖与构建都在仓库根目录执行。

## 技术栈

- **框架**：React 18 + TypeScript
- **构建**：Vite 5.4
- **工程化**：Harness Engineering（结构化知识 + 机械化约束 + 自动化反馈）
- **代码规范**：ESLint 9 + TypeScript strict 模式

## 快速开始

```bash
# 在仓库根目录安装依赖（Node 20+）
npm install

# 只启动简历（http://localhost:3000/）
npm run dev:resume

# 只构建简历
npm run build --workspace resume-react

# 全量构建并拼装发布目录 dist/
npm run build

# ESLint / Harness 约束检查（在本目录执行）
npm run lint
npm run harness:check
```

## 项目结构

```
src/
├── main.tsx              # React 入口
├── App.tsx               # 根组件（页面布局 + 全部简历数据）
├── index.css             # 全局样式（CSS Variables + 响应式 + 打印）
└── components/
    ├── Sidebar.tsx        # 侧边栏（头像/联系方式/技能/教育）
    └── ProjectCard.tsx    # 项目卡片（含在线地址与代码仓库链接）
```

## Harness Engineering

本项目已初始化 Harness Engineering 范式：

- **AGENTS.md**：AI Agent 入口导航，提供项目结构化知识
- **机械化约束**：`scripts/harness-check.js` 自动检查代码规范
- **Qoder 规则**：`.qoder/rules/` 定义 AI 辅助开发规则

## License

MIT
