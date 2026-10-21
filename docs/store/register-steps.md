# 注册与提交：逐屏操作手册

> 目标：把 Wordblend 上架到 **Chrome Web Store** 和 **Microsoft Edge 加载项**。
> 每个步骤都标了归属：
> **🟢 已完成**（我做好了，你不用管） · **🟡 你点几下**（照着填 / 照着选） · **🔴 只能你本人**（账号、支付、身份验证、最终提交）

---

## 0. 全局概览

| 阶段 | Chrome | Edge | 耗时 | 谁做 |
|---|---|---|---|---|
| 注册开发者账号 | 一次性 **$5** | **免费** | 10 分钟 | 🔴 登录 + 付费 |
| 补全账号资料 | 邮箱验证 + 两步验证 + 交易者声明 | 姓名/地址/身份验证 | 10 分钟 | 🔴 本人信息 |
| 上传扩展包 | `dist/Wordblend-v2.2.0.zip` | 同一个 zip | 2 分钟 | 🟡 选文件 |
| 填写上架资料 | 文案已备好 | 文案已备好 | 20 分钟 | 🟡 复制粘贴 |
| 提交审核 | — | — | 1 分钟 | 🔴 建议本人点 |
| 审核 | 1~3 天（新账号 + 全站权限可能数周） | 1~7 天 | — | 等 |
| 上线 | 可设延迟发布 | 通过即上线 | — | — |

**两个商店互相独立**，Edge 不会因为 Chrome 过审就过快。建议 Chrome 先提交，再弄 Edge，不要并行纠结。

---

## 1. 前置检查（🟢 已全部完成）

| 项目 | 结果 | 位置 |
|---|---|---|
| 扩展包（MV3，manifest 在根目录） | ✅ | `dist/submit-pack/Wordblend-v2.2.0.zip` |
| manifest 无远程代码、无 eval、权限只有 `storage` + 全站 host | ✅ | `dist/ext/manifest.json` |
| 截图 3 张 1280×800、**24-bit RGB 无 alpha**（带 alpha 会被表单拒） | ✅ 已核对 | `dist/submit-pack/01~03-*.png` |
| 商店图标 128×128（96 图形 + 16px 透明边距，Google 规范） | ✅ 新生成 | `dist/submit-pack/store-icon-128.png` |
| 商店图标 300×300（Edge 要求） | ✅ 新生成 | `dist/submit-pack/store-icon-300.png` |
| 宣传图 440×280 / 1400×560 | ✅ | `dist/submit-pack/promo-*.png` |
| 隐私政策**公开可访问**（已实测 HTTP 200） | ✅ | `https://github.com/sxh705/wordblend/blob/master/docs/store/privacy.md` |
| 全部上架文案（中英） | ✅ | `docs/store/listing.md` |

> **上传时只打开一个目录就够了**：`dist/submit-pack/` —— zip、截图、图标、宣传图全在里面。
> 另有一个离线提交助手网页，字段可一键复制、进度自动保存：`docs/store/submit-helper.html`。

---

## 2. Chrome Web Store

### 2.1 🔴 登录并支付 $5

1. 打开 <https://chrome.google.com/webstore/devconsole>
2. 用你的 Google 账号登录（建议用专用账号，**账号邮箱注册后不可更改**）
3. 首次进入会弹开发者协议 → 勾选同意
4. 支付一次性 **$5**（不是年费，一个账号管所有扩展）
   - 需要 **Visa / MasterCard 双币卡**
   - **最常见的卡点**：国内卡被 Google Payments 风控拒付，报 `OR-CCSEH-05` 或直接「无法完成交易」
   - 对策顺序：① 换一张卡（不同发卡行，招商/中行双币卡成功率较高）② 换网络（关掉代理直连，或反过来挂美区节点）③ 等 24 小时再试 ④ 仍不行去 <https://support.google.com/payments> 提交工单

### 2.2 🔴 开启两步验证（不开就不能发布）

- 打开 <https://myaccount.google.com/security> → 「两步验证」→ 用手机 Authenticator 或短信开启
- 支付完成后 Dev Console 顶部若出现黄色提示条「需要开启两步验证」，点进去就是这一页

### 2.3 🔴 补全「账号」页（第二常见的卡点）

左侧菜单 **Account / 账号**，三件事：

