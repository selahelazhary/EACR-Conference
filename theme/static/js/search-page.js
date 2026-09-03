/* ═══ صفحةُ البحث الموسّع ═══════════════════════════════════ */
(() => {
  'use strict';

  const input = document.getElementById('page-search');
  const grid = document.getElementById('page-results');
  const count = document.getElementById('page-count');
  const filters = document.getElementById('page-filters');
  if (!input || !window.EACRSearch) return;

  const { load, search, escape, highlight } = window.EACRSearch;
  let data = null;
  let section = '';

  const cardHTML = (item, query) => `
    <article class="card card--standard">
      <a class="card__media" href="${item.u}" tabindex="-1" aria-hidden="true">
        <div class="thumb" style="--ratio:16/9">
          ${item.i
            ? `<img src="${escape(item.i)}" alt="" loading="lazy">`
            : `<span class="thumb__fallback">${escape(item.t.slice(0, 1))}</span>`}
        </div>
      </a>
      <div class="card__body">
        <span class="kicker"><span class="kicker__dot"></span>${escape(item.n)}</span>
        <h3 class="card__title"><a href="${item.u}">${highlight(escape(item.t), query)}</a></h3>
        <p class="card__dek">${highlight(escape(item.d), query)}</p>
        <div class="card__foot"><p class="meta">${escape(item.p)} · ${item.m} د</p></div>
      </div>
    </article>`;

  const render = () => {
    const query = input.value.trim();
    const found = search(data.items, query, section);
    count.textContent = query || section
      ? `${found.length} نتيجة${query ? ` لـ «${query}»` : ''}`
      : `${data.items.length} منشوراً في الفهرس`;
    grid.innerHTML = found.length
      ? found.slice(0, 60).map((item) => cardHTML(item, query)).join('')
      : '';
    if (!found.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <p class="empty__text">لا نتائج مطابقة</p>
        <p class="empty__hint">جرّب كلمةً أقصر أو أعمّ، أو تصفّح <a href="/archive/">الأرشيف</a>.</p></div>`;
    }
    const url = new URL(location.href);
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  };

  const buildFilters = () => {
    const seen = new Map();
    data.items.forEach((item) => seen.set(item.s, item.n));
    filters.innerHTML = ['<button class="filter is-on" data-section="">كلُّ الأقسام</button>']
      .concat(Array.from(seen, ([id, name]) => `<button class="filter" data-section="${id}">${escape(name)}</button>`))
      .join('');
  };

  filters.addEventListener('click', (event) => {
    const btn = event.target.closest('.filter');
    if (!btn) return;
    section = btn.dataset.section;
    filters.querySelectorAll('.filter').forEach((el) => el.classList.toggle('is-on', el === btn));
    render();
  });

  document.querySelector('[data-clear-search]')?.addEventListener('click', () => {
    input.value = '';
    input.focus();
    render();
  });

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  });

  (async () => {
    count.textContent = 'جارٍ تحميل الفهرس…';
    grid.innerHTML = window.EACR?.skeletonCards(6) || '';
    data = await load();
    buildFilters();
    const initial = new URLSearchParams(location.search).get('q');
    if (initial) input.value = initial;
    render();
  })();
})();
