import { useEffect } from 'react';
import { Gate } from './components/Gate';
import { applyRoute, boot, leave, parseHash, state, useVersion } from './lib/store';
import { CertView } from './views/Cert';

function Bg() {
  return (
    <>
      <div className="bg-grid" />
      <div className="bg-glow bg-glow--a" />
      <div className="bg-glow bg-glow--b" />
    </>
  );
}

function Masthead({ right }: { right?: React.ReactNode }) {
  return (
    <header className="masthead">
      <div className="brand">
        <div className="logo">▤</div>
        <div>
          <h1>教资冲刺台</h1>
          <p>三科笔试 · 漳州高中信息技术</p>
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

  return (
    <>
      <Bg />
      <div className="shell">
        <Masthead
          right={
            <>
              <a className="chip-i" href="/ai-fxb/">
                AI 窗口 ↗
              </a>
              <button type="button" className="btn btn--ghost" onClick={leave}>
                退出
              </button>
            </>
          }
        />
        <CertView d={p.cert} />
        <footer className="foot">
          <div>
            <a href="/">← 3ecat.me</a>
          </div>
        </footer>
      </div>
    </>
  );
}
