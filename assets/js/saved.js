/* ═══ صفحةُ قائمة القراءة ═══════════════════════════════════ */
(() => {
  'use strict';

  const grid = document.getElementById('saved-list');
  const count = document.getElementById('saved-count');
  if (!grid || !window.EACR) return;

  const { getSaved, setSaved, toast } = window.EACR;
  const escape = (value) => (value || '').replace(/[&<>"]/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
  ));

  const cardHTML = (entry) => `
    <article class="card card--standard">
      <a class="card__media" href="${entry.url}" tabindex="-1" aria-hidden="true">
        <div class="thumb" style="--ratio:16/9">
          ${entry.image
            ? `<img src="${escape(entry.image)}" alt="" loading="lazy">`
            : `<span class="thumb__fallback">${escape((entry.title || '؟').slice(0, 1))}</span>`}
        </div>
      </a>
      <div class="card__body">
        <span class="kicker"><span class="kicker__dot"></span>${escape(entry.section)}</span>
        <h3 class="card__title"><a href="${entry.url}">${escape(entry.title)}</a></h3>
        <div class="card__foot">
          <p class="meta">${escape(entry.date)}</p>
          <button class="save is-on" type="button" data-remove="${escape(entry.url)}" aria-label="إزالة من القائمة">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </article>`;

  const render = () => {
    const list = getSaved();
    count.textContent = list.length ? `${list.length} مادّةً محفوظة` : '';
    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : `<div class="empty" style="grid-column:1/-1">
           <p class="empty__text">قائمتُك فارغة</p>
           <p class="empty__hint">اضغط علامةَ الحفظ على أيّ مادّةٍ لتظهر هنا. تُحفظ في متصفّحك وحده.</p>
         </div>`;
  };

  grid.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove]');
    if (!btn) return;
    event.preventDefault();
    setSaved(getSaved().filter((entry) => entry.url !== btn.dataset.remove));
    render();
    toast('أُزيلت من القائمة');
  });

  document.querySelector('[data-clear-saved]')?.addEventListener('click', () => {
    if (!getSaved().length) return;
    setSaved([]);
    render();
    toast('أُفرغت القائمة');
  });

  render();
})();
