<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Switch from './components/Switch.vue'
import LevelPicker from './components/LevelPicker.vue'
import BankPicker from './components/BankPicker.vue'
import {
  BANKS, LEVEL_NAME, RATE_EN, RATE_ZH, SITE_MODES, cleanHost,
  ask, load, normalize, pushToPage, save, tabInfo
} from './store.js'

const cfg = reactive(normalize(null))
/* 默认落在「站点」页：新装用户进来先决定在哪儿生效，再去调强度和词库 */
const tab = ref('sites')
const ready = ref(false)
const host = ref('—')
const stats = ref(null)
const ver = ref('')
const busy = ref(false)
const newHost = ref('')

/* 页面语言：默认自动。判定不准时可以手动指定，也可以在「站点」里只对某个站锁定 */
const DIRS = [
  { id: 'auto', name: '自动' },
  { id: 'zh2en', name: '中文页' },
  { id: 'en2zh', name: '英文页' }
]

/* 按水平给的推荐配置（关于页「用这套」直接套用） */
const PRESETS = [
  {
    who: '高中 / 四级还没过',
    zh: 9, en: 2, bankName: '基础',
    banks: ['cet4', 'cefr-b2']
  },
  {
    who: '四级已过 / 备六级',
    zh: 7, en: 3, bankName: '基础 + 进阶',
    banks: ['cet4', 'cefr-b2', 'ielts', 'toefl', 'npee']
  },
  {
    who: '考研 / 雅思托福',
    zh: 5, en: 4, bankName: '基础 + 进阶 + 学术',
    banks: ['cet4', 'cefr-b2', 'ielts', 'toefl', 'npee', 'gre', 'academic']
  },
  {
    who: '读论文 / 技术文档',
    zh: 3, en: 5, bankName: '进阶 + 专业',
    banks: ['npee', 'gre', 'gmat', 'sat', 'academic', 'business', 'tech', 'news']
  }
]

const dirNow = computed(() => stats.value?.dirNow || '')
const pageKind = computed(() =>
  !dirNow.value ? '' : dirNow.value === 'en2zh' ? '英文页' : '中文页')
const side = computed(() => (tab.value === 'en' ? cfg.en : cfg.zh))
const banksMeta = computed(() => (tab.value === 'en' ? cfg.en : cfg.zh))

/* 本站规则（第一条命中的） */
const curRule = computed(() => {
  const h = host.value
  if (!h || h === '—') return null
  return cfg.sites.rules.find((r) => r.on !== false && matchHost(r.host, h)) || null
})
const pinned = computed(() => {
  const r = curRule.value
  return !!(r && (r.lang === 'zh2en' || r.lang === 'en2zh'))
})
const modeHint = computed(() => (SITE_MODES.find((m) => m.id === cfg.sites.mode) || SITE_MODES[0]).hint)

/* 当前这一页到底会不会被替换（白名单/黑名单模式下最容易让人以为「没生效」） */
const pageInactive = computed(() => {
  if (!cfg.on) return false
  if (!host.value || host.value === '—') return false
  if (cfg.sites.mode === 'allow') return !curRule.value
  if (cfg.sites.mode === 'block') return !!curRule.value
  return false
})

/* 英→中：档位越高越淡；显示「多少比例的词会变中文」 */
const enPct = computed(() => {
  const n = cfg.en.banks.length || 1
  const scale = Math.min(2.4, 0.8 + 0.15 * n)
  return Math.min(85, Math.round((RATE_EN[cfg.en.level] / 1000) * scale * 78))
})

const levelDesc = computed(() => {
  if (tab.value === 'en') return `${cfg.en.level} 档 · 约 ${enPct.value}% 的英文词换成中文`
  const r = RATE_ZH[cfg.zh.level]
  return `${cfg.zh.level} 档 · ${LEVEL_NAME[cfg.zh.level]} · 每千字约 ${r === Infinity ? '不限' : r} 词`
})

