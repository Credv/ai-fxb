# AI 窗口

一个**本地优先**的个人 AI 情报控制台（3D 科幻 HUD）：打开即保留上一次的历史记录，并在后台静默同步当日最新信息，今日新增条目自动标记 **NEW**。内容按「AI 汇总 → 前沿技术 → 模型排行 → 商机雷达 → AI 大事件」呈现。

线上 https://3ecat.me 现在有两个入口：

- `/` —— 个人简历站（`apps/resume`）
- `/ai-fxb/` —— 本控制台（`apps/console`）

两者共用一个仓库、一次构建、一个域名（Cloudflare Workers 静态资产托管，push 即部署）。

## 特点

- **无后端**：只有静态产物。构建工具是 Vite + React 18 + TypeScript（npm workspaces 单仓库：`packages/core` 共享核心 + `apps/resume` + `apps/console`）。three.js 从 npm 取，按需动态加载，不再 vendored 进仓库。
- **公开快照模式**：站长每天定时用自己的 Key 生成一次数据快照（GitHub Actions → `apps/console/public/data/snapshot.json` → 站点自动部署），任何访客打开 https://3ecat.me/ai-fxb/ 无需配置即可查看，页面显示「数据截至」时间；访客自己的 Key 永不参与。
- 浏览器直接调用大模型 API（可选，自选 Key 才启用）：内置千问(阿里云百炼)、DeepSeek、OpenAI、Claude(Anthropic) 与自定义 OpenAI 兼容网关五档预设，切换即自动填地址与默认模型；千问档支持 `enable_search` 联网检索。
- **API Key 只保存在你自己浏览器的 localStorage**，不进入代码、不进入构建产物、不上传任何服务器；站长的 Key 只存在 GitHub Actions Secret 里。
- **历史保留 + NEW 标记**：每次拉取与缓存按稳定 id 合并，未见过的条目标 NEW 并置顶，历史保留 21 天。
- **静默同步**：每天首次打开自动后台拉取（可在设置关闭），不阻塞已缓存内容的展示。
- 五大板块：AI 汇总、前沿技术（原理解读卡片）、模型排行（综合总榜 + 逻辑推理/代码/视频/图像/语音多模态五个细分榜，条形图对比；数据抓取自独立第三方评测 Artificial Analysis 的公开榜单，真实分数与出处，不靠模型编造）、商机雷达（AI 赛道 / 国家政策 / 本地机会三类融合、按赛道标签区分）、AI 大事件。
- **情报蛛网（暂未开放）**：把当天快照的条目按内容分流成三条分支（情报 = 汇总 + 大事件 / 技术 = 前沿技术 + 模型排行 / 商机 = 商机雷达）的动画视图，点任意条目直接进详情。画面用的是 MIT 授权的第三方动画层（`apps/console/src/net/vendor/spider/`，改动清单见其 `NOTICE.md`），**数据全部来自本站快照**：分数只有模型排行给得出真实比值，其余条目一律显示「未打分」，不做任何估算。入口开关在 `apps/console/src/components/Shell.tsx` 的 `SHOW_NET_TAB`，改成 `true` 即恢复。
- 每条消息分两层：卡片只显示精炼文案，点开进详情弹窗看完整来龙去脉，原文出处与原文链接在卡片和弹窗内都可见。
- 3D 控制台背景：轻量 WebGL 星域 + 数据链路，软件渲染 / 低帧率自动降级为静态或关闭，手机/触屏走低配参数（运行时按 `pointer:coarse` 与视口宽度判定），可在设置手动开关。three.js 不在首屏请求（见「说明」）。
- 移动端适配：≤640px 下导航等分吸顶、筛选横向滑动、弹窗变底部抽屉、输入框 16px 防 iOS 自动放大。
- 可搜索的模型选择器（拉取并缓存可用模型列表）、可配置超时与地区、可读的错误提示。

## 本地运行

需要 **Node 20+**（Vite 5 不支持 Node 16；本机装在 `D:\tools\node20`）。

```bash
cd /d D:\ai-fxb
npm install            # 首次
npm run build          # core → 简历 → 控制台 → 拼装到 dist/
npm run preview        # 起本地静态服务器,默认 0.0.0.0:5178
```

- 简历 → http://127.0.0.1:5178/
- AI 窗口 → http://127.0.0.1:5178/ai-fxb/

或直接双击 `启动.bat`（Windows），自动装依赖、构建、起服务并打开浏览器。

改代码时不必每次全量构建，用开发服务器（带热更新）：

```bash
npm run dev:console    # 控制台 http://127.0.0.1:5178/ai-fxb/
npm run dev:resume     # 简历   http://127.0.0.1:3000/
```

`packages/core` 被两个 app 直接引用源码之外的编译产物，改动后先 `npm run build:core`。

### 手机 / 平板

`npm run preview` 默认监听 `0.0.0.0:5178`，启动日志会打印两条路由的本机地址和局域网地址。手机连**同一个 WiFi**，打开日志里的 `http://<本机局域网IP>:5178/ai-fxb/` 即可，界面已按小屏重排。

