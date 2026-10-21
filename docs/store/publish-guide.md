# 上架流程：Chrome Web Store + Microsoft Edge 加载项

> 结论先说：**两个商店都不需要审核前付费**（Chrome 一次性 $5，Edge 免费），但**都需要你本人的账号做实名/邮箱验证**，这一步没法替你点。其余材料已经全部备好。
>
> 👉 要照着一步步点的话，看 **[register-steps.md](register-steps.md)**（逐屏操作 + 卡点速查表 + 自动/手动标注）；本文是简版概览。

## 0. 已经准备好的东西

| 项目 | 位置 | 状态 |
|---|---|---|
| 扩展包（MV3） | `dist/Wordblend-v2.2.0.zip` | ✅ 可直接上传 |
| 图标 16/32/48/128 | `dist/ext/icon*.png` | ✅ |
| 商店图标 128（96 图形 + 16 边距） | `docs/store/screenshots/store-icon-128.png` | ✅ |
| 商店图标 300×300（Edge） | `docs/store/screenshots/store-icon-300.png` | ✅ |
| 截图 1280×800 ×3 | `docs/store/screenshots/` | ✅ |
| 宣传图 440×280 / 1400×560 | `docs/store/screenshots/` | ✅ |
| 商店文案（中/英） | `docs/store/listing.md` | ✅ |
| 隐私政策 | `docs/store/privacy.md` | ✅（需要一个公开 URL） |
| 权限理由 | `docs/store/listing.md` 末节 | ✅ |

上架前要做的：把隐私政策 URL 指向 https://github.com/sxh705/wordblend/blob/master/docs/store/privacy.md（已完成）。

---

## 1. Chrome Web Store

**耗时**：注册 10 分钟 + 填表 20 分钟 + 审核 1~3 个工作日（首次）。

1. **注册开发者**
   - 打开 <https://chrome.google.com/webstore/devconsole>
   - 用 Google 账号登录，支付**一次性 $5**（Visa/Mastercard 都可以，国内双币卡通常能过）
   - ⚠️ 该 Google 账号必须**已开启两步验证**，否则不能提交
2. **补全「账号」页**（最容易卡住的一步）
   - 左侧菜单 **账号（Account）** → 填联系邮箱 → 点验证邮件里的链接
   - 同一个页面还要选「交易者 / 非交易者」。个人免费扩展选**非交易者**（不需要公示地址）
   - 不填这两项，提交时只会报「必须提供联系电子邮箱地址」，且不会告诉你在哪填
3. **新建条目**
   - 「内容」→「上传新内容」→ 选 `dist/Wordblend-v2.2.0.zip`
4. **填写商品详情**（照 `docs/store/listing.md` 复制）
   - 名称、简短说明、详细说明、分类=教育
   - 截图 3 张、小宣传图 440×280
   - 语言：中文（简体）+ English
5. **隐私权实务**（决定审核快慢的关键）
   - 单一用途：`把网页中的一部分词替换成另一种语言（中↔英），帮助用户在阅读中积累词汇。`
   - 权限理由：见 `listing.md` 表格，两条都填
   - 数据使用：**不收集用户数据**，三个勾选项全选「不」
   - 隐私政策 URL：填隐私政策的公开地址（GitHub 仓库里 `docs/store/privacy.md` 的网页地址即可，例如
     `https://github.com/sxh705/wordblend/blob/master/docs/store/privacy.md`）
   - 远程代码：选「否，我未使用远程代码」
6. **提交审核**
   - 「测试说明」里写一句：`安装后打开任意中文或英文网页即可看到替换效果；点击被替换的词弹出释义卡片。无需登录。`
   - 提交后 1~3 个工作日；被拒通常是「权限说明不清楚」或「描述与实际功能不符」，按提示改完再提交即可

**常见被拒原因（都已规避）**

- ❌ 功能太单薄 → 我们有 18 词库、双向、站点规则、释义卡片
- ❌ 权限过大 → 全站访问是功能必需，理由已写明「只处理文本节点」
- ❌ 远程代码 → 全部内联打包，无 eval
- ❌ 描述夸大 → 文案里明确写了「已知限制」

---

## 2. Microsoft Edge 加载项

**耗时**：注册 10 分钟 + 填表 15 分钟 + 审核 1~7 个工作日。**完全免费**，扩展包直接复用同一个 zip。

1. 打开 <https://partner.microsoft.com/dashboard/microsoftedge>
2. 用**微软账号**注册 Edge 开发者（个人即可，免费，需填真实姓名/地址，要过身份验证）
3. 「新建扩展」→ 上传 `dist/Wordblend-v2.2.0.zip`
4. 填写商店信息：名称、简短说明、详细说明、分类、语言 —— 与 Chrome 用同一份文案
5. 上传截图（1280×800）与商店图标 300×300（可用 128 图标放大，或让我再生成一张）
6. 隐私政策 URL 同上
7. 提交，等审核。Edge 审核独立于 Chrome，不要假设同时通过

> Edge 的流量不大但很实在：Windows 默认浏览器的用户很少会去 Chrome 商店找扩展。同一份包，多一个渠道。

---

## 3. 审核通过之后

- 把两个商店链接补进 `README.md` 顶部和 `docs/store/listing.md`
- GitHub Release 里挂 `dist/Wordblend-v2.2.0.zip`，方便不想走商店的人
- V2EX 帖子里同时放商店链接和 GitHub 链接（帖子里只放 GitHub 会显得像半成品）

## 4. 版本更新流程

1. 改 `build.py` 里的 `VERSION`
2. `cd popup && pnpm build` → `python build.py`
3. 两个商店后台「上传新包」→ 提交（更新审核通常 1~2 天）
4. `chrome.storage.sync` 里的旧设置会自动迁移，不需要用户重配

---

## 附：商店审核员的检查路径（提交前自查）

- [ ] 装上后打开一个中文网页，能看到英文词混排（默认档位 3，中文页）
- [ ] 打开一个英文网页，能看到中文词混排
- [ ] 点被替换的词，卡片能弹出、能关闭
- [ ] 关掉总开关，页面恢复原文
- [ ] 切到「站点」→ 黑名单 → 加当前站，页面恢复原文
- [ ] 断网后功能正常（证明零联网）
- [ ] 无 console 报错
