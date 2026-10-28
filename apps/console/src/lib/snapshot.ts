/* 公开数据接入:没有配置 Key 的访客,读的是站长每天生成好、随站点一起发布的 JSON。
 * 读不到就沿用本机已有数据;不退回示例数据——访客把「示例模型」当成真实排行会更糟。
 */
import { countNew, stampExisting } from '@ai-fxb/core';
import { notify, saveCache, state, type Bucket, type BucketKind } from './store';

const SNAPSHOT_URL = 'data/snapshot.json';

interface RawBucket { items?: unknown[]; status?: string; [k: string]: unknown }

interface SnapshotJson {
  generated_ts: number;
  generated_at?: string;
  model?: string;
  sum?: RawBucket;
  tech?: RawBucket;
  news?: RawBucket;
  rank?: RawBucket;
  ops?: RawBucket;
}

const BOARDS: BucketKind[] = ['sum', 'tech', 'news', 'rank', 'ops'];

function hasAnyItems(): boolean {
  return BOARDS.some((k) => {
    const b = state[k] as Bucket;
    return !!(b && b.items && b.items.length);
  });
}

function adoptSnapshot(snap: SnapshotJson): void {
  BOARDS.forEach((k) => {
    const b = snap[k] as Bucket | undefined;
    if (!b || !Array.isArray(b.items)) return;
    const prev = (state[k] as Bucket).items || [];
    const prevIds: Record<string, number> = {};
    prev.forEach((it) => { if (it && it.id) prevIds[it.id] = 1; });
    stampExisting(k, b.items as never);
    // 本机已有数据时按访客视角重算 NEW(自上次访问后新增的才算);
    // 首次访问沿用数据自带的 NEW(最新一轮生成时的新增)
    if (prev.length) b.items.forEach((it) => { (it as { isNew?: boolean }).isNew = !prevIds[(it as { id?: string }).id as string]; });
    b.status = b.items.length ? 'ready' : 'idle';
    b.syncing = false; b.loadingMode = null;
    b.error = ''; b.errorMeta = ''; b.errorDetail = '';
    b.loadError = ''; b.loadErrorDetail = ''; b.loadErrorMode = '';
    b.newCount = countNew(b.items as never); b.tabNew = b.newCount;
    state[k] = b;
  });
  state.snapshot = { ts: snap.generated_ts, model: snap.model || '', at: snap.generated_at || '' };
  state.snapshotError = '';
  saveCache();
}

export function loadSnapshot(): void {
  const hadData = hasAnyItems();
  function fail(e: unknown): void {
    if (hadData) return; // 本机已有旧数据:继续用,不打扰
    state.snapshotError = (e as { message?: string })?.message || String(e);
    notify();
  }
  function attempt(left: number): void {
    fetch(SNAPSHOT_URL, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status + (r.status === 404 ? '(数据文件不存在)' : ''));
        return r.json();
      })
      .then((snap: SnapshotJson) => {
        if (!snap || typeof snap.generated_ts !== 'number') throw new Error('数据格式不正确(缺少 generated_ts)');
        if (hadData && state.snapshot && state.snapshot.ts === snap.generated_ts) return; // 与本机一致,无需重灌
        adoptSnapshot(snap);
        notify();
      })
      .catch((e: unknown) => {
        // 重新部署的瞬间或网络抖一下就会读空:隔 1.5 秒静默重试一次再报错
        if (left > 0) { setTimeout(() => attempt(left - 1), 1500); return; }
        fail(e);
      });
  }
  attempt(1);
}
