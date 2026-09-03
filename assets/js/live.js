/* ═══ الطبقةُ الحيّة ════════════════════════════════════════
   الموقعُ ثابتٌ ومفهرس، لكنّ ما يُنشر في القاعدة بين بناءٍ
   وآخر يظهر هنا فوراً دون انتظار إعادة البناء.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const DB = window.EACR_DB || 'https://newserver-4e3d8-default-rtdb.firebaseio.com';
  const SECTIONS = {
    reports: 'تقرير',
    investigations: 'تحقيق',
    articles: 'مقال',
    news: 'خبر',
    interviews: 'حوار',
    infographics: 'إنفوجرافيك',
    videos: 'فيديو'
  };
  const CACHE_KEY = 'eacr:live';
  const TTL = 10 * 60 * 1000;

  const escape = (value) => (value || '').toString().replace(/[&<>"]/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
  ));

  const stripTags = (value) => (value || '').toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const toTime = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1e11 ? value : value * 1000;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(String(value));
    return match ? Date.parse(`${match[3]}-${match[2]}-${match[1]}`) : 0;
  };

  const dateLabel = (stamp) => {
    if (!stamp) return '';
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const date = new Date(stamp);
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const readCache = () => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      return raw && Date.now() - raw.at < TTL ? raw.items : null;
    } catch { return null; }
  };

  const writeCache = (items) => {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items })); } catch { /* ممتلئ */ }
  };

  async function fetchSection(section) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${DB}/${section}.json`, { signal: controller.signal });
      const data = await response.json();
      if (!data || typeof data !== 'object') return [];
      return Object.entries(data).map(([id, raw]) => ({
        id,
        section,
        sectionName: SECTIONS[section],
        title: (raw.title || '').toString().trim(),
        dek: stripTags(raw.summary || raw.description || raw.content || '').slice(0, 160),
        image: raw.image || raw.imageUrl || raw.img || raw.photo || '',
        focus: raw.focus && typeof raw.focus === 'object'
          ? `${Number(raw.focus.x) || 50}% ${Number(raw.focus.y) || 50}%` : '',
        stamp: toTime(raw.date || raw.createdAt || raw.timestamp)
      })).filter((item) => item.title);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async function collect() {
    const cached = readCache();
    if (cached) return cached;
    const groups = await Promise.all(Object.keys(SECTIONS).map(fetchSection));
    const items = groups.flat().sort((a, b) => b.stamp - a.stamp).slice(0, 40);
    writeCache(items);
    return items;
  }

  /* عناوينُ الصفحة المبنيّة مسبقاً — لا نكرّرها */
  const known = new Set(
    Array.from(document.querySelectorAll('.card__title a, .ticker__track a, .lead__title a'))
      .map((link) => link.textContent.trim())
  );

  const cardHTML = (item) => `
    <article class="card card--standard is-fresh">
      <a class="card__media" href="/read.html?type=${item.section}&id=${encodeURIComponent(item.id)}" tabindex="-1" aria-hidden="true">
        <div class="thumb" style="--ratio:16/9">
          ${item.image
            ? `<img src="${escape(item.image)}" alt="" loading="lazy"${
                item.focus ? ` style="object-position:${escape(item.focus)}"` : ''}>`
            : `<span class="thumb__fallback">${escape(item.title.slice(0, 1))}</span>`}
        </div>
      </a>
      <div class="card__body">
        <span class="kicker"><span class="kicker__dot"></span>${escape(item.sectionName)}
          <span class="fresh-tag">جديد</span></span>
        <h3 class="card__title">
          <a href="/read.html?type=${item.section}&id=${encodeURIComponent(item.id)}">${escape(item.title)}</a>
        </h3>
        <p class="card__dek">${escape(item.dek)}</p>
        <div class="card__foot"><p class="meta">${escape(dateLabel(item.stamp))}</p></div>
      </div>
    </article>`;

  const run = async () => {
    const grid0 = document.getElementById('latest-grid');
    const ghost = document.createElement('div');
    if (grid0 && !readCache()) {
      ghost.style.display = 'contents';
      ghost.innerHTML = window.EACR?.skeletonCards(3) || '';
      grid0.prepend(ghost);
    }
    const items = await collect();
    ghost.remove();
    const fresh = items.filter((item) => !known.has(item.title));
    if (!fresh.length) return;

    const grid = document.getElementById('latest-grid');
    if (grid) grid.insertAdjacentHTML('afterbegin', fresh.slice(0, 3).map(cardHTML).join(''));

    const track = document.getElementById('ticker-track');
    if (track) {
      track.insertAdjacentHTML('afterbegin', fresh.slice(0, 4).map((item) => `
        <a href="/read.html?type=${item.section}&id=${encodeURIComponent(item.id)}">
          <b>${escape(item.sectionName)}</b>${escape(item.title)}</a>`).join(''));
    }
    window.EACR?.refreshSavedUI?.();
  };

  const start = () => { run().catch(() => {}); };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2500 });
  else setTimeout(start, 1200);
})();
