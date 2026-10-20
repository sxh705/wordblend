/* 设置读写 + 与内容脚本通信。
   设置结构（v2）：
     { on, dir, badge, zh: {level, banks}, en: {level, banks} }
   同时兼容 v1.5 的扁平结构 { level, banks }（level 0 = 关闭）。 */

const KEY = 'fw-settings'
const META = window.FW_BANKS || { banks: [], default: [] }
export const BANKS = META.banks || []
const IDS = BANKS.map((b) => b.id)

export const LEVEL_NAME = ['', '很淡', '很淡', '轻', '轻', '中', '中', '强', '强', '很密', '全量']
export const RATE_ZH = [0, 5, 8, 18, 28, 35, 45, 60, 80, 110, Infinity]
export const RATE_EN = [0, 145, 118, 88, 66, 49, 40, 32, 26, 22, 16]

let store = null
try {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    store = chrome.storage.sync || chrome.storage.local
  }
} catch (e) {}

const tabsApi = (() => {
  try {
    return typeof chrome !== 'undefined' && chrome.tabs ? chrome.tabs : null
  } catch (e) {
    return null
  }
})()

function defaultBanks() {
  const d = (META.default || []).filter((x) => IDS.includes(x))
  return d.length ? d : IDS.slice(0, 4)
}

const cleanBanks = (list, fallback) => {
  const ids = (Array.isArray(list) ? list : []).filter((x) => IDS.includes(x))
  return ids.length ? ids : fallback.slice()
}

const cleanLevel = (v, fallback) => {
  const lv = parseInt(v, 10)
  return lv >= 1 && lv <= 10 ? lv : fallback
}

export const SITE_MODES = [
  { id: 'all', name: '所有网站', hint: '不管哪个站都替换' },
  { id: 'allow', name: '仅白名单', hint: '只有名单里的站替换' },
  { id: 'block', name: '黑名单', hint: '名单里的站不替换' }
]

export function cleanHost(v) {
  let h = String(v || '').trim().toLowerCase()
  h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^\/\//, '')
  h = h.replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/^www\./, '')
  if (!h || h.length > 120) return ''
  if (!/^[a-z0-9.*_-]+$/.test(h)) return ''
  if (h.includes('*') && !h.startsWith('*.')) return ''
  return h
}

const cleanSites = (raw) => {
  const out = { mode: 'all', rules: [] }
  if (!raw || typeof raw !== 'object') return out
  if (SITE_MODES.some((m) => m.id === raw.mode)) out.mode = raw.mode
  const seen = new Set()
  for (const r of Array.isArray(raw.rules) ? raw.rules : []) {
    const host = cleanHost(r && r.host)
    if (!host || seen.has(host)) continue
    seen.add(host)
    out.rules.push({
      host,
      lang: r.lang === 'zh2en' || r.lang === 'en2zh' ? r.lang : 'auto',
      on: r.on !== false
    })
  }
  return out
}

export function normalize(raw) {
  const d = defaultBanks()
  const out = {
    on: true,
    dir: 'auto',
    badge: false,
    zh: { level: 3, banks: d.slice() },
    en: { level: 3, banks: d.slice() },
    sites: { mode: 'all', rules: [] }
  }
  if (!raw || typeof raw !== 'object') return out

  if (raw.zh || raw.en) {
    const side = (src) => ({
      level: cleanLevel(src && src.level, 3),
      banks: cleanBanks(src && src.banks, d)
    })
    out.zh = side(raw.zh)
    out.en = side(raw.en)
    out.on = raw.on !== false
  } else {
    // v1.5 扁平格式
    out.on = parseInt(raw.level, 10) !== 0
    const lv = cleanLevel(raw.level, 3)
    const banks = cleanBanks(raw.banks, d)
    out.zh = { level: lv, banks: banks.slice() }
    out.en = { level: lv, banks: banks.slice() }
  }
  out.badge = !!raw.badge
  if (['auto', 'zh2en', 'en2zh'].includes(raw.dir)) out.dir = raw.dir
  out.sites = cleanSites(raw.sites)
  return out
}

export function load() {
  return new Promise((resolve) => {
    if (!store) return resolve(normalize(null))
    let done = false
    const fin = (v) => {
      if (done) return
      done = true
      resolve(normalize(v))
    }
    try {
      store.get(KEY, (obj) => fin(obj && obj[KEY]))
    } catch (e) {
      fin(null)
    }
    setTimeout(() => fin(null), 1200)
  })
}

let saveTimer = null
let pending = null
export function save(cfg) {
  pending = cfg
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!store) return
    try {
      const p = {}
      p[KEY] = JSON.parse(JSON.stringify(pending))
      store.set(p)
    } catch (e) {}
  }, 120)
}

/* 当前窗口里能通信的标签页：优先 active，popup 自己被当成标签页时退到最近一个 http(s) 页 */
export function withTab(fn) {
  if (!tabsApi) return fn(null)
  try {
    tabsApi.query({ active: true, currentWindow: true }, (list) => {
      const t = (list || []).find((x) => x && /^https?:/i.test(x.url || ''))
      if (t) return fn(t)
      try {
        tabsApi.query({ currentWindow: true }, (all) => {
          const cands = (all || []).filter((x) => x && /^https?:/i.test(x.url || ''))
          fn(cands[cands.length - 1] || null)
        })
      } catch (e) {
        fn(null)
      }
    })
  } catch (e) {
    fn(null)
  }
}

export function send(tab, msg, cb) {
  if (!tabsApi || !tab) return cb && cb(null, 'no-tab')
  try {
    tabsApi.sendMessage(tab.id, msg, (resp) => {
      let err = null
      try {
        err = chrome.runtime.lastError
      } catch (e) {}
      cb && cb(err ? null : resp || null, err ? err.message || 'error' : null)
    })
  } catch (e) {
    cb && cb(null, e && e.message)
  }
}

/* 把设置推给当前页（storage.onChanged 也会到，双保险，幂等） */
export function pushToPage(cfg) {
  return new Promise((resolve) => {
    withTab((tab) => {
      if (!tab) return resolve(null)
      send(tab, { type: 'fw-set', settings: cfg }, (r) => resolve(r))
    })
  })
}

export function ask(type) {
  return new Promise((resolve) => {
    withTab((tab) => {
      if (!tab) return resolve(null)
      send(tab, { type }, (r) => resolve(r))
    })
  })
}

export function tabInfo() {
  return new Promise((resolve) => {
    withTab((tab) => {
      if (!tab) return resolve({ host: '—', url: '' })
      let host = '—'
      try {
        host = new URL(tab.url).host.replace(/^www\./, '')
      } catch (e) {}
      resolve({ host, url: tab.url || '' })
    })
  })
}
