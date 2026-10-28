/* 设置弹窗:服务商 / Key / 模型 / 开关。表单只在本机内存里,点「保存」才写 localStorage */
import { useState, type ReactNode } from 'react';
import { DEV_HINT, DEFAULTS, PROVIDERS, baseUrlError, persistSettings, threeEnabledByFlag, type ProviderId } from '../lib/settings';
import { modelsHeaders, modelsUrl, rawCall } from '../lib/api';
import { loadAllDemo } from '../lib/generate';
import { closeSettings, notify, providerOf, rememberModels, state, useVersion } from '../lib/store';
import { getBg3d } from '../three/bg3d';

interface Form {
  provider: ProviderId; baseUrl: string; apiKey: string; model: string;
  enableSearch: boolean; autoSync: boolean; timeoutSec: string; region: string;
  demo: boolean; three: boolean;
}

function initialForm(): Form {
  const s = state.settings;
  return {
    provider: PROVIDERS[s.provider] ? s.provider : 'custom',
    baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model,
    enableSearch: !!s.enableSearch, autoSync: s.autoSync !== false,
    timeoutSec: String(s.timeoutSec || 300), region: s.region || '福建省',
    demo: !!s.demo, three: threeEnabledByFlag()
  };
}

// 与旧版 readSettingsForm 一致:非法超时回退 300,地区空回退福建省,演示模式只在没有 Key 时生效。
// 返回空串表示表单已写回 state;非空是「Base URL 会把 Key 明文发出去」这类问题——此时一个字段都不写回,
// 否则被拦住的明文地址会留在内存里,后面静默同步照样会带着 Key 发出去。
function commit(f: Form): string {
  const provider: ProviderId = PROVIDERS[f.provider] ? f.provider : 'custom';
  const preset = PROVIDERS[provider];
  const baseUrl = f.baseUrl.trim() || preset.baseUrl || DEFAULTS.baseUrl;
  const bad = baseUrlError(baseUrl);
  if (bad) return bad;

  const s = state.settings;
  const t = parseInt(f.timeoutSec, 10);
  s.provider = provider;
  s.baseUrl = baseUrl;
  s.apiKey = f.apiKey.trim();
  s.model = f.model.trim() || DEFAULTS.model;
  s.enableSearch = f.enableSearch;
  s.autoSync = f.autoSync;
  s.timeoutSec = isFinite(t) && t >= 30 && t <= 900 ? t : 300;
  s.region = (f.region || '').trim() || '福建省';
  s.demo = f.demo && !s.apiKey;
  return '';
}

function Switch(props: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; text: ReactNode }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="switch__track"><span className="switch__thumb" /></span>
      <span className="switch__text">{props.text}</span>
    </label>
  );
}

