/* ═══ لغتان: الإنجليزيّةُ أوّلاً والعربيّةُ بضغطةٍ واحدة ══════
   الصفحاتُ تُبنى بالعربيّة — فهي لغةُ التحرير — ثمّ تُقرأ هنا
   بالإنجليزيّة من معجمٍ يُبنى مع الموقع (assets/i18n/en.json).

   وما يُنشر من لوحة الإدارة بعد البناء لا معجمَ له: يُترجَم في
   المتصفّح عند أوّل قارئٍ ويُحفظ عنده، فلا يُترجَم مرّتين.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const KEY = 'eacr:lang';
  const CACHE = 'eacr:tr:en';
  const DEFAULT = 'en';
  const ARABIC = /[؀-ۿ]/;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'SVG', 'TEMPLATE']);
  const ATTRS = ['alt', 'title', 'placeholder', 'aria-label', 'data-share-title'];
  const MAX = 1800;

  const root = document.documentElement;

  const current = () => {
    try { return localStorage.getItem(KEY) || DEFAULT; } catch { return DEFAULT; }
  };

  /* ── الزرُّ: عربيّة ⇄ English ───────────────────────────── */
  const wireToggle = (lang) => {
    document.querySelectorAll('[data-lang-toggle]').forEach((button) => {
      const next = lang === 'ar' ? 'en' : 'ar';
      button.textContent = lang === 'ar' ? 'EN' : 'ع';
      button.setAttribute('aria-label', lang === 'ar' ? 'Read in English' : 'اقرأ بالعربيّة');
      button.setAttribute('title', button.getAttribute('aria-label'));
      button.setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
      button.addEventListener('click', () => {
        try { localStorage.setItem(KEY, next); } catch { /* لا مخزن */ }
        location.reload();
      });
    });
  };

  const lang = current();
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  root.setAttribute('data-lang', lang);

  if (lang === 'ar') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => wireToggle(lang));
    } else {
      wireToggle(lang);
    }
    return;
  }

  /* ── المعجم: ما بُني مسبقاً، وما تُرجم في هذا المتصفّح ─── */
  const norm = (text) => text.replace(/\s+/g, ' ').trim();
  const arabic = (text) => ARABIC.test(text);

  let dict = {};
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch { cache = {}; }

  let saveTimer = 0;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(CACHE, JSON.stringify(cache)); } catch { /* ممتلئ */ }
    }, 800);
  };

  const known = (text) => dict[text] || cache[text] || '';

  /* ── ترجمةُ ما لا معجمَ له: خدمةٌ عامّةٌ ونتيجةٌ محفوظة ─── */
  const pending = new Map();

  async function machine(text) {
    if (pending.has(text)) return pending.get(text);
    const task = (async () => {
      const url = 'https://translate.googleapis.com/translate_a/single'
        + `?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      try {
        const response = await fetch(url);
        if (!response.ok) return '';
        const payload = await response.json();
        const parts = Array.isArray(payload?.[0]) ? payload[0] : [];
        const out = parts.map((part) => (part && part[0]) || '').join('').trim();
        if (out && out !== text) { cache[text] = out; persist(); return out; }
      } catch { /* لا شبكة — يبقى الأصل */ }
      return '';
    })();
    pending.set(text, task);
    return task;
  }

  /* ── جمعُ ما يُترجَم من شجرة الصفحة ───────────────────── */
  const blocked = (node) => {
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (SKIP.has(el.tagName)) return true;
      if (el.hasAttribute('data-no-translate') || el.getAttribute('translate') === 'no') return true;
    }
    return false;
  };

  const jobs = [];   // [applyFn, sourceText]

  const scanText = (host) => {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const raw = node.nodeValue || '';
      const text = norm(raw);
      if (!text || text.length > MAX || !arabic(text) || blocked(node)) return;
      const lead = raw.match(/^\s*/)[0];
      const tail = raw.match(/\s*$/)[0];
      jobs.push([(out) => { node.nodeValue = lead + out + tail; }, text]);
    });
  };

  const scanAttrs = (host) => {
    const selector = ATTRS.map((name) => `[${name}]`).join(',');
    const list = host.nodeType === 1 && host.matches?.(selector)
      ? [host, ...host.querySelectorAll(selector)]
      : Array.from(host.querySelectorAll?.(selector) || []);
    list.forEach((el) => {
      if (SKIP.has(el.tagName) || el.closest('[data-no-translate],[translate="no"]')) return;
      ATTRS.forEach((name) => {
        const raw = el.getAttribute(name);
        if (!raw) return;
        const text = norm(raw);
        if (!text || text.length > MAX || !arabic(text)) return;
        jobs.push([(out) => el.setAttribute(name, out), text]);
      });
    });
  };

  /* ── التنفيذ: المعجمُ فوراً، والباقي على دفعاتٍ محدودة ─── */
  async function flush() {
    const batch = jobs.splice(0, jobs.length);
    const late = [];
    batch.forEach(([apply, text]) => {
      const hit = known(text);
      if (hit) apply(hit);
      else late.push([apply, text]);
    });
    /* المعجمُ طُبِّق: تُرفع الحجبةُ الآن ولا ننتظر الشبكة */
    root.setAttribute('data-translated', '1');
    if (!late.length) return;

    const queue = late.slice(0, 120);
    let index = 0;
    const worker = async () => {
      while (index < queue.length) {
        const [apply, text] = queue[index++];
        const out = await machine(text);
        if (out) apply(out);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }

  const translateTree = (host) => {
    scanText(host);
    scanAttrs(host);
    return flush();
  };

  /* ما تحقنه الطبقةُ الحيّة بعد البناء يُترجَم فور ظهوره — والمراقبةُ
     تبدأ قبل أوّل حقنٍ لا بعده، وإلّا مرَّ المنشورُ الجديدُ بلا ترجمة */
  const watch = () => {
    let queued = 0;
    const observer = new MutationObserver((records) => {
      const roots = [];
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) roots.push(node);
          else if (node.nodeType === 3 && node.nodeValue && arabic(node.nodeValue)) {
            roots.push(node.parentElement);
          }
        });
      });
      if (!roots.length) return;
      clearTimeout(queued);
      queued = setTimeout(() => {
        roots.filter(Boolean).forEach((node) => { scanText(node); scanAttrs(node); });
        flush();
      }, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const run = async () => {
    wireToggle(lang);
    watch();

    try { dict = await (window.__EACR_I18N || Promise.resolve({})) || {}; } catch { dict = {}; }

    const title = norm(document.title);
    if (arabic(title)) {
      const out = known(title) || await machine(title);
      if (out) document.title = out;
    }

    await translateTree(document.body);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
