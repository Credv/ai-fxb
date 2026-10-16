/* 情报蛛网:画面来自动画层 vendor/spider(第三方 MIT,见其 NOTICE.md),数据全部来自本站自己的快照 */
import { LiveRenderer } from './vendor/spider/live-renderer.js';
import { normalizeConfig, validateEvent } from './vendor/spider/config.js';

var PAGE_SIZE = 32;
var STEP = 0.17;
var TAIL = 2.8;
var ROUTE_OF = { sum: 'code', news: 'code', tech: 'model', rank: 'model', ops: 'you' };
var HINTS = { code: '汇总 + 大事件', model: '前沿技术 + 模型排行', you: '商机雷达' };

var CONFIG = normalizeConfig({
  title: '情报蛛网',
  subtitle: '当日快照条目 · 按内容分流',
  modelName: '本站快照',
  layout: 'landscape',
  unit: 'task',
  routes: {
    code: { label: '情报', color: '#38bdf8' },
    model: { label: '技术', color: '#a78bfa' },
    you: { label: '商机', color: '#34d399' }
  },
  theme: {
    background: '#0a1122', panel: '#0f1930', panelTop: '#152340', border: '#223255',
    text: '#e6ecff', muted: '#8ea3c8', accent: '#38bdf8', spider: '#7dd3fc'
  }
});

function num(text) {
  var m = String(text || '').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/* 只有排行分支给数字:同榜单内 原始分 / 榜首,是真实第三方分的比值,不是我们另造的指标 */
function rankRatios(items) {
  var max = {};
  items.forEach(function (it) {
    var v = num(it.score), k = it.track || '_';
    if (v != null && !(k in max)) max[k] = v;
    if (v != null && v > max[k]) max[k] = v;
  });
  return function (it) {
    var v = num(it.score), k = it.track || '_';
    return (v == null || !max[k]) ? null : Math.round(v / max[k] * 1000) / 1000;
  };
}

function collect(buckets) {
  var rows = [], ratio = rankRatios(buckets.rank || []);
  ['sum', 'news', 'tech', 'ops', 'rank'].forEach(function (board) {
    (buckets[board] || []).forEach(function (it) {
      rows.push({
        board: board, id: it.id, title: it.title || '',
        stamp: String(it.date || it.firstSeen || ''),
        score: board === 'rank' ? ratio(it) : null,
        note: it.detail || it.summary || it.takeaway || it.principle || ''
      });
    });
  });
  rows.sort(function (a, b) { return b.stamp.localeCompare(a.stamp); });
  return rows;
}

function buildEvents(rows) {
  var byId = {};
  var events = rows.map(function (r, i) {
    var key = r.board + ':' + r.id;
    var ev = validateEvent({
      id: key,
      label: String(r.title).slice(0, 190),
      route: ROUTE_OF[r.board],
      status: 'completed',
      score: r.score,
      detail: String(r.note).slice(0, 3800),
      occurredAt: r.stamp || null
    }, null, CONFIG);
    ev.order = i + 1;
    ev.firstAt = 0.3 + i * STEP;
    ev.updatedAt = ev.firstAt;
    byId[key] = r;
    return ev;
  });
  return { events: events, byId: byId, duration: 0.3 + Math.max(0, events.length - 1) * STEP + TAIL };
}

var run = null, renderer = null, opts = {}, raf = 0, startAt = 0, curTime = 0;
var page = 0, filter = 'all', selected = null, reduced = false, gap = 16;

/* 分支筛选要同时作用于蛛网节点与右侧明细表,否则点了分支却仍然列出全部条目 */
function curList() {
  return filter === 'all' ? run.events : run.events.filter(function (e) { return e.route === filter; });
}
function pagesOf(len) { return Math.max(1, Math.ceil(len / PAGE_SIZE)); }

function viewAt(time) {
  var all = run.events, list = curList();
  if (page > pagesOf(list.length) - 1) page = pagesOf(list.length) - 1;
  var slice = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  var counts = { code: 0, model: 0, you: 0 };
  all.forEach(function (e) { counts[e.route]++; });
  var head = filter === 'all'
    ? '共 ' + all.length + ' 条 · 全部分支'
    : CONFIG.routes[filter].label + ' ' + list.length + ' 条 · 占当日 ' + Math.round(list.length / Math.max(1, all.length) * 100) + '%';
  return {
    config: CONFIG,
    events: slice,
    activeEvents: all,
    totalEvents: all.length,
    counts: counts,
    statusCounts: { pending: 0, running: 0, completed: all.length, failed: 0 },
    statusText: { pending: '未开始', running: '进行中', completed: '已入网', failed: '未入网' },
    probeLabels: false,
    status: 'loop',
    at: time,
    routeHints: HINTS,
    titles: {
      scene: '当日条目 / 分流', head: head, page: '共 ', pageSuffix: ' 条',
      empty1: '快照里还没有条目', empty2: '生成一轮或等每日快照写入后,这里会自己结网。',
      footer: '数据来自本站快照 · 非实时上报',
      baseline: '循环回放 · ' + time.toFixed(2) + ' / ' + run.duration.toFixed(1) + ' 秒 · 分支 ' + (filter === 'all' ? '全部' : CONFIG.routes[filter].label),
      stream: '最近条目 / 明细', streamHint: '点条目看完整原文',
      noScore: '未打分',
      metrics: '快照 / 汇总', metricTotal: '当日条目总数',
      metricExtra1: opts.date ? '数据日期 ' + opts.date : '数据日期 未提供',
      metricExtra2: '排行分数 = 同榜原始分 / 榜首'
    }
  };
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  if (now - curTime < gap) return;
  curTime = now;
  var t = ((now - startAt) / 1000) % run.duration;
  renderer.render(viewAt(t), {
    time: t, reducedMotion: reduced, selectedId: selected, page: page,
    routeFilter: filter, connection: opts.connection || '离线快照'
  });
}

function sayPage() {
  if (opts.onPage) opts.onPage(page + 1, pagesOf(curList().length));
}

window.__net = {
  mount: function (canvas, buckets, options) {
    opts = options || {};
    run = buildEvents(collect(buckets));
    if (!run.events.length) { run = { events: [], byId: {}, duration: 1 }; }
    reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gap = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) ? 50 : 16;
    page = 0; filter = 'all'; selected = null;
    if (renderer) renderer.destroy();
    renderer = new LiveRenderer(canvas, {
      onSelect: function (id) {
        selected = id;
        var r = run.byId[id];
        if (r && opts.onPick) opts.onPick(r.board, r.id);
      }
    });
    startAt = performance.now(); curTime = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    sayPage();
  },
  unmount: function () {
    cancelAnimationFrame(raf); raf = 0;
    if (renderer) { renderer.destroy(); renderer = null; }
  },
  step: function (delta) {
    if (!run) return;
    page = Math.max(0, Math.min(pagesOf(curList().length) - 1, page + delta));
    sayPage();
  },
  pick: function (route) {
    if (filter === route) return;
    filter = route; page = 0; sayPage();
  },
  count: function () { return run ? run.events.length : 0; }
};
