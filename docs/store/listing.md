# 商店上架文案（Chrome Web Store / Microsoft Edge 加载项）

> 直接复制粘贴即可。中英文各一份，两个商店共用。

---

## 名称（Name，≤45 字符）

```
Wordblend — 中英混排阅读
```

英文备用：

```
Wordblend — Bilingual Reading
```

## 简短说明（Short description，≤132 字符）

```
中文网页夹英文词、英文网页夹中文词，点词看释义。18 个离线词库、1~10 档强度、站点黑白名单，全程不联网。
```

（共 55 字，远低于上限）

**英文：**

```
Replace some words on a page with the other language — Chinese on English sites, English on Chinese sites. Offline.
```

## 详细说明（Detailed description）

```
读英文资料最费劲的地方，不是整段看不懂，而是每隔两句卡一个词。切出去查、再切回来，节奏断了，读三行就放弃。

Wordblend 不翻译整页，它只替换一部分词。

· 中文网页 → 夹英文词
  熟悉的语境托着你，生词自然嵌在句子里。同一个词在不同句子里反复出现，比背单词表记得牢。

· 英文网页 → 夹中文词
  卡住的地方直接变成中文，阅读不再中断，同时保留完整的英文原句和语法结构。

· 点一下就能往回查
  点被替换的词，弹出音标、中文释义、同根词、近义词、反义词。看完点空白处关闭，不打断阅读。

■ 主要功能

· 双向替换：中文页夹英文、英文页夹中文，两侧各有独立的强度和词库
· 强度 1~10：1 最密（几乎每句都有），10 最淡（只偶尔标注一个）；英→中方向按段落分配，长文从头到尾密度一致
· 难度分层：英→中优先换生僻词，最常用的那批词按档位逐步退出，不会出现 "base → 卑鄙的" 这种把句子搞得更难的替换
· 18 个词库：基础（四级/六级）、进阶（考研/雅思/托福/GRE）、专业（计算机/医学/法律/经济）、垂直（新闻/科技/商务/学术）
· 站点黑白名单：默认仅在 V2EX / 知乎 / 贴吧生效，装完不打扰别的站；随时可切成全部网站 / 黑名单，支持 *.example.com 通配，任何站可一键加入或移出
· 按站锁语言：自动判定不准时，把某个站固定成中文页或英文页
· 不打断页面：只改文字，不动结构、样式和链接；按钮照常点、链接照常跳
· 跨标签页同步：在一个标签页调好，其他标签页立即生效

■ 隐私

· 不联网：词典全部打包在扩展里，运行时不发出任何请求
· 不采集：没有统计、没有埋点、没有账号
· 不上传：页面文字只在你的浏览器内存里处理，不保存、不发送
· 断网也能用：功能完全不受影响

■ 适合谁

· 想过六级/考研/雅思托福，但读原版文章总是读不下去的人
· 每天要读英文技术文档、论文、Release Notes 的开发者
· 想在一中文环境里保持英文语感的人
· 已经认识基础词，想在被动词汇里"泡"出语感的人（词库可只留进阶和专业）

■ 已知限制

· 中文一词多义时可能选错义项（例如 match 有时会给出"火柴"），点开卡片能看到替换前的中文，判断得出来
· 词典是离线的，覆盖面不及在线翻译；生僻专有名词不会被替换
· 只处理普通文本节点，图片里的文字、Canvas、部分富文本编辑器不处理

开源项目，欢迎提 issue：https://github.com/sxh705/wordblend
```

**英文版（可选，用于国际区）**

```
Most people reading English don't fail because the whole page is unreadable. They stall on one word every other sentence, switch tabs to look it up, lose the thread, and quit.

Wordblend doesn't translate the page. It replaces a fraction of the words.

· Chinese pages, English words mixed in
  The familiar context carries you; new words appear inside real sentences, and the same word keeps coming back — which is how vocabulary actually sticks.

· English pages, Chinese words mixed in
  The words you'd stumble on turn into Chinese. The original English sentence, word order and grammar stay intact, so you keep reading instead of translating.

· Click any replaced word
  IPA, Chinese gloss, word family, synonyms, antonyms. Click elsewhere to close.

FEATURES
· Two directions, each with its own intensity and word banks
· 10 intensity levels — level 1 densest, level 10 a rare annotation; English→Chinese density is allocated per paragraph, so long articles stay even
· Rarity-first selection: uncommon words go first, the most common ones drop out as you lower the intensity
· 18 offline word banks (CET-4/6, postgraduate, IELTS, TOEFL, GRE, CS, medical, legal, business, news, academic)
· Site rules: conservative by default — only V2EX / Zhihu / Baidu Tieba are touched out of the box; switch to all sites or a block-list anytime, wildcards supported, one click to add or remove any site
· Per-site language lock for pages where detection gets it wrong
· Only text is touched — layout, styles and links are untouched
· Settings sync across tabs

PRIVACY
· Fully offline: the dictionary ships inside the package, zero network requests
· No analytics, no telemetry, no account
· Page text is processed in memory only
· Works with the network disconnected

LIMITATIONS
· Occasionally picks the wrong sense of a polysemous word (the card shows the original word so you can tell)
· Smaller coverage than an online translator; rare proper nouns are left alone
· Text inside images, canvas, and some rich-text editors is not processed

Open source: https://github.com/sxh705/wordblend
```

---

## 分类 / 语言

- 分类：**教育**（Chrome）/ **Education**（Edge）；备选：工具
- 语言：中文（简体）、English
- 地区：全部

## 权限说明（Privacy practices → 权限理由）

| 权限 | 用途 |
|---|---|
| `storage` | 保存强度、词库选择、站点黑白名单，并在标签页之间同步设置。只存这些配置，不存浏览内容。 |
| `host_permissions: http://*/*, https://*/*` | 内容脚本需要在页面上读取并替换文字。扩展的功能就是在任意网页上把部分词换成另一种语言，无法预知用户会读哪些站，因此需要全站访问。只处理文本节点，不读取表单、密码或 cookie。 |

- **远程代码**：不使用。所有脚本和词典都在安装包里，没有 eval / new Function / 远程加载。
- **数据用途**：不收集任何用户数据（Does not collect user data）。三个勾选项全部选「不」。
- **单一用途说明**：把网页中的一部分词替换成另一种语言（中 ↔ 英），帮助用户在阅读中自然积累词汇；附带点词查释义。

## 素材清单

| 素材 | 规格 | 文件 |
|---|---|---|
| 图标 | 128×128 PNG | `dist/ext/icon128.png` |
| 截图 1 | 1280×800 PNG | `docs/store/screenshots/01-zh.png` |
| 截图 2 | 1280×800 PNG | `docs/store/screenshots/02-en.png` |
| 截图 3 | 1280×800 PNG | `docs/store/screenshots/03-popup.png` |
| 小宣传图 | 440×280 PNG | `docs/store/screenshots/promo-440x280.png` |
| 大宣传图（可选） | 1400×560 PNG | `docs/store/screenshots/promo-1400x560.png` |

截图要求：至少 1 张，最多 5 张；1280×800 或 640×400；PNG/JPEG。
