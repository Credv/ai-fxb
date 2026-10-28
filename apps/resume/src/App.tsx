import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ProjectCard from './components/ProjectCard'

const projects = [
  {
    title: '《别点那只》 · 微信小游戏',
    role: '独立全栈开发（玩法 / 引擎 / 美术管线 / 云后端 / 合规全部个人完成）',
    desc: '一款休闲反应小游戏：规则在回合之间切换，一次点错即结束。目前处于上线前阶段。',
    sections: [
      {
        title: '自研引擎',
        items: [
          '<strong>Canvas 2D 引擎，3700 行单文件</strong>：没有引入 Cocos / Laya，弹窗、滚动列表、安全区适配和柔阴影都是自己那一套绘制层',
          '<strong>零资源音频</strong>：音效与 BGM 由 Web Audio 程序化合成，包体内不放一个音频文件',
          '<strong>可注入随机</strong>：发牌随机改成「周号 + 种子」双通道 PRNG——周赛必须全服同题，探针必须能复现同一局',
        ],
      },
      {
        title: '可验证性',
        items: [
          '<strong>22 条无头探针道 / 315 条断言</strong>：用虚拟时钟驱动 headless Chrome 的真实帧循环，难度曲线、断点寄存、云存档合并、HUD 读数全部固化成断言，每批改动跑全量',
          '<strong>期望条数即门禁</strong>：断言数不足直接判失败，跑了一半不算通过',
          '<strong>数值先模拟再定</strong>：成就 / 贴纸 / 称号门槛由蒙特卡洛跑出的分数带反推，不靠手感',
        ],
      },
      {
        title: '包体、云与合规',
        items: [
          '<strong>包体门禁工具</strong>：主包 4 MB、单图 ≤100 KB，按字节判定哪张图需要压，可反复跑',
          '<strong>云开发后端</strong>：云函数五类接口（分数 / 周赛提交、总榜、周榜、击败率），客户端 60s TTL 缓存 + 请求单飞 + 8s 超时兜底',
          '<strong>开放数据域好友榜（526 行）</strong>：好友数据留在微信开放数据域内渲染，不流向任何自建后端',
          '<strong>55 节设计规格文档</strong>：逐版记录决策与「故意没做」的边界；备案与隐私声明的口径和代码逐条对齐',
        ],
      },
    ],
    valueTags: ['3700 行自研引擎', '22 道探针 / 315 断言', '零资源音频', '一个人全栈'],
  },
  {
    title: 'AI 窗口 · 全球 AI 情报控制台',
    role: '独立设计与实现 · 产品 / 数据管线 / 前端 / 部署全部个人完成',
    desc: '一个纯信息分享的 AI 资讯站：大事件、前沿技术、赛道商机与模型榜单收在五个板块里，打开即读，不注册也不需要配置任何 API Key。',
    sections: [
      {
        title: '架构与凭据边界',
        items: [
          '<strong>零后端、零数据库</strong>：逻辑只存在于浏览器与构建期。访客打开就有内容——构建期预生成的每日快照；要自己生成才需要 Key，而 Key 只进浏览器本地存储',
          '<strong>抓包抓不到凭据</strong>：访客的 Key 由浏览器直接发给服务商，只在请求头里，不进 URL、不经过本站域名；站点的 Key 只在 Actions 构建容器里从仓库 Secret 读一次，产物只剩一份静态 JSON。非 https 的网关地址直接拒绝保存（只有本机回环例外），模型返回内容全部经 React 转义，不留 innerHTML 注入口',
          '<strong>monorepo，一次构建发两条路由</strong>：Vite + React 18 + TypeScript，npm workspaces 把提示词、归一化、稳定 id 与合并规则收成一份共享核心——浏览器端与 Node 快照脚本共用同一套；GitHub 连 Cloudflare，push 即上线',
        ],
      },
      {
        title: '性能与降级',
        items: [
          '<strong>首屏 91 KB gzip</strong>：three.js（172 KB gzip）只服务装饰性 3D 背景，页面 load 后走空闲队列动态 import，关掉 3D 完全不下载；装饰层与动画层各自独立 chunk，都不进首屏包',
          '<strong>缓存策略按链路定</strong>：实测国内到 Cloudflare 边缘节点一次往返 1~8 秒，因此带内容哈希的资源给一年 immutable，首页与每日快照强制回源',
          '<strong>该降的降、该藏的藏</strong>：软件渲染与低帧率触发降级，触屏与窄屏走低配参数、≤640px 重排为吸顶导航与底部抽屉；访客看不到自己也用不了的生成与设置入口，脚本执行前也不会闪出',
        ],
      },
    ],
    valueTags: ['零后端，抓包拿不到 Key', '幻觉治理：榜单不经模型', '首屏 91 KB gzip', 'push 即上线'],
    liveUrl: 'https://3ecat.me/ai-fxb',
    githubUrl: 'https://github.com/Credv/ai-fxb',
  },
  {
    title: '千牛平台 · 金融阵地',
    role: '核心开发 & Owner',
    desc: '淘宝/天猫商家工作台千牛的金融服务阵地，承接商家侧金融产品入口与经营数据总览；我负责该阵地从页面到 Node 服务层的整体交付。',
    sections: [
      {
        title: '交付与架构',
        items: [
          '<strong>Monorepo 下 6 个包的架构与迭代</strong>：淘宝 / 天猫业务包、共用产品组件、模块与营销组件、Node 服务层，页面到服务层一个人对接',
          '<strong>从多仓到 Monorepo</strong>：包管理、构建与发布规范收敛成一套，散在多个仓库的重复配置清掉',
          '<strong>React 17 → 18</strong>：难点不在版本号，在存量页面对「渲染只有一次」的隐含假设——双渲染把没写对的副作用全暴露出来',
        ],
      },
      {
        title: '数据可信',
        items: [
          '<strong>埋点体系治理</strong>：缺失、重复、命名不一致的埋点，最后都变成业务方无法对账的口径；清理之后建立统一上报口径并接入三方监控平台',
          '<strong>自研 Chrome 埋点插件</strong>：把「逐页人工盘点」换成打开页面即自动采集，盘点这件事从体力活变成一次扫描',
        ],
      },
    ],
    valueTags: ['阵地 Owner', '6 个包 + Node 服务层', '埋点口径重建', 'React 18 升级'],
  },
  {
    title: 'Harness Engineering · AI Agent 工程化治理框架',
    role: '架构设计 & 核心开发',
    desc: '面向 AI Agent 辅助研发场景的工程化治理框架：用结构化知识预计算、机械化约束、自动化反馈三层机制，让 AI 生成的代码在项目约定上保持稳定。',
    sections: [
      {
        title: '三层机制',
        items: [
          '<strong>结构化知识预计算</strong>：AST 扫描自动生成 action / component 注册表，AGENTS.md 作为 AI 的入口导航——AI 缺的从来不是智力，是这个项目的事实',
          '<strong>机械化约束</strong>：把项目约定写成能执行的 lint 脚本，不靠提醒和 code review 里的反复啰嗦',
          '<strong>自动化反馈</strong>：文档新鲜度检查，防止 AI 继续照着早已过期的知识写代码',
        ],
      },
      {
        title: '实现要点',
        items: [
          '<strong>ts-morph 扫描 + DFS import 树遍历</strong>：从页面递归收集接口与组件依赖，拼出完整依赖图谱',
          '<strong>增量合并策略</strong>：fnNames / srcs 聚合、幂等覆盖，支持 Monorepo 跨包扫描；注册表能随时重跑而不产生 diff',
          '<strong>Human-in-the-Loop 流程</strong>：AI 生成 → 人工审核 → 自动化校验，责任边界写死在流程里而不是靠默契',
        ],
      },
    ],
    valueTags: ['三层机制', 'AI 缺的是项目事实', 'Monorepo 跨包扫描', '已在真实项目落地'],
  },
  {
    title: '招财猫 · 互动祈福 H5 应用',
    role: 'AI 辅助开发 & Owner',
    desc: '基于 Ice.js v3 + React 18 的半游戏化营销 H5：领养虚拟猫咪、许愿祈福、出行探险、收集签文日记。自建的 Harness Engineering 框架在这里真正进入日常迭代。',
    sections: [
      {
        title: '交互与图形',
        items: [
          '<strong>Three.js 3D 签筒</strong>：@react-three/fiber 场景上的多阶段动画状态机（入场→摇晃→飞出→完成），含发光特效与缓动曲线',
          '<strong>悬浮猫咪交互系统</strong>：拖拽 + 手势朝向切换（平视/仰视/俯视）+ 无操作休眠唤醒 + 边缘吸附；难点不是动画，是几个状态机同时抢一只猫时的仲裁',
          '<strong>帧动画与转场</strong>：雪碧图多模式无限滚动（六图昼夜无缝拼接）与 clipPath 圆形展开式页面切换',
        ],
      },
      {
        title: '交付与落地',
        items: [
          '<strong>完整生命周期状态</strong>：领养→祈愿→出行→轮询→收获→反馈；localStorage 降级兜底 + 3s 超时保护，接口慢也不能把页面卡死',
          '<strong>Harness 在真实迭代里跑起来</strong>：结构化知识与机械化约束进日常开发，AI 出组件与接口联调的初稿，人工审核后合入',
          '<strong>跨端与发布体系</strong>：手淘环境判断 + PC 端 iframe 包裹方案，Pegasus 插件集成 DEF 发布流程',
        ],
      },
    ],
    valueTags: ['Harness 首个落地', 'R3F 3D 场景', '多状态机交互', '手淘 + PC 跨端'],
  },
  {
    title: '催收平台 · AI 对话小助手',
    role: '核心开发',
    desc: '在内部催收作业台里接入大模型对话能力：案件信息查取、沟通与分析报告生成，都收进一次自然语言对话，前端负责流式渲染与多格式内容的可读呈现。',
    sections: [
      {
        title: '流式与呈现',
        items: [
          '<strong>流式渲染（SSE）</strong>：基于 fetch Stream API 逐块接收；真正的麻烦是内容还没吐完时，Markdown 与代码块处在「半截」状态，解析不能崩，也不能每来一块就把整段重排',
          '<strong>多类型内容混排</strong>：文本 / Markdown / 代码块 / ECharts 图表 / 可折叠思考块在同一条流里动态解析与挂载，思考过程与正文分开折叠',
          '<strong>打字机与滚动同步</strong>：useTypewriter 分段吐字，同时保证新内容不会把正在读的人顶出屏幕',
        ],
      },
    ],
    valueTags: ['SSE 流式', '半截内容解析', '多类型混排渲染'],
  },
  {
    title: 'Pre-Release Check · AI 代码发布质量门禁',
    role: '独立设计 & 开发',
    desc: '自主设计的 AI Agent Skill：由意图识别自动触发，对 Git diff 做多维度静态分析，把风险拦在 MR 阶段而不是上线后的复盘里。已作为团队发布前的一道固定检查。',
    sections: [
      {
        title: '检测范围',
        items: [
          '<strong>5 维矩阵</strong>：环境隔离（预发域名 / 测试 IP / 硬编码 URL）、调试产物清理、埋点覆盖度、ESLint 增量、业务逻辑风险——五类问题的判定方式完全不同，能统一进一次调用的抽象是这套东西的核心',
          '<strong>业务逻辑风险</strong>：金额转换、空值陷阱、truthy 误判、白屏风险，四类都是「跑起来不报错但线上会出事」的写法',
        ],
      },
      {
        title: '工程取舍',
        items: [
          '<strong>增量分析引擎</strong>：基于 git diff 行级定位，只分析变更范围；全量扫描的耗时与噪音都无法接受',
          '<strong>模式匹配 + 语义上下文</strong>：门禁最怕误报，误报三次就没人再看它了',
          '<strong>结构化报告</strong>：区分「阻塞发布」与「建议优化」两级，把人的注意力花在真正需要判断的地方',
        ],
      },
    ],
    valueTags: ['30min → 2min', '质量左移', '拦截资损风险', '团队标准流程'],
    githubUrl: 'https://github.com/Credv/pre-release-check',
  },
]

