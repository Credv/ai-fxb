/* 各板块共用的片段:NEW 徽标、卡片脚注、筛选 chips、统计条、板块空/错误/生成中状态 */
import type { MouseEvent } from 'react';
import type { ItemBase } from '@ai-fxb/core';
import { ADMIT } from '../lib/settings';
import {
  configured, fmtDateTime, openDetail, openSettings, setFilter, state,
  type Bucket, type BucketKind, type Filters
} from '../lib/store';

export function statusText(b: Bucket, extra = ''): string {
  if (b.status === 'ready') {
    return '更新于 ' + fmtDateTime(b.fetched_at) + ' · ' + b.items.length + ' 条' + extra +
      (b.syncing ? ' · ⟳ 同步中' : '') + (b.newCount ? ' · ' + b.newCount + ' NEW' : '') + (b.loadError ? ' · 同步失败' : '');
  }
  if (b.status === 'loading') return '生成中…';
  if (b.status === 'error') return '失败';
  return '尚未生成';
}

// 访客没有 Key,也不该看到「快照/生成」这类后台说法:空板块只说没有 + 什么时候再来
export function visitorIdleHint(kind: string): string {
  if (configured() || state.settings.demo || ADMIT) return '';
  if (state.snapshotError) return '数据没能载入 · 稍后刷新重试。';
  return '暂无' + kind + ' · 每天 0 点更新,稍后刷新即可。';
}

export function NewBadge({ it }: { it: ItemBase }) {
  return it.isNew ? <span className="badge-new" title="今日新增">NEW</span> : null;
}

// 卡片整体可点开详情,但标题里的原文链接要正常跳转,不能被卡片抢走
export function cardClick(kind: BucketKind, it: ItemBase) {
  return (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) return;
    openDetail(kind, it.id as string);
  };
}

export function CardTitle({ it }: { it: ItemBase }) {
  return it.url
    ? <a href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a>
    : <>{it.title}</>;
}

export function CardFoot({ it }: { it: ItemBase }) {
  return (
    <div className="card__foot">
      {it.source ? <span className="card__src">来源:{it.source}</span> : null}
      {it.url ? <a className="card__src" href={it.url} target="_blank" rel="noopener noreferrer">阅读原文 ↗</a> : null}
      <span className="card__more">详情 ›</span>
    </div>
  );
}

export function ChipGroup({ group, options, active }: { group: keyof Filters; options: string[]; active: string }) {
  return (
    <>
      {options.map((v) => (
        <button
          key={v}
          type="button"
          className={'chip' + (v === active ? ' is-on' : '')}
          onClick={() => setFilter(group, v)}
        >{v}</button>
      ))}
    </>
  );
}

export interface Stat { n: number | string; l: string; small?: boolean }

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <>
      {stats.map((s, i) => (
        <div className="stat" key={i}>
          <div className={'stat__n' + (s.small ? ' stat__n--sm' : '')}>{s.n}</div>
          <div className="stat__l">{s.l}</div>
        </div>
      ))}
    </>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="state"><div className="state__inner"><p className="state__desc">{text}</p></div></div>;
}

// 生成中要显示已等待秒数:联网聚合可能要 1–3 分钟,不给反馈很容易被当成卡死
export function PanelState({ bucket, kind, readyHint, onRetry }: {
  bucket: Bucket; kind: BucketKind; readyHint: string; onRetry: () => void
}) {
  if (bucket.status === 'loading') {
    return (
      <div className="state"><div className="state__inner">
        <div className="spinner" />
        <p className="state__title">正在生成…</p>
        <p className="state__desc">生成中…已等待 {state.ui.loadSec} 秒(联网聚合可能需要 1–3 分钟,请勿关闭页面)。</p>
      </div></div>
    );
  }
  if (bucket.status === 'error') {
    return (
      <div className="state is-error"><div className="state__inner">
        <p className="state__title">生成失败</p>
        <p className="state__desc">{bucket.error}</p>
        {bucket.errorMeta ? <p className="state__meta">{bucket.errorMeta}</p> : null}
        {bucket.errorDetail ? (
          <details className="state__detail"><summary>查看原始报错</summary><pre>{bucket.errorDetail}</pre></details>
        ) : null}
        <button className="btn btn--ghost state__action" type="button" data-retry={kind} onClick={onRetry}>重试</button>
      </div></div>
    );
  }
  return (
    <div className="state"><div className="state__inner">
      <p className="state__title">尚未生成</p>
      <p className="state__desc">{readyHint}</p>
      {(configured() || state.settings.demo || !ADMIT) ? null : (
        <button className="btn btn--ghost state__action" type="button" onClick={openSettings}>打开设置</button>
      )}
    </div></div>
  );
}
