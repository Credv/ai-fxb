/* 生成二次确认弹窗:点「生成」不直接发请求,先在弹窗里选范围/类型并看清代价,再确认 */
import { RANGES, TECH_RANGES } from '@ai-fxb/core';
import { generateNews, generateOps, generateRank, generateSum, generateTech } from '../lib/generate';
import {
  OPS_MODES, OPS_MODE_ORDER, closeGenModal, configured, notify, state, useVersion,
  type BucketKind
} from '../lib/store';

const GEN_KINDS: Record<BucketKind, { title: string; opt: 'range' | 'techrange' | 'mode' | 'none'; run: () => void }> = {
  news: { title: '生成 · AI 大事件', opt: 'range', run: generateNews },
  sum: { title: '生成 · AI 汇总', opt: 'range', run: generateSum },
  tech: { title: '生成 · 前沿技术', opt: 'techrange', run: generateTech },
  rank: { title: '生成 · 模型排行', opt: 'none', run: generateRank },
  ops: { title: '生成 · 商机雷达', opt: 'mode', run: generateOps }
};

function GenRangeChips({ kind }: { kind: 'range' | 'techrange' }) {
  const opts = kind === 'range' ? RANGES : TECH_RANGES;
  const active = kind === 'range' ? state.ui.genRange : state.ui.genTechRange;
  return (
    <div className="gen-opt">
      <span className="gen-opt__label">时间范围(过去 N 天)</span>
      <div className="chips">
        {opts.map((r) => (
          <button
            key={r} type="button" className={'chip' + (r === active ? ' is-on' : '')}
            onClick={() => { if (kind === 'range') state.ui.genRange = r; else state.ui.genTechRange = r; notify(); }}
          >{r} 天</button>
        ))}
      </div>
    </div>
  );
}

function genNote(): string {
  if (state.settings.demo) return '演示模式:不会调用 API,确认后直接载入内置示例数据。';
  if (!configured()) return '尚未配置 API:确认后会先打开「设置」让你填写。';
  let scope = '';
  if (state.ui.genKind === 'news' || state.ui.genKind === 'sum') scope = '范围 ' + state.ui.genRange + ' 天';
  else if (state.ui.genKind === 'tech') scope = '范围 ' + state.ui.genTechRange + ' 天';
  else if (state.ui.genKind === 'rank') scope = '综合总榜 + 6 个细分赛道榜';
  else if (state.ui.genKind === 'ops') scope = '类型「' + OPS_MODES[state.ui.genMode].label + '」';
  return '将向 ' + (state.settings.model || 'API') + ' 发起 1 次' + (state.settings.enableSearch ? '联网' : '') +
    '请求(' + scope + '),可能耗时 1–3 分钟并按 token 计费。';
}

export function GenModal() {
  useVersion();
  const kind = state.ui.genKind as BucketKind | null;
  if (!kind || !GEN_KINDS[kind]) return null;
  const def = GEN_KINDS[kind];
  const confirm = () => {
    if (kind === 'news') state.newsRange = state.ui.genRange;
    else if (kind === 'sum') state.sumRange = state.ui.genRange;
    else if (kind === 'tech') state.techRange = state.ui.genTechRange;
    else if (kind === 'ops') state.opsMode = state.ui.genMode;
    closeGenModal();
    def.run();
  };
  return (
    <div className="modal">
      <div className="modal__backdrop" onClick={closeGenModal} />
      <div className="modal__card modal__card--sm" role="dialog" aria-modal="true" aria-label={def.title}>
        <div className="modal__head">
          <h2>{def.title}</h2>
          <button className="icon-btn" type="button" aria-label="关闭" onClick={closeGenModal}>✕</button>
        </div>
        <div className="modal__body">
          {def.opt === 'none' ? (
            <div className="gen-opt">
              <span className="gen-opt__label">生成范围</span>
              <p className="gen-note">综合总榜 + 5 个细分赛道榜(逻辑推理 / 代码编程 / 视频生成 / 图像生成 / 语音多模态),一次请求完成。</p>
            </div>
          ) : def.opt === 'mode' ? (
            <div className="gen-opt">
              <span className="gen-opt__label">商机类型(分别生成、结果融合)</span>
              <div className="chips">
                {OPS_MODE_ORDER.map((m) => (
                  <button
                    key={m} type="button" className={'chip' + (m === state.ui.genMode ? ' is-on' : '')}
                    onClick={() => { state.ui.genMode = m; notify(); }}
                  >{OPS_MODES[m].label}</button>
                ))}
              </div>
            </div>
          ) : <GenRangeChips kind={def.opt} />}
        </div>
        <div className="modal__foot">
          <span className="gen-note">{genNote()}</span>
          <div className="spacer" />
          <button className="btn btn--ghost" type="button" onClick={closeGenModal}>取消</button>
          <button className="btn btn--primary" type="button" onClick={confirm}>确认生成</button>
        </div>
      </div>
    </div>
  );
}
