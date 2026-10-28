/* 入口:先挂 admit 类(管理面默认由 CSS 隐藏),再渲染控制台。
 * 不用 StrictMode:3D 背景与蛛网动画层都是"一次挂载"的命令式单例,开发模式的双次 effect 会重复建场景。
 */
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { ADMIT } from './lib/settings';
import './styles/console.css';

if (ADMIT) document.documentElement.classList.add('admit');

createRoot(document.getElementById('root')!).render(<App />);
