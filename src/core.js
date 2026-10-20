/*!
 * Flipword Lite v1.5.0 — 极简双向网页替换（中文页换英文词 / 英文页换中文词）
 * 设计原则：单文件、无网络、无后台、无第三方库；出错不连环崩；日志全量可查。
 * 参考 Flipword v1.4.14 的核心思路（本地词库 + 分词匹配 + 交互区豁免）。
 *
 * v1.4 改动：
 *   1) 设置（强度 / 词库 / 角标）改存 chrome.storage.sync —— 一个标签页里改，
 *      其他已打开的标签页立刻跟着变，跨设备也同步；不再按站点分别存。
 *   2) 页面内不再有右下角悬浮按钮 / 面板，入口统一收进插件图标的弹窗（popup.html）。
 *   3) 放宽豁免：标题、按钮、链接文字都参与替换（V2EX 那种标题链接也能换）。
 * v1.5 改动：
 *   4) 双向：页面是英文时，把词库里的**生僻词**换成中文（词形变化会还原原形）。
 *      同一套 0~10 档位，但含义相反 —— 档位越高，换掉的中文越少，英文原文留得越多。
 */
(function () {
  'use strict';

  var VERSION = '1.5.0';
  var TAG = '[FW]';
  var FS = String.fromCharCode(1);   // 详解字段分隔
  var SS = String.fromCharCode(2);   // 释义分条分隔

  /* ============================ 0. 内嵌数据 ============================
   * 构建时内嵌，全部为纯文本，避免 fetch / 后台 / 权限 / CSP 问题：
   *   BANKS_META  词库元信息
   *   DICT_RAW    zh|en|mask36      中文 -> 英文 + 词库位掩码
   *   DETAIL_RAW  en\x01音标\x01释义\x01拆解\x01记忆\x01同根\x01近义\x01反义
   */
  var BANKS_META = __FW_BANKS__;
  var DICT_RAW = __FW_DICT__;
  var DETAIL_RAW = __FW_DETAIL__;
  var EN2ZH_RAW = __FW_EN2ZH__;    // 英文 -> 中文（反向词典）
  var MORPH_RAW = __FW_MORPH__;    // 词形变化：runs>run / studied>study

  /* ============================ 1. 配置 ============================
   * 两个方向共用一套 0~10 档位，但含义相反：
   *   中 -> 英（rate/node）：档位越高，换掉的词越多
   *   英 -> 中（rateEn/nodeEn）：档位越高，换成中文的词越少（英文原文保留得越多）
   *   once  同一个词全页是否只出现一次（10 档附近关闭，追求"尽可能替换"）
   */
  /* onceEn：英->中时，同一个词是否全页只换一次。
   * 低档（1~5 = 最密）允许重复出现，密度才拉得开；高档本来就稀疏，只留一次更像"随手标注"。
   * rateEn  单位是「每千词换成多少个中文」。
   * maxRank 只换到哪一档难度为止（rank 越大越常见）：低档宽容、高档只留最难的，
   *         这样「base → 卑鄙的」那类高频多义词不会被碰到，额度全花在真看不懂的词上。 */
  var LEVELS = [
    { rate: 0, node: 0, once: true, name: '关闭', rateEn: 0, nodeEn: 0, onceEn: false, maxRank: 0 },
    { rate: 5, node: 1, once: true, name: '很淡', rateEn: 145, nodeEn: 14, onceEn: false, maxRank: 8 },
    { rate: 8, node: 1, once: true, name: '很淡', rateEn: 118, nodeEn: 12, onceEn: false, maxRank: 8 },
    { rate: 18, node: 1, once: true, name: '轻', rateEn: 88, nodeEn: 9, onceEn: false, maxRank: 7 },
    { rate: 28, node: 2, once: true, name: '轻', rateEn: 66, nodeEn: 8, onceEn: false, maxRank: 7 },
    { rate: 35, node: 2, once: true, name: '中', rateEn: 49, nodeEn: 6, onceEn: false, maxRank: 6 },
    { rate: 45, node: 2, once: true, name: '中', rateEn: 40, nodeEn: 5, onceEn: true, maxRank: 6 },
    { rate: 60, node: 3, once: true, name: '强', rateEn: 32, nodeEn: 5, onceEn: true, maxRank: 5 },
    { rate: 80, node: 3, once: false, name: '强', rateEn: 26, nodeEn: 4, onceEn: true, maxRank: 4 },
    { rate: 110, node: 4, once: false, name: '很密', rateEn: 22, nodeEn: 4, onceEn: true, maxRank: 3 },
    { rate: Infinity, node: 999, once: false, name: '全量', rateEn: 16, nodeEn: 4, onceEn: true, maxRank: 3 }
  ];

  /* on 是总开关：关掉就整页还原、不再扫描。
     两个方向各有自己的档位和词库，互不影响（zh = 中→英，en = 英→中）。 */
  var CFG = {
    on: true,              // 总开关
    dir: 'auto',           // auto / zh2en / en2zh
    zh: { level: 3, banks: [] },
    en: { level: 3, banks: [] },
    /* 站点规则：all = 所有网站；allow = 仅名单内（白名单）；block = 名单外（黑名单）
       每条规则 { host, lang: 'auto'|'zh2en'|'en2zh', on } */
    sites: { mode: 'all', rules: [] },
    baseBudget: 3,
    baseBudgetEn: 8,       // 英->中：短页面也要能换出几个词
    badge: false,          // 页面内不再有悬浮按钮；这里只是可选的纯计数角标（不可点、不挡操作）
    maxTextNodeLen: 3000,
    scanDelays: [800, 2500, 6000],
    verbose: true
  };

  /* 当前方向对应的那半边设置 */
  function side() { return dirNow() === 'en2zh' ? CFG.en : CFG.zh; }
  function lvNow() {
    var lv = side().level | 0;
    if (lv < 1) lv = 1;
    if (lv > 10) lv = 10;
    return lv;
  }
  function banksNow() { return side().banks; }
  function lvCfg() { return LEVELS[lvNow()] || LEVELS[3]; }

  /* ============================ 2. 日志 ============================ */
  var LOGS = [];
  function pushLog(args) {
    try {
      LOGS.push(args.map(String).join(' '));
      if (LOGS.length > 400) LOGS.shift();
    } catch (e) {}
  }
  function log() {
    var args = Array.prototype.slice.call(arguments);
    pushLog([TAG].concat(args));
    if (!CFG.verbose) return;
    try { console.log.apply(console, [TAG].concat(args)); } catch (e) {}
  }
  function warn() {
    var args = Array.prototype.slice.call(arguments);
    pushLog([TAG + '(warn)'].concat(args));
    try { console.warn.apply(console, [TAG].concat(args)); } catch (e) {}
  }

  /* ============================ 3. 统计 ============================ */
  var stats = {
    version: VERSION,
    startAt: Date.now(),
    dictSize: 0,
    dictTotal: 0,
    enDictSize: 0,
    parseMs: 0,
    detailSize: 0,
    detailMs: 0,
    detailLoaded: false,
    scans: 0,
    elementsSeen: 0,
    textNodes: 0,
    hanSeen: 0,
    wordsSeen: 0,
    replaced: 0,
    nodesChanged: 0,
    cardsShown: 0,
    bankSwitches: 0,
    budget: 0,
    errors: 0,
    skip: {},
    lastScanMs: 0,
    lastScanAt: 0
  };

  function bump(key) { stats.skip[key] = (stats.skip[key] || 0) + 1; }

  /* ============================ 4. 词库解析 ============================ */
  var ALL_ENTRIES = [];        // {zh, en, mask}
  var EN_MASK = new Map();     // en -> 掩码（用于卡片上显示属于哪些词库）
  var DICT = new Map();        // zh -> en（按选中词库过滤后）
  var EN_ENTRIES = [];         // {en, zh, mask, rank}  英->中
  var EN2ZH = null;            // Map en -> zh（英->中模式才解析，省内存）
  var EN_RANK = null;          // Map en -> 0~9 难度档（0 最生僻，9 最常见）
  var MORPH = null;            // Map 变形 -> 原形
  var DIR = 'zh2en';           // 本页实际方向
  var MAXLEN = 2;
  var bankIds = [];
  var maskZh = 0;              // 中->英 选中的词库
  var maskEn = 0;              // 英->中 选中的词库

  function maskOf(ids) {
    var m = 0;
    for (var i = 0; i < ids.length; i++) {
      var k = bankIds.indexOf(ids[i]);
      if (k >= 0) m |= (1 << k);
    }
    return m;
  }

  function maskToNames(mask) {
    var out = [];
    var meta = (BANKS_META && BANKS_META.banks) || [];
    for (var i = 0; i < meta.length; i++) {
      if (mask & (1 << i)) out.push(meta[i].name || meta[i].label || meta[i].id);
    }
    return out;
  }

  function initBankIds() {
    var meta = (BANKS_META && BANKS_META.banks) || [];
    bankIds = meta.map(function (b) { return b.id; });
    log('banks available:', bankIds.length, '|', bankIds.join(','));
  }

  /* ============================ 4.1 方向判定 ============================
   * auto：按页面正文里汉字 / 拉丁字母的比例判。
   *   >= 0.30 汉字占比 -> 中文页，做「中 -> 英」
   *   否则              -> 英文页，做「英 -> 中」
   * 只看前 4000 字符，避免长页面 innerText 开销太大。
   */
  var autoDir = 'zh2en', dirDetected = false;

  /* 取页面正文样本。innerText 需要布局，后台标签页/隐藏时可能拿到空串，
     所以拿不到时退回 TreeWalker（不走布局，忽略 script/style）。 */
  function sampleText(limit) {
    var out = '', n = 0;
    try {
      var root = document.body || document.documentElement;
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = w.nextNode())) {
        var p = node.parentNode;
        if (p) {
          var tag = p.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') continue;
        }
        var s = node.data;
        if (!s) continue;
        out += s.length > limit - n ? s.slice(0, limit - n) : s;
        n = out.length;
        if (n >= limit) break;
      }
    } catch (e) {}
    return out;
  }

  function detectDir() {
    try {
      // 判过一次就固定住：替换本身会改变页面里中文/英文的比例，
      // 尤其是高清度时整页中文变英文，重算会把方向判反。
      if (dirDetected) return autoDir;
      if (!document.body) return autoDir;
      var sample = '';
      try { sample = document.body.innerText ? document.body.innerText.slice(0, 4000) : ''; } catch (e) {}
      if (sample.length < 40) sample = sampleText(4000);
      var t = (document.title || '') + ' ' + sample;
      var han = 0, lat = 0;
      for (var i = 0; i < t.length; i++) {
        var c = t.charCodeAt(i);
        if (c >= 0x4e00 && c <= 0x9fff) han++;
        else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) lat++;
      }
      if (!han && !lat) return autoDir;
      var d = (han / (han + lat)) >= 0.30 ? 'zh2en' : 'en2zh';
      log('方向判定: han=' + han + ' lat=' + lat + ' sample=' + t.length + ' -> ' + d);
      // 样本够多才认这个结论；判过一次就固定住，免得替换后的文本把方向带跑
      if (han + lat >= 60) { autoDir = d; dirDetected = true; }
      return d;
    } catch (e) {
      warn('detectDir failed:', e && e.message);
      return 'zh2en';
    }
  }

  /* ---------- 站点规则 ---------- */
  function curHost() {
    try {
      return String(location.hostname || '').toLowerCase().replace(/^www\./, '');
    } catch (e) { return ''; }
  }

  /* 三种写法：example.com（含子域名）、*.example.com（自身+子域名）、m.example.com */
  function hostMatch(pattern, host) {
    if (!pattern || !host) return false;
    var p = String(pattern).toLowerCase().trim();
    if (!p) return false;
    if (p.indexOf('*.') === 0) {
      var base = p.slice(2);
      return host === base || host.slice(-(base.length + 1)) === '.' + base;
    }
    if (p === host) return true;
    return host.slice(-(p.length + 1)) === '.' + p;   // 填 example.com 也覆盖 m.example.com
  }

  /* 命中的第一条规则（rules 顺序即优先级） */
  function siteRule() {
    var h = curHost();
    if (!h) return null;
    var rs = (CFG.sites && CFG.sites.rules) || [];
    for (var i = 0; i < rs.length; i++) {
      if (rs[i] && rs[i].on !== false && hostMatch(rs[i].host, h)) return rs[i];
    }
    return null;
  }

  /* 本站要不要替换：总开关 + 黑白名单 */
  function siteOn() {
    if (!CFG.on) return false;
    var mode = (CFG.sites && CFG.sites.mode) || 'all';
    if (mode !== 'allow' && mode !== 'block') return true;
    var listed = !!siteRule();
    return mode === 'allow' ? listed : !listed;
  }

  /* 站点级语言覆盖优先于全局「自动/中文页/英文页」——自动判定不准时靠它兜底 */
  function dirNow() {
    var r = siteRule();
    if (r && (r.lang === 'zh2en' || r.lang === 'en2zh')) return r.lang;
    return CFG.dir === 'auto' ? autoDir : CFG.dir;
  }

  function ensureDirDict() {
    if (dirNow() === 'en2zh' && !EN2ZH) parseEn2zh();
  }

  function buildIndex() {
    DICT.clear();
    MAXLEN = 2;
    for (var i = 0; i < ALL_ENTRIES.length; i++) {
      var e = ALL_ENTRIES[i];
      if (maskZh && !(e.mask & maskZh)) continue;
      DICT.set(e.zh, e.en);
      if (e.zh.length > MAXLEN) MAXLEN = e.zh.length;
    }
    stats.dictSize = DICT.size;
    stats.budget = allowance();
    if (EN2ZH) buildEnIndex();
  }

  /* 英 -> 中：按选中的词库过滤一遍（词库越多，能换的词越多） */
  function buildEnIndex() {
    EN2ZH.clear();
    for (var i = 0; i < EN_ENTRIES.length; i++) {
      var e = EN_ENTRIES[i];
      if (maskEn && !(e.mask & maskEn)) continue;
      EN2ZH.set(e.en, e.zh);
    }
    stats.enDictSize = EN2ZH.size;
    stats.budget = allowance();
  }

  function parseDict() {
    var t0 = Date.now();
    var lines = DICT_RAW.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) continue;
      var a = line.split('|');
      if (a.length < 3) continue;
      var zh = a[0], en = a[1];
      if (!zh || !en) continue;
      var mask = parseInt(a[2], 36) || 0;
      ALL_ENTRIES.push({ zh: zh, en: en, mask: mask });
      EN_MASK.set(en, (EN_MASK.get(en) || 0) | mask);
    }
    stats.dictTotal = ALL_ENTRIES.length;
    buildIndex();
    stats.parseMs = Date.now() - t0;
    log('dict ready: total=' + stats.dictTotal + ', active=' + stats.dictSize +
        ', maxKeyLen=' + MAXLEN + ', parse ' + stats.parseMs + 'ms');
  }

  /* ============================ 4.2 反向词典：英 -> 中 ============================
   * 只有当前页面判成英文时才解析（21k 行，约 25ms；中文页面完全不碰，省内存）。
   */
  function parseEn2zh() {
    if (EN2ZH) return;
    var t0 = Date.now();
    EN2ZH = new Map();
    EN_RANK = new Map();
    MORPH = new Map();
    try {
      var lines = EN2ZH_RAW.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line) continue;
        var a = line.split('|');
        if (a.length < 3) continue;
        EN_ENTRIES.push({ en: a[0], zh: a[1], mask: parseInt(a[2], 36) || 0 });
        EN_RANK.set(a[0], parseInt(a[3], 10) || 0);
      }
      var ml = MORPH_RAW.split('\n');
      for (var j = 0; j < ml.length; j++) {
        var t = ml[j];
        if (!t) continue;
        var k = t.indexOf('>');
        if (k > 0) MORPH.set(t.slice(0, k), t.slice(k + 1));
      }
    } catch (e) {
      stats.errors++;
      warn('en2zh parse failed:', e && e.message);
    }
    buildEnIndex();
    log('en2zh ready: total=' + EN_ENTRIES.length + ', active=' + EN2ZH.size +
        ', morph=' + MORPH.size + ', parse ' + (Date.now() - t0) + 'ms');
  }

  /* ============================ 4.5 设置：跨标签页共享 ============================
   * 扩展里走 chrome.storage.sync：
   *   - 一个标签页（或图标弹窗）里改了强度/词库，storage.onChanged 会在**所有**已打开
   *     的标签页触发，立即生效，不用刷新；
   *   - sync 是浏览器账号级别的，换设备也带着走（没登录就等同 local）。
   * 油猴 / 没有扩展 API 时退回 localStorage，用 storage 事件做同源跨标签页同步。
   */
  var HAS_EXT = (typeof chrome !== 'undefined' && chrome && chrome.storage &&
                 !!(chrome.storage.sync || chrome.storage.local));
  var STORE_KEY = 'fw-settings';
  var settingsSrc = 'default';
  var started = false;

  function defaultSettings() {
    var ids = ((BANKS_META && BANKS_META.default) || []).slice();
    if (!ids.length) ids = bankIds.slice(0, Math.min(4, bankIds.length));
    return {
      on: true, dir: 'auto', badge: false,
      zh: { level: 3, banks: ids.slice() },
      en: { level: 3, banks: ids.slice() },
      sites: { mode: 'all', rules: [] }
    };
  }

  function normalizeHost(v) {
    var h = String(v || '').trim().toLowerCase();
    h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^\/\//, '');
    h = h.replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
    if (!h || h.length > 120) return '';
    if (!/^[a-z0-9.*_-]+$/.test(h)) return '';
    if (h.indexOf('*') >= 0 && h.indexOf('*.') !== 0) return '';
    return h;
  }

  function cleanSites(src) {
    var out = { mode: 'all', rules: [] };
    if (!src || typeof src !== 'object') return out;
    if (src.mode === 'allow' || src.mode === 'block' || src.mode === 'all') out.mode = src.mode;
    var rs = Array.isArray(src.rules) ? src.rules : [];
    var seen = {};
    for (var i = 0; i < rs.length && out.rules.length < 400; i++) {
      var r = rs[i];
      if (!r) continue;
      var h = normalizeHost(r.host);
      if (!h || seen[h]) continue;
      seen[h] = 1;
      out.rules.push({
        host: h,
        lang: (r.lang === 'zh2en' || r.lang === 'en2zh') ? r.lang : 'auto',
        on: r.on !== false
      });
    }
    return out;
  }

  function cleanBanks(list, fallback) {
    var ids = (Array.isArray(list) ? list : []).filter(function (x) {
      return bankIds.indexOf(x) >= 0;
    });
    if (!ids.length) ids = (fallback || []).slice();
    return ids;
  }

  function cleanSide(src, fallback) {
    var lv = parseInt(src && src.level, 10);
    // 0 及以下当作没设过：旧版的 0 = 关闭，现在关闭由总开关负责
    if (!(lv >= 1 && lv <= 10)) lv = fallback.level;
    return { level: lv, banks: cleanBanks(src && src.banks, fallback.banks) };
  }

  /* 兼容 1.5 及更早的扁平格式 {level, banks}：迁移成两侧同一套；level 0 变总开关关闭 */
  function sanitize(o) {
    var d = defaultSettings();
    var out = {
      on: true, dir: 'auto', badge: false,
      zh: { level: d.zh.level, banks: d.zh.banks.slice() },
      en: { level: d.en.level, banks: d.en.banks.slice() },
      sites: { mode: 'all', rules: [] }
    };
    if (!o || typeof o !== 'object') return out;

    if (o.zh || o.en) {
      out.zh = cleanSide(o.zh, d.zh);
      out.en = cleanSide(o.en, d.en);
      out.on = o.on !== false;
    } else {
      // 旧格式
      var lv = parseInt(o.level, 10);
      var legacyOn = lv !== 0;                       // 老版的 0 档 = 关闭
      if (!(lv >= 1 && lv <= 10)) lv = d.zh.level;
      var banks = cleanBanks(o.banks, d.zh.banks);
      out.zh = { level: lv, banks: banks.slice() };
      out.en = { level: lv, banks: banks.slice() };
      out.on = legacyOn;
    }

    out.badge = !!o.badge;
    if (o.dir === 'zh2en' || o.dir === 'en2zh' || o.dir === 'auto') out.dir = o.dir;
    out.sites = cleanSites(o.sites);
    return out;
  }

  /* live=true 表示运行中收到外部变更：需要立刻重建索引并重扫本页 */
  function applySettings(o, why, live) {
    var s = sanitize(o);
    var banksChanged = s.zh.banks.join(',') !== CFG.zh.banks.join(',') ||
                       s.en.banks.join(',') !== CFG.en.banks.join(',');
    var levelChanged = s.zh.level !== CFG.zh.level || s.en.level !== CFG.en.level;
    var badgeChanged = s.badge !== CFG.badge;
    var dirChanged = s.dir !== CFG.dir;
    var onChanged = s.on !== CFG.on;
    var sitesChanged = JSON.stringify(s.sites) !== JSON.stringify(CFG.sites);
    var wasOn = siteOn();

    CFG.on = s.on;
    CFG.sites = s.sites;
    CFG.zh = s.zh;
    CFG.en = s.en;
    CFG.badge = s.badge;
    CFG.dir = s.dir;
    maskZh = maskOf(s.zh.banks);
    maskEn = maskOf(s.en.banks);
    settingsSrc = why || settingsSrc;
    autoDir = detectDir();
    ensureDirDict();
    var nowOn = siteOn();

    log('设置应用 [' + settingsSrc + ']: on=' + CFG.on +
        ', 中->英 ' + CFG.zh.level + '档/' + CFG.zh.banks.length + '库' +
        ', 英->中 ' + CFG.en.level + '档/' + CFG.en.banks.length + '库' +
        ', dir=' + CFG.dir + '（实际 ' + dirNow() + '）' +
        ', 站点=' + CFG.sites.mode + '/' + CFG.sites.rules.length + '条' +
        ', 本站生效=' + nowOn +
        (live ? '（live: 档位=' + levelChanged + ', 词库=' + banksChanged +
                ', 方向=' + dirChanged + ', 开关=' + onChanged +
                ', 站点规则=' + sitesChanged + '）' : ''));

    if ((banksChanged || dirChanged || wasOn !== nowOn) && ALL_ENTRIES.length) buildIndex();
    if (live && started &&
        (banksChanged || levelChanged || dirChanged || onChanged || sitesChanged)) {
      if (!nowOn) haltAll();
      else rescanAll();
    }
    if (badgeChanged) renderBadge();
  }

  function saveSettings(patch) {
    var next = {
      on: CFG.on, dir: CFG.dir, badge: !!CFG.badge,
      zh: { level: CFG.zh.level, banks: CFG.zh.banks.slice() },
      en: { level: CFG.en.level, banks: CFG.en.banks.slice() },
      sites: { mode: CFG.sites.mode, rules: JSON.parse(JSON.stringify(CFG.sites.rules)) }
    };
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) next[k] = patch[k];
    try {
      if (HAS_EXT) {
        var p = {};
        p[STORE_KEY] = next;
        (chrome.storage.sync || chrome.storage.local).set(p);
      } else {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      }
      log('设置已保存:', JSON.stringify(next));
    } catch (e) {
      warn('save settings failed:', e && e.message);
    }
  }

  /* 同步读取；chrome.storage 是异步的，所以用回调。1.5s 没回来就先用默认值跑，
     绝不能让设置读取把整页替换卡住（手机上尤其明显）。 */
  function loadSettings(done) {
    var finished = false;
    function fin(o, why) {
      if (finished) return;
      finished = true;
      applySettings(o, why, false);
      done();
    }

    if (!HAS_EXT) {
      var o = null, why = 'default';
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) { o = JSON.parse(raw); why = 'localStorage'; }
      } catch (e) {}
      if (!o) {
        // 从 1.3 及更早的按站点 localStorage 键迁移一次
        try {
          var lv = localStorage.getItem('fw-lite-level10');
          var bk = localStorage.getItem('fw-lite-banks');
          if (lv !== null || bk !== null) {
            o = { level: parseInt(lv, 10), banks: bk ? bk.split(',') : null };
            why = 'migrated';
          }
        } catch (e) {}
      }
      fin(o, why);
      return;
    }

    try {
      (chrome.storage.sync || chrome.storage.local).get(STORE_KEY, function (obj) {
        var v = obj && obj[STORE_KEY];
        fin(v, v ? 'sync' : 'default');
      });
    } catch (e) {
      fin(null, 'default');
      return;
    }
    setTimeout(function () { fin(null, 'timeout'); }, 1500);
  }

  /* 另一标签页 / 图标弹窗改了设置 -> 这里立刻跟上；弹窗也会直接发消息，双保险 */
  function setupSync() {
    if (HAS_EXT) {
      try {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area !== 'sync' && area !== 'local') return;
          if (!changes[STORE_KEY]) return;
          log('收到其他标签页/弹窗的设置变更');
          applySettings(changes[STORE_KEY].newValue, 'sync', true);
        });
      } catch (e) { warn('storage listener failed:', e && e.message); }

      try {
        chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
          if (!msg || typeof msg.type !== 'string') return;
          try {
            if (msg.type === 'fw-stats') { sendResponse(snapshot()); return; }
            if (msg.type === 'fw-set') {
              applySettings(msg.settings, 'popup', true);
              sendResponse(snapshot());
              return;
            }
            if (msg.type === 'fw-rescan') { rescanAll(); sendResponse(snapshot()); return; }
            if (msg.type === 'fw-restore') { restoreAll(); sendResponse(snapshot()); return; }
          } catch (e) {
            stats.errors++;
            warn('message failed:', e && e.message);
            try { sendResponse({ ok: false, error: String(e && e.message) }); } catch (e2) {}
          }
        });
        log('message listener ready (popup 可查询本页统计)');
      } catch (e) { warn('runtime listener failed:', e && e.message); }
    } else {
      window.addEventListener('storage', function (e) {
        if (e.key !== STORE_KEY || !e.newValue) return;
        try { applySettings(JSON.parse(e.newValue), 'storage', true); } catch (err) {}
      });
    }
  }

  /* 给弹窗看的本页快照 */
  function snapshot() {
    return {
      ok: true,
      v: VERSION,
      on: CFG.on,
      zhLevel: CFG.zh.level, zhBanks: CFG.zh.banks.slice(),
      enLevel: CFG.en.level, enBanks: CFG.en.banks.slice(),
      level: lvNow(),          // 当前方向生效的档位（兼容旧调用）
      banks: banksNow().slice(),
      badge: !!CFG.badge,
      dir: CFG.dir,
      dirNow: dirNow(),
      siteOn: siteOn(),
      siteMode: (CFG.sites && CFG.sites.mode) || 'all',
      siteRuleHost: (siteRule() || {}).host || '',
      siteRules: (CFG.sites && CFG.sites.rules ? CFG.sites.rules.length : 0),
      replaced: stats.replaced,
      textNodes: stats.textNodes,
      nodesChanged: stats.nodesChanged,
      hanSeen: stats.hanSeen,
      wordsSeen: stats.wordsSeen,
      scans: stats.scans,
      errors: stats.errors,
      dictSize: stats.dictSize,
      dictTotal: stats.dictTotal,
      enDictSize: stats.enDictSize,
      lastScanMs: stats.lastScanMs,
      host: location.host
    };
  }

  /* ============================ 4.6 详解按需解析 ============================ */
  var DETAIL = new Map();
  function ensureDetails() {
    if (stats.detailLoaded) return;
    var t0 = Date.now();
    try {
      var lines = DETAIL_RAW.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line) continue;
        var f = line.split(FS);
        if (f.length < 3) continue;
        DETAIL.set(f[0], {
          ph: f[1] || '',
          senses: (f[2] || '').split(SS).filter(Boolean),
          morph: f[3] || '',
          mne: f[4] || '',
          sr: f[5] || '',
          sy: f[6] || '',
          an: f[7] || ''
        });
      }
    } catch (e) {
      stats.errors++;
      warn('detail parse failed:', e && e.message);
    }
    stats.detailLoaded = true;
    stats.detailSize = DETAIL.size;
    stats.detailMs = Date.now() - t0;
    log('details ready:', stats.detailSize, 'entries, ' + stats.detailMs + 'ms');
  }

  function lookupDetail(en) {
    ensureDetails();
    return DETAIL.get(String(en).toLowerCase()) || null;
  }

  /* ============================ 5. 汉字判断 ============================ */
  function isHanCode(c) { return c >= 0x4e00 && c <= 0x9fff; }
  function isHanAt(s, i) { return isHanCode(s.charCodeAt(i)); }
  function countHan(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) if (isHanCode(s.charCodeAt(i))) n++;
    return n;
  }

  /* ============================ 6. 哪些元素不碰 ============================
   * v1.4 放宽：标题、按钮、链接里的文字**也要换**（V2EX 首页标题就是 <a class="topic-link">）。
   * 只改文本、不改属性和结构，所以哪怕换成英文，链接照样能点、按钮照样能按。
   * 真正不碰的只剩：脚本/样式/代码/表单控件/可编辑区/隐藏元素/弹窗浮层。
   */
  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1, TITLE: 1, META: 1, LINK: 1,
    TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1,
    CODE: 1, PRE: 1, KBD: 1, SAMP: 1, VAR: 1,
    SVG: 1, MATH: 1, CANVAS: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, VIDEO: 1, AUDIO: 1
  };

  /* 只跳真正的表单控件；button/link/tab 这类"文字重要且能点"的角色不再跳 */
  var SKIP_ROLES = /^(textbox|searchbox|combobox|listbox|option|slider|spinbutton|checkbox|radio|switch|menuitemcheckbox|menuitemradio)$/;

  function skipReason(el) {
    var tag = el.tagName;
    if (SKIP_TAGS[tag]) return 'tag:' + tag;
    if (el.getAttribute('data-fw-ui') === '1') return 'ui';
    if (el.hasAttribute('hidden')) return 'hidden';
    if (el.getAttribute('aria-hidden') === 'true') return 'aria-hidden';
    if (el.isContentEditable) return 'editable';

    var ce = el.getAttribute('contenteditable');
    if (ce === '' || ce === 'true' || ce === 'plaintext-only') return 'editable';

    var role = el.getAttribute('role');
    if (role === 'dialog' || el.getAttribute('aria-modal') === 'true') return 'dialog';
    // 很多站点的弹窗不带 role=dialog，靠 class 名兜底（登录框/隐私弹层不该被替换）
    var cls = el.className;
    if (tag !== 'BODY' && tag !== 'HTML' && typeof cls === 'string' && cls &&
        /modal|dialog|popup|drawer/i.test(cls)) return 'modal';
    if (role && SKIP_ROLES.test(role)) return 'role:' + role;

    // 链接、按钮、onclick 元素都不再跳过——只换文本，点击行为不变。
    return null;
  }

  /* ============================ 6.5 分词器 ============================
   * Intl.Segmenter 能把「统计机器学习」正确切成 统计/机器/学习；
   * 探测失败自动回退贪心最长匹配。 */
  var segmenter = null;
  function initSegmenter() {
    try {
      if (typeof Intl === 'undefined' || !Intl.Segmenter) { log('Segmenter 不可用，使用贪心匹配'); return; }
      var seg = new Intl.Segmenter('zh', { granularity: 'word' });
      var it = seg.segment('测试分词')[Symbol.iterator]().next();
      if (it && it.value && it.value.segment === '测试') { segmenter = seg; log('Segmenter 已启用'); }
      else log('Segmenter 返回异常，使用贪心匹配');
    } catch (e) { log('Segmenter 初始化失败，使用贪心匹配:', e && e.message); }
  }

  /* ============================ 7. 替换核心 ============================ */
  var usedWords = new Set();
  var doneTexts = new WeakSet();
  var origText = new WeakMap();   // 文本节点 -> 原文
  var spanMap = new WeakMap();    // 文本节点 -> [{s,e,en,zh}] 供点击命中

  /* 词库越多，同一档位下换掉的词越多——用户直觉如此，也确实合理：
     多选一个词库就是多放一批词进来，而不是让它们互相挤掉。 */
  function bankScale() {
    var n = banksNow().length || 1;
    return Math.min(2.4, 0.8 + 0.15 * n);
  }

  /* 英->中：目标比例（0~1），即「每千词换 rateEn 个」× 词库系数。 */
  function enRatio() {
    var re = lvCfg().rateEn;
    if (!(re > 0)) return 0;
    return Math.min(0.85, re / 1000 * bankScale());
  }

  /* 全局安全上限：比例制是按节点算的，这里只挡「超长页面换到失控」。
     1.9 倍余量是因为有些段落候选扎堆、有些一个都没有，得留缓冲。 */
  function enAllowance() {
    var r = enRatio();
    if (!(r > 0)) return 0;
    return Math.round(CFG.baseBudgetEn + stats.wordsSeen * r * 1.9);
  }

  function allowance() {
    var c = lvCfg();
    if (dirNow() === 'en2zh') return enAllowance();
    var rate = c.rate;
    if (!(rate > 0)) return 0;
    if (rate === Infinity) return Infinity;   // 10 档：不设上限
    return CFG.baseBudget + Math.floor(stats.hanSeen / 1000 * rate);
  }

  function longestMatch(s, i) {
    var max = Math.min(MAXLEN, s.length - i);
    for (var len = max; len >= 2; len--) {
      var key = s.substr(i, len);
      var en = DICT.get(key);
      if (en === undefined) continue;
      if (lvCfg().once && usedWords.has(en)) continue;
      return { zh: key, en: en };
    }
    return null;
  }

  /* ======================= 7.2 英 -> 中 =======================
   * 英文网页：把词库里的英文词换成中文。档位越高换得越少（英文原文留得越多）。
   * 额度紧张时优先换「生僻」的词 —— 那才是真正看不懂的；常见词不动。
   */
  var EN_WORD = /[A-Za-z][A-Za-z'\u2019\-]*/g;

  function lemmaOf(w) {
    if (!w) return null;
    if (EN2ZH.has(w)) return w;
    if (MORPH && MORPH.size) {
      var b = MORPH.get(w);
      if (b && EN2ZH.has(b)) return b;
    }
    var c = [], base;
    if (/ied$/.test(w)) c.push(w.slice(0, -3) + 'y');
    if (/ies$/.test(w)) c.push(w.slice(0, -3) + 'y');
    if (/(ses|xes|zes|ches|shes|oes)$/.test(w)) c.push(w.slice(0, -2));
    if (/s$/.test(w)) c.push(w.slice(0, -1));
    if (/ing$/.test(w)) {
      base = w.slice(0, -3);
      c.push(base, base + 'e', base.slice(0, -1), base.slice(0, -1) + 'e');
    }
    if (/ed$/.test(w)) {
      base = w.slice(0, -2);
      c.push(base, base + 'e', base.slice(0, -1), base.slice(0, -1) + 'e');
    }
    if (/ly$/.test(w)) c.push(w.slice(0, -2));
    if (/er$/.test(w)) c.push(w.slice(0, -2), w.slice(0, -1));
    if (/est$/.test(w)) c.push(w.slice(0, -3), w.slice(0, -2));
    for (var i = 0; i < c.length; i++) {
      if (c[i] && c[i].length >= 3 && EN2ZH.has(c[i])) return c[i];
    }
    return null;
  }

  function processTextEn(node, text) {
    if (text.length > CFG.maxTextNodeLen) { bump('tooLong'); return 0; }

    var maxRank = lvCfg().maxRank;
    var toks = [], m, words = 0;
    EN_WORD.lastIndex = 0;
    while ((m = EN_WORD.exec(text))) {
      words++;
      var raw = m[0];
      var w = raw.toLowerCase().replace(/^['\u2019]+|['\u2019\-]+$/g, '');
      if (w.length < 3) continue;
      var lemma = lemmaOf(w);
      if (!lemma) continue;
      /* rank 越大越常见：自己的词库里排在最常见那一档的词直接不动，
         既不给「已过六级」的人添乱，也避开高频多义词的错译。 */
      if ((EN_RANK.get(lemma) || 0) > maxRank) continue;
      if (lvCfg().onceEn && usedWords.has(lemma)) continue;
      toks.push({ s: m.index, e: m.index + raw.length, en: lemma });
    }
    stats.wordsSeen += words;
    if (!toks.length) return 0;

    var ratio = enRatio();
    if (!(ratio > 0)) { bump('budget'); return 0; }

    var left = allowance() - stats.replaced;
    if (!(left > 0)) { bump('budget'); return 0; }

    /* 按本段词数算该换几个：密度在整页均匀，不会出现「开头很密、往下没词」。 */
    var want = Math.round(words * ratio);
    if (!want && words >= 3) want = 1;
    if (!want) return 0;

    var cap = Math.min(lvCfg().nodeEn, left, toks.length, want);
    var picked = toks;
    if (picked.length > cap) {
      // 额度不够时挑最生僻的（rank 0 最难），再按原文顺序放回去
      picked = toks.slice().sort(function (a, b) {
        return (EN_RANK.get(a.en) || 0) - (EN_RANK.get(b.en) || 0);
      }).slice(0, cap).sort(function (a, b) { return a.s - b.s; });
    }

    var out = '', cur = 0, n = 0, spans = [];
    for (var i = 0; i < picked.length; i++) {
      var t = picked[i];
      if (stats.replaced >= allowance()) break;
      var zh = EN2ZH.get(t.en);
      if (!zh) continue;
      out += text.slice(cur, t.s) + zh;
      spans.push({ s: out.length - zh.length, e: out.length, en: t.en, zh: zh, disp: zh });
      cur = t.e;
      n++;
      stats.replaced++;
      usedWords.add(t.en);
    }
    if (!n) return 0;
    out += text.slice(cur);

    try {
      if (!origText.has(node)) origText.set(node, text);
      spanMap.set(node, spans);
      node.data = out;
      stats.nodesChanged++;
    } catch (e) {
      stats.errors++;
      warn('write text failed:', e && e.message);
      return 0;
    }
    return n;
  }

  function processText(node) {
    var text;
    try { text = node.data; } catch (e) { bump('err:readText'); return 0; }
    if (!text) return 0;
    if (text.length > CFG.maxTextNodeLen) { bump('tooLong'); return 0; }

    if (!siteOn()) return 0;            // 总开关关掉 / 本站被排除 = 不替换

    if (dirNow() === 'en2zh') return processTextEn(node, text);

    var han = countHan(text);
    if (han === 0) return 0;

    if (stats.replaced >= allowance()) { bump('budget'); stats.hanSeen += han; return 0; }

    var out = '';
    var n = 0;
    var spans = [];

    // 追加原文片段；如果片段以英文字母/数字开头、而当前输出以英文/数字结尾，补空格
    function pushText(seg) {
      if (!seg) return;
      if (out && /[A-Za-z0-9]$/.test(out) && /^[A-Za-z0-9]/.test(seg)) out += ' ';
      out += seg;
    }

    function take(zh, en) {
      // 「教育领域」这类连续两个词都替换时，不补空格会拼成 educationrealm
      if (out && /[A-Za-z0-9]$/.test(out)) out += ' ';
      var s = out.length;
      out += en;
      spans.push({ s: s, e: s + en.length, en: en, zh: zh });
      n++;
      stats.replaced++;
      usedWords.add(en);
      log('  match', zh, '->', en, '@', (node.parentNode && node.parentNode.tagName) || '?');
    }

    if (segmenter) {
      try {
        var it = segmenter.segment(text)[Symbol.iterator]();
        var r;
        while (!(r = it.next()).done) {
          var seg = r.value.segment;
          if (n >= lvCfg().node || stats.replaced >= allowance()) { pushText(seg); continue; }
          var en = null;
          if (r.value.isWordLike && seg.length >= 2 && isHanAt(seg, 0) && countHan(seg) === seg.length) {
            var cand = DICT.get(seg);
            if (cand !== undefined && !(lvCfg().once && usedWords.has(cand))) en = cand;
          }
          if (en) take(seg, en); else pushText(seg);
        }
      } catch (e) {
        stats.errors++;
        warn('segmenter failed, fallback to greedy:', e && e.message);
        out = ''; n = 0; spans = [];
        segmenter = null;
      }
    }

    if (!segmenter) {
      var i = 0;
      while (i < text.length) {
        if (!isHanAt(text, i)) { pushText(text[i]); i++; continue; }
        if (n >= lvCfg().node || stats.replaced >= allowance()) { pushText(text.substr(i)); break; }
        var hit = longestMatch(text, i);
        if (!hit) { pushText(text[i]); i++; continue; }
        take(hit.zh, hit.en);
        i += hit.zh.length;
      }
    }

    stats.hanSeen += han;
    if (n === 0) return 0;

    try {
      if (!origText.has(node)) origText.set(node, text);
      spanMap.set(node, spans);
      node.data = out;                 // 只改文本，不动 DOM 结构 —— 最稳的做法
      stats.nodesChanged++;
    } catch (e) {
      stats.errors++;
      warn('write text failed:', e && e.message);
      return 0;
    }
    return n;
  }

  /* ============================ 8. 遍历扫描 ============================ */
  /* 分片扫描：每片最多干 40ms 就让出主线程。
     原来整页一次性同步扫，10 档在维基这种长页面上会把页面卡死十几秒，
     角标一直停在 0（其实是主线程被占满），看起来像「坏了」。 */
  var scanGen = 0, activeGen = 0;

  function scanChunked(root, why) {
    if (!siteOn()) return;                     // 总开关关掉或本站被排除：完全不碰页面
    if (!root || !root.childNodes) return;
    var gen = ++scanGen;
    activeGen = gen;
    var t0 = Date.now();
    var scanned = 0;
    var stack = [root];

    function finish() {
      stats.scans++;
      stats.lastScanMs = Date.now() - t0;
      stats.lastScanAt = Date.now();
      stats.budget = allowance();
      log('scan#' + stats.scans + (why ? '@' + why : '') + ': +' + scanned +
          ' text nodes, total replaced=' + stats.replaced + ', han=' + stats.hanSeen +
          ', budget=' + stats.budget + ', took ' + stats.lastScanMs + 'ms');
      renderBadge();
      if (activeGen === gen) activeGen = 0;
    }

    function step() {
      if (gen !== scanGen) {                 // 已经有更新的一轮扫描，自己退场
        if (activeGen === gen) activeGen = 0;
        return;
      }
      var sliceStart = Date.now();
      try {
        while (stack.length) {
          var el = stack.pop();
          if (!el || el.nodeType !== 1) continue;
          stats.elementsSeen++;

          var reason = (el === root) ? null : skipReason(el);
          if (reason) { bump(reason); continue; }

          var kids = el.childNodes;
          for (var i = 0; i < kids.length; i++) {
            var node = kids[i];
            if (node.nodeType === 3) {
              if (doneTexts.has(node)) { bump('already'); continue; }
              stats.textNodes++;
              doneTexts.add(node);
              processText(node);
              scanned++;
            } else if (node.nodeType === 1) {
              stack.push(node);
            }
          }
          if (Date.now() - sliceStart > 40) break;
        }
      } catch (e) {
        stats.errors++;
        warn('chunked scan failed:', e && e.message);
      }
      renderBadge();
      if (stack.length) setTimeout(step, 0);
      else finish();
    }

    step();
  }

  function scan(root) {
    // 增量扫描（新插入的一小段 DOM）直接同步跑，量很小
    if (!siteOn()) return;
    if (!root || !root.childNodes) return;
    var t0 = Date.now();
    var scanned = 0;

    var stack = [root];
    while (stack.length) {
      var el = stack.pop();
      if (!el || el.nodeType !== 1) continue;
      stats.elementsSeen++;

      var reason = (el === root) ? null : skipReason(el);
      if (reason) { bump(reason); continue; }

      var kids = el.childNodes;
      for (var i = 0; i < kids.length; i++) {
        var node = kids[i];
        if (node.nodeType === 3) {
          if (doneTexts.has(node)) { bump('already'); continue; }
          stats.textNodes++;
          doneTexts.add(node);
          processText(node);
          scanned++;
        } else if (node.nodeType === 1) {
          stack.push(node);
        }
      }
    }

    stats.scans++;
    stats.lastScanMs = Date.now() - t0;
    stats.lastScanAt = Date.now();
    stats.budget = allowance();
    log('scan#' + stats.scans + ': +' + scanned + ' text nodes, total replaced=' + stats.replaced +
        ', han=' + stats.hanSeen + ', budget=' + stats.budget + ', took ' + stats.lastScanMs + 'ms');
    renderBadge();
  }

  /* ============================ 9. UI 基础 ============================ */
  function mk(tag, css, text) {
    var el = document.createElement(tag);
    if (css) el.style.cssText = css;
    if (text != null) el.textContent = text;
    el.setAttribute('data-fw-ui', '1');
    return el;
  }

  var BASE_FONT = '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
  var MONO_FONT = 'ui-monospace,Menlo,Consolas,monospace';

  function btnCss(active) {
    return 'appearance:none;-webkit-appearance:none;border:1px solid ' +
      (active ? '#3ddc97' : 'rgba(255,255,255,.18)') + ';background:' +
      (active ? 'rgba(61,220,151,.18)' : 'rgba(255,255,255,.06)') + ';color:' +
      (active ? '#8ef7c6' : '#cfd6d3') + ';font:11px/1.4 ' + MONO_FONT +
      ';padding:3px 8px;border-radius:6px;cursor:pointer;margin:0;';
  }

  /* ---------- 9.1 角标（可选，纯显示，不可点） ----------
   * v1.4 起页面里没有右下角悬浮按钮/面板了，入口统一在插件图标的弹窗里。
   * 这里只留一个可选的诊断角标（默认关闭，弹窗里可以打开），
   * pointer-events:none —— 它绝不吃点击，也不会挡住页面右下角的按钮。
   */
  var badgeEl = null;

  function fmtSkip() {
    var parts = [];
    for (var k in stats.skip) parts.push(k + '=' + stats.skip[k]);
    parts.sort();
    return parts.join(' ');
  }

  function dumpText() {
    var meta = (BANKS_META && BANKS_META.banks) || [];
    var picked = meta.filter(function (b) { return banksNow().indexOf(b.id) >= 0; })
      .map(function (b) { return b.name; }).join('/');
    var lines = [
      'Flipword Lite ' + VERSION,
      '方向 ' + CFG.dir + ' -> ' + dirNow() +
        '（' + (dirNow() === 'en2zh' ? '英->中，档位越高换得越少' : '中->英，档位越高换得越多') + '）',
      '词库 ' + banksNow().length + '/' + meta.length + '：' + (picked || '（无）'),
      '替换表 ' + stats.dictSize + ' 条（全量 ' + stats.dictTotal + '）',
      '详解 ' + (stats.detailLoaded ? stats.detailSize + ' 条 / ' + stats.detailMs + 'ms' : '按需加载'),
      '强度 ' + lvNow() + '/10 ' + lvCfg().name + '（' +
        (lvCfg().rate === Infinity ? '不限量' : '每千字 ' + lvCfg().rate + ' 词') +
        '，单节点 ' + lvCfg().node + '，同词复现 ' + (lvCfg().once ? '否' : '是') + '）',
      '设置来源 ' + settingsSrc,
      '',
      '已替换 ' + stats.replaced + ' 个  词表 ' + usedWords.size,
      '文本节点 ' + stats.textNodes + '  改动 ' + stats.nodesChanged,
      '累计汉字 ' + stats.hanSeen + '  累计英文词 ' + stats.wordsSeen,
      '额度 ' + allowance(),
      '扫描 ' + stats.scans + ' 轮  末轮 ' + stats.lastScanMs + 'ms',
      '看卡 ' + stats.cardsShown + ' 次  换词库 ' + stats.bankSwitches + ' 次',
      '错误 ' + stats.errors,
      '',
      '跳过统计：',
      fmtSkip() || '（无）',
      '',
      '控制台：fwLite.stats / fwLite.test("中文") / fwLite.level(8) / fwLite.setBanks([...])'
    ];
    return lines.join('\n');
  }

  function renderBadge() {
    try {
      if (!CFG.badge) {
        if (badgeEl && badgeEl.parentNode) badgeEl.parentNode.removeChild(badgeEl);
        badgeEl = null;
        return;
      }
      if (!badgeEl) {
        badgeEl = mk('div',
          'position:fixed;right:8px;bottom:8px;z-index:2147483647;pointer-events:none;' +
          'padding:3px 7px;border-radius:10px;background:rgba(20,20,24,.72);color:#7ef0c8;' +
          'font:11px/1.4 ' + BASE_FONT + ';user-select:none;opacity:.9;' +
          'box-shadow:0 1px 4px rgba(0,0,0,.3)', 'FW');
        (document.body || document.documentElement).appendChild(badgeEl);
        log('badge mounted (仅显示，不可点)');
      }
      badgeEl.textContent = siteOn() ? ('FW ' + stats.replaced) : 'FW off';
    } catch (e) {
      stats.errors++;
      warn('badge failed:', e && e.message);
    }
  }

  /* ---------- 9.2 设置写入（强度 / 词库） ---------- */
  function setLevel(lv) {
    lv = Math.max(0, Math.min(10, parseInt(lv, 10) || 0));
    if (lv === lvNow()) return lvNow();
    side().level = lv;
    saveSettings({ level: lv });
    log('level set ->', lv, '(' + lvCfg().name + ')');
    rescanAll();
    renderBadge();
    return lvNow();
  }

  function setBanks(ids) {
    var valid = (ids || []).filter(function (x) { return bankIds.indexOf(x) >= 0; });
    if (!valid.length) { log('setBanks: 需要至少一个有效 id'); return banksNow().slice(); }
    if (valid.join(',') === banksNow().join(',')) return banksNow().slice();
    side().banks = valid;
    if (dirNow() === 'en2zh') maskEn = maskOf(valid); else maskZh = maskOf(valid);
    stats.bankSwitches++;
    saveSettings({ banks: valid });
    buildIndex();
    log('banks ->', valid.join(','), '| active entries=' + DICT.size);
    rescanAll();
    renderBadge();
    return banksNow().slice();
  }

  /* ---------- 9.3 释义卡片 ---------- */
  var cardEl = null, cardKey = null;

  function hideCard() {
    if (cardEl) cardEl.style.display = 'none';
    cardKey = null;
  }

  function ensureCard() {
    if (cardEl) return cardEl;
    cardEl = mk('div',
      'position:fixed;z-index:2147483647;display:none;width:min(320px,92vw);max-height:62vh;' +
      'overflow:auto;overscroll-behavior:contain;box-sizing:border-box;padding:12px 13px;' +
      'border-radius:12px;background:rgba(18,20,22,.97);color:#e6f3ee;' +
      'font:13px/1.6 ' + BASE_FONT + ';box-shadow:0 10px 32px rgba(0,0,0,.5);' +
      'border:1px solid rgba(126,240,200,.18)');
    cardEl.setAttribute('data-fw-card', '1');
    // 注意：这里必须用**冒泡**阶段（第三个参数 false）。
    // 之前写成捕获阶段 true，事件在到达卡片就被 stopPropagation 掐断，
    // 里面的 × 和 🔊 按钮永远收不到 click —— 表现就是"关闭按钮没用"。
    cardEl.addEventListener('click', function (e) { e.stopPropagation(); }, false);
    (document.body || document.documentElement).appendChild(cardEl);
    return cardEl;
  }

  function secRow(label, value, color) {
    var row = mk('div', 'display:flex;gap:6px;margin-top:5px;font-size:12px;line-height:1.55');
    var k = mk('span', 'flex:0 0 auto;color:#7f8f8a;font-size:10px;letter-spacing:.5px;padding-top:2px', label);
    var v = mk('span', 'flex:1;min-width:0;color:' + (color || '#cfe6de') + ';word-break:break-word', value);
    row.appendChild(k); row.appendChild(v);
    return row;
  }

  function speak(word) {
    try {
      if (typeof speechSynthesis === 'undefined') return;
      var u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.9;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { warn('tts failed:', e && e.message); }
  }

  function showCard(en, zh, x, y) {
    try {
      var el = ensureCard();
      el.textContent = '';
      stats.cardsShown++;
      cardKey = en;

      var d = lookupDetail(en);

      /* 头部：单词 + 音标 + 发音 + 关闭 */
      var head = mk('div', 'display:flex;align-items:flex-start;gap:8px');
      var left = mk('div', 'flex:1;min-width:0');
      var wrow = mk('div', 'display:flex;align-items:baseline;gap:6px;flex-wrap:wrap');
      wrow.appendChild(mk('span', 'font-size:19px;font-weight:700;letter-spacing:.2px;color:#8ef7c6', en));
      if (d && d.ph) wrow.appendChild(mk('span', 'font:11px/1.4 ' + MONO_FONT + ';color:#8b9a95', d.ph));
      left.appendChild(wrow);

      /* 选词按词频来，释义不一定对得上原词，所以把「替换前的中文」直接摊在标题下面 */
      var src = mk('div', 'display:inline-block;margin-top:5px;padding:2px 8px;border-radius:999px;' +
        'background:rgba(126,240,200,.10);border:1px solid rgba(126,240,200,.22);' +
        'font-size:11px;line-height:1.5;color:#9ad9c4');
      src.textContent = (dirNow() === 'en2zh' ? '替换为：' : '替换前：') + zh;
      left.appendChild(src);

      var btns = mk('div', 'display:flex;gap:4px;flex:0 0 auto');
      var spk = mk('button', btnCss(false) + 'padding:4px 7px', '🔊');
      spk.title = '朗读（浏览器语音）';
      spk.setAttribute('data-fw-act', 'speak');
      spk.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault(); speak(en);
      }, true);
      var cls = mk('button', btnCss(false) + 'padding:4px 7px', '×');
      cls.title = '关闭';
      cls.setAttribute('data-fw-act', 'close-card');
      cls.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault(); hideCard();
      }, true);
      btns.appendChild(spk); btns.appendChild(cls);

      head.appendChild(left); head.appendChild(btns);
      el.appendChild(head);

      var body = mk('div', 'margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px');

      if (d) {
        for (var i = 0; i < d.senses.length && i < 3; i++) {
          body.appendChild(mk('div', 'font-size:13px;color:#e6f3ee;margin-top:3px', d.senses[i]));
        }
        // 选词以词频为主，释义不一定命中原词——说清楚，免得以为是错译
        // （英->中方向不需要：那个中文就是这个词的释义）
        if (dirNow() !== 'en2zh' && zh && d.senses.join(' ').indexOf(zh) < 0) {
          body.appendChild(mk('div', 'margin-top:5px;font-size:11px;color:#8b9a95',
            '词频优先选词，与原词「' + zh + '」只是近似对应。'));
        }
        if (d.morph) body.appendChild(secRow('拆解', d.morph, '#9fe8cd'));
        if (d.mne) body.appendChild(secRow('记忆', d.mne, '#cfe6de'));
        if (d.sr) body.appendChild(secRow('同根', d.sr, '#a9c9c0'));
        if (d.sy) body.appendChild(secRow('近义', d.sy, '#a9c9c0'));
        if (d.an) body.appendChild(secRow('反义', d.an, '#a9c9c0'));
      } else if (dirNow() !== 'en2zh') {
        // 英->中：上面已经写了「替换为：xx」，没必要再解释一遍
        body.appendChild(mk('div', 'font-size:12px;color:#8b9a95;margin-top:4px',
          '这个词条暂时没有详解数据。'));
      }

      var names = maskToNames(EN_MASK.get(en) || 0);
      if (names.length) {
        body.appendChild(secRow('词库', names.slice(0, 6).join(' · '), '#7f8f8a'));
      }
      el.appendChild(body);

      var foot = mk('div', 'margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.08);' +
        'font-size:10px;color:#6f7f7a', '点空白处关闭 · 可长按选中复制');
      el.appendChild(foot);

      /* 定位：窄屏贴底，宽屏跟随点击 */
      var vw = window.innerWidth || 360;
      var vh = window.innerHeight || 640;
      el.style.display = 'block';
      el.style.left = '0px'; el.style.top = '0px';
      var rect = el.getBoundingClientRect();
      if (vw < 640) {
        el.style.left = '8px';
        el.style.width = (vw - 16) + 'px';
        el.style.bottom = '44px';
        el.style.top = 'auto';
      } else {
        var lx = Math.max(8, Math.min(x + 12, vw - rect.width - 12));
        var ly = Math.max(8, Math.min(y + 14, vh - rect.height - 12));
        el.style.left = lx + 'px';
        el.style.top = ly + 'px';
        el.style.bottom = 'auto';
      }
      log('card:', en, '<-', zh, d ? '(with detail)' : '(no detail)');
    } catch (e) {
      stats.errors++;
      warn('card failed:', e && e.message);
    }
  }

  /* 命中测试：点到了哪个被替换的词 */
  function hitTest(x, y) {
    var node = null, offset = 0;
    try {
      if (document.caretRangeFromPoint) {
        var r = document.caretRangeFromPoint(x, y);
        if (r) { node = r.startContainer; offset = r.startOffset; }
      } else if (document.caretPositionFromPoint) {
        var p = document.caretPositionFromPoint(x, y);
        if (p) { node = p.offsetNode; offset = p.offset; }
      }
    } catch (e) { return null; }

    if (!node || node.nodeType !== 3) return null;
    var spans = spanMap.get(node);
    if (!spans || !spans.length) return null;
    var txt = node.data || '';

    for (var i = 0; i < spans.length; i++) {
      var s = spans[i];
      if (offset < s.s - 1 || offset > s.e) continue;
      var disp = s.disp || s.en;        // 英->中时，页面上显示的是中文
      // 页面可能又改过这段文本，位置对不上就就近找一次
      if (txt.substr(s.s, s.e - s.s).toLowerCase() !== disp.toLowerCase()) {
        var at = txt.toLowerCase().indexOf(disp.toLowerCase(), Math.max(0, s.s - 4));
        if (at < 0) continue;
        return { s: at, e: at + disp.length, en: s.en, zh: s.zh };
      }
      return s;
    }
    return null;
  }

  function onDocClick(e) {
    try {
      var t = e.target;

      // UI 动作（关闭卡片 / 关闭面板 / 朗读）在文档捕获阶段就先处理，
      // 不依赖按钮自己的 click 监听，避免被上层 stopPropagation 掐断。
      var actEl = (t && t.closest) ? t.closest('[data-fw-act]') : null;
      if (actEl) {
        e.preventDefault();
        e.stopPropagation();
        var act = actEl.getAttribute('data-fw-act');
        if (act === 'close-card') hideCard();
        else if (act === 'speak') speak(cardKey || '');
        return;
      }

      if (t && t.closest && t.closest('[data-fw-ui="1"]')) return;

      var hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        // v1.4 起链接/按钮里的文字也会被替换。点在链接或按钮上时**让页面自己处理**，
        // 否则标题链接点不动、按钮按不下去——页面功能优先于看释义。
        var inter = (t && t.closest) ? t.closest('a[href],button,[role="button"],[role="link"],[onclick]') : null;
        if (inter) {
          // 卡片开着时点到链接/按钮：卡片先收起，点击本身照常交给页面
          if (cardKey) hideCard();
          log('点到交互元素，交给页面处理:', inter.tagName);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        showCard(hit.en, hit.zh, e.clientX, e.clientY);
        return;
      }
      if (cardKey) hideCard();
    } catch (err) { /* 点击处理绝不能影响页面 */ }
  }

  /* ============================ 10. 动态内容 ============================ */
  var observer = null, pending = [], pendingTimer = null;

  function queueScan(node) {
    if (!node) return;
    pending.push(node);
    if (pending.length > 6) pending = [document.body];
    if (pendingTimer) return;
    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      var list = pending;
      pending = [];
      try {
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].isConnected !== false) scan(list[i]);
        }
      } catch (e) {
        stats.errors++;
        warn('queued scan failed:', e && e.message, e && e.stack);
      }
    }, 400);
  }

  function startObserver() {
    try {
      observer = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type !== 'childList') continue;
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 1 && n.getAttribute && n.getAttribute('data-fw-ui') === '1') continue;
            if (n.nodeType === 1 || n.nodeType === 3) queueScan(n);
          }
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      log('MutationObserver started');
    } catch (e) {
      stats.errors++;
      warn('observer failed:', e && e.message);
    }
  }

  /* 还原原文（其它什么都不动） */
  function restoreAll() {
    if (!document.body) return 0;
    var n = 0;
    try {
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = w.nextNode())) {
        var o = origText.get(node);
        if (o !== undefined) {
          try { if (node.data !== o) { node.data = o; n++; } } catch (e) {}
        }
      }
    } catch (e) { warn('restore failed:', e && e.message); }
    log('restoreAll: restored', n, 'text nodes');
    return n;
  }

  /* 关总开关：页面还原成原文，统计一并归零（不扫描） */
  function haltAll() {
    restoreAll();
    origText = new WeakMap();
    spanMap = new WeakMap();
    doneTexts = new WeakSet();
    usedWords.clear();
    stats.replaced = 0;
    stats.nodesChanged = 0;
    stats.textNodes = 0;
    stats.hanSeen = 0;
    stats.wordsSeen = 0;
    hideCard();
    renderBadge();
  }

  /* 换强度 / 换词库 / 手动重扫：还原原文 -> 重置计数 -> 整页重扫 */
  function rescanAll() {
    restoreAll();
    origText = new WeakMap();
    spanMap = new WeakMap();
    doneTexts = new WeakSet();
    usedWords.clear();
    stats.replaced = 0;
    stats.nodesChanged = 0;
    stats.textNodes = 0;
    stats.hanSeen = 0;
    stats.wordsSeen = 0;
    stats.scans = 0;
    hideCard();
    if (!siteOn()) return;                     // 关着的时候「重扫」只负责还原
    ensureDirDict();
    try { if (document.body) scanChunked(document.body, 'rescan'); } catch (e) {
      stats.errors++;
      warn('rescan failed:', e && e.message);
    }
  }

  /* ============================ 11. 启动 ============================ */
  function start() {
    if (started) return;
    if (!document.body) {
      log('body 未就绪，等待 DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', start, { once: true });
      return;
    }
    started = true;

    autoDir = detectDir();
    ensureDirDict();
    log('方向 ' + CFG.dir + ' -> ' + dirNow() +
        '（' + (dirNow() === 'en2zh' ? '英->中' : '中->英') + '）');

    renderBadge();
    if (!siteOn()) {
      log('本站按站点规则不替换（mode=' + CFG.sites.mode + '）');
    }

    try { if (siteOn()) scanChunked(document.body, 'boot'); } catch (e) {
      stats.errors++;
      warn('first scan failed:', e && e.message, e && e.stack);
    }

    startObserver();
    setupSync();

    try {
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hideCard();
      }, true);
      log('click listener attached (点击英文词看释义)');
    } catch (e) { warn('listener failed:', e && e.message); }

    CFG.scanDelays.forEach(function (d) {
      setTimeout(function () {
        if (activeGen) { log('delayed scan skipped (还在扫描中)'); return; }
        try { if (document.body) scanChunked(document.body, 'delayed'); } catch (e) {
          stats.errors++;
          warn('delayed scan failed:', e && e.message);
        }
      }, d);
    });

    window.fwLite = {
      version: VERSION,
      stats: stats,
      cfg: CFG,
      info: snapshot,
      banks: function () { return banksNow().slice(); },
      setBanks: setBanks,
      level: function (v) {
        if (v === undefined) return lvNow();
        return setLevel(v);
      },
      badge: function (v) {
        if (v === undefined) return CFG.badge;
        CFG.badge = !!v;
        saveSettings({ badge: CFG.badge });
        renderBadge();
        return CFG.badge;
      },
      dir: function (v) {
        if (v === undefined) return { mode: CFG.dir, now: dirNow() };
        if (v !== 'auto' && v !== 'zh2en' && v !== 'en2zh') return CFG.dir;
        CFG.dir = v;
        autoDir = detectDir();
        ensureDirDict();
        saveSettings({ dir: v });
        buildIndex();
        rescanAll();
        return dirNow();
      },
      testEn: function (text) {
        var out = [], m;
        EN_WORD.lastIndex = 0;
        var s = String(text || '');
        while ((m = EN_WORD.exec(s))) {
          var w = m[0].toLowerCase();
          if (w.length < 3) continue;
          var lemma = lemmaOf(w);
          if (lemma) out.push(w + '->' + EN2ZH.get(lemma));
        }
        console.log(TAG, 'testEn:', out.length ? out.join(', ') : '（一个都没命中）');
        return out;
      },
      lookup: function (en) {
        var d = lookupDetail(en);
        console.log(TAG, en, d || '(no detail)');
        return d;
      },
      dictSize: function () { return DICT.size; },
      rescan: function () { rescanAll(); return stats.replaced; },
      test: function (text) {
        var out = [], i = 0;
        while (i < text.length) {
          if (!isHanAt(text, i)) { i++; continue; }
          var h = longestMatch(text, i);
          if (h) { out.push(h.zh + '->' + h.en); i += h.zh.length; } else i++;
        }
        console.log(TAG, 'test:', out.length ? out.join(', ') : '（一个都没命中）');
        return out;
      },
      restore: restoreAll,
      dump: dumpText,
      logs: LOGS
    };

    log('ready. 替换 ' + stats.replaced + ' 个词；点英文词看释义，强度和词库在插件图标弹窗里调');
  }

  function boot() {
    log('boot v' + VERSION);
    try { log('env: ua=' + navigator.userAgent.slice(0, 120)); } catch (e) {}
    log('env: readyState=' + document.readyState +
        ', Segmenter=' + (typeof Intl !== 'undefined' && !!Intl.Segmenter) +
        ', body=' + !!document.body);
    log('env: 扩展API=' + HAS_EXT +
        (HAS_EXT && chrome.runtime && chrome.runtime.id ? ', extId=' + chrome.runtime.id : ''));

    initSegmenter();
    initBankIds();

    loadSettings(function () {
      log('设置载入完成（来源 ' + settingsSrc + '）: on=' + CFG.on +
          ', 中->英=' + CFG.zh.level + '档/' + CFG.zh.banks.join(',') +
          ', 英->中=' + CFG.en.level + '档/' + CFG.en.banks.join(',') +
          ', badge=' + CFG.badge);
      try {
        parseDict();
      } catch (e) {
        stats.errors++;
        warn('FATAL dict parse:', e && e.message);
        return;
      }
      start();
    });
  }

  try {
    boot();
  } catch (e) {
    stats.errors++;
    warn('FATAL boot:', e && e.message, e && e.stack);
  }
})();
