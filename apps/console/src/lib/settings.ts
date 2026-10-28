/* 配置与本机存储:Key 只存在浏览器 localStorage,不上传、不写入任何文件。
 * storage key 沿用旧版,升级后本机已有的配置与历史数据继续可用。
 */

export const STORE_KEY = 'ai-fxb-settings-v1';
export const CACHE_KEY = 'ai-fxb-cache-v4';
export const MODELS_KEY = 'ai-fxb-models-v1';
export const USAGE_KEY = 'ai-fxb-usage-v1';
export const THREE_KEY = 'ai-fxb-3d';

// 管理入口:URL 带 admit=true 才显示设置按钮与模型/token 芯片;普通访客只看公开数据,不见配置入口
export const ADMIT = /[?&]admit=true/.test(location.search);

export type ProviderId = 'qwen' | 'deepseek' | 'openai' | 'anthropic' | 'custom';

export interface Provider {
  label: string;
  baseUrl: string;
  model: string;
  format: 'openai' | 'anthropic';
  search: boolean;
  keyHint: string;
  reach: string;
}

// 服务商预设:换 Key 来源不用改代码。
// format=openai 走 /chat/completions + Bearer;format=anthropic 走 /messages + x-api-key(需带浏览器直连头)。
// reach 是实测结论:deepseek/qwen 从国内网络预检通过;openai 直连超时、anthropic 返回 403 地区限制,这两家需可出海的网络。
export const PROVIDERS: Record<ProviderId, Provider> = {
  qwen: {
    label: '千问 · 阿里云百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-flash',
    format: 'openai',
    search: true,
    keyHint: 'Key 在 bailian.console.aliyun.com → API-KEY 管理创建,sk- 开头。',
    reach: '国内网络可直连。'
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    format: 'openai',
    search: false,
    keyHint: 'Key 在 platform.deepseek.com → API Keys 创建,sk- 开头。',
    reach: '国内网络可直连(跨域预检已实测通过)。'
  },
  openai: {
    label: 'OpenAI · GPT',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    format: 'openai',
    search: false,
    keyHint: 'Key 在 platform.openai.com → API keys 创建,sk- 开头。',
    reach: '注意:国内网络通常连不上 api.openai.com(实测超时),需可出海的网络环境。'
  },
  anthropic: {
    label: 'Claude · Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5',
    format: 'anthropic',
    search: false,
    keyHint: 'Key 在 console.anthropic.com → Settings → API Keys 创建,sk-ant- 开头。',
    reach: '注意:Anthropic 对部分地区直接返回 403(实测),需受支持的网络环境。'
  },
  custom: {
    label: '自定义(OpenAI 兼容)',
    baseUrl: '',
    model: '',
    format: 'openai',
    search: false,
    keyHint: '任何 OpenAI 兼容网关(one-api / new-api / vLLM / Ollama 等)填它的 /v1 地址与对应 Key。',
    reach: ''
  }
};

export interface Settings {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  enableSearch: boolean;
  timeoutSec: number;
  autoSync: boolean;
  region: string;
  demo: boolean;
}

export const DEFAULTS: Settings = {
  provider: 'qwen',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: '',
  model: 'qwen3.8-flash',
  enableSearch: true,
  timeoutSec: 300,
  autoSync: true,
  region: '福建省',
  demo: false
};

export interface Usage {
  total: number;
  silent: number;
  calls: number;
  silentCalls: number;
  day: string;
  dayTotal: number;
  daySilent: number;
}

export function blankUsage(): Usage {
  return { total: 0, silent: 0, calls: 0, silentCalls: 0, day: '', dayTotal: 0, daySilent: 0 };
}

// 实测过的本地开发地址:报错提示里要指对,否则用户照着提示找不到出口
export const DEV_HINT = '请以 http://127.0.0.1:5178/ai-fxb/ 访问本地开发服务器(vite)。';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 隐私模式写不进:不影响本次浏览 */ }
}

export function providerIdOf(baseUrl: string): ProviderId {
  const bu = (baseUrl || '').replace(/\/+$/, '');
  for (const k of Object.keys(PROVIDERS) as ProviderId[]) {
    const p = PROVIDERS[k];
    if (p.baseUrl && bu && bu === p.baseUrl.replace(/\/+$/, '')) return k;
  }
  return 'custom';
}

// Key 放在请求头里发给这个地址：走明文 http 时，链路上任何抓包/代理都能直接读走。
// 只有本机回环例外（流量不出网卡）。返回空串表示可用。
export function baseUrlError(u: string): string {
  let parsed: URL;
  try { parsed = new URL(u); } catch { return 'Base URL 不是合法地址，请填完整接口前缀，例如 https://dashscope.aliyuncs.com/compatible-mode/v1。'; }
  if (parsed.protocol === 'https:') return '';
  if (parsed.protocol === 'http:' && /^(127\.0\.0\.1|localhost|::1)$/.test(parsed.hostname)) return '';
  return 'Base URL 必须用 https://（本机网关可用 http://127.0.0.1 或 http://localhost）。' +
    'API Key 是放在请求头里发给这个地址的，明文 http 链路上任何抓包或中间代理都能原样读到它。';
}

export function loadSettings(): Settings {
  const raw = readJson<Partial<Settings>>(STORE_KEY);
  if (!raw) return { ...DEFAULTS };
  // 旧存档没有 provider 字段:不能信合并后的默认值,要按已保存的 Base URL 反推
  const hasProvider = typeof raw.provider === 'string' && !!PROVIDERS[raw.provider as ProviderId];
  const s: Settings = { ...DEFAULTS, ...raw } as Settings;
  if (!hasProvider) s.provider = providerIdOf(s.baseUrl);
  return s;
}

export function persistSettings(s: Settings): void { writeJson(STORE_KEY, s); }

export function loadUsage(): Usage {
  const raw = readJson<Partial<Usage>>(USAGE_KEY);
  return raw ? { ...blankUsage(), ...raw } as Usage : blankUsage();
}
export function persistUsage(u: Usage): void { writeJson(USAGE_KEY, u); }

export function loadModelsCache(): string[] {
  const j = readJson<{ ids?: unknown }>(MODELS_KEY);
  return j && Array.isArray(j.ids) ? (j.ids as string[]).filter((x) => typeof x === 'string') : [];
}
export function saveModelsCache(ids: string[]): void { writeJson(MODELS_KEY, { ids, at: Date.now() }); }

export function threeEnabledByFlag(): boolean {
  try { return localStorage.getItem(THREE_KEY) !== 'off'; } catch { return true; }
}
export function setThreeFlag(on: boolean): void {
  try { localStorage.setItem(THREE_KEY, on ? 'on' : 'off'); } catch { /* 同上 */ }
}
