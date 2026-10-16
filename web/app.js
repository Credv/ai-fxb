/* AI 风向标 · 纯本地个人工具
 * 浏览器直连你配置的大模型 API(默认阿里云百炼 / 千问,OpenAI 兼容)。
 * 无后端:API Key 只存在本机浏览器 localStorage,不会上传或写入文件。
 * 新闻与商机分开生成,单次请求更小、更易在超时内跑通;新闻可按 1/3/5/7 天缩量。
 */
(function () {
  'use strict';

  // 提示词/归一化/合并逻辑与 Node 快照脚本共用,见 core.js
  var core = (typeof AiFxbCore !== 'undefined') ? AiFxbCore : (typeof window !== 'undefined' && window.AiFxbCore);
  if (!core) throw new Error('core.js 未加载:请先引入 ./core.js 再引入 ./app.js。');

  var STORE_KEY = 'ai-fxb-settings-v1';
  var CACHE_KEY = 'ai-fxb-cache-v4';
  // 管理入口:URL 带 admit=true 才显示设置按钮与模型/token 芯片;普通访客只看公开快照,不见配置入口
  var ADMIT = /[?&]admit=true/.test(location.search);
  var MODELS_KEY = 'ai-fxb-models-v1';
  var USAGE_KEY = 'ai-fxb-usage-v1';

  var DEFAULTS = {
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

  // 服务商预设:换 Key 来源不用改代码。Key 只存本机 localStorage。
  // format=openai 走 /chat/completions + Bearer;format=anthropic 走 /messages + x-api-key(需带浏览器直连头)。
  // reach 是实测结论:deepseek/qwen 从国内网络预检通过;openai 直连超时、anthropic 返回 403 地区限制,这两家需可出海的网络。
  var PROVIDERS = {
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
  function providerOf(settings) {
    var s = settings || state.settings;
    var p = PROVIDERS[s.provider];
    if (p) return p;
    var bu = (s.baseUrl || '').replace(/\/+$/, '');
    for (var k in PROVIDERS) {
      if (PROVIDERS[k].baseUrl && bu && bu === PROVIDERS[k].baseUrl.replace(/\/+$/, '')) return PROVIDERS[k];
    }
    return PROVIDERS.custom;
  }

  var RANGES = core.RANGES;
  var TECH_RANGES = core.TECH_RANGES;
  var NEWS_CATS = ['全部', '模型发布', '融资并购', '政策监管', '产品应用', '研究突破', '行业动态'];
  var REGIONS = ['全部', '全球', '中国', '美国', '欧洲', '其他'];
  var IMPS = ['全部', '重大', '一般'];
  var OPS_TIMES = ['全部', '本周', '本月'];
  var OPS_ORIGINS = ['全部', '政策规划', '市场商机', '本地机会'];
  // 赛道固定枚举:与 core 提示词共用一份
  var OPS_TRACKS = core.OPS_TRACKS;
  var RANK_TRACKS = core.RANK_TRACKS;
  var OPS_MODES = {
    ai: { label: 'AI 赛道商机', origin: '市场商机' },
    policy: { label: '国家政策支持', origin: '政策规划' },
    local: { label: '本地机会', origin: '本地机会' }
  };
  var OPS_MODE_ORDER = ['ai', 'policy', 'local'];

  function blankBucket() {
    return { status: 'idle', items: [], generated_at: '', fetched_at: 0, range: 0, syncing: false, newCount: 0, tabNew: 0, loadingMode: null, loadError: '', loadErrorDetail: '', loadErrorMode: '', error: '', errorMeta: '', errorDetail: '' };
  }

  var state = {
    settings: loadSettings(),
    models: loadModelsCache(),
    view: 'sum',
    newsRange: 3,
    sumRange: 3,
    techRange: 30,
    opsMode: 'ai',
    news: blankBucket(),
    ops: blankBucket(),
    sum: blankBucket(),
    tech: blankBucket(),
    rank: blankBucket(),
    usage: loadUsage(),
    snapshot: null,      // 公开快照元信息 { ts, model, at }:未配置 Key 的访客看站长每日生成的数据
    snapshotError: '',
    filters: { newsCat: '全部', newsRegion: '全部', newsImp: '全部', opsTime: '全部', opsTrack: '全部', opsOrigin: '全部', techTrack: '全部', rankTrack: '全部', netRoute: 'all' }
  };

  // ---------- 工具 ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var pad = core.pad;
  var fmtDate = core.fmtDate;
  function fmtTime(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtDateTime(ts) { return fmtDate(new Date(ts)) + ' ' + fmtTime(ts); }
  function loadSettings() {
    var s, hasProvider = false;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      var parsed = JSON.parse(raw) || {};
      // 旧存档没有 provider 字段:不能信合并后的默认值,要按已保存的 Base URL 反推
      hasProvider = typeof parsed.provider === 'string' && !!PROVIDERS[parsed.provider];
      s = Object.assign({}, DEFAULTS, parsed);
    } catch (e) { s = Object.assign({}, DEFAULTS); }
    if (!hasProvider) {
      var bu = (s.baseUrl || '').replace(/\/+$/, '');
      s.provider = 'custom';
      for (var k in PROVIDERS) {
        if (PROVIDERS[k].baseUrl && bu && bu === PROVIDERS[k].baseUrl.replace(/\/+$/, '')) { s.provider = k; break; }
      }
    }
    return s;
  }
  function persistSettings() {
    var s = Object.assign({}, state.settings);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function loadCache() {
    try { var raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ news: state.news, ops: state.ops, sum: state.sum, tech: state.tech, rank: state.rank, snap: state.snapshot }));
    } catch (e) {}
  }
  function loadModelsCache() {
    try { var raw = localStorage.getItem(MODELS_KEY); var j = raw ? JSON.parse(raw) : null; return (j && Array.isArray(j.ids)) ? j.ids : []; } catch (e) { return []; }
  }
  function saveModelsCache(ids) {
    try { localStorage.setItem(MODELS_KEY, JSON.stringify({ ids: ids, at: Date.now() })); } catch (e) {}
  }
  // ---------- token 消耗统计(区分静默同步 / 手动) ----------
  function blankUsage() { return { total: 0, silent: 0, calls: 0, silentCalls: 0, day: '', dayTotal: 0, daySilent: 0 }; }
  function loadUsage() {
    try {
      var raw = localStorage.getItem(USAGE_KEY);
      if (!raw) return blankUsage();
      return Object.assign(blankUsage(), JSON.parse(raw));
    } catch (e) { return blankUsage(); }
  }
  function saveUsage() {
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(state.usage)); } catch (e) {}
  }
  function recordUsage(usage, silent) {
    if (!usage || typeof usage.total_tokens !== 'number') return;
    var u = state.usage, t = usage.total_tokens, today = todayStr();
    if (u.day !== today) { u.day = today; u.dayTotal = 0; u.daySilent = 0; }
    u.total += t; u.calls += 1; u.dayTotal += t;
    if (silent) { u.silent += t; u.silentCalls += 1; u.daySilent += t; }
    saveUsage();
  }
  function configured() {
    var s = state.settings;
    return !s.demo && !!s.apiKey && !!s.baseUrl && !!s.model;
  }

  // ---------- 数据层:稳定 id + 历史保留 + NEW 判定(实现见 core.js) ----------
  var todayStr = core.todayStr;
  var itemId = core.itemId;
  var mergeBucketItems = core.mergeBucketItems;
  var stampExisting = core.stampExisting;
  var countNew = core.countNew;

  // ---------- 提示词与归一化(实现见 core.js,与快照脚本共用) ----------
  var buildNewsMessages = core.buildNewsMessages;
  var buildSumMessages = core.buildSumMessages;
  var buildTechMessages = core.buildTechMessages;
  var buildRankMessages = core.buildRankMessages;
  var extractJSON = core.extractJSON;
  var normalizeNews = core.normalizeNews;
  var normalizeSum = core.normalizeSum;
  var normalizeTech = core.normalizeTech;
  var normalizeOps = core.normalizeOps;
  var normalizeRank = core.normalizeRank;
  function buildOpsMessages(mode) { return core.buildOpsMessages(mode, state.settings.region); }

  // ---------- API ----------
  function apiUrl() {
    var base = state.settings.baseUrl.replace(/\/+$/, '');
    return providerOf().format === 'anthropic' ? base + '/messages' : base + '/chat/completions';
  }
  function rawCall(messages, opts) {
    var s = state.settings;
    var prov = providerOf();
    var headers = { 'Content-Type': 'application/json' };
    var body;
    if (prov.format === 'anthropic') {
      // Anthropic 不走 Bearer:用 x-api-key,且浏览器直连必须显式声明,否则被 CORS 拦
      headers['x-api-key'] = s.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      var sys = [], chat = [];
      messages.forEach(function (m) { (m.role === 'system' ? sys : chat).push(m); });
      body = { model: s.model, max_tokens: 16000, temperature: 0.4, messages: chat };
      if (sys.length) body.system = sys.map(function (m) { return m.content; }).join('\n\n');
    } else {
      headers['Authorization'] = 'Bearer ' + s.apiKey;
      body = { model: s.model, messages: messages, temperature: 0.4, stream: false };
      if (prov.search && s.enableSearch && !(opts && opts.noSearch)) body.enable_search = true;
    }
    var ctrl = new AbortController();
    var limitMs = (opts && opts.timeout) || ((s.timeoutSec || 300) * 1000);
    var timer = setTimeout(function () { ctrl.abort(); }, limitMs);
    return fetch(apiUrl(), {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: ctrl.signal
    }).then(function (res) {
      return res.text().then(function (text) { return { ok: res.ok, status: res.status, text: text }; });
    }).finally(function () { clearTimeout(timer); });
  }
  function callAPI(messages, opts) {
    return rawCall(messages).then(function (r) {
      var model = state.settings.model;
      var prov = providerOf();
      if (!r.ok) {
        var raw = r.text || '';
        var provider = '';
        try { var j0 = JSON.parse(raw); provider = (j0.error && j0.error.message) || j0.message || ''; } catch (e) { provider = raw.slice(0, 300); }
        var low = (raw + ' ' + provider).toLowerCase();
        var msg;
        if (r.status === 401 || r.status === 403) {
          msg = 'API Key 无效或无权限。请在「设置」里检查 Key 是否正确、是否过期。';
          if (prov === PROVIDERS.anthropic && r.status === 403) msg += ' Anthropic 对当前网络地区可能直接拒绝(403),需受支持的网络环境。';
          if (prov === PROVIDERS.openai) msg += ' 另确认当前网络能直连 api.openai.com。';
        }
        else if (r.status === 429) msg = '触发限流或额度不足。请检查账户余额,或稍后重试。';
        else if (r.status === 404 || /model[^.]{0,40}(not found|does not exist|not exist)|invalid.{0,20}model|model.{0,20}invalid|unknown model/.test(low)) msg = '模型不存在或未开通:「' + model + '」。请点「选择模型」从可用列表里选准确 ID。';
        else if (/enable_search|search_options|does not support.{0,20}search/.test(low)) msg = '当前模型不支持联网搜索(enable_search)。请在「设置」关闭「联网搜索」或换模型。';
        else msg = 'API 调用失败(HTTP ' + r.status + ')。展开「查看原始报错」可看到具体原因。';
        var err = new Error(msg); err.kind = 'http'; err.meta = '模型 ' + model + ' · HTTP ' + r.status; err.detail = provider || raw.slice(0, 500);
        throw err;
      }
      var j;
      try { j = JSON.parse(r.text); } catch (e) {
        var e1 = new Error('返回内容不是合法 JSON,无法解析。可能是模型没有按要求只输出 JSON。');
        e1.kind = 'parse'; e1.meta = '模型 ' + model; e1.detail = (r.text || '').slice(0, 300); throw e1;
      }
      var content;
      if (prov.format === 'anthropic') {
        content = (j.content || []).map(function (c) { return c.text || ''; }).join('');
      } else {
        content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      }
      if (!content) {
        var e2 = new Error('API 未返回内容(choices 为空)。');
        e2.kind = 'empty'; e2.meta = '模型 ' + model; e2.detail = (r.text || '').slice(0, 300); throw e2;
      }
      recordUsage(j.usage, !!(opts && opts.silent));
      return content;
    }, function (e) {
      if (e && e.kind) throw e;
      var prov = providerOf();
      var hint = '无法连接到 API。可能是网络问题,或该接口不允许浏览器跨域(CORS)。';
      if (prov.reach) hint += ' ' + prov.reach;
      if (location.protocol === 'file:') hint += ' 你正以 file:// 打开,请改用本地服务器:运行 node server.mjs 后打开 http://127.0.0.1:5178。';
      if (e && e.name === 'AbortError') hint = '请求超过 ' + (state.settings.timeoutSec || 300) + ' 秒未完成,已中止。可:调小时间维度/条数、调大「请求超时」、或换更快模型。';
      var err = new Error(hint); err.kind = 'network'; err.meta = '模型 ' + state.settings.model + ' · 网络/跨域'; err.detail = (e && e.message) || '';
      throw err;
    });
  }

  // ---------- 生成(分块) ----------
  function failBucket(bucket, err) {
    bucket.status = 'error';
    bucket.error = (err && err.message) || String(err);
    bucket.errorMeta = (err && err.meta) || '';
    bucket.errorDetail = (err && err.detail) || '';
  }
  function guardConfig(bucket) {
    if (state.settings.demo) return false;
    if (!configured()) {
      bucket.status = 'error';
      bucket.error = !ADMIT
        ? '访客模式:当前展示站长每日更新的公开快照,不提供实时生成。'
        : (state.snapshot
          ? '当前浏览的是站长每日更新的公开快照;如需自己实时生成,请在「设置」配置你自己的 API Key。'
          : '还没有配置大模型 API。请先在「设置」里填写 Base URL、API Key 和模型。');
      bucket.errorMeta = ''; bucket.errorDetail = '';
      render();
      if (ADMIT) openSettings();
      return true;
    }
    return false;
  }
  function isStale(b) {
    if (!b) return false;
    if (!b.fetched_at) return true;
    return fmtDate(new Date(b.fetched_at)) !== todayStr();
  }
  function generateNews(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var b = state.news;
    if (b.status === 'loading' || b.syncing) return;
    if (state.settings.demo) { if (!silent) loadDemoNews(); return; }
    if (!configured()) { if (!silent) guardConfig(b); return; }
    var hasItems = !!(b.items && b.items.length);
    b.range = state.newsRange;
    if (silent && hasItems) { b.syncing = true; } else { b.status = 'loading'; b.syncing = false; }
    b.error = ''; b.errorMeta = ''; b.errorDetail = ''; b.loadError = ''; b.loadErrorDetail = '';
    render();
    callAPI(buildNewsMessages(state.newsRange), { silent: silent }).then(function (content) {
      var p = normalizeNews(extractJSON(content));
      var merged = mergeBucketItems('news', b.items, p.items);
      b.items = merged; b.status = 'ready'; b.syncing = false;
      b.generated_at = p.generated_at; b.fetched_at = Date.now(); b.newCount = countNew(merged); b.tabNew = countNew(merged);
      saveCache(); render();
    }).catch(function (err) {
      b.syncing = false;
      if (hasItems) { b.loadError = (err && err.message) || String(err); b.loadErrorDetail = (err && err.detail) || ''; }
      else failBucket(b, err);
      render();
    });
  }
  function generateOps(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var b = state.ops;
    if (b.loadingMode || b.status === 'loading' || b.syncing) return;
    if (state.settings.demo) { if (!silent) loadDemoOps(); return; }
    if (!configured()) { if (!silent) guardConfig(b); return; }
    var mode = state.opsMode === 'policy' ? 'policy' : (state.opsMode === 'local' ? 'local' : 'ai');
    var genOrigin = OPS_MODES[mode].origin;
    var hasItems = !!(b.items && b.items.length);
    if (silent && hasItems) { b.syncing = mode; } else { b.loadingMode = mode; }
    if (!hasItems) { b.status = 'loading'; }
    b.loadError = ''; b.loadErrorDetail = ''; b.error = ''; b.errorMeta = ''; b.errorDetail = '';
    render();
    callAPI(buildOpsMessages(mode), { silent: silent }).then(function (content) {
      var p = normalizeOps(extractJSON(content));
      p.items.forEach(function (it) {
        it.origin = genOrigin;
        if (mode === 'ai') { it.level = ''; it.region = ''; it.policy = ''; }
      });
      var oldSame = (b.items || []).filter(function (it) { return it.origin === genOrigin; });
      var oldOther = (b.items || []).filter(function (it) { return it.origin !== genOrigin; });
      var mergedSame = mergeBucketItems('ops', oldSame, p.items);
      b.items = mergedSame.concat(stampExisting('ops', oldOther));
      b.status = 'ready'; b.generated_at = p.generated_at; b.fetched_at = Date.now(); b.range = 0;
      b.loadingMode = null; b.syncing = false; b.loadError = ''; b.loadErrorDetail = ''; b.loadErrorMode = '';
      b.newCount = countNew(b.items); b.tabNew = countNew(b.items);
      saveCache(); render();
    }).catch(function (err) {
      b.loadingMode = null; b.syncing = false;
      if (hasItems) {
        b.loadError = (err && err.message) || String(err);
        b.loadErrorDetail = (err && err.detail) || '';
        b.loadErrorMode = mode;
      } else { failBucket(b, err); }
      render();
    });
  }
  function loadDemoNews() {
    var d = demoData();
    state.news = { status: 'ready', items: stampExisting('news', d.news), generated_at: fmtDate(new Date()), fetched_at: Date.now(), range: state.newsRange, error: '', errorMeta: '', errorDetail: '' };
    render();
  }
  function loadDemoOps() {
    var d = demoData();
    state.ops = { status: 'ready', items: stampExisting('ops', d.opportunities), generated_at: fmtDate(new Date()), fetched_at: Date.now(), range: 0, loadingMode: null, loadError: '', error: '', errorMeta: '', errorDetail: '' };
    render();
  }
  function generateSum(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var b = state.sum;
    if (b.status === 'loading' || b.syncing) return;
    if (state.settings.demo) { if (!silent) loadDemoSum(); return; }
    if (!configured()) { if (!silent) guardConfig(b); return; }
    var hasItems = !!(b.items && b.items.length);
    b.range = state.sumRange;
    if (silent && hasItems) { b.syncing = true; } else { b.status = 'loading'; b.syncing = false; }
    b.error = ''; b.errorMeta = ''; b.errorDetail = ''; b.loadError = ''; b.loadErrorDetail = '';
    render();
    callAPI(buildSumMessages(state.sumRange), { silent: silent }).then(function (content) {
      var p = normalizeSum(extractJSON(content));
      var merged = mergeBucketItems('sum', b.items, p.items);
      b.items = merged; b.overview = p.overview || b.overview || '';
      b.status = 'ready'; b.syncing = false;
      b.generated_at = p.generated_at; b.fetched_at = Date.now(); b.newCount = countNew(merged); b.tabNew = countNew(merged);
      saveCache(); render();
    }).catch(function (err) {
      b.syncing = false;
      if (hasItems) { b.loadError = (err && err.message) || String(err); b.loadErrorDetail = (err && err.detail) || ''; }
      else failBucket(b, err);
      render();
    });
  }
  function loadDemoSum() {
    var d = demoData();
    state.sum = { status: 'ready', items: stampExisting('sum', d.highlights), overview: d.overview, generated_at: fmtDate(new Date()), fetched_at: Date.now(), range: state.sumRange, error: '', errorMeta: '', errorDetail: '' };
    render();
  }
  function generateTech(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var b = state.tech;
    if (b.status === 'loading' || b.syncing) return;
    if (state.settings.demo) { if (!silent) loadDemoTech(); return; }
    if (!configured()) { if (!silent) guardConfig(b); return; }
    var hasItems = !!(b.items && b.items.length);
    b.range = state.techRange;
    if (silent && hasItems) { b.syncing = true; } else { b.status = 'loading'; b.syncing = false; }
    b.error = ''; b.errorMeta = ''; b.errorDetail = ''; b.loadError = ''; b.loadErrorDetail = '';
    render();
    callAPI(buildTechMessages(state.techRange), { silent: silent }).then(function (content) {
      var p = normalizeTech(extractJSON(content));
      var merged = mergeBucketItems('tech', b.items, p.items);
      b.items = merged; b.status = 'ready'; b.syncing = false;
      b.generated_at = p.generated_at; b.fetched_at = Date.now(); b.newCount = countNew(merged); b.tabNew = countNew(merged);
      saveCache(); render();
    }).catch(function (err) {
      b.syncing = false;
      if (hasItems) { b.loadError = (err && err.message) || String(err); b.loadErrorDetail = (err && err.detail) || ''; }
      else failBucket(b, err);
      render();
    });
  }
  function loadDemoTech() {
    var d = demoData();
    state.tech = { status: 'ready', items: stampExisting('tech', d.tech), generated_at: fmtDate(new Date()), fetched_at: Date.now(), range: state.techRange, error: '', errorMeta: '', errorDetail: '' };
    render();
  }
  function generateRank(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var b = state.rank;
    if (b.status === 'loading' || b.syncing) return;
    if (state.settings.demo) { if (!silent) loadDemoRank(); return; }
    if (!configured()) { if (!silent) guardConfig(b); return; }
    var hasItems = !!(b.items && b.items.length);
    if (silent && hasItems) { b.syncing = true; } else { b.status = 'loading'; b.syncing = false; }
    b.error = ''; b.errorMeta = ''; b.errorDetail = ''; b.loadError = ''; b.loadErrorDetail = '';
    render();
    callAPI(buildRankMessages(), { silent: silent }).then(function (content) {
      var p = normalizeRank(extractJSON(content));
      var prevIds = {};
      (b.items || []).forEach(function (it) { if (it && it.id) prevIds[it.id] = 1; });
      var items = stampExisting('rank', p.items);
      items.forEach(function (it) { it.isNew = !prevIds[it.id]; });
      b.items = items; b.overview = p.overview || '';
      b.status = 'ready'; b.syncing = false;
      b.generated_at = p.generated_at; b.fetched_at = Date.now(); b.newCount = countNew(items); b.tabNew = countNew(items);
      saveCache(); render();
    }).catch(function (err) {
      b.syncing = false;
      if (hasItems) { b.loadError = (err && err.message) || String(err); b.loadErrorDetail = (err && err.detail) || ''; }
      else failBucket(b, err);
      render();
    });
  }
  function loadDemoRank() {
    var d = demoData();
    state.rank = { status: 'ready', items: stampExisting('rank', d.ranks), overview: d.rankOverview, generated_at: fmtDate(new Date()), fetched_at: Date.now(), range: 0, error: '', errorMeta: '', errorDetail: '' };
    render();
  }

  // ---------- 生成二次确认弹窗 ----------
  // 生成按钮不再直接发请求:点击后弹出确认框,在框内选范围/类型,点「确认生成」才真正发起。
  var GEN_KINDS = {
    news: { title: '生成 · AI 大事件', opt: 'range', run: function () { generateNews(); } },
    sum: { title: '生成 · AI 汇总', opt: 'range', run: function () { generateSum(); } },
    tech: { title: '生成 · 前沿技术', opt: 'techrange', run: function () { generateTech(); } },
    rank: { title: '生成 · 模型排行', opt: 'none', run: function () { generateRank(); } },
    ops: { title: '生成 · 商机雷达', opt: 'mode', run: function () { generateOps(); } }
  };
  var genSel = { kind: null, range: 3, techRange: 30, mode: 'ai' };

  function genModalHtml() {
    var def = GEN_KINDS[genSel.kind], out = '';
    if (def.opt === 'none') {
      out += '<div class="gen-opt"><span class="gen-opt__label">生成范围</span><p class="gen-note">综合总榜 + 5 个细分赛道榜(逻辑推理 / 代码编程 / 视频生成 / 图像生成 / 语音多模态),一次请求完成。</p></div>';
    } else if (def.opt === 'range') {
      out += '<div class="gen-opt"><span class="gen-opt__label">时间范围(过去 N 天)</span><div class="chips">' +
        RANGES.map(function (r) {
          return '<button class="chip' + (r === genSel.range ? ' is-on' : '') + '" type="button" data-genrange="' + r + '">' + r + ' 天</button>';
        }).join('') + '</div></div>';
    } else if (def.opt === 'techrange') {
      out += '<div class="gen-opt"><span class="gen-opt__label">时间范围(过去 N 天)</span><div class="chips">' +
        TECH_RANGES.map(function (r) {
          return '<button class="chip' + (r === genSel.techRange ? ' is-on' : '') + '" type="button" data-gentechrange="' + r + '">' + r + ' 天</button>';
        }).join('') + '</div></div>';
    } else if (def.opt === 'mode') {
      out += '<div class="gen-opt"><span class="gen-opt__label">商机类型(分别生成、结果融合)</span><div class="chips">' +
        OPS_MODE_ORDER.map(function (m) {
          return '<button class="chip' + (m === genSel.mode ? ' is-on' : '') + '" type="button" data-genmode="' + m + '">' + esc(OPS_MODES[m].label) + '</button>';
        }).join('') + '</div></div>';
    }
    return out;
  }
  function genNote() {
    if (state.settings.demo) return '演示模式:不会调用 API,确认后直接载入内置示例数据。';
    if (!configured()) return '尚未配置 API:确认后会先打开「设置」让你填写。';
    var scope;
    if (genSel.kind === 'news' || genSel.kind === 'sum') scope = '范围 ' + genSel.range + ' 天';
    else if (genSel.kind === 'tech') scope = '范围 ' + genSel.techRange + ' 天';
    else if (genSel.kind === 'rank') scope = '综合总榜 + 6 个细分赛道榜';
    else if (genSel.kind === 'ops') scope = '类型「' + OPS_MODES[genSel.mode].label + '」';
    else scope = '';
    return '将向 ' + (state.settings.model || 'API') + ' 发起 1 次' + (state.settings.enableSearch ? '联网' : '') + '请求(' + scope + '),可能耗时 1–3 分钟并按 token 计费。';
  }
  function renderGenModal() {
    $('genTitle').textContent = GEN_KINDS[genSel.kind].title;
    $('genBody').innerHTML = genModalHtml();
    $('genNote').textContent = genNote();
  }
  function openGenModal(kind) {
    if (!GEN_KINDS[kind]) return;
    genSel.kind = kind;
    genSel.range = (kind === 'sum' ? state.sumRange : state.newsRange);
    genSel.techRange = state.techRange;
    genSel.mode = state.opsMode;
    renderGenModal();
    $('genModal').hidden = false;
  }
  function closeGenModal() { $('genModal').hidden = true; genSel.kind = null; }
  function confirmGenModal() {
    var kind = genSel.kind; if (!kind) return;
    if (kind === 'news') state.newsRange = genSel.range;
    else if (kind === 'sum') state.sumRange = genSel.range;
    else if (kind === 'tech') state.techRange = genSel.techRange;
    else if (kind === 'ops') state.opsMode = genSel.mode;
    closeGenModal();
    GEN_KINDS[kind].run();
  }

  // ---------- 设置弹窗 ----------
  function syncProviderUI() {
    var prov = PROVIDERS[$('setProvider').value] || PROVIDERS.custom;
    $('setProviderHint').textContent = prov.keyHint + (prov.reach ? ' ' + prov.reach : '');
    $('setSearch').disabled = !prov.search;
    $('setSearchHint').textContent = prov.search
      ? '开启后请求会带 enable_search:true,让千问联网检索最新信息。实时新闻必须开启。'
      : '该服务商不支持 enable_search 参数(千问专属),开关已禁用;联网能力取决于所选模型本身。';
    $('setBaseUrlHint').textContent = $('setProvider').value === 'custom'
      ? '填 OpenAI 兼容网关的地址(以 /v1 结尾)。应用会自动拼 /chat/completions 与 /models。'
      : prov.label + ' 的地址(切换服务商时自动填,可改)。应用会自动拼 /chat/completions(Claude 为 /messages)与 /models。';
  }
  function applyProviderPreset() {
    var id = $('setProvider').value;
    var prov = PROVIDERS[id];
    if (prov && id !== 'custom') {
      $('setBaseUrl').value = prov.baseUrl;
      if (prov.model) $('setModel').value = prov.model;
    }
    syncProviderUI();
  }
  function openSettings() {
    $('setProvider').value = PROVIDERS[state.settings.provider] ? state.settings.provider : 'custom';
    syncProviderUI();
    $('setBaseUrl').value = state.settings.baseUrl;
    $('setApiKey').value = state.settings.apiKey;
    $('setModel').value = state.settings.model;
    $('setSearch').checked = !!state.settings.enableSearch;
    $('setAutoSync').checked = state.settings.autoSync !== false;
    $('setTimeout').value = state.settings.timeoutSec || 300;
    $('setRegion').value = state.settings.region || '福建省';
    $('setDemo').checked = !!state.settings.demo;
    try { $('setThree').checked = localStorage.getItem('ai-fxb-3d') !== 'off'; } catch (e) { $('setThree').checked = true; }
    $('modelPicker').hidden = true;
    $('settingsMsg').hidden = true;
    $('settingsModal').hidden = false;
  }
  function closeSettings() { $('settingsModal').hidden = true; }
  function readSettingsForm() {
    state.settings.provider = PROVIDERS[$('setProvider').value] ? $('setProvider').value : 'custom';
    var preset = PROVIDERS[state.settings.provider];
    state.settings.baseUrl = $('setBaseUrl').value.trim() || (preset && preset.baseUrl) || DEFAULTS.baseUrl;
    state.settings.apiKey = $('setApiKey').value.trim();
    state.settings.model = $('setModel').value.trim() || DEFAULTS.model;
    state.settings.enableSearch = $('setSearch').checked;
    state.settings.autoSync = $('setAutoSync').checked;
    var t = parseInt($('setTimeout').value, 10);
    state.settings.timeoutSec = (isFinite(t) && t >= 30 && t <= 900) ? t : 300;
    state.settings.region = ($('setRegion').value || '').trim() || '福建省';
    state.settings.demo = $('setDemo').checked && !state.settings.apiKey;
  }
  function saveSettings() {
    readSettingsForm(); persistSettings(); closeSettings();
    if (window.__bg3d) window.__bg3d.setEnabled($('setThree').checked);
    if (state.settings.demo) { loadDemoNews(); loadDemoOps(); loadDemoSum(); loadDemoTech(); loadDemoRank(); }
    else render();
  }
  function showMsg(el, kind, text) { el.hidden = false; el.className = 'modal__msg is-' + kind; el.textContent = text; }
  function testConnection() {
    var msgEl = $('settingsMsg');
    readSettingsForm();
    if (!state.settings.apiKey) { showMsg(msgEl, 'err', '请先填写 API Key。'); return; }
    showMsg(msgEl, 'ok', '正在测试连接…');
    rawCall([{ role: 'user', content: '只回复两个字:在的' }], { noSearch: true, timeout: 30000 })
      .then(function (r) {
        if (r.ok) showMsg(msgEl, 'ok', '连接成功!API 可用。');
        else {
          var m = '失败(HTTP ' + r.status + ')';
          try { var j = JSON.parse(r.text); m += ' · ' + ((j.error && j.error.message) || j.message || ''); } catch (e) { m += ' · ' + r.text.slice(0, 120); }
          showMsg(msgEl, 'err', m);
        }
      })
      .catch(function () {
        var prov = providerOf();
        var m = '无法连接:网络不通,或该接口不允许浏览器跨域(CORS),或服务商会拒绝预检请求。';
        if (prov.reach) m += ' ' + prov.reach;
        if (location.protocol === 'file:') m += ' 你正以 file:// 打开,请改用本地服务器:运行 node server.mjs 后打开 http://127.0.0.1:5178。';
        showMsg(msgEl, 'err', m);
      });
  }

  // ---------- 模型选择器 ----------
  function openPicker() { $('modelPicker').hidden = false; $('pickerSearch').value = ''; renderPickerList(''); }
  function closePicker() { $('modelPicker').hidden = true; }
  function renderPickerList(filter) {
    var f = (filter || '').trim().toLowerCase();
    var cur = $('setModel').value.trim();
    var list = state.models.filter(function (id) { return !f || id.toLowerCase().indexOf(f) >= 0; });
    var el = $('pickerList');
    if (!state.models.length) el.innerHTML = '<div class="picker__empty">还没有模型列表。点右上「拉取/刷新」读取你账号可用的模型。</div>';
    else if (!list.length) el.innerHTML = '<div class="picker__empty">没有匹配「' + esc(filter) + '」的模型(共 ' + state.models.length + ' 个可用)。清空搜索可查看全部。</div>';
    else el.innerHTML = list.map(function (id) {
      return '<button type="button" class="picker__item' + (id === cur ? ' is-cur' : '') + '" data-model="' + esc(id) + '">' + esc(id) + '</button>';
    }).join('');
    $('pickerFoot').textContent = state.models.length ? ('共 ' + state.models.length + ' 个可用模型' + (f ? ',匹配 ' + list.length + ' 个' : '') + '。点击某一项即选中。') : '';
  }
  function fetchModels() {
    var msgEl = $('settingsMsg');
    readSettingsForm();
    if (!state.settings.apiKey) { showMsg(msgEl, 'err', '请先填写 API Key,才能拉取模型列表。'); return; }
    $('pickerFoot').textContent = '正在拉取…';
    var prov = providerOf();
    var mh = prov.format === 'anthropic'
      ? { 'x-api-key': state.settings.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      : { 'Authorization': 'Bearer ' + state.settings.apiKey };
    fetch(state.settings.baseUrl.replace(/\/+$/, '') + '/models', { headers: mh })
      .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; }); })
      .then(function (r) {
        if (!r.ok) { showMsg(msgEl, 'err', '拉取模型失败(HTTP ' + r.status + '):' + r.text.slice(0, 160)); return; }
        var j; try { j = JSON.parse(r.text); } catch (e) { showMsg(msgEl, 'err', '模型接口返回不是合法 JSON。'); return; }
        var ids = (j.data || []).map(function (m) { return m && m.id; }).filter(Boolean);
        if (!ids.length) { showMsg(msgEl, 'err', '接口返回了空模型列表。请确认 Base URL 与 Key 是否属于同一服务商。'); return; }
        state.models = ids; saveModelsCache(ids);
        renderPickerList($('pickerSearch').value);
        showMsg(msgEl, 'ok', '已载入 ' + ids.length + ' 个可用模型(已缓存)。点击选择或搜索过滤。');
      })
      .catch(function () {
        var prov = providerOf();
        var m = '无法连接模型接口:网络不通或跨域(CORS)/预检被拒。';
        if (prov.reach) m += ' ' + prov.reach;
        showMsg(msgEl, 'err', m);
      });
  }

  // ---------- 渲染 ----------
  var loadTimer = null;
  var loadStart = 0;
  function anyLoading() { return state.news.status === 'loading' || state.ops.status === 'loading' || state.sum.status === 'loading' || state.tech.status === 'loading'; }
  function startLoadTimer() {
    stopLoadTimer(); loadStart = Date.now();
    loadTimer = setInterval(function () {
      if (!anyLoading()) { stopLoadTimer(); return; }
      var s = Math.round((Date.now() - loadStart) / 1000);
      ['news', 'ops', 'sum', 'tech'].forEach(function (k) {
        var el = $(k + 'Elapsed');
        if (el) el.textContent = '生成中…已等待 ' + s + ' 秒(联网聚合可能需要 1–3 分钟,请勿关闭页面)。';
      });
    }, 1000);
  }
  function stopLoadTimer() { if (loadTimer) { clearInterval(loadTimer); loadTimer = null; } }

  function render() {
    if (!anyLoading()) stopLoadTimer(); else if (!loadTimer) startLoadTimer();
    renderSource();
    renderUsage();
    renderTabBadges();
    renderUpdated();
    $('panel-news').hidden = state.view !== 'news';
    $('panel-ops').hidden = state.view !== 'ops';
    $('panel-sum').hidden = state.view !== 'sum';
    $('panel-tech').hidden = state.view !== 'tech';
    $('panel-rank').hidden = state.view !== 'rank';
    $('panel-net').hidden = state.view !== 'net';
    $('panel-news').classList.toggle('is-active', state.view === 'news');
    $('panel-ops').classList.toggle('is-active', state.view === 'ops');
    $('panel-sum').classList.toggle('is-active', state.view === 'sum');
    $('panel-tech').classList.toggle('is-active', state.view === 'tech');
    $('panel-rank').classList.toggle('is-active', state.view === 'rank');
    $('panel-net').classList.toggle('is-active', state.view === 'net');
    renderSelLabels();
    renderNewsPanel();
    renderOpsPanel();
    renderSumPanel();
    renderTechPanel();
    renderRankPanel();
    renderNetPanel();
  }

  function renderSource() {
    var chip = $('sourceChip'), label = $('sourceLabel'), s = state.settings;
    chip.className = 'source-chip';
    if (s.demo) { chip.classList.add('is-demo'); label.textContent = '演示数据'; }
    else if (s.apiKey) { chip.classList.add('is-live'); label.textContent = (s.model || 'API') + (s.enableSearch ? ' · 联网' : ''); }
    else if (state.snapshot) { chip.classList.add('is-live'); label.textContent = '公开快照'; }
    else { chip.classList.add('is-off'); label.textContent = '未配置 API'; }
  }
  function renderUsage() {
    var u = state.usage;
    $('usageTotal').textContent = String(u.total);
    $('usageChip').title = '累计消耗 ' + u.total + ' token(' + u.calls + ' 次调用)· 其中静默同步 ' + u.silent + '(' + u.silentCalls + ' 次)· 今日共 ' + u.dayTotal + ' / 今日静默 ' + u.daySilent;
  }
  // 切到某 tab 即视为已读:清除该板块的 tab 角标(卡片内的 NEW 当日仍保留)
  function markViewed(view) {
    var b = state[view];
    if (!b) return;
    if (b.tabNew) { b.tabNew = 0; saveCache(); }
  }
  function renderTabBadges() {
    var map = { sum: state.sum, tech: state.tech, rank: state.rank, ops: state.ops, news: state.news };
    Object.keys(map).forEach(function (v) {
      var tab = $('tab-' + v); if (!tab) return;
      var n = map[v].tabNew || 0;
      var badge = tab.querySelector('.tab__badge');
      if (n > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'tab__badge'; tab.appendChild(badge); }
        badge.textContent = n; badge.title = n + ' 条新数据';
      } else if (badge) { badge.parentNode.removeChild(badge); }
    });
  }
  function anySyncing() {
    return !!(state.news.syncing || state.sum.syncing || state.ops.syncing || state.rank.syncing || (state.tech && state.tech.syncing));
  }
  function totalNew() {
    return countNew(state.news.items) + countNew(state.sum.items) + countNew(state.ops.items) + countNew(state.rank.items) + (state.tech ? countNew(state.tech.items) : 0);
  }
  function lastFetchTs() {
    return Math.max(state.news.fetched_at || 0, state.sum.fetched_at || 0, state.ops.fetched_at || 0, state.rank.fetched_at || 0, (state.tech && state.tech.fetched_at) || 0);
  }
  function renderUpdated() {
    var el = $('updatedLine');
    if (state.settings.demo) { el.textContent = '⚠ 演示模式:以下为内置示例数据,非真实检索结果。请在「设置」填写 API 并关闭演示模式。'; el.style.color = '#fde68a'; return; }
    if (!configured()) {
      // 公开快照模式(未配置 Key 的访客)
      if (state.snapshotError) { el.style.color = '#fda4af'; el.textContent = '公开快照载入失败:' + state.snapshotError + ' · 稍后刷新重试' + (ADMIT ? ',或在「设置」配置自己的 API Key。' : '。'); return; }
      if (state.snapshot) {
        el.style.color = '';
        var ns = totalNew();
        el.textContent = '公开快照 · 数据截至 ' + fmtDateTime(state.snapshot.ts) + (ns ? ' · ' + ns + ' 条新增(NEW)' : '') + ' · 每日自动更新';
        return;
      }
    }
    var parts = [];
    var ts = lastFetchTs();
    if (ts) parts.push('上次更新 ' + fmtDateTime(ts));
    var n = totalNew();
    if (n) parts.push(n + ' 条今日新增(NEW)');
    if (anySyncing()) { el.style.color = '#7dd3fc'; el.textContent = '⟳ 正在后台静默同步最新信息…' + (parts.length ? ' · ' + parts.join(' · ') : ''); }
    else if (parts.length) { el.style.color = ''; el.textContent = parts.join(' · '); }
    else { el.style.color = ''; el.textContent = '尚未同步数据。'; }
  }

  function renderSelLabels() {
    var ns = $('newsSel'); if (ns) ns.innerHTML = '范围 <b>' + state.newsRange + ' 天</b>';
    var ss = $('sumSel'); if (ss) ss.innerHTML = '范围 <b>' + state.sumRange + ' 天</b>';
    var ts = $('techSel'); if (ts) ts.innerHTML = '范围 <b>' + state.techRange + ' 天</b>';
    var rs = $('rankSel'); if (rs) rs.innerHTML = '综合总榜 <b>+ 6 细分赛道</b>';
    var os = $('opsSel'); if (os) os.innerHTML = '类型 <b>' + esc(OPS_MODES[state.opsMode].label) + '</b>';
  }

  // 公开快照模式下访客没有 Key:空板块要说「这轮快照没有」,不能让他去开一个自己看不见的设置面板
  function snapIdle(kind) {
    if (configured() || state.settings.demo || ADMIT) return '';
    if (state.snapshotError) return '公开快照没能载入 · 稍后刷新重试。';
    return '公开快照本轮没有' + kind + ' · 每天早上 8:30 自动更新,稍后刷新即可。';
  }
  function panelStateHtml(bucket, kind, readyHint) {
    if (bucket.status === 'loading') {
      return '<div class="state"><div class="state__inner"><div class="spinner"></div><p class="state__title">正在生成…</p><p class="state__desc" id="' + kind + 'Elapsed">生成中…已等待 0 秒。</p></div></div>';
    }
    if (bucket.status === 'error') {
      return '<div class="state is-error"><div class="state__inner">' +
        '<p class="state__title">生成失败</p>' +
        '<p class="state__desc">' + esc(bucket.error) + '</p>' +
        (bucket.errorMeta ? '<p class="state__meta">' + esc(bucket.errorMeta) + '</p>' : '') +
        (bucket.errorDetail ? '<details class="state__detail"><summary>查看原始报错</summary><pre>' + esc(bucket.errorDetail) + '</pre></details>' : '') +
        '<button class="btn btn--ghost state__action" data-retry="' + kind + '">重试</button>' +
        '</div></div>';
    }
    // idle
    return '<div class="state"><div class="state__inner"><p class="state__title">尚未生成</p>' +
      '<p class="state__desc">' + esc(readyHint) + '</p>' +
      (configured() || state.settings.demo || !ADMIT ? '' : '<button class="btn btn--ghost state__action" data-open-settings="1">打开设置</button>') +
      '</div></div>';
  }

  function setStatus(el, bucket, extra) {
    el.className = 'toolbar__status is-' + bucket.status;
    if (bucket.status === 'ready') {
      el.textContent = '更新于 ' + fmtDateTime(bucket.fetched_at) + ' · ' + bucket.items.length + ' 条' + (extra || '') +
        (bucket.syncing ? ' · ⟳ 同步中' : '') + (bucket.newCount ? ' · ' + bucket.newCount + ' NEW' : '') +
        (bucket.loadError ? ' · 同步失败' : '');
    }
    else if (bucket.status === 'loading') el.textContent = '生成中…';
    else if (bucket.status === 'error') el.textContent = '失败';
    else el.textContent = '尚未生成';
  }

  function renderNewsPanel() {
    var b = state.news;
    setStatus($('newsStatus'), b, b.range ? ' · ' + b.range + '天' : '');
    $('genNewsBtn').disabled = b.status === 'loading';
    var ready = b.status === 'ready';
    $('newsBody').hidden = !ready;
    var st = $('newsState');
    st.hidden = ready;
    if (!ready) { st.innerHTML = panelStateHtml(b, 'news', snapIdle('大事件') || (configured() ? '点右上「生成新闻」开始检索。' : '请先在「设置」配置 API,再生成。')); return; }
    renderNewsStats(); renderNewsFilters(); renderNewsList();
  }
  function renderOpsPanel() {
    var b = state.ops;
    var btn = $('genOpsBtn');
    var busy = !!b.loadingMode || b.status === 'loading';
    btn.disabled = busy;
    btn.textContent = b.loadingMode ? '生成中…' : '生成商机';
    renderOpsStatus();
    var ready = b.status === 'ready';
    $('opsBody').hidden = !ready;
    var st = $('opsState');
    st.hidden = ready;
    if (!ready) { st.innerHTML = panelStateHtml(b, 'ops', snapIdle('商机') || (configured() ? '先在上方选择类型,再点对应的「生成」按钮。两类分开生成、请求更小更易成功。' : '请先在「设置」配置 API,再生成。')); return; }
    renderOpsStats(); renderOpsFilters(); renderOpsNotice(); renderOpsList();
  }
  function renderOpsStatus() {
    var b = state.ops, el = $('opsStatus');
    el.className = 'toolbar__status';
    if (b.loadingMode) { el.className += ' is-loading'; el.textContent = '正在生成' + OPS_MODES[b.loadingMode].label + '…'; return; }
    if (b.status === 'ready') {
      var pol = b.items.filter(function (o) { return o.origin === '政策规划'; }).length;
      var loc = b.items.filter(function (o) { return o.origin === '本地机会'; }).length;
      var mkt = b.items.length - pol - loc;
      el.className += ' is-ready';
      el.textContent = '更新于 ' + fmtDateTime(b.fetched_at) + ' · 共 ' + b.items.length + ' 条(政策 ' + pol + ' · 本地 ' + loc + ' · 市场 ' + mkt + ')';
      return;
    }
    if (b.status === 'error') { el.className += ' is-error'; el.textContent = '失败'; return; }
    el.textContent = '尚未生成';
  }
  function renderOpsNotice() {
    var el = $('opsNotice'); if (!el) return;
    var b = state.ops;
    if (!b.loadError) { el.hidden = true; el.innerHTML = ''; return; }
    var modeLabel = (OPS_MODES[b.loadErrorMode] || OPS_MODES.ai).label;
    el.hidden = false;
    el.innerHTML = '<div class="ops-error"><div class="ops-error__msg"><b>' + esc(modeLabel) + '生成失败:</b>' + esc(b.loadError) +
      (b.loadErrorDetail ? '<details><summary>查看原始报错</summary><pre>' + esc(b.loadErrorDetail) + '</pre></details>' : '') + '</div>' +
      '<button class="btn btn--ghost btn--sm" data-retry="ops" data-setmode="' + (b.loadErrorMode || 'ai') + '">重试</button></div>';
  }

  function renderSumPanel() {
    var b = state.sum;
    setStatus($('sumStatus'), b, b.range ? ' · ' + b.range + '天' : '');
    $('genSumBtn').disabled = b.status === 'loading';
    var ready = b.status === 'ready';
    $('sumBody').hidden = !ready;
    var st = $('sumState');
    st.hidden = ready;
    if (!ready) { st.innerHTML = panelStateHtml(b, 'sum', snapIdle('汇总') || (configured() ? '点右上「生成汇总」,30 秒看完最近几天 AI 大事。' : '请先在「设置」配置 API,再生成。')); return; }
    $('sumOverview').innerHTML = '<b>导读 · ' + esc(b.generated_at) + ' · 最近 ' + (b.range || state.sumRange) + ' 天</b>' + esc(b.overview || '');
    renderSumList();
  }
  function renderSumList() {
    var items = state.sum.items;
    if (!items.length) { $('sumList').innerHTML = emptyHtml('本次汇总没有返回要点。'); return; }
    $('sumList').innerHTML = items.map(function (h) {
      var title = h.url ? '<a href="' + esc(h.url) + '" target="_blank" rel="noopener noreferrer">' + esc(h.title) + '</a>' : esc(h.title);
      return '<article class="card sum-item" data-detail="sum:' + h.id + '">' +
        '<div class="card__top">' + newBadge(h) + '<span class="tag tag--cat">' + esc(h.tag) + '</span></div>' +
        '<h3 class="card__title">' + title + '</h3>' +
        (h.takeaway ? '<p class="card__sum">' + esc(h.takeaway) + '</p>' : '') +
        cardFoot(h) + '</article>';
    }).join('');
  }

  function renderTechPanel() {
    var b = state.tech;
    setStatus($('techStatus'), b, b.range ? ' · ' + b.range + '天' : '');
    $('genTechBtn').disabled = b.status === 'loading';
    var ready = b.status === 'ready';
    $('techBody').hidden = !ready;
    var st = $('techState');
    st.hidden = ready;
    if (!ready) { st.innerHTML = panelStateHtml(b, 'tech', snapIdle('前沿技术') || (configured() ? '点右上「生成前沿技术」,用大白话看懂最近冒出来的新技术。' : '请先在「设置」配置 API,再生成。')); return; }
    renderTechStats(); renderTechFilters(); renderTechList();
  }
  function renderTechStats() {
    var items = state.tech.items;
    var research = items.filter(function (t) { return t.stage === '研究突破'; }).length;
    var tracks = {}; items.forEach(function (t) { tracks[t.track] = 1; });
    var stats = [
      { n: items.length, l: '技术条目' }, { n: research, l: '研究突破' },
      { n: Object.keys(tracks).length, l: '覆盖赛道' }, { n: esc(state.tech.generated_at), l: '数据日期', small: true }
    ];
    $('techStats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="stat__n' + (s.small ? ' stat__n--sm' : '') + '">' + s.n + '</div><div class="stat__l">' + s.l + '</div></div>';
    }).join('');
  }
  function renderTechFilters() {
    var items = state.tech.items;
    var present = {}; items.forEach(function (t) { present[t.track] = 1; });
    var tracks = ['全部'].concat(OPS_TRACKS.filter(function (t) { return present[t]; }));
    $('techTrackChips').innerHTML = chipHtml(tracks, state.filters.techTrack, 'techTrack');
  }
  function renderTechList() {
    var f = state.filters;
    var list = state.tech.items.filter(function (t) {
      return f.techTrack === '全部' || t.track === f.techTrack;
    });
    if (!list.length) { $('techList').innerHTML = emptyHtml('没有匹配的技术条目。'); return; }
    $('techList').innerHTML = list.map(function (t) {
      var stageCls = t.stage === '研究突破' ? 'tag--major' : (t.stage === '规模落地' ? 'tag--cat' : 'tag--minor');
      var term = t.url ? '<a href="' + esc(t.url) + '" target="_blank" rel="noopener noreferrer">' + esc(t.title) + '</a>' : esc(t.title);
      return '<article class="card tech-item" data-detail="tech:' + t.id + '">' +
        '<div class="card__top">' + newBadge(t) +
          '<span class="tag tag--region">' + esc(t.track) + '</span>' +
          '<span class="tag ' + stageCls + '">' + esc(t.stage) + '</span>' +
          (t.date ? '<span class="tag tag--date">' + esc(t.date) + '</span>' : '') +
        '</div>' +
        '<h3 class="card__title">' + term + (t.en ? ' <span class="tech-en">' + esc(t.en) + '</span>' : '') + '</h3>' +
        (t.principle ? '<p class="card__sum">' + esc(t.principle) + '</p>' : '') +
        (t.why ? '<p class="card__impact"><b>为什么重要:</b>' + esc(t.why) + '</p>' : '') +
        cardFoot(t) + '</article>';
    }).join('');
  }

  // ---------- 模型排行 ----------
  function renderRankPanel() {
    var b = state.rank;
    setStatus($('rankStatus'), b, '');
    $('genRankBtn').disabled = b.status === 'loading';
    var ready = b.status === 'ready';
    $('rankBody').hidden = !ready;
    var st = $('rankState');
    st.hidden = ready;
    if (!ready) { st.innerHTML = panelStateHtml(b, 'rank', snapIdle('模型排行') || (configured() ? '点右上「生成排行」,看当下做什么任务该选哪个模型。' : '请先在「设置」配置 API,再生成。')); return; }
    var ov = $('rankOverview');
    ov.hidden = !b.overview;
    ov.innerHTML = b.overview ? '<b>总评</b>' + esc(b.overview) : '';
    renderRankStats(); renderRankFilters(); renderRankList();
  }
  function renderRankStats() {
    var items = state.rank.items;
    var tracks = {}; items.forEach(function (it) { tracks[it.track] = 1; });
    var tops = items.filter(function (it) { return it.rank === 1; }).length;
    var stats = [
      { n: items.length, l: '上榜条目' }, { n: Object.keys(tracks).length, l: '覆盖榜单' },
      { n: tops, l: '榜首模型' }, { n: esc(state.rank.generated_at), l: '数据日期', small: true }
    ];
    $('rankStats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="stat__n' + (s.small ? ' stat__n--sm' : '') + '">' + s.n + '</div><div class="stat__l">' + s.l + '</div></div>';
    }).join('');
  }
  function renderRankFilters() {
    var present = {}; state.rank.items.forEach(function (it) { present[it.track] = 1; });
    var tracks = ['全部'].concat(RANK_TRACKS.filter(function (t) { return present[t]; }));
    $('rankTrackChips').innerHTML = chipHtml(tracks, state.filters.rankTrack, 'rankTrack');
  }
  function renderRankList() {
    var f = state.filters;
    var items = state.rank.items.filter(function (it) {
      return f.rankTrack === '全部' || it.track === f.rankTrack;
    });
    if (!items.length) { $('rankList').innerHTML = emptyHtml('没有匹配榜单的数据。'); return; }
    var groups = [];
    RANK_TRACKS.forEach(function (tr) {
      var g = items.filter(function (it) { return it.track === tr; });
      if (g.length) groups.push({ track: tr, items: g });
    });
    items.forEach(function (it) {
      if (RANK_TRACKS.indexOf(it.track) < 0 && !groups.some(function (g) { return g.track === it.track; })) {
        groups.push({ track: it.track, items: items.filter(function (x) { return x.track === it.track; }) });
      }
    });
    $('rankList').innerHTML = groups.map(rankGroupHtml).join('');
  }
  function rankScoreNum(it) {
    var m = String(it.score || '').match(/\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function rankMetric(it) {
    var s = String(it.source || '');
    return s.indexOf('·') >= 0 ? s.split('·').pop().trim() : '';
  }
  function rankDomain(metric, nums) {
    var hi = nums.length ? Math.max.apply(null, nums) : 1;
    if (/elo/i.test(metric)) return { from: 1000, to: Math.max(1400, Math.ceil(hi / 50) * 50) };
    return { from: 0, to: Math.max(100, Math.ceil(hi / 10) * 10) };
  }
  function rankGroupHtml(g) {
    var vals = g.items.map(rankScoreNum);
    var nums = vals.filter(function (v) { return v != null; });
    var dm = rankDomain(rankMetric(g.items[0]), nums);
    return '<div class="rank-group"><h3 class="rank-group__title">' + esc(g.track) +
      '<span class="rank-group__scale">' + esc(rankMetric(g.items[0])) + ' ' + dm.from + '–' + dm.to + '</span></h3><div class="rank-chart">' +
      g.items.map(function (it, i) { return rankBar(it, vals[i], dm); }).join('') + '</div></div>';
  }
  function rankBar(it, v, dm) {
    var span = dm.to - dm.from || 1;
    var pct = (v == null) ? null : Math.max(2, Math.min(96, Math.round((v - dm.from) / span * 96)));
    return '<div class="rank-bar' + (it.rank === 1 ? ' is-top' : '') + '" data-detail="rank:' + it.id + '" title="' + esc(it.note || '') + '">' +
      '<span class="rank-no">#' + (it.rank || '-') + '</span>' + newBadge(it) +
      '<span class="rank-bar__name">' + esc(it.title) + (it.vendor ? '<em>' + esc(it.vendor) + '</em>' : '') + '</span>' +
      '<span class="rank-bar__rail">' + (pct != null ? '<span class="rank-bar__fill" style="width:' + pct + '%"></span>' : '') + '</span>' +
      '<span class="rank-bar__score">' + esc(it.score || '') + '</span>' +
      '</div>';
  }

  // ---------- 情报蛛网(画面用 vendor/spider 的第三方动画层,数据用本站快照) ----------
  var NET_BOARDS = ['sum', 'tech', 'news', 'ops', 'rank'];
  var NET_ROUTES = [['all', '全部'], ['code', '情报'], ['model', '技术'], ['you', '商机']];
  var netApi = null, netSig = '', netErr = '', netBgPaused = false, netBgWas = true, netLoading = false;
  function netBuckets() {
    var b = {};
    NET_BOARDS.forEach(function (k) { b[k] = (state[k] && state[k].status === 'ready') ? state[k].items : []; });
    return b;
  }
  function netSigOf(b) { return NET_BOARDS.map(function (k) { return k + b[k].length; }).join('|'); }
  function netTotal(b) { return NET_BOARDS.reduce(function (n, k) { return n + b[k].length; }, 0); }
  function setBgPaused(pause) {
    if (!window.__bg3d) return;
    if (pause) {
      if (netBgPaused) return;
      // 以 ai-fxb-3d 为准,不能读 setThree 勾选框:设置面板没打开过时它没被同步过,还原会误关背景
      try { netBgWas = localStorage.getItem('ai-fxb-3d') !== 'off'; } catch (e) { netBgWas = true; }
      window.__bg3d.setEnabled(false);
      netBgPaused = true;
    } else if (netBgPaused) {
      netBgPaused = false;
      window.__bg3d.setEnabled(netBgWas);
    }
  }
  function renderNetChips() {
    $('netRouteChips').innerHTML = NET_ROUTES.map(function (r) {
      return '<button class="chip' + (state.filters.netRoute === r[0] ? ' is-on' : '') + '" type="button" data-netroute="' + r[0] + '">' + esc(r[1]) + '</button>';
    }).join('');
  }
  function mountNet(b, sig) {
    netApi = window.__net;
    netApi.mount($('netCanvas'), b, {
      onPick: function (board, id) { openDetail(board, id); },
      onPage: function (p, total) {
        $('netPage').textContent = '第 ' + p + ' / ' + total + ' 页';
        $('netPrev').disabled = p <= 1; $('netNext').disabled = p >= total;
      },
      date: state.rank.generated_at || state.sum.generated_at || '',
      connection: state.snapshot ? '公开快照' : '本机生成'
    });
    netApi.pick(state.filters.netRoute);
    netSig = sig;
  }
  function renderNetPanel() {
    if (state.view !== 'net') {
      if (netApi) { netApi.unmount(); netApi = null; netSig = ''; }
      setBgPaused(false);
      return;
    }
    setBgPaused(true);
    renderNetChips();
    var b = netBuckets(), total = netTotal(b), sig = netSigOf(b), st = $('netState');
    $('netSel').textContent = total ? '共 ' + total + ' 条入网' : '';
    $('netCanvas').hidden = total === 0;
    if (!total) {
      if (netApi) { netApi.unmount(); netApi = null; netSig = ''; }
      st.hidden = false;
      st.innerHTML = '<p>还没有条目:先在其它板块生成,或等每日快照写入。</p>' +
        (netErr ? '<p>动画层加载失败:' + esc(netErr) + '</p>' : '');
      return;
    }
    st.hidden = true;
    if (netApi && netSig === sig) { netApi.pick(state.filters.netRoute); return; }
    if (netErr || netLoading) return;
    var go = function () {
      netLoading = false;
      if (state.view !== 'net' || netErr || !window.__net) return;
      var cur = netBuckets(), curSig = netSigOf(cur);
      if (netApi && netSig === curSig) return;
      mountNet(cur, curSig);
    };
    if (window.__net) { go(); return; }
    netLoading = true;
    import('./net.js').then(go, function (e) { netLoading = false; netErr = (e && e.message) ? e.message : String(e); renderNetPanel(); });
  }

  function chipHtml(list, active, group) {
    return list.map(function (v) {
      return '<button class="chip' + (v === active ? ' is-on' : '') + '" type="button" data-group="' + group + '" data-val="' + esc(v) + '">' + esc(v) + '</button>';
    }).join('');
  }
  function renderNewsStats() {
    var items = state.news.items;
    var major = items.filter(function (n) { return n.importance === '重大'; }).length;
    var regions = {}; items.forEach(function (n) { regions[n.region] = 1; });
    var stats = [
      { n: items.length, l: '事件数' }, { n: major, l: '重大事件' },
      { n: Object.keys(regions).length, l: '覆盖地区' }, { n: esc(state.news.generated_at), l: '数据日期', small: true }
    ];
    $('newsStats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="stat__n' + (s.small ? ' stat__n--sm' : '') + '">' + s.n + '</div><div class="stat__l">' + s.l + '</div></div>';
    }).join('');
  }
  function renderNewsFilters() {
    var f = state.filters;
    $('newsCatChips').innerHTML = chipHtml(NEWS_CATS, f.newsCat, 'newsCat');
    $('newsRegionChips').innerHTML = chipHtml(REGIONS, f.newsRegion, 'newsRegion');
    $('newsImpChips').innerHTML = chipHtml(IMPS, f.newsImp, 'newsImp');
  }
  function renderNewsList() {
    var f = state.filters;
    var list = state.news.items.filter(function (n) {
      return (f.newsCat === '全部' || n.category === f.newsCat) &&
        (f.newsRegion === '全部' || n.region === f.newsRegion) &&
        (f.newsImp === '全部' || n.importance === f.newsImp);
    });
    if (!list.length) { $('newsList').innerHTML = emptyHtml('没有符合当前筛选的事件。'); return; }
    $('newsList').innerHTML = list.map(function (n) {
      var major = n.importance === '重大';
      var title = n.url ? '<a href="' + esc(n.url) + '" target="_blank" rel="noopener noreferrer">' + esc(n.title) + '</a>' : esc(n.title);
      return '<article class="card' + (major ? ' is-major' : '') + '" data-detail="news:' + n.id + '">' +
        '<div class="card__top">' + newBadge(n) + '<span class="tag tag--cat">' + esc(n.category) + '</span>' +
        '<span class="tag ' + (major ? 'tag--major">重大' : 'tag--minor">一般') + '</span>' +
        '<span class="tag tag--region">' + esc(n.region) + '</span>' +
        (n.date ? '<span class="tag tag--date">' + esc(n.date) + '</span>' : '') + '</div>' +
        '<h3 class="card__title">' + title + '</h3>' +
        (n.summary ? '<p class="card__sum">' + esc(n.summary) + '</p>' : '') +
        (n.impact ? '<p class="card__impact"><b>影响 · </b>' + esc(n.impact) + '</p>' : '') +
        cardFoot(n) +
        '</article>';
    }).join('');
  }
  function renderOpsStats() {
    var items = state.ops.items;
    var policy = items.filter(function (o) { return o.origin === '政策规划'; }).length;
    var tracks = {}; items.forEach(function (o) { if (o.track) tracks[o.track] = 1; });
    var hi = items.filter(function (o) { return o.potential === '高'; }).length;
    var stats = [
      { n: items.length, l: '商机总数' }, { n: policy, l: '政策规划解析' },
      { n: Object.keys(tracks).length, l: '覆盖赛道' }, { n: hi, l: '高潜力' }
    ];
    $('opsStats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="stat__n">' + s.n + '</div><div class="stat__l">' + s.l + '</div></div>';
    }).join('');
  }
  function renderOpsFilters() {
    var f = state.filters;
    var present = ['全部'];
    state.ops.items.forEach(function (o) { if (o.track && present.indexOf(o.track) < 0) present.push(o.track); });
    $('opsTimeChips').innerHTML = chipHtml(OPS_TIMES, f.opsTime, 'opsTime');
    $('opsTrackChips').innerHTML = chipHtml(present, f.opsTrack, 'opsTrack');
    $('opsOriginChips').innerHTML = chipHtml(OPS_ORIGINS, f.opsOrigin, 'opsOrigin');
  }
  function renderOpsList() {
    var f = state.filters;
    var list = state.ops.items.filter(function (o) {
      return (f.opsTime === '全部' || o.timeframe === f.opsTime) &&
        (f.opsTrack === '全部' || o.track === f.opsTrack) &&
        (f.opsOrigin === '全部' || o.origin === f.opsOrigin);
    });
    if (!list.length) { $('opsList').innerHTML = emptyHtml('没有符合当前筛选的商机。'); return; }
    $('opsList').innerHTML = list.map(function (o) {
      var isPolicy = o.origin === '政策规划';
      var isLocal = o.origin === '本地机会';
      var title = o.url ? '<a href="' + esc(o.url) + '" target="_blank" rel="noopener noreferrer">' + esc(o.title) + '</a>' : esc(o.title);
      var meta = [];
      if (o.level) meta.push(esc(o.level));
      if (o.region) meta.push(esc(o.region));
      var basisBlock = '';
      if ((isPolicy || isLocal) && (o.policy || meta.length)) {
        basisBlock = '<div class="op__block op__policy"><b>' + (isLocal ? '本地依据' : '政策依据') + '</b>' +
          (o.policy ? esc(o.policy) : '') +
          (meta.length ? '<span class="op__policy-tag">' + meta.join(' · ') + '</span>' : '') +
          '</div>';
      }
      var pillCls = isPolicy ? 'pill--policy' : (isLocal ? 'pill--local' : 'pill--market');
      var opCls = isPolicy ? ' op--policy' : (isLocal ? ' op--local' : '');
      return '<article class="op' + opCls + '" data-detail="ops:' + o.id + '">' +
        '<div class="op__head">' + newBadge(o) +
          '<span class="pill ' + pillCls + '">' + esc(o.origin) + '</span>' +
          '<span class="pill pill--track">' + esc(o.track) + '</span>' +
          '<span class="pill pill--time">' + esc(o.timeframe) + '</span>' +
        '</div>' +
        '<h3 class="op__title">' + title + '</h3>' +
        (o.description ? '<p class="op__desc">' + esc(o.description) + '</p>' : '') +
        '<div class="op__meta"><span class="pill ' + (o.potential === '高' ? 'pill--high' : 'pill--mid') + '">潜力 · ' + esc(o.potential) + '</span>' +
        '<span class="pill pill--low">门槛 · ' + esc(o.difficulty) + '</span>' +
        (o.audience ? '<span class="pill pill--low">适合 · ' + esc(o.audience) + '</span>' : '') + '</div>' +
        basisBlock +
        (o.action ? '<div class="op__block op__action"><b>行动建议</b>' + esc(o.action) + '</div>' : '') +
        cardFoot(o) +
        '</article>';
    }).join('');
  }
  function emptyHtml(t) { return '<div class="state"><div class="state__inner"><p class="state__desc">' + esc(t) + '</p></div></div>'; }
  function newBadge(it) { return (it && it.isNew) ? '<span class="badge-new" title="今日新增">NEW</span>' : ''; }

  // ---------- 消息详情 ----------
  var KIND_NAME = { news: 'AI 大事件', sum: 'AI 汇总', tech: '前沿技术', rank: '模型排行', ops: '商机雷达' };

  function cardFoot(it) {
    return '<div class="card__foot">' +
      (it.source ? '<span class="card__src">来源:' + esc(it.source) + '</span>' : '') +
      (it.url ? '<a class="card__src" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">阅读原文 ↗</a>' : '') +
      '<span class="card__more">详情 ›</span></div>';
  }
  function findItem(kind, id) {
    var items = (state[kind] && state[kind].items) || [];
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }
  function dtBlock(label, text, mod) {
    if (!text) return '';
    return '<div class="dt__block' + (mod ? ' dt__block--' + mod : '') + '">' +
      '<span class="dt__label">' + label + '</span><p class="dt__text">' + esc(text) + '</p></div>';
  }
  function dtTags(kind, it) {
    var t = [];
    if (kind === 'news') {
      t.push('<span class="tag tag--cat">' + esc(it.category) + '</span>');
      t.push('<span class="tag ' + (it.importance === '重大' ? 'tag--major">重大' : 'tag--minor">一般') + '</span>');
      t.push('<span class="tag tag--region">' + esc(it.region) + '</span>');
    } else if (kind === 'sum') {
      t.push('<span class="tag tag--cat">' + esc(it.tag) + '</span>');
    } else if (kind === 'tech') {
      t.push('<span class="tag tag--region">' + esc(it.track) + '</span>');
      t.push('<span class="tag ' + (it.stage === '研究突破' ? 'tag--major' : (it.stage === '规模落地' ? 'tag--cat' : 'tag--minor')) + '">' + esc(it.stage) + '</span>');
    } else if (kind === 'rank') {
      t.push('<span class="tag tag--region">' + esc(it.track) + '</span>');
      t.push('<span class="rank-no">#' + (it.rank || '-') + '</span>');
      if (it.vendor) t.push('<span class="tag tag--minor">' + esc(it.vendor) + '</span>');
      if (it.score) t.push('<span class="pill pill--high">' + esc(it.score) + '</span>');
    } else {
      t.push('<span class="pill ' + (it.origin === '政策规划' ? 'pill--policy' : (it.origin === '本地机会' ? 'pill--local' : 'pill--market')) + '">' + esc(it.origin) + '</span>');
      t.push('<span class="pill pill--track">' + esc(it.track) + '</span>');
      t.push('<span class="pill pill--time">' + esc(it.timeframe) + '</span>');
      t.push('<span class="pill ' + (it.potential === '高' ? 'pill--high' : 'pill--mid') + '">潜力 · ' + esc(it.potential) + '</span>');
      t.push('<span class="pill pill--low">门槛 · ' + esc(it.difficulty) + '</span>');
    }
    if (it.date) t.push('<span class="tag tag--date">' + esc(it.date) + '</span>');
    return '<div class="dt__tags">' + t.join('') + '</div>';
  }
  function dtBody(kind, it) {
    var h = dtTags(kind, it);
    if (kind === 'news') h += dtBlock('精炼', it.summary) + dtBlock('详情', it.detail) + dtBlock('影响', it.impact, 'acc');
    else if (kind === 'sum') h += dtBlock('要点', it.takeaway) + dtBlock('详情', it.detail);
    else if (kind === 'tech') h += dtBlock('一句话原理', it.principle) + dtBlock('为什么重要', it.why) + dtBlock('深入解读', it.detail);
    else if (kind === 'rank') h += dtBlock('点评', it.note) + dtBlock('排名依据与边界', it.detail, 'acc');
    else {
      h += dtBlock('精炼', it.description) + dtBlock('详情', it.detail);
      var meta = [it.level, it.region].filter(Boolean).map(esc).join(' · ');
      if ((it.origin === '政策规划' || it.origin === '本地机会') && (it.policy || meta)) {
        h += '<div class="dt__block dt__block--warn"><span class="dt__label">' + (it.origin === '本地机会' ? '本地依据' : '政策依据') + '</span>' +
          '<p class="dt__text">' + esc(it.policy || '') + (meta ? '<br><span class="op__policy-tag">' + meta + '</span>' : '') + '</p></div>';
      }
      h += dtBlock('行动建议', it.action, 'acc');
      if (it.audience) h += dtBlock('适合谁', it.audience);
    }
    if (!it.detail) h += '<p class="dt__none">旧数据没有详情,重新生成后就会有。</p>';
    h += '<div class="dt__src"><span class="dt__label">原文出处</span>' +
      '<span>' + (it.source ? esc(it.source) : '未标注') + '</span>' +
      (it.url ? '<a class="dt__link" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">查看原文 ↗</a>' : '<span class="dt__none">无原文链接</span>') +
      '</div>';
    return h;
  }
  function openDetail(kind, id) {
    var it = findItem(kind, id);
    if (!it) return;
    $('detailTitle').textContent = it.title || '详情';
    $('detailKind').textContent = KIND_NAME[kind] || '';
    $('detailBody').innerHTML = dtBody(kind, it);
    var a = $('detailLink');
    if (it.url) { a.hidden = false; a.href = it.url; } else { a.hidden = true; a.removeAttribute('href'); }
    $('detailModal').hidden = false;
    var card = $('detailModal').querySelector('.modal__card');
    if (card) card.scrollTop = 0;
  }
  function closeDetail() { $('detailModal').hidden = true; }

  // ---------- 演示数据 ----------
  function demoData() {
    var t = new Date();
    function dAgo(n) { return fmtDate(new Date(t.getTime() - n * 86400000)); }
    return {
      overview: '这是演示导读。真实使用时,这里会用 80–140 字概括所选天数内全球 AI 领域的主线与氛围,让你 30 秒抓住重点,不必逐条细读。',
      highlights: [
        { title: '示例:开源模型推理成本大幅下降', takeaway: '成本下降会加速中小团队接入 AI,值得跟进工具链机会。', detail: '这是演示详情。真实使用时,这里会写清这条要点的来龙去脉:哪家机构、降价幅度与口径、对比基准、影响到哪些环节的从业者,以及后续值得观察的动向。', tag: '模型', date: dAgo(0), source: '示例来源', url: '' },
        { title: '示例:多模态旗舰模型开放 API', takeaway: '内容创作与电商导购场景迎来新能力,可快速做原型验证。', detail: '这是演示详情。会说明开放了哪些能力(图文理解、视频输入等)、定价与限流、与上一代相比的提升,以及哪些场景可以马上拿来做原型。', tag: '产品', date: dAgo(1), source: '示例来源', url: '' },
        { title: '示例:生成式 AI 监管新规落地', takeaway: '合规成为产品上线前置条件,催生合规咨询需求。', detail: '这是演示详情。会列出新规约束的对象、备案与标识要求、生效时间与过渡期,以及不合规的实际后果,便于判断自己是否受影响。', tag: '监管', date: dAgo(2), source: '示例来源', url: '' },
        { title: '示例:AI 编程智能体能力升级', takeaway: '独立开发者效率提升,利好一人公司模式。', detail: '这是演示详情。会讲清升级后的智能体能自主完成哪些流程、在真实仓库基准上的表现、仍容易出错的地方,以及订阅价格变化。', tag: '研究', date: dAgo(2), source: '示例来源', url: '' }
      ],
      news: [
        { title: '示例:某开源大模型发布新版本,推理成本下降', summary: '这是演示数据。真实使用时显示过去所选天数内全球 AI 事件摘要。', detail: '这是演示详情。真实使用时会写清事件来龙去脉:发布方与版本号、上下文长度与 benchmark 表现、每百万 token 的价格从多少降到多少、开源协议是否变化、社区与云厂商的跟进动作,以及对做应用的人意味着什么。', category: '模型发布', importance: '重大', region: '美国', date: dAgo(0), source: '示例来源', url: '', impact: '推理成本下降加速 AI 应用落地。' },
        { title: '示例:国内厂商推出多模态旗舰模型', summary: '这是演示数据。摘要说明模型能力与开放程度。', detail: '这是演示详情。会说明模型支持哪些模态、参数与推理规模、API 是否已开放、内测还是公测、在中文任务上的实测表现,以及厂商给出的算力成本与落地场景。', category: '模型发布', importance: '重大', region: '中国', date: dAgo(1), source: '示例来源', url: '', impact: '多模态为内容、电商场景带来机会。' },
        { title: '示例:AI 初创完成新一轮融资', summary: '这是演示数据。给出轮次、金额与投资方。', detail: '这是演示详情。会给出融资金额与轮次、领投与跟投机构、估值变化、公司主营方向与已有客户,以及资金用途和下一阶段的商业化目标。', category: '融资并购', importance: '一般', region: '欧洲', date: dAgo(1), source: '示例来源', url: '', impact: '资本流向指示被看好的赛道。' },
        { title: '示例:某地出台生成式 AI 监管新规', summary: '这是演示数据。概述监管范围与生效时间。', detail: '这是演示详情。会说明新规由哪个部门发布、约束哪些主体与服务形态、备案与安全评估要求、内容标识义务、施行时间点与处罚方式,以及存量产品需要多快完成整改。', category: '政策监管', importance: '重大', region: '中国', date: dAgo(2), source: '示例来源', url: '', impact: '合规要求影响产品上线节奏。' },
        { title: '示例:AI 编程助手更新智能体能力', summary: '这是演示数据。说明新功能与开发者反馈。', detail: '这是演示详情。会说明更新的能力边界(能否自主跑通测试、多文件改动、长任务保持上下文)、在真实代码库上的表现、价格与额度调整,以及开发者的实际评价与踩坑点。', category: '产品应用', importance: '一般', region: '美国', date: dAgo(2), source: '示例来源', url: '', impact: '开发效率工具演进利好小团队。' }
      ],
      opportunities: [
        { title: '示例:面向中小商家的 AI 导购内容生成', description: '这是演示数据。说明用什么 AI 能力、解决什么痛点。', detail: '这是演示详情。会讲清为什么现在是机会:多模态模型成本下降让图文视频批量生成可行;目标客户是哪些中小商家、他们现在花多少钱做内容、用什么方式切入(按条计费还是包月)、需要什么渠道或供应链资源,以及内容同质化与平台审核的主要风险。', track: 'AI+内容/文创', origin: '市场商机', level: '', region: '', policy: '', source: '示例来源', url: '', timeframe: '本周', potential: '高', difficulty: '中', audience: '电商从业者', action: '选一个品类做最小可用工具,找 3 个商家试用。' },
        { title: '示例:一体化算力网下的算力调度代理服务', description: '这是演示数据。围绕全国一体化算力网政策,为中小团队提供算力撮合与成本优化。', detail: '这是演示详情。会列出政策依据的具体条款与时间表、释放出的需求(闲置算力入市、跨区域调度、成本结算),个人或小团队可承接的切入点(区域算力信息撮合、比价与代运维),需要的资质、机房关系或渠道资源,以及回款周期与巨头挤压的风险。', track: '智能算力/AI芯片', origin: '政策规划', level: '国家级', region: '全国', policy: '《全国一体化算力网建设行动计划》(示例)', source: '示例来源', url: '', timeframe: '本月', potential: '高', difficulty: '高', audience: '有算力资源者', action: '梳理区域闲置算力,做一个撮合信息小程序验证需求。' },
        { title: '示例:垂直行业知识库问答助手', description: '这是演示数据。描述细分行业与差异化。', detail: '这是演示详情。会说明选哪个细分行业、这个行业高频且付费意愿强的问题是什么、通用大模型为什么答不好(缺私域数据、术语与流程差异),切入点做成交付项目还是订阅工具,需要的行业资源与数据获取门槛,以及交付后维护成本偏高的风险。', track: '企业服务', origin: '市场商机', level: '', region: '', policy: '', source: '示例来源', url: '', timeframe: '本月', potential: '中', difficulty: '中', audience: '有行业资源者', action: '锁定熟悉行业,整理高频问题清单。' },
        { title: '示例:城市"人工智能+"行动催生的政务大模型集成', description: '这是演示数据。解析某市最新 AI 行动计划,面向政务场景做垂直模型集成与运维。', detail: '这是演示详情。会指出该市行动计划里明确要求落地的事项与时间节点、预算来源、哪些场景由本地供应商承接,小团队可通过哪种合作方式进入(分包、试点、数据集整理),需要的资质与本地关系,以及招投标周期长、账期慢、模型效果验收标准不确定等风险。', track: 'AI+政务/城市治理', origin: '政策规划', level: '市级', region: '杭州市', policy: '《杭州市人工智能产业高质量发展行动计划》(示例)', source: '示例来源', url: '', timeframe: '本月', potential: '中', difficulty: '高', audience: '有政企渠道者', action: '研究当地行动清单,对接一个街道级试点场景。' },
        { title: '示例:AI 短视频脚本与分镜工具', description: '这是演示数据。说明输入输出与目标用户。', detail: '这是演示详情。会讲清目标用户是谁(带货号、本地商家、剪辑外包)、现在做一条视频的时间成本、工具输入什么输出什么(选题→脚本→分镜→提示词),为什么模型升级后这一步可行,获客方式与主要风险(免费竞品多、留存靠产出效果)。', track: 'AI+内容/文创', origin: '市场商机', level: '', region: '', policy: '', source: '示例来源', url: '', timeframe: '本周', potential: '高', difficulty: '低', audience: '自媒体', action: '做只解决"脚本→分镜"的小工具验证需求。' },
        { title: '示例:本地鞋服产业集群的 AI 质检与打版', description: '这是演示数据。结合福建本地鞋服/纺织产业集群,用视觉模型做质检与自动打版,替代人工。', detail: '这是演示详情。会指出本地的具体依据:哪个地市出台了产业数字化措施、有哪些园区或产业集群清单、可用的补助或基金方向;当地产业与资源优势(打样频次高、返单快);可承接的切入点(先做单一工序的视觉质检、按产线收费),需要的本地关系与硬件配合,以及工厂配合度低、数据采集周期长的风险。', track: '智能制造', origin: '本地机会', level: '市级', region: '泉州市', policy: '《泉州市人工智能产业发展若干措施》(示例)', source: '示例来源', url: '', timeframe: '本月', potential: '高', difficulty: '中', audience: '有制造业渠道者', action: '走访 2 家本地鞋服厂,拍样本图做质检小模型验证。' }
      ],
      tech: [
        { title: '示例:稀疏注意力机制', en: 'Sparse Attention', principle: '这是演示数据。真实使用时会用大白话解释:让模型在处理长文本时不再"字字都看",而是有重点地挑选关键位置计算,从而大幅降低算力开销。', why: '长上下文成本下降,长文档、长视频理解更便宜可用。', detail: '这是演示详情。会往深一层讲:它要解决的是注意力随序列长度平方增长的成本问题;关键做法是怎么挑选"该看的位置"(动态选块、层级稀疏、可学习路由);相比窗口注意力或线性注意力强在哪;目前的局限(实现复杂、短文本无收益、部分任务精度回退);以及哪些模型或推理框架已经用上。', track: '大模型/基础模型', stage: '研究突破', source: '示例来源', url: '', date: dAgo(0) },
        { title: '示例:推理时扩展', en: 'Test-time Scaling', principle: '这是演示数据。指模型在回答前多花算力"想一想"(生成并筛选多条思路),用更多推理时间换更高准确率,而不是只靠把模型训得更大。', why: '不换模型也能显著提升难题表现,影响 API 定价与用法。', detail: '这是演示详情。会说明具体做法(采样多条推理链后用奖励模型或自我一致性筛选、搜索式推理、过程监督),在数学与代码基准上相比单纯扩规模的增益,代价是延迟与 token 消耗数倍上升、简单任务反而变慢变差,以及目前哪些产品已经按"思考档位"计费。', track: '大模型/基础模型', stage: '早期产品', source: '示例来源', url: '', date: dAgo(1) },
        { title: '示例:多智能体协作框架', en: 'Multi-Agent Framework', principle: '这是演示数据。把一个大任务拆给多个各有分工的 AI"智能体",让它们像小团队一样分工、互相检查结果,再汇总产出。', why: '让 AI 能自动完成更长的流程,是一人公司自动化的关键。', detail: '这是演示详情。会讲清常见编排方式(规划者+执行者+审阅者、图式状态机、共享消息总线),与单智能体加工具调用相比强在哪(可并行、可交叉校验、上下文可控),目前的主要局限(错误累积、成本不可预测、调试困难),以及已经被用在哪些场景(代码库改造、调研、客服工单)。', track: '通用应用/工具', stage: '早期产品', source: '示例来源', url: '', date: dAgo(2) },
        { title: '示例:端侧小模型', en: 'On-device SLM', principle: '这是演示数据。指参数量更小、经过蒸馏或量化、能直接跑在手机/电脑本地而不必联网调用云端的模型。', why: '隐私更好、离线可用、调用零边际成本,利好端侧应用。', detail: '这是演示详情。会说明典型规模与量化方式、在哪些手机/PC 芯片上能跑到什么速度、与云端旗舰模型的能力差距集中在哪(复杂推理、长上下文、多模态),适用与不适用的场景,以及当前落地的代表产品与生态限制。', track: '智能算力/AI芯片', stage: '规模落地', source: '示例来源', url: '', date: dAgo(3) }
      ],
      rankOverview: '这是演示总评。真实使用时,这里会用 60–100 字概括当前各大榜单的竞争格局:谁在综合榜领跑、哪些细分赛道刚换榜首、值得注意的新模型。',
      ranks: [
        { title: '示例:某旗舰推理模型 V2', vendor: '示例厂商A', rank: 1, track: '综合总榜', score: '1452 ± 9', note: '综合对话与指令遵循最稳,日常通用首选。', detail: '这是演示详情。会说明该名次来自哪个综合竞技场榜单、样本量与统计区间、相比第二名强在哪些维度(长文理解、多轮一致性)、价格档位与延迟表现,以及它在哪些细分任务上反而不如更便宜的模型。', source: '示例榜单', url: '', date: '2026-10' },
        { title: '示例:开源全能模型 72B', vendor: '示例厂商B', rank: 2, track: '综合总榜', score: '1431 ± 10', note: '开源里最能打,可自部署控成本。', detail: '这是演示详情。会说明它的开源协议与商用限制、自部署所需显存与推理成本、与闭源旗舰的差距集中在哪(复杂推理、工具调用稳定性),以及哪些团队适合用它替代闭源 API。', source: '示例榜单', url: '', date: '2026-10' },
        { title: '示例:深度思考模型 R1', vendor: '示例厂商C', rank: 1, track: '逻辑推理', score: 'GPQA 88.1%', note: '数学与科学推理基准第一,难题慢思考。', detail: '这是演示详情。会说明它在 GPQA / AIME 等基准的具体分数与口径、推理耗时与 token 成本、在简单问题上是否反而不如快模型,以及适合的使用方式(难题单独路由给它)。', source: '示例基准', url: '', date: '2026-09' },
        { title: '示例:视频生成模型 S2', vendor: '示例厂商D', rank: 1, track: '视频生成', score: 'VBench 86.4', note: '运动连贯性与指令跟随当前最强。', detail: '这是演示详情。会说明它在 VBench 等视频评测的分项表现(运动幅度、时序一致、画面质量)、可生成的时长与分辨率、商用价格,以及人物一致性等仍容易翻车的场景。', source: '示例评测', url: '', date: '2026-09' },
        { title: '示例:编程智能体 C3', vendor: '示例厂商E', rank: 1, track: '代码编程', score: 'SWE-bench 74.2%', note: '真实仓库修 bug 通过率最高,工程向首选。', detail: '这是演示详情。会说明 SWE-bench Verified 的通过率与对比基线、在长任务(多文件重构)上的稳定性、订阅价格与额度,以及它在非 Python 语言上的表现差异。', source: '示例基准', url: '', date: '2026-10' }
      ]
    };
  }

  // ---------- 事件 ----------
  function bind() {
    $('settingsBtn').addEventListener('click', openSettings);
    $('settingsClose').addEventListener('click', closeSettings);
    $('saveSettings').addEventListener('click', saveSettings);
    $('testBtn').addEventListener('click', testConnection);
    $('setProvider').addEventListener('change', applyProviderPreset);
    $('openPickerBtn').addEventListener('click', openPicker);
    $('pickerClose').addEventListener('click', closePicker);
    $('pickerFetchBtn').addEventListener('click', fetchModels);
    $('pickerSearch').addEventListener('input', function () { renderPickerList(this.value); });
    $('pickerList').addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('.picker__item') : null;
      if (!item) return;
      $('setModel').value = item.getAttribute('data-model');
      renderPickerList($('pickerSearch').value); closePicker();
    });
    $('settingsModal').addEventListener('click', function (e) { if (e.target.getAttribute('data-close')) closeSettings(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('detailModal').hidden) closeDetail();
      else if (!$('genModal').hidden) closeGenModal();
      else if (!$('settingsModal').hidden) closeSettings();
    });
    $('detailModal').addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-detailclose]')) closeDetail();
    });

    $('genNewsBtn').addEventListener('click', function () { openGenModal('news'); });
    $('genOpsBtn').addEventListener('click', function () { openGenModal('ops'); });
    $('genSumBtn').addEventListener('click', function () { openGenModal('sum'); });
    $('genTechBtn').addEventListener('click', function () { openGenModal('tech'); });
    $('genRankBtn').addEventListener('click', function () { openGenModal('rank'); });
    $('genConfirmBtn').addEventListener('click', confirmGenModal);
    $('genModal').addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('[data-genclose]')) { closeGenModal(); return; }
      var gr = e.target.closest('[data-genrange]');
      if (gr) { genSel.range = parseInt(gr.getAttribute('data-genrange'), 10) || 3; renderGenModal(); return; }
      var gtr = e.target.closest('[data-gentechrange]');
      if (gtr) { genSel.techRange = parseInt(gtr.getAttribute('data-gentechrange'), 10) || 30; renderGenModal(); return; }
      var gm = e.target.closest('[data-genmode]');
      if (gm) { genSel.mode = gm.getAttribute('data-genmode'); renderGenModal(); }
    });

    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () {
        state.view = tab.getAttribute('data-view');
        markViewed(state.view);
        Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
          var on = t === tab; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        render();
      });
    });

    $('netPrev').addEventListener('click', function () { if (netApi) netApi.step(-1); });
    $('netNext').addEventListener('click', function () { if (netApi) netApi.step(1); });
    // 暂停 3D 会写 localStorage,关浏览器前必须还原,否则下次进来背景被静默关掉
    window.addEventListener('pagehide', function () { if (netBgPaused) setBgPaused(false); });
    $('netRouteChips').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-netroute]') : null;
      if (!btn) return;
      state.filters.netRoute = btn.getAttribute('data-netroute');
      if (netApi) netApi.pick(state.filters.netRoute);
      renderNetChips();
    });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t.closest) return;
      var card = t.closest('[data-detail]');
      if (card && !t.closest('a')) {
        var v = card.getAttribute('data-detail'), i = v.indexOf(':');
        openDetail(v.slice(0, i), v.slice(i + 1));
        return;
      }
      var retry = t.closest('[data-retry]');
      if (retry) {
        var k = retry.getAttribute('data-retry');
        if (k === 'news') generateNews();
        else if (k === 'sum') generateSum();
        else if (k === 'tech') generateTech();
        else if (k === 'rank') generateRank();
        else { var sm = retry.getAttribute('data-setmode'); if (OPS_MODES[sm]) state.opsMode = sm; generateOps(); }
        return;
      }
      if (t.closest('[data-open-settings]')) { if (ADMIT) openSettings(); return; }
      var chip = t.closest('.chip[data-group]');
      if (chip) { state.filters[chip.getAttribute('data-group')] = chip.getAttribute('data-val'); render(); }
    });
  }

  function syncStale() {
    if (state.settings.demo || !configured() || !state.settings.autoSync) return;
    // 汇总优先,其次前沿技术、新闻、商机(当前模式);仅当"今天还没同步过"才调用,避免重复消耗 token
    if (isStale(state.sum)) generateSum({ silent: true });
    if (state.tech && isStale(state.tech)) generateTech({ silent: true });
    if (isStale(state.rank)) generateRank({ silent: true });
    if (isStale(state.news)) generateNews({ silent: true });
    if (isStale(state.ops)) generateOps({ silent: true });
  }

  // ---------- 公开快照:未配置 Key 的访客看站长每日生成的数据 ----------
  function hasAnyItems() {
    var ks = ['news', 'ops', 'sum', 'tech', 'rank'];
    for (var i = 0; i < ks.length; i++) {
      var b = state[ks[i]];
      if (b && b.items && b.items.length) return true;
    }
    return false;
  }
  function adoptSnapshot(snap) {
    ['sum', 'tech', 'news', 'rank', 'ops'].forEach(function (k) {
      var b = snap[k];
      if (!b || !Array.isArray(b.items)) return;
      var prev = (state[k] && state[k].items) || [];
      var prevIds = {};
      prev.forEach(function (it) { if (it && it.id) prevIds[it.id] = 1; });
      core.stampExisting(k, b.items);
      // 已有本地数据时按访客视角重算 NEW(自上次访问后新增的才算);首访则沿用快照自带的 NEW(最新一轮生成的新增)
      if (prev.length) b.items.forEach(function (it) { it.isNew = !prevIds[it.id]; });
      b.status = b.items.length ? 'ready' : 'idle';
      b.syncing = false; b.loadingMode = null;
      b.error = ''; b.errorMeta = ''; b.errorDetail = '';
      b.loadError = ''; b.loadErrorDetail = ''; b.loadErrorMode = '';
      b.newCount = core.countNew(b.items); b.tabNew = b.newCount;
      state[k] = b;
    });
    state.snapshot = { ts: snap.generated_ts, model: snap.model || '', at: snap.generated_at || '' };
    state.snapshotError = '';
    saveCache();
  }
  function loadSnapshot() {
    var hadData = hasAnyItems();
    function fail(e) {
      if (hadData) return; // 本地已有旧数据:继续用,不打扰
      // 不退回演示数据:访客看到「示例模型」会当成真实排行,而提示的「设置」入口普通访客根本没有
      state.snapshotError = (e && e.message) || String(e);
      render();
    }
    function attempt(left) {
      fetch('data/snapshot.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status + (r.status === 404 ? '(快照文件不存在)' : ''));
          return r.json();
        })
        .then(function (snap) {
          if (!snap || typeof snap.generated_ts !== 'number') throw new Error('快照文件格式不正确(缺少 generated_ts)');
          if (hadData && state.snapshot && state.snapshot.ts === snap.generated_ts) return; // 与本地一致,无需重灌
          adoptSnapshot(snap);
          markViewed(state.view);
          render();
        })
        .catch(function (e) {
          // 重新部署的瞬间或网络抖一下就会读空:隔 1.5 秒静默重试一次再报错
          if (left > 0) { setTimeout(function () { attempt(left - 1); }, 1500); return; }
          fail(e);
        });
    }
    attempt(1);
  }

  // ---------- 启动 ----------
  function init() {
    // 管理面(设置入口、来源/token 芯片、各板块「生成」按钮与参数标签)统一由 CSS 按 html.admit 控制:
    // 默认隐藏,所以普通访客在 JS 之前也不会闪出这些控件;带 ?admit=true 才加上这个类。
    if (ADMIT) document.documentElement.classList.add('admit');
    bind();
    var cache = loadCache();
    if (cache) {
      if (cache.news && cache.news.status === 'ready' && cache.news.items && cache.news.items.length) { state.news = cache.news; stampExisting('news', state.news.items); }
      if (cache.ops && cache.ops.status === 'ready' && cache.ops.items && cache.ops.items.length) { state.ops = cache.ops; stampExisting('ops', state.ops.items); }
      if (cache.sum && cache.sum.status === 'ready' && cache.sum.items && cache.sum.items.length) { state.sum = cache.sum; stampExisting('sum', state.sum.items); }
      if (cache.tech && cache.tech.status === 'ready' && cache.tech.items && cache.tech.items.length) { state.tech = cache.tech; stampExisting('tech', state.tech.items); }
      if (cache.rank && cache.rank.status === 'ready' && cache.rank.items && cache.rank.items.length) { state.rank = cache.rank; stampExisting('rank', state.rank.items); }
      if (cache.snap && cache.snap.ts) state.snapshot = cache.snap;
    }
    if (state.settings.demo) { loadDemoNews(); loadDemoOps(); loadDemoSum(); loadDemoTech(); loadDemoRank(); return; }
    if (configured()) { markViewed(state.view); render(); syncStale(); return; }
    // 未配置 Key:先渲染本地缓存,再拉取公开快照
    markViewed(state.view);
    render();
    loadSnapshot();
  }
  init();
})();
