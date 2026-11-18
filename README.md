# AI 窗口

一个**本地优先**的个人 AI 情报控制台（3D 科幻 HUD）：打开即保留上一次的历史记录，并在后台静默同步当日最新信息，今日新增条目自动标记 **NEW**。内容按「AI 汇总 → 前沿技术 → 模型排行 → 商机雷达 → 就业形势」呈现。

线上 https://3ecat.me 现在有三个入口：

- `/` —— 个人简历站（`apps/resume`）
- `/ai-fxb/` —— 本控制台（`apps/console`）
- `/learn` —— 教案与课件（`apps/learn`，一进来看见公开课件，私密区要密码）

三者共用一个仓库、一次构建、一个域名（Cloudflare Workers 静态资产托管，push 即部署）。

## 特点

- **无后端**：只有静态产物。构建工具是 Vite + React 18 + TypeScript（npm workspaces 单仓库：`packages/core` 共享核心 + `apps/resume` + `apps/console` + `apps/learn`）。three.js 从 npm 取，按需动态加载，不再 vendored 进仓库。`apps/learn` 不依赖 `@ai-fxb/core`，它没有 API 调用，是纯内容站。
- **公开快照模式**：站长每天定时用自己的 Key 生成一次数据快照（GitHub Actions → `apps/console/public/data/snapshot.json` → 站点自动部署），任何访客打开 https://3ecat.me/ai-fxb/ 无需配置即可查看，页面显示「数据截至」时间；访客自己的 Key 永不参与。
- **`/learn` 拆成两半**：首页一进来就是**公开课件区**——按章节排的教案、板书、图解，不用密码，链接可以直接发给其他老师和学生；只有「怎么和学生相处」「教资怎么考」这类自己的东西留在**私密区**，靠 `#/private` 直达链接进去，要密码。课件页给学生另有一版：只剩图解和能拖的参数。详见「教案与课件」。
- 浏览器直接调用大模型 API（可选，自选 Key 才启用）：内置千问(阿里云百炼)、DeepSeek、OpenAI、Claude(Anthropic) 与自定义 OpenAI 兼容网关五档预设，切换即自动填地址与默认模型；千问档支持 `enable_search` 联网检索。
- **API Key 只保存在你自己浏览器的 localStorage**，不进入代码、不进入构建产物、不上传任何服务器；站长的 Key 只存在 GitHub Actions Secret 里。
- **历史保留 + NEW 标记**：每次拉取与缓存按稳定 id 合并，未见过的条目标 NEW 并置顶，历史保留 21 天。
- **静默同步**：每天首次打开自动后台拉取（可在设置关闭），不阻塞已缓存内容的展示。
- 板块：AI 汇总、前沿技术（原理解读卡片）、模型排行（综合总榜 + 逻辑推理/代码/视频/图像/语音多模态五个细分榜，条形图对比；数据抓取自独立第三方评测 Artificial Analysis 的公开榜单，真实分数与出处，不靠模型编造）、商机雷达（AI 赛道 / 国家政策 / 本地机会三类融合、按赛道标签区分；每条给「第一步 + 3–5 步上手路径 + 起步投入」）、就业形势（广州 / 深圳 / 厦门 / 漳州 四城的 AI 与软件数据类在招岗位，含所需技术、薪资与需求依据）。
- **AI 大事件（news）暂时下线**：内容与 AI 汇总重叠，每天省一次请求。数据、面板与 `NewsPanel` 都保留着，把它加回 `apps/console/src/lib/store.ts` 的 `LIVE_KINDS`（以及 `generate-snapshot.mjs` 里的 newsRes 段）即恢复。
- **情报蛛网（暂未开放）**：把当天快照的条目按内容分流成三条分支（情报 = 汇总 / 技术 = 前沿技术 + 模型排行 / 商机 = 商机雷达 + 就业形势）的动画视图，点任意条目直接进详情。画面用的是 MIT 授权的第三方动画层（`apps/console/src/net/vendor/spider/`，改动清单见其 `NOTICE.md`），**数据全部来自本站快照**：分数只有模型排行给得出真实比值，其余条目一律显示「未打分」，不做任何估算。入口开关在 `apps/console/src/components/Shell.tsx` 的 `SHOW_NET_TAB`，改成 `true` 即恢复。
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
- 教案与课件 → http://127.0.0.1:5178/learn/ （公开区直接就能看；私密区 `http://127.0.0.1:5178/learn/#/private` 要密码。改私密内容后先 `npm run learn:data`，见「教案与课件」）

