/* 五个板块:卡片文案、访客/管理两套提示与 DOM 结构都是既定口径,不要顺手改 */
import type { ReactNode } from 'react';
import {
  OPS_TRACKS, RANK_TRACKS,
  type NewsItem, type OpsItem, type RankItem, type SumItem, type TechItem
} from '@ai-fxb/core';
import { generateNews, generateOps, generateRank, generateSum, generateTech } from '../lib/generate';
import {
  IMPS, NEWS_CATS, OPS_MODES, OPS_ORIGINS, OPS_TIMES, REGIONS,
  configured, fmtDateTime, openGenModal, state, useVersion,
  type Bucket, type BucketKind, type OpsMode
} from '../lib/store';
import {
  CardFoot, CardTitle, ChipGroup, EmptyState, NewBadge, PanelState,
  StatRow, cardClick, statusText, visitorIdleHint, type Stat
} from './Bits';

const NO_KEY_HINT = '请先在「设置」配置 API,再生成。';

// 访客的空板块只说"暂无 + 什么时候再来";配好 Key 的管理员才看到"点右上生成"
function idleHint(kind: string, readyHint: string): string {
  return visitorIdleHint(kind) || (configured() ? readyHint : NO_KEY_HINT);
}

function Toolbar(props: {
  sel: ReactNode; statusCls: string; status: string;
  genLabel: string; genKind: BucketKind; disabled: boolean;
}) {
  return (
    <div className="toolbar">
      <span className="toolbar__sel" data-admin="1">{props.sel}</span>
      <div className="spacer" />
      <span className={'toolbar__status ' + props.statusCls}>{props.status}</span>
      <button
        className="btn btn--primary btn--sm" data-admin="1" type="button"
        disabled={props.disabled} onClick={() => openGenModal(props.genKind)}
      >{props.genLabel}</button>
    </div>
  );
}

function Panel(props: { kind: BucketKind; children: ReactNode }) {
  const on = state.view === props.kind;
  return (
    <section
      className={'panel' + (on ? ' is-active' : '')}
      id={'panel-' + props.kind}
      role="tabpanel" aria-labelledby={'tab-' + props.kind}
      hidden={!on}
    >{props.children}</section>
  );
}

function Body(props: { bucket: Bucket; kind: BucketKind; hint: string; onRetry: () => void; children: ReactNode }) {
  if (props.bucket.status !== 'ready') {
    return <div className="panel-state">
      <PanelState bucket={props.bucket} kind={props.kind} readyHint={props.hint} onRetry={props.onRetry} />
    </div>;
  }
  return <>{props.children}</>;
}

// ---------- AI 汇总 ----------
export function SumPanel() {
  useVersion();
  const b = state.sum;
  const items = b.items as SumItem[];
  return (
    <Panel kind="sum">
      <Toolbar
        sel={<>范围 <b>{state.sumRange} 天</b></>} statusCls={'is-' + b.status}
        status={statusText(b, b.range ? ' · ' + b.range + '天' : '')}
        genLabel="生成汇总" genKind="sum" disabled={b.status === 'loading'}
      />
      <Body bucket={b} kind="sum" onRetry={generateSum}
        hint={idleHint('汇总', '点右上「生成汇总」,30 秒看完最近几天 AI 大事。')}>
        <div className="sum-overview">
          <b>导读 · {b.generated_at} · 最近 {b.range || state.sumRange} 天</b>{b.overview || ''}
        </div>
        <p className="sum-tip">点标题或来源可看原文。</p>
        <div className="list">
          {!items.length
            ? <EmptyState text="本次汇总没有返回要点。" />
            : items.map((h) => (
              <article className="card sum-item" key={h.id} onClick={cardClick('sum', h)}>
                <div className="card__top"><NewBadge it={h} /><span className="tag tag--cat">{h.tag}</span></div>
                <h3 className="card__title"><CardTitle it={h} /></h3>
                {h.takeaway ? <p className="card__sum">{h.takeaway}</p> : null}
                <CardFoot it={h} />
              </article>
            ))}
        </div>
      </Body>
    </Panel>
  );
}