const levelHint = computed(() =>
  tab.value === 'en'
    ? '1 = 最密（几乎每句都有中文），10 = 只偶尔标注一个，适合练阅读'
    : '1 = 很淡，10 = 尽可能替换（不限额度，同一词可反复出现）'
)

const bankCount = computed(() => side.value.banks.length)
const totalBanks = BANKS.length
const errText = computed(() => (stats.value && stats.value.errors ? `错误 ${stats.value.errors}` : ''))
const siteOff = computed(() => !!stats.value && stats.value.siteOn === false)

function matchHost(pattern, h) {
  if (!pattern || !h) return false
  if (pattern.startsWith('*.')) {
    const b = pattern.slice(2)
    return h === b || h.endsWith('.' + b)
  }
  return h === pattern || h.endsWith('.' + pattern)
}

function bumpSide(key, value) {
  const target = tab.value === 'en' ? cfg.en : cfg.zh
  target[key] = value
}

async function refresh() {
  const r = await ask('fw-stats')
  stats.value = r && r.ok ? r : null
}

async function push() {
  busy.value = true
  await pushToPage(JSON.parse(JSON.stringify(cfg)))
  await refresh()
  busy.value = false
}

async function act(type) {
  busy.value = true
  await ask(type)
  await refresh()
  busy.value = false
}

function addHost(raw) {
  const h = cleanHost(raw)
  if (!h) return false
  if (cfg.sites.rules.some((r) => r.host === h)) return false
  cfg.sites.rules.unshift({ host: h, lang: 'auto', on: true })
  return true
}

function submitHost() {
  if (addHost(newHost.value)) newHost.value = ''
}

function removeRule(h) {
  const i = cfg.sites.rules.findIndex((r) => r.host === h)
  if (i >= 0) cfg.sites.rules.splice(i, 1)
}

function quickToggle() {
  if (!host.value || host.value === '—') return
  if (curRule.value) {
    removeRule(curRule.value.host)
    return
  }
  addHost(host.value)
  if (cfg.sites.mode === 'all') cfg.sites.mode = 'block'
}

function clearPin() {
  if (curRule.value) curRule.value.lang = 'auto'
}

/* 关于页：一键套用推荐配置，然后跳到「中 → 英」让用户先看到效果 */
function applyPreset(p) {
  cfg.zh.level = p.zh
  cfg.en.level = p.en
  cfg.zh.banks = p.banks.slice()
  cfg.en.banks = p.banks.slice()
  tab.value = 'zh'
}

const quickLabel = computed(() => {
  if (curRule.value) return '移除本站规则'
  return cfg.sites.mode === 'allow' ? '本站加入白名单' : '本站不替换'
})

let timer = null
watch(
  cfg,
  () => {
    if (!ready.value) return
    save(cfg)
    clearTimeout(timer)
    timer = setTimeout(push, 260)
  },
  { deep: true }
)

onMounted(async () => {
  try {
    ver.value = chrome.runtime.getManifest().version
  } catch (e) {}
  const loaded = await load()
  Object.assign(cfg, loaded)
  const info = await tabInfo()
  host.value = info.host
  await refresh()
  ready.value = true
})
</script>

