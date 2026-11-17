import { useEffect } from 'react';
import { Gate } from './components/Gate';
import { boot, daysLeft, leave, setView, state, useVersion, VIEWS } from './lib/store';
import { CertView } from './views/Cert';
import { MapView } from './views/Map';
import { StudentsView } from './views/Students';
import { TrialView } from './views/Trial';

function Bg() {
  return (
    <>
      <div className="bg-grid" />
      <div className="bg-glow bg-glow--a" />
      <div className="bg-glow bg-glow--b" />
    </>
  );
}

export default function App() {
  useVersion();
  useEffect(() => {
    boot();
    const onHash = () => {
      const h = location.hash.replace('#', '') as (typeof VIEWS)[number]['id'];
      if (VIEWS.some((v) => v.id === h) && state.view !== h) setView(h);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (state.status === 'booting') {
    return (
      <>
        <Bg />
        <div className="gate">
          <p className="chip-i">读内容…</p>
        </div>
      </>
    );
  }

  if (state.status === 'error') {
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

  if (!state.parts) {
    return (
      <>
        <Bg />
        <Gate />
      </>
    );
  }

  const p = state.parts;
  const left = daysLeft(p.trial.date);
  const hot = left >= 0 && left <= 7;

  return (
    <>
      <Bg />
      <div className="shell">
        <header className="masthead">
          <div className="brand">
            <div className="logo">▤</div>
            <div>
              <h1>备课台</h1>
              <p>
                {p.trial.date} · {p.trial.school}
              </p>
            </div>
          </div>
          <div className="mh-right">
            <span className={'chip-i' + (hot ? ' chip-i--hot' : '')}>
              试讲{left > 1 ? '还有 ' + left + ' 天' : left === 1 ? '就在明天' : left === 0 ? '就是今天' : '已经过了'}
            </span>
            <a className="chip-i" href="/ai-fxb/">
              AI 窗口 ↗
            </a>
            <button type="button" className="btn btn--ghost" onClick={leave}>
              退出
            </button>
          </div>
        </header>

        <nav className="tabs">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={'tab' + (state.view === v.id ? ' is-active' : '')} onClick={() => setView(v.id)}>
              <span className="tab__ico">{v.ico}</span>
              {v.label}
            </button>
          ))}
        </nav>

        {state.view === 'trial' ? <TrialView d={p.trial} py={p.python} /> : null}
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
