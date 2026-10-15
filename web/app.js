/* AI 风向标 · 纯本地个人工具
 * 浏览器直连你配置的大模型 API(默认阿里云百炼 / 千问,OpenAI 兼容)。
 * 无后端:API Key 只存在本机浏览器 localStorage,不会上传或写入文件。
 * 新闻与商机分开生成,单次请求更小、更易在超时内跑通;新闻可按 1/3/5/7 天缩量。
 */
(function () {
  'use strict';

  var STORE_KEY = 'ai-fxb-settings-v1';
  var CACHE_KEY = 'ai-fxb-cache-v4';
  var MODELS_KEY = 'ai-fxb-models-v1';
  var USAGE_KEY = 'ai-fxb-usage-v1';

  var DEFAULTS = {
    provider: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'qwen-plus',
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
      model: 'qwen-plus',
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

  var RANGES = [1, 3, 5, 7];
  var TECH_RANGES = [30, 60, 90];
  var RANGE_COUNT = { 1: [4, 6], 3: [6, 8], 5: [8, 10], 7: [9, 12] };
  var NEWS_CATS = ['全部', '模型发布', '融资并购', '政策监管', '产品应用', '研究突破', '行业动态'];
  var REGIONS = ['全部', '全球', '中国', '美国', '欧洲', '其他'];
  var IMPS = ['全部', '重大', '一般'];
  var OPS_TIMES = ['全部', '本周', '本月'];
  var OPS_ORIGINS = ['全部', '政策规划', '市场商机', '本地机会'];
  // 赛道固定枚举:提示词与筛选共用;卡片按 track 标签区分
  var OPS_TRACKS = ['大模型/基础模型', '智能算力/AI芯片', '具身智能/机器人', '自动驾驶/智能车', '智能制造', 'AI+医疗', 'AI+金融', '数据要素', 'AI+政务/城市治理', '低空经济', 'AI+内容/文创', 'AI+教育', 'AI安全/治理', '通用应用/工具'];
  var OPS_TRACK_ENUM = OPS_TRACKS.join(',');
  var OPS_LEVELS = ['国家级', '省级', '市级'];
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
    usage: loadUsage(),
    filters: { newsCat: '全部', newsRegion: '全部', newsImp: '全部', opsTime: '全部', opsTrack: '全部', opsOrigin: '全部', techTrack: '全部' }
  };

  // ---------- 工具 ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtTime(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtDateTime(ts) { return fmtDate(new Date(ts)) + ' ' + fmtTime(ts); }
  function loadSettings() {
    var s, hasProvider = false;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) { s = Object.assign({}, DEFAULTS); s.demo = true; s._first = true; return s; }
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
    var s = Object.assign({}, state.settings); delete s._first;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function loadCache() {
    try { var raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ news: state.news, ops: state.ops, sum: state.sum, tech: state.tech }));
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

  // ---------- 数据层:稳定 id + 历史保留 + NEW 判定 ----------
  var MAX_ITEMS = { news: 60, sum: 24, tech: 40, ops: 60 };
  var HISTORY_DAYS = 21; // 超过此天数的历史条目自动淘汰
  function todayStr() { return fmtDate(new Date()); }
  function hashStr(s) {
    var h = 2166136261; s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function itemId(kind, it) {
    // 汇总项的 date 是后加的:排除在 id 之外,同一条新闻再抓回来仍是同一个 id,不会变成重复的新条目
    var extra = kind === 'sum' ? '' : (it.date || it.policy || it.term || '');
    return kind + '_' + hashStr((it.title || '') + '|' + (it.url || '') + '|' + extra);
  }
  function ageDays(firstSeen) {
    if (!firstSeen) return 0;
    var t = Date.parse(firstSeen + 'T00:00:00');
    if (isNaN(t)) return 0;
    return Math.floor((Date.now() - t) / 86400000);
  }
  // 排序键:优先条目自身日期(YYYY-MM-DD),缺失则回退到首次入库日;用于"最新在前"的时间倒序
  function itemDateKey(it) {
    var d = String((it && it.date) || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return (it && it.firstSeen) || '';
  }
  // 合并:本次新拉取 + 上次历史;未见过的 id 标 isNew,已见过的保留其 firstSeen
  function mergeBucketItems(kind, oldItems, newItems) {
    oldItems = Array.isArray(oldItems) ? oldItems : [];
    newItems = Array.isArray(newItems) ? newItems : [];
    var oldById = {}, seen = {}, merged = [];
    oldItems.forEach(function (o) { if (o && o.id) oldById[o.id] = o; });
    newItems.forEach(function (n) {
      if (!n.id) n.id = itemId(kind, n);
      if (seen[n.id]) return;
      seen[n.id] = 1;
      var prev = oldById[n.id];
      if (prev) { n.firstSeen = prev.firstSeen || todayStr(); n.isNew = false; }
      else { n.firstSeen = todayStr(); n.isNew = true; }
      merged.push(n);
    });
    oldItems.forEach(function (o) {
      if (!o || !o.id || seen[o.id]) return;
      o.isNew = false;
      merged.push(o);
    });
    merged.sort(function (a, b) {
      var ka = itemDateKey(a), kb = itemDateKey(b);
      if (ka !== kb) return kb.localeCompare(ka); // 时间倒序:最新的放最前面
      if (!!a.isNew !== !!b.isNew) return a.isNew ? -1 : 1;
      return String(b.firstSeen || '').localeCompare(String(a.firstSeen || ''));
    });
    var cap = MAX_ITEMS[kind] || 60;
    merged = merged.filter(function (it) { return ageDays(it.firstSeen) <= HISTORY_DAYS; });
    if (merged.length > cap) merged = merged.slice(0, cap);
    return merged;
  }
  function stampExisting(kind, items) {
    (items || []).forEach(function (it) {
      if (!it.id) it.id = itemId(kind, it);
      if (!it.firstSeen) it.firstSeen = todayStr();
      if (typeof it.isNew !== 'boolean') it.isNew = false;
    });
    return items || [];
  }
  function countNew(items) { return (items || []).filter(function (i) { return i.isNew; }).length; }

  // ---------- 提示词(分块、缩量) ----------
  function newsSchema() {
    return '{"generated_at":"YYYY-MM-DD","news":[{"title":"简体中文标题,不超过36字","summary":"40到80字精炼摘要,一句话说清发生了什么","detail":"150到260字详情,讲清来龙去脉:背景、涉及主体、关键数字或条款、时间线、接下来可能怎样","category":"从[模型发布,融资并购,政策监管,产品应用,研究突破,行业动态]选一个","importance":"重大 或 一般","region":"从[全球,中国,美国,欧洲,其他]选一个","date":"YYYY-MM-DD","source":"来源媒体或机构名","url":"原始链接,没有则空字符串","impact":"一句话影响,20到40字"}]}';
  }
  function buildNewsMessages(range) {
    var today = new Date();
    var dstr = fmtDate(today);
    var start = fmtDate(new Date(today.getTime() - range * 86400000));
    var cc = RANGE_COUNT[range] || [6, 8];
    var sys = '你是「AI 风向标」的情报分析引擎。你会联网检索最新信息,客观汇总,不编造。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
    var user = '今天是 ' + dstr + '。请联网检索 ' + start + ' 至 ' + dstr + '(最近 ' + range + ' 天)全球范围 AI 领域发生的大小事。\n' +
      '严格按以下 JSON 结构输出:\n' + newsSchema() + '\n' +
      '要求:news 给出 ' + cc[0] + ' 到 ' + cc[1] + ' 条,混合"重大"与"一般",地区尽量分散,date 必须落在最近 ' + range + ' 天内,真实可核查,优先附 url 与 source。' +
      '每条的 detail 必须真正补充信息(背景、数字、主体、时间线),不能只是把 summary 换个说法重复一遍;让只读到 summary 的人点进详情能看懂到底发生了什么。全部简体中文。只输出 JSON。';
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }
  function buildOpsMessages(mode) {
    if (mode === 'policy') return buildPolicyOpsMessages();
    if (mode === 'local') return buildLocalOpsMessages();
    return buildAiOpsMessages();
  }
  function buildAiOpsMessages() {
    var dstr = fmtDate(new Date());
    var sys = '你是「AI 风向标」的市场商机分析引擎,面向想发现 AI 商机的个人与小微企业。你会联网了解最近一周全球与中国的 AI 市场动态,并提炼可落地的 AI 赛道商机。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
    var schema = '{"generated_at":"' + dstr + '","opportunities":[{' +
      '"title":"商机标题,不超过26字","description":"40到70字精炼说明:是什么商机、解决什么需求",' +
      '"detail":"120到220字详情,讲清为什么现在是机会、依据哪些近期动态、具体怎么切入、需要什么资源或能力、主要风险与不确定性",' +
      '"track":"从[' + OPS_TRACK_ENUM + ']选一个","timeframe":"本周 或 本月","potential":"高 或 中",' +
      '"difficulty":"高/中/低 选一个","audience":"适合谁做,不超过16字","action":"第一步行动建议,20到40字",' +
      '"source":"依据的来源媒体/机构名,没有则空字符串","url":"参考来源链接,没有则空字符串"}]}';
    var user = '今天是 ' + dstr + '。请结合最近一周全球与中国 AI 市场动态,提炼个人或小微企业能上手的 AI 赛道商机。\n' +
      '严格按以下 JSON 结构输出:\n' + schema + '\n' +
      '要求:opportunities 给出 5 到 7 条,覆盖不同 track 赛道,具体可执行、避免空泛;detail 必须给出可判断的真信息,不能重复 description。全部简体中文。只输出 JSON。';
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }
  function buildPolicyOpsMessages() {
    var today = new Date();
    var dstr = fmtDate(today);
    var start = fmtDate(new Date(today.getTime() - 183 * 86400000));
    var sys = '你是「AI 风向标」的政策商机分析引擎。你会联网检索中国最新的国家级与城市级 AI 相关规划/政策,把它们解析成个人或小微企业能切入的具体商机。政策文件、发布时间与链接必须真实可核查,严禁编造。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
    var schema = '{"generated_at":"' + dstr + '","opportunities":[{' +
      '"title":"商机标题,不超过26字","description":"40到70字精炼说明:政策带来什么商机、解决什么需求",' +
      '"detail":"120到220字详情,讲清政策原文的关键条款或目标与时间表、由此释放出的具体需求、个人或小团队可承接的切入点、需要什么资质或资源、主要不确定性",' +
      '"track":"从[' + OPS_TRACK_ENUM + ']选一个","level":"从[国家级,省级,市级]选一个",' +
      '"region":"全国 或对应省市名","policy":"规划/政策全称+发布时间,如《XX行动计划》(2025-XX)",' +
      '"source":"发布机构名,如工信部/某市人民政府","url":"政策原文或权威来源链接,没有则空字符串","timeframe":"本周 或 本月","potential":"高 或 中",' +
      '"difficulty":"高/中/低 选一个","audience":"适合谁做,不超过16字","action":"第一步行动建议,20到40字"}]}';
    var user = '今天是 ' + dstr + '。请联网检索中国 ' + start + ' 至今(近半年)最新的国家级与城市级 AI 相关规划/政策,把每条政策解析成对应的落地商机。\n' +
      '严格按以下 JSON 结构输出:\n' + schema + '\n' +
      '要求:\n' +
      '1) opportunities 给出 5 到 7 条,来源覆盖国家级(如"人工智能+"行动、全国一体化算力网、"数据要素×"行动等)与城市级(如北京/上海/深圳/杭州/广州/成都/合肥等近半年发布的人工智能行动计划或若干措施),层级与城市尽量分散;\n' +
      '2) 每条覆盖不同 track 赛道,务必写清 policy(全称+发布时间)、level、region,尽量附官方 url,真实可核查;\n' +
      '3) 商机要具体、个人或小微企业可执行。全部简体中文。只输出 JSON。';
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  // 本地机会:结合用户配置的所在地区,检索当地 AI 政策/产业/场景,提炼本地可落地商机
  function buildLocalOpsMessages() {
    var today = new Date();
    var dstr = fmtDate(today);
    var start = fmtDate(new Date(today.getTime() - 183 * 86400000));
    var region = (state.settings.region || '').trim() || '福建省';
    var sys = '你是「AI 风向标」的本地商机分析引擎。你会联网检索中国' + region + '最近的人工智能相关政策、产业布局、园区/基金/场景开放与本地企业动态,把它们解析成个人或小微企业能在' + region + '本地切入的具体商机。政策文件、发布时间与链接必须真实可核查,严禁编造。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
    var schema = '{"generated_at":"' + dstr + '","opportunities":[{' +
      '"title":"商机标题,不超过26字","description":"40到70字精炼说明:' + region + '本地这个机会是什么、解决什么需求",' +
      '"detail":"120到220字详情,讲清' + region + '本地的具体依据(哪个地市/哪份文件或哪个园区、基金、场景清单)、当地产业与资源优势、可承接的切入点、需要什么资源或本地关系、主要风险",' +
      '"track":"从[' + OPS_TRACK_ENUM + ']选一个","level":"从[国家级,省级,市级]选一个,没有明确层级则留空字符串",' +
      '"region":"' + region + '内的具体地市/区县,或整个' + region + '","policy":"所依据的本地规划/政策/事件全称+发布时间,没有则空字符串",' +
      '"source":"发布或报道该信息的本地机构名,没有则空字符串","url":"官方或权威来源链接,没有则空字符串","timeframe":"本周 或 本月","potential":"高 或 中",' +
      '"difficulty":"高/中/低 选一个","audience":"适合谁做,不超过16字","action":"第一步行动建议,20到40字"}]}';
    var user = '今天是 ' + dstr + '。请联网检索中国' + region + ' ' + start + ' 至今(近半年)最新的 AI 相关规划/政策/产业动态(如' + region + '及下辖地市的人工智能行动计划、算力/数据要素政策、场景开放清单、产业基金、园区招商等),把每条解析成' + region + '本地个人或小微企业能落地的商机。\n' +
      '严格按以下 JSON 结构输出:\n' + schema + '\n' +
      '要求:\n' +
      '1) opportunities 给出 5 到 7 条,尽量覆盖' + region + '内不同地市与不同 track 赛道;\n' +
      '2) 每条写清 region(具体到地市/区县)、尽量写清 policy(全称+发布时间)与 level,并尽量附官方 url,真实可核查、不得编造;\n' +
      '3) 商机要具体、结合本地产业特色(如当地优势行业、集群、资源),个人或小微企业可执行。全部简体中文。只输出 JSON。';
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  function buildSumMessages(range) {
    var today = new Date();
    var dstr = fmtDate(today);
    var start = fmtDate(new Date(today.getTime() - range * 86400000));
    var sys = '你是「AI 风向标」的汇总编辑。你会联网检索最新信息,用简洁中文写导读与要点,不编造。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
    var user = '今天是 ' + dstr + '。请联网检索 ' + start + ' 至 ' + dstr + '(最近 ' + range + ' 天)全球 AI 大小事,写一份"快速汇总",供不想逐条细读的人 30 秒看完。\n' +
      '严格按以下 JSON 结构输出:\n' +
      '{"generated_at":"' + dstr + '","overview":"80到140字的整体导读,概括这几天 AI 领域的主线与氛围","highlights":[{"title":"要点标题,不超过24字","takeaway":"一句话精炼要点,20到45字,说明发生了什么、为什么值得关注","detail":"120到220字详情,讲清这条要点的来龙去脉:背景、涉及主体、关键数字或条款、时间线、后续影响","tag":"主题标签,如 模型/融资/监管/产品/研究","date":"该事件日期 YYYY-MM-DD","source":"来源名","url":"原始链接,没有则空字符串"}]}\n' +
      '要求:highlights 给出 5 到 8 条,覆盖不同主题;每条尽量附真实 url 与 source 以便点击深读;detail 必须真正补充信息,不能只是复述 takeaway;date 填事件真实日期,输出按 date 从新到旧排列。全部简体中文。只输出 JSON。';
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }
  function normalizeSum(obj) {
    var hl = Array.isArray(obj.highlights) ? obj.highlights : [];
    return {
      generated_at: obj.generated_at || fmtDate(new Date()),
      overview: obj.overview || '',
      items: hl.map(function (h) {
        return {
          title: h.title || '未命名要点', takeaway: h.takeaway || '', detail: h.detail || '', tag: h.tag || '综合',
          date: h.date || '', source: h.source || '', url: h.url || ''
        };
      })
    };
  }

  // 前沿技术:最近出现的新技术 / 新名词,用大白话讲清原理
  function buildTechMessages(range) {
    range = range || state.techRange || 30;
    var today = new Date();
    var dstr = fmtDate(today);
    var start = fmtDate(new Date(today.getTime() - range * 86400000));
    var sys = '你是「AI 风向标」的前沿技术解读引擎,面向想跟上 AI 节奏、又怕被术语劝退的普通人。你会联网检索最近真正冒出来的新技术、新架构、新名词,并用大白话讲清它的原理与意义,不编造、不堆砌旧概念。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
    var schema = '{"generated_at":"' + dstr + '","tech":[{' +
      '"term":"技术/名词名称(中文,可含英文缩写),不超过20字",' +
      '"en":"英文原名或缩写,没有则空字符串",' +
      '"principle":"60到120字,用大白话讲清它是什么、大致怎么工作的,尽量少用行话,必要术语随手解释",' +
      '"why":"30到60字,说明它为什么值得关注、能带来什么改变",' +
      '"detail":"150到260字详情,再往深一层:它要解决的具体问题、与已有方案相比强在哪、关键做法或架构思路、目前的局限与代价、谁已经在用或落地到什么程度",' +
      '"track":"从[' + OPS_TRACK_ENUM + ']选一个",' +
      '"stage":"从[研究突破,早期产品,规模落地]选一个",' +
      '"source":"来源媒体/机构/论文名","url":"原始链接,没有则空字符串","date":"YYYY-MM-DD"}]}';
    var user = '今天是 ' + dstr + '。请联网检索 ' + start + ' 至今(最近约 ' + range + ' 天)AI 领域最新出现、正在被讨论的技术 / 架构 / 名词(例如新型注意力或推理机制、新的 Agent 框架、多模态方法、训练/推理优化、代表性新模型的关键技术等),挑真正"新"的,不要把早已普及的旧概念当新事物。\n' +
      '严格按以下 JSON 结构输出:\n' + schema + '\n' +
      '要求:tech 给出 6 到 9 条,覆盖不同 track 赛道与不同 stage 阶段;principle 必须让外行也看得懂;每条尽量附真实 url 以便深读;date 填该技术/报道真实出现的具体日期(YYYY-MM-DD),务必尽量新,不要把窗口最早那天的旧事物当新内容;输出按 date 从新到旧排列。全部简体中文。只输出 JSON。';
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }
  function normalizeTech(obj) {
    var arr = Array.isArray(obj.tech) ? obj.tech : [];
    return {
      generated_at: obj.generated_at || fmtDate(new Date()),
      items: arr.map(function (t) {
        var track = (typeof t.track === 'string' && t.track.trim()) ? t.track.trim() : '通用应用/工具';
        return {
          title: t.term || '未命名技术', en: t.en || '', principle: t.principle || '', why: t.why || '',
          detail: t.detail || '',
          track: track, stage: ['研究突破', '早期产品', '规模落地'].indexOf(t.stage) >= 0 ? t.stage : '早期产品',
          source: t.source || '', url: t.url || '', date: t.date || ''
        };
      })
    };
  }

  function extractJSON(text) {
    var t = String(text || '').trim();
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    var s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    return JSON.parse(t);
  }
  function normalizeNews(obj) {
    var arr = Array.isArray(obj.news) ? obj.news : [];
    return {
      generated_at: obj.generated_at || fmtDate(new Date()),
      items: arr.map(function (n) {
        return {
          title: n.title || '未命名事件', summary: n.summary || '', detail: n.detail || '', category: n.category || '行业动态',
          importance: n.importance === '重大' ? '重大' : '一般', region: n.region || '全球',
          date: n.date || '', source: n.source || '', url: n.url || '', impact: n.impact || ''
        };
      })
    };
  }
  function normalizeOps(obj) {
    var arr = Array.isArray(obj.opportunities) ? obj.opportunities : [];
    return {
      generated_at: obj.generated_at || fmtDate(new Date()),
      items: arr.map(function (o) {
        var origin = o.origin === '政策规划' ? '政策规划' : (o.origin === '本地机会' ? '本地机会' : '市场商机');
        var track = (typeof o.track === 'string' && o.track.trim()) ? o.track.trim() : '通用应用/工具';
        return {
          title: o.title || '未命名商机', description: o.description || '', detail: o.detail || '',
          track: track, origin: origin,
          level: OPS_LEVELS.indexOf(o.level) >= 0 ? o.level : '',
          region: o.region || '',
          policy: o.policy || '',
          source: o.source || '',
          url: o.url || '',
          timeframe: o.timeframe === '本月' ? '本月' : '本周', potential: o.potential === '高' ? '高' : '中',
          difficulty: ['高', '中', '低'].indexOf(o.difficulty) >= 0 ? o.difficulty : '中',
          audience: o.audience || '', action: o.action || ''
        };
      })
    };
  }

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
      bucket.error = '还没有配置大模型 API。请先在「设置」里填写 Base URL、API Key 和模型。';
      bucket.errorMeta = ''; bucket.errorDetail = '';
      render(); openSettings();
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

  // ---------- 生成二次确认弹窗 ----------
  // 生成按钮不再直接发请求:点击后弹出确认框,在框内选范围/类型,点「确认生成」才真正发起。
  var GEN_KINDS = {
    news: { title: '生成 · AI 大事件', opt: 'range', run: function () { generateNews(); } },
    sum: { title: '生成 · AI 汇总', opt: 'range', run: function () { generateSum(); } },
    tech: { title: '生成 · 前沿技术', opt: 'techrange', run: function () { generateTech(); } },
    ops: { title: '生成 · 商机雷达', opt: 'mode', run: function () { generateOps(); } }
  };
  var genSel = { kind: null, range: 3, techRange: 30, mode: 'ai' };

  function genModalHtml() {
    var def = GEN_KINDS[genSel.kind], out = '';
    if (def.opt === 'range') {
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
    readSettingsForm(); delete state.settings._first; persistSettings(); closeSettings();
    if (window.__bg3d) window.__bg3d.setEnabled($('setThree').checked);
    if (state.settings.demo) { loadDemoNews(); loadDemoOps(); loadDemoSum(); loadDemoTech(); }
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
    $('panel-news').classList.toggle('is-active', state.view === 'news');
    $('panel-ops').classList.toggle('is-active', state.view === 'ops');
    $('panel-sum').classList.toggle('is-active', state.view === 'sum');
    $('panel-tech').classList.toggle('is-active', state.view === 'tech');
    renderSelLabels();
    renderNewsPanel();
    renderOpsPanel();
    renderSumPanel();
    renderTechPanel();
  }

  function renderSource() {
    var chip = $('sourceChip'), label = $('sourceLabel'), s = state.settings;
    chip.className = 'source-chip';
    if (s.demo) { chip.classList.add('is-demo'); label.textContent = '演示数据'; }
    else if (s.apiKey) { chip.classList.add('is-live'); label.textContent = (s.model || 'API') + (s.enableSearch ? ' · 联网' : ''); }
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
    var map = { sum: state.sum, tech: state.tech, ops: state.ops, news: state.news };
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
    return !!(state.news.syncing || state.sum.syncing || state.ops.syncing || (state.tech && state.tech.syncing));
  }
  function totalNew() {
    return countNew(state.news.items) + countNew(state.sum.items) + countNew(state.ops.items) + (state.tech ? countNew(state.tech.items) : 0);
  }
  function lastFetchTs() {
    return Math.max(state.news.fetched_at || 0, state.sum.fetched_at || 0, state.ops.fetched_at || 0, (state.tech && state.tech.fetched_at) || 0);
  }
  function renderUpdated() {
    var el = $('updatedLine');
    if (state.settings.demo) { el.textContent = '⚠ 演示模式:以下为内置示例数据,非真实检索结果。请在「设置」填写千问 API 并关闭演示模式。'; el.style.color = '#fde68a'; return; }
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
    var os = $('opsSel'); if (os) os.innerHTML = '类型 <b>' + esc(OPS_MODES[state.opsMode].label) + '</b>';
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
      (configured() || state.settings.demo ? '' : '<button class="btn btn--ghost state__action" data-open-settings="1">打开设置</button>') +
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
    if (!ready) { st.innerHTML = panelStateHtml(b, 'news', configured() ? '点右上「生成新闻」开始检索。' : '请先在「设置」配置 API,再生成。'); return; }
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
    if (!ready) { st.innerHTML = panelStateHtml(b, 'ops', configured() ? '先在上方选择类型,再点对应的「生成」按钮。两类分开生成、请求更小更易成功。' : '请先在「设置」配置 API,再生成。'); return; }
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
    if (!ready) { st.innerHTML = panelStateHtml(b, 'sum', configured() ? '点右上「生成汇总」,30 秒看完最近几天 AI 大事。' : '请先在「设置」配置 API,再生成。'); return; }
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
    if (!ready) { st.innerHTML = panelStateHtml(b, 'tech', configured() ? '点右上「生成前沿技术」,用大白话看懂最近冒出来的新技术。' : '请先在「设置」配置 API,再生成。'); return; }
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
      return '<div class="stat"><div class="stat__n"' + (s.small ? ' style="font-size:18px"' : '') + '>' + s.n + '</div><div class="stat__l">' + s.l + '</div></div>';
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
      return '<div class="stat"><div class="stat__n"' + (s.small ? ' style="font-size:18px"' : '') + '>' + s.n + '</div><div class="stat__l">' + s.l + '</div></div>';
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
  var KIND_NAME = { news: 'AI 大事件', sum: 'AI 汇总', tech: '前沿技术', ops: '商机雷达' };

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
        else { var sm = retry.getAttribute('data-setmode'); if (OPS_MODES[sm]) state.opsMode = sm; generateOps(); }
        return;
      }
      if (t.closest('[data-open-settings]')) { openSettings(); return; }
      var chip = t.closest('.chip[data-group]');
      if (chip) { state.filters[chip.getAttribute('data-group')] = chip.getAttribute('data-val'); render(); }
    });
  }

  function syncStale() {
    if (state.settings.demo || !configured() || !state.settings.autoSync) return;
    // 汇总优先,其次前沿技术、新闻、商机(当前模式);仅当"今天还没同步过"才调用,避免重复消耗 token
    if (isStale(state.sum)) generateSum({ silent: true });
    if (state.tech && isStale(state.tech)) generateTech({ silent: true });
    if (isStale(state.news)) generateNews({ silent: true });
    if (isStale(state.ops)) generateOps({ silent: true });
  }

  // ---------- 启动 ----------
  function init() {
    bind();
    var cache = loadCache();
    if (state.settings.demo || state.settings._first) { loadDemoNews(); loadDemoOps(); loadDemoSum(); loadDemoTech(); return; }
    if (cache) {
      if (cache.news && cache.news.status === 'ready' && cache.news.items && cache.news.items.length) { state.news = cache.news; stampExisting('news', state.news.items); }
      if (cache.ops && cache.ops.status === 'ready' && cache.ops.items && cache.ops.items.length) { state.ops = cache.ops; stampExisting('ops', state.ops.items); }
      if (cache.sum && cache.sum.status === 'ready' && cache.sum.items && cache.sum.items.length) { state.sum = cache.sum; stampExisting('sum', state.sum.items); }
      if (cache.tech && cache.tech.status === 'ready' && cache.tech.items && cache.tech.items.length) { state.tech = cache.tech; stampExisting('tech', state.tech.items); }
    }
    markViewed(state.view);
    render();
    syncStale();
  }
  init();
})();
