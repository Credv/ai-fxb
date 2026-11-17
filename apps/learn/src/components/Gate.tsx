import { useState } from 'react';
import { enter } from '../lib/store';

export function Gate() {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!pw.trim() || busy) return;
    setBusy(true);
    setErr('');
    const msg = await enter(pw.trim());
    setBusy(false);
    if (msg) setErr(msg);
  }

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={go}>
        <div className="gate__lock">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4fd1c5" strokeWidth="1.7" strokeLinecap="round">
            <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
            <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
            <path d="M12 14.2v2.4" />
          </svg>
        </div>
        <h2>备课台</h2>
        <div className="gate__form">
          <input
            className="gate__input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (err) setErr('');
            }}
            aria-label="密码"
          />
          <button className="btn btn--primary" type="submit" disabled={!pw.trim() || busy}>
            {busy ? '解开中' : '进入'}
          </button>
        </div>
        {err ? <p className="gate__err">{err}</p> : null}
        <p className="gate__note">关掉标签页要重新输一次；密码不进任何长期存储。</p>
      </form>
    </div>
  );
}