- 若手机打不开，多半是 Windows 防火墙拦了入站，需要给该端口放行；只想给本机用可以 `set HOST=127.0.0.1 && npm run preview` 收回监听。
- API Key 存在各设备浏览器自己的 localStorage 里，手机上要重新填一次；局域网里其他设备只能拿到静态页面，拿不到你的 Key。

## 首次使用

**只是看内容**：直接打开 https://3ecat.me/ai-fxb/ 即可，默认显示站长每日更新的公开快照，无需任何配置。

**想用自己的 Key 实时生成**（可选）：

1. 地址栏加 `?admit=true` 打开（如 https://3ecat.me/ai-fxb/?admit=true），才会显示右上角「设置」按钮、模型/token 芯片与各板块「生成」按钮；普通访客看不到配置和生成入口（默认看公开快照，生成需要 Key，访客用不上）。
2. 选服务商（千问 / DeepSeek / OpenAI / Claude / 自定义），地址与默认模型会自动填；再填对应服务商的 API Key。
3. 选择模型（可点「拉取模型」获取可用列表）。
4. 保存后即可生成内容，此后你的设备不再读取公开快照，改为你自己的数据与静默同步。

> 网络提示：千问与 DeepSeek 国内可直连；OpenAI 的 `api.openai.com` 在国内通常连不上、Anthropic 对部分地区返回 403，这两档需可出海的网络环境。Key 始终只存本机浏览器。

## 每日快照（站长侧）

- `tools/generate-snapshot.mjs`：用环境变量里的 Key 跑一轮四个 AI 看板生成（sum/tech/news/ops），与旧快照合并（保留历史 21 天、标 NEW、最新在前）后写 `apps/console/public/data/snapshot.json`。单项失败保留旧数据继续，不会把快照打空。它直接复用 `@ai-fxb/core` 的提示词与归一化规则，所以跑之前要先 `npm run build:core`（workflow 里已串好）。
- **模型排行不由模型生成**：让模型"联网检索榜单"时它会连榜单名一起编（实测出现过虚构的 LMArena 版本、不存在的模型、把自家 Qwen 排第一），所以排行改为直接抓 Artificial Analysis 的公开数据镜像 `EvanZhouDev/ai-model-index`（每日同步），6 个榜单各取去重后前 5 名，整榜替换，零 token。少于 4 个榜抓取成功则保留旧数据。可用 `AIFXB_RANK_MIRROR` 覆盖镜像地址。
- `.github/workflows/update-snapshot.yml`：每天北京时间 **00:00 自动运行一次**（cron `0 16 * * *` UTC），先装依赖并编译 core，再生成快照，有变化才 commit+push，推送即触发线上重新构建部署。也可在 Actions 页面手动触发。注意 GitHub 的定时触发只保证「每天一次」、不保证准点（实测延迟过 27 分钟和 4 小时 22 分），所以放在零点：即使延后几小时也仍在夜里跑完。
- 前置条件：仓库 Settings → Secrets and variables → Actions 里添加 `DASHSCOPE_API_KEY`（百炼 API Key）。Key 只存在 Secret 里，不进入仓库任何文件。
- 本地手动跑一次：
  ```bash
  npm run build:core
  AIFXB_API_KEY=sk-xxx node tools/generate-snapshot.mjs
  ```

## 凭据与抓包

全站没有后端，所以「Key 会不会被抓走」这件事只有三个面：**请求发到哪**、**Key 放在请求的哪个位置**、**谁有机会读到它**。

- **本站只有三个出站请求**：`服务商 /chat/completions`（或 `/messages`）、`服务商 /models`、本站 `data/snapshot.json`。前两个由访客浏览器直接发给服务商，第三个不带任何凭据。没有"先把 Key 交给我们服务器再转发"这一步，Cloudflare 边缘、本站日志里自然也不会有它。
- **Key 只进请求头，不进 URL**：`Authorization: Bearer …`（Anthropic 档为 `x-api-key`）。查询串会被代理日志、Referer 链路和浏览器历史原样抄走，头不会。
- **头是 TLS 加密的**：证书由浏览器自己校验，链路上没有中间服务器解密，抓包只能看到连了哪个域名，看不到头部内容。
- **站长的 Key 只活在构建期**：GitHub Actions 从仓库 Secret 读进环境变量 → Node 脚本发一次服务商请求 → 产物只剩一份静态 JSON。它不进仓库文件、不进构建产物、不进日志（脚本只打印错误与 token 计数，且 GitHub 会自动掩码 Secret）。
- **自定义网关强制 https**：`baseUrlError()` 只接受 `https://`，以及本机回环的 `http://127.0.0.1|localhost|::1`（流量不出网卡）。填明文公网地址会在「保存 / 测试连接 / 拉取模型」三处都被拦下，并把原因写在提示里，不会静默把 Key 发出去。
- **模型输出不能执行脚本**：控制台组件不用 `innerHTML` / `dangerouslySetInnerHTML`，返回文本一律经 React 转义，堵掉"用一段回答把用户 localStorage 里的 Key 读走"这条 XSS 路径。

