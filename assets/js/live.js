/* ═══ الطبقةُ الحيّة ════════════════════════════════════════
   الموقعُ ثابتٌ ومفهرس، لكنّ ما يُنشر في القاعدة بين بناءٍ
   وآخر يظهر هنا فوراً دون انتظار إعادة البناء.

   الأقسامُ تأتي من window.EACR_SECTIONS التي يكتبها المولّد
   من content/site.yml — فأيُّ قسمٍ يُضاف من لوحة الإدارة
   يعمل هنا بلا تعديل سطرٍ واحد.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const DB = (window.EACR_DB || '').replace(/\/$/, '');
  let sections = Array.isArray(window.EACR_SECTIONS) ? window.EACR_SECTIONS : [];
  if (!DB || !sections.length) return;

  let byId = Object.fromEntries(sections.map((s) => [s.id, s]));
  const CACHE_KEY = 'eacr:live';
  /* الذاكرةُ للرسم الأوّل لا للحقيقة: نعرض المحفوظَ فوراً ثمّ نسأل
     القاعدةَ في كلِّ فتحةِ صفحة. فمن نشر من اللوحة ثمّ فتح الموقعَ
     يرى منشورَه الآن، لا بعد خمس دقائق. */
  const TTL = 60 * 1000;

  const escape = (value) => (value || '').toString().replace(/[&<>"]/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
  ));

  const stripTags = (value) => (value || '').toString()
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const toTime = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1e11 ? value : value * 1000;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(String(value));
    return match ? Date.parse(`${match[3]}-${match[2]}-${match[1]}`) : 0;
  };

  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const dateLabel = (stamp) => {
    if (!stamp) return '';
    const date = new Date(stamp);
    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  };

  const youtubeId = (url) => {
    const match = /(?:youtu\.be\/|watch\?v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/.exec(url || '');
    return match ? match[1] : '';
  };

  const readCache = () => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      return raw && Date.now() - raw.at < TTL ? raw.items : null;
    } catch { return null; }
  };

  const writeCache = (items) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
    } catch { /* ممتلئ */ }
  };

  const readUrl = (item) =>
    `/read.html?type=${encodeURIComponent(item.section)}&id=${encodeURIComponent(item.id)}`;

  async function fetchSection(section) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${DB}/${encodeURIComponent(section.id)}.json`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) return [];
      const data = await response.json();
      if (!data || typeof data !== 'object') return [];
      return Object.entries(data).map(([id, raw]) => {
        if (!raw || typeof raw !== 'object') return null;
        const video = raw.video || raw.videoUrl || raw.link || '';
        const image = raw.image || raw.imageUrl || raw.img || raw.photo || raw.thumbnail || '';
        const vid = youtubeId(video);
        return {
          id,
          section: section.id,
          sectionName: section.single || section.name,
          accent: section.accent || '',
          display: section.display || 'standard',
          title: (raw.title || raw.name || '').toString().trim(),
          dek: stripTags(raw.summary || raw.description || raw.excerpt || raw.content || '').slice(0, 180),
          role: (raw.role || raw.affiliation || raw.position || '').toString().trim(),
          when: (raw.when || raw.time || '').toString().trim(),
          venue: (raw.venue || raw.hall || raw.place || '').toString().trim(),
          image: image || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : ''),
          focus: raw.focus && typeof raw.focus === 'object'
            ? `${Number(raw.focus.x) || 50}% ${Number(raw.focus.y) || 50}%` : '',
          stamp: toTime(raw.date || raw.createdAt || raw.timestamp)
        };
      }).filter((item) => item && item.title);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshSections() {
    try {
      const response = await fetch(`${DB}/site_config/sections.json`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data)) return;

      const configured = data
        .filter((section) => section && typeof section === 'object' && String(section.id || '').trim())
        .map((section) => ({
          ...(byId[section.id] || {}),
          ...section,
          id: String(section.id).trim()
        }));
      if (!configured.length) return;
      sections = configured;
      byId = Object.fromEntries(sections.map((section) => [section.id, section]));
      window.EACR_SECTIONS = sections;
    } catch {
      /* نستخدمُ تعريفاتِ البناء عند تعذّر الوصول إلى الإعدادات الحيّة */
    }
  }

  async function fetchAll() {
    const groups = await Promise.all(sections.map(fetchSection));
    const items = groups.flat().sort((a, b) => b.stamp - a.stamp).slice(0, 120);
    writeCache(items);
    return items;
  }

  /* ── ما بُني في الصفحة مسبقاً: لا نكرّره ─────────────────
     المقارنةُ بالمعرّف لا بالعنوان: العنوانُ نصٌّ قد تكون طبقةُ
     الترجمة بدّلته قبل أن نصل، فيصير «تجربه» في القاعدة و
     «an experience» في الصفحة، فيُحقن المنشورُ مرّتين. */
  const known = new Set(
    Array.from(document.querySelectorAll('[data-item]'))
      .map((node) => node.getAttribute('data-item'))
      .filter(Boolean)
  );
  const knownTitles = new Set(
    Array.from(document.querySelectorAll(
      '.card__title a, .ticker__track a, .lead__title a, .event__title a, .person__name a, .tile__cap'
    )).map((node) => node.textContent.trim()).filter(Boolean)
  );
  const isBuilt = (item) => known.has(item.id) || knownTitles.has(item.title);

  /* ── بطاقاتٌ تطابق قوالبَ macros.html شكلاً بشكل ────────── */

  const thumb = (item, ratio = '16/9') => `
    <div class="thumb" style="--ratio:${ratio}">
      ${item.image
        ? `<img src="${escape(item.image)}" alt="" loading="lazy" decoding="async"${
            item.focus ? ` style="object-position:${escape(item.focus)}"` : ''}>`
        : `<span class="thumb__fallback">${escape(item.title.slice(0, 1))}</span>`}
    </div>`;

  const freshTag = '<span class="fresh-tag">جديد</span>';

  const standardCard = (item) => `
    <article class="card card--standard is-fresh" data-item="${escape(item.id)}" data-source="firebase" style="--accent: ${escape(item.accent)}">
      <a class="card__media" href="${readUrl(item)}" tabindex="-1" aria-hidden="true">${thumb(item)}</a>
      <div class="card__body">
        <span class="kicker"><span class="kicker__dot"></span>${escape(item.sectionName)}${freshTag}</span>
        <h3 class="card__title"><a href="${readUrl(item)}">${escape(item.title)}</a></h3>
        ${item.dek ? `<p class="card__dek">${escape(item.dek)}</p>` : ''}
        <div class="card__foot"><p class="meta">${escape(dateLabel(item.stamp))}</p></div>
      </div>
    </article>`;

  const eventCard = (item) => {
    const date = item.stamp ? new Date(item.stamp) : null;
    const badge = date
      ? `<time class="daymark" datetime="${date.toISOString().slice(0, 10)}" style="--accent: ${escape(item.accent)}">
           <b>${date.getDate()}</b><span>${MONTHS[date.getMonth()]}</span></time>`
      : '';
    const media = item.image
      ? `<a class="event__media" href="${readUrl(item)}" tabindex="-1" aria-hidden="true">
           <img src="${escape(item.image)}" alt="" loading="lazy" decoding="async"></a>`
      : '';
    return `
    <article class="event is-fresh" data-item="${escape(item.id)}" data-source="firebase" style="--accent: ${escape(item.accent)}">
      ${badge}
      <div class="event__body">
        <h3 class="event__title"><a href="${readUrl(item)}">${escape(item.title)}</a> ${freshTag}</h3>
        ${item.dek ? `<p class="event__dek">${escape(item.dek)}</p>` : ''}
        <p class="event__facts">
          ${item.when ? `<span class="event__fact">${escape(item.when)}</span>` : ''}
          ${item.venue ? `<span class="event__fact">${escape(item.venue)}</span>` : ''}
        </p>
      </div>
      ${media}
    </article>`;
  };

  const personCard = (item) => `
    <article class="person is-fresh" data-item="${escape(item.id)}" data-source="firebase" style="--accent: ${escape(item.accent)}">
      <a class="person__face" href="${readUrl(item)}" tabindex="-1" aria-hidden="true">
        ${item.image
          ? `<img src="${escape(item.image)}" alt="" loading="lazy" decoding="async">`
          : `<span class="person__initial">${escape(item.title.slice(0, 1))}</span>`}
      </a>
      <h3 class="person__name"><a href="${readUrl(item)}">${escape(item.title)}</a></h3>
      ${item.role || item.dek ? `<p class="person__role">${escape(item.role || item.dek)}</p>` : ''}
    </article>`;

  const galleryTile = (item) => `
    <a class="tile is-fresh" href="${readUrl(item)}" data-item="${escape(item.id)}" data-source="firebase" style="--accent: ${escape(item.accent)}">
      ${item.image
        ? `<img src="${escape(item.image)}" alt="${escape(item.title)}" loading="lazy" decoding="async">`
        : `<span class="tile__initial" aria-hidden="true">${escape(item.title.slice(0, 1))}</span>`}
      <span class="tile__cap">${escape(item.title)}</span>
    </a>`;

  const videoCard = (item) => `
    <article class="card card--video is-fresh" data-item="${escape(item.id)}" data-source="firebase" style="--accent: ${escape(item.accent)}">
      <a class="card__media" href="${readUrl(item)}" tabindex="-1" aria-hidden="true">
        ${thumb(item)}<span class="play" aria-hidden="true"></span>
      </a>
      <div class="card__body">
        <span class="kicker"><span class="kicker__dot"></span>${escape(item.sectionName)}${freshTag}</span>
        <h3 class="card__title"><a href="${readUrl(item)}">${escape(item.title)}</a></h3>
      </div>
    </article>`;

  const cardFor = (item) => {
    switch (item.display) {
      case 'agenda':  return eventCard(item);
      case 'people':  return personCard(item);
      case 'gallery': return galleryTile(item);
      case 'video':   return videoCard(item);
      default:        return standardCard(item);
    }
  };

  /* ── الحقن ─────────────────────────────────────────────── */

  const inject = (host, items) => {
    if (!host || !items.length) return false;
    host.insertAdjacentHTML('afterbegin', items.map(cardFor).join(''));
    host.hidden = false;
    return true;
  };

  /* ما حُقن في هذه الجولة — فلا يُحقن ثانيةً حين يعود الجوابُ من الشبكة */
  const placed = new Set();

  const paint = (all) => {
    const liveIds = new Set(all.map((item) => item.id));
    document.querySelectorAll('[data-source="firebase"][data-item]').forEach((node) => {
      if (!liveIds.has(node.getAttribute('data-item'))) node.remove();
    });

    const page = document.querySelector('[data-live-section]');
    const pageSection = page ? page.getAttribute('data-live-section') : '';
    const homeGrid = document.getElementById('latest-grid');

    const fresh = all.filter((item) => !isBuilt(item) && !placed.has(item.id));
    if (!fresh.length) return 0;
    fresh.forEach((item) => placed.add(item.id));

    /* صفحةُ قسم: كلُّ جديدِ هذا القسم في صدر شبكته */
    if (pageSection) {
      const mine = fresh.filter((item) => item.section === pageSection);
      if (inject(document.querySelector('[data-live-grid]'), mine)) {
        document.querySelector('[data-empty-state]')?.remove();
      }
    }

    /* الرئيسيّة: أحدثُ ثلاثةٍ في الشبكة، وأربعةٌ في الشريط */
    if (homeGrid) {
      const forHome = fresh
        .filter((item) => (byId[item.section] || {}).display !== 'gallery')
        .slice(0, 3)
        .map((item) => ({ ...item, display: 'standard' }));
      inject(homeGrid, forHome);
      const track = document.getElementById('ticker-track');
      if (track) {
        track.insertAdjacentHTML('afterbegin', fresh.slice(0, 4).map((item) => `
          <a href="${readUrl(item)}" data-item="${escape(item.id)}" data-source="firebase"><b>${escape(item.sectionName)}</b>${escape(item.title)}</a>`).join(''));
      }
    }

    window.EACR?.refreshSavedUI?.();
    document.dispatchEvent(new CustomEvent('eacr:live', { detail: { count: fresh.length } }));
    return fresh.length;
  };

  const run = async () => {
    const homeGrid = document.getElementById('latest-grid');
    const cached = readCache();

    await refreshSections();

    /* ١. المحفوظُ يُرسم فوراً إن وُجد */
    if (cached) paint(cached);

    /* ٢. وفي كلِّ الأحوال نسأل القاعدةَ — لأنّ المحرّرَ قد نشر للتوّ */
    const ghost = document.createElement('div');
    if (homeGrid && !cached) {
      ghost.style.display = 'contents';
      ghost.innerHTML = window.EACR?.skeletonCards(3) || '';
      homeGrid.prepend(ghost);
    }
    const live = await fetchAll();
    ghost.remove();
    paint(live);
  };

  const start = () => { run().catch(() => {}); };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
  else setTimeout(start, 500);

  /* العودةُ إلى اللسان بعد النشر من اللوحة: نسأل من جديد */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchAll().then(paint).catch(() => {});
  });
})();
