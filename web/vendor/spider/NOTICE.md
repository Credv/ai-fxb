# vendor/spider — 第三方动画层

来源：https://github.com/Kirito14IT/prompt-spider-ui （MIT License，见 `LICENSE`）
同步版本：commit `27f78315896ff4c8823c7bf7e0d5d76409e5eba7`（2026-10-14）

取用文件（只取渲染与运动学，共 5 个）：`config.js` `live-layout.js` `live-renderer.js` `spider.js` `probes.js`。
**没有取用** `renderer.js` / `model.js` / `motion.js` / `reference-track.js`——那部分是它自带的「参考演示」假数据轨道（逐词分数与轨迹按画面重建），我们的数据全部来自本站自己的快照。

## 本仓库的改动（相对上游）

`live-renderer.js` 八处。前六处只把写死的英文文案改成可注入，缺省值仍是上游原文；第七、八处是修中文场景下才暴露的排版问题。几何与动画一行未动：

1. `render()`：场景面板标题改为读 `view.titles.scene`。
2. `render()`：右上角分页 `PAGE n · N EVENTS` 改为读 `view.titles.head`（缺省仍走 `page`/`pageSuffix`）。
3. `render()`：空状态两行改为读 `view.titles.empty1/empty2`。
4. `render()`：底部页脚改为读 `view.titles.footer`；左下遥测行 `TASK MODE / LOOP / x s` 改为读 `view.titles.baseline`。
5. `web()`：分支卡片下方的 `route.toUpperCase()` 改为读 `view.routeHints[route]`。
6. `stream()` / `stats()`：侧栏与会话指标标题、状态字（`view.statusText[status]`）、`分数未提供` 等改为读 `view.titles.*`。
7. `label()`：上游用 `measureText` 截断，但测量时用的是**上一次 `text()` 留下的字体**（行号那列是 9px），绘制却是 11px，英文刚好看不出来、中文会溢出约 22% 压到下一列。改成测量前把字体固定成 `400 11px MONO`、测完还原。
8. `web()`：飞行探针会在起飞点画一份条目名，正好盖在同一行条目自己的名字上（中文长，看起来像重影）。加 `view.probeLabels` 开关，本项目设为 `false`，只保留飞行的方块与轨迹。

## 数据口径（我们喂进去的东西）

- 条目全部来自本站 `web/data/snapshot.json`，`web/net.js` 按板块归入三个分支，只改 `label` 与 `color`，不改分支数量与坐标。
- `score` 只有「模型排行」板块给得出，取的是同一榜单内 `原始分 / 榜首` 的真实比值；其余板块一律 `null`，画面上显示「未打分」，不做任何估算。
- 状态一律 `completed`，画面字标为「已入网」——它表示条目进了当天快照，不表示任何 Agent 跑过任务。
- 底部明示「数据来自本站快照 · 非实时上报」，动画本身是回放，不是实时流。

## 接法

`web/net.js` 负责全部数据：归并五个板块的条目 → 走 `validateEvent` 校验 → 按 `sum/news→情报、tech/rank→技术、ops→商机` 分流 → `requestAnimationFrame` 驱动 `LiveRenderer`。
上游的 3 个分支 `code / model / you` 写死在 `ROUTES` 和 `routeTarget()` 的坐标里，本项目只改标签语义，不动分支数量与坐标。
所有文案经 `view.titles` / `view.routeHints` / `view.statusText` / `view.probeLabels` 每帧注入。升级上游时：重新拷贝这 5 个文件，再套用上面八处改动即可，`net.js` 不用改。
