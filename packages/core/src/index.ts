/* AI 窗口 · 共享核心
 * 提示词构建 / 结果归一化 / 稳定 id 与历史合并 / NEW 判定 / 日期工具。
 * 浏览器(apps/console)与 Node 快照脚本(tools/generate-snapshot.mjs)共用同一份编译产物,避免两边提示词漂移。
 * 无副作用、无 DOM、无 fetch:纯函数。
 */

// ---------- 类型 ----------
export interface Message {
  role: 'system' | 'user';
  content: string;
}

export interface ItemBase {
  id?: string;
  firstSeen?: string;
  isNew?: boolean;
  title: string;
  date?: string;
  source?: string;
  url?: string;
  detail?: string;
  // itemId 的兼容字段:历史 id 由 date/policy/term 参与计算,改名会让已入库条目全部变成"新增"
  policy?: string;
  term?: string;
  city?: string;
}

export interface NewsItem extends ItemBase {
  summary: string;
  category: string;
  importance: '重大' | '一般';
  region: string;
  impact: string;
}

export interface SumItem extends ItemBase {
  takeaway: string;
  tag: string;
}

export interface TechItem extends ItemBase {
  en: string;
  principle: string;
  why: string;
  track: string;
  stage: string;
}

export interface OpsItem extends ItemBase {
  description: string;
  track: string;
  origin: string;
  level: string;
  region: string;
  policy: string;
  timeframe: string;
  potential: string;
  difficulty: string;
  audience: string;
  action: string;
  // 上手路径:3 到 5 步,每步一句「做什么 + 做到什么程度 + 在哪做」;cost 是起步投入与周期
  steps: string[];
  cost: string;
}

// 就业形势:某个城市里确实在招的岗位 + 拿到它需要的技术
export interface JobsItem extends ItemBase {
  city: string;
  category: string;
  salary: string;
  demand: string;
  entry: string;
  prepare: string;
  skills: string[];
}

export interface RankItem extends ItemBase {
  vendor: string;
  rank: number;
  track: string;
  score: string;
  note: string;
}

export type AnyItem = NewsItem | SumItem | TechItem | OpsItem | RankItem | JobsItem | ItemBase;
export type BucketKind = 'news' | 'sum' | 'tech' | 'ops' | 'rank' | 'jobs';