或直接双击 `启动.bat`（Windows），自动装依赖、构建、起服务并打开浏览器。

改代码时不必每次全量构建，用开发服务器（带热更新）：

```bash
npm run dev:console         # 控制台 http://127.0.0.1:5178/ai-fxb/
npm run dev:resume          # 简历   http://127.0.0.1:3000/
npm run dev:learn           # 课件区 http://127.0.0.1:5179/learn/  (首页就是公开课件,起服务不要密码)
AIFXB_LEARN_PASSWORD=xxx npm run dev:learn:private   # 先重加密私密内容再起服务,要验私密区时用这条
```

> 三条 dev 服务的端口各不相同（5178 / 3000 / 5179，写在各自 app 的 `vite.config.ts` 里），且都只服务自己那个 app——`/learn` 的开发地址不带 5178。要走**和线上一样的三条路由**（简历在 `/`、控制台在 `/ai-fxb/`、课件在 `/learn/`），用 `npm run build && npm run preview`。

`packages/core` 被两个 app 直接引用源码之外的编译产物，改动后先 `npm run build:core`。

### 手机 / 平板

`npm run preview` 默认监听 `0.0.0.0:5178`，启动日志会打印三条路由的本机地址和局域网地址。手机连**同一个 WiFi**，打开日志里的 `http://<本机局域网IP>:5178/ai-fxb/` 即可，界面已按小屏重排。

- 若手机打不开，多半是 Windows 防火墙拦了入站，需要给该端口放行；只想给本机用可以 `set HOST=127.0.0.1 && npm run preview` 收回监听。
- API Key 存在各设备浏览器自己的 localStorage 里，手机上要重新填一次；局域网里其他设备只能拿到静态页面，拿不到你的 Key。
- **课件区手机上直接能看**：`http://<局域网IP>:5178/learn/` 发给学生试投屏没问题——公开课件的文字和图片都编译在 JS 里，不需要解密。**私密区不行**（只能 `127.0.0.1` 或线上 https）：解密用的 WebCrypto 只在安全上下文里存在，手机走 `http://192.168.x.x` 时浏览器根本没有 `crypto.subtle`，页面会直接说明这个原因而不是卡在「密码不对」。要在手机上看私密区，走线上地址。

## 首次使用

**只是看内容**：直接打开 https://3ecat.me/ai-fxb/ 即可，默认显示站长每日更新的公开快照，无需任何配置。

**想用自己的 Key 实时生成**（可选）：

1. 地址栏加 `?admit=true` 打开（如 https://3ecat.me/ai-fxb/?admit=true），才会显示右上角「设置」按钮、模型/token 芯片与各板块「生成」按钮；普通访客看不到配置和生成入口（默认看公开快照，生成需要 Key，访客用不上）。
2. 选服务商（千问 / DeepSeek / OpenAI / Claude / 自定义），地址与默认模型会自动填；再填对应服务商的 API Key。
3. 选择模型（可点「拉取模型」获取可用列表）。
4. 保存后即可生成内容，此后你的设备不再读取公开快照，改为你自己的数据与静默同步。

> 网络提示：千问与 DeepSeek 国内可直连；OpenAI 的 `api.openai.com` 在国内通常连不上、Anthropic 对部分地区返回 403，这两档需可出海的网络环境。Key 始终只存本机浏览器。

## 每日快照（站长侧）

