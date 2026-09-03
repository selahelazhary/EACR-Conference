/* ═══ الجلد: تصميمُ الموقع وتنسيقُه على كلِّ صفحة ══════════════
   الصفحةُ المبنيّةُ تحمل تصميمَها في رأسها. لكنّ المحرّرَ إن بدّل
   التصميمَ أو التنسيقَ من اللوحة، فما كان لِتغييرِه أن ينتظر البناءَ
   التالي: هذا الملفُّ يقرأ ما في القاعدة، ويُلبس الموقعَ كلَّه جلدَه
   الجديد — لا لوحةَ التحرير وحدَها.

   ولا اشتقاقَ هنا: الألوانُ محسوبةٌ سلفاً في /assets/skins/*.css،
   فلا يفعل هذا الملفُّ إلّا أن يصل رابطاً ويكتب سمةً على الجذر.
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const BUILT = window.EACR_SKIN || {};
  const DB = (window.EACR_DB || '').replace(/\/$/, '');
  const KEY = 'eacr:skin';
  const CHECKED = 'eacr:skin:at';
  const EVERY = 5 * 60 * 1000;     // لا نسأل القاعدةَ أكثرَ من مرّةٍ كلَّ خمس دقائق
  const KEYS = ['theme', 'layout', 'brand', 'spark', 'radius'];
  const ATTRS = ['data-layout', 'data-masthead', 'data-hero', 'data-cards'];

  const root = document.documentElement;
  const clean = (value) => String(value || '').replace(/[^a-z0-9-]/gi, '');
  const color = (value) => (/^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : '');

  const same = (a, b) => KEYS.every((key) => String(a[key] || '') === String(b[key] || ''));

  const read = (store, key) => {
    try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; }
  };
  const save = (store, key, value) => {
    try { store.setItem(key, JSON.stringify(value)); } catch { /* حصّةُ التخزين ممتلئة */ }
  };

  /* ─── وصلُ ورقةٍ أو نزعُها ─── */
  function sheet(id, href) {
    let node = document.getElementById(id);
    if (!href) { if (node) node.remove(); return; }
    if (node && node.getAttribute('href') === href) return;
    if (!node) {
      node = document.createElement('link');
      node.id = id;
      node.rel = 'stylesheet';
      document.head.appendChild(node);
    }
    node.setAttribute('href', href);
  }

  function inline(id, css) {
    let node = document.getElementById(id);
    if (!css) { if (node) node.remove(); return; }
    if (!node) {
      node = document.createElement('style');
      node.id = id;
      document.head.appendChild(node);
    }
    if (node.textContent !== css) node.textContent = css;
  }

  /* لمساتُ المحرّر تتقدّم على التصميم في الوضعين معاً */
  function tune(skin) {
    const rules = [];
    const brand = color(skin.brand);
    const spark = color(skin.spark);
    if (brand) rules.push(`--brand: ${brand};`, `--brand-ink: ${ink(brand)};`);
    if (spark) rules.push(`--spark: ${spark};`);
    const radius = {
      soft: ['8px', '14px', '22px'],
      sharp: ['3px', '5px', '8px'],
      round: ['12px', '20px', '34px'],
      pill: ['14px', '24px', '42px']
    }[clean(skin.radius)];
    if (radius) rules.push(`--r-sm: ${radius[0]};`, `--r-md: ${radius[1]};`, `--r-lg: ${radius[2]};`);
    return rules.length ? `:root, :root[data-theme] {\n  ${rules.join('\n  ')}\n}` : '';
  }

  /* أبيضُ أم أسود يُقرأ فوق هذا اللون — كما يحسبها المولّد */
  function ink(hex) {
    let text = hex.replace('#', '');
    if (text.length === 3) text = text.split('').map((ch) => ch + ch).join('');
    const channel = (value) => {
      const c = parseInt(value, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const light = 0.2126 * channel(text.slice(0, 2))
                + 0.7152 * channel(text.slice(2, 4))
                + 0.0722 * channel(text.slice(4, 6));
    return light < 0.42 ? '#FFFFFF' : '#12111A';
  }

  function dress(skin) {
    if (!skin || same(skin, BUILT)) {
      sheet('skin-theme', '');
      sheet('skin-layout', '');
      inline('skin-tune', '');
      if (BUILT.attrs) Object.entries(BUILT.attrs).forEach(([name, value]) => root.setAttribute(name, value));
      return;
    }
    const theme = clean(skin.theme);
    const layout = clean(skin.layout);
    if (theme) sheet('skin-theme', `/assets/skins/${theme}.css`);
    if (layout) sheet('skin-layout', `/assets/skins/layout-${layout}.css`);
    inline('skin-tune', tune(skin));
    const attrs = skin.attrs && typeof skin.attrs === 'object' ? skin.attrs : null;
    if (attrs) {
      ATTRS.forEach((name) => { if (attrs[name]) root.setAttribute(name, attrs[name]); });
    } else if (layout) {
      root.setAttribute('data-layout', layout);
    }
  }

  /* ─── ما حُفظ في الجهاز يُطبَّق قبل الرسم فلا يومض الجلدُ القديم ───
     إلّا أن يكون الموقعُ قد بُني بجلدٍ آخر بعد ذلك الحفظ: فالبناءُ
     أحدثُ من الذاكرة، ولا يُعقل أن يُلبس القارئُ جلداً أُلغي. */
  const SIGN = KEYS.map((key) => BUILT[key] || '').join('|');
  let cached = read(localStorage, KEY);
  if (cached && cached.__built !== SIGN) {
    cached = null;
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(CHECKED); } catch { /* لا مخزن */ }
  }
  if (cached) dress(cached);

  /* ─── ثمّ نسأل القاعدةَ: هل تغيّر شيء؟ ─── */
  async function refresh() {
    if (!DB) return;
    try {
      const response = await fetch(`${DB}/site_config/appearance.json`, { cache: 'no-store' });
      if (!response.ok) return;
      const live = (await response.json()) || {};
      const next = {
        theme: clean(live.theme) || BUILT.theme || '',
        layout: clean(live.layout) || BUILT.layout || '',
        brand: color(live.brand),
        spark: color(live.spark),
        radius: clean(live.radius)
      };
      save(sessionStorage, CHECKED, Date.now());
      if (cached && same(next, cached) && next.layout === (cached.layout || '')) return;

      if (next.layout && next.layout !== (cached && cached.layout)) {
        try {
          const map = await (await fetch('/themes.json', { cache: 'force-cache' })).json();
          const found = (map.layouts || []).find((row) => row.id === next.layout);
          if (found) next.attrs = found.attrs;
        } catch { /* التنسيقُ يُطبَّق بمتغيّراته ولو غابت سماتُه */ }
      } else if (cached && cached.attrs && next.layout === cached.layout) {
        next.attrs = cached.attrs;
      }

      next.__built = SIGN;
      save(localStorage, KEY, next);
      dress(next);
    } catch { /* لا شبكة: يبقى المبنيُّ أو المحفوظ */ }
  }

  const last = Number(read(sessionStorage, CHECKED) || 0);
  if (Date.now() - last > EVERY) {
    if (document.readyState === 'complete') refresh();
    else window.addEventListener('load', () => setTimeout(refresh, 400), { once: true });
  }

  /* اللوحةُ تنادي هذا حين تحفظ، فيتبدّل الجلدُ في اللسان المفتوح */
  window.EACR_SKIN_APPLY = (skin) => {
    save(localStorage, KEY, { ...skin, __built: SIGN });
    dress(skin);
  };
})();
