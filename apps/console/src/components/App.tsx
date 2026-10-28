/* 控制台外壳 + 数据启动顺序:先读本机缓存,无 Key 再取公开快照,有 Key 才走静默同步 */
import { useEffect, useRef } from 'react';
import { DetailModal } from './DetailModal';
import { GenModal } from './GenModal';
import { SettingsModal } from './SettingsModal';
import { NewsPanel, OpsPanel, RankPanel, SumPanel, TechPanel } from './Boards';
import { NetBoard } from './NetBoard';
import { Foot, Masthead, Tabs } from './Shell';
import { UpdatedLine } from './UpdatedLine';
import { loadAllDemo, syncStale } from '../lib/generate';
import { loadSnapshot } from '../lib/snapshot';
import {
  anyLoading, closeDetail, closeGenModal, closeSettings, configured, loadCacheIntoState,
  markViewed, notify, state, useVersion
} from '../lib/store';
import { mountBg3d } from '../three/bg3d';

// 启动顺序与旧版一致:先本机缓存,再决定"演示 / 已配置则静默同步 / 否则拉公开快照"
function bootstrap(): void {
  loadCacheIntoState();
  if (state.settings.demo) { loadAllDemo(); return; }
  markViewed(state.view);
  notify();
  if (configured()) { syncStale(); return; }
  loadSnapshot();
}

export function App() {
  useVersion();
  const bgRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    bootstrap();
    const bg = bgRef.current ? mountBg3d(bgRef.current) : null;
    return () => bg?.destroy();
  }, []);

  // 生成中的"已等待 N 秒"必须走动:联网聚合可能要 1–3 分钟,静止不动会被当成卡死
  useEffect(() => {
    const id = setInterval(() => {
      if (!anyLoading()) { if (state.ui.loadStart) { state.ui.loadStart = 0; state.ui.loadSec = 0; } return; }
      if (!state.ui.loadStart) state.ui.loadStart = Date.now();
      const s = Math.round((Date.now() - state.ui.loadStart) / 1000);
      if (s !== state.ui.loadSec) { state.ui.loadSec = s; notify(); }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (state.ui.detail) closeDetail();
      else if (state.ui.genKind) closeGenModal();
      else if (state.ui.settingsOpen) closeSettings();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <canvas id="bg3d" ref={bgRef} aria-hidden="true" />
      <div className="bg-scan" aria-hidden="true" />
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow bg-glow--a" aria-hidden="true" />
      <div className="bg-glow bg-glow--b" aria-hidden="true" />

      <div className="shell">
        <Masthead />
        <UpdatedLine />
        <Tabs />
        <main>
          <SumPanel />
          <TechPanel />
          <RankPanel />
          <OpsPanel />
          <NewsPanel />
          <NetBoard />
        </main>
        <Foot />
      </div>

      {state.ui.settingsOpen ? <SettingsModal /> : null}
      {state.ui.genKind ? <GenModal /> : null}
      {state.ui.detail ? <DetailModal /> : null}
    </>
  );
}