- `tools/generate-snapshot.mjs`：用环境变量里的 Key 跑一轮五个看板生成（sum / tech / ops 三类 / jobs 四城两组），与旧快照合并（保留历史 21 天、标 NEW、最新在前）后写 `apps/console/public/data/snapshot.json`。一轮共 **7 次大模型调用**（sum 1 + tech 1 + ops 3 + jobs 2；rank 走第三方镜像、零 token），单项失败保留旧数据继续，不会把快照打空。它直接复用 `@ai-fxb/core` 的提示词与归一化规则，所以跑之前要先 `npm run build:core`（workflow 里已串好）。
- **就业形势分两组请求**：`core.JOB_GROUPS` 把广州/深圳、厦门/漳州各分成一组，一组一次调用（单城一次要 4 次太贵）；每组的 schema 只列本组城市，否则模型会把别城岗位也带回来、两次调用重复花钱。合并按城市分组分别做，避免第二组把第一组刚标的 NEW 冲掉；`itemId` 对 jobs 用「标题+链接+城市」而不是日期，同一岗位明天还在招不会天天重新标 NEW。
- **AI 大事件不再生成**：`snap` 里不再写 news。实测当前快照 350,855 B 里 news 占 60,716 B（17%），去掉后访客首屏少下载这么多；恢复方式见「功能」里的说明。
- **占位条目一律丢弃**：模型联网没查到时会写「模型发布待核实 / 来源：内部检索限制」这种空壳凑数（实测 sum 看板 24 条里 5 条是这种，还因为日期最新顶在最前面）。`core.isPlaceholderItem()` 统一判定（标题含待核实/未检索到、来源含检索限制、无链接且正文只在说查不到），在四处入口各过滤一遍：`normalizeSum/Tech/News/Ops/Jobs`、`mergeBucketItems`（旧数据和新数据都过）、前端读快照与读本机缓存、`generate-snapshot.mjs` 的日志。过滤后为 0 条按失败处理，保留旧数据，不会把板块打空。生成请求同时带 `search_options.forced_search`（强制联网），接口不认这个参数时整轮自动回退成仅 `enable_search`。
- `tools/purge-placeholder.mjs`：零 token 清理已写进快照的占位条目（`--check` 只报告，发现即退出码 1）。存量清理用它，之后每天由生成脚本自己保证。
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

`scripts/assemble.mjs` 把三个 app 的产物拼成发布目录：`apps/resume/dist` → `dist/`（根路由），`apps/console/dist` → `dist/ai-fxb/`，`apps/learn/dist` → `dist/learn/`，并带上根目录的 `_headers`。产物不入库（`.gitignore` 已忽略 `dist/`）。子路径完全由各 app 的 vite `base` 决定，`wrangler.jsonc` 不用改。

## 教案与课件（`/learn`）

这个站是**长远的教案存放地**，不是给某一次试讲搭的临时页面。所以它拆成两半，两半的公开性完全不同：

**公开课件区**（默认首页，不要密码）—— 一进来就是按章节排的目录，每章下面挂已备好的课，一课两张网页：

- **课件页** `#/c/<课件号>`：完整的一课 —— 教学设计（课标依据、**教材对照**、学情、目标、重难点）、**讲台逐字稿**（37 拍：铃响之前 5 拍——进门先接投影线、坐到最后一排看一眼屏幕认不认得清那些小符号、趁铃还没响真跑一遍、站定等 5 秒、「同学们好！」「请坐。」——加课上 32 拍，从 `0–1` 排到 `44–45`。每拍四样：你的动作、可以直接念出口的话（88 句 2491 字）、「他们那边出现什么 → 你接哪一句」（56 条，一次课只走其中一条）、应变 19 条）、课堂环节、板书、图解、给学生的提问。要发给其他老师看就发这条链接。这一稿的写法是「每一句都能当场念出口，而且是在跟学生说话」：课上 32 拍每一拍都有称呼或承接（32/32，「同学们」「大家」「我们」「刚才」「现在」这一类），六个分段的第一句都接住上一段（6/6），没有一处连续三拍不面向学生；台词里带「？」的那一拍必须备着不少于两条接法（17 个提问拍，备法不足的 0 拍）；每拍字数不许超过分钟数 × 180（按 200～260 字/分钟的语速再留出停顿，实测最密的一拍 152 字每分钟）；页面上「每个符号各管什么」那七块必须按第一块到第七块的顺序在稿子里讲齐；稿子里出现的每一行板书必须就是「板书」那一块的原文（7 条双端核对）；`ask` 里那 7 条预设问题的答法必须在稿子里接得住；台词里点名的文件必须和私密区清单 `prep.json` 里那几份对得上（`sheet.py`、`trial.py`）；台词里不许出现「字段 / 控件 / 滑杆 / 参数 / 评委 / 巡堂」这类页面话和后台词（实测 0 处）。稿子里每条「这样写会输出 X」和每条当红字引用的报错原文都拿本机 CPython 跑过（25 条对 25 条，0 处不符；稿子里念出口的 18 条输出与报错必须全部落在这份清单里，冒出一条没验过的就判失败），时间轴由脚本检查是否从 0 接满到下课、「课前」那几拍有没有混进数字拍中间、六个分段的名字和时间范围跟「课堂环节」是否同名同序；**这两份文档（README 与产品说明书）里写的必须就是这一稿的实测数**——17 项该出现的数一项不许缺，改稿时留下的旧数字一处不许留（`D:\tmp\script-check.py` 第 9 条，同样是仓库外的本地回归，当前 0 fail）。
- **学生版** `/learn/student/#/l/<课件号>`：**另建的一份 HTML**（`apps/learn/student/index.html` + `src/student.tsx`，vite 的第二个入口），只剩图解和**能拖的参数**，没有教案正文，教师口吻的旁白也一并收掉（`PlainCtx` 在每个图解组件里控制）。学生自己把宽度拖到「不设」、把小数拖到 1，看输出怎么变——这是这一版存在的唯一理由。分两份是有意为之：这一张上面**找不到课件、目录、备课台的任何入口**（整页零个链接，只有上一课/下一课），所以链接发出去不用担心学生顺着摸到备课那几页；从前写在课件页里的 `#/s/<课件号>` 会自动跳到新页，早前发出去的链接不会变死链。因为学生版不 import `lib/store.ts`（它连着解密和私密区标签），打出来的包里也就没有私密区的字样。