// ---------- 前沿技术 ----------
export function TechPanel() {
  useVersion();
  const b = state.tech;
  const items = b.items as TechItem[];
  const tracks = ['全部'].concat(OPS_TRACKS.filter((t) => items.some((x) => x.track === t)));
  const list = items.filter((t) => state.filters.techTrack === '全部' || t.track === state.filters.techTrack);
  const stats: Stat[] = [
    { n: items.length, l: '技术条目' },
    { n: items.filter((t) => t.stage === '研究突破').length, l: '研究突破' },
    { n: distinct(items.map((t) => t.track)), l: '覆盖赛道' },
    { n: b.generated_at, l: '数据日期', small: true }
  ];
  return (
    <Panel kind="tech">
      <Toolbar
        sel={<>范围 <b>{state.techRange} 天</b></>} statusCls={'is-' + b.status}
        status={statusText(b, b.range ? ' · ' + b.range + '天' : '')}
        genLabel="生成前沿技术" genKind="tech" disabled={b.status === 'loading'}
      />
      <p className="ops-hint" data-admin="1">聚焦最近冒出来的新技术、新架构、新名词(如新型注意力机制、推理模型、Agent 框架、多模态方法等),每条用「原理解读卡片」呈现:一句大白话讲清它是什么、为什么重要,并附来源链接可深读。</p>
      <Body bucket={b} kind="tech" onRetry={generateTech}
        hint={idleHint('前沿技术', '点右上「生成前沿技术」,用大白话看懂最近冒出来的新技术。')}>
        <div className="stats"><StatRow stats={stats} /></div>
        <div className="filters">
          <div className="filter-group">
            <span className="filter-group__label">赛道</span>
            <div className="chips"><ChipGroup group="techTrack" options={tracks} active={state.filters.techTrack} /></div>
          </div>
        </div>
        <div className="list">
          {!list.length
            ? <EmptyState text="没有匹配的技术条目。" />
            : list.map((t) => (
              <article className="card tech-item" key={t.id} onClick={cardClick('tech', t)}>
                <div className="card__top">
                  <NewBadge it={t} />
                  <span className="tag tag--region">{t.track}</span>
                  <span className={'tag ' + (t.stage === '研究突破' ? 'tag--major' : t.stage === '规模落地' ? 'tag--cat' : 'tag--minor')}>{t.stage}</span>
                  {t.date ? <span className="tag tag--date">{t.date}</span> : null}
                </div>
                <h3 className="card__title"><CardTitle it={t} />{t.en ? <> <span className="tech-en">{t.en}</span></> : null}</h3>
                {t.principle ? <p className="card__sum">{t.principle}</p> : null}
                {t.why ? <p className="card__impact"><b>为什么重要:</b>{t.why}</p> : null}
                <CardFoot it={t} />
              </article>
            ))}
        </div>
      </Body>
    </Panel>
  );
}

