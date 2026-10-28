/* 浏览器直连大模型 API:两种报文格式(OpenAI 兼容 / Anthropic)+ 可判断的报错分类。
 * 每条错误都写清"原因 + 该改哪里",并把原始响应留给「查看原始报错」。
 */
import type { Message } from '@ai-fxb/core';
import { DEV_HINT, PROVIDERS, baseUrlError } from './settings';
import { providerOf, recordUsage, state } from './store';

export interface CallOpts {
  silent?: boolean;
  noSearch?: boolean;
  timeout?: number;
}

export interface RawResult { ok: boolean; status: number; text: string }

export class ApiError extends Error {
  kind: 'http' | 'parse' | 'empty' | 'network';
  meta: string;
  detail: string;

  constructor(message: string, kind: ApiError['kind'], meta = '', detail = '') {
    super(message);
    this.kind = kind;
    this.meta = meta;
    this.detail = detail;
  }
}

function headers(): Record<string, string> {
  const prov = providerOf();
  if (prov.format === 'anthropic') {
    // Anthropic 不走 Bearer:用 x-api-key,且浏览器直连必须显式声明,否则被 CORS 拦
    return {
      'Content-Type': 'application/json',
      'x-api-key': state.settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
  }
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.settings.apiKey };
}

export function modelsUrl(): string {
  return state.settings.baseUrl.replace(/\/+$/, '') + '/models';
}

// 拉取模型列表只要鉴权头(GET 无 body,带 Content-Type 反而会多出一次预检)
export function modelsHeaders(): Record<string, string> {
  const prov = providerOf();
  if (prov.format === 'anthropic') {
    return {
      'x-api-key': state.settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
  }
  return { 'Authorization': 'Bearer ' + state.settings.apiKey };
}

export function rawCall(messages: Message[], opts?: CallOpts): Promise<RawResult> {
  const prov = providerOf();
  const s = state.settings;
  // 表单以外的入口(旧 localStorage 配置、静默同步)也不能把 Key 发进明文链路
  const bad = baseUrlError(s.baseUrl);
  if (bad) return Promise.reject(new ApiError(bad, 'network', 'Base URL ' + s.baseUrl, ''));
  const base = s.baseUrl.replace(/\/+$/, '');
  const url = (prov.format === 'anthropic' ? base + '/messages' : base + '/chat/completions');
  let body: Record<string, unknown>;
  if (prov.format === 'anthropic') {
    const sys = messages.filter((m) => m.role === 'system');
    const chat = messages.filter((m) => m.role !== 'system');
    body = { model: s.model, max_tokens: 16000, temperature: 0.4, messages: chat };
    if (sys.length) body.system = sys.map((m) => m.content).join('\n\n');
  } else {
    body = { model: s.model, messages, temperature: 0.4, stream: false };
    if (prov.search && s.enableSearch && !(opts && opts.noSearch)) body.enable_search = true;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (opts && opts.timeout) || ((s.timeoutSec || 300) * 1000));
  return fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: ctrl.signal })
    .then((res) => res.text().then((text) => ({ ok: res.ok, status: res.status, text })))
    .finally(() => clearTimeout(timer));
}

export function callAPI(messages: Message[], opts?: CallOpts): Promise<string> {
  const model = state.settings.model;
  const prov = providerOf();
  return rawCall(messages).then((r) => {
    if (!r.ok) {
      const raw = r.text || '';
      let providerMsg = '';
      try {
        const j0 = JSON.parse(raw);
        providerMsg = (j0.error && j0.error.message) || j0.message || '';
      } catch { providerMsg = raw.slice(0, 300); }
      const low = (raw + ' ' + providerMsg).toLowerCase();
      let msg: string;
      if (r.status === 401 || r.status === 403) {
        msg = 'API Key 无效或无权限。请在「设置」里检查 Key 是否正确、是否过期。';
        if (prov === PROVIDERS.anthropic && r.status === 403) msg += ' Anthropic 对当前网络地区可能直接拒绝(403),需受支持的网络环境。';
        if (prov === PROVIDERS.openai) msg += ' 另确认当前网络能直连 api.openai.com。';
      } else if (r.status === 429) {
        msg = '触发限流或额度不足。请检查账户余额,或稍后重试。';
      } else if (r.status === 404 || /model[^.]{0,40}(not found|does not exist|not exist)|invalid.{0,20}model|model.{0,20}invalid|unknown model/.test(low)) {
        msg = '模型不存在或未开通:「' + model + '」。请点「选择模型」从可用列表里选准确 ID。';
      } else if (/enable_search|search_options|does not support.{0,20}search/.test(low)) {
        msg = '当前模型不支持联网搜索(enable_search)。请在「设置」关闭「联网搜索」或换模型。';
      } else {
        msg = 'API 调用失败(HTTP ' + r.status + ')。展开「查看原始报错」可看到具体原因。';
      }
      throw new ApiError(msg, 'http', '模型 ' + model + ' · HTTP ' + r.status, providerMsg || raw.slice(0, 500));
    }
    let j: any;
    try { j = JSON.parse(r.text); } catch {
      throw new ApiError('返回内容不是合法 JSON,无法解析。可能是模型没有按要求只输出 JSON。', 'parse', '模型 ' + model, (r.text || '').slice(0, 300));
    }
    const content: string | undefined = prov.format === 'anthropic'
      ? (j.content || []).map((c: { text?: string }) => c.text || '').join('')
      : j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!content) throw new ApiError('API 未返回内容(choices 为空)。', 'empty', '模型 ' + model, (r.text || '').slice(0, 300));
    recordUsage(j.usage, !!(opts && opts.silent));
    return content;
  }, (e: unknown) => {
    if (e instanceof ApiError) throw e;
    const err = e as { name?: string; message?: string };
    let hint = '无法连接到 API。可能是网络问题,或该接口不允许浏览器跨域(CORS)。';
    if (prov.reach) hint += ' ' + prov.reach;
    if (location.protocol === 'file:') hint += ' 你正以 file:// 打开,' + DEV_HINT;
    if (err && err.name === 'AbortError') {
      hint = '请求超过 ' + (state.settings.timeoutSec || 300) + ' 秒未完成,已中止。可:调小时间维度/条数、调大「请求超时」、或换更快模型。';
    }
    throw new ApiError(hint, 'network', '模型 ' + state.settings.model + ' · 网络/跨域', (err && err.message) || '');
  });
}

// 网络类失败统一带上实测过的服务商提示,避免只说"连不上"
export function withProviderHint(message: string): string {
  const prov = providerOf();
  return prov.reach ? message + ' ' + prov.reach : message;
}
