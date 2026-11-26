import { useEffect } from 'react';
import { Gate } from './components/Gate';
import { applyRoute, boot, daysLeft, go, leave, parseHash, PRIVATE_VIEWS, state, useVersion } from './lib/store';
import { CertView } from './views/Cert';
import { MapView } from './views/Map';
import { PrepView } from './views/Prep';
import { StudentsView } from './views/Students';

function Bg() {
  return (
    <>
      <div className="bg-grid" />
      <div className="bg-glow bg-glow--a" />
      <div className="bg-glow bg-glow--b" />
    </>
  );
}

function Masthead({ sub, right }: { sub: string; right?: React.ReactNode }) {
  return (
    <header className="masthead">
      <div className="brand">
        <div className="logo">▤</div>
        <div>
          <h1>备课台</h1>
          <p>{sub}</p>
        </div>
      </div>
      <div className="mh-right">{right}</div>
    </header>
  );
}

export default function App() {
  useVersion();
  useEffect(() => {
    boot();
    const onHash = () => {
      const v = parseHash();
      if (v !== state.view) applyRoute(v);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (state.gate === 'loading') {
    return (
      <>
        <Bg />
        <div className="gate">
          <p className="chip-i">读内容…</p>
        </div>
      </>
    );
  }
  if (state.gate === 'error') {
    return (
      <>
        <Bg />
        <div className="shell">
          <div className="err">
            <h3>打不开</h3>
            <p>{state.error}</p>
          </div>
        </div>
      </>
    );
  }
  if (state.gate !== 'open' || !state.parts) {
    return (
      <>
        <Bg />
        <Gate />
      </>
    );
  }

  const p = state.parts;
  const left = daysLeft(p.prep.date);
  const hot = left >= 0 && left <= 7;

  return (
    <>
      <Bg />
      <div className="shell">
        <Masthead
          sub="我自己看的那几页"
          right={
            <>
              <span className={'chip-i' + (hot ? ' chip-i--hot' : '')}>
                试讲{left > 1 ? '还有 ' + left + ' 天' : left === 1 ? '就在明天' : left === 0 ? '就是今天' : '已经过了'}
              </span>
              <a className="chip-i" href="/ai-fxb/">
                AI 窗口 ↗
              </a>
              <button type="button" className="btn btn--ghost" onClick={leave}>
                退出
              </button>
            </>
          }
        />
        <nav className="tabs">
          {PRIVATE_VIEWS.map((x) => (
            <button
              key={x.id}
              type="button"
              className={'tab' + (state.view === x.id ? ' is-active' : '')}
              onClick={() => go(x.id)}
              title={x.hint}
            >
              <span className="tab__ico">{x.ico}</span>
              {x.label}
            </button>
          ))}
        </nav>
        {state.view === 'prep' ? <PrepView d={p.prep} /> : null}
        {state.view === 'students' ? <StudentsView d={p.students} /> : null}
        {state.view === 'map' ? <MapView d={p.map} /> : null}
        {state.view === 'cert' ? <CertView d={p.cert} /> : null}
        <footer className="foot">
          <div>
            <a href="/">← 3ecat.me</a>
          </div>
        </footer>
      </div>
    </>
  );
}
