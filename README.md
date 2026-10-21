# 拾光 · StudyFlow

一款本地优先的学习计划 PWA：柔和彩色任务卡、每日打卡、四级弹性练习、个人课表、网课进度与习惯日历。支持浅色、深色与系统外观，无需账号或后端。

## 本地运行

使用 Node.js 24。

```sh
npm ci
npm run dev
```

开发网址为 `http://127.0.0.1:5173/cet4-study-planner/`。正式离线功能需要构建后运行：

```sh
npm run build
npm run preview
```

预览网址为 `http://127.0.0.1:4173/cet4-study-planner/`。

## 页面与功能

- 今日：七日日期导航、任务完成与取消、任务详情、五档英语练习、考试倒计时、个人课程和每日备注。
- 计划：自定义计划与任务、单次/每日/工作日/每周重复、网课章节进度、四级阶段路线、真题记录增删改。
- 日历：整月完成状态、每天的历史任务、最近七天实际学习分钟与清单完成率、温和的连续打卡提示。
- 我的：外观、学期起点与目标日期、课表导入、备份恢复、旧版迁移说明和 iPhone 安装指南。

打卡不会自动产生学习时长。请在任务详情中填写实际分钟。课堂不另计时；实验、实习与体育需要按要求参与。未来日期可安排任务，到当天才可打卡。修改重复任务从今天起生效，过去日期和已完成或已记时的任务保留快照。

## 个人课表

初始应用没有真实个人课表或学习记录。通过「我的 → 导入课表 / 恢复备份」选择你自己的课表 JSON，查看导入预览后合并或替换。课程周次使用显式数组，不擅自推测每周重复；未知日期可设为待通知，主表与附注的矛盾保留为待核实。

课表格式为 `schemaVersion: 1`，包含 `timezone: "Asia/Shanghai"`、周一格式的 `semesterStart`、`examDate`、`courses`、`uncertainNotes` 和可选 `weekPlan`。每门课程含 `day`（周一为0，周日为6，待通知为-1）、`s`（节次如 `1–2`）、`name`、`weeks`（1–53的整数数组）、`type`、可选 `note`。类型可选 `theory/digital/lab/activity/practice`。不要把私有课表放入 `public/`。

## 保存、备份与迁移

数据保存在当前来源的 IndexedDB。写入完成后才更新界面；失败会显示提示。支持浏览器 Web Locks 的设备会串行跨窗口写入，其他窗口通过 BroadcastChannel 读取最新保存。存储不是云同步；系统清理、更换设备或更换网址时可能无法访问原记录。

「我的 → 导出 JSON 备份」导出所有学习数据；恢复时支持严格校验、按ID去重和合并，冲突项保留本机版本。「替换恢复」会先下载本机当前备份，再替换数据。请确认下载成功并保留备份。支持版本1到版本2的字段迁移，未知未来版本拒绝导入；错误文件不会覆盖本机数据。单文件最多10MB。

旧版网页的 localStorage 无法跨来源直接读取。在仍能看到旧记录的原浏览器中运行 `public/legacy-exporter.txt` 的脚本，下载旧版 JSON，再导入拾光。脚本只读取 `cet26_` 数据，不删除旧记录。各英语档位勾选取并集；旧版缺失的实际时长和试卷信息不会虚构补齐。

## iPhone 安装与更新

使用 Safari 打开正式 HTTPS 网站 → 分享 → 添加到主屏幕；如有「作为网页 App 打开」选项，请开启。首次联网打开后等待离线缓存就绪，再断网使用。安装后确认记录可见，必要时用备份恢复。

应用更新会提示，点击「更新」前等待当前保存完成。Service Worker 只维护应用缓存，不删除 IndexedDB。支持 safe-area、系统减少动态效果和16px表单输入，避免 iPhone 聚焦时页面自动放大。真实 iPhone 安装与系统存储回收行为仍需在设备上验收。

## 验证与部署

```sh
npm run test
npm run typecheck
npm run build
npm run check:privacy
npx playwright install chromium webkit
npm run test:e2e
```

Windows 的 Chromium 项目自动使用已安装 Edge；Linux/CI 使用 Playwright Chromium。另有 WebKit 项目用于接近 Safari 的兼容性检查。浏览器测试包括375/390/430布局、浅深色、数据持久化、导入导出与离线启动。真实等待中的 Service Worker 更新和记录保留只在 Chromium 自动验证；当前 Windows WebKit 在重复更新测试中未发起第二次 worker 请求，该条测试明确跳过，不能据此声称 Safari 更新通过。[Playwright 的 Service Worker 自动化说明](https://playwright.dev/docs/service-workers)仅支持 Chromium。Safari 的版本更新与主屏幕独立窗口需在真实 iPhone 上验收。测试数据与截图仅用于测试，不进入发布内容。

GitHub Actions 的 `.github/workflows/deploy.yml` 在检查通过后只发布 `dist/`。创建独立仓库前须由仓库持有人确认公开发布；在 Settings → Pages 选择 GitHub Actions。仓库名称预设为 `cet4-study-planner`，Vite base、manifest scope、start_url 为 `/cet4-study-planner/`；改名时同步调整 `VITE_BASE`。使用 hash 导航，页面刷新不依赖服务器回退规则。

## 隐私与源码

不要提交个人姓名、学号、课表、学习记录或备份。`.gitignore` 排除 `private/`、原网页、备份、截图与本地测试报告。隐私扫描检查可提交文件和构建目录；如设置本地环境变量 `STUDYFLOW_COURSE_FILE`，还会检查私有课表的独特文本签名，扫描不会输出私有内容。

- `src/domain.ts`：日期、教学周次、英语套餐、重复任务、历史快照与统计。
- `src/storage.ts`：版本化 IndexedDB 持久化。
- `src/transfer.ts`：结构校验、版本迁移、合并恢复和旧版数据适配。
- `src/App.tsx`、`forms.tsx`、`ui.tsx`、`style.css`：页面、表单、交互和视觉系统。
- `tests/`：业务单元测试与移动浏览器测试。
- `scripts/`：原创图标生成、依赖许可证和隐私扫描。

视觉参考仅用于理解习惯打卡与轻量卡片交互；未复制参考产品截图、插画或大型开源项目代码。实际使用的第三方依赖许可证见 `public/THIRD_PARTY_NOTICES.txt`，随应用一起提供。

后续可增加专注计时器、可选提醒、课程冲突可视化和跨设备的用户自管加密同步。当前版本不含后台通知、账号或云同步。
