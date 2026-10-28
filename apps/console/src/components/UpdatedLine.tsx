/* 顶部数据行:演示 / 公开快照 / 本机生成 三种口径各说各的话 */
import type { CSSProperties } from 'react';
import { ADMIT } from '../lib/settings';
import {
  anySyncing, configured, fmtDateTime, lastFetchTs, state, totalNew, useVersion
} from '../lib/store';

export function UpdatedLine() {
  useVersion();
  const line = currentLine();
  return <p className="updated" id="updatedLine" style={line.style}>{line.str}</p>;
}

function currentLine(): { str: string; style: CSSProperties } {
  if (state.settings.demo) {
    return {
      str: '⚠ 演示模式:以下为内置示例数据,非真实检索结果。请在「设置」填写 API 并关闭演示模式。',
      style: { color: '#fde68a' }
    };
  }
  if (!configured()) {
    // 未配置 Key 的访客:看的是站长每天生成的公开快照
    if (state.snapshotError) {
      return {
        str: '数据载入失败:' + state.snapshotError + ' · 稍后刷新重试' + (ADMIT ? ',或在「设置」配置自己的 API Key。' : '。'),
        style: { color: '#fda4af' }
      };
    }
    if (state.snapshot) {
      const ns = totalNew();
      return {
        str: '数据截至 ' + fmtDateTime(state.snapshot.ts) + (ns ? ' · ' + ns + ' 条新增(NEW)' : ''),
        style: {}
      };
    }
  }
  const parts: string[] = [];
  const ts = lastFetchTs();
  if (ts) parts.push('上次更新 ' + fmtDateTime(ts));
  const n = totalNew();
  if (n) parts.push(n + ' 条今日新增(NEW)');
  if (anySyncing()) {
    return { str: '⟳ 正在后台静默同步最新信息…' + (parts.length ? ' · ' + parts.join(' · ') : ''), style: { color: '#7dd3fc' } };
  }
  return { str: parts.length ? parts.join(' · ') : '尚未同步数据。', style: {} };
}