| 字段 | 填什么 | 说明 |
|---|---|---|
| 联系邮箱 | 你的常用邮箱 → 收验证邮件 → 点链接 | 不做这步，提交时只报「必须提供联系电子邮箱地址」，**不告诉你哪里填** |
| 发布者名称 | `Wordblend` 或 `sxh705` | 用户在你扩展名下方看到的名字 |
| 交易者身份 | 选 **非交易者（Non-trader）** | 免费开源扩展就是非交易者。选「交易者」会**公开你的地址和电话**给欧盟用户 |

> 注意：新账号会有「已发布 0 个扩展程序（限额为 2 个）」的限制，正常过审后会自动扩容，不用管。

### 2.4 🟡 上传扩展包

1. 点右上角 **「新增项目 / Add new item」**
2. 拖入 `dist\Wordblend-v2.2.0.zip`
3. 出现橙色警告「因为使用了广泛的主机权限，将进行深度审核」→ **这是正常的**，不要为了消除警告去削减权限，削减了功能就废了

### 2.5 🟡 填写「商店发布信息」

字段内容直接复制 `docs/store/listing.md`：

| 页面字段 | 用什么 |
|---|---|
| 名称 | `Wordblend — 中英混排阅读` |
| 简短说明（≤132 字符） | listing.md 第 19 行那段 |
| 详细说明 | listing.md 第 35~81 行整段 |
| 类别 | **教育**（Education） |
| 语言 | 中文（简体）；再加 English |
| 商店图标 | `store-icon-128.png` |
| 屏幕截图 | `01-zh.png`、`02-en.png`、`03-popup.png`（顺序别错，第一张是封面） |
| 小型宣传图 | `promo-440x280.png` |

### 2.6 🟡 填写「隐私权实务」（决定审核快慢，最重要）

| 字段 | 内容 |
|---|---|
| 单一用途说明 | `把网页中的一部分词替换成另一种语言（中 ↔ 英），帮助用户在阅读中自然积累词汇；附带点词查释义。` |
| `storage` 权限理由 | `保存强度、词库选择、站点黑白名单，并在标签页之间同步设置。只存这些配置，不存浏览内容。` |
| `host_permissions` 理由 | `内容脚本需要在页面上读取并替换文字。扩展的功能就是在任意网页上把部分词换成另一种语言，无法预知用户会读哪些站，因此需要全站访问。只处理文本节点，不读取表单、密码或 cookie。` |
| 远程代码 | **否，我未使用远程代码** |
| 数据使用 | **不收集用户数据**；三个勾选项全部选「不」 |
| 隐私政策网址 | `https://github.com/sxh705/wordblend/blob/master/docs/store/privacy.md` |

### 2.7 🟡 「分发」页

- 可见性：**公开**
- 定价：**免费**
- 地区：**所有地区**
- **延迟发布（Deferred publishing）建议勾上**：过审后不会自动上线，你有 30 天自己点发布 —— 方便你先去 V2EX 发帖、再掐点上线

### 2.8 🔴 提交审核

在「测试说明」里写：

```
默认为保守模式：仅在 v2ex.com、zhihu.com、tieba.baidu.com 三个站生效。
请打开 https://v2ex.com 或 https://www.zhihu.com 的任意帖子页，即可看到部分词被替换成英文；
点击被替换的词弹出释义卡片，点空白处关闭。
弹窗「站点」页可切换为所有网站 / 黑名单，任何站可一键加入或移出白名单。
关闭右上角总开关即恢复原文。无需登录、无需配置。
仓库：https://github.com/sxh705/wordblend
```

然后点 **Submit for review**。

> 提交按钮点不动时，点页面顶部/底部的 **「我为什么不能提交？」**，它会列出所有未完成项 —— 这比逐页翻快得多。

---

## 3. Microsoft Edge 加载项

### 3.1 🔴 决定用哪个账号

两个选择：

- **Microsoft 账号**（outlook/hotmail/live）—— 推荐，注册最顺
- **GitHub 账号**（你的 `sxh705`）—— 也行，授权登录后仍需绑定一个微软账号

### 3.2 🔴 加入 Edge 计划

1. 打开 <https://partner.microsoft.com/dashboard/microsoftedge>
2. 登录 → 首次会让你选「个人 / 公司」，免费扩展选 **个人（Individual）**
3. 同意 Edge 开发者协议 → 进入仪表盘

### 3.3 🔴 填个人资料（有一个必踩的坑）