interface WorkItem {
  org: string
  role: string
  vendor?: string
  period: string
  city: string
  current?: boolean
}

const workExperience: WorkItem[] = [
  { org: '阿里巴巴 · 千牛平台', role: '前端开发工程师', vendor: '博彦科技', period: '2024.05 — 2026.09', city: '杭州' },
  { org: '蚂蚁集团 · 金融业务', role: '前端开发工程师', vendor: '法本科技', period: '2021.12 — 2024.05', city: '杭州' },
  { org: '浩鲸云科技', role: '前端开发工程师', period: '2020.12 — 2021.12', city: '福州' },
]

export default function App() {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="layout">
      <Sidebar />

      <main className="main">
        {/* 工作经历 */}
        <div className="section-title">
          <div className="icon">💼</div>
          工作经历
        </div>
        <div className="work-timeline">
          {workExperience.map((exp, i) => (
            <div className={`work-item${exp.current ? ' current' : ''}`} key={i}>
              <div className="company">{exp.org}</div>
              <div className="role">{exp.role}</div>
              <div className="period">{exp.period}</div>
              <div className="city">{exp.city}</div>
              {exp.vendor && <div className="vendor">签约主体 · {exp.vendor}</div>}
            </div>
          ))}
        </div>

        {/* 项目经历 */}
        <div className="section-title">
          <div className="icon">🚀</div>
          项目经历
        </div>
        {projects.map((project, i) => (
          <ProjectCard key={i} {...project} />
        ))}

        <div className="footer">
          © 2026 陈鸿 · 全栈开发工程师 · 联系方式：13123332932 | 793927991@qq.com
          <br />
          在线作品：
          <a className="footer-link" href="https://3ecat.me/ai-fxb" target="_blank" rel="noopener noreferrer">3ecat.me/ai-fxb</a>
          {' · '}
          <a className="footer-link" href="https://github.com/Credv" target="_blank" rel="noopener noreferrer">github.com/Credv</a>
        </div>
      </main>

      {/* 回到顶部 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--gradient)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79,110,247,0.4)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="回到顶部"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      )}
    </div>
  )
}
