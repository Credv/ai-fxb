/* 消息详情弹窗:卡片给结论,这里给全文与出处 */
import type { ReactNode } from 'react';
import type { ItemBase, NewsItem, OpsItem, RankItem, SumItem, TechItem } from '@ai-fxb/core';
import { KIND_NAME, closeDetail, findItem, state, useVersion, type BucketKind } from '../lib/store';

function Block({ label, text, mod }: { label: string; text?: string; mod?: 'acc' | 'warn' }) {
  if (!text) return null;
  return (
    <div className={'dt__block' + (mod ? ' dt__block--' + mod : '')}>
      <span className="dt__label">{label}</span><p className="dt__text">{text}</p>
    </div>
  );
}

function Tags({ kind, it }: { kind: BucketKind; it: ItemBase }) {
  const t: ReactNode[] = [];
  if (kind === 'news') {
    const n = it as NewsItem;
    t.push(<span className="tag tag--cat" key="c">{n.category}</span>);
    t.push(<span className={'tag ' + (n.importance === '重大' ? 'tag--major' : 'tag--minor')} key="i">{n.importance}</span>);
    t.push(<span className="tag tag--region" key="r">{n.region}</span>);
  } else if (kind === 'sum') {
    t.push(<span className="tag tag--cat" key="c">{(it as SumItem).tag}</span>);
  } else if (kind === 'tech') {
    const x = it as TechItem;
    t.push(<span className="tag tag--region" key="r">{x.track}</span>);
    t.push(<span className={'tag ' + (x.stage === '研究突破' ? 'tag--major' : x.stage === '规模落地' ? 'tag--cat' : 'tag--minor')} key="s">{x.stage}</span>);
  } else if (kind === 'rank') {
    const r = it as RankItem;
    t.push(<span className="tag tag--region" key="r">{r.track}</span>);
    t.push(<span className="rank-no" key="n">#{r.rank || '-'}</span>);
    if (r.vendor) t.push(<span className="tag tag--minor" key="v">{r.vendor}</span>);
    if (r.score) t.push(<span className="pill pill--high" key="s">{r.score}</span>);
  } else {
    const o = it as OpsItem;
    t.push(<span className={'pill ' + (o.origin === '政策规划' ? 'pill--policy' : o.origin === '本地机会' ? 'pill--local' : 'pill--market')} key="o">{o.origin}</span>);
    t.push(<span className="pill pill--track" key="t">{o.track}</span>);
    t.push(<span className="pill pill--time" key="f">{o.timeframe}</span>);
    t.push(<span className={'pill ' + (o.potential === '高' ? 'pill--high' : 'pill--mid')} key="p">潜力 · {o.potential}</span>);
    t.push(<span className="pill pill--low" key="d">门槛 · {o.difficulty}</span>);
  }
  if (it.date) t.push(<span className="tag tag--date" key="d2">{it.date}</span>);
  return <div className="dt__tags">{t}</div>;
}

function OpsWarn({ it }: { it: OpsItem }) {
  const meta = [it.level, it.region].filter(Boolean).join(' · ');
  if (!(it.origin === '政策规划' || it.origin === '本地机会') || !(it.policy || meta)) return null;
  return (
    <div className="dt__block dt__block--warn">
      <span className="dt__label">{it.origin === '本地机会' ? '本地依据' : '政策依据'}</span>
      <p className="dt__text">{it.policy || ''}{meta ? <><br /><span className="op__policy-tag">{meta}</span></> : null}</p>
    </div>
  );
}

export function DetailModal() {
  useVersion();
  const sel = state.ui.detail;
  if (!sel) return null;
  const it = findItem(sel.kind, sel.id);
  if (!it) return null;
  const kind = sel.kind;
  return (
    <div className="modal">
      <div className="modal__backdrop" onClick={closeDetail} />
      <div className="modal__card modal__card--detail" role="dialog" aria-modal="true" aria-label="消息详情">
        <div className="modal__head">
          <h2>{it.title || '详情'}</h2>
          <button className="icon-btn" type="button" aria-label="关闭" onClick={closeDetail}>✕</button>
        </div>
        <div className="modal__body">
          <Tags kind={kind} it={it} />
          {kind === 'news' ? <><Block label="精炼" text={(it as NewsItem).summary} /><Block label="详情" text={it.detail} /><Block label="影响" text={(it as NewsItem).impact} mod="acc" /></> : null}
          {kind === 'sum' ? <><Block label="要点" text={(it as SumItem).takeaway} /><Block label="详情" text={it.detail} /></> : null}
          {kind === 'tech' ? <><Block label="一句话原理" text={(it as TechItem).principle} /><Block label="为什么重要" text={(it as TechItem).why} /><Block label="深入解读" text={it.detail} /></> : null}
          {kind === 'rank' ? <><Block label="点评" text={(it as RankItem).note} /><Block label="排名依据与边界" text={it.detail} mod="acc" /></> : null}
          {kind === 'ops' ? <>
            <Block label="精炼" text={(it as OpsItem).description} />
            <Block label="详情" text={it.detail} />
            <OpsWarn it={it as OpsItem} />
            <Block label="行动建议" text={(it as OpsItem).action} mod="acc" />
            <Block label="适合谁" text={(it as OpsItem).audience} />
          </> : null}
          {!it.detail ? <p className="dt__none">旧数据没有详情,重新生成后就会有。</p> : null}
          <div className="dt__src">
            <span className="dt__label">原文出处</span>
            <span>{it.source || '未标注'}</span>
            {it.url ? <a className="dt__link" href={it.url} target="_blank" rel="noopener noreferrer">查看原文 ↗</a> : <span className="dt__none">无原文链接</span>}
          </div>
        </div>
        <div className="modal__foot">
          <span className="dt__kind">{KIND_NAME[kind]}</span>
          <div className="spacer" />
          {it.url ? <a className="btn btn--ghost" href={it.url} target="_blank" rel="noopener noreferrer">阅读原文 ↗</a> : null}
          <button className="btn btn--primary" type="button" onClick={closeDetail}>关闭</button>
        </div>
      </div>
    </div>
  );
}