章节骨架按《普通高中信息技术课程标准(2017 年版 2020 年修订)》必修「数据与计算」的内容主线排，**不是某一版教材的单元名**（人教/浙教/教科版的单元名和顺序各不相同）。还没备课件的章照样列出来，标「未备课件」——不编一份看着齐全的目录。

教材那一层对的是**人教中图版（2019）必修 1《数据与计算》**（人民教育出版社 · 中国地图出版社，ISBN 978-7-107-33845-8，151 页，主编 祝智庭、樊磊）：每章目录下面多一行「在课本里是第几章第几节」，课件页的教学设计里多一块「教材对照」，给到节一级（这一课挂在第2章 → 2.3 程序设计基本知识 → 2.3.3 语句与程序结构，往下接 2.4）。四条规矩：

- **节名照目录抄，页码一个不写**。章与节的标题取自国家中小学智慧教育平台这一册的章节树，纸书目录交叉核过；能查到的只是平台 PDF 的页序（第2章 = 44、2.3 = 62），跟纸书印的页码差着前言那几页，所以页码整块留空，不猜。
- **只挂官方电子版入口，不放扫描图**。课件里两条链接都在 `basic.smartedu.cn`，正文要先注册登录才翻得动；出版社那边 `sinomaps.com` 的课本页实测 404（搜索引擎缓存里还留着「主编 祝智庭︱樊磊、ISBN 978-7-107-33845-8」那几条字段，就当元数据出处）。德问文库、课本网、教习网、学科网这些站的「电子课本免费下载」是别人扫描上传的，仓库是 public 的，一个字节都不往里放。
- **对不上的地方写在页面上**。最后一章「信息安全与社会责任」必修 1 里没有整章（只沾到 3.2.3 数据安全、4.3.2 人工智能的影响），它在必修 2《信息系统与社会》第4章；课本自己的第4章「走进智能时代」（4.1–4.3）这边还没排进章里；平台把纸书的 2.3.3 一节切成了「2.3.3 程序语句 / 2.3.4 程序结构」两条，点进去节号会差一位。这三条都写在页面上，不装成一套对得严丝合缝的目录。
- **课本压根不是这一本时直说**。试课的选题可能落在另一门学科的书上——比如江苏凤凰教育出版社的通用技术必修《技术与设计1》（主编顾建军，2019 版，七章，三源核过目录）：整本没有编程，最接近的一节只有第五章的计算机辅助设计，讲的还是制图。这句话写进了「教材对照」里「这一课补上去的」那一行末尾：手上那本若是别的学科，这一课就是**课本外的选题**，不必回课本里找它对应哪一节。这一册在智慧教育平台只有教材目录入口那条路可给，`contentId` 搜不出来，不编。

这几条由 `D:\tmp\book-check.py` 逐条扫：ISBN 校验位、每个节号/节名/章名必须在核到的目录里、每条 URL 的域名必须官方、不许出现页码、不许出现扫描站域名（当前 75 条断言，0 fail）。脚本在仓库外，属于本地回归。换别的版本改 `courseware.json` 里的 `textbook` 和 `plan.textbookRef` 即可，课件本身不用动。

