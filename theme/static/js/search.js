/* ═══ البحثُ الفوريّ ════════════════════════════════════════
   محرّكٌ صغيرٌ يعمل في المتصفّح على /search-index.json،
   يُطبّع العربيّةَ (الهمزات، التاء المربوطة، التشكيل) قبل المطابقة.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

  const normalize = (value) => (value || '')
    .toString()
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىی]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  let indexPromise = null;
  const load = () => {
    if (!indexPromise) {
      indexPromise = fetch('/search-index.json')
        .then((response) => response.json())
        .then((data) => {
          (data.items || []).forEach((item) => {
            item._t = normalize(item.t);
            item._d = normalize(item.d);
            item._b = normalize(item.b);
            item._c = normalize((item.c || []).join(' '));
          });
          return data;
        })
        .catch(() => ({ items: [], topics: [] }));
    }
    return indexPromise;
  };

  /* الترتيب: العنوانُ أثقلُ من الملخّص، والملخّصُ أثقلُ من المتن. */
  const search = (items, query, section) => {
    const terms = normalize(query).split(' ').filter(Boolean);
    let pool = section ? items.filter((item) => item.s === section) : items.slice();
    if (!terms.length) return pool.slice(0, 40);

    const scored = [];
    for (const item of pool) {
      let score = 0;
      let matchedAll = true;
      for (const term of terms) {
        let hit = 0;
        if (item._t.includes(term)) hit += item._t.startsWith(term) ? 12 : 9;
        if (item._c.includes(term)) hit += 5;
        if (item._d.includes(term)) hit += 3;
        if (item._b.includes(term)) hit += 1;
        if (!hit) { matchedAll = false; break; }
        score += hit;
      }
      if (matchedAll) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.item);
  };

  const highlight = (text, query) => {
    const terms = normalize(query).split(' ').filter((term) => term.length > 1);
    if (!terms.length) return text;
    let output = text;
    for (const term of terms) {
      const source = normalize(output);
      const at = source.indexOf(term);
      if (at < 0) continue;
      output = `${output.slice(0, at)}<mark>${output.slice(at, at + term.length)}</mark>${output.slice(at + term.length)}`;
    }
    return output;
  };

  const escape = (value) => (value || '').replace(/[&<>"]/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
  ));

  const hitHTML = (item, query) => `
    <a class="hit" href="${item.u}">
      ${item.i ? `<img class="hit__thumb" src="${escape(item.i)}" alt="" loading="lazy">` : ''}
      <span class="hit__body">
        <span class="hit__title">${highlight(escape(item.t), query)}</span>
        <span class="hit__meta">${escape(item.n)} · ${escape(item.p)} · ${item.m} د</span>
      </span>
    </a>`;

  window.EACRSearch = { normalize, load, search, highlight, hitHTML, escape };

  /* ─── نافذةُ البحث السريع ───────────────────────────── */
  const finder = document.getElementById('finder');
  if (!finder) return;

  const input = document.getElementById('finder-input');
  const results = document.getElementById('finder-results');
  const filters = document.getElementById('finder-filters');
  let data = null;
  let section = '';
  let cursor = -1;

  const render = () => {
    if (!data) return;
    const found = search(data.items, input.value, section);
    cursor = -1;
    if (!found.length) {
      results.innerHTML = `<p class="empty__hint" style="padding:2rem;text-align:center">
        لا نتائج${input.value ? ` لـ «${escape(input.value)}»` : ''}. جرّب كلمةً أعمّ.</p>`;
      return;
    }
    results.innerHTML = found.slice(0, 24).map((item) => hitHTML(item, input.value)).join('');
  };

  const buildFilters = () => {
    const sections = [];
    const seen = new Set();
    data.items.forEach((item) => {
      if (seen.has(item.s)) return;
      seen.add(item.s);
      sections.push({ id: item.s, name: item.n });
    });
    filters.innerHTML = [`<button class="filter is-on" data-section="">الكلّ</button>`]
      .concat(sections.map((entry) => `<button class="filter" data-section="${entry.id}">${escape(entry.name)}</button>`))
      .join('');
  };

  filters.addEventListener('click', (event) => {
    const btn = event.target.closest('.filter');
    if (!btn) return;
    section = btn.dataset.section;
    filters.querySelectorAll('.filter').forEach((el) => el.classList.toggle('is-on', el === btn));
    render();
  });

  const open = async () => {
    finder.hidden = false;
    document.body.style.overflow = 'hidden';
    input.focus();
    if (!data) {
      results.innerHTML = window.EACR?.skeletonRows(5) || '';
      data = await load();
      buildFilters();
    }
    render();
  };

  const close = () => {
    finder.hidden = true;
    document.body.style.overflow = '';
  };

  document.querySelectorAll('[data-search-open]').forEach((btn) => btn.addEventListener('click', open));
  document.querySelectorAll('[data-search-close]').forEach((btn) => btn.addEventListener('click', close));
  document.addEventListener('eacr:search-open', open);

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 110);
  });

  finder.addEventListener('keydown', (event) => {
    const hits = Array.from(results.querySelectorAll('.hit'));
    if (event.key === 'Escape') { close(); return; }
    if (!hits.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      cursor = event.key === 'ArrowDown'
        ? Math.min(cursor + 1, hits.length - 1)
        : Math.max(cursor - 1, 0);
      hits.forEach((hit, index) => hit.classList.toggle('is-active', index === cursor));
      hits[cursor].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && cursor > -1) {
      event.preventDefault();
      location.href = hits[cursor].getAttribute('href');
    }
  });
})();
