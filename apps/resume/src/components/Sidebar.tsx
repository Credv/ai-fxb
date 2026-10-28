export default function Sidebar() {
  return (
    <aside className="sidebar">
      <img className="avatar" src="https://img.alicdn.com/imgextra/i4/O1CN011D4H3IIuAAE18Ung_!!6000000000943-0-tps-560-800.jpg" alt="陈鸿" />
      <h1>陈鸿</h1>
      <p className="subtitle">全栈开发工程师</p>

      <div className="summary">
        5 年前端，近几个月把力气集中在两件事上：一个人把产品从设计做到线上，以及用工程化手段约束 AI 生成代码的质量。
      </div>

      {/* 联系方式 */}
      <div className="sidebar-section">
        <h3>联系方式</h3>
        <div className="contact-item">
          <span className="contact-icon">📱</span>
          <span>13123332932</span>
        </div>
        <div className="contact-item">
          <span className="contact-icon">📧</span>
          <span>793927991@qq.com</span>
        </div>
        <div className="contact-item">
          <span className="contact-icon">📍</span>
          <span>杭州</span>
        </div>
        <div className="contact-item">
          <span className="contact-icon">💼</span>
          <span>5 年经验（2020.12 — 2026.09）</span>
        </div>
      </div>

      {/* 教育背景 */}
      <div className="sidebar-section">
        <h3>教育背景</h3>
        <div className="edu-item">
          <div className="school">闽江大学</div>
          <div className="detail">本科 · 2017 — 2021</div>
        </div>
      </div>

      {/* 技能清单 */}
      <div className="sidebar-section">
        <h3>技能清单</h3>

        <div className="skill-group">
          <div className="skill-group-title">AI 工程化</div>
          <div className="skill-tags">
            <span className="skill-tag">Harness 框架</span>
            <span className="skill-tag">Agent Workflow</span>
            <span className="skill-tag">AST 扫描</span>
            <span className="skill-tag">Prompt 工程</span>
          </div>
        </div>

        <div className="skill-group">
          <div className="skill-group-title">前端框架</div>
          <div className="skill-tags">
            <span className="skill-tag">React 16/17/18</span>
            <span className="skill-tag">Umi</span>
            <span className="skill-tag">Ice.js</span>
          </div>
        </div>

        <div className="skill-group">
          <div className="skill-group-title">工程化</div>
          <div className="skill-tags">
            <span className="skill-tag">Vite</span>
            <span className="skill-tag">Webpack</span>
            <span className="skill-tag">Monorepo</span>
            <span className="skill-tag">pnpm</span>
          </div>
        </div>

        <div className="skill-group">
          <div className="skill-group-title">语言</div>
          <div className="skill-tags">
            <span className="skill-tag">JavaScript</span>
            <span className="skill-tag">TypeScript</span>
            <span className="skill-tag">Node.js</span>
          </div>
        </div>

        <div className="skill-group">
          <div className="skill-group-title">图形与交互</div>
          <div className="skill-tags">
            <span className="skill-tag">Three.js / R3F</span>
            <span className="skill-tag">Canvas 2D 引擎</span>
            <span className="skill-tag">Web Audio</span>
            <span className="skill-tag">ECharts</span>
            <span className="skill-tag">雪碧图帧动画</span>
          </div>
        </div>

        <div className="skill-group">
          <div className="skill-group-title">小游戏与云</div>
          <div className="skill-tags">
            <span className="skill-tag">微信小游戏</span>
            <span className="skill-tag">微信云开发</span>
            <span className="skill-tag">开放数据域</span>
            <span className="skill-tag">无头自动化验证</span>
          </div>
        </div>

        <div className="skill-group">
          <div className="skill-group-title">业务与工具</div>
          <div className="skill-tags">
            <span className="skill-tag">埋点体系治理</span>
            <span className="skill-tag">Chrome 扩展</span>
            <span className="skill-tag">SSE 流式渲染</span>
          </div>
        </div>
      </div>

    </aside>
  )
}
