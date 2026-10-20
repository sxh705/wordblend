# -*- coding: utf-8 -*-
"""把 src/core.js + 数据块组装成：扩展目录、油猴脚本、zip 包。

用法：
    cd popup && pnpm install && pnpm build     # 先构建弹窗，产物落在 src/popup-dist
    python build.py                            # 再打包，产物落在 dist/
"""
import os, sys, json, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
sys.path.insert(0, os.path.join(HERE, 'tools'))

SRC = 'src/core.js'
DICT = 'data/dict_raw2.txt'
DETAIL = 'data/detail_raw.txt'
BANKS = 'data/banks_raw.txt'
BASIC = 'data/basic_detail.json'      # 原词库缺失的高频基础词（人工补齐）
OUT = 'dist'
EXT = os.path.join(OUT, 'ext')
VERSION = '2.1.0'
NAME = 'Wordblend'

core = open(SRC, encoding='utf-8').read()
# 版本号单一来源：构建时把 core.js 里的常量刷成本脚本的 VERSION
import re as _re
core = _re.sub(r"var VERSION = '[^']*';", "var VERSION = '%s';" % VERSION, core, count=1)
dict_raw = open(DICT, encoding='utf-8').read().strip()
detail_raw = open(DETAIL, encoding='utf-8').read().strip()
banks_raw = open(BANKS, encoding='utf-8').read().strip()

# ---------- 把基础词合并进详解表 ----------
# 这些词（学习/打开/工作/使用…）在原词库里没有词条，卡片会显示"没有详解数据"。
# basic_detail.json 里是人工核对过的音标 + 中文释义，这里按详解表的 8 列格式补进去。
S1, S2 = chr(1), chr(2)
_have = set(l.split(S1)[0] for l in detail_raw.split('\n') if l)
_basic = json.load(open(BASIC, encoding='utf-8')) if os.path.exists(BASIC) else {}
_extra = []
for _w, _v in sorted(_basic.items()):
    if _w in _have:
        continue
    _senses = [s for s in (_v.get('senses') or []) if s]
    if not _senses:
        continue
    _extra.append(S1.join([_w, (_v.get('ph') or '').strip(), S2.join(_senses), '', '', '', '', '']))
if _extra:
    detail_raw = detail_raw + '\n' + '\n'.join(_extra)
print('基础词并入详解: %d 条（人工补齐）' % len(_extra))

for name, blob in [('dict', dict_raw), ('detail', detail_raw)]:
    assert '`' not in blob, name + ' contains backtick'
    assert '\\' not in blob, name + ' contains backslash'
    assert '${' not in blob, name + ' contains ${'

en2zh_raw = open('data/en2zh_raw.txt', encoding='utf-8').read().strip()
morph_raw = open('data/morph_raw.txt', encoding='utf-8').read().strip()
for name, blob in [('en2zh', en2zh_raw), ('morph', morph_raw)]:
    assert '`' not in blob, name + ' contains backtick'
    assert chr(92) not in blob, name + ' contains backslash'
    assert '${' not in blob, name + ' contains ${'
assert '__FW_DICT__' in core and '__FW_DETAIL__' in core and '__FW_BANKS__' in core

bundled = core.replace('__FW_BANKS__', banks_raw)
bundled = bundled.replace('__FW_DICT__', '`\n' + dict_raw + '\n`')
bundled = bundled.replace('__FW_DETAIL__', '`\n' + detail_raw + '\n`')
bundled = bundled.replace('__FW_EN2ZH__', '`\n' + en2zh_raw + '\n`')
bundled = bundled.replace('__FW_MORPH__', '`\n' + morph_raw + '\n`')
assert '__FW_' not in bundled, 'placeholder left'

os.makedirs(EXT, exist_ok=True)

manifest = {
    "manifest_version": 3,
    "name": "Wordblend — 中英混排阅读",
    "version": VERSION,
    "description": "中文网页夹英文词、英文网页夹中文词，点词看释义。18 个离线词库、1~10 档强度、站点黑白名单，全程零联网。",
    "permissions": ["storage"],
    "host_permissions": ["http://*/*", "https://*/*"],
    "action": {
        "default_popup": "popup.html",
        "default_title": "Wordblend — 强度 / 词库 / 站点"
    },
    "icons": {
        "16": "icon16.png",
        "32": "icon32.png",
        "48": "icon48.png",
        "128": "icon128.png"
    },
    "content_scripts": [{
        "matches": ["http://*/*", "https://*/*"],
        "js": ["content.js"],
        "run_at": "document_end",
        "all_frames": False
    }]
}

# ---------- 图标（纯标准库绘制） ----------
import make_icon
for _p in make_icon.build(EXT):
    print('icon:', os.path.basename(_p))

# ---------- 图标弹窗（Vue + Tailwind，pnpm build 产物） ----------
# 源码在 popup/，构建输出 lite-src/popup-dist/：index.html + popup.js + popup.css
PUP = 'src/popup-dist'
if not os.path.exists(os.path.join(PUP, 'popup.js')):
    raise SystemExit('缺少弹窗构建产物，先在 popup/ 里执行 pnpm build')
open(os.path.join(EXT, 'popup.html'), 'w', encoding='utf-8').write(
    open(os.path.join(PUP, 'index.html'), encoding='utf-8').read())
for _f in ('popup.js', 'popup.css'):
    open(os.path.join(EXT, _f), 'w', encoding='utf-8').write(
        open(os.path.join(PUP, _f), encoding='utf-8').read())
open(os.path.join(EXT, 'banks-meta.js'), 'w', encoding='utf-8').write(
    'window.FW_BANKS = ' + banks_raw + ';' + chr(10))

with open(os.path.join(EXT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
open(os.path.join(EXT, 'content.js'), 'w', encoding='utf-8').write(bundled)

user_head = """// ==UserScript==
// @name         Wordblend
// @namespace    wordblend
// @version      """ + VERSION + """
// @description  中英混排阅读：中文页夹英文词、英文页夹中文词，点词看释义；零网络零后台
// @match        http://*/*
// @match        https://*/*
// @run-at       document-end
// @grant        none
// @noframes
// ==/UserScript==

"""
open(os.path.join(OUT, 'Wordblend.user.js'), 'w', encoding='utf-8').write(user_head + bundled)

readme = open('docs/manual.txt', encoding='utf-8').read()

open(os.path.join(OUT, 'README.txt'), 'w', encoding='utf-8').write(readme)

zp = os.path.join(OUT, 'Wordblend-v%s.zip' % VERSION)
for old in os.listdir(OUT):
    if old.startswith('Wordblend-v') and old.endswith('.zip'):
        os.remove(os.path.join(OUT, old))
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for root, dirs, files in os.walk(EXT):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, EXT).replace(os.sep, '/'))

print('built:')
print('  ext/content.js       %.0f KB' % (os.path.getsize(os.path.join(EXT, 'content.js')) / 1024))
print('  Wordblend.user.js    %.0f KB' % (os.path.getsize(os.path.join(OUT, 'Wordblend.user.js')) / 1024))
print('  zip                   %.0f KB' % (os.path.getsize(zp) / 1024))
print('  dict entries:', dict_raw.count('\n') + 1)
print('  detail entries:', detail_raw.count('\n') + 1)
