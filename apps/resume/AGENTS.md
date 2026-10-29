# AGENTS.md — Resume React 项目 AI 入口导航

> 本文件为 AI Agent 提供项目结构化知识，帮助快速理解项目架构与开发规范。

## 项目概述

- **项目名称**：resume-react（现在是 3ecat.me 的根路由，AI 窗口在 `/ai-fxb/`）
- **描述**：陈鸿 - 前端开发工程师个人简历网站
- **技术栈**：React 18 + TypeScript + Vite
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
│       └── ProjectCard.tsx  # 项目卡片（可复用，含在线演示/源码链接）
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
- **依赖**：头像用的是远程图床 URL（`img.alicdn.com`）；`public/avatar.png` 目前**没有被引用**，图床失效时可用它兜底

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
    liveUrl?: string
  }
  ```
- **注意**：GitHub 入口一律走右上角的 `.gh-badge` 角标（2026-10-29 他要求 AI 窗口与 Pre-Release 保持同一种样式）；`liveUrl` 存在时描述下方的 `.project-links` 只渲染「在线地址」一个胶囊，不再重复放「代码仓库」，避免同一仓库两个入口。`items` 里的字符串按 HTML 注入（`<strong>` 加粗小标题），因此**不能把外部不可信文本放进来**。

## 简历内容规则（改文案前先读这里）

- **数据位置**：全部在 `src/App.tsx` 顶部的 `projects` 与 `workExperience` 常量里，组件只负责渲染；改内容不动组件。
- **卡片顺序**：①《别点那只》微信小游戏 ② AI 窗口（唯一能直接打开验证的线上作品，只有它有 `liveUrl`）③ 千牛平台 · 金融阵地 ④ Harness Engineering ⑤ 招财猫 ⑥ 催收平台 ⑦ Pre-Release Check。
- **一条 bullet 只留两种东西**：能落到数字或范围的结论，或者能看出取舍的决策。工具名复读（"统一 ESLint 规则""集成评分系统提升体验"这类任何 5 年前端都能签的字）一律删。
- **标题两级都是类别名词，不是描述**（他 2026-10-29 的原话："切记不要把描述当作标题"）。`sections[].title` 是大类（包体与性能），`<strong>` 是小类（主包体积优化）。不能出现判断句（"该降的降，该藏得藏"）、结论（"不引入 Cocos / Laya 的原因是…"）、度量对（"主包 7.7 MB → 1.29 MB"）当标题——这些一律写进标题下面那句正文里。判断句与数字是 body 的内容，标题只负责"这条属于哪一类"。
- **难点写到「约束 + 我决定了什么」就停**，实现细节留给面试官开口。例外：包体 / 性能这类 bullet 他要求"写点高科技的"，可以把机制写出来（预乘 alpha → LANCZOS → 解预乘、全透明处 RGB 归零、离屏画布按设备像素缓存），但每条仍要有「为什么这么做」和前后数字，不是堆术语。
- **"踩过的坑"这类机制细节不放在本仓库**：简历卡片只留结论，完整口述提纲存到 jl 仓库（[Credv/resume-react](https://github.com/Credv/resume-react)，本地 `D:\resume-react`）的 `面试知识点.md`。删掉的细节必须在那边按代码路径指认出处，别只留一句结论。
- **数字必须可核**：只允许来自代码、构建产物或实测。例：首屏 91 KB gzip = 控制台 index 39.70 + react 45.21 + css 6.48；three.js 172 KB gzip 走空闲队列；每日 6 次 flash 调用产出 4 个看板；快照保留 21 天历史。找不到出处的数字要么删掉，要么换成不带数字的说法，不要为了好看保留它。
- **亮点写成「原因 → 怎么做的 → 前后对比」**（他 2026-10-29 的要求）。只报一个度量值没有说服力："首屏 91 KB gzip" 要说清为什么贵（three.js 占旧版整包七成）、用什么手段降（拆 chunk + load 后空闲队列动态 import）、结果是多少。「代码行数」不是亮点：`3700 行单文件` 这类写法会被读成"不会拆模块"，要换成架构事实（同一份 `create(env)` 内核既跑真机也跑无头 Chrome）。
- **秒数只在实测之后才写**。目前拿不到「优化前 X 秒 → 优化后 Y 秒」：旧版已不再部署，而这条链路（国内→Cloudflare 无就近节点）首字节实测 0.4~8.6 秒、抖动到 30 秒超时，包体差异不会线性折算成秒。别用推算的秒数凑格式，先用 gzip 字节表述。
- **小节标题用常规名词，不用俏皮话**（他的原话："该降的降 该藏得藏 这种描述不能直接作为标题"）。当前许可集合：`包体与性能 / 渲染内核与跨端架构 / 自动化验证 / 云与合规 / 架构与凭据边界 / 移动端适配与降级 / 交付与架构 / 数据可信 / 三层机制 / 实现要点 / 交互与图形 / 交付与落地 / 流式与呈现 / 检测范围 / 工程取舍`。同一张卡里 `包体与性能` 只出现一次，别拆成"包体与资源 + 渲染性能"两节来凑。
- **宽屏两张栏由 `break-inside: avoid` 保证一节不跨栏**（跨栏会让下一栏开头出现没有小标题归属的条目）。栏高不平衡时**改 sections 的排列顺序**，不要改 CSS：把最高的一节单独放一栏（《别点那只》现在 `包体与性能` 在最前 = 605px，另三节 660px 在第二栏）。1600 视口实测两栏填充 605/659、375/528，卡片高 838 / 748。
- **单位前后一致**：同一句里别 `7881 KB` 与 `1.29 MB` 混排（换算成 7.7 MB）；gzip 单位在同一 bullet 内只说明一次。
- **身份如实**：外包签约主体放在 `vendor` 字段、排版退到最后一条，业务与角色在前；不写"核心商业化模块"这类自我定性，也不把甲方写成雇主。
- **禁止**：卖萌感叹号式命名、"Demo"字样、编造统计数字、把机制术语（快照 / 生成 / 自动更新）写进访客可见文案。
- `sections[].items` 是 HTML 字符串（`<strong>` 用作小标题），只放可信的静态文案，不接外部内容。

## 已知问题

- `scripts/harness-check.js` 里的 PascalCase 规则目前作用到 `src/` 下所有 `.tsx`，而 `.qoder/rules/resume-rules.js` 声明的范围是 `src/components/*.tsx`，因此入口文件 `src/main.tsx` 会让 `npm run harness:check` 失败；这是脚本与规则声明不一致，不是代码问题。

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