这一半的明文**直接入库**：`apps/learn/content/courseware.json`，被 `src/lib/courseware.ts` 编译进 bundle。它本来就要给别人看，加密只会让分享变麻烦，不会带来任何保护。

**私密区** `#/private/<视图>` —— 试讲准备、学生相处、知识地图、教师资格证四页。首页**不放任何入口**，只有知道这条直达链接并且有密码的人进得去。这一半走**构建时加密**：

- 仓库是 **public** 的，而这站没有后端，所以「输密码才能看」不能写成前端判断——那样密码和答案都在 JS 里，等于没锁。
- 明文只存在本地：`apps/learn/content/private/*.json`（四份，已被 `.gitignore` 忽略，永远不会进仓库）。
- `tools/build-learn-content.mjs` 读这几份文件，用密码派生密钥（PBKDF2-SHA256，210 000 次迭代）后以 AES-256-GCM 加密，写出唯一入库的产物 `apps/learn/public/data/content.json` —— 里面只有密文和 salt/iv。
- 浏览器端 `src/lib/crypto.ts` 做同样的派生再解密。**密码不对时 GCM 认证标签校验失败，什么都解不出来**，页面只会显示一句「密码不对。」
- 210 000 次迭代是故意的：让离线爆破密码的代价高，代价是解锁要等约一秒。
- 密文**只在真的走到 `#/private` 时才去取**（`store.ts` 的 `ensurePrivate`）。看课件区的访客——包括学生——一个字节都不会下载，公开页的首屏因此不掺密文。
- 密码只从环境变量 `AIFXB_LEARN_PASSWORD` 读，命令行给一次即可，**不写进任何文件、不设 CI Secret**：`npm run build` 里不包含加密步骤，云端构建只搬运已经加密好的 `content.json`，所以 Cloudflare 和 Actions 都不需要知道密码。
- 解锁状态放 `sessionStorage`（`learn-pw-v1`），关掉标签页就没了，点「退出」立即清掉并回到锁屏；不落 localStorage、不进 cookie。