| 字段 | 注意 |
|---|---|
| 姓名 | 真实姓名（与证件一致） |
| 地址 | 真实地址，用于身份验证 |
| **省 / 州** | ⚠️ **必须填英文缩写，不能写中文** —— 北京填 `Beijing` 或 `BJ`，上海填 `Shanghai` / `SH`。写「北京市」会一直报错且不告诉原因 |
| **城市** | 同上，拼音：`Beijing` |
| 邮编 | 6 位数字 |
| 电话 | `+86` 开头 |

提交后可能要等邮箱验证（有时 10 分钟才到，检查垃圾邮件）。

### 3.4 🟡 创建扩展

1. 仪表盘 → **Workspaces → Edge** → **Create new extension**
2. 拖入 `dist\Wordblend-v2.2.0.zip`（和 Chrome 用同一个包，不用改）
3. 上传后进入 **Extension overview**，按左侧菜单顺序走完 4 页

### 3.5 🟡 四页内容

| 页面 | 填什么 |
|---|---|
| **Availability** | 可见性 `Public`；市场全选（至少美国 + 中国） |
| **Properties** | 类别 `Education`；Privacy policy URL 同上；是否含应用内购买 = No |
| **Privacy** | 用途说明、`storage` 与 host 权限理由、远程代码 = No、数据使用 = 不收集（内容同 Chrome） |
| **Store listing** | 每种语言一份：名称、简短说明、详细说明、截图 3 张、logo `store-icon-300.png`、搜索词 |

> Edge 的**名称和描述在 manifest 里，页面上是只读的** —— 我们 manifest 写的是 `Wordblend — 中英混排阅读`，符合要求，不用改。

搜索词（Edge 独有，最多 7 个）建议：

```
中英混排, 背单词, 英语阅读, 词汇, 沉浸式翻译, 英文阅读辅助, vocabulary
```

### 3.6 🔴 提交

**Certification notes** 写一段给审核员的话：

```
Conservative by default: only v2ex.com, zhihu.com and tieba.baidu.com are affected.
Open any post on https://v2ex.com or https://www.zhihu.com to see some words replaced with English.
Click a replaced word to see the dictionary card; click elsewhere to close it.
The popup's "Sites" tab switches to all-sites or block-list mode; any site can be added or removed in one click.
Turn off the toggle at the top right of the popup to restore the original page.
Fully offline — no network requests, no data collection.
Repo: https://github.com/sxh705/wordblend
```

点 **Publish**，等 1~7 个工作日。

---

## 4. 卡住时按这张表查

| 症状 | 原因 | 处理 |
|---|---|---|
| Chrome 提交报「必须提供联系电子邮箱地址」 | 没在 Account 页验证邮箱 | 回 2.3 |
| 提交按钮灰着 | 有页面没填完 | 点「我为什么不能提交？」 |
| `OR-CCSEH-05` / 支付失败 | Google Payments 风控 | 见 2.1 对策 |
| 上传 zip 报「清单文件缺失」 | zip 里套了一层文件夹 | 我们的包已核对，manifest 在根目录，不会出现 |
| 上传截图报格式错误 | PNG 带 alpha | 我们的截图已核对为 24-bit RGB |
| Partner Center 省份一直报错 | 填了中文 | 改英文/拼音，见 3.3 |
| Edge 名称栏是灰的改不了 | manifest 字段只读 | 正常，manifest 里已写对 |
| 审核被拒「权限说明不清楚」 | host 权限理由太笼统 | 复制 2.6 表格里那段完整理由，别缩写 |
| 审核被拒「功能与描述不符」 | 描述里有没实现的功能 | 我们文案只写了已实现的能力，照抄即可 |
| 审核超过 2 周 | 新账号 + 全站权限进深度审核队列 | 正常，别重复提交（重复提交反而更慢） |

---

## 5. 过审之后（🟡 我来做，你告诉我链接就行）

1. 把两个商店链接补进 `README.md` 顶部、`docs/store/listing.md`
2. GitHub Release 里挂 zip（已经有 v2.2.0，补个说明即可）
3. V2EX 发帖（草稿在 `docs/v2ex-post.md`，链接位留空，回填后发）
4. 版本更新：改 `build.py` 的 `VERSION` → `cd popup && pnpm build` → `python build.py` → 两个后台各点「上传新包」
