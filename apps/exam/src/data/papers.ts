// 四份卷子写在这里。用 .ts 而不是 .json：tsc 会强制每一道选择题都有 answer 与 explain、
// 每个操作题都有素材与解析，缺一项就构建失败，不需要另外写脚本去数。
import type { Paper } from '../lib/types';
import { PAPER1 } from './paper1';
import { PAPER2 } from './paper2';
import { PAPER3 } from './paper3';
import { PAPER4 } from './paper4';

export const PAPERS: Paper[] = [PAPER1, PAPER2, PAPER3, PAPER4];
