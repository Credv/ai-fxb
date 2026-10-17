# AI 窗口

一个**纯本地**的个人 AI 情报控制台（3D 科幻 HUD）：打开即保留上一次的历史记录，并在后台静默同步当日最新信息，今日新增条目自动标记 **NEW**。内容按「AI 汇总 → 前沿技术 → 模型排行 → 商机雷达 → AI 大事件」呈现。

## 特点

- 纯静态前端（HTML / CSS / JS + 本地 vendored 的 three.js 与蛛网动画层），无后端、无数据库、无构建步骤。
- **公开快照模式**：站长每天定时用自己的 Key 生成一次数据快照（GitHub Actions → `web/data/snapshot.json` → 站点自动部署），任何访客打开 https://3ecat.me 无需配置即可查看，页面显示「数据截至」时间；访客自己的 Key 永不参与。
- 浏览器直接调用大模型 API（可选，自选 Key 才启用）：内置千问(阿里云百炼)、DeepSeek、OpenAI、Claude(Anthropic) 与自定义 OpenAI 兼容网关五档预设，切换即自动填地址与默认模型；千问档支持 `enable_search` 联网检索。
- **API Key 只保存在你自己浏览器的 localStorage**，不进入代码、不上传任何服务器；站长的 Key 只存在 GitHub Actions Secret 里。
- **历史保留 + NEW 标记**：每次拉取与缓存按稳定 id 合并，未见过的条目标 NEW 并置顶，历史保留 21 天。
- **静默同步**：每天首次打开自动后台拉取（可在设置关闭），不阻塞已缓存内容的展示。
- 五大板块：AI 汇总、前沿技术（原理解读卡片）、模型排行（综合总榜 + 逻辑推理/代码/视频/图像/语音多模态五个细分榜，条形图对比；数据抓取自独立第三方评测 Artificial Analysis 的公开榜单，真实分数与出处，不靠模型编造）、商机雷达（AI 赛道 / 国家政策 / 本地机会三类融合、按赛道标签区分）、AI 大事件。
- **情报蛛网（暂未开放）**：把当天快照的条目按内容分流成三条分支（情报 = 汇总 + 大事件 / 技术 = 前沿技术 + 模型排行 / 商机 = 商机雷达）的动画视图，点任意条目直接进详情。画面用的是 MIT 授权的第三方动画层（`web/vendor/spider/`，改动清单见其 `NOTICE.md`），**数据全部来自本站快照**：分数只有模型排行给得出真实比值，其余条目一律显示「未打分」，不做任何估算。当前入口在 `index.html` 里已注释，去掉注释即恢复。
- 每条消息分两层：卡片只显示精炼文案，点开进详情弹窗看完整来龙去脉，原文出处与原文链接在卡片和弹窗内都可见。
- 3D 控制台背景：轻量 WebGL 星域 + 数据链路，软件渲染 / 低帧率自动降级为静态或关闭，手机/触屏按低配构建，可在设置手动开关。
- 移动端适配：≤640px 下导航五等分吸顶、筛选横向滑动、弹窗变底部抽屉、输入框 16px 防 iOS 自动放大。
- 可搜索的模型选择器（拉取并缓存可用模型列表）、可配置超时与地区、可读的错误提示。

## 本地运行

需要 Node.js（本项目在 Node v16 下验证）。

```bash
cd /d D:\ai-fxb
node server.mjs
```

然后浏览器打开 http://127.0.0.1:5178 。

或直接双击 `启动.bat`（Windows），会自动起服务并打开浏览器。

### 手机 / 平板

服务默认监听 `0.0.0.0:5178`，启动日志会打印本机地址和局域网地址。手机连**同一个 WiFi**，打开日志里的 `http://<本机局域网IP>:5178` 即可，界面已按小屏重排（吸顶导航、可滑动的筛选、底部抽屉式弹窗）。

- 若手机打不开，多半是 Windows 防火墙拦了入站，需要给该端口放行；只想给本机用可以 `set HOST=127.0.0.1 && node server.mjs` 收回监听。
- API Key 存在各设备浏览器自己的 localStorage 里，手机上要重新填一次；局域网里其他设备只能拿到静态页面，拿不到你的 Key。

## 首次使用

**只是看内容**:直接打开 https://3ecat.me 即可,默认显示站长每日更新的公开快照,无需任何配置。

**想用自己的 Key 实时生成**(可选):

