/* ═══ الإعلانات ══════════════════════════════════════════════
   القالبُ يترك صندوقاً فارغاً؛ هنا يُبنى وسمُ أدسنس ويُطلب الإعلان
   حين يقترب الصندوقُ من الشاشة لا قبلَ ذلك — فلا يتأخّر تحميلُ
   الصفحة، ولا يُحسَب على الموقع ظهورٌ لم يره أحد.
   وإن لم يأتِ إعلانٌ طُوي الصندوق فلا يبقى فراغٌ في التصميم.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const CFG = window.EACR_ADS;
  if (!CFG) return;

  const FORMATS = {
    band:  { format: 'auto', responsive: 'true' },
    flow:  { layout: 'in-article', format: 'fluid' },
    side:  { format: 'auto', responsive: 'true' },
    cell:  { format: 'auto', responsive: 'true' },
    panel: { format: 'auto', responsive: 'true' }
  };

  const variantOf = (node) => {
    const found = Array.from(node.classList).find((name) => name.startsWith('ad--'));
    return found ? found.slice(4) : 'band';
  };

  /* ─── وضعُ المعاينة: صندوقٌ مرقّمٌ يُري صاحبَ الموقع مواضعَه ─── */
  const preview = (node, place) => {
    node.classList.add('ad--test');
    node.insertAdjacentHTML('beforeend', `
      <span class="ad__test-name">${place}</span>
      <span class="ad__test-note">موضعُ إعلان — لن يظهر للقرّاء حتّى تُطفأ المعاينة</span>`);
    node.dataset.adState = 'preview';
  };

  /* ─── الوحدةُ الحقيقيّة ─────────────────────────────────── */
  const mount = (node, place) => {
    const slot = CFG.slots[place];
    if (!slot) { node.remove(); return; }

    const variant = variantOf(node);
    const spec = FORMATS[variant] || FORMATS.band;
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = CFG.client;
    ins.dataset.adSlot = slot;
    if (spec.layout) ins.dataset.adLayout = spec.layout;
    if (spec.format) ins.dataset.adFormat = spec.format;
    if (spec.responsive) ins.dataset.fullWidthResponsive = spec.responsive;

    node.appendChild(ins);
    node.dataset.adState = 'requested';

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      node.dataset.adState = 'error';
      node.classList.add('is-collapsed');
      return;
    }

    /* أدسنس يضع data-ad-status="unfilled" حين لا يجد ما يعرضه */
    let tries = 0;
    const watch = setInterval(() => {
      const status = ins.dataset.adStatus;
      if (status === 'filled') {
        node.dataset.adState = 'filled';
        node.classList.add('is-filled');
        clearInterval(watch);
      } else if (status === 'unfilled' || ++tries > 20) {
        node.dataset.adState = 'unfilled';
        node.classList.add('is-collapsed');
        clearInterval(watch);
      }
    }, 500);
  };

  const label = (node) => {
    if (node.dataset.adBare === '1' || node.querySelector('.ad__label')) return;
    const tag = document.createElement('span');
    tag.className = 'ad__label';
    tag.textContent = CFG.label || 'إعلان';
    node.prepend(tag);
  };

  const activate = (node) => {
    if (node.dataset.adState) return;
    const place = node.dataset.ad;
    if (!place) return;
    label(node);
    if (CFG.test || !CFG.live) preview(node, place);
    else mount(node, place);
  };

  /* ─── لا نطلب إلّا ما اقترب من الشاشة ───────────────────── */
  const slots = () => Array.from(document.querySelectorAll('[data-ad]:not([data-ad-state])'));

  const start = () => {
    const pending = slots();
    if (!pending.length) return;

    if (!('IntersectionObserver' in window)) {
      pending.forEach(activate);
      return;
    }
    const watcher = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        activate(entry.target);
      });
    }, { rootMargin: `${CFG.margin || 400}px 0px` });
    pending.forEach((node) => watcher.observe(node));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  /* البطاقاتُ التي تضيفها الطبقةُ الحيّة قد تحمل مواضعَ جديدة */
  window.EACR_ADS.rescan = start;
})();
