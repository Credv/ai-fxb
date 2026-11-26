import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Answer, Shot } from '../lib/store';
import { shrinkImage } from '../lib/store';
import type { ItemResult } from '../lib/grade';
import type { IpTask, PythonTask, Question, SheetTask, SingleChoice } from '../lib/types';
import { envState, envVersion, onEnvChange, runPython, type EnvState } from '../lib/python';

export type Mode = 'edit' | 'review';

type Props = {
  q: Question;
  number: number;
  mode: Mode;
  ans?: Answer;
  result?: ItemResult;
  /** 到点后所有作答入口关掉，只留查看 */
  locked?: boolean;
  onEdit: (id: string, patch: Answer) => void;
};

function letter(i: number) {
  return String.fromCharCode(65 + i);
}

/** 题干里用三个反引号夹住的部分按程序原文排版，缩进与空格照原样保留 */
function Rich({ text }: { text: string }) {
  const lines = (s: string) => s.replace(/^(?:\r?\n)+/, '').replace(/(?:\r?\n)+$/, '');
  return (
    <>
      {text.split('```').map((part, i) =>
        i % 2 === 1 ? (
          <pre className="code-read" key={i}>
            {lines(part)}
          </pre>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function assetUrl(file: string) {
  return `/exam/data/${encodeURIComponent(file)}`;
}

function extOf(file: string) {
  const e = file.split('.').pop() || '';
  return e.toLowerCase();
}

export default function Question(props: Props) {
  const { q, number, mode, ans, result, locked, onEdit } = props;
  const cls = [
    'q',
    mode === 'review' && result ? (result.state === 'right' || result.state === 'partial' ? 'q--right' : result.state === 'wrong' ? 'q--wrong' : '') : ''
  ].join(' ');

  return (
    <article className={cls} id={`q-${number}`}>
      <header className="q-head">
        <span className="q-no">{number}</span>
        <span className="q-kind">{kindName(q)}</span>
        <span className="q-mark">{q.score} 分</span>
        {mode === 'review' && result ? <Verdict r={result} /> : null}
      </header>

      <p className="q-stem">
        <Rich text={stem(q)} />
      </p>

      {q.type === 'single' ? <Choices q={q} ans={ans} mode={mode} locked={locked} onEdit={onEdit} /> : null}
      {q.type === 'ip' ? <IpBody q={q} ans={ans} mode={mode} locked={locked} onEdit={onEdit} /> : null}
      {q.type === 'python' ? <PythonBody q={q} ans={ans} mode={mode} locked={locked} onEdit={onEdit} /> : null}
      {q.type === 'sheet' ? <SheetBody q={q} ans={ans} mode={mode} locked={locked} onEdit={onEdit} /> : null}

      {mode === 'review' && result ? <Review q={q} r={result} /> : null}
    </article>
  );
}

function kindName(q: Question) {
  return q.type === 'single'
    ? '单项选择题'

      : q.type === 'ip'
        ? '网络参数设置'
        : q.type === 'python'
          ? '程序设计'
          : '电子表格操作';
}

function stem(q: Question) {
  if (q.type === 'single') return q.stem;
  return q.stem;
}

function Verdict({ r }: { r: ItemResult }) {
  if (r.state === 'pending') return <span className="q-mark">这部分成绩由教师评定</span>;
  if (r.state === 'blank') return <span className="q-mark">未作答</span>;
  return (
    <span className={r.score === r.full ? 'tag-ok' : r.state === 'partial' ? 'q-mark' : 'tag-bad'}>
      {r.score === r.full ? '本题得分' : r.state === 'partial' ? `得 ${r.score} 分` : '本题不得分'}
    </span>
  );
}

/* ---------- 单选 / 判断 ---------- */

function Choices({
  q,
  ans,
  mode,
  locked,
  onEdit
}: {
  q: SingleChoice;
  ans?: Answer;
  mode: Mode;
  locked?: boolean;
  onEdit: Props['onEdit'];
}) {
  const options = q.options;
  const pick = ans?.pick ?? -1;
  const right = q.answer;

  return (
    <ul className="opts">
      {options.map((text, i) => {
        const on = pick === i;
        const mark = mode === 'review' && i === right;
        return (
          <li key={i}>
            <label
              className={[
                'opt',
                on ? 'opt--on' : '',
                mode === 'review' && on && !mark ? 'opt--miss' : '',
                mark ? 'opt--right' : ''
              ].join(' ')}
            >
              <input
                type="radio"
                name={q.id}
                checked={on}
                disabled={mode === 'review' || locked}
                onChange={() => onEdit(q.id, { pick: i })}
              />
              <span className="opt-key">{letter(i)}</span>
              <span>{text}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- 网络参数 ---------- */

function IpBody({
  q,
  ans,
  mode,
  locked,
  onEdit
}: {
  q: IpTask;
  ans?: Answer;
  mode: Mode;
  locked?: boolean;
  onEdit: Props['onEdit'];
}) {
  const values = ans?.values ?? {};
  return (
    <>
      <table className="opts">
        <thead>
          <tr>
            <th>计算机</th>
            <th>IP 地址</th>
            <th>子网掩码</th>
            <th>网关</th>
            <th>DNS</th>
          </tr>
        </thead>
        <tbody>
          {q.given.map((g) => (
            <tr key={g.name}>
              <td>{g.name}</td>
              <td>{g.ip}</td>
              <td>{g.mask}</td>
              <td>{g.gateway}</td>
              <td>{g.dns}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="field-grid">
        {q.fields.map((f) => (
          <div key={f.key}>
            <label className="fl" htmlFor={`${q.id}-${f.key}`}>
              {f.label}
            </label>
            <input
              className="tt"
              id={`${q.id}-${f.key}`}
              autoComplete="off"
              spellCheck={false}
              disabled={mode === 'review' || locked}
              value={values[f.key] ?? ''}
              placeholder={mode === 'edit' ? '' : undefined}
              onChange={(e) => onEdit(q.id, { values: { ...values, [f.key]: e.target.value } })}
            />
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- 程序设计 ---------- */

function PythonBody({
  q,
  ans,
  mode,
  locked,
  onEdit
}: {
  q: PythonTask;
  ans?: Answer;
  mode: Mode;
  locked?: boolean;
  onEdit: Props['onEdit'];
}) {
  const code = ans?.code ?? q.starter ?? '';
  const stdin = ans?.stdin ?? '';
  const [running, setRunning] = useState(false);
  const [env, setEnv] = useState<EnvState>(envState());
  const [live, setLive] = useState<{ out: string; err: string } | null>(
    ans?.out || ans?.err ? { out: ans?.out ?? '', err: ans?.err ?? '' } : null
  );

  useEffect(() => onEnvChange(setEnv), []);

  const edit = useCallback(
    (next: string) => onEdit(q.id, { code: next }),
    [onEdit, q.id]
  );

  async function run() {
    setRunning(true);
    setLive(null);
    const r = await runPython(code, stdin);
    setLive({ out: r.out, err: r.err });
    setRunning(false);
    onEdit(q.id, { out: r.out, err: r.err, ran: true });
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      const t = ta.selectionEnd;
      const next = code.slice(0, s) + '    ' + code.slice(t);
      edit(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = s + 4;
      });
    } else if (e.key === 'Enter') {
      // Python 靠缩进，回车后把上一行的缩进带下来，学生不必再数空格
      const s = ta.selectionStart;
      const lineStart = code.lastIndexOf('\n', s - 1) + 1;
      const indent = /^[ \t]*/.exec(code.slice(lineStart, s))?.[0] ?? '';
      const colon = /:\s*$/.test(code.slice(lineStart, s));
      const pad = colon ? indent + '    ' : indent;
      if (!pad) return;
      e.preventDefault();
      const next = code.slice(0, s) + '\n' + pad + code.slice(ta.selectionEnd);
      edit(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = s + 1 + pad.length;
      });
    }
  }

  return (
    <>
      {q.requirements?.length ? (
        <ol className="steps">
          {q.requirements.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      ) : null}
      {q.assets?.length ? <Assets files={q.assets} /> : null}

      <div className="ide">
        {mode === 'edit' ? (
          <div className="ide-bar">
            <span className="env">{envText(env)}</span>
            <span className="muted">Python 3</span>
            <span className="btn-row" style={{ marginLeft: 'auto' }}>
              <button className="btn btn--sm btn--primary" onClick={run} disabled={running || locked || env === 'failed'}>
                {running ? <i className="spin" /> : null}运行
              </button>
            </span>
          </div>
        ) : null}
        <textarea
          spellCheck={false}
          readOnly={mode === 'review' || locked}
          value={code}
          onChange={(e) => edit(e.target.value)}
          onKeyDown={onKey}
        />
        {mode === 'edit' ? (
          <div className="stdin">
            <span>运行输入</span>
            <input
              value={stdin}
              spellCheck={false}
              disabled={locked}
              placeholder={q.checks?.length ? '' : '程序里 input() 读到的内容，一行一个'}
              onChange={(e) => onEdit(q.id, { stdin: e.target.value })}
            />
          </div>
        ) : null}
        <div className={live && live.err && !live.out ? 'out out--err' : 'out'}>
          {running ? <span className="out-hint">正在运行…</span> : live ? show(live) : <span className="out-hint">运行结果显示在这里</span>}
        </div>
      </div>
    </>
  );
}

function show(l: { out: string; err: string }) {
  const t = (l.out || '') + (l.err ? (l.out ? '\n' : '') + l.err : '');
  return t || <span className="out-hint">程序没有输出</span>;
}

function envText(s: EnvState) {
  if (s === 'ready') return `运行环境已就绪 ${envVersion()}`;
  if (s === 'loading') return '运行环境准备中';
  if (s === 'failed') return '运行环境未能启动';
  return '运行环境';
}

/* ---------- 电子表格 ---------- */

function SheetBody({
  q,
  ans,
  mode,
  locked,
  onEdit
}: {
  q: SheetTask;
  ans?: Answer;
  mode: Mode;
  locked?: boolean;
  onEdit: Props['onEdit'];
}) {
  const shots = ans?.shots ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pickFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setError('');
    const next: Shot[] = [];
    for (const f of Array.from(files)) {
      try {
        next.push(await shrinkImage(f));
      } catch (e) {
        setError(e instanceof Error ? e.message : '图片读取失败');
      }
    }
    onEdit(q.id, { shots: [...shots, ...next].slice(0, 6) });
    setBusy(false);
  }

  return (
    <>
      <ol className="steps">
        {q.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {q.expected ? (
        <p className="note-strip">完成后的结果：{q.expected}</p>
      ) : null}
      <Assets files={q.assets} />

      <div className="proof">
        <div className="proof-t">操作结果截图{mode === 'review' ? '' : '（最多 6 张）'}</div>
        <div className="proof-list">
          {shots.map((s, i) => (
            <div className="thumb" key={i}>
              {s.data ? <img src={s.data} alt={s.name} /> : <span className="muted">图片未保存</span>}
              {mode === 'edit' && !locked ? (
                <button
                  title="移除这张截图"
                  onClick={() => onEdit(q.id, { shots: shots.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {!shots.length && mode === 'edit' ? <span className="muted">尚未添加截图</span> : null}
          {!shots.length && mode === 'review' ? <span className="muted">未提交截图</span> : null}
        </div>
        {mode === 'edit' && !locked ? (
          <div className="btn-row" style={{ marginTop: 9 }}>
            <label className="btn btn--sm">
              {busy ? <i className="spin" /> : null}添加截图
              <input
                type="file"
                accept="image/png,image/jpeg"
                multiple
                hidden
                disabled={busy}
                onChange={(e) => {
                  void pickFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <span className="muted">截图保存的是屏幕上的表格画面</span>
          </div>
        ) : null}
        {error ? <div className="err-tip">{error}</div> : null}
        {mode === 'edit' ? (
          <textarea
            className="tt"
            style={{ marginTop: 9, minHeight: 60 }}
            placeholder={q.steps.length ? '需要向教师说明的情况，可留空' : ''}
            disabled={locked}
            value={ans?.note ?? ''}
            onChange={(e) => onEdit(q.id, { note: e.target.value })}
          />
        ) : ans?.note ? (
          <p className="muted">说明：{ans.note}</p>
        ) : null}
      </div>
    </>
  );
}

function Assets({ files }: { files: { file: string; label: string; note?: string }[] }) {
  return (
    <div className="files">
      {files.map((a) => (
        <a className="file-btn" key={a.file} href={assetUrl(a.file)} download={a.file}>
          <span className={'ext ext--' + extKind(a.file)}>{extOf(a.file).toUpperCase()}</span>
          <span>{a.label}</span>
        </a>
      ))}
    </div>
  );
}

function extKind(f: string) {
  const e = extOf(f);
  if (e === 'xlsx' || e === 'xls') return 'xlsx';
  if (e === 'py') return 'py';
  return 'csv';
}

/* ---------- 讲评 ---------- */

function Review({ q, r }: { q: Question; r: ItemResult }) {
  const right = useMemo(() => rightText(q), [q]);
  return (
    <>
      {r.points.length ? (
        <div className="verdict">
          <table className="opts">
            <thead>
              <tr>
                <th>评分点</th>
                <th>运行结果</th>
                <th>得分</th>
              </tr>
            </thead>
            <tbody>
              {r.points.map((p, i) => (
                <tr key={i}>
                  <td>{p.label}</td>
                  <td>
                    <span className={p.ok ? 'tag-ok' : 'tag-bad'}>{p.ok ? '符合' : '不符'}</span> <code>{clip(p.got ?? '')}</code>
                  </td>
                  <td className="q-mark">
                    {p.score} / {p.full}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {q.topic ? (
        <p className="muted" style={{ marginTop: 9 }}>
          考点：{q.topic}
        </p>
      ) : null}
      {right ? <p className="ref-answer">正确答案：{right}</p> : null}
      {q.type === 'python' && q.answer ? (
        <>
          <p className="ref-answer">参考程序</p>
          <pre className="code-read">{q.answer}</pre>
        </>
      ) : null}
      <div className="why">
        <b>为什么这样选</b>
        <div>
          <Rich text={q.explain} />
        </div>
      </div>
    </>
  );
}

function clip(s: string) {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > 60 ? one.slice(0, 60) + '…' : one || '—';
}

function rightText(q: Question): string {
  if (q.type === 'single') return letter(q.answer);
  if (q.type === 'ip') return q.answers.map((a) => a.value).join('　');
  return '';
}