**诚实的边界**：localStorage 不是保险箱。同一台电脑上的恶意软件、装了读 DOM 的浏览器扩展、以及企业里装了受信任根证书的 TLS 拦截代理，都可能看到明文 Key——这是浏览器直连方案的固有前提，不是我们能"配置"掉的。所以默认路径是**快照模式：访客不提供任何 Key**，凭据根本不进入这条链路；要用自己的 Key 就别在公用或被监控的设备上开。

## 部署

线上是 **Cloudflare Workers 的「静态资产」项目**（不是 Pages —— 概览页那句「Metrics 不适用于仅包含静态资产的 Workers」就是证据），Git 绑定与自定义域 `3ecat.me` 都挂在这个 Worker 上。它靠仓库根的 **`wrangler.jsonc`** 知道要上传哪个目录：

```jsonc
{ "name": "ai-fxb", "assets": { "directory": "./dist", "not_found_handling": "none" } }
```

Cloudflare 侧需要且只需要两个字段（设置 → 构建 → 构建设置）：

- **构建命令（Build command）**：`npm run build` —— 先产出 `dist/`，否则 `wrangler deploy` 会因为目录不存在而失败
- **部署命令（Deploy command）**：保持 `npx wrangler deploy` —— 它读上面的 `wrangler.jsonc`，没有这份配置就会报「detection logic has been run in the root of a workspace」
- **Node 版本**：仓库根 `.node-version` 已写 `20`，CF 会读它选运行时（构建日志里 `nodejs@20.20.2` 就是它生效）
- 没有「输出目录」这个字段可填：Workers 项目的资产目录只认 `wrangler.jsonc`

`scripts/assemble.mjs` 把两个 app 的产物拼成发布目录：`apps/resume/dist` → `dist/`（根路由），`apps/console/dist` → `dist/ai-fxb/`，并带上根目录的 `_headers`。产物不入库（`.gitignore` 已忽略 `dist/`）。

## 目录结构

```
ai-fxb/
├─ package.json               # workspace 根:build / dev:resume / dev:console / preview / typecheck
├─ _headers                   # Workers 静态资产响应头:缓存策略(注意 CF 按顺序匹配,后写的同头规则覆盖前面的)
├─ wrangler.jsonc             # Cloudflare Workers 部署配置:资产目录 = dist
├─ 启动.bat                    # Windows 双击:装依赖 → 构建 → 起本地服务器 → 开浏览器
├─ scripts/
│  ├─ assemble.mjs            # 两个 app 的 dist 拼装成发布目录 dist/
│  └─ preview.mjs             # 本地静态服务器(服务 dist/,默认 0.0.0.0:5178)
├─ packages/
│  └─ core/                   # @ai-fxb/core:提示词、归一化、稳定 id、合并规则(浏览器与快照脚本共用)
├─ apps/
│  ├─ resume/                 # 简历站(Vite + React,base = /)
│  └─ console/                # AI 窗口(Vite + React + TS,base = /ai-fxb/)
│     ├─ index.html
│     ├─ public/data/snapshot.json    # 公开快照(由 Actions 生成,不手工编辑)
│     └─ src/
│        ├─ main.tsx          # 入口:?admit=true 时给 <html> 加 .admit
│        ├─ components/       # 外壳、五个板块、三个弹窗
│        ├─ lib/              # settings/store/api/generate/snapshot/demo
│        ├─ net/              # 情报蛛网页签 + vendor/spider(MIT 第三方动画层)
│        ├─ three/            # 3D 背景(three.js 从 npm 取,动态 import)
│        └─ styles/console.css
├─ tools/
│  └─ generate-snapshot.mjs   # 每日快照生成脚本(GitHub Actions 调用)
└─ .github/workflows/
   └─ update-snapshot.yml     # 每日定时生成快照并提交
```

## 说明

- 请通过 `http://127.0.0.1:5178` 访问，不要用 `file://` 直接打开 HTML，否则浏览器跨域限制会导致接口调用失败。
- 本项目为个人本地工具，API 调用按你自己的千问 token 计费。
- **首屏只加载正文**：`three.js`(172KB gzip)只为装饰性 3D 背景服务，不在首屏请求——页面 `load` 后走空闲队列才动态 `import`；关掉 3D 时完全不下载。蛛网动画层(`net`)是独立懒加载 chunk，它那个页签目前下线（`SHOW_NET_TAB=false`），正常情况下访客不会拉到。构建按 `react`/`three` 拆了 chunk，两个 app 的 React chunk 内容一致、哈希相同，跨路由只下载一次。
- `_headers` 负责缓存策略：`/assets/*` 与 `/ai-fxb/assets/*` 带 content-hash，给一年 `immutable`；首页与 `/ai-fxb/data/snapshot.json` 每次回源（保证当天快照可见）；其余 5 分钟 + `stale-while-revalidate`（国内到边缘节点一次往返 1~8 秒，能不回源就不回源）。
- localStorage 键名沿用旧版（`ai-fxb-settings-v1` / `ai-fxb-cache-v4` / `ai-fxb-models-v1` / `ai-fxb-usage-v1` / `ai-fxb-3d`），改造前配好的 Key、缓存与用量统计不会丢。
