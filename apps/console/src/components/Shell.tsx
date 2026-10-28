/* 外壳:顶栏(来源/用量/设置)与页签导航 */
import { ADMIT } from '../lib/settings';
import { state, setView, openSettings, useVersion, type BucketKind, type View } from '../lib/store';

// 蛛网页签暂时下线(面板与 net/ 动画层都还在,改成 true 即恢复)
export const SHOW_NET_TAB = false;

const TABS: { view: View; ico: string; label: string }[] = [
  { view: 'sum', ico: '∑', label: 'AI 汇总' },
  { view: 'tech', ico: '△', label: '前沿技术' },
  { view: 'rank', ico: '♛', label: '模型排行' },
  { view: 'ops', ico: '◎', label: '商机雷达' },
  { view: 'news', ico: '✦', label: 'AI 大事件' },
  { view: 'net', ico: '✷', label: '蛛网' }
];

function sourceChip(): { cls: string; label: string } {
  const s = state.settings;
  if (s.demo) return { cls: 'source-chip is-demo', label: '演示数据' };
  if (s.apiKey) return { cls: 'source-chip is-live', label: (s.model || 'API') + (s.enableSearch ? ' · 联网' : '') };
  if (state.snapshot) return { cls: 'source-chip is-live', label: '公开快照' };
  return { cls: 'source-chip is-off', label: '未配置 API' };
}

export function Masthead() {
  useVersion();
  const src = sourceChip();
  const u = state.usage;
  const usageTitle = '累计消耗 ' + u.total + ' token(' + u.calls + ' 次调用)· 其中静默同步 ' + u.silent +
    '(' + u.silentCalls + ' 次)· 今日共 ' + u.dayTotal + ' / 今日静默 ' + u.daySilent;
  return (
    <header className="masthead">
      <div className="masthead__brand">
        <div className="logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
            <path d="M16 2.5 27.5 9v14L16 29.5 4.5 23V9L16 2.5Z" stroke="url(#lg)" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M16 9.5v13M10.5 12.7v6.6M21.5 12.7v6.6" stroke="url(#lg)" strokeWidth="1.6" strokeLinecap="round" />
            <defs>
              <linearGradient id="lg" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" /><stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="masthead__text">
          <h1>AI 窗口</h1>
          <p className="masthead__sub">全球 AI 情报控制台</p>
        </div>
      </div>

      <div className="masthead__actions">
        <div className={src.cls} data-admin="1" title="数据来源状态">
          <span className="source-chip__dot" />
          <span>{src.label}</span>
        </div>
        <div className="source-chip" data-admin="1" title={usageTitle}>
          <span>token:<b>{u.total}</b></span>
        </div>
        {ADMIT ? (
          <button className="btn btn--ghost" type="button" onClick={openSettings} title="设置">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.7" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2v.17a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 2.6 14H2.43a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4 7.6l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6V4.43a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21.4 11h.17a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.57 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <span>设置</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function Tabs() {
  useVersion();
  const tabs = TABS.filter((t) => t.view !== 'net' || SHOW_NET_TAB);
  return (
    <nav className="tabs" role="tablist" aria-label="主导航">
      {tabs.map((t) => {
        const on = state.view === t.view;
        const badge = t.view === 'net' ? 0 : (state[t.view as BucketKind].tabNew || 0);
        return (
          <button
            key={t.view}
            className={'tab' + (on ? ' is-active' : '')}
            role="tab"
            id={'tab-' + t.view}
            aria-controls={'panel-' + t.view}
            aria-selected={on}
            type="button"
            onClick={() => setView(t.view)}
          >
            <span className="tab__ico" aria-hidden="true">{t.ico}</span> {t.label}
            {badge > 0 ? <span className="tab__badge" title={badge + ' 条新数据'}>{badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

export function Foot() {
  return <footer className="foot"><span>AI 风向标</span></footer>;
}
