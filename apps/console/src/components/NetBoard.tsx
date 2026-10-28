/* 情报蛛网页面板:画面用 net/ 里的第三方动画层,数据用本站板块里已就绪的条目 */
import { useEffect, useRef, useState } from 'react';
import { setBgPaused } from '../three/bg3d';
import { openDetail, setFilter, state, useVersion, type BucketKind } from '../lib/store';
import type { NetApi, NetBuckets } from '../net/net';

const NET_BOARDS: BucketKind[] = ['sum', 'tech', 'news', 'ops', 'rank'];
const NET_ROUTES: [string, string][] = [['all', '全部'], ['code', '情报'], ['model', '技术'], ['you', '商机']];

function buckets(): NetBuckets {
  const b: NetBuckets = {};
  NET_BOARDS.forEach((k) => { b[k] = state[k].status === 'ready' ? state[k].items : []; });
  return b;
}
function sigOf(b: NetBuckets): string {
  return NET_BOARDS.map((k) => k + (b[k] || []).length).join('|');
}
function totalOf(b: NetBuckets): number {
  return NET_BOARDS.reduce((n, k) => n + (b[k] || []).length, 0);
}

export function NetBoard() {
  const version = useVersion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<NetApi | null>(null);
  const sigRef = useRef('');
  const [netErr, setNetErr] = useState('');
  const [page, setPage] = useState({ page: 1, total: 1 });
  const active = state.view === 'net';

  useEffect(() => {
    if (!active) {
      if (apiRef.current) { apiRef.current.unmount(); apiRef.current = null; sigRef.current = ''; }
      setBgPaused(false);
      return;
    }
    setBgPaused(true);
    const b = buckets();
    const total = totalOf(b);
    if (!total) {
      if (apiRef.current) { apiRef.current.unmount(); apiRef.current = null; sigRef.current = ''; }
      return;
    }
    const sig = sigOf(b);
    if (apiRef.current && sigRef.current === sig) { apiRef.current.pick(state.filters.netRoute); return; }
    if (netErr) return;
    let cancelled = false;
    import('../net/net').then(({ createNet }) => {
      if (cancelled || state.view !== 'net' || !canvasRef.current) return;
      const api = apiRef.current || createNet(canvasRef.current);
      apiRef.current = api;
      api.mount(buckets(), {
        onPick: (board, id) => openDetail(board, id),
        onPage: (p, t) => setPage({ page: p, total: t }),
        date: state.rank.generated_at || state.sum.generated_at || '',
        connection: state.snapshot ? '公开快照' : '本机生成'
      });
      api.pick(state.filters.netRoute);
      sigRef.current = sigOf(buckets());
    }, (e) => { if (!cancelled) setNetErr((e && e.message) ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [active, version, netErr]);

  useEffect(() => () => {
    if (apiRef.current) apiRef.current.unmount();
    setBgPaused(false);
  }, []);

  const b = buckets();
  const total = totalOf(b);
  return (
    <section className={'panel' + (active ? ' is-active' : '')} id="panel-net" role="tabpanel" aria-labelledby="tab-net" hidden={!active}>
      <div className="toolbar">
        <span className="toolbar__sel">{total ? '共 ' + total + ' 条入网' : ''}</span>
        <div className="spacer" />
        <span className="toolbar__status">第 {page.page} / {page.total} 页</span>
        <button className="btn btn--ghost btn--sm" type="button" disabled={page.page <= 1} onClick={() => apiRef.current?.step(-1)}>上一页</button>
        <button className="btn btn--ghost btn--sm" type="button" disabled={page.page >= page.total} onClick={() => apiRef.current?.step(1)}>下一页</button>
      </div>
      <p className="ops-hint" data-admin="1">把当日快照的条目结成一张网:左侧是条目,右侧按内容分三条分支,点条目直接看详情。</p>
      <div className="filters">
        <div className="filter-group">
          <span className="filter-group__label">分支</span>
          <div className="chips">
            {NET_ROUTES.map(([val, label]) => (
              <button key={val} type="button" className={'chip' + (state.filters.netRoute === val ? ' is-on' : '')}
                onClick={() => { setFilter('netRoute', val); apiRef.current?.pick(val); }}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      {!total ? (
        <div className="panel-state">
          <p>还没有条目:先在其它板块生成,或等每日快照写入。</p>
          {netErr ? <p>动画层加载失败:{netErr}</p> : null}
        </div>
      ) : null}
      <div className="net-stage"><canvas ref={canvasRef} width={1600} height={900} hidden={total === 0} aria-label="情报蛛网:当日快照条目按分支分流的动画视图" /></div>
      <p className="net-swipe">左右滑动看完整蛛网</p>
    </section>
  );
}
