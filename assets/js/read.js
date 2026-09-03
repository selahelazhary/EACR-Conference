/* ═══ قارئُ المنشور المباشرة (/read.html) ═══════════════════
   يعرض منشوراً نُشر للتوّ في القاعدة قبل إعادة بناء الموقع.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const SITE_TITLE = (window.EACR_SITE && window.EACR_SITE.title) || 'EACR Conference';

  const root = document.getElementById('live-root');
  const status = document.getElementById('live-status');
  if (!root) return;

  const DB = (window.EACR_DB || '').replace(/\/$/, '');
  /* [المفرد فوق المنشور، الرابط، الجمع في «تصفّح …»] — من الأقسام
     التي يكتبها المولّد، فأيُّ قسمٍ يُضاف من اللوحة يُقرأ هنا. */
  const SECTIONS = Object.fromEntries(
    (window.EACR_SECTIONS || []).map((s) => [
      s.id, [s.single || s.name, `/${s.slug || s.id}/`, s.plural || s.name]
    ])
  );

  // هيكلٌ عظميٌّ ريثما يصل المنشور
  root.insertAdjacentHTML('beforeend', window.EACR?.skeletonArticle() || '');

  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const id = params.get('id');

  const escape = (value) => (value || '').toString().replace(/[&<>"]/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
  ));

  const fail = (message) => {
    root.querySelector('.skel-article')?.remove();
    status.innerHTML = `${escape(message)} — <a href="/" style="color:var(--brand)">العودة إلى الرئيسيّة</a>`;
  };

  if (!type || !id || !SECTIONS[type]) {
    fail('رابطٌ غير مكتمل');
    return;
  }

  const youtubeId = (url) => {
    const match = /(?:youtu\.be\/|watch\?v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/.exec(url || '');
    return match ? match[1] : '';
  };

  const dateLabel = (value) => {
    if (!value) return '';
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    let stamp = typeof value === 'number' ? (value > 1e11 ? value : value * 1000) : Date.parse(value);
    if (Number.isNaN(stamp)) {
      const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(String(value));
      stamp = match ? Date.parse(`${match[3]}-${match[2]}-${match[1]}`) : NaN;
    }
    if (Number.isNaN(stamp)) return String(value);
    const date = new Date(stamp);
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  /* المحتوى يأتي من محرّر الموقع؛ نسمح بالوسوم البنائيّة ونمنع النصوص البرمجيّة. */
  const sanitize = (html) => {
    const holder = document.createElement('div');
    holder.innerHTML = html || '';
    holder.querySelectorAll('script, style, link, object, embed, form').forEach((node) => node.remove());
    holder.querySelectorAll('*').forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || value.startsWith('javascript:')) node.removeAttribute(attr.name);
      });
      if (node.tagName === 'IFRAME') {
        const src = node.getAttribute('src') || '';
        if (!/^https:\/\/(www\.)?(youtube(-nocookie)?\.com|player\.vimeo\.com)\//.test(src)) node.remove();
        else node.setAttribute('loading', 'lazy');
      }
      if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
    });
    return holder.innerHTML;
  };

  (async () => {
    let item = null;
    try {
      const response = await fetch(`${DB}/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`, {
        cache: 'no-store'
      });
      item = await response.json();
    } catch {
      fail('تعذّر الاتّصالُ بالمحتوى');
      return;
    }
    if (!item || typeof item !== 'object') {
      fail('لم نجد هذا المنشور');
      return;
    }

    const [sectionName, sectionUrl, sectionPlural] = SECTIONS[type];
    const title = item.title || 'بدون عنوان';
    const dek = (item.summary || item.description || '').toString();
    const image = item.image || item.imageUrl || item.img || item.photo || '';
    const focus = item.focus && typeof item.focus === 'object'
      ? ` style="object-position:${Number(item.focus.x) || 0}% ${Number(item.focus.y) || 0}%"` : '';
    const video = youtubeId(item.video || item.videoUrl || item.url || item.link || '');
    const body = sanitize(item.content || item.body || item.text || '');
    const when = (item.when || item.time || '').toString().trim();
    const venue = (item.venue || item.hall || item.place || '').toString().trim();
    const role = (item.role || item.affiliation || item.position || '').toString().trim();
    const facts = [role, when, venue].filter(Boolean)
      .map((fact) => `<span class="event__fact">${escape(fact)}</span>`).join('');

    document.title = `${title} | ${SITE_TITLE}`;

    root.innerHTML = `
      <header class="article__head" style="padding-inline:0">
        <div class="article__kicker">
          <a class="kicker" href="${sectionUrl}"><span class="kicker__dot"></span>${escape(sectionName)}</a>
          <span class="tagline-pill">نُشر للتوّ</span>
        </div>
        <h1 class="article__title">${escape(title)}</h1>
        ${dek ? `<p class="article__dek">${escape(dek)}</p>` : ''}
        ${facts ? `<p class="event__facts">${facts}</p>` : ''}
        <div class="article__meta">
          <div class="byline">
            <span class="byline__avatar" aria-hidden="true">د</span>
            <span><b>${escape(SITE_TITLE)}</b><small>${escape(dateLabel(item.date))}</small></span>
          </div>
          <div class="tools">
            <button class="tool" type="button" data-share="${escape(location.pathname + location.search)}"
                    data-share-title="${escape(title)}"><span>مشاركة</span></button>
          </div>
        </div>
      </header>

      ${video
        ? `<div class="embed embed--video" style="margin-bottom:2rem">
             <iframe src="https://www.youtube-nocookie.com/embed/${escape(video)}" title="${escape(title)}"
                     loading="lazy" allowfullscreen></iframe></div>`
        : image
          ? `<figure class="article__hero" style="padding-inline:0">
               <img src="${escape(image)}" alt="${escape(title)}"${focus}></figure>`
          : ''}

      <div class="article__grid" style="padding-inline:0">
        <div class="prose prose--wide">${body || '<p class="prose__empty">لا يتوفّر نصُّ هذا المنشور.</p>'}</div>
      </div>

      <p class="quiz__disclaimer" style="margin-inline:auto">
        هذا المنشورُ معروضٌ مباشرةً من قاعدة التحرير قبل إدراجه في النسخة الثابتة من الموقع.
        <a href="${sectionUrl}" style="color:var(--brand)">تصفّح ${escape(sectionPlural)}</a>
      </p>`;
  })();
})();