// ---------- 模型排行 ----------
function distinct(values: string[]): number {
  const seen: Record<string, number> = {};
  values.forEach((v) => { seen[v] = 1; });
  return Object.keys(seen).length;
}
function rankScoreNum(it: RankItem): number | null {
  const m = String(it.score || '').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function rankMetric(it: RankItem): string {
  const s = String(it.source || '');
  return s.indexOf('·') >= 0 ? s.split('·').pop()!.trim() : '';
}
function rankDomain(metric: string, nums: number[]): { from: number; to: number } {
  const hi = nums.length ? Math.max(...nums) : 1;
  if (/elo/i.test(metric)) return { from: 1000, to: Math.max(1400, Math.ceil(hi / 50) * 50) };
  return { from: 0, to: Math.max(100, Math.ceil(hi / 10) * 10) };
}

function RankBar({ it, v, dm }: { it: RankItem; v: number | null; dm: { from: number; to: number } }) {
  const span = dm.to - dm.from || 1;
  const pct = v == null ? null : Math.max(2, Math.min(96, Math.round((v - dm.from) / span * 96)));
  return (
    <div className={'rank-bar' + (it.rank === 1 ? ' is-top' : '')} title={it.note || ''} onClick={cardClick('rank', it)}>
      <span className="rank-no">#{it.rank || '-'}</span>
      <NewBadge it={it} />
      <span className="rank-bar__name">{it.title}{it.vendor ? <em>{it.vendor}</em> : null}</span>
      <span className="rank-bar__rail">{pct != null ? <span className="rank-bar__fill" style={{ width: pct + '%' }} /> : null}</span>
      <span className="rank-bar__score">{it.score || ''}</span>
    </div>
  );
}

function RankGroup({ track, items }: { track: string; items: RankItem[] }) {
  const vals = items.map(rankScoreNum);
  const dm = rankDomain(rankMetric(items[0]), vals.filter((v): v is number => v != null));
  return (
    <div className="rank-group">
      <h3 className="rank-group__title">{track}
        <span className="rank-group__scale">{rankMetric(items[0])} {dm.from}–{dm.to}</span>
      </h3>
      <div className="rank-chart">
        {items.map((it, i) => <RankBar key={String(it.id) + ':' + i} it={it} v={vals[i]} dm={dm} />)}
      </div>
    </div>
  );
}

export function RankPanel() {
  useVersion();
  const b = state.rank;
  const items = b.items as RankItem[];
  const tracks = ['全部'].concat(RANK_TRACKS.filter((t) => items.some((x) => x.track === t)));
  const list = items.filter((it) => state.filters.rankTrack === '全部' || it.track === state.filters.rankTrack);
  // 先按固定赛道顺序分组,未知赛道再按出现顺序补在后面
  const groups: { track: string; items: RankItem[] }[] = [];
  RANK_TRACKS.forEach((tr) => {
    const g = list.filter((it) => it.track === tr);
    if (g.length) groups.push({ track: tr, items: g });
  });
  list.forEach((it) => {
    if (RANK_TRACKS.indexOf(it.track) < 0 && !groups.some((g) => g.track === it.track)) {
      groups.push({ track: it.track, items: list.filter((x) => x.track === it.track) });
    }
  });
  const stats: Stat[] = [
    { n: items.length, l: '上榜条目' },
    { n: distinct(items.map((it) => it.track)), l: '覆盖榜单' },
    { n: items.filter((it) => it.rank === 1).length, l: '榜首模型' },
    { n: b.generated_at, l: '数据日期', small: true }
  ];
  return (
    <Panel kind="rank">
      <Toolbar
        sel={<>综合总榜 <b>+ 6 细分赛道</b></>} statusCls={'is-' + b.status}
        status={statusText(b, '')} genLabel="生成排行" genKind="rank" disabled={b.status === 'loading'}
      />
      <p className="ops-hint">榜单数据来自独立第三方评测 Artificial Analysis,每日同步。</p>
      <Body bucket={b} kind="rank" onRetry={generateRank}
        hint={idleHint('模型排行', '点右上「生成排行」,看当下做什么任务该选哪个模型。')}>
        {b.overview ? <div className="sum-overview"><b>总评</b>{b.overview}</div> : null}
        <div className="stats"><StatRow stats={stats} /></div>
        <div className="filters">
          <div className="filter-group">
            <span className="filter-group__label">赛道</span>
            <div className="chips"><ChipGroup group="rankTrack" options={tracks} active={state.filters.rankTrack} /></div>
          </div>
        </div>
        <div className="list">
          {!list.length
            ? <EmptyState text="没有匹配榜单的数据。" />
            : groups.map((g) => <RankGroup key={g.track} track={g.track} items={g.items} />)}
        </div>
      </Body>
    </Panel>
  );
}

// ---------- 商机雷达 ----------
export function OpsPanel() {
  useVersion();
  const b = state.ops;
  const items = b.items as OpsItem[];
  const busy = !!b.loadingMode || b.status === 'loading';
  const pol = items.filter((o) => o.origin === '政策规划').length;
  const loc = items.filter((o) => o.origin === '本地机会').length;
  const mkt = items.length - pol - loc;
  let statusCls = '';
  let status = '尚未生成';
  if (b.loadingMode) { statusCls = 'is-loading'; status = '正在生成' + OPS_MODES[b.loadingMode].label + '…'; }
  else if (b.status === 'ready') {
    statusCls = 'is-ready';
    status = '更新于 ' + fmtDateTime(b.fetched_at) + ' · 共 ' + items.length + ' 条(政策 ' + pol + ' · 本地 ' + loc + ' · 市场 ' + mkt + ')';
  } else if (b.status === 'error') { statusCls = 'is-error'; status = '失败'; }

  const present: string[] = ['全部'];
  items.forEach((o) => { if (o.track && present.indexOf(o.track) < 0) present.push(o.track); });
  const list = items.filter((o) =>
    (state.filters.opsTime === '全部' || o.timeframe === state.filters.opsTime) &&
    (state.filters.opsTrack === '全部' || o.track === state.filters.opsTrack) &&
    (state.filters.opsOrigin === '全部' || o.origin === state.filters.opsOrigin)
  );
  const stats: Stat[] = [
    { n: items.length, l: '商机总数' }, { n: pol, l: '政策规划解析' },
    { n: distinct(items.map((o) => o.track).filter(Boolean)), l: '覆盖赛道' },
    { n: items.filter((o) => o.potential === '高').length, l: '高潜力' }
  ];
  const retry = () => { state.opsMode = (b.loadErrorMode || 'ai') as OpsMode; generateOps(); };

  return (
    <Panel kind="ops">
      <div className="toolbar">
        <span className="toolbar__sel" data-admin="1">类型 <b>{OPS_MODES[state.opsMode].label}</b></span>
        <div className="spacer" />
        <span className={'toolbar__status ' + statusCls}>{status}</span>
        <button className="btn btn--primary btn--sm" data-admin="1" type="button" disabled={busy} onClick={() => openGenModal('ops')}>
          {b.loadingMode ? '生成中…' : '生成商机'}
        </button>
      </div>
      <p className="ops-hint" data-admin="1">点「生成商机」后会在弹窗里选择类型并二次确认才发起请求:「AI 赛道商机」来自近期市场动态;「国家政策支持」解析中国近半年国家级 / 城市级最新 AI 规划;「本地机会」结合你在「设置」里配置的所在地区(默认福建省),检索当地 AI 政策与产业动态。三类分开生成、请求更小更易成功,结果融合显示并用标签区分。</p>
      <Body bucket={b} kind="ops" onRetry={retry}
        hint={idleHint('商机', '先在上方选择类型,再点对应的「生成」按钮。两类分开生成、请求更小更易成功。')}>
        <div className="stats"><StatRow stats={stats} /></div>
        <div className="filters">
          <div className="filter-group"><span className="filter-group__label">时间</span>
            <div className="chips"><ChipGroup group="opsTime" options={OPS_TIMES} active={state.filters.opsTime} /></div></div>
          <div className="filter-group"><span className="filter-group__label">赛道</span>
            <div className="chips"><ChipGroup group="opsTrack" options={present} active={state.filters.opsTrack} /></div></div>
          <div className="filter-group"><span className="filter-group__label">来源</span>
            <div className="chips"><ChipGroup group="opsOrigin" options={OPS_ORIGINS} active={state.filters.opsOrigin} /></div></div>
        </div>
        {b.loadError ? (
          <div className="ops-error">
            <div className="ops-error__msg">
              <b>{(OPS_MODES[b.loadErrorMode as OpsMode] || OPS_MODES.ai).label}生成失败:</b>{b.loadError}
              {b.loadErrorDetail ? <details><summary>查看原始报错</summary><pre>{b.loadErrorDetail}</pre></details> : null}
            </div>
            <button className="btn btn--ghost btn--sm" type="button" onClick={retry}>重试</button>
          </div>
        ) : null}
        <div className="grid">
          {!list.length
            ? <EmptyState text="没有符合当前筛选的商机。" />
            : list.map((o) => {
              const isPolicy = o.origin === '政策规划';
              const isLocal = o.origin === '本地机会';
              const meta = [o.level, o.region].filter(Boolean);
              return (
                <article className={'op' + (isPolicy ? ' op--policy' : isLocal ? ' op--local' : '')} key={o.id} onClick={cardClick('ops', o)}>
                  <div className="op__head">
                    <NewBadge it={o} />
                    <span className={'pill ' + (isPolicy ? 'pill--policy' : isLocal ? 'pill--local' : 'pill--market')}>{o.origin}</span>
                    <span className="pill pill--track">{o.track}</span>
                    <span className="pill pill--time">{o.timeframe}</span>
                  </div>
                  <h3 className="op__title"><CardTitle it={o} /></h3>
                  {o.description ? <p className="op__desc">{o.description}</p> : null}
                  <div className="op__meta">
                    <span className={'pill ' + (o.potential === '高' ? 'pill--high' : 'pill--mid')}>潜力 · {o.potential}</span>
                    <span className="pill pill--low">门槛 · {o.difficulty}</span>
                    {o.audience ? <span className="pill pill--low">适合 · {o.audience}</span> : null}
                  </div>
                  {(isPolicy || isLocal) && (o.policy || meta.length) ? (
                    <div className="op__block op__policy">
                      <b>{isLocal ? '本地依据' : '政策依据'}</b>{o.policy}
                      {meta.length ? <span className="op__policy-tag">{meta.join(' · ')}</span> : null}
                    </div>
                  ) : null}
                  {o.action ? <div className="op__block op__action"><b>行动建议</b>{o.action}</div> : null}
                  <CardFoot it={o} />
                </article>
              );
            })}
        </div>
      </Body>
    </Panel>
  );
}

// ---------- AI 大事件 ----------
export function NewsPanel() {
  useVersion();
  const b = state.news;
  const items = b.items as NewsItem[];
  const list = items.filter((n) =>
    (state.filters.newsCat === '全部' || n.category === state.filters.newsCat) &&
    (state.filters.newsRegion === '全部' || n.region === state.filters.newsRegion) &&
    (state.filters.newsImp === '全部' || n.importance === state.filters.newsImp)
  );
  const stats: Stat[] = [
    { n: items.length, l: '事件数' },
    { n: items.filter((n) => n.importance === '重大').length, l: '重大事件' },
    { n: distinct(items.map((n) => n.region)), l: '覆盖地区' },
    { n: b.generated_at, l: '数据日期', small: true }
  ];
  return (
    <Panel kind="news">
      <Toolbar
        sel={<>范围 <b>{state.newsRange} 天</b></>} statusCls={'is-' + b.status}
        status={statusText(b, b.range ? ' · ' + b.range + '天' : '')}
        genLabel="生成新闻" genKind="news" disabled={b.status === 'loading'}
      />
      <Body bucket={b} kind="news" onRetry={generateNews}
        hint={idleHint('大事件', '点右上「生成新闻」开始检索。')}>
        <div className="stats"><StatRow stats={stats} /></div>
        <div className="filters">
          <div className="filter-group"><span className="filter-group__label">分类</span>
            <div className="chips"><ChipGroup group="newsCat" options={NEWS_CATS} active={state.filters.newsCat} /></div></div>
          <div className="filter-group"><span className="filter-group__label">地区</span>
            <div className="chips"><ChipGroup group="newsRegion" options={REGIONS} active={state.filters.newsRegion} /></div></div>
          <div className="filter-group"><span className="filter-group__label">重要度</span>
            <div className="chips"><ChipGroup group="newsImp" options={IMPS} active={state.filters.newsImp} /></div></div>
        </div>
        <div className="list">
          {!list.length
            ? <EmptyState text="没有符合当前筛选的事件。" />
            : list.map((n) => {
              const major = n.importance === '重大';
              return (
                <article className={'card' + (major ? ' is-major' : '')} key={n.id} onClick={cardClick('news', n)}>
                  <div className="card__top">
                    <NewBadge it={n} />
                    <span className="tag tag--cat">{n.category}</span>
                    <span className={'tag ' + (major ? 'tag--major' : 'tag--minor')}>{major ? '重大' : '一般'}</span>
                    <span className="tag tag--region">{n.region}</span>
                    {n.date ? <span className="tag tag--date">{n.date}</span> : null}
                  </div>
                  <h3 className="card__title"><CardTitle it={n} /></h3>
                  {n.summary ? <p className="card__sum">{n.summary}</p> : null}
                  {n.impact ? <p className="card__impact"><b>影响 · </b>{n.impact}</p> : null}
                  <CardFoot it={n} />
                </article>
              );
            })}
        </div>
      </Body>
    </Panel>
  );
}