1. 地址栏加 `?admit=true` 打开(如 https://3ecat.me/?admit=true),才会显示右上角「设置」按钮、模型/token 芯片与各板块「生成」按钮;普通访客看不到配置和生成入口(默认看公开快照,生成需要 Key,访客用不上)。
2. 选服务商（千问 / DeepSeek / OpenAI / Claude / 自定义），地址与默认模型会自动填；再填对应服务商的 API Key。
3. 选择模型（可点「拉取模型」获取可用列表）。
4. 保存后即可生成内容,此后你的设备不再读取公开快照,改为你自己的数据与静默同步。

> 网络提示：千问与 DeepSeek 国内可直连；OpenAI 的 `api.openai.com` 在国内通常连不上、Anthropic 对部分地区返回 403，这两档需可出海的网络环境。Key 始终只存本机浏览器。

## 每日快照(站长侧)

- `tools/generate-snapshot.mjs`:用环境变量里的 Key 跑一轮四个 AI 看板生成(sum/tech/news/ops),与旧快照合并(保留历史 21 天、标 NEW、最新在前)后写 `web/data/snapshot.json`。单项失败保留旧数据继续,不会把快照打空。
- **模型排行不由模型生成**:让模型"联网检索榜单"时它会连榜单名一起编(实测出现过虚构的 LMArena 版本、不存在的模型、把自家 Qwen 排第一),所以排行改为直接抓 Artificial Analysis 的公开数据镜像 `EvanZhouDev/ai-model-index`(每日同步),6 个榜单各取去重后前 5 名,整榜替换,零 token。少于 4 个榜抓取成功则保留旧数据。可用 `AIFXB_RANK_MIRROR` 覆盖镜像地址。
- `.github/workflows/update-snapshot.yml`:每天北京时间 **00:00 自动运行一次**(cron `0 16 * * *` UTC),有变化才 commit+push,推送即自动重新部署。也可在 Actions 页面手动触发。注意 GitHub 的定时触发只保证「每天一次」、不保证准点(实测延迟过 27 分钟和 4 小时 22 分),所以放在零点:即使延后几小时也仍在夜里跑完。
- 前置条件:仓库 Settings → Secrets and variables → Actions 里添加 `DASHSCOPE_API_KEY`(百炼 API Key)。Key 只存在 Secret 里,不进入仓库任何文件。
- 本地手动跑一次:
  ```bash
  AIFXB_API_KEY=sk-xxx node tools/generate-snapshot.mjs
  ```

## 目录结构

```
ai-fxb/
├─ server.mjs        # 本地静态服务器（默认监听 0.0.0.0:5178，可用 HOST/PORT 环境变量改）
├─ 启动.bat          # Windows 双击启动器
├─ tools/
│  └─ generate-snapshot.mjs   # 每日快照生成脚本（GitHub Actions 调用）
├─ .github/workflows/
│  └─ update-snapshot.yml     # 每日定时生成快照并提交
├─ web/
│  ├─ index.html
│  ├─ _headers       # Cloudflare Pages 响应头:静态资源缓存策略（国内到边缘节点一次往返 1~8 秒,能不回源就不回源）
│  ├─ styles.css
│  ├─ core.js        # 共享核心:提示词/归一化/合并规则（浏览器与快照脚本共用）
│  ├─ app.js
│  ├─ net.js         # 情报蛛网:把当日快照条目喂给下面的动画层（按需动态 import）
│  ├─ bg3d.js        # 3D 背景（three.js 270KB 在页面 load 后的空闲队列里才下载,不进首屏）
│  ├─ vendor/
│  │  ├─ three.module.js
│  │  └─ spider/     # MIT 第三方动画层 + NOTICE.md（改了什么、为什么、怎么升级）
│  └─ data/snapshot.json      # 公开快照（由 Actions 生成,不手工编辑）
└─ README.md
```

## 说明

- 请通过 `http://127.0.0.1:5178` 访问，不要用 `file://` 直接打开 HTML，否则浏览器跨域限制会导致接口调用失败。
- 本项目为个人本地工具，API 调用按你自己的千问 token 计费。
- **首屏只加载正文**：`three.js`(270KB gzip)是装饰性 3D 背景用的，不在首屏请求，页面 `load` 后走空闲队列再动态 `import`；关掉 3D 时完全不下载。`web/_headers` 负责缓存策略：首页与 `data/snapshot.json` 每次回源(保证当天快照可见)，`vendor/*` 给 30 天 `immutable`，自有 js/css 给 5 分钟 + `stale-while-revalidate`。