// ---------- 日期工具 ----------
export function pad(n: number): string { return n < 10 ? '0' + n : '' + n; }
export function fmtDate(d: Date): string { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function todayStr(): string { return fmtDate(new Date()); }

// ---------- 枚举与上限 ----------
export const RANGES = [1, 3, 5, 7];
export const TECH_RANGES = [30, 60, 90];
export const RANGE_COUNT: Record<number, [number, number]> = { 1: [4, 6], 3: [6, 8], 5: [8, 10], 7: [9, 12] };
export const OPS_TRACKS = ['大模型/基础模型', '智能算力/AI芯片', '具身智能/机器人', '自动驾驶/智能车', '智能制造', 'AI+医疗', 'AI+金融', '数据要素', 'AI+政务/城市治理', '低空经济', 'AI+内容/文创', 'AI+教育', 'AI安全/治理', '通用应用/工具'];
export const OPS_TRACK_ENUM = OPS_TRACKS.join(',');
export const OPS_LEVELS = ['国家级', '省级', '市级'];
// 就业形势:只做这四座城市(站长选的求职半径),两城一组分两次请求,单次响应不至于太长被截
export const JOB_CITIES = ['广州', '深圳', '厦门', '漳州'];
export const JOB_GROUPS: string[][] = [JOB_CITIES.slice(0, 2), JOB_CITIES.slice(2)];
export const JOB_CATS = ['算法与模型', '后端与架构', '前端与终端', '数据与分析', '测试与运维', '产品与运营', '设计与内容', '实施与支持'];
export const JOB_CAT_ENUM = JOB_CATS.join(',');
// 三类商机共用的「怎么上手」字段:光有一句行动建议看不出从哪起步,所以拆成可照做的分步路径 + 起步投入
export const OPS_ACTION_SCHEMA = '"difficulty":"高/中/低 选一个",' +
  '"audience":"适合谁做,不超过16字,写清是什么身份(如 会写 Python 的兼职者/有本地制造业关系的销售)",' +
  '"action":"第一步行动建议,20到40字,必须是今天就能做完的一件具体事",' +
  '"steps":["上手路径,给 3 到 5 步,每步不超过34字:做什么 + 做到什么程度 + 具体在哪里做(平台/渠道/对象要点名,不要写「提升自己能力」这种没法执行的话)"],' +
  '"cost":"起步投入,不超过30字:大概要花多少钱、占用多少业余时间、需要什么设备或账号"';
export const MAX_ITEMS: Record<string, number> = { news: 60, sum: 24, tech: 40, ops: 60, jobs: 30 };
export const HISTORY_DAYS = 21; // 超过此天数的历史条目自动淘汰

// ---------- 稳定 id + 历史保留 + NEW 判定 ----------
export function hashStr(s: unknown): string {
  let h = 2166136261; let str = String(s == null ? '' : s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
export function itemId(kind: string, it: ItemBase): string {
  // jobs 用城市而不是日期参与主键:同一个岗位明天还在招就不该重新标一次 NEW
  const extra = kind === 'sum' ? '' : (kind === 'jobs' ? (it.city || '') : (it.date || it.policy || it.term || ''));
  return kind + '_' + hashStr((it.title || '') + '|' + (it.url || '') + '|' + extra);
}
export function ageDays(firstSeen?: string): number {
  if (!firstSeen) return 0;
  const t = Date.parse(firstSeen + 'T00:00:00');
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}
// 排序键:优先条目自身日期(YYYY-MM-DD),缺失则回退到首次入库日;用于"最新在前"的时间倒序
export function itemDateKey(it: ItemBase): string {
  const d = String((it && it.date) || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return (it && it.firstSeen) || '';
}
// ---------- 占位条目识别(模型查不到时会写「XX待核实 + 来源:检索限制」的空壳,一律丢弃) ----------
const PLACEHOLDER_TITLE = /(待核实|待确认|待补充|未检索到|无法确认|暂无可靠|信息缺失)/;
const PLACEHOLDER_SOURCE = /(检索限制|未检索|无法检索|内部检索|缺少联网|无联网)/;
const PLACEHOLDER_BODY = /(未检索到可靠公开信息|未能检索到|无法访问.{0,12}(网站|新闻|公开信息)|缺少实时联网工具)/;
export function isPlaceholderItem(it: ItemBase): boolean {
  if (!it) return true;
  const any = it as any;
  if (PLACEHOLDER_TITLE.test(String(any.title || ''))) return true;
  if (PLACEHOLDER_SOURCE.test(String(any.source || ''))) return true;
  if (!String(any.url || '') && PLACEHOLDER_BODY.test(String(any.takeaway || '') + String(any.detail || '') + String(any.summary || '') + String(any.description || ''))) return true;
  return false;
}
export function countPlaceholders(items?: ItemBase[]): number { return (Array.isArray(items) ? items : []).filter(isPlaceholderItem).length; }
export function dropPlaceholders<T extends ItemBase>(items: T[] | undefined): T[] {
  return (Array.isArray(items) ? items : []).filter((it) => !isPlaceholderItem(it));
}
// 合并:本次新拉取 + 上次历史;未见过的 id 标 isNew,已见过的保留其 firstSeen
export function mergeBucketItems<T extends ItemBase>(kind: BucketKind, oldItems: T[] | undefined, newItems: T[] | undefined): T[] {
  const old = dropPlaceholders(oldItems);
  const fresh = dropPlaceholders(newItems);
  const oldById: Record<string, T> = {};
  const seen: Record<string, 1> = {};
  let merged: T[] = [];
  old.forEach((o) => { if (o && o.id) oldById[o.id] = o; });
  fresh.forEach((n) => {
    if (!n.id) n.id = itemId(kind, n);
    if (seen[n.id]) return;
    seen[n.id] = 1;
    const prev = oldById[n.id];
    if (prev) { n.firstSeen = prev.firstSeen || todayStr(); n.isNew = false; }
    else { n.firstSeen = todayStr(); n.isNew = true; }
    merged.push(n);
  });
  old.forEach((o) => {
    if (!o || !o.id || seen[o.id]) return;
    o.isNew = false;
    merged.push(o);
  });
  merged.sort((a, b) => {
    const ka = itemDateKey(a), kb = itemDateKey(b);
    if (ka !== kb) return kb.localeCompare(ka); // 时间倒序:最新的放最前面
    if (!!a.isNew !== !!b.isNew) return a.isNew ? -1 : 1;
    return String(b.firstSeen || '').localeCompare(String(a.firstSeen || ''));
  });
  const cap = MAX_ITEMS[kind] || 60;
  merged = merged.filter((it) => ageDays(it.firstSeen) <= HISTORY_DAYS);
  if (merged.length > cap) merged = merged.slice(0, cap);
  return merged;
}
export function stampExisting<T extends ItemBase>(kind: BucketKind, items: T[] | undefined): T[] {
  (items || []).forEach((it) => {
    if (!it.id) it.id = itemId(kind, it);
    if (!it.firstSeen) it.firstSeen = todayStr();
    if (typeof it.isNew !== 'boolean') it.isNew = false;
  });
  return items || [];
}
export function countNew(items?: ItemBase[]): number { return (items || []).filter((i) => i.isNew).length; }

// ---------- 提示词(分块、缩量) ----------
export function newsSchema(): string {
  return '{"generated_at":"YYYY-MM-DD","news":[{"title":"简体中文标题,不超过36字","summary":"40到80字精炼摘要,一句话说清发生了什么","detail":"150到260字详情,讲清来龙去脉:背景、涉及主体、关键数字或条款、时间线、接下来可能怎样","category":"从[模型发布,融资并购,政策监管,产品应用,研究突破,行业动态]选一个","importance":"重大 或 一般","region":"从[全球,中国,美国,欧洲,其他]选一个","date":"YYYY-MM-DD","source":"来源媒体或机构名","url":"原始链接,没有则空字符串","impact":"一句话影响,20到40字"}]}';
}
export function buildNewsMessages(range: number): Message[] {
  const today = new Date();
  const dstr = fmtDate(today);
  const start = fmtDate(new Date(today.getTime() - range * 86400000));
  const cc = RANGE_COUNT[range] || [6, 8];
  const sys = '你是「AI 风向标」的情报分析引擎。你会联网检索最新信息,客观汇总,不编造。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
  const user = '今天是 ' + dstr + '。请联网检索 ' + start + ' 至 ' + dstr + '(最近 ' + range + ' 天)全球范围 AI 领域发生的大小事。\n' +
    '严格按以下 JSON 结构输出:\n' + newsSchema() + '\n' +
    '要求:news 给出 ' + cc[0] + ' 到 ' + cc[1] + ' 条,混合"重大"与"一般",地区尽量分散,date 必须落在最近 ' + range + ' 天内,真实可核查,优先附 url 与 source。' +
    '每条的 detail 必须真正补充信息(背景、数字、主体、时间线),不能只是把 summary 换个说法重复一遍;让只读到 summary 的人点进详情能看懂到底发生了什么。全部简体中文。只输出 JSON。';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
export function buildAiOpsMessages(): Message[] {
  const dstr = fmtDate(new Date());
  const sys = '你是「AI 风向标」的市场商机分析引擎,面向想发现 AI 商机的个人与小微企业。你会联网了解最近一周全球与中国的 AI 市场动态,并提炼可落地的 AI 赛道商机。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
  const schema = '{"generated_at":"' + dstr + '","opportunities":[{' +
    '"title":"商机标题,不超过26字","description":"40到70字精炼说明:是什么商机、解决什么需求",' +
    '"detail":"120到220字详情,讲清为什么现在是机会、依据哪些近期动态、具体怎么切入、需要什么资源或能力、主要风险与不确定性",' +
    '"track":"从[' + OPS_TRACK_ENUM + ']选一个","timeframe":"本周 或 本月","potential":"高 或 中",' +
    OPS_ACTION_SCHEMA + ',' +
    '"source":"依据的来源媒体/机构名,没有则空字符串","url":"参考来源链接,没有则空字符串"}]}';
  const user = '今天是 ' + dstr + '。请结合最近一周全球与中国 AI 市场动态,提炼个人或小微企业能上手的 AI 赛道商机。\n' +
    '严格按以下 JSON 结构输出:\n' + schema + '\n' +
    '要求:opportunities 给出 5 到 7 条,覆盖不同 track 赛道,具体可执行、避免空泛;detail 必须给出可判断的真信息,不能重复 description;' +
    'steps 要按"先补哪块能力 → 拿什么作品或案例证明 → 去哪些平台/找哪类客户拿到第一批订单 → 第一单怎么报价交付"的顺序写,渠道点名(如 猪八戒/闲鱼/本地某行业协会/某类企业的具体部门);' +
    'cost 写实的量级(几百元级/几千元级/需要多少业余时间),不要写"投入较低"这种判断不了的话。全部简体中文。只输出 JSON。';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
export function buildPolicyOpsMessages(): Message[] {
  const today = new Date();
  const dstr = fmtDate(today);
  const start = fmtDate(new Date(today.getTime() - 183 * 86400000));
  const sys = '你是「AI 风向标」的政策商机分析引擎。你会联网检索中国最新的国家级与城市级 AI 相关规划/政策,把它们解析成个人或小微企业能切入的具体商机。政策文件、发布时间与链接必须真实可核查,严禁编造。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
  const schema = '{"generated_at":"' + dstr + '","opportunities":[{' +
    '"title":"商机标题,不超过26字","description":"40到70字精炼说明:政策带来什么商机、解决什么需求",' +
    '"detail":"120到220字详情,讲清政策原文的关键条款或目标与时间表、由此释放出的具体需求、个人或小团队可承接的切入点、需要什么资质或资源、主要不确定性",' +
    '"track":"从[' + OPS_TRACK_ENUM + ']选一个","level":"从[国家级,省级,市级]选一个",' +
    '"region":"全国 或对应省市名","policy":"规划/政策全称+发布时间,如《XX行动计划》(2025-XX)",' +
    '"source":"发布机构名,如工信部/某市人民政府","url":"政策原文或权威来源链接,没有则空字符串","timeframe":"本周 或 本月","potential":"高 或 中",' +
    OPS_ACTION_SCHEMA + '}]}';
  const user = '今天是 ' + dstr + '。请联网检索中国 ' + start + ' 至今(近半年)最新的国家级与城市级 AI 相关规划/政策,把每条政策解析成对应的落地商机。\n' +
    '严格按以下 JSON 结构输出:\n' + schema + '\n' +
    '要求:\n' +
    '1) opportunities 给出 5 到 7 条,来源覆盖国家级(如"人工智能+"行动、全国一体化算力网、"数据要素×"行动等)与城市级(如北京/上海/深圳/杭州/广州/成都/合肥等近半年发布的人工智能行动计划或若干措施),层级与城市尽量分散;\n' +
    '2) 每条覆盖不同 track 赛道,务必写清 policy(全称+发布时间)、level、region,尽量附官方 url,真实可核查;\n' +
    '3) 商机要具体、个人或小微企业可执行;\n' +
    '4) steps 要按"政策里哪一条释放出需求 → 谁是需要它的单位 → 用什么身份去接(承接平台/招投标公告/主管科室) → 先做出什么才能进名单 → 第一单怎么报价"的顺序写清,能点名就点名;' +
    'cost 写实的量级与周期。全部简体中文。只输出 JSON。';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
// 本地机会:结合传入的地区,检索当地 AI 政策/产业/场景,提炼本地可落地商机
export function buildLocalOpsMessages(regionInput?: string): Message[] {
  const today = new Date();
  const dstr = fmtDate(today);
  const start = fmtDate(new Date(today.getTime() - 183 * 86400000));
  const region = (regionInput || '').trim() || '福建省';
  const sys = '你是「AI 风向标」的本地商机分析引擎。你会联网检索中国' + region + '最近的人工智能相关政策、产业布局、园区/基金/场景开放与本地企业动态,把它们解析成个人或小微企业能在' + region + '本地切入的具体商机。政策文件、发布时间与链接必须真实可核查,严禁编造。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
  const schema = '{"generated_at":"' + dstr + '","opportunities":[{' +
    '"title":"商机标题,不超过26字","description":"40到70字精炼说明:' + region + '本地这个机会是什么、解决什么需求",' +
    '"detail":"120到220字详情,讲清' + region + '本地的具体依据(哪个地市/哪份文件或哪个园区、基金、场景清单)、当地产业与资源优势、可承接的切入点、需要什么资源或本地关系、主要风险",' +
    '"track":"从[' + OPS_TRACK_ENUM + ']选一个","level":"从[国家级,省级,市级]选一个,没有明确层级则留空字符串",' +
    '"region":"' + region + '内的具体地市/区县,或整个' + region + '","policy":"所依据的本地规划/政策/事件全称+发布时间,没有则空字符串",' +
    '"source":"发布或报道该信息的本地机构名,没有则空字符串","url":"官方或权威来源链接,没有则空字符串","timeframe":"本周 或 本月","potential":"高 或 中",' +
    OPS_ACTION_SCHEMA + '}]}';
  const user = '今天是 ' + dstr + '。请联网检索中国' + region + ' ' + start + ' 至今(近半年)最新的 AI 相关规划/政策/产业动态(如' + region + '及下辖地市的人工智能行动计划、算力/数据要素政策、场景开放清单、产业基金、园区招商等),把每条解析成' + region + '本地个人或小微企业能落地的商机。\n' +
    '严格按以下 JSON 结构输出:\n' + schema + '\n' +
    '要求:\n' +
    '1) opportunities 给出 5 到 7 条,尽量覆盖' + region + '内不同地市与不同 track 赛道;\n' +
    '2) 每条写清 region(具体到地市/区县)、尽量写清 policy(全称+发布时间)与 level,并尽量附官方 url,真实可核查、不得编造;\n' +
    '3) 商机要具体、结合本地产业特色(如当地优势行业、集群、资源),个人或小微企业可执行;\n' +
    '4) steps 要落到' + region + '本地能找到的具体对象上:哪个园区/哪类企业/哪个科室或平台、通过什么方式进去(公开招投标、场景清单申报、园区运营方、行业协会、本地服务商名录),再谈第一单怎么报价交付;' +
    'cost 写实的量级与周期。全部简体中文。只输出 JSON。';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
export function buildOpsMessages(mode: string, region?: string): Message[] {
  if (mode === 'policy') return buildPolicyOpsMessages();
  if (mode === 'local') return buildLocalOpsMessages(region);
  return buildAiOpsMessages();
}
export function buildSumMessages(range: number): Message[] {
  const today = new Date();
  const dstr = fmtDate(today);
  const start = fmtDate(new Date(today.getTime() - range * 86400000));
  const sys = '你是「AI 风向标」的汇总编辑。你会联网检索最新信息,用简洁中文写导读与要点,不编造。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
  const user = '今天是 ' + dstr + '。请联网检索 ' + start + ' 至 ' + dstr + '(最近 ' + range + ' 天)全球 AI 大小事,写一份"快速汇总",供不想逐条细读的人 30 秒看完。\n' +
    '严格按以下 JSON 结构输出:\n' +
    '{"generated_at":"' + dstr + '","overview":"80到140字的整体导读,概括这几天 AI 领域的主线与氛围","highlights":[{"title":"要点标题,不超过24字","takeaway":"一句话精炼要点,20到45字,说明发生了什么、为什么值得关注","detail":"120到220字详情,讲清这条要点的来龙去脉:背景、涉及主体、关键数字或条款、时间线、后续影响","tag":"主题标签,如 模型/融资/监管/产品/研究","date":"该事件日期 YYYY-MM-DD","source":"来源名","url":"原始链接,没有则空字符串"}]}\n' +
    '要求:highlights 只写确实检索到的事件,查到几条写几条(可以少于 5 条),不要为凑数编造;严禁占位条目——凡是标题含「待核实/未检索到」、来源写「检索限制」、或正文只在说明"查不到信息"的条目一律不输出;某几天没有可靠信息就跳过那几天;每条尽量附真实 url 与 source 以便点击深读;detail 必须真正补充信息,不能只是复述 takeaway;date 填事件真实日期,输出按 date 从新到旧排列。全部简体中文。只输出 JSON。';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
// 前沿技术:最近出现的新技术 / 新名词,用大白话讲清原理
export function buildTechMessages(rangeInput?: number): Message[] {
  const range = rangeInput || 30;
  const today = new Date();
  const dstr = fmtDate(today);
  const start = fmtDate(new Date(today.getTime() - range * 86400000));
  const sys = '你是「AI 风向标」的前沿技术解读引擎,面向想跟上 AI 节奏、又怕被术语劝退的普通人。你会联网检索最近真正冒出来的新技术、新架构、新名词,并用大白话讲清它的原理与意义,不编造、不堆砌旧概念。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
  const schema = '{"generated_at":"' + dstr + '","tech":[{' +
    '"term":"技术/名词名称(中文,可含英文缩写),不超过20字",' +
    '"en":"英文原名或缩写,没有则空字符串",' +
    '"principle":"60到120字,用大白话讲清它是什么、大致怎么工作的,尽量少用行话,必要术语随手解释",' +
    '"why":"30到60字,说明它为什么值得关注、能带来什么改变",' +
    '"detail":"150到260字详情,再往深一层:它要解决的具体问题、与已有方案相比强在哪、关键做法或架构思路、目前的局限与代价、谁已经在用或落地到什么程度",' +
    '"track":"从[' + OPS_TRACK_ENUM + ']选一个",' +
    '"stage":"从[研究突破,早期产品,规模落地]选一个",' +
    '"source":"来源媒体/机构/论文名","url":"原始链接,没有则空字符串","date":"YYYY-MM-DD"}]}';
  const user = '今天是 ' + dstr + '。请联网检索 ' + start + ' 至今(最近约 ' + range + ' 天)AI 领域最新出现、正在被讨论的技术 / 架构 / 名词(例如新型注意力或推理机制、新的 Agent 框架、多模态方法、训练/推理优化、代表性新模型的关键技术等),挑真正"新"的,不要把早已普及的旧概念当新事物。\n' +
    '严格按以下 JSON 结构输出:\n' + schema + '\n' +
    '要求:tech 给出 6 到 9 条,覆盖不同 track 赛道与不同 stage 阶段;principle 必须让外行也看得懂;每条尽量附真实 url 以便深读;date 填该技术/报道真实出现的具体日期(YYYY-MM-DD),务必尽量新,不要把窗口最早那天的旧事物当新内容;输出按 date 从新到旧排列。全部简体中文。只输出 JSON。';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
// 就业形势:指定城市里确实在招的 AI/技术岗位,以及拿到它需要的技术
// city 候选只写本轮问到的城市:分组请求时若把四城全列进 schema,模型会顺手把别城岗位也带回来,两次调用就重复花钱了
export function jobsSchema(cities: string[], dstr: string): string {
  const list = (cities.length ? cities : JOB_CITIES).join(',');
  return '{"generated_at":"' + dstr + '","jobs":[{' +
    '"title":"岗位名称,照招聘方常用的叫法写,不超过20字",' +
    '"city":"从[' + list + ']选一个",' +
    '"category":"从[' + JOB_CAT_ENUM + ']选一个",' +
    '"salary":"薪资区间,如 9-15K·13薪;来源里没写就留空字符串,严禁估算或编造",' +
    '"demand":"需求依据,不超过34字:在哪里看到的(如 某市人社局2026年紧缺职业目录/某招聘平台该城在招岗位页/某企业官网招聘),有数字才写数字",' +
    '"entry":"入门门槛,不超过26字:学历 + 经验年限 + 必须拿得出的作品",' +
    '"skills":["所需技术或工具,3 到 6 条,每条不超过14字,写具体名称(如 Python、SQL、LangChain、PyTorch、Docker、Vue3、数据标注规范),不要写沟通能力这类软素质"],' +
    '"prepare":"90到160字:想拿到这个岗位该怎么准备——先补哪一块技术、做出什么东西能证明、面试通常追问什么、这个城市哪类公司在招",' +
    '"detail":"120到200字:这个岗位为什么在当地缺人、进去之后一天大致做什么、和哪些岗位竞争、往上走通常走哪条路",' +
    '"date":"YYYY-MM-DD,填来源发布或采集日期",' +
    '"source":"来源平台/机构名","url":"原始链接,没有则空字符串"}]}';
}
export function buildJobsMessages(cities: string[]): Message[] {
  const dstr = fmtDate(new Date());
  const list = (cities.length ? cities : JOB_CITIES).join('、');
  const sys = '你是「AI 窗口」的就业形势分析引擎,面向想在指定城市找 AI 与软件相关工作的人(包括转行和兼职)。' +
    '你会联网检索这些城市当前真实在招的岗位:招聘平台的岗位列表页、人社部门发布的急需紧缺职业目录、企业官网招聘页与行业用人报告。' +
    '岗位名、薪资、需求依据必须来自检索到的真实来源,查不到薪资就留空,严禁编造数字或把别城的数据安到这个城市头上。' +
    '你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
  const user = '今天是 ' + dstr + '。请联网检索 ' + list + ' 这几个城市最近(近一个月)AI 相关、最好就业或在招量最大的岗位,每个城市给 4 到 6 条。\n' +
    '严格按以下 JSON 结构输出:\n' + jobsSchema(cities, dstr) + '\n' +
    '要求:\n' +
    '1) 每个城市单独成组,' + list.split('、').join(' 与 ') + ' 都要有结果,不要把两个城市的岗位混在一条里;某城市确实查不到就少给条数,严禁凑数或把别的城市挪过来;\n' +
    '2) 只收与 AI/软件/数据实际相关的岗位(算法、开发、测试、数据、标注与训练、产品、运营、实施与支持),不收与 AI 无关的通用岗位;\n' +
    '3) 优先"好就业"的判据:在招数量多、明确写着经验不限或1-3年、学历门槛不高、或缺口被官方目录点名;不要把需要博士/十年经验的稀罕岗位当机会;\n' +
    '4) skills 只写技术名与工具名;salary 与 demand 的数字必须有来源,没有就留空字符串;\n' +
    '5) prepare 要让一个准备投简历的人照着做,写清先补什么、做什么作品能证明、面试追问什么、本地哪类公司在招;\n' +
    '6) date 填来源发布或采集日期,输出按 date 从新到旧排列。全部简体中文。只输出 JSON。';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

// ---------- 结果归一化 ----------
export function extractJSON(text: string): any {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(t); } catch (e) { /* 带前后缀时退化为截取括号内内容 */ }
  const so = t.indexOf('{'), sa = t.indexOf('[');
  const eo = t.lastIndexOf('}'), ea = t.lastIndexOf(']');
  let s: number, e: number;
  if (sa >= 0 && (so < 0 || sa < so)) { s = sa; e = ea; } else { s = so; e = eo; }
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}
// 模型偶尔换键名或直接把数组放在顶层:按候选键依次取,取不到返回空数组
function pickArr(obj: any, keys: string[]): any[] {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== 'object') return [];
  for (let i = 0; i < keys.length; i++) {
    if (Array.isArray(obj[keys[i]])) return obj[keys[i]];
  }
  return [];
}
// 模型有时给数组、有时给一句话:统一收成字符串数组并限量
function toStrList(v: unknown, max: number): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s == null ? '' : s).trim()).filter(Boolean).slice(0, max);
  const s = String(v == null ? '' : v).trim();
  if (!s) return [];
  return s.split(/[,，、;；\n|]+/).map((t) => t.trim()).filter(Boolean).slice(0, max);
}
export function normalizeNews(obj: any): { generated_at: string; items: NewsItem[] } {
  const arr = pickArr(obj, ['news', 'items', 'events', '新闻', '新闻列表']);
  return {
    generated_at: obj.generated_at || fmtDate(new Date()),
    items: dropPlaceholders(arr.map((n: any): NewsItem => ({
      title: n.title || '未命名事件', summary: n.summary || '', detail: n.detail || '', category: n.category || '行业动态',
      importance: n.importance === '重大' ? '重大' : '一般', region: n.region || '全球',
      date: n.date || '', source: n.source || '', url: n.url || '', impact: n.impact || ''
    })))
  };
}
export function normalizeSum(obj: any): { generated_at: string; overview: string; items: SumItem[] } {
  const hl = pickArr(obj, ['highlights', 'items', 'summary', '要点']);
  return {
    generated_at: obj.generated_at || fmtDate(new Date()),
    overview: obj.overview || '',
    items: dropPlaceholders(hl.map((h: any): SumItem => ({
      title: h.title || '未命名要点', takeaway: h.takeaway || '', detail: h.detail || '', tag: h.tag || '综合',
      date: h.date || '', source: h.source || '', url: h.url || ''
    })))
  };
}
export function normalizeTech(obj: any): { generated_at: string; items: TechItem[] } {
  const arr = pickArr(obj, ['tech', 'items', 'techs', '技术']);
  return {
    generated_at: obj.generated_at || fmtDate(new Date()),
    items: dropPlaceholders(arr.map((t: any): TechItem => {
      const track = (typeof t.track === 'string' && t.track.trim()) ? t.track.trim() : '通用应用/工具';
      return {
        title: t.term || '未命名技术', en: t.en || '', principle: t.principle || '', why: t.why || '',
        detail: t.detail || '',
        track, stage: ['研究突破', '早期产品', '规模落地'].indexOf(t.stage) >= 0 ? t.stage : '早期产品',
        source: t.source || '', url: t.url || '', date: t.date || ''
      };
    }))
  };
}
export function normalizeOps(obj: any): { generated_at: string; items: OpsItem[] } {
  const arr = pickArr(obj, ['opportunities', 'items', 'ops', '商机']);
  return {
    generated_at: obj.generated_at || fmtDate(new Date()),
    items: dropPlaceholders(arr.map((o: any): OpsItem => {
      const origin = o.origin === '政策规划' ? '政策规划' : (o.origin === '本地机会' ? '本地机会' : '市场商机');
      const track = (typeof o.track === 'string' && o.track.trim()) ? o.track.trim() : '通用应用/工具';
      return {
        title: o.title || '未命名商机', description: o.description || '', detail: o.detail || '',
        track, origin,
        level: OPS_LEVELS.indexOf(o.level) >= 0 ? o.level : '',
        region: o.region || '',
        policy: o.policy || '',
        source: o.source || '',
        url: o.url || '',
        timeframe: o.timeframe === '本月' ? '本月' : '本周', potential: o.potential === '高' ? '高' : '中',
        difficulty: ['高', '中', '低'].indexOf(o.difficulty) >= 0 ? o.difficulty : '中',
        audience: o.audience || '', action: o.action || '',
        steps: toStrList(o.steps, 6), cost: String(o.cost || '').trim()
      };
    }))
  };
}
export function normalizeJobs(obj: any): { generated_at: string; items: JobsItem[] } {
  const arr = pickArr(obj, ['jobs', 'items', '岗位', '岗位列表', 'positions']);
  return {
    generated_at: obj.generated_at || fmtDate(new Date()),
    items: dropPlaceholders(arr.map((j: any): JobsItem => {
      const rawCity = String(j.city || '').trim();
      // 模型常写「广州市」;认不出这四城时保留原样,由筛选栏按实际值出 chips
      const city = JOB_CITIES.filter((c) => rawCity.indexOf(c) >= 0)[0] || rawCity;
      return {
        title: j.title || '未命名岗位', city,
        category: String(j.category || '').trim(),
        salary: String(j.salary || '').trim(),
        demand: String(j.demand || '').trim(),
        entry: String(j.entry || '').trim(),
        prepare: String(j.prepare || '').trim(),
        skills: toStrList(j.skills, 6),
        detail: String(j.detail || '').trim(),
        date: String(j.date || '').slice(0, 10),
        source: String(j.source || '').trim(), url: String(j.url || '').trim()
      };
    }))
  };
}

// ---------- 模型排行 ----------
export const RANK_TRACKS = ['综合总榜', '逻辑推理', '代码编程', '视频生成', '图像生成', '语音多模态'];
export function buildRankMessages(): Message[] {
  const dstr = fmtDate(new Date());
  const sys = '你是「AI 窗口」的模型评测引擎。你会联网检索各大公开榜单与基准的最新结果,客观整理当前主流大模型的能力排行,不编造分数与名次。你只输出一个 JSON 对象,不要输出任何解释、前后缀或 Markdown 代码块。';
  const schema = '{"generated_at":"' + dstr + '","overview":"60到100字总评:当前各榜单的竞争格局与值得注意的变化","ranks":[{"track":"从[' + RANK_TRACKS.join(',') + ']选一个","source":"榜单或基准名(如 LMArena、Artificial Analysis、GPQA、SWE-bench、VBench 等)","url":"榜单链接,没有则空字符串","updated":"YYYY-MM","items":[{"rank":1,"model":"模型名(含版本)","vendor":"厂商","score":"榜单展示的分数或评分(字符串,没有则空字符串)","note":"20到40字一句点评:强在哪、适合什么场景","detail":"80到160字:排名依据(哪个榜单、什么指标)、核心优势、短板或不适合的场景","url":"参考链接,没有则空字符串"}]}]}';
  const user = '今天是 ' + dstr + '。请联网检索各大公开榜单(优先 Artificial Analysis 与 LMArena:综合智能指数、GPQA 等推理基准、代码基准、视频生成 Elo、图像生成 Elo、语音评测)当前最新可用版本,整理主流大模型的能力排行。\n' +
    '严格按以下 JSON 结构输出:\n' + schema + '\n' +
    '要求:ranks 覆盖全部 ' + RANK_TRACKS.length + ' 个赛道,「综合总榜」为综合类榜单,其余为细分榜;每榜按 rank 从 1 开始列 3 到 5 个模型;model 与 score 尽量与榜单原文一致,source 与 updated 标明榜单名与数据月份;不要列入已下线或已被新版替代的模型;note 回答"什么场景该选它",detail 补充依据与边界。全部简体中文。只输出 JSON。';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
export function normalizeRank(obj: any): { generated_at: string; overview: string; items: RankItem[] } {
  const items: RankItem[] = [];
  pickArr(obj, ['ranks', 'items', 'boards']).forEach((r: any) => {
    const track = RANK_TRACKS.indexOf(r.track) >= 0 ? r.track : '综合总榜';
    pickArr(r, ['items', 'models', 'rankings']).forEach((m: any) => {
      items.push({
        title: m.model || '未命名模型', vendor: m.vendor || '', rank: parseInt(m.rank, 10) || 0,
        track, score: m.score || '', note: m.note || '', detail: m.detail || '',
        source: r.source || m.source || '', url: m.url || r.url || '', date: String(r.updated || '').slice(0, 10)
      });
    });
  });
  items.sort((a, b) => {
    const ia = RANK_TRACKS.indexOf(a.track), ib = RANK_TRACKS.indexOf(b.track);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return (a.rank || 99) - (b.rank || 99);
  });
  return { generated_at: obj.generated_at || fmtDate(new Date()), overview: obj.overview || '', items };
}
