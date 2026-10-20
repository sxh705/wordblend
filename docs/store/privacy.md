# Wordblend 隐私政策 / Privacy Policy

最后更新：2026-10-20

## 中文

**一句话：Wordblend 不收集、不上传、不分享任何数据。**

1. **不联网。** 扩展的代码和词典全部打包在安装包里，运行时不向任何服务器发送请求，也没有统计、埋点或崩溃上报。
2. **不读取账号信息。** 不需要注册、不需要登录，不申请 `identity`、`cookies`、`history`、`tabs` 等任何与身份或浏览记录相关的权限。
3. **页面文本只在本地处理。** 为了把词替换掉，扩展必须读取并修改你正在浏览的页面文字；这些文字只在你的浏览器内存里处理，处理完即丢弃，不会被保存或发送。
4. **设置只存在浏览器里。** 强度、词库、站点黑白名单保存在 `chrome.storage.sync`（由浏览器负责在你登录的 Chrome/Edge 账号间同步）。卸载扩展后这些数据随之删除。
5. **没有第三方。** 不接入任何第三方 SDK、广告、分析或 AI 服务。

如果你不放心，可以断网使用：功能完全不受影响。

## English

**Short version: Wordblend collects nothing, uploads nothing, shares nothing.**

1. **No network access at runtime.** The dictionary and all code ship inside the package. The extension makes no HTTP requests, and contains no analytics, telemetry, or crash reporting.
2. **No account data.** No sign-up, no login. We do not request `identity`, `cookies`, `history`, or `tabs` permissions.
3. **Page text is processed locally.** To highlight and replace words, the extension must read and modify the text of pages you visit. That text is handled in memory inside your browser, never stored, never transmitted.
4. **Settings stay in your browser.** Level, word banks, and site rules live in `chrome.storage.sync`, synced by the browser across your own devices. Uninstalling the extension removes them.
5. **No third parties.** No SDKs, ads, analytics, or AI services are involved.

The extension works fully offline — you can verify this by disconnecting your network.

## 联系 / Contact

有问题请开 issue：<https://github.com/sxh705/wordblend/issues>