export function SettingsModal() {
  useVersion();
  const [f, setF] = useState(initialForm);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [fetching, setFetching] = useState(false);

  const prov = PROVIDERS[f.provider] || PROVIDERS.custom;
  const patch = (p: Partial<Form>) => setF((prev) => ({ ...prev, ...p }));
  const pickProvider = (id: ProviderId) => {
    const next = PROVIDERS[id];
    if (next && id !== 'custom') patch({ provider: id, baseUrl: next.baseUrl, model: next.model || f.model });
    else patch({ provider: id });
  };

  const kw = query.trim().toLowerCase();
  const matches = state.models.filter((id) => !kw || id.toLowerCase().indexOf(kw) >= 0);

  function testConnection() {
    const bad = commit(f);
    if (bad) { setMsg({ kind: 'err', text: bad }); return; }
    if (!state.settings.apiKey) { setMsg({ kind: 'err', text: '请先填写 API Key。' }); return; }
    setMsg({ kind: 'ok', text: '正在测试连接…' });
    rawCall([{ role: 'user', content: '只回复两个字:在的' }], { noSearch: true, timeout: 30000 })
      .then((r) => {
        if (r.ok) { setMsg({ kind: 'ok', text: '连接成功!API 可用。' }); return; }
        let m = '失败(HTTP ' + r.status + ')';
        try {
          const j = JSON.parse(r.text) as { error?: { message?: string }; message?: string };
          m += ' · ' + (j.error?.message || j.message || '');
        } catch { m += ' · ' + r.text.slice(0, 120); }
        setMsg({ kind: 'err', text: m });
      })
      .catch(() => {
        let m = '无法连接:网络不通,或该接口不允许浏览器跨域(CORS),或服务商会拒绝预检请求。';
        if (prov.reach) m += ' ' + prov.reach;
        if (location.protocol === 'file:') m += ' ' + DEV_HINT;
        setMsg({ kind: 'err', text: m });
      });
  }

  function fetchModels() {
    const bad = commit(f);
    if (bad) { setMsg({ kind: 'err', text: bad }); return; }
    if (!state.settings.apiKey) { setMsg({ kind: 'err', text: '请先填写 API Key,才能拉取模型列表。' }); return; }
    setFetching(true);
    fetch(modelsUrl(), { headers: modelsHeaders() })
      .then((r) => r.text().then((text) => ({ ok: r.ok, status: r.status, text })))
      .then((r) => {
        setFetching(false);
        if (!r.ok) { setMsg({ kind: 'err', text: '拉取模型失败(HTTP ' + r.status + '):' + r.text.slice(0, 160) }); return; }
        let list: { id?: string }[];
        try { list = (JSON.parse(r.text) as { data?: { id?: string }[] }).data || []; }
        catch { setMsg({ kind: 'err', text: '模型接口返回不是合法 JSON。' }); return; }
        const ids = list.map((m) => m && m.id).filter(Boolean) as string[];
        if (!ids.length) { setMsg({ kind: 'err', text: '接口返回了空模型列表。请确认 Base URL 与 Key 是否属于同一服务商。' }); return; }
        rememberModels(ids);
        setMsg({ kind: 'ok', text: '已载入 ' + ids.length + ' 个可用模型(已缓存)。点击选择或搜索过滤。' });
      })
      .catch(() => {
        setFetching(false);
        let m = '无法连接模型接口:网络不通或跨域(CORS)/预检被拒。';
        if (providerOf().reach) m += ' ' + providerOf().reach;
        setMsg({ kind: 'err', text: m });
      });
  }

  function save() {
    const bad = commit(f);
    if (bad) { setMsg({ kind: 'err', text: bad }); return; }
    persistSettings(state.settings);
    closeSettings();
    state.ui.threeOn = f.three;
    getBg3d()?.setEnabled(f.three);
    if (state.settings.demo) loadAllDemo();
    else notify();
  }

  return (
    <div className="modal">
      <div className="modal__backdrop" onClick={closeSettings} />
      <div className="modal__card" role="dialog" aria-modal="true" aria-label="设置 · 大模型 API">
        <div className="modal__head">
          <h2>设置 · 大模型 API</h2>
          <button className="icon-btn" type="button" aria-label="关闭" onClick={closeSettings}>✕</button>
        </div>
        <div className="modal__body">
          <label className="field">
            <span className="field__label">服务商</span>
            <select className="input" value={f.provider} onChange={(e) => pickProvider(e.target.value as ProviderId)}>
              {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => <option key={id} value={id}>{PROVIDERS[id].label}</option>)}
            </select>
            <span className="field__hint">{prov.keyHint}{prov.reach ? ' ' + prov.reach : ''}</span>
          </label>
          <label className="field">
            <span className="field__label">API Base URL</span>
            <input className="input" type="text" spellCheck={false} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              value={f.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} />
            <span className="field__hint">{f.provider === 'custom'
              ? '填 OpenAI 兼容网关的地址(以 /v1 结尾)。应用会自动拼 /chat/completions 与 /models。'
              : prov.label + ' 的地址(切换服务商时自动填,可改)。应用会自动拼 /chat/completions(Claude 为 /messages)与 /models。'}</span>
          </label>
          <label className="field">
            <span className="field__label">API Key</span>
            <input className="input" type="password" spellCheck={false} placeholder="sk-..." autoComplete="off"
              value={f.apiKey} onChange={(e) => patch({ apiKey: e.target.value })} />
            <span className="field__hint">仅保存在你本机浏览器(localStorage),不会上传或写入任何文件。</span>
          </label>
          <label className="field">
            <span className="field__label">模型</span>
            <div className="model-row">
              <input className="input" type="text" spellCheck={false} placeholder="如 qwen3.8-flash"
                value={f.model} onChange={(e) => patch({ model: e.target.value })} />
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => { setQuery(''); setPickerOpen(true); }}>选择模型</button>
            </div>
            <span className="field__hint">可手填模型 ID,或点「选择模型」从你账号可用列表里挑(支持搜索、会缓存上次拉取结果)。</span>
          </label>
          {pickerOpen ? (
            <div className="picker">
              <div className="picker__bar">
                <input className="input input--sm" type="text" placeholder="搜索,如 qwen3 / flash / max"
                  value={query} onChange={(e) => setQuery(e.target.value)} />
                <button className="btn btn--ghost btn--sm" type="button" onClick={fetchModels}>拉取/刷新</button>
                <button className="icon-btn" type="button" aria-label="收起" onClick={() => setPickerOpen(false)}>✕</button>
              </div>
              <div className="picker__list">
                {!state.models.length
                  ? <div className="picker__empty">还没有模型列表。点右上「拉取/刷新」读取你账号可用的模型。</div>
                  : !matches.length
                    ? <div className="picker__empty">没有匹配「{query}」的模型(共 {state.models.length} 个可用)。清空搜索可查看全部。</div>
                    : matches.map((id) => (
                      <button key={id} type="button" className={'picker__item' + (id === f.model.trim() ? ' is-cur' : '')}
                        onClick={() => { patch({ model: id }); setPickerOpen(false); }}>{id}</button>
                    ))}
              </div>
              <div className="picker__foot">{fetching ? '正在拉取…'
                : state.models.length ? '共 ' + state.models.length + ' 个可用模型' + (kw ? ',匹配 ' + matches.length + ' 个' : '') + '。点击某一项即选中。'
                  : ''}</div>
            </div>
          ) : null}
          <div className="field field--row">
            <Switch checked={f.enableSearch} disabled={!prov.search} onChange={(v) => patch({ enableSearch: v })}
              text="联网搜索(enable_search)" />
            <span className="field__hint">{prov.search
              ? '开启后请求会带 enable_search:true,让千问联网检索最新信息。实时新闻必须开启。'
              : '该服务商不支持 enable_search 参数(千问专属),开关已禁用;联网能力取决于所选模型本身。'}</span>
          </div>
          <div className="field field--row">
            <Switch checked={f.autoSync} onChange={(v) => patch({ autoSync: v })} text="打开时自动后台同步当日最新" />
            <span className="field__hint">开启后每天首次打开会静默拉取最新并把新增标记为 <b>NEW</b>;上次历史始终保留。会产生 API 调用(按 token 计费)。</span>
          </div>
          <label className="field">
            <span className="field__label">请求超时(秒)</span>
            <input className="input" type="number" min={30} max={900} step={10}
              value={f.timeoutSec} onChange={(e) => patch({ timeoutSec: e.target.value })} />
            <span className="field__hint">联网聚合耗时较长,默认 300 秒。若仍超时可调大(30–900)。</span>
          </label>
          <label className="field">
            <span className="field__label">本地机会地区</span>
            <input className="input" type="text" spellCheck={false} placeholder="如 福建省 / 厦门市 / 漳州市"
              value={f.region} onChange={(e) => patch({ region: e.target.value })} />
            <span className="field__hint">商机「本地机会」类型按此地区检索当地最新 AI 政策与产业机会。默认福建省。</span>
          </label>
          <div className="field field--row">
            <Switch checked={f.demo} onChange={(v) => patch({ demo: v })} text="演示模式(不调用 API,用内置示例数据)" />
          </div>
          <div className="field field--row">
            <Switch checked={f.three} onChange={(v) => patch({ three: v })} text="3D 控制台背景(WebGL)" />
            <span className="field__hint">科幻星域背景。软件渲染 / 低帧率会自动降级为静态或关闭;若感觉卡顿可在此关掉。</span>
          </div>
          {msg ? <div className={'modal__msg is-' + msg.kind}>{msg.text}</div> : null}
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={testConnection}>测试连接</button>
          <div className="spacer" />
          <button className="btn btn--ghost" type="button" onClick={closeSettings}>取消</button>
          <button className="btn btn--primary" type="button" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  );
}