> **已知的边界（诚实版）**：加密的是私密区的**内容**，不是它的**存在**。四个视图的标题（「试讲准备」「知识地图」这种）和页面骨架写在 `src/lib/store.ts` 与 `src/views/*.tsx` 里，是入库的、能读到的——它们落在课件那张页才会下载的 `main-*.js` 里，学生版那张页不请求这个文件。判据是 `D:\tmp\leak-student.py`：拿私密区那四份 JSON 的中文 8-gram 去比学生版实际请求的 5 个文件（`index.html` + `react-*.js` + `student-*.js` + 共用的 `learn-*.js` 与 `learn-*.css`），**命中 0 条**；同一把尺子量整站公开文件是 6 条，逐条看过都来自「信息技术学科知识与教学能力」这一个公开的考试科地名（13 个字切成 8-gram 正好 6 条；它是教师资格证的一门公开科目名，写在 [apps/learn/src/views/Cert.tsx:36](file:///D:/ai-fxb/apps/learn/src/views/Cert.tsx#L36) 那句「笔试三科」的说明里，跟着编译进 `main-*.js`，学生版那张页不请求这个文件）。换成直接扫那八个标签字样（试讲准备 / 知识地图 / 学生相处 / 教师资格证 / 解锁 / 输入密码 / 私密 / `content.json`）：学生版那 5 个文件的字节里 **0 条**，整站 10 条且全在 `main-*.js`。另拿 20 个只在教师侧出现的字样扫学生版**渲染出来的文字**（DOM 的 `innerText`）：**0 命中**，整页也**零个 `<a>`**——「教学设计」「教材对照」「逐字稿」「讲台」「ISBN」「978-7-107」「智慧教育」「接话」「第七块」「红粉笔」，加上这一版稿子里的「同学们好」「请坐」「班长」「起立」「课前」「巡堂」「评委」「你卡在第几步」「读书摘记」和开头那句「哪一版你愿意每周看」。（「逐字稿」「重难点」这两个词整个包里一次都不出现：页面上那一节的标题是「讲台上，一句一句怎么说」。）
>
> 但同样的词在**文件字节**里是有的，这一层要说清：`D:\tmp\leak-learn.py` 扫 `dist/learn` 那 8 个文件，共用 chunk `learn-*.js` 里 讲台 5、评委 8、巡堂 3、板书 10、同学们好 1、试讲 2、密码 1，`main-*.js` 里 教学设计 2、学情 1、私密 2、`content.json` 3。也就是说学生**下载得到**那些中文，只是**看不到**——懂技术的学生从浏览器里下到那个 JS，`grep` 得到里面的内容。这个共享文件当前**磁盘 70.9 kB / gzip(-9) 27.66 kB**（磁盘那个是 gzip 报的那个数，不是磁盘），量法可复跑：`python -c "import gzip,sys;p=sys.argv[1];b=open(p,'rb').read();print(len(b)/1024, len(gzip.compress(b,9))/1024)" dist/learn/assets/learn-*.js`。要连这层都断掉，就得把 JSON 按读者拆成两份、学生版那份只留 `py` 和 `guide`——目前没拆，因为它本来就是公开仓库里给人看的内容。

改内容的工作流分两条，**别走错**：

```bash
# A. 改公开课件(加一课、调图解参数)——改完直接构建,不用加密
cd /d D:\ai-fxb
# 1. 改 apps/learn/content/courseware.json
npm run build:learn && node scripts/assemble.mjs && npm run preview
git add apps/learn/content/courseware.json && git commit && git push

# B. 改私密区——多一步重新加密,漏了等于没改
# 1. 改 apps/learn/content/private/*.json
set AIFXB_LEARN_PASSWORD=<你的密码> && npm run learn:data   # 重新加密
npm run build && npm run preview                             # 本地验证 /learn/#/private
git add apps/learn/public/data/content.json && git commit && git push
```

忘了跑 `learn:data` 是最容易踩的坑：构建和推送都成功，但线上还是旧内容——因为入库的密文没变。`learn:data` 会打印明文/密文字节数与 `builtAt`，对不上就是没跑。`npm run build` 只产出 `apps/learn/dist`，`/learn/` 走的是 `dist/learn/`，所以本地验证还得跟一条 `node scripts/assemble.mjs`。

**加一课**：往 `courseware.json` 对应章的 `lessons` 里加一项（`id` 就是链接里的课件号，定了就别改，已经发出去的链接指着它）。目录顶上「章节 / 已备课件 / 可拖参数的实验」三个数是现算的，不用手改。

**课件里的 Python 输出必须和真 Python 一样**——学生就是来拖参数看输出的，错了这一页就没有意义。所以现在有这些约定，改动 `Lab.tsx` / `diagrams.tsx` / `lib/text.ts` 时不要绕过：

- 补位按 `len()`（一个中文算 1），不是按显示列宽；屏上占几列只在讲「表为什么歪了」那条陷阱时提。
- 宽度填 0 = **不设宽度**，一个空格也不补。早先这里按「本列最宽内容」补齐，屏幕上摆齐了，但那行代码其实打不出那一行。
- 表头那一行也是页面真实输出，所以代码块必须连表头的 `print` 一起给；且表头是字符串，格式串只能带对齐和宽度，带上 `.Nf` 真 Python 直接 `ValueError`。
- 舍入是**四舍六入五成双**（`fmtValue` 里的 `pyFixed`）：`1.25` 留一位小数 Python 给 `1.2`，JS 的 `toFixed` 给 `1.3`，而这个值学生敲得出来。
- 这三条都拿真 CPython 对过：两个网格 + 演练场共 10 个状态（含三个正好落在中间的值）逐行比过 DOM 与 `python` 的 stdout；`pyFixed` 跑了 542 个用例与 Python `format()` 对比，0 处不一致。图解文案里每条声称"会输出 X"的句子也都真跑过。

## 目录结构

```
ai-fxb/
├─ package.json               # workspace 根:build / build:learn / learn:data / dev:* / preview / typecheck
├─ _headers                   # Workers 静态资产响应头:缓存策略(注意 CF 按顺序匹配,后写的同头规则覆盖前面的)
├─ wrangler.jsonc             # Cloudflare Workers 部署配置:资产目录 = dist
├─ 启动.bat                    # Windows 双击:装依赖 → 构建 → 起本地服务器 → 开浏览器
├─ scripts/
│  ├─ assemble.mjs            # 三个 app 的 dist 拼装成发布目录 dist/
│  └─ preview.mjs             # 本地静态服务器(服务 dist/,默认 0.0.0.0:5178)
├─ packages/
│  └─ core/                   # @ai-fxb/core:提示词、归一化、稳定 id、合并规则(浏览器与快照脚本共用)
├─ apps/
│  ├─ resume/                 # 简历站(Vite + React,base = /)
│  ├─ console/                # AI 窗口(Vite + React + TS,base = /ai-fxb/)
│  │  ├─ index.html
│  │  ├─ public/data/snapshot.json    # 公开快照(由 Actions 生成,不手工编辑)
│  │  └─ src/
│  │     ├─ main.tsx          # 入口:?admit=true 时给 <html> 加 .admit
│  │     ├─ components/       # 外壳、各板块面板(含已下线的 NewsPanel)、三个弹窗
│  │     ├─ lib/              # settings/store/api/generate/snapshot/demo
│  │     ├─ net/              # 情报蛛网页签 + vendor/spider(MIT 第三方动画层)
│  │     ├─ three/            # 3D 背景(three.js 从 npm 取,动态 import)
│  │     └─ styles/console.css
│  └─ learn/                  # 教案与课件(Vite + React + TS,base = /learn/,不依赖 @ai-fxb/core)
│     ├─ content/courseware.json       # 公开课件明文:章节骨架 + 每课(教案/板书/图解/lab) —— 入库
│     ├─ content/private/*.json        # 私密区明文:prep / students / map / cert —— 已 gitignore,只留本机
│     ├─ public/data/content.json      # 上面四份加密后的唯一入库产物,浏览器用它解密(只有走 #/private 才取)
│     ├─ student/index.html            # 学生版那份 HTML 的壳(vite 第二个入口 → /learn/student/)
│     └─ src/
│        ├─ components/       # Lab(格式化演练场)、diagrams(图解,含 PlainCtx 收教师旁白)、Code(Python 高亮)、ui、Accordion(折叠块,只有课件/私密区用)、Gate(锁屏)、Nav、Rail(快速定位)
│        ├─ views/            # Catalog(章节目录) / Course(课件页) + 私密区四页
│        ├─ student.tsx       # 学生版整页:自带 #/l/<id> 路由,不 import store(所以包里不掺私密区字样)
│        ├─ lib/              # courseware(读公开明文)/crypto(解密)/store(路由+门禁)/text(按 len() 模拟格式化、Python 舍入)/types
│        └─ styles/learn.css
├─ tools/
│  ├─ generate-snapshot.mjs   # 每日快照生成脚本(GitHub Actions 调用)
│  └─ build-learn-content.mjs # 把 content/private/*.json 加密成 public/data/content.json(本地跑,不进 CI)
└─ .github/workflows/
   └─ update-snapshot.yml     # 每日定时生成快照并提交
```

## 说明

- 请通过 `http://127.0.0.1:5178` 访问，不要用 `file://` 直接打开 HTML，否则浏览器跨域限制会导致接口调用失败。
- 本项目为个人本地工具，API 调用按你自己的千问 token 计费。
- **首屏只加载正文**：`three.js`(172KB gzip)只为装饰性 3D 背景服务，不在首屏请求——页面 `load` 后走空闲队列才动态 `import`；关掉 3D 时完全不下载。蛛网动画层(`net`)是独立懒加载 chunk，它那个页签目前下线（`SHOW_NET_TAB=false`），正常情况下访客不会拉到。构建按 `react`/`three` 拆了 chunk，两个 app 的 React chunk 内容一致、哈希相同，跨路由只下载一次。
- `_headers` 负责缓存策略：`/assets/*` 与 `/ai-fxb/assets/*`、`/learn/assets/*` 带 content-hash，给一年 `immutable`；首页与 `/ai-fxb/data/snapshot.json`、`/learn/data/content.json` 每次回源（保证当天快照与最新内容可见）；其余 5 分钟 + `stale-while-revalidate`（国内到边缘节点一次往返 1~8 秒，能不回源就不回源）。
- `/learn` 的页面：`/learn/` 这一张走 hash（`#/`、`#/c/<id>`、`#/private/<视图>`），学生版是另一张 HTML `/learn/student/#/l/<id>`。都是 hash + 静态目录，托管端不用配任何重写规则；课件号写在链接里，发出去的链接不会因为这站改版而失效（旧 `#/s/<id>` 会自动送到新页）。
- localStorage 键名沿用旧版（`ai-fxb-settings-v1` / `ai-fxb-cache-v4` / `ai-fxb-models-v1` / `ai-fxb-usage-v1` / `ai-fxb-3d`），改造前配好的 Key、缓存与用量统计不会丢。
