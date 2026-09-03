/* ═══ نواةُ الواجهة ══════════════════════════════════════════
   التفضيلاتُ، والقوائمُ، والحفظُ، والمشاركةُ، وأدواتُ القراءة.
   بلا أيّ مكتبةٍ خارجيّة.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const root = document.documentElement;

  /* ─── تخزينٌ آمن ─────────────────────────────────────── */
  const store = {
    read(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    },
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* وضعٌ خاصّ */ }
    }
  };

  const PREFS_KEY = 'eacr:prefs';
  const SAVED_KEY = 'eacr:saved';
  let prefs = store.read(PREFS_KEY, {});

  const savePrefs = (patch) => {
    prefs = { ...prefs, ...patch };
    store.write(PREFS_KEY, prefs);
  };

  /* ─── تنبيهٌ عائم ────────────────────────────────────── */
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (message) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
  };

  /* ─── الوضعُ الليلي واللون ───────────────────────────── */
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    savePrefs({ theme });
    /* لونُ شريط المتصفّح يُؤخذ من ورق التصميم نفسِه، لا من لونٍ ثابت */
    const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
    $$('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', paper || (theme === 'dark' ? '#0B0B10' : '#FBFAF7'));
      meta.removeAttribute('media');
    });
  };

  const currentTheme = () => {
    if (root.dataset.theme === 'dark' || root.dataset.theme === 'light') return root.dataset.theme;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  $$('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  });

  $$('[data-accent]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.accent;
      root.style.setProperty('--brand', color);
      savePrefs({ accent: color });
      toast('غُيّر لونُ الواجهة');
    });
  });

  /* ─── القائمةُ الجانبيّة ─────────────────────────────── */
  const drawer = $('#drawer');
  const setDrawer = (open) => {
    if (!drawer) return;
    drawer.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    $$('[data-drawer-open]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) $('.drawer__panel a')?.focus();
  };
  $$('[data-drawer-open]').forEach((b) => b.addEventListener('click', () => setDrawer(true)));
  $$('[data-drawer-close]').forEach((b) => b.addEventListener('click', () => setDrawer(false)));

  /* ─── قائمةُ القراءة ─────────────────────────────────── */
  const getSaved = () => store.read(SAVED_KEY, []);
  const setSaved = (list) => {
    store.write(SAVED_KEY, list);
    refreshSavedUI();
  };

  function refreshSavedUI() {
    const list = getSaved();
    const urls = new Set(list.map((entry) => entry.url));
    $$('[data-save]').forEach((btn) => {
      btn.classList.toggle('is-on', urls.has(btn.dataset.save));
    });
    $$('[data-saved-count]').forEach((el) => {
      el.textContent = String(list.length);
      el.hidden = list.length === 0;
    });
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-save]');
    if (!btn) return;
    event.preventDefault();
    const url = btn.dataset.save;
    const list = getSaved();
    const index = list.findIndex((entry) => entry.url === url);
    if (index > -1) {
      list.splice(index, 1);
      toast('أُزيلت من قائمة القراءة');
    } else {
      list.unshift({
        url,
        title: btn.dataset.title || document.title,
        section: btn.dataset.section || '',
        image: btn.dataset.image || '',
        date: btn.dataset.date || '',
        at: Date.now()
      });
      toast('حُفظت للقراءة لاحقاً');
    }
    setSaved(list);
  });

  /* ─── المشاركةُ والنسخ ───────────────────────────────── */
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('نُسخ الرابط');
    } catch {
      const field = document.createElement('textarea');
      field.value = text;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
      toast('نُسخ الرابط');
    }
  };

  document.addEventListener('click', async (event) => {
    const copyBtn = event.target.closest('[data-copy]');
    if (copyBtn) { copy(copyBtn.dataset.copy); return; }

    const shareBtn = event.target.closest('[data-share]');
    if (!shareBtn) return;
    const url = new URL(shareBtn.dataset.share, location.origin).href;
    const title = shareBtn.dataset.shareTitle || document.title;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* أُلغيت */ }
    } else {
      copy(url);
    }
  });

  /* ─── شريطُ التقدّم وزرُّ الأعلى ─────────────────────── */
  const progress = $('#progress span');
  const toTop = $('[data-to-top]');
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const height = document.documentElement.scrollHeight - innerHeight;
      const ratio = height > 0 ? Math.min(scrollY / height, 1) : 0;
      if (progress) progress.style.width = `${ratio * 100}%`;
      if (toTop) toTop.hidden = scrollY < 700;
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  toTop?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  /* ─── أدواتُ المقال ──────────────────────────────────── */
  const SIZES = ['sm', '', 'lg', 'xl'];
  $$('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = SIZES.indexOf(root.dataset.size || '');
      const next = Math.min(SIZES.length - 1, Math.max(0, current + (btn.dataset.size === 'up' ? 1 : -1)));
      const value = SIZES[next];
      if (value) root.dataset.size = value; else delete root.dataset.size;
      savePrefs({ size: value });
    });
  });

  $$('[data-reading-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const on = document.body.classList.toggle('reading');
      btn.classList.toggle('is-on', on);
      toast(on ? 'وضعُ القراءة الهادئ' : 'عادت الواجهةُ الكاملة');
    });
  });

  /* ─── الاستماعُ إلى المقال ───────────────────────────── */
  const speakBtn = $('[data-speak]');
  if (speakBtn) {
    if (!('speechSynthesis' in window)) {
      speakBtn.hidden = true;
    } else {
      let speaking = false;
      speakBtn.addEventListener('click', () => {
        if (speaking) {
          speechSynthesis.cancel();
          speaking = false;
          speakBtn.classList.remove('is-on');
          return;
        }
        const title = $('.article__title')?.textContent || '';
        const body = $('#article-body')?.innerText || '';
        const text = `${title}. ${body}`.slice(0, 30000);
        if (!text.trim()) { toast('لا يوجد نصٌّ للقراءة'); return; }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.98;
        utterance.onend = () => { speaking = false; speakBtn.classList.remove('is-on'); };
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
        speaking = true;
        speakBtn.classList.add('is-on');
        toast('بدأ الاستماع — اضغط مرّةً أخرى للإيقاف');
      });
      addEventListener('beforeunload', () => speechSynthesis.cancel());
    }
  }

  /* ─── تتبّعُ جدول المحتويات ──────────────────────────── */
  const tocLinks = $$('.toc__list a');
  if (tocLinks.length) {
    const targets = tocLinks
      .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
      .filter(Boolean);

    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        tocLinks.forEach((link) => link.classList.remove('is-active'));
        const active = tocLinks.find(
          (link) => decodeURIComponent(link.hash.slice(1)) === entry.target.id
        );
        active?.classList.add('is-active');
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

    targets.forEach((target) => spy.observe(target));
  }

  /* ─── الهيكلُ العظميّ: وميضٌ مكانَ كلِّ شيءٍ لم يصل بعد ── */
  const skeletonCard = () => `
    <article class="card card--standard card--skeleton" aria-hidden="true">
      <span class="skel skel--media"></span>
      <div class="card__body">
        <span class="skel skel--kicker"></span>
        <span class="skel skel--title"></span>
        <span class="skel skel--title skel--short"></span>
        <span class="skel skel--line"></span>
        <span class="skel skel--meta"></span>
      </div>
    </article>`;

  const skeletonCards = (count = 6) => Array.from({ length: count }, skeletonCard).join('');

  const skeletonRows = (count = 5) => Array.from({ length: count }, () => `
    <div class="hit" aria-hidden="true">
      <span class="skel hit__thumb"></span>
      <span class="hit__body" style="display:grid;gap:.4rem">
        <span class="skel skel--title"></span>
        <span class="skel skel--meta"></span>
      </span>
    </div>`).join('');

  const skeletonArticle = () => `
    <div class="skel-article" aria-hidden="true">
      <span class="skel skel--kicker"></span>
      <span class="skel skel--h1"></span>
      <span class="skel skel--h1 skel--short"></span>
      <span class="skel skel--line"></span>
      <span class="skel skel--hero"></span>
      ${Array.from({ length: 6 }, (_, i) => `<span class="skel skel--para"${i % 3 === 2 ? ' style="width:72%"' : ''}></span>`).join('')}
    </div>`;

  /* الصورُ: وميضٌ في مكانها حتّى تصل */
  const watchThumb = (img) => {
    const thumb = img.closest('.thumb');
    if (!thumb) return;
    if (img.complete && img.naturalWidth) return;
    thumb.classList.add('is-loading');
    const done = () => thumb.classList.remove('is-loading');
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  };

  const watchAllThumbs = (scope = document) => $$('.thumb img', scope).forEach(watchThumb);
  watchAllThumbs();

  new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) watchAllThumbs(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  /* ─── صورةٌ كسرت: نعود إلى خلفيّة القسم بدل مربّعٍ فارغ ── */
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (img.tagName !== 'IMG') return;
    const thumb = img.closest('.thumb');
    if (thumb) {
      img.remove();
      if (!thumb.querySelector('.thumb__fallback')) {
        const mark = document.createElement('span');
        mark.className = 'thumb__fallback';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = (thumb.closest('.card, .poster, .lead')
          ?.querySelector('.card__title, .poster__title, .lead__title')?.textContent || 'د').trim().slice(0, 1);
        thumb.appendChild(mark);
      }
    } else if (img.closest('.article__hero')) {
      img.closest('figure')?.remove();
    }
  }, true);

  /* ─── اختصاراتُ لوحة المفاتيح ────────────────────────── */
  addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === '/') {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('eacr:search-open'));
    } else if (event.key.toLowerCase() === 'd') {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    } else if (event.key.toLowerCase() === 's' && $('[data-save]')) {
      $('.tools [data-save]')?.click();
    } else if (event.key === 'Escape') {
      setDrawer(false);
    }
  });

  /* ─── عاملُ الخدمة ───────────────────────────────────── */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  refreshSavedUI();

  /* ─── واجهةٌ للوحدات الأخرى ─────────────────────────── */
  window.EACR = {
    $, $$, store, toast, getSaved, setSaved, refreshSavedUI, copy,
    skeletonCards, skeletonRows, skeletonArticle, watchAllThumbs
  };
})();