<template>
  <div class="min-h-[420px] bg-ink text-fg">
    <!-- 顶部：品牌 + 总开关 -->
    <header class="flex items-start justify-between gap-3 border-b border-line px-4 pb-2.5 pt-3">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-[13px] font-medium tracking-wide">Wordblend</span>
          <span class="font-mono text-[10px] text-dim">v{{ ver }}</span>
        </div>
        <div class="mt-0.5 truncate font-mono text-[10.5px] text-mute">
          {{ host }}
          <template v-if="stats">
            · {{ pageKind }} · 已换 {{ stats.replaced }} 词
          </template>
          <template v-else> · 此页不可用</template>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1">
        <Switch v-model="cfg.on" />
        <span class="font-mono text-[9.5px]" :class="cfg.on ? 'text-mintsoft' : 'text-dim'">
          {{ cfg.on ? '已开启' : '已关闭' }}
        </span>
      </div>
    </header>

    <!-- 页面语言：默认自动，可手动锁定 -->
    <div class="px-4 pb-2 pt-2">
      <div class="flex items-center gap-1.5">
        <span class="shrink-0 text-[10.5px] text-dim">页面语言</span>
        <button
          v-for="d in DIRS"
          :key="d.id"
          type="button"
          class="flex-1 rounded-md border px-1 py-1 text-[10.5px] transition-colors duration-100"
          :class="cfg.dir === d.id && !pinned
            ? 'border-mint/55 bg-mint/12 text-mintsoft'
            : 'border-white/10 bg-white/[0.03] text-[#9fb0aa] hover:bg-white/[0.07]'"
          @click="cfg.dir = d.id"
        >
          {{ d.name }}
        </button>
      </div>
      <div v-if="pinned" class="mt-1 flex items-center gap-1 font-mono text-[9.5px] text-mintsoft/80">
        <span>本站已锁定为「{{ curRule.lang === 'en2zh' ? '英文页' : '中文页' }}」</span>
        <button type="button" class="underline decoration-dotted hover:text-mintsoft" @click="clearPin">
          取消
        </button>
      </div>
      <div v-else-if="siteOff" class="mt-1 font-mono text-[9.5px] text-[#e0a45a]">
        本站按规则不替换
      </div>
    </div>

    <!-- 四个标签 -->
    <nav class="flex gap-1 px-3">
      <button
        v-for="t in [{ id: 'zh', name: '中 → 英' }, { id: 'en', name: '英 → 中' }, { id: 'sites', name: '站点' }, { id: 'about', name: '关于' }]"
        :key="t.id"
        type="button"
        class="flex-1 rounded-lg border px-0.5 py-1.5 text-[11px] transition-colors duration-100"
        :class="tab === t.id
          ? 'border-mint/60 bg-mint/14 text-mintsoft'
          : 'border-white/10 bg-white/[0.03] text-[#9fb0aa] hover:bg-white/[0.07]'"
        @click="tab = t.id"
      >
        {{ t.name }}
        <span v-if="t.id === 'zh' || t.id === 'en'" class="ml-0.5 font-mono text-[9px] opacity-60">
          {{ t.id === 'en' ? cfg.en.level : cfg.zh.level }}
        </span>
        <span v-else-if="t.id === 'sites'" class="ml-0.5 font-mono text-[9px] opacity-60">{{ cfg.sites.rules.length }}</span>
      </button>
    </nav>

    <!-- 强度 + 词库 -->
    <section v-if="tab === 'zh' || tab === 'en'" class="space-y-3.5 px-4 pb-3.5 pt-3" :class="cfg.on ? '' : 'opacity-60'">
      <div>
        <div class="mb-1.5 flex items-baseline justify-between">
          <span class="text-[11.5px] text-[#b6c6c0]">强度</span>
          <span class="font-mono text-[10.5px] text-mintsoft">{{ levelDesc }}</span>
        </div>
        <LevelPicker :model-value="side.level" @update:model-value="bumpSide('level', $event)" />
        <p class="mt-1.5 text-[10px] leading-relaxed text-dim">{{ levelHint }}</p>
      </div>

      <div>
        <div class="mb-1.5 flex items-baseline justify-between">
          <span class="text-[11.5px] text-[#b6c6c0]">词库</span>
          <span class="font-mono text-[10.5px] text-dim">已选 {{ bankCount }} / {{ totalBanks }}</span>
        </div>
        <div class="max-h-[190px] overflow-y-auto pr-0.5">
          <BankPicker :model-value="banksMeta.banks" @update:model-value="bumpSide('banks', $event)" />
        </div>
      </div>
    </section>

    <!-- 站点规则 -->
    <section v-else-if="tab === 'sites'" class="space-y-3 px-4 pb-3.5 pt-3" :class="cfg.on ? '' : 'opacity-60'">
      <div
        v-if="pageInactive"
        class="flex items-center gap-2 rounded-md border border-[#e0a45a]/35 bg-[#e0a45a]/10 px-2 py-1.5 text-[10px] leading-relaxed text-[#e6b273]"
      >
        <span class="min-w-0 flex-1">
          本站不替换<template v-if="cfg.sites.mode === 'allow'">（不在白名单里）</template>
        </span>
        <button
          type="button"
          class="shrink-0 rounded border border-[#e0a45a]/45 px-1.5 py-0.5 text-[10px] hover:bg-[#e0a45a]/20"
          @click="quickToggle"
        >
          {{ cfg.sites.mode === 'allow' ? '加入白名单' : '取消屏蔽' }}
        </button>
      </div>
      <div>
        <div class="mb-1.5 flex items-baseline justify-between">
          <span class="text-[11.5px] text-[#b6c6c0]">替换范围</span>
          <span class="font-mono text-[10px] text-dim">{{ cfg.sites.rules.length }} 条规则</span>
        </div>
        <div class="flex gap-1">
          <button
            v-for="m in SITE_MODES"
            :key="m.id"
            type="button"
            class="flex-1 rounded-md border px-1 py-1 text-[10.5px] transition-colors duration-100"
            :class="cfg.sites.mode === m.id
              ? 'border-mint/55 bg-mint/12 text-mintsoft'
              : 'border-white/10 bg-white/[0.03] text-[#9fb0aa] hover:bg-white/[0.07]'"
            @click="cfg.sites.mode = m.id"
          >
            {{ m.name }}
          </button>
        </div>
        <p class="mt-1.5 text-[10px] leading-relaxed text-dim">{{ modeHint }}</p>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="min-w-0 flex-1 truncate font-mono text-[10.5px] text-mute">{{ host }}</span>
        <button
          type="button"
          class="shrink-0 rounded-md border px-2 py-1 text-[10.5px] transition-colors duration-100"
          :class="curRule
            ? 'border-[#e0a45a]/40 bg-[#e0a45a]/10 text-[#e6b273] hover:bg-[#e0a45a]/20'
            : 'border-mint/40 bg-mint/10 text-mintsoft hover:bg-mint/20'"
          :disabled="!host || host === '—'"
          @click="quickToggle"
        >
          {{ quickLabel }}
        </button>
      </div>

      <div class="flex gap-1.5">
        <input
          v-model="newHost"
          type="text"
          placeholder="m.example.com 或 *.example.com"
          class="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10.5px] text-fg outline-none placeholder:text-dim/70 focus:border-mint/40"
          @keydown.enter="submitHost"
        />
        <button
          type="button"
          class="shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[10.5px] text-[#b6c6c0] hover:bg-white/[0.1]"
          @click="submitHost"
        >
          添加
        </button>
      </div>

      <div v-if="cfg.sites.rules.length" class="max-h-[150px] space-y-1 overflow-y-auto pr-0.5">
        <div
          v-for="r in cfg.sites.rules"
          :key="r.host"
          class="flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1"
        >
          <span class="min-w-0 flex-1 truncate font-mono text-[10.5px]"
                :class="curRule && curRule.host === r.host ? 'text-mintsoft' : 'text-[#b6c6c0]'">
            {{ r.host }}
          </span>
          <select
            v-model="r.lang"
            class="shrink-0 rounded border border-white/10 bg-panel px-1 py-0.5 text-[9.5px] text-[#9fb0aa] outline-none"
          >
            <option value="auto">自动</option>
            <option value="zh2en">中文</option>
            <option value="en2zh">英文</option>
          </select>
          <button
            type="button"
            class="shrink-0 rounded px-1 text-[13px] leading-none text-dim hover:text-[#e6b273]"
            title="删除"
            @click="removeRule(r.host)"
          >
            ×
          </button>
        </div>
      </div>
      <p v-else class="text-[10px] leading-relaxed text-dim">
        还没有规则。切到「黑名单」后把当前站加进来，这个站就不再替换；切到「仅白名单」则是反过来，只替换名单里的站。
      </p>
    </section>

    <!-- 关于 -->
    <section v-else class="space-y-3 px-4 pb-3.5 pt-3">
      <div>
        <div class="flex items-baseline gap-1.5">
          <span class="text-[12.5px] tracking-wide">Wordblend</span>
          <span class="font-mono text-[10px] text-dim">v{{ ver }}</span>
          <span class="ml-auto font-mono text-[9.5px] text-dim">MIT</span>
        </div>
        <p class="mt-1 text-[10.5px] leading-relaxed text-dim">
          中文页夹英文词，英文页夹中文词。词典全部打包在扩展里，不联网、不采集、不用登录。
        </p>
      </div>

      <div class="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
        <div class="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">开发</div>
        <div class="mt-1 flex items-center justify-between text-[11px]">
          <span class="text-[#cfdad5]">sxh705</span>
          <a href="https://github.com/sxh705/wordblend" target="_blank" rel="noopener"
             class="text-mintsoft hover:underline">源码 ↗</a>
        </div>
        <div class="mt-0.5 flex items-center justify-between text-[10px] text-dim">
          <span>个人项目 · 欢迎提 issue</span>
          <a href="https://github.com/sxh705/wordblend/issues" target="_blank" rel="noopener"
             class="hover:text-mintsoft">反馈 ↗</a>
        </div>
      </div>

      <div>
        <div class="mb-1.5 flex items-baseline justify-between">
          <span class="text-[11.5px] text-[#b6c6c0]">推荐设置</span>
          <span class="font-mono text-[9.5px] text-dim">选一行，点「用这套」</span>
        </div>
        <div class="space-y-1">
          <div
            v-for="p in PRESETS"
            :key="p.who"
            class="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1.5"
          >
            <div class="flex items-center justify-between gap-1.5">
              <span class="min-w-0 truncate text-[11px] text-[#cfdad5]">{{ p.who }}</span>
              <button
                type="button"
                class="shrink-0 rounded border border-mint/40 bg-mint/10 px-1.5 py-0.5 text-[9.5px] text-mintsoft hover:bg-mint/20"
                @click="applyPreset(p)"
              >
                用这套
              </button>
            </div>
            <div class="mt-0.5 font-mono text-[9px] text-dim">
              中→英 {{ p.zh }} 档 · 英→中 {{ p.en }} 档 · {{ p.bankName }}
            </div>
          </div>
        </div>
      </div>

      <p class="text-[9.5px] leading-relaxed text-dim">
        中→英 数字越大越密（10 = 几乎每句都有）；英→中 正好相反，1 最密、10 只偶尔标一个难词。
        觉得太花就往回调一档，不够就加一档。
      </p>
    </section>

    <!-- 底部：统计 + 操作 -->
    <footer v-if="tab !== 'about'" class="space-y-2.5 border-t border-line px-4 py-3">
      <div class="flex items-center justify-between gap-2">
        <span class="truncate font-mono text-[10px] text-dim">
          <template v-if="stats">扫描 {{ stats.scans }} 轮 · {{ stats.lastScanMs }}ms{{ errText ? ' · ' + errText : '' }}</template>
          <template v-else>未连接到页面</template>
        </span>
        <div class="flex shrink-0 gap-1.5">
          <button
            type="button"
            class="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10.5px] text-[#b6c6c0] hover:bg-white/[0.09]"
            :disabled="busy"
            @click="act('fw-rescan')"
          >
            重扫
          </button>
          <button
            type="button"
            class="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10.5px] text-[#b6c6c0] hover:bg-white/[0.09]"
            :disabled="busy"
            @click="act('fw-restore')"
          >
            还原
          </button>
        </div>
      </div>

      <label class="flex cursor-pointer items-center justify-between">
        <span class="text-[10.5px] text-dim">页面角标（纯计数，不可点）</span>
        <Switch v-model="cfg.badge" />
      </label>
    </footer>
  </div>
</template>
