/* ═══ لوحةُ إدارة مؤتمر EACR ═══════════════════════════════
   لوحةٌ واحدةٌ يُدار منها الموقع: دخولٌ ببريدٍ وكلمة مرور،
   ومحرّرٌ يرفع الصورَ بدل أن يلصقها في النصّ، وقائمةُ موادَّ
   قابلةٌ للبحث والتصفية والعمل الجماعي، ولوحةُ قيادةٍ تقول لك
   بالضبط: هل يحتاج الموقعُ إعادةَ بناءٍ أم لا.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const CFG = window.ADMIN;

  /* الأقسامُ ليست ثابتةً في البناء: ما في site.yml قيمةٌ افتراضيّة،
     وما تكتبه هذه اللوحةُ في site_config/sections يتقدّم عليها —
     فالقسمُ الذي يُنشئه المحرّرُ يعمل قبل أن يُعاد بناءُ الموقع. */
  const DISPLAYS = [
    ['standard', 'بطاقاتٌ عاديّة', 'صورةٌ وعنوانٌ وملخّص — يصلح للأخبار'],
    ['agenda', 'برنامجٌ ومواعيد', 'لوحُ تاريخٍ وموعدٌ ومكان — يصلح للفعاليّات'],
    ['people', 'أشخاص', 'صورةٌ دائريّةٌ واسمٌ وصفة — يصلح للمتحدّثين'],
    ['video', 'فيديو', 'علامةُ تشغيلٍ فوق الصورة'],
    ['gallery', 'معرضُ صور', 'بلاطاتٌ متجاورةٌ تُفتح بحجمٍ كامل']
  ];
  const DISPLAY_NAMES = Object.fromEntries(DISPLAYS.map(([id, name]) => [id, name]));

  let SECTIONS = (CFG.sections || []).slice();
  let SECTION_IDS = SECTIONS.map((s) => s.id);
  let byId = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

  function setSections(list) {
    const clean = (Array.isArray(list) ? list : [])
      .filter((s) => s && String(s.id || '').trim())
      .map((s) => ({
        id: String(s.id).trim(),
        name: String(s.name || s.id).trim(),
        plural: String(s.plural || s.name || s.id).trim(),
        single: String(s.single || '').trim(),
        slug: String(s.slug || s.id).trim(),
        accent: String(s.accent || '#C2185B'),
        icon: String(s.icon || 'newspaper'),
        display: DISPLAY_NAMES[s.display] ? s.display : 'standard',
        description: String(s.description || '').trim()
      }));
    if (!clean.length) return false;
    SECTIONS = clean;
    SECTION_IDS = SECTIONS.map((s) => s.id);
    byId = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
    paintSideSections();
    return true;
  }

  /* قائمةُ الأقسام في الشريط الجانبيّ تُرسَم هنا لا في القالب،
     لأنّها تتغيّر بتغيّر القاعدة بلا إعادةِ بناء. */
  function paintSideSections() {
    const host = document.getElementById('side-sections');
    if (!host) return;
    host.innerHTML = SECTIONS.map((s) => `
      <a class="side__link side__link--sm" href="#/content/${encodeURIComponent(s.id)}"
         data-view="content" data-section="${esc(s.id)}">
        <span class="side__dot" style="--accent: ${esc(s.accent)}"></span>
        <span>${esc(s.plural)}</span>
        <em class="side__count" data-count="${esc(s.id)}">0</em>
      </a>`).join('');
    countsPaint();
  }

  /* ─── أدواتٌ صغيرة ──────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const plain = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const words = (html) => { const t = plain(html); return t ? t.split(/\s+/).length : 0; };

  const store = {
    read(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ممتلئ */ } },
    drop(k) { try { localStorage.removeItem(k); } catch { /* لا شيء */ } }
  };

  const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                     'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const toStamp = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1e11 ? value : value * 1000;
    const iso = Date.parse(value);
    if (!Number.isNaN(iso)) return iso;
    const text = String(value).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const arabic = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(text.trim());
    if (arabic) {
      const month = AR_MONTHS.findIndex((m) => arabic[2].startsWith(m.slice(0, 4)));
      if (month > -1) return Date.UTC(+arabic[3], month, +arabic[1]);
    }
    const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(text);
    return dmy ? Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]) : 0;
  };

  const isoOf = (stamp) => new Date(stamp || Date.now()).toISOString().slice(0, 10);
  const arabicOf = (stamp) => {
    const d = new Date(stamp || Date.now());
    return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  const shortDate = (stamp) => (stamp ? arabicOf(stamp) : '—');
  const ago = (stamp) => {
    if (!stamp) return '—';
    const diff = Date.now() - stamp;
    const day = 86400000;
    if (diff < 3600000) return 'منذ دقائق';
    if (diff < day) return `منذ ${Math.round(diff / 3600000)} ساعة`;
    if (diff < 30 * day) return `منذ ${Math.round(diff / day)} يوماً`;
    return shortDate(stamp);
  };

  /* ─── تنبيهاتٌ ونوافذُ تأكيد ─────────────────────────── */
  const toasts = $('#toasts');
  function toast(message, kind = '', action) {
    const node = document.createElement('div');
    node.className = `toast${kind ? ` toast--${kind}` : ''}`;
    node.innerHTML = `<span>${esc(message)}</span>`;
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.addEventListener('click', () => { action.run(); node.remove(); });
      node.appendChild(button);
    }
    toasts.appendChild(node);
    setTimeout(() => node.remove(), action ? 8000 : 3400);
  }

  const modal = $('#modal');
  function confirmBox(title, text, okLabel = 'تأكيد') {
    return new Promise((resolve) => {
      $('#modal-title').textContent = title;
      $('#modal-text').textContent = text;
      const ok = $('[data-modal-ok]', modal);
      ok.textContent = okLabel;
      modal.hidden = false;
      const done = (value) => {
        modal.hidden = true;
        ok.removeEventListener('click', yes);
        $$('[data-modal-cancel]', modal).forEach((b) => b.removeEventListener('click', no));
        resolve(value);
      };
      const yes = () => done(true);
      const no = () => done(false);
      ok.addEventListener('click', yes);
      $$('[data-modal-cancel]', modal).forEach((b) => b.addEventListener('click', no));
    });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) $('[data-modal-cancel]', modal).click(); });

  /* ─── Firebase ──────────────────────────────────────── */
  firebase.initializeApp(CFG.firebase);
  const auth = firebase.auth();
  const db = firebase.database();

  const AUTH_ERRORS = {
    'auth/invalid-email': 'البريدُ الإلكترونيُّ غيرُ صحيح.',
    'auth/user-disabled': 'هذا الحسابُ موقوف.',
    'auth/user-not-found': 'لا يوجد حسابٌ بهذا البريد.',
    'auth/wrong-password': 'كلمةُ المرور غيرُ صحيحة.',
    'auth/invalid-credential': 'البريدُ أو كلمةُ المرور غيرُ صحيحة.',
    'auth/too-many-requests': 'محاولاتٌ كثيرةٌ متتابعة — انتظر قليلاً ثمّ أعد المحاولة.',
    'auth/network-request-failed': 'تعذّر الاتّصالُ بالشبكة.',
    'auth/operation-not-allowed': 'الدخولُ بالبريد وكلمة المرور غيرُ مفعّلٍ في مشروع Firebase.',
    'auth/missing-password': 'اكتب كلمةَ المرور.',
    'auth/unauthorized-domain': 'هذا النطاقُ غيرُ مأذونٍ في Firebase. '
      + 'أضِف نطاقَ الموقع من: Authentication ← Settings ← Authorized domains.',
    'auth/invalid-api-key': 'مفتاحُ المشروع في site.yml لا يطابق مشروعَ Firebase.',
    'auth/internal-error': 'خطأٌ من Firebase — تأكّد أنّ الدخولَ بالبريد مفعَّل.'
  };

  /* ─── الحالة ────────────────────────────────────────── */
  const S = {
    user: null,
    items: [],
    cats: {},
    sponsors: [],
    sponsorCount: 0,
    texts: {},
    builtAt: 0,
    engage: {},
    comments: [],
    commentsFilter: 'all',
    designTab: 'identity',
    filter: { section: '', q: '', cat: '', sort: 'date-desc', page: 1, per: 20 },
    selected: new Set(),
    editing: null,
    editor: null,
    focus: { x: 50, y: 50 },
    quill: null,
    dirty: false,
    loaded: false
  };

  /* ─── طبقةُ البيانات ────────────────────────────────── */
  function normalize(type, id, raw) {
    const stamp = toStamp(raw.timestamp || raw.date || raw.createdAt);
    const content = raw.content || raw.body || '';
    return {
      type, id,
      title: String(raw.title || '').trim(),
      summary: plain(raw.summary || raw.description || '').slice(0, 300),
      image: raw.image || raw.imageUrl || '',
      video: raw.videoUrl || raw.video || '',
      cats: Array.isArray(raw.categories) ? raw.categories.map(String) : [],
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      author: raw.author || '',
      featured: !!raw.featured,
      date: raw.date || '',
      stamp: stamp || 0,
      words: words(content),
      heavy: /data:image\//i.test(content) || String(raw.image || raw.imageUrl || '').startsWith('data:')
    };
  }

  /* أرقامُ التفاعل والتعليقات تُقرأ من العُقد العامّة نفسِها */
  async function loadEngagement() {
    const [engage, comments] = await Promise.all([
      db.ref('engagement').once('value').then((s) => s.val() || {}).catch(() => ({})),
      db.ref('comments').once('value').then((s) => s.val() || {}).catch(() => ({}))
    ]);
    S.engage = engage;
    S.comments = [];
    for (const [type, items] of Object.entries(comments)) {
      for (const [item, rows] of Object.entries(items || {})) {
        for (const [id, row] of Object.entries(rows || {})) {
          if (row && row.body) S.comments.push({ id, type, item, ...row });
        }
      }
    }
    S.comments.sort((a, b) => (b.at || 0) - (a.at || 0));
  }

  const statOf = (item) => (S.engage?.[item.type]?.[item.id]) || {};

  async function loadAll() {
    const jobs = SECTION_IDS.map(async (type) => {
      const snap = await db.ref(type).once('value');
      const node = snap.val() || {};
      return Object.entries(node)
        .filter(([, raw]) => raw && typeof raw === 'object' && raw.title)
        .map(([id, raw]) => normalize(type, id, raw));
    });
    const groups = await Promise.all(jobs);
    S.items = groups.flat().sort((a, b) => b.stamp - a.stamp);

    const cats = await db.ref('categories').once('value');
    S.cats = cats.val() || {};

    await loadEngagement();

    try {
      const pulse = await (await fetch('/news-latest.json', { cache: 'no-store' })).json();
      S.builtAt = Date.parse(pulse.generated) || 0;
    } catch { S.builtAt = 0; }

    S.loaded = true;
  }

  const catName = (id) => (S.cats[id] && (S.cats[id].name || S.cats[id])) || id;

  /* ─── رفعُ الصور ────────────────────────────────────── */
  async function uploadImage(fileOrBlob) {
    const form = new FormData();
    form.append('image', fileOrBlob);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${CFG.imgbbKey}`, {
      method: 'POST', body: form
    });
    const data = await response.json();
    if (!data.success) throw new Error('تعذّر رفعُ الصورة');
    return data.data.url;
  }

  const dataUriToBlob = (uri) => {
    const [head, payload] = uri.split(',');
    const mime = (/data:([^;]+)/.exec(head) || [, 'image/png'])[1];
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  /* ─── الهيكلُ والتوجيه ──────────────────────────────── */
  const view = $('#view');
  const routes = {};
  const setActive = (name, section) => {
    $$('.side__link').forEach((link) => {
      const same = link.dataset.view === name
        && (link.dataset.section || '') === (section || '');
      link.classList.toggle('is-active', same);
    });
  };

  function go(hash) { window.location.hash = hash; }

  function render() {
    const raw = (window.location.hash || '#/dashboard').slice(2);
    const [name, arg] = raw.split('/');
    const handler = routes[name] || routes.dashboard;
    view.scrollTop = 0;
    handler(arg);
    $('#side')?.classList.remove('is-open');
  }
  window.addEventListener('hashchange', () => {
    if (S.dirty && S.editing) {
      /* لا نفقد ما كُتب: نُبقي المسودّة محفوظةً ونمضي */
      saveDraft();
    }
    render();
  });

  /* ═══════════ لوحةُ القيادة ═══════════════════════════ */
  routes.dashboard = () => {
    setActive('dashboard');
    const total = S.items.length;
    const pending = S.builtAt ? S.items.filter((i) => i.stamp > S.builtAt).length : 0;
    const heavy = S.items.filter((i) => i.heavy).length;
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const thisMonth = S.items.filter((i) => i.stamp >= month.getTime()).length;
    const noImage = S.items.filter((i) => !i.image && i.type !== 'videos').length;
    const noSummary = S.items.filter((i) => !i.summary).length;

    const perSection = SECTIONS.map((section) => {
      const list = S.items.filter((i) => i.type === section.id);
      return `<a class="card stat stat--accent" style="--accent:${esc(section.accent)}" href="#/content/${section.id}">
        <span class="stat__label">${esc(section.plural)}</span>
        <span class="stat__value">${list.length}</span>
        <span class="stat__note">${list[0] ? `آخرُها ${esc(ago(list[0].stamp))}` : 'لا مواد بعد'}</span>
      </a>`;
    }).join('');

    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>لوحةُ القيادة</h1>
          <p>حالةُ المنصّة في لمحة — أهلاً ${esc((S.user.email || '').split('@')[0])}.</p>
        </div>
        <div class="page-acts">
          <a class="btn btn--brand" href="#/compose">＋ مادّةٌ جديدة</a>
          <a class="btn btn--ghost" href="/" target="_blank" rel="noopener">فتحُ الموقع ↗</a>
        </div>
      </div>

      ${pending ? `
      <div class="banner banner--warn">
        <div class="banner__body">
          <strong>${pending} مادّةً منشورةً لم تدخل البناءَ بعد</strong>
          <span>الموقعُ الثابتُ يعرضها في «الطبقة الحيّة»، لكنّ محرّكات البحث لن تراها حتّى تُبنى الصفحات. شغّل الأمر ثمّ ادفع التغيير إلى GitHub:</span>
          <code>python build.py --sync</code>
        </div>
      </div>` : (S.builtAt ? `
      <div class="banner banner--ok">
        <div class="banner__body">
          <strong>الموقعُ محدَّث</strong>
          <span>آخرُ بناءٍ ${esc(ago(S.builtAt))} — وكلُّ مادّةٍ منشورةٍ لها صفحةٌ مفهرسة.</span>
        </div>
      </div>` : '')}

      ${heavy ? `
      <div class="banner banner--warn">
        <div class="banner__body">
          <strong>${heavy} مادّةً تحمل صوراً مضمّنةً داخل النصّ</strong>
          <span>الصورةُ الملصوقةُ بترميز base64 تُثقل الصفحةَ والخلاصةَ عشرةَ أضعاف. أداةُ التنظيف ترفعها صوراً حقيقيّةً وتستبدل الرابط.</span>
        </div>
        <a class="btn btn--ghost" href="#/settings">أداةُ التنظيف ←</a>
      </div>` : ''}

      <div class="grid grid--stats" style="margin-block-end:1rem">
        <div class="card stat"><span class="stat__label">كلُّ المواد</span><span class="stat__value">${total}</span><span class="stat__note">في سبعة أقسام</span></div>
        <div class="card stat"><span class="stat__label">هذا الشهر</span><span class="stat__value">${thisMonth}</span><span class="stat__note">مادّةً منشورة</span></div>
        <div class="card stat"><span class="stat__label">الموضوعات</span><span class="stat__value">${Object.keys(S.cats).length}</span><span class="stat__note">تصنيفاً</span></div>
        <div class="card stat"><span class="stat__label">مختارات</span><span class="stat__value">${S.items.filter((i) => i.featured).length}</span><span class="stat__note">مادّةً مميّزة</span></div>
      </div>

      <div class="grid grid--stats" style="margin-block-end:1rem">${perSection}</div>

      <div class="grid grid--2">
        <div class="card">
          <div class="card__head"><h2>آخرُ ما نُشر</h2><a class="btn btn--ghost btn--sm" href="#/content">الكلّ</a></div>
          <div class="mini">
            ${S.items.slice(0, 8).map((item) => `
              <div class="mini__row">
                <span class="tag" style="--accent:${esc(byId[item.type]?.accent || '#666')}">${esc(byId[item.type]?.name || item.type)}</span>
                <span class="row-title" style="max-width:34ch">${esc(item.title)}</span>
                <span class="spacer"></span>
                <span class="row-sub">${esc(ago(item.stamp))}</span>
                <a class="btn btn--ghost btn--sm" href="#/compose/${item.type}:${item.id}">تحرير</a>
              </div>`).join('') || '<p class="empty">لا مواد بعد.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card__head"><h2>ما يستحقّ الانتباه</h2></div>
          <ul class="checklist">
            <li class="${noImage ? '' : 'is-done'}">${noImage ? `${noImage} مادّةً بلا صورةِ غلاف — الصورةُ تضاعف النقر في نتائج البحث والمشاركة.` : 'كلُّ المواد لها صورةُ غلاف.'}</li>
            <li class="${noSummary ? '' : 'is-done'}">${noSummary ? `${noSummary} مادّةً بلا ملخّص — الملخّصُ هو ما يظهر تحت العنوان في جوجل.` : 'كلُّ المواد لها ملخّص.'}</li>
            <li class="${Object.keys(S.cats).length ? 'is-done' : ''}">${Object.keys(S.cats).length ? 'الموضوعاتُ مضبوطة.' : 'لم تُضَف موضوعاتٌ بعد — الموضوعُ يبني صفحةً تجمع المواد المتشابهة.'}</li>
            <li class="${S.sponsorCount ? 'is-done' : ''}">${S.sponsorCount
              ? `${S.sponsorCount} داعماً في القائمة.`
              : 'لم يُضَف داعمون بعد — أضِفهم من «الداعمون» ليظهروا في الرئيسيّة.'}</li>
          </ul>
          <div class="card__head" style="margin-block:1.2rem .6rem"><h2>اختصارات</h2></div>
          <ul class="checklist">
            <li class="is-done"><span class="kbd">/</span> البحثُ في كلّ المواد</li>
            <li class="is-done"><span class="kbd">Ctrl</span> + <span class="kbd">S</span> حفظُ المادّة في المحرّر</li>
            <li class="is-done"><span class="kbd">Esc</span> إغلاقُ النوافذ</li>
          </ul>
        </div>
      </div>`;
  };

  /* ═══════════ قائمةُ المواد ═══════════════════════════ */
  routes.content = (section) => {
    S.filter.section = section || '';
    setActive('content', S.filter.section);
    drawContent();
  };

  function filtered() {
    const { section, q, cat, sort } = S.filter;
    const needle = q.trim().toLowerCase();
    let list = S.items.filter((item) => {
      if (section && item.type !== section) return false;
      if (cat && !item.cats.includes(cat)) return false;
      if (cat === '__none' && item.cats.length) return false;
      if (needle) {
        const hay = `${item.title} ${item.summary} ${item.author}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorters = {
      'date-desc': (a, b) => b.stamp - a.stamp,
      'date-asc': (a, b) => a.stamp - b.stamp,
      'title': (a, b) => a.title.localeCompare(b.title, 'ar'),
      'words-desc': (a, b) => b.words - a.words
    };
    list = list.slice().sort(sorters[sort] || sorters['date-desc']);
    return list;
  }

  function drawContent() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / S.filter.per));
    S.filter.page = Math.min(S.filter.page, pages);
    const start = (S.filter.page - 1) * S.filter.per;
    const page = list.slice(start, start + S.filter.per);
    const section = S.filter.section ? byId[S.filter.section] : null;

    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>${section ? esc(section.plural) : 'كلُّ المواد'}</h1>
          <p>${list.length} مادّةً${S.filter.q ? ` تطابق «${esc(S.filter.q)}»` : ''}</p>
        </div>
        <div class="page-acts">
          <a class="btn btn--brand" href="#/compose${section ? `/${section.id}` : ''}">＋ مادّةٌ جديدة</a>
        </div>
      </div>

      <div class="filters">
        <select id="f-section">
          <option value="">كلُّ الأقسام</option>
          ${SECTIONS.map((s) => `<option value="${s.id}"${s.id === S.filter.section ? ' selected' : ''}>${esc(s.plural)}</option>`).join('')}
        </select>
        <select id="f-cat">
          <option value="">كلُّ الموضوعات</option>
          <option value="__none"${S.filter.cat === '__none' ? ' selected' : ''}>بلا موضوع</option>
          ${Object.keys(S.cats).map((id) => `<option value="${esc(id)}"${id === S.filter.cat ? ' selected' : ''}>${esc(catName(id))}</option>`).join('')}
        </select>
        <select id="f-sort">
          <option value="date-desc"${S.filter.sort === 'date-desc' ? ' selected' : ''}>الأحدثُ أوّلاً</option>
          <option value="date-asc"${S.filter.sort === 'date-asc' ? ' selected' : ''}>الأقدمُ أوّلاً</option>
          <option value="title"${S.filter.sort === 'title' ? ' selected' : ''}>أبجديّاً</option>
          <option value="words-desc"${S.filter.sort === 'words-desc' ? ' selected' : ''}>الأطولُ نصّاً</option>
        </select>
        <span class="spacer"></span>
        <select id="f-per">
          ${[20, 50, 100].map((n) => `<option value="${n}"${n === S.filter.per ? ' selected' : ''}>${n} في الصفحة</option>`).join('')}
        </select>
      </div>

      <div id="bulk"></div>

      <div class="tablewrap">
        <table class="rows">
          <thead>
            <tr>
              <th style="width:34px"><input type="checkbox" id="pick-all" aria-label="تحديدُ الكلّ"></th>
              <th style="width:66px">الغلاف</th>
              <th>العنوان</th>
              <th style="width:110px">القسم</th>
              <th style="width:120px">التاريخ</th>
              <th style="width:96px">التفاعل</th>
              <th style="width:80px">الكلمات</th>
              <th style="width:190px"></th>
            </tr>
          </thead>
          <tbody id="rows">
            ${page.map(rowHTML).join('') || `<tr><td colspan="8"><div class="empty"><strong>لا توجد موادُّ مطابقة</strong>غيّر التصفية أو ابدأ مادّةً جديدة.</div></td></tr>`}
          </tbody>
        </table>
      </div>

      ${pages > 1 ? `<div class="pager" id="pager">
        <button type="button" data-page="${S.filter.page - 1}" ${S.filter.page === 1 ? 'disabled' : ''}>السابق</button>
        ${Array.from({ length: pages }, (_, i) => i + 1)
          .filter((n) => Math.abs(n - S.filter.page) < 3 || n === 1 || n === pages)
          .map((n) => `<button type="button" class="${n === S.filter.page ? 'is-current' : ''}" data-page="${n}">${n}</button>`).join('')}
        <button type="button" data-page="${S.filter.page + 1}" ${S.filter.page === pages ? 'disabled' : ''}>التالي</button>
      </div>` : ''}`;

    bindContent();
    drawBulk();
  }

  function rowHTML(item) {
    const section = byId[item.type] || { name: item.type, accent: '#666' };
    const picked = S.selected.has(`${item.type}:${item.id}`);
    const stat = statOf(item);
    const comments = S.comments.filter((c) => c.type === item.type && c.item === item.id).length;
    return `<tr data-key="${item.type}:${item.id}">
      <td><input type="checkbox" class="pick" ${picked ? 'checked' : ''} aria-label="تحديد"></td>
      <td>${item.image && !item.image.startsWith('data:')
        ? `<img class="row-thumb" src="${esc(item.image)}" alt="" loading="lazy">`
        : '<span class="row-thumb"></span>'}</td>
      <td>
        <span class="row-title">${esc(item.title) || '<em>بلا عنوان</em>'}</span>
        <span class="row-sub">
          ${item.featured ? '<span class="tag tag--star">مميّزة</span> ' : ''}
          ${item.heavy ? '<span class="tag tag--muted">صورٌ مضمّنة</span> ' : ''}
          ${item.cats.slice(0, 3).map((c) => esc(catName(c))).join(' · ') || 'بلا موضوع'}
        </span>
      </td>
      <td><span class="tag" style="--accent:${esc(section.accent)}">${esc(section.name)}</span></td>
      <td class="row-sub">${esc(shortDate(item.stamp))}</td>
      <td class="row-sub" title="مشاهدات · إعجابات · تعليقات">
        ${stat.views || 0} 👁 · ${stat.likes || 0} ♥ · ${comments} 💬
      </td>
      <td class="row-sub">${item.words || '—'}</td>
      <td>
        <div class="row-acts">
          <a class="btn btn--ghost btn--sm" href="#/compose/${item.type}:${item.id}">تحرير</a>
          <a class="btn btn--ghost btn--sm" href="/read.html?type=${item.type}&id=${encodeURIComponent(item.id)}" target="_blank" rel="noopener">معاينة</a>
          <button class="btn btn--ghost btn--sm" type="button" data-dup>نسخ</button>
          <button class="btn btn--ghost btn--sm" type="button" data-del>حذف</button>
        </div>
      </td>
    </tr>`;
  }

  function bindContent() {
    $('#f-section')?.addEventListener('change', (e) => {
      S.filter.section = e.target.value; S.filter.page = 1;
      go(e.target.value ? `#/content/${e.target.value}` : '#/content');
    });
    $('#f-cat')?.addEventListener('change', (e) => { S.filter.cat = e.target.value; S.filter.page = 1; drawContent(); });
    $('#f-sort')?.addEventListener('change', (e) => { S.filter.sort = e.target.value; drawContent(); });
    $('#f-per')?.addEventListener('change', (e) => { S.filter.per = +e.target.value; S.filter.page = 1; drawContent(); });

    $('#pager')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-page]');
      if (!button || button.disabled) return;
      S.filter.page = +button.dataset.page;
      drawContent();
    });

    $('#pick-all')?.addEventListener('change', (e) => {
      $$('#rows tr').forEach((row) => {
        if (!row.dataset.key) return;
        const box = $('.pick', row);
        if (box) box.checked = e.target.checked;
        if (e.target.checked) S.selected.add(row.dataset.key);
        else S.selected.delete(row.dataset.key);
      });
      drawBulk();
    });

    $('#rows')?.addEventListener('change', (e) => {
      if (!e.target.classList.contains('pick')) return;
      const key = e.target.closest('tr').dataset.key;
      if (e.target.checked) S.selected.add(key); else S.selected.delete(key);
      drawBulk();
    });

    $('#rows')?.addEventListener('click', async (e) => {
      const row = e.target.closest('tr[data-key]');
      if (!row) return;
      const [type, id] = row.dataset.key.split(':');
      if (e.target.closest('[data-del]')) await removeItems([[type, id]]);
      if (e.target.closest('[data-dup]')) await duplicate(type, id);
    });
  }

  function drawBulk() {
    const host = $('#bulk');
    if (!host) return;
    const count = S.selected.size;
    if (!count) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="bulkbar">
      <span>${count} مادّةً محدّدة</span>
      <span class="spacer"></span>
      <button class="btn btn--ghost btn--sm" type="button" data-bulk="star">تمييز</button>
      <button class="btn btn--ghost btn--sm" type="button" data-bulk="unstar">إلغاءُ التمييز</button>
      <button class="btn btn--danger btn--sm" type="button" data-bulk="del">حذف</button>
      <button class="btn btn--ghost btn--sm" type="button" data-bulk="clear">إلغاءُ التحديد</button>
    </div>`;
    host.addEventListener('click', async (e) => {
      const button = e.target.closest('[data-bulk]');
      if (!button) return;
      const keys = Array.from(S.selected).map((k) => k.split(':'));
      if (button.dataset.bulk === 'clear') { S.selected.clear(); drawContent(); return; }
      if (button.dataset.bulk === 'del') { await removeItems(keys); return; }
      const featured = button.dataset.bulk === 'star';
      await Promise.all(keys.map(([type, id]) => db.ref(`${type}/${id}`).update({ featured })));
      keys.forEach(([type, id]) => {
        const item = S.items.find((i) => i.type === type && i.id === id);
        if (item) item.featured = featured;
      });
      toast(featured ? 'مُيّزت المواد' : 'أُلغي التمييز', 'ok');
      S.selected.clear();
      drawContent();
    }, { once: true });
  }

  /* حذفٌ قابلٌ للتراجع: نحتفظ بالنسخة دقائقَ في الذاكرة */
  async function removeItems(pairs) {
    const label = pairs.length === 1 ? 'هذه المادّة' : `${pairs.length} مادّة`;
    const ok = await confirmBox('حذفُ المحتوى', `سيُحذف ${label} من قاعدة البيانات. يمكنك التراجعُ خلال ثوانٍ.`, 'حذف');
    if (!ok) return;

    const backups = [];
    for (const [type, id] of pairs) {
      const snap = await db.ref(`${type}/${id}`).once('value');
      if (snap.exists()) backups.push([type, id, snap.val()]);
      await db.ref(`${type}/${id}`).remove();
    }
    S.items = S.items.filter((item) => !pairs.some(([t, i]) => t === item.type && i === item.id));
    S.selected.clear();
    countsPaint();
    drawContent();

    toast(`حُذف ${label}`, 'bad', {
      label: 'تراجُع',
      run: async () => {
        for (const [type, id, value] of backups) await db.ref(`${type}/${id}`).set(value);
        await loadAll();
        countsPaint();
        drawContent();
        toast('استُرجعت المواد', 'ok');
      }
    });
  }

  async function duplicate(type, id) {
    const snap = await db.ref(`${type}/${id}`).once('value');
    const value = snap.val();
    if (!value) return;
    const copy = { ...value, title: `${value.title} — نسخة`, featured: false };
    const ref = await db.ref(type).push(copy);
    S.items.unshift(normalize(type, ref.key, copy));
    countsPaint();
    drawContent();
    toast('أُنشئت نسخةٌ قابلةٌ للتحرير', 'ok');
  }

  /* ═══ محدِّدُ بؤرة الصورة ══════════════════════════════════
     الغلافُ يُقصّ في الموقع بنسبٍ مختلفة: ١٦/٩ في البطاقة، و٣/٢
     في الصدر، و٤/٥ في الإنفوجرافيك. فإن كان الوجهُ في أعلى الصورة
     قصّه القصُّ الأوسط. هنا يسحب المحرّرُ الصورةَ بالمؤشّر فيختار
     الجزءَ الذي يبقى، ويرى أثرَه في النسب الثلاث وهو يسحب.
     ═══════════════════════════════════════════════════ */
  const RATIOS = [
    { css: '16 / 9', label: 'البطاقة' },
    { css: '3 / 2', label: 'الصدر' },
    { css: '4 / 5', label: 'إنفوجرافيك' }
  ];

  const clamp = (n) => Math.min(100, Math.max(0, n));

  function focusEditorHTML(url) {
    const { x, y } = S.focus;
    return `
      <div class="focus" id="focus" tabindex="0" role="application"
           aria-label="بؤرةُ الصورة — اسحب بالمؤشّر أو حرّك بالأسهم">
        <img id="focus-img" src="${esc(url)}" alt="" draggable="false"
             style="object-position:${x}% ${y}%">
        <span class="focus__dot" id="focus-dot" style="left:${x}%;top:${y}%"></span>
        <span class="focus__grid" aria-hidden="true"></span>
      </div>
      <p class="focus__hint">
        اسحب الصورةَ لتختار ما يبقى منها عند القصّ ·
        <b id="focus-val">${x}% ${y}%</b>
        <button class="btn btn--ghost btn--sm" type="button" id="focus-reset">توسيط</button>
      </p>
      <div class="focus__previews" id="focus-previews">
        ${RATIOS.map((r) => `
          <span class="focus__prev">
            <span class="focus__prev-box" style="aspect-ratio:${r.css}">
              <img src="${esc(url)}" alt="" style="object-position:${x}% ${y}%">
            </span>
            <small>${r.label}</small>
          </span>`).join('')}
      </div>
      <div class="save-row" style="margin-block-start:.7rem">
        <button class="btn btn--ghost btn--sm" type="button" id="cover-change">تغييرُ الصورة</button>
        <button class="btn btn--ghost btn--sm" type="button" id="cover-clear">إزالة</button>
      </div>`;
  }

  function paintFocus() {
    const { x, y } = S.focus;
    const position = `${x}% ${y}%`;
    const main = $('#focus-img');
    if (main) main.style.objectPosition = position;
    const dot = $('#focus-dot');
    if (dot) {
      /* فيزيائيّةٌ عمداً: object-position تُقاس من اليسار مهما كان اتّجاهُ الصفحة */
      dot.style.left = `${x}%`;
      dot.style.top = `${y}%`;
    }
    const value = $('#focus-val');
    if (value) value.textContent = `${Math.round(x)}% ${Math.round(y)}%`;
    $$('#focus-previews img').forEach((img) => { img.style.objectPosition = position; });
  }

  function bindFocus() {
    const frame = $('#focus');
    if (!frame) return;

    const setFromEvent = (event) => {
      const box = frame.getBoundingClientRect();
      S.focus = {
        x: Math.round(clamp(((event.clientX - box.left) / box.width) * 100)),
        y: Math.round(clamp(((event.clientY - box.top) / box.height) * 100))
      };
      S.dirty = true;
      paintFocus();
    };

    let dragging = false;
    frame.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      dragging = true;
      frame.classList.add('is-dragging');
      /* الموضعُ أوّلاً: التقاطُ المؤشّر قد يُرفض فلا يصحّ أن يُبطل الضغطة */
      setFromEvent(event);
      try { frame.setPointerCapture(event.pointerId); } catch { /* لا بأس */ }
    });
    frame.addEventListener('pointermove', (event) => { if (dragging) setFromEvent(event); });
    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      frame.classList.remove('is-dragging');
      try { frame.releasePointerCapture(event.pointerId); } catch { /* انتهى */ }
    };
    frame.addEventListener('pointerup', stop);
    frame.addEventListener('pointercancel', stop);

    /* الأسهمُ لمن لا يستعمل الفأرة — خطوةٌ بالمئة، وعشرٌ مع Shift */
    frame.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 10 : 1;
      const moves = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0],
        ArrowUp: [0, -step], ArrowDown: [0, step]
      };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      S.focus = { x: clamp(S.focus.x + move[0]), y: clamp(S.focus.y + move[1]) };
      S.dirty = true;
      paintFocus();
    });

    $('#focus-reset')?.addEventListener('click', () => {
      S.focus = { x: 50, y: 50 };
      S.dirty = true;
      paintFocus();
    });
  }

  /* ═══════════ المحرّر ════════════════════════════════ */
  const draftKey = (type, id) => `eacr:admin:draft:${type}:${id || 'new'}`;

  function saveDraft() {
    if (!S.editing || !S.editor) return;
    store.write(draftKey(S.editing.type, S.editing.id), {
      at: Date.now(),
      form: readForm(),
      content: bodyHTML()
    });
    const mark = $('#autosave');
    if (mark) mark.textContent = `حُفظت مسودّةٌ محلّيّة ${new Date().toLocaleTimeString('ar-EG')}`;
  }

  routes.compose = async (arg) => {
    setActive('compose');
    let type = S.filter.section || SECTION_IDS[0];
    let id = null;
    if (arg && arg.includes(':')) [type, id] = arg.split(':');
    else if (arg && byId[arg]) type = arg;

    let raw = {};
    if (id) {
      view.innerHTML = '<div class="empty">جارٍ فتحُ المادّة…</div>';
      const snap = await db.ref(`${type}/${id}`).once('value');
      raw = snap.val() || {};
      if (!snap.exists()) { toast('المادّةُ غيرُ موجودة', 'bad'); go('#/content'); return; }
    }

    S.editing = { type, id };
    S.dirty = false;
    /* الصفرُ موضعٌ صحيح (أقصى اليسار أو الأعلى)، فلا يُبدَّل بالمنتصف */
    const axis = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? clamp(number) : 50;
    };
    S.focus = { x: axis(raw.focus?.x ?? 50), y: axis(raw.focus?.y ?? 50) };
    drawComposer(raw);
  };

  function drawComposer(raw) {
    const { type, id } = S.editing;
    const section = byId[type];
    const stamp = toStamp(raw.timestamp || raw.date) || Date.now();

    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>${id ? 'تحريرُ مادّة' : 'مادّةٌ جديدة'}</h1>
          <p>${esc(section.plural)} · ${esc(DISPLAY_NAMES[section.display] || '')}${id ? ` · أُنشئت ${esc(shortDate(stamp))}` : ' · لم تُحفظ بعد'}</p>
        </div>
        <div class="page-acts">
          ${id ? `<a class="btn btn--ghost" href="/read.html?type=${type}&id=${encodeURIComponent(id)}" target="_blank" rel="noopener">معاينة ↗</a>` : ''}
          <a class="btn btn--ghost" href="#/content">رجوع</a>
        </div>
      </div>

      <div id="draft-note"></div>

      <div class="composer">
        <div>
          <input class="title-input" id="f-title" placeholder="${section.display === 'people' ? 'اسمُ المتحدّث…' : 'عنوانُ المادّة…'}" value="${esc(raw.title || '')}">
          <div class="meter" style="margin-block:.5rem 1rem">
            <div class="meter__bar"><span class="meter__fill" id="m-title"></span></div>
            <span class="meter__text" id="m-title-text"></span>
          </div>

          <div class="field">
            <span class="field__label">الملخّص — هو ما يظهر تحت العنوان في جوجل وفي البطاقة</span>
            <textarea id="f-summary" rows="3" placeholder="سطران يشرحان المادّة…">${esc(raw.summary || raw.description || '')}</textarea>
            <div class="meter">
              <div class="meter__bar"><span class="meter__fill" id="m-sum"></span></div>
              <span class="meter__text" id="m-sum-text"></span>
            </div>
          </div>

          ${section.display === 'video' ? `
          <div class="field">
            <span class="field__label">رابطُ الفيديو (يوتيوب)</span>
            <input class="field__input" id="f-video" dir="ltr" value="${esc(raw.videoUrl || raw.video || '')}" placeholder="https://www.youtube.com/watch?v=…">
          </div>` : ''}

          ${section.display === 'agenda' ? `
          <div class="grid grid--2">
            <div class="field">
              <span class="field__label">الموعد — كما يُعرض للزائر</span>
              <input class="field__input" id="f-when" value="${esc(raw.when || raw.time || '')}" placeholder="١٠:٠٠ ص — ١٢:٣٠ م">
            </div>
            <div class="field">
              <span class="field__label">القاعةُ أو المكان</span>
              <input class="field__input" id="f-venue" value="${esc(raw.venue || raw.hall || '')}" placeholder="القاعةُ الكبرى — المركز القومي للبحوث">
            </div>
          </div>` : ''}

          ${section.display === 'people' ? `
          <div class="field">
            <span class="field__label">الصفةُ والجهة — تظهر تحت الاسم</span>
            <input class="field__input" id="f-role" value="${esc(raw.role || raw.affiliation || raw.speaker || '')}" placeholder="أستاذُ الأورام — كلّيّةُ الطبّ، جامعة …">
          </div>` : ''}

          <div id="editor-host"></div>
          <p class="autosave" id="autosave"></p>
        </div>

        <div class="composer__side">
          <div class="card">
            <div class="card__head"><h2>النشر</h2></div>
            <div class="field">
              <span class="field__label">القسم</span>
              <select id="f-type">
                ${SECTIONS.map((s) => `<option value="${esc(s.id)}"${s.id === type ? ' selected' : ''}>${esc(s.plural)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <span class="field__label">التاريخ</span>
              <input class="field__input" type="date" id="f-date" value="${isoOf(stamp)}">
            </div>
            <label class="check"><input type="checkbox" id="f-featured" ${raw.featured ? 'checked' : ''}><span>مادّةٌ مميّزة (تظهر في «الأكثر تداولاً»)</span></label>
            <div class="save-row">
              <button class="btn btn--brand" type="button" id="save">${id ? 'حفظُ التعديل' : 'نشرُ المادّة'}</button>
              ${id ? '<button class="btn btn--ghost" type="button" id="delete">حذف</button>' : ''}
              <span class="spacer"></span>
            </div>
          </div>

          <div class="card">
            <div class="card__head"><h2>صورةُ الغلاف</h2></div>
            <div class="cover-host" id="cover-host"></div>
            <input type="file" id="cover-file" accept="image/*" hidden>
            <div class="field" style="margin-block-start:.7rem">
              <span class="field__label">أو ألصق رابطاً مباشراً</span>
              <input class="field__input" id="f-image" dir="ltr" value="${esc(raw.image || raw.imageUrl || '')}" placeholder="https://…">
            </div>
          </div>

          <div class="card">
            <div class="card__head"><h2>الموضوعات</h2><a class="btn btn--ghost btn--sm" href="#/topics">إدارة</a></div>
            <div class="chips" id="cat-chips"></div>
          </div>

          <div class="card">
            <div class="card__head"><h2>نسبةُ المادّة</h2></div>
            <div class="field">
              <span class="field__label">الكاتب</span>
              <input class="field__input" id="f-author" value="${esc(raw.author || '')}" placeholder="اسمُ المحرّر">
            </div>
            <div class="field">
              <span class="field__label">المصدر</span>
              <input class="field__input" id="f-source" value="${esc(raw.source || '')}" placeholder="جهةُ الصورة أو المعلومة">
            </div>
            <div class="field">
              <span class="field__label">وسوم (تفصل بينها فاصلة)</span>
              <input class="field__input" id="f-tags" value="${esc((raw.tags || []).join('، '))}">
            </div>
          </div>

          <div class="card">
            <div class="card__head"><h2>فحصُ الجاهزيّة</h2></div>
            <ul class="checklist" id="ready"></ul>
          </div>
        </div>
      </div>`;

    buildChips(raw.categories || []);
    buildEditor(raw.content || raw.body || '');
    bindComposer(raw);
    offerDraft();
    refreshMeters();
  }

  function buildChips(selected) {
    const host = $('#cat-chips');
    const ids = Object.keys(S.cats);
    if (!ids.length) { host.innerHTML = '<p class="row-sub">لا توجد موضوعاتٌ بعد.</p>'; return; }
    host.innerHTML = ids.map((id) => `
      <button class="chip${selected.includes(id) ? ' is-on' : ''}" type="button" data-cat="${esc(id)}">${esc(catName(id))}</button>
    `).join('');
    host.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      chip.classList.toggle('is-on');
      S.dirty = true;
      refreshMeters();
    });
  }

  function buildEditor(html) {
    S.editor = window.EACREditor.create($('#editor-host'), {
      upload: uploadImage,
      notify: (message, kind) => toast(message, kind),
      onChange: () => { S.dirty = true; refreshMeters(); }
    });
    S.quill = S.editor.quill;
    S.editor.setHTML(html || '');
  }

  const bodyHTML = () => (S.editor ? S.editor.getHTML() : '');

  function readForm() {
    const pick = (sel) => $(sel)?.value.trim() || '';
    return {
      title: pick('#f-title'),
      summary: pick('#f-summary'),
      image: pick('#f-image'),
      video: pick('#f-video'),
      when: pick('#f-when'),
      venue: pick('#f-venue'),
      role: pick('#f-role'),
      author: pick('#f-author'),
      source: pick('#f-source'),
      tags: pick('#f-tags').split(/[،,]/).map((t) => t.trim()).filter(Boolean),
      date: pick('#f-date'),
      featured: !!$('#f-featured')?.checked,
      type: $('#f-type')?.value || S.editing.type,
      cats: $$('#cat-chips .chip.is-on').map((c) => c.dataset.cat)
    };
  }

  function meter(fill, text, value, min, best, max, label) {
    const bar = $(fill);
    const note = $(text);
    if (!bar) return;
    const ratio = Math.min(1, value / max);
    bar.style.width = `${Math.round(ratio * 100)}%`;
    bar.classList.toggle('is-bad', value < min || value > max);
    bar.classList.toggle('is-warn', value >= min && value < best);
    note.textContent = `${label}: ${value} حرفاً — الأفضل بين ${best} و ${max}`;
  }

  function refreshMeters() {
    const form = readForm();
    const html = bodyHTML();
    const count = words(html);
    meter('#m-title', '#m-title-text', form.title.length, 1, 35, 65, 'العنوان');
    meter('#m-sum', '#m-sum-text', form.summary.length, 1, 90, 160, 'الملخّص');

    const checks = [
      [form.title.length >= 10, 'عنوانٌ واضحٌ لا يقلّ عن عشرة أحرف'],
      [form.summary.length >= 40, 'ملخّصٌ يصلح لنتائج البحث'],
      [!!form.image || form.type === 'videos', 'صورةُ غلافٍ برابطٍ خارجيّ'],
      [count >= 120 || form.type === 'infographics' || form.type === 'videos', 'نصٌّ لا يقلّ عن ١٢٠ كلمة'],
      [form.cats.length > 0, 'موضوعٌ واحدٌ على الأقلّ'],
      [!/data:image\//i.test(html), 'لا صورَ مضمّنةً داخل النصّ']
    ];
    const host = $('#ready');
    if (host) host.innerHTML = checks.map(([done, label]) => `<li class="${done ? 'is-done' : ''}">${esc(label)}</li>`).join('');
  }

  function offerDraft() {
    const { type, id } = S.editing;
    const draft = store.read(draftKey(type, id), null);
    const host = $('#draft-note');
    if (!draft || !host) return;
    const age = Math.round((Date.now() - draft.at) / 60000);
    host.innerHTML = `<div class="banner banner--warn">
      <div class="banner__body">
        <strong>هناك مسودّةٌ محفوظةٌ على هذا الجهاز</strong>
        <span>تُركت منذ ${age} دقيقة. أتستعيدها؟</span>
      </div>
      <button class="btn btn--brand btn--sm" type="button" id="draft-restore">استعادة</button>
      <button class="btn btn--ghost btn--sm" type="button" id="draft-drop">تجاهُل</button>
    </div>`;
    $('#draft-restore').addEventListener('click', () => {
      const form = draft.form || {};
      const set = (sel, value) => { const node = $(sel); if (node) node.value = value ?? ''; };
      set('#f-title', form.title); set('#f-summary', form.summary); set('#f-image', form.image);
      set('#f-video', form.video); set('#f-when', form.when); set('#f-venue', form.venue);
      set('#f-role', form.role); set('#f-author', form.author);
      set('#f-source', form.source); set('#f-tags', (form.tags || []).join('، ')); set('#f-date', form.date);
      if ($('#f-featured')) $('#f-featured').checked = !!form.featured;
      if (draft.content) S.editor.setHTML(draft.content);
      $$('#cat-chips .chip').forEach((chip) => chip.classList.toggle('is-on', (form.cats || []).includes(chip.dataset.cat)));
      host.innerHTML = '';
      refreshMeters();
      toast('استُعيدت المسودّة', 'ok');
    });
    $('#draft-drop').addEventListener('click', () => { store.drop(draftKey(type, id)); host.innerHTML = ''; });
  }

  function bindComposer(raw) {
    const mark = () => { S.dirty = true; refreshMeters(); };
    ['#f-title', '#f-summary', '#f-image', '#f-video', '#f-when', '#f-venue', '#f-role',
     '#f-author', '#f-source', '#f-tags', '#f-date']
      .forEach((sel) => $(sel)?.addEventListener('input', mark));
    $('#f-featured')?.addEventListener('change', mark);
    $('#f-type')?.addEventListener('change', mark);

    paintCover(raw.image || raw.imageUrl || '');
    const file = $('#cover-file');
    file?.addEventListener('change', () => { if (file.files[0]) setCover(file.files[0]); });
    $('#f-image')?.addEventListener('change', (e) => paintCover(e.target.value));

    $('#save')?.addEventListener('click', () => saveItem(raw));
    $('#delete')?.addEventListener('click', async () => {
      await removeItems([[S.editing.type, S.editing.id]]);
      go('#/content');
    });

    clearInterval(S.autosaveTimer);
    S.autosaveTimer = setInterval(() => { if (S.dirty) saveDraft(); }, (CFG.autosave || 20) * 1000);
  }

  function paintCover(url) {
    const host = $('#cover-host');
    if (!host) return;

    if (!url) {
      host.innerHTML = `
        <div class="cover" id="cover">
          <span>اسحب صورةً هنا أو اضغط للاختيار</span>
          <span class="cover__note">تُرفع إلى مستضيفٍ خارجيّ ويُحفظ رابطُها — لا تُلصق في النصّ</span>
        </div>`;
      const empty = $('#cover', host);
      empty.addEventListener('click', () => $('#cover-file').click());
      bindDrop(empty);
      return;
    }

    host.innerHTML = focusEditorHTML(url);
    bindFocus();
    bindDrop($('#focus'));
    $('#cover-change')?.addEventListener('click', () => $('#cover-file').click());
    $('#cover-clear')?.addEventListener('click', () => {
      $('#f-image').value = '';
      S.focus = { x: 50, y: 50 };
      S.dirty = true;
      paintCover('');
      refreshMeters();
    });
  }

  /* الإفلاتُ يعمل على الصندوق الفارغ وعلى المحدّد سواء */
  function bindDrop(node) {
    if (!node) return;
    ['dragenter', 'dragover'].forEach((type) => node.addEventListener(type, (e) => {
      e.preventDefault(); node.classList.add('is-over');
    }));
    ['dragleave', 'drop'].forEach((type) => node.addEventListener(type, (e) => {
      e.preventDefault(); node.classList.remove('is-over');
    }));
    node.addEventListener('drop', (e) => {
      const dropped = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith('image/'));
      if (dropped) setCover(dropped);
    });
  }

  async function setCover(file) {
    toast('جارٍ رفعُ الغلاف…');
    try {
      const url = await uploadImage(file);
      $('#f-image').value = url;
      S.focus = { x: 50, y: 50 };
      paintCover(url);
      S.dirty = true;
      refreshMeters();
      toast('رُفع الغلاف', 'ok');
    } catch {
      toast('تعذّر رفعُ الصورة', 'bad');
    }
  }

  async function saveItem(previous) {
    const form = readForm();
    if (!form.title) { toast('العنوان مطلوب', 'bad'); $('#f-title').focus(); return; }

    const html = bodyHTML();
    if (/data:image\//i.test(html)) {
      const ok = await confirmBox(
        'صورٌ مضمّنةٌ في النصّ',
        'النصُّ يحوي صوراً بترميز base64 تُثقل الصفحةَ والخلاصة. أرفعها الآن وأستبدل روابطَها؟',
        'ارفعها ثمّ احفظ'
      );
      if (ok) await liftInlineImages();
    }

    const stamp = form.date ? Date.parse(`${form.date}T09:00:00Z`) : Date.now();
    const payload = {
      title: form.title,
      summary: form.summary,
      content: bodyHTML(),
      image: form.image,
      categories: form.cats,
      tags: form.tags,
      author: form.author,
      source: form.source,
      featured: form.featured,
      focus: { x: Math.round(S.focus.x), y: Math.round(S.focus.y) },
      date: form.date || isoOf(stamp),
      dateLabel: arabicOf(stamp),
      timestamp: stamp,
      updatedAt: Date.now(),
      updatedBy: S.user.email || ''
    };
    const display = (byId[form.type] || {}).display || 'standard';
    if (display === 'video') { payload.videoUrl = form.video; payload.description = form.summary; }
    if (display === 'agenda') { payload.when = form.when; payload.venue = form.venue; }
    if (display === 'people') payload.role = form.role;
    if (display === 'gallery') payload.imageUrl = form.image;
    if (display === 'standard') payload.readTime = Math.max(1, Math.round(words(payload.content) / 190));

    const button = $('#save');
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ…';

    try {
      const moved = S.editing.id && form.type !== S.editing.type;
      if (S.editing.id && !moved) {
        await db.ref(`${form.type}/${S.editing.id}`).update(payload);
      } else {
        const created = { ...previous, ...payload, createdAt: previous.createdAt || Date.now() };
        const ref = await db.ref(form.type).push(created);
        if (moved) await db.ref(`${S.editing.type}/${S.editing.id}`).remove();
        S.editing = { type: form.type, id: ref.key };
      }
      /* نبضةٌ واحدةٌ تصل أجهزةَ القرّاء في ثوانٍ عبر القناة الحيّة */
      await db.ref('pulse').set({
        type: form.type,
        id: S.editing.id,
        title: payload.title,
        section: byId[form.type]?.name || form.type,
        image: payload.image && !payload.image.startsWith('data:') ? payload.image : '',
        at: Date.now()
      }).catch(() => {});

      store.drop(draftKey(S.editing.type, S.editing.id));
      store.drop(draftKey(form.type, null));
      S.dirty = false;
      await loadAll();
      countsPaint();
      toast(moved ? 'نُقلت المادّةُ إلى قسمها الجديد' : 'حُفظت المادّة', 'ok');
      go('#/content');
    } catch (error) {
      toast(error?.code === 'PERMISSION_DENIED'
        ? 'قواعدُ الأمان تمنع الكتابة — راجع firebase-rules.json'
        : 'تعذّر الحفظ', 'bad');
      button.disabled = false;
      button.textContent = 'حفظ';
    }
  }

  /* يرفع كلَّ صورةٍ مضمّنةٍ في المحرّر ويستبدل مصدرَها */
  async function liftInlineImages() {
    const images = $$('img[src^="data:image"]', S.quill.root);
    let done = 0;
    for (const image of images) {
      try {
        const url = await uploadImage(dataUriToBlob(image.src));
        image.setAttribute('src', url);
        done += 1;
      } catch { /* نُبقيها كما هي */ }
    }
    if (done) toast(`رُفعت ${done} صورة`, 'ok');
    return done;
  }

  /* ═══════════ الموضوعات ═════════════════════════════ */
  routes.topics = () => {
    setActive('topics');
    const ids = Object.keys(S.cats);
    const used = (id) => S.items.filter((i) => i.cats.includes(id)).length;

    view.innerHTML = `
      <div class="page-head">
        <div><h1>الموضوعات</h1><p>الموضوعُ الذي يجمع مادّتين فأكثر تُبنى له صفحةٌ مستقلّةٌ في الموقع.</p></div>
      </div>

      <div class="card" style="margin-block-end:1rem">
        <div class="card__head"><h2>إضافةُ موضوع</h2></div>
        <div class="mini__row">
          <input type="text" id="new-cat" placeholder="اسمُ الموضوع… مثال: اقتصاد الانتباه" style="flex:1">
          <button class="btn btn--brand btn--sm" type="button" id="add-cat">إضافة</button>
        </div>
      </div>

      <div class="mini">
        ${ids.map((id) => `
          <div class="mini__row" data-cat="${esc(id)}">
            <input type="text" class="cat-name" value="${esc(catName(id))}" style="flex:1">
            <span class="row-sub">${used(id)} مادّة</span>
            <button class="btn btn--ghost btn--sm" type="button" data-save>حفظ</button>
            <button class="btn btn--ghost btn--sm" type="button" data-del>حذف</button>
          </div>`).join('') || '<div class="empty"><strong>لا موضوعاتٍ بعد</strong>أضف أوّلَ موضوعٍ من الحقل أعلاه.</div>'}
      </div>`;

    $('#add-cat').addEventListener('click', async () => {
      const name = $('#new-cat').value.trim();
      if (!name) return;
      const id = `cat_${Date.now()}`;
      await db.ref(`categories/${id}`).set({ name });
      S.cats[id] = { name };
      toast('أُضيف الموضوع', 'ok');
      routes.topics();
    });

    view.addEventListener('click', async (e) => {
      const row = e.target.closest('[data-cat]');
      if (!row) return;
      const id = row.dataset.cat;
      if (e.target.closest('[data-save]')) {
        const name = $('.cat-name', row).value.trim();
        if (!name) return;
        await db.ref(`categories/${id}`).update({ name });
        S.cats[id] = { ...(S.cats[id] || {}), name };
        toast('حُفظ الاسم', 'ok');
      }
      if (e.target.closest('[data-del]')) {
        const count = used(id);
        const ok = await confirmBox('حذفُ الموضوع',
          count ? `هذا الموضوعُ مربوطٌ بـ ${count} مادّة. سيُحذف الموضوعُ ويُنزع من موادّه.` : 'سيُحذف الموضوع.',
          'حذف');
        if (!ok) return;
        await db.ref(`categories/${id}`).remove();
        for (const item of S.items.filter((i) => i.cats.includes(id))) {
          const next = item.cats.filter((c) => c !== id);
          await db.ref(`${item.type}/${item.id}`).update({ categories: next });
          item.cats = next;
        }
        delete S.cats[id];
        toast('حُذف الموضوع', 'ok');
        routes.topics();
      }
    }, { once: true });
  };

  /* ═══════════ التعليقات ═════════════════════════════ */
  routes.comments = () => {
    setActive('comments');
    const titleOf = (row) => S.items.find((i) => i.type === row.type && i.id === row.item)?.title || 'مادّةٌ محذوفة';
    const pending = S.comments.filter((c) => c.approved === false);
    const shown = S.commentsFilter === 'pending' ? pending : S.comments;

    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>التعليقات</h1>
          <p>${S.comments.length} تعليقاً${pending.length ? ` · ${pending.length} ينتظر المراجعة` : ''}.</p>
        </div>
        <div class="page-acts">
          <button class="btn ${S.commentsFilter === 'pending' ? 'btn--brand' : 'btn--ghost'}" type="button" data-cf="pending">قيدَ المراجعة</button>
          <button class="btn ${S.commentsFilter === 'pending' ? 'btn--ghost' : 'btn--brand'}" type="button" data-cf="all">الكلّ</button>
        </div>
      </div>

      <div class="grid">
        ${shown.slice(0, 200).map((row) => `
          <div class="qcard" data-c="${esc(row.type)}|${esc(row.item)}|${esc(row.id)}">
            <div class="mini__row" style="border:0;padding:0;background:none">
              <span class="who__avatar" style="width:28px;height:28px;font-size:.8rem">${esc((row.name || 'ق')[0])}</span>
              <b>${esc(row.name || 'قارئ')}</b>
              <span class="row-sub">${esc(ago(row.at || 0))}</span>
              ${row.approved === false ? '<span class="tag tag--star">ينتظر المراجعة</span>' : ''}
              <span class="spacer"></span>
              ${row.approved === false
                ? '<button class="btn btn--ok btn--sm" type="button" data-approve>إجازة</button>'
                : '<button class="btn btn--ghost btn--sm" type="button" data-hide>إخفاء</button>'}
              <button class="btn btn--ghost btn--sm" type="button" data-cdel>حذف</button>
            </div>
            <p style="margin:0;white-space:pre-wrap">${esc(row.body)}</p>
            <p class="row-sub" style="margin:0">
              على: <a href="#/compose/${esc(row.type)}:${esc(row.item)}">${esc(titleOf(row))}</a>
              · <a href="/read.html?type=${esc(row.type)}&id=${encodeURIComponent(row.item)}" target="_blank" rel="noopener">فتحُ المادّة ↗</a>
            </p>
          </div>`).join('') || '<div class="empty"><strong>لا تعليقاتٍ هنا</strong>حين يكتب القرّاءُ تعليقاً يظهر في هذه الشاشة.</div>'}
      </div>`;

    view.addEventListener('click', async (e) => {
      const filter = e.target.closest('[data-cf]');
      if (filter) { S.commentsFilter = filter.dataset.cf; routes.comments(); return; }

      const card = e.target.closest('[data-c]');
      if (!card) return;
      const [type, item, id] = card.dataset.c.split('|');
      const path = `comments/${type}/${item}/${id}`;
      const row = S.comments.find((c) => c.id === id && c.type === type && c.item === item);

      if (e.target.closest('[data-approve]')) {
        await db.ref(path).update({ approved: true });
        if (row) row.approved = true;
        toast('أُجيز التعليق', 'ok');
      } else if (e.target.closest('[data-hide]')) {
        await db.ref(path).update({ approved: false });
        if (row) row.approved = false;
        toast('أُخفي التعليق', 'ok');
      } else if (e.target.closest('[data-cdel]')) {
        if (!await confirmBox('حذفُ التعليق', 'سيُحذف نهائيّاً من قاعدة البيانات.', 'حذف')) return;
        await db.ref(path).remove();
        S.comments = S.comments.filter((c) => c !== row);
        toast('حُذف التعليق', 'ok');
      } else return;

      countsPaint();
      routes.comments();
    }, { once: true });
  };

  /* ═══════════ الأقسام ═══════════════════════════════
     القسمُ هنا ليس اسماً فحسب: له عقدةٌ في القاعدة يُكتب فيها
     محتواه، ورابطٌ تُبنى عليه صفحاتُه، وشكلُ عرضٍ يحدّد هيئتَه
     في الرئيسيّة وفي صفحة القسم. لذلك يُحذَّر قبل الحذف: العقدةُ
     تبقى في القاعدة، وإنّما تختفي صفحاتُها من الموقع.
     ═══════════════════════════════════════════════════ */
  const SLUG_OK = /^[a-z0-9][a-z0-9-]*$/;

  routes.sections = async () => {
    setActive('sections');
    view.innerHTML = '<div class="empty">جارٍ تحميلُ الأقسام…</div>';
    await loadDesign();
    drawSections();
  };

  function drawSections() {
    const rows = CONFIG.sections;
    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>الأقسام</h1>
          <p>أضِف قسماً جديداً أو غيّر اسمَه ولونَه وشكلَ عرضه. الترتيبُ هنا هو ترتيبُه في القائمة وفي الرئيسيّة.</p>
        </div>
        <div class="page-acts">
          <button class="btn btn--ghost" type="button" id="sec-add">+ قسمٌ جديد</button>
          <button class="btn btn--brand" type="button" id="sec-save">حفظُ الأقسام</button>
        </div>
      </div>

      <div id="sec-list">${rows.map((s, i) => sectionRow(s, i)).join('')}</div>

      ${rows.length ? '' : '<div class="empty"><strong>لا توجد أقسام</strong>اضغط «قسمٌ جديد» لتبدأ.</div>'}

      <div class="banner" style="margin-block-start:1.2rem">
        <div class="banner__body">
          <strong>بعد الحفظ يحتاج الموقعُ بناءً</strong>
          <span>الأقسامُ تُبنى صفحاتٍ ثابتةً في الموقع، فبعد حفظها شغّل:</span>
          <code>python build.py --sync</code>
        </div>
      </div>`;
    bindSections();
  }

  function sectionRow(s, index) {
    const used = S.items.filter((i) => i.type === s.id).length;
    return `
      <div class="card sec-row" data-sec="${index}">
        <div class="card__head">
          <h2><span class="side__dot" style="--accent:${esc(s.accent || '#C2185B')}"></span>${esc(s.plural || s.name || s.id)}</h2>
          <div class="page-acts">
            <span class="row-sub">${used} مادّة</span>
            <button class="btn btn--ghost btn--sm" type="button" data-sec-move="-1"${index === 0 ? ' disabled' : ''}>▲</button>
            <button class="btn btn--ghost btn--sm" type="button" data-sec-move="1">▼</button>
            <button class="btn btn--ghost btn--sm" type="button" data-sec-del>حذف</button>
          </div>
        </div>
        <div class="grid grid--2">
          <label class="field">
            <span class="field__label">الاسمُ في القائمة</span>
            <input class="field__input" data-sf="name" value="${esc(s.name || '')}" placeholder="أخبار">
          </label>
          <label class="field">
            <span class="field__label">الاسمُ الكامل — عنوانُ صفحة القسم</span>
            <input class="field__input" data-sf="plural" value="${esc(s.plural || '')}" placeholder="أخبارُ المؤتمر">
          </label>
          <label class="field">
            <span class="field__label">اسمُ المادّة الواحدة</span>
            <input class="field__input" data-sf="single" value="${esc(s.single || '')}" placeholder="خبر">
          </label>
          <label class="field">
            <span class="field__label">الرابط — إنجليزيّةٌ صغيرةٌ وشُرَط</span>
            <input class="field__input" data-sf="slug" dir="ltr" value="${esc(s.slug || s.id)}" placeholder="news">
          </label>
          <label class="field">
            <span class="field__label">شكلُ العرض</span>
            <select data-sf="display">
              ${DISPLAYS.map(([id, name, note]) =>
                `<option value="${id}"${(s.display || 'standard') === id ? ' selected' : ''}>${esc(name)} — ${esc(note)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field__label">لونُ القسم</span>
            <input type="color" data-sf="accent" value="${esc(s.accent || '#C2185B')}">
          </label>
          <label class="field" style="grid-column:1/-1">
            <span class="field__label">وصفٌ قصير — يظهر تحت عنوان القسم وفي نتائج البحث</span>
            <input class="field__input" data-sf="description" value="${esc(s.description || '')}">
          </label>
        </div>
        <p class="row-sub">معرّفُ القسم في قاعدة البيانات: <code dir="ltr">${esc(s.id)}</code> — لا يتغيّر بعد الإنشاء.</p>
      </div>`;
  }

  function collectSections() {
    CONFIG.sections = $$('#sec-list .sec-row').map((row, index) => {
      const get = (key) => $(`[data-sf="${key}"]`, row)?.value.trim() || '';
      const previous = CONFIG.sections[Number(row.dataset.sec)] || {};
      return {
        id: previous.id,
        name: get('name') || previous.id,
        plural: get('plural') || get('name') || previous.id,
        single: get('single'),
        slug: get('slug') || previous.id,
        accent: get('accent') || '#C2185B',
        icon: previous.icon || 'newspaper',
        display: get('display') || 'standard',
        description: get('description'),
        order: index
      };
    });
  }

  function bindSections() {
    $('#sec-add').addEventListener('click', () => {
      const id = (prompt('معرّفُ القسم في قاعدة البيانات — بالإنجليزيّة الصغيرة والشُّرَط فقط، مثل: workshops') || '')
        .trim().toLowerCase();
      if (!id) return;
      if (!SLUG_OK.test(id)) { toast('المعرّفُ يقبل a-z و 0-9 والشُّرطة فقط', 'bad'); return; }
      collectSections();
      if (CONFIG.sections.some((s) => s.id === id)) { toast('هذا المعرّفُ مستعملٌ بالفعل', 'bad'); return; }
      CONFIG.sections.push({
        id, name: id, plural: id, single: '', slug: id,
        accent: '#C2185B', icon: 'newspaper', display: 'standard', description: ''
      });
      drawSections();
    });

    $('#sec-save').addEventListener('click', async () => {
      collectSections();
      const slugs = CONFIG.sections.map((s) => s.slug);
      const clash = slugs.find((s, i) => slugs.indexOf(s) !== i);
      if (clash) { toast(`الرابط «${clash}» مكرَّرٌ في قسمين`, 'bad'); return; }
      const bad = CONFIG.sections.find((s) => !SLUG_OK.test(s.slug));
      if (bad) { toast(`الرابط «${bad.slug}» غيرُ صالح`, 'bad'); return; }

      const button = $('#sec-save');
      button.disabled = true;
      button.textContent = 'جارٍ الحفظ…';
      try {
        await db.ref('site_config/sections').set(CONFIG.sections);
        setSections(CONFIG.sections);
        toast('حُفظت الأقسام — أعد بناءَ الموقع لتظهر صفحاتُها');
      } catch {
        toast('تعذّر الحفظ — تحقّق من الاتّصال', 'bad');
      }
      button.disabled = false;
      button.textContent = 'حفظُ الأقسام';
      drawSections();
    });

    $('#sec-list').addEventListener('click', async (event) => {
      const row = event.target.closest('.sec-row');
      if (!row) return;
      const at = Number(row.dataset.sec);

      const move = event.target.closest('[data-sec-move]');
      if (move) {
        collectSections();
        const to = at + Number(move.dataset.secMove);
        if (to < 0 || to >= CONFIG.sections.length) return;
        const list = CONFIG.sections;
        [list[at], list[to]] = [list[to], list[at]];
        drawSections();
        return;
      }

      if (event.target.closest('[data-sec-del]')) {
        collectSections();
        const section = CONFIG.sections[at];
        const used = S.items.filter((i) => i.type === section.id).length;
        const ok = await confirmBox(
          'حذفُ القسم',
          `سيختفي «${section.plural || section.id}» من الموقع ومن القائمة`
          + `${used ? ` ومعه ${used} مادّةً لن تظهر` : ''}. `
          + 'موادُّه تبقى في قاعدة البيانات، فإن أعدتَ القسمَ بالمعرّف نفسِه عادت معه.',
          'حذف'
        );
        if (!ok) return;
        CONFIG.sections.splice(at, 1);
        drawSections();
      }
    });
  }

  /* ═══════════ الداعمون ══════════════════════════════
     شعارُ الداعم يُرفع إلى المستضيف ويُحفظ رابطُه، ومستوى
     الدعم يحدّد حجمَ الشعار وموضعَه في صفحة الداعمين.
     ═══════════════════════════════════════════════════ */
  const TIERS = (CFG.sponsorTiers || []).length
    ? CFG.sponsorTiers
    : [{ id: 'partner', name: 'شركاءٌ وجهاتٌ داعمة' }];

  routes.sponsors = async () => {
    setActive('sponsors');
    view.innerHTML = '<div class="empty">جارٍ تحميلُ الداعمين…</div>';
    const snap = await db.ref('sponsors').once('value').catch(() => null);
    const raw = (snap && snap.val()) || {};
    S.sponsors = Object.entries(raw)
      .map(([id, row]) => ({ id, ...(row || {}) }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    drawSponsors();
  };

  function drawSponsors() {
    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>داعمو المؤتمر</h1>
          <p>أضِف شعارَ كلِّ داعمٍ ورابطَ موقعه ومستوى دعمه. تظهر القائمةُ في الرئيسيّة وفي صفحة <code dir="ltr">/sponsors/</code>.</p>
        </div>
        <div class="page-acts">
          <button class="btn btn--brand" type="button" id="sp-add">+ داعمٌ جديد</button>
        </div>
      </div>

      ${S.sponsors.length
        ? `<div class="grid grid--2" id="sp-list">${S.sponsors.map((s) => sponsorCard(s)).join('')}</div>`
        : '<div class="empty"><strong>لا داعمين بعد</strong>اضغط «داعمٌ جديد» وارفع شعارَ الجهة.</div>'}

      <div class="banner" style="margin-block-start:1.2rem">
        <div class="banner__body">
          <strong>الشعاراتُ تُطبع في صفحات الموقع</strong>
          <span>بعد إضافة داعمٍ أو تعديله شغّل:</span>
          <code>python build.py --sync</code>
        </div>
      </div>`;
    bindSponsors();
  }

  function sponsorCard(s) {
    return `
      <div class="card" data-sp="${esc(s.id)}">
        <div class="card__head">
          <h2>${esc(s.name || 'داعمٌ بلا اسم')}</h2>
          <button class="btn btn--ghost btn--sm" type="button" data-sp-del>حذف</button>
        </div>
        <div class="imgrow">
          <span class="imgrow__prev">${s.logo
            ? `<img src="${esc(s.logo)}" alt="">`
            : '<span class="imgrow__none">—</span>'}</span>
          <span class="imgrow__body">
            <b>شعارُ الجهة</b>
            <small>يُفضَّل PNG بخلفيّةٍ شفّافةٍ أو بيضاء</small>
            <input class="field__input" data-spf="logo" dir="ltr" value="${esc(s.logo || '')}" placeholder="https://…">
          </span>
          <span class="imgrow__acts">
            <button class="btn btn--ghost btn--sm" type="button" data-sp-pick>رفع</button>
          </span>
        </div>
        <label class="field">
          <span class="field__label">اسمُ الجهة</span>
          <input class="field__input" data-spf="name" value="${esc(s.name || '')}" placeholder="اسمُ الشركة أو المؤسّسة">
        </label>
        <label class="field">
          <span class="field__label">رابطُ موقعها (اختياري)</span>
          <input class="field__input" data-spf="url" dir="ltr" value="${esc(s.url || '')}" placeholder="https://…">
        </label>
        <div class="grid grid--2">
          <label class="field">
            <span class="field__label">مستوى الدعم</span>
            <select data-spf="tier">
              ${TIERS.map((tier) =>
                `<option value="${esc(tier.id)}"${s.tier === tier.id ? ' selected' : ''}>${esc(tier.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field__label">الترتيبُ داخل المستوى</span>
            <input class="field__input" type="number" data-spf="order" value="${Number(s.order || 0)}">
          </label>
        </div>
        <div class="save-row">
          <button class="btn btn--brand btn--sm" type="button" data-sp-save>حفظ</button>
        </div>
      </div>`;
  }

  async function saveSponsor(card) {
    const id = card.dataset.sp;
    const get = (key) => $(`[data-spf="${key}"]`, card)?.value.trim() || '';
    const payload = {
      name: get('name'),
      logo: get('logo'),
      url: get('url'),
      tier: get('tier') || TIERS[0].id,
      order: Number(get('order')) || 0,
      updatedAt: Date.now()
    };
    if (!payload.name && !payload.logo) { toast('أضِف اسمَ الجهة أو شعارَها', 'bad'); return; }
    try {
      await db.ref(`sponsors/${id}`).update(payload);
      const row = S.sponsors.find((s) => s.id === id);
      if (row) Object.assign(row, payload);
      toast('حُفظ الداعم');
      drawSponsors();
    } catch {
      toast('تعذّر الحفظ', 'bad');
    }
  }

  function bindSponsors() {
    $('#sp-add').addEventListener('click', async () => {
      const blankRow = {
        name: '', logo: '', url: '', tier: TIERS[0].id,
        order: S.sponsors.length, createdAt: Date.now()
      };
      const reference = db.ref('sponsors').push();
      await reference.set(blankRow);
      S.sponsors.push({ id: reference.key, ...blankRow });
      drawSponsors();
    });

    const list = $('#sp-list');
    if (!list) return;
    list.addEventListener('click', async (event) => {
      const card = event.target.closest('[data-sp]');
      if (!card) return;
      const id = card.dataset.sp;

      if (event.target.closest('[data-sp-save]')) { saveSponsor(card); return; }

      if (event.target.closest('[data-sp-del]')) {
        const ok = await confirmBox('حذفُ داعم', 'سيُحذف هذا الداعمُ من قاعدة البيانات نهائيّاً.', 'حذف');
        if (!ok) return;
        await db.ref(`sponsors/${id}`).remove();
        S.sponsors = S.sponsors.filter((s) => s.id !== id);
        toast('حُذف الداعم');
        drawSponsors();
        return;
      }

      if (event.target.closest('[data-sp-pick]')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
          if (!input.files || !input.files[0]) return;
          toast('جارٍ رفعُ الشعار…');
          try {
            const url = await uploadImage(input.files[0]);
            $('[data-spf="logo"]', card).value = url;
            saveSponsor(card);
          } catch {
            toast('تعذّر رفعُ الشعار', 'bad');
          }
        };
        input.click();
      }
    });
  }


  /* ═══════════ الهويّة والتصميم ═══════════════════════════
     كلُّ ما كان ثابتاً في الموقع صار يُدار من هنا: اسمُه وشعارُه
     وألوانُه وروابطُ أزراره، وما يظهر منه وما يُخفى.
     يُكتب في عقدة site_config، ويقرؤه المولّدُ عند البناء.
     ═══════════════════════════════════════════════════ */
  const VIS_GROUPS = [
    ['الشريطُ العلوي', [
      ['masthead.search', 'زرُّ البحث'],
      ['masthead.saved', 'زرُّ المحفوظات'],
      ['masthead.bell', 'جرسُ الإشعارات'],
      ['masthead.theme', 'زرُّ الوضع الليلي'],
      ['ticker', 'شريطُ العناوين المتحرّك']
    ]],
    ['الصفحةُ الرئيسيّة', [
      ['home.hero', 'صدرُ المؤتمر (الشعار والموعد والمكان)'],
      ['home.agenda', 'لوحُ الفعاليّات الجانبيّ'],
      ['home.topics', 'لوحُ الموضوعات'],
      ['home.featured', 'لوحُ الأكثر متابعة'],
      ['home.follow', 'لوحُ المتابعة'],
      ['home.sponsors', 'شريطُ داعمي المؤتمر']
    ]],
    ['صفحةُ المادّة', [
      ['article.tools', 'أدواتُ المقال (استماع · قراءة · حجم)'],
      ['article.toc', 'جدولُ المحتويات'],
      ['article.share', 'شريطُ المشاركة'],
      ['article.prevnext', 'السابق والتالي'],
      ['article.related', 'اقرأ أيضاً']
    ]],
    ['الذيلُ وغيره', [
      ['footer.patronage', 'الرعايةُ ورئاسةُ المؤتمر في الذيل'],
      ['footer.team', 'اللجنةُ المنظِّمة في الذيل'],
      ['to_top', 'زرُّ العودة إلى الأعلى']
    ]]
  ];

  const LINK_SETS = [
    ['nav', 'القائمةُ العلويّة', 'روابطُ تُضاف بعد الأقسام'],
    ['footer', 'روابطُ الذيل', ''],
    ['social', 'المنصّاتُ الاجتماعيّة', '']
  ];

  const IMAGE_FIELDS = [
    ['logo', 'شعارُ الموقع', 'يظهر في الشريط العلويّ والذيل'],
    ['publisher_logo', 'شعارُ الناشر', 'يقرؤه جوجل في البيانات المهيكلة، ويظهر في بطاقة الخبر'],
    ['favicon', 'أيقونةُ اللسان', 'الصورةُ الصغيرةُ في لسان المتصفّح'],
    ['share', 'صورةُ المشاركة', 'ما يظهر حين يُلصق رابطُ الموقع في فيسبوك أو واتساب']
  ];

  let CONFIG = null;
  let CATALOG = null;

  const blank = () => ({
    identity: {}, appearance: {}, visibility: {}, links: {}, team: [],
    sections: [], conference: {}
  });

  async function loadDesign() {
    if (!CONFIG) {
      const snap = await db.ref('site_config').once('value');
      CONFIG = { ...blank(), ...(snap.val() || {}) };
      CONFIG.identity = CONFIG.identity || {};
      CONFIG.appearance = CONFIG.appearance || {};
      CONFIG.visibility = CONFIG.visibility || {};
      CONFIG.links = CONFIG.links || {};
      CONFIG.conference = CONFIG.conference || {};
      // ما في القاعدة أولى؛ فإن خلت فأقسامُ البناء هي نقطةُ البداية
      CONFIG.sections = Array.isArray(CONFIG.sections) && CONFIG.sections.length
        ? CONFIG.sections
        : SECTIONS.map((s) => ({ ...s }));
      setSections(CONFIG.sections);
    }
    if (!CATALOG) {
      try {
        CATALOG = await (await fetch('/themes.json', { cache: 'no-cache' })).json();
      } catch { CATALOG = { themes: [] }; }
    }
  }

  routes.design = async (tab) => {
    setActive('design');
    view.innerHTML = '<div class="empty">جارٍ تحميلُ الإعدادات…</div>';
    await loadDesign();
    S.designTab = tab || S.designTab || 'identity';
    drawDesign();
  };

  const TABS = [
    ['identity', 'الهويّة'],
    ['conference', 'بياناتُ المؤتمر'],
    ['theme', 'التصميم'],
    ['layout', 'التنسيق'],
    ['links', 'الروابط'],
    ['visibility', 'الإظهارُ والإخفاء']
  ];

  function drawDesign() {
    const tab = S.designTab;
    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>الهويّة والتصميم</h1>
          <p>اسمُ الموقع وشعارُه وألوانُه وروابطُه — وما يظهر منه وما يُخفى.</p>
        </div>
        <div class="page-acts">
          <button class="btn btn--brand" type="button" id="design-save">حفظُ الإعدادات</button>
        </div>
      </div>

      <div class="filters" role="tablist">
        ${TABS.map(([id, label]) =>
          `<button class="btn ${tab === id ? 'btn--brand' : 'btn--ghost'} btn--sm" type="button" data-tab="${id}">${label}</button>`).join('')}
      </div>

      <div id="design-body">${
        tab === 'identity' ? identityTab()
        : tab === 'conference' ? conferenceTab()
        : tab === 'theme' ? themeTab()
        : tab === 'layout' ? layoutTab()
        : tab === 'links' ? linksTab()
        : visibilityTab()}</div>

      <div class="banner" style="margin-block-start:1.2rem">
        <div class="banner__body">
          <strong>التصميمُ والتنسيقُ يصلان الموقعَ كلَّه دون بناء</strong>
          <span>يحفظهما الزرُّ في القاعدة، فيلبسهما كلُّ زائرٍ عند فتحه الصفحةَ التالية.
                أمّا الاسمُ والشعارُ والروابطُ فتُطبع في الصفحات، وتحتاج بناءً:</span>
          <code>python build.py --sync</code>
        </div>
      </div>`;

    view.querySelector('.filters').addEventListener('click', (e) => {
      const button = e.target.closest('[data-tab]');
      if (!button) return;
      collectDesign();
      S.designTab = button.dataset.tab;
      drawDesign();
    });
    $('#design-save').addEventListener('click', saveDesign);
    bindDesignTab();
  }

  /* ─── الهويّة ────────────────────────────────────────── */
  function identityTab() {
    const id = CONFIG.identity;
    return `
      <div class="grid grid--2">
        <div class="card">
          <div class="card__head"><h2>الاسمُ والنصوص</h2></div>
          <label class="field">
            <span class="field__label">اسمُ الموقع</span>
            <input class="field__input" data-id="title" value="${esc(id.title || CFG.siteTitle || '')}" placeholder="EACR Conference">
          </label>
          <label class="field">
            <span class="field__label">الشعارُ النصّي (تحت الاسم)</span>
            <input class="field__input" data-id="tagline" value="${esc(id.tagline || '')}" placeholder="المؤتمرُ السنوي للجمعيّة المصريّة لأبحاث السرطان ٢٠٢٦">
          </label>
          <label class="field">
            <span class="field__label">وصفُ الموقع — يظهر في نتائج البحث</span>
            <textarea data-id="description" rows="3" class="field__input">${esc(id.description || '')}</textarea>
          </label>
          <label class="field">
            <span class="field__label">حقوقُ النشر في الذيل</span>
            <input class="field__input" data-id="copyright" value="${esc(id.copyright || '')}" placeholder="الجمعيّة المصريّة لأبحاث السرطان">
          </label>
        </div>

        <div class="card">
          <div class="card__head"><h2>الصور</h2></div>
          ${IMAGE_FIELDS.map(([key, label, note]) => `
            <div class="imgrow" data-imgrow="${key}">
              <span class="imgrow__prev">${id[key]
                ? `<img src="${esc(id[key])}" alt="">`
                : '<span class="imgrow__none">—</span>'}</span>
              <span class="imgrow__body">
                <b>${esc(label)}</b>
                <small>${esc(note)}</small>
                <input class="field__input" data-id="${key}" dir="ltr" value="${esc(id[key] || '')}" placeholder="https://…">
              </span>
              <span class="imgrow__acts">
                <button class="btn btn--ghost btn--sm" type="button" data-pick="${key}">رفع</button>
                <button class="btn btn--ghost btn--sm" type="button" data-drop-img="${key}">مسح</button>
              </span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ─── بياناتُ المؤتمر ────────────────────────────────
     ما يُكتب هنا يظهر في صدر الرئيسيّة وصفحة «عن المؤتمر»
     وفي البيانات المهيكلة التي تقرؤها محرّكاتُ البحث. */
  const CONF_FIELDS = [
    ['التعريف', [
      ['name', 'اسمُ المؤتمر', 'المؤتمرُ السنوي للجمعيّة المصريّة لأبحاث السرطان', 'text'],
      ['edition', 'النسخةُ أو السنة', '٢٠٢٦', 'text'],
      ['organizer', 'الجهةُ المنظِّمة', 'الجمعيّةُ المصريّةُ لأبحاث السرطان', 'text'],
      ['organizer_en', 'اسمُها بالإنجليزيّة', 'Egyptian Association of Cancer Research', 'text']
    ]],
    ['المكانُ والموعد', [
      ['venue', 'مكانُ الانعقاد', 'المركزُ القوميُّ للبحوث', 'text'],
      ['address', 'العنوانُ التفصيلي', 'شارعُ البحوث — الدقّي، الجيزة', 'text'],
      ['city', 'المدينة', 'القاهرة', 'text'],
      ['country', 'الدولة', 'مصر', 'text'],
      ['map', 'رابطُ الخريطة', 'https://maps.google.com/…', 'url'],
      ['starts', 'تاريخُ البداية', '', 'date'],
      ['ends', 'تاريخُ النهاية', '', 'date'],
      ['date_label', 'نصُّ الموعد — يُعرض بدل التاريخ إن لم يُحدَّد', 'من ١٥ إلى ١٧ نوفمبر ٢٠٢٦', 'text']
    ]],
    ['المشاركةُ والتواصل', [
      ['register_url', 'رابطُ التسجيل — الزرُّ لا يظهر ما دام فارغاً', 'https://…', 'url'],
      ['abstract_url', 'رابطُ إرسال الملخّصات', 'https://…', 'url'],
      ['email', 'بريدُ المؤتمر', 'info@example.com', 'email'],
      ['phone', 'هاتفُ المؤتمر', '+20…', 'tel']
    ]]
  ];

  const PERSON_FIELDS = [
    ['patron', 'الراعي'],
    ['president', 'رئيسُ المؤتمر']
  ];

  function conferenceTab() {
    const c = CONFIG.conference || {};
    const field = ([key, label, placeholder, type]) => `
      <label class="field">
        <span class="field__label">${esc(label)}</span>
        <input class="field__input" type="${type === 'text' ? 'text' : type}" data-conf="${key}"
               ${type === 'url' || type === 'email' || type === 'tel' ? 'dir="ltr"' : ''}
               value="${esc(c[key] || '')}" placeholder="${esc(placeholder)}">
      </label>`;

    const person = ([key, title]) => {
      const p = c[key] || {};
      return `
        <div class="card">
          <div class="card__head"><h2>${esc(title)}</h2></div>
          <div class="imgrow">
            <span class="imgrow__prev">${p.photo
              ? `<img src="${esc(p.photo)}" alt="">`
              : '<span class="imgrow__none">—</span>'}</span>
            <span class="imgrow__body">
              <b>الصورة (اختياريّة)</b>
              <small>تظهر فوق الاسم في شريط الرعاية</small>
              <input class="field__input" data-conf="${key}.photo" dir="ltr"
                     value="${esc(p.photo || '')}" placeholder="https://…">
            </span>
            <span class="imgrow__acts">
              <button class="btn btn--ghost btn--sm" type="button" data-conf-pick="${key}.photo">رفع</button>
            </span>
          </div>
          <label class="field">
            <span class="field__label">العبارةُ فوق الاسم</span>
            <input class="field__input" data-conf="${key}.label"
                   value="${esc(p.label || '')}" placeholder="${key === 'patron' ? 'تحت رعاية' : 'رئيسُ المؤتمر'}">
          </label>
          <label class="field">
            <span class="field__label">الاسم</span>
            <input class="field__input" data-conf="${key}.name"
                   value="${esc(p.name || '')}" placeholder="الأستاذ الدكتور …">
          </label>
          <label class="field">
            <span class="field__label">الصفةُ والمنصب</span>
            <textarea class="field__input" rows="2" data-conf="${key}.role"
                      placeholder="رئيسُ المركز القومي للبحوث · …">${esc(p.role || '')}</textarea>
          </label>
        </div>`;
    };

    return `
      ${CONF_FIELDS.map(([group, rows]) => `
        <div class="card" style="margin-block-end:1rem">
          <div class="card__head"><h2>${esc(group)}</h2></div>
          <div class="grid grid--2">${rows.map(field).join('')}</div>
        </div>`).join('')}

      <div class="grid grid--2">${PERSON_FIELDS.map(person).join('')}</div>
    `;
  }

  /* ─── التصميم ───────────────────────────────────────── */
  function themeTab() {
    const app = CONFIG.appearance;
    const groups = {};
    (CATALOG.themes || []).forEach((t) => { (groups[t.group] = groups[t.group] || []).push(t); });

    return `
      <div class="card" style="margin-block-end:1rem">
        <div class="card__head">
          <h2>لمساتُك الخاصّة</h2>
          <p>تتقدّم على التصميم المختار</p>
        </div>
        <div class="tune">
          <label class="tune__item">
            <span class="field__label">لونُ العلامة</span>
            <input type="color" data-app="brand" value="${esc(app.brand || '#C2185B')}">
          </label>
          <label class="tune__item">
            <span class="field__label">لونُ الشرارة</span>
            <input type="color" data-app="spark" value="${esc(app.spark || '#E0245E')}">
          </label>
          <label class="tune__item">
            <span class="field__label">الزوايا</span>
            <select data-app="radius">
              ${['', 'soft', 'sharp', 'round', 'pill'].map((r) => `
                <option value="${r}"${(app.radius || '') === r ? ' selected' : ''}>${
                  { '': 'كما في التصميم', soft: 'ليّنة', sharp: 'حادّة', round: 'دائريّة', pill: 'حبّة' }[r]}</option>`).join('')}
            </select>
          </label>
          <button class="btn btn--ghost btn--sm" type="button" id="tune-reset">إلغاءُ اللمسات</button>
        </div>
      </div>

      ${Object.entries(groups).map(([group, list]) => `
        <p class="side__label" style="margin-inline:0">${esc(group)}</p>
        <div class="themes">
          ${list.map((t) => `
            <button class="theme${app.theme === t.id ? ' is-on' : ''}" type="button" data-theme-pick="${esc(t.id)}"
                    style="--t-paper:${t.swatch[0]};--t-surface:${t.swatch[1]};--t-brand:${t.swatch[2]};--t-spark:${t.swatch[3]};--t-ink:${t.swatch[4]}">
              <span class="theme__prev">
                <span class="theme__bar"></span>
                <span class="theme__line"></span>
                <span class="theme__line theme__line--half"></span>
                <span class="theme__pill"></span>
              </span>
              <span class="theme__name">${esc(t.name)}</span>
              <span class="theme__note">${esc(t.note || (t.mode === 'dark' ? 'ليليّ' : ''))}</span>
            </button>`).join('')}
        </div>`).join('')}`;
  }

  /* ─── التنسيق: هيكلُ الصفحة لا لونُها ──────────────────── */
  function layoutTab() {
    const current = CONFIG.appearance.layout || 'classic';
    const groups = {};
    (CATALOG.layouts || []).forEach((l) => { (groups[l.group] = groups[l.group] || []).push(l); });

    if (!Object.keys(groups).length) {
      return '<div class="empty">لم تصل قائمةُ التنسيقات — أعد بناءَ الموقع مرّةً: <code>python build.py</code></div>';
    }

    return `
      <div class="card" style="margin-block-end:1rem">
        <div class="card__head">
          <h2>عشرون تنسيقاً</h2>
          <p>التصميمُ يختار الألوان، والتنسيقُ يختار الهيكل: عرضَ الصفحة ونَفَسَ
             المسافات وشكلَ البطاقة ونسبةَ الصورة وصدرَ الرئيسيّة وهيئةَ الشريط العلويّ.</p>
        </div>
      </div>

      ${Object.entries(groups).map(([group, list]) => `
        <p class="side__label" style="margin-inline:0">${esc(group)}</p>
        <div class="plans">
          ${list.map((l) => `
            <button class="plan${current === l.id ? ' is-on' : ''}" type="button" data-layout-pick="${esc(l.id)}">
              <span class="plan__prev" data-p-masthead="${esc(l.masthead)}" data-p-hero="${esc(l.hero)}"
                    data-p-cards="${esc(l.cards)}" data-p-density="${esc(l.density)}" data-p-shell="${esc(l.shell)}">
                <span class="plan__bar"><i></i><i></i></span>
                <span class="plan__hero"><i class="plan__media"></i><i class="plan__side"></i></span>
                <span class="plan__grid"><i></i><i></i><i></i></span>
              </span>
              <span class="plan__name">${esc(l.name)}</span>
              <span class="plan__note">${esc(l.note || PLAN_WORDS[l.hero] || '')}</span>
            </button>`).join('')}
        </div>`).join('')}`;
  }

  const PLAN_WORDS = {
    split: 'صدرٌ ومختارات',
    stack: 'صدرٌ ممتدٌّ فوق شبكة',
    wide: 'عنوانٌ عريض',
    poster: 'غلافٌ والعنوانُ فوقه',
    list: 'قائمةٌ بلا غلاف'
  };

  /* ─── الروابط ───────────────────────────────────────── */
  function linksTab() {
    const rowHTML = (set, row = {}, index = 0) => `
      <div class="mini__row" data-link="${set}" data-index="${index}">
        <input type="text" class="link-name" value="${esc(row.name || '')}" placeholder="الاسم" style="flex:1">
        <input type="text" class="link-url" dir="ltr" value="${esc(row.url || '')}" placeholder="/path أو https://…" style="flex:1.4">
        <button class="btn btn--ghost btn--sm" type="button" data-link-up>↑</button>
        <button class="btn btn--ghost btn--sm" type="button" data-link-rm>حذف</button>
      </div>`;

    return `<div class="grid">${LINK_SETS.map(([key, label, note]) => `
      <div class="card">
        <div class="card__head">
          <h2>${esc(label)}</h2>
          ${note ? `<p>${esc(note)}</p>` : ''}
        </div>
        <div class="mini" data-links="${key}">
          ${(CONFIG.links[key] || []).map((row, i) => rowHTML(key, row, i)).join('')
            || '<p class="row-sub">لا روابطَ — سيُستعمل ما في site.yml.</p>'}
        </div>
        <div class="save-row" style="margin-block-start:.6rem">
          <button class="btn btn--ghost btn--sm" type="button" data-link-add="${key}">＋ رابط</button>
        </div>
      </div>`).join('')}</div>`;
  }

  /* ─── الإظهارُ والإخفاء ─────────────────────────────── */
  function visibilityTab() {
    const vis = CONFIG.visibility;
    return `<div class="grid grid--2">${VIS_GROUPS.map(([group, rows]) => `
      <div class="card">
        <div class="card__head"><h2>${esc(group)}</h2></div>
        <div class="mini">
          ${rows.map(([key, label]) => `
            <label class="mini__row switchrow">
              <span>${esc(label)}</span>
              <span class="spacer"></span>
              <input type="checkbox" class="switch" data-vis="${key}" ${vis[key] === false ? '' : 'checked'}>
            </label>`).join('')}
        </div>
      </div>`).join('')}</div>`;
  }

  /* ─── الربطُ والحفظ ─────────────────────────────────── */
  function bindDesignTab() {
    const body = $('#design-body');
    if (!body) return;

    body.addEventListener('click', async (event) => {
      const pick = event.target.closest('[data-pick]');
      if (pick) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
          if (!input.files[0]) return;
          toast('جارٍ الرفع…');
          try {
            const url = await uploadImage(input.files[0]);
            CONFIG.identity[pick.dataset.pick] = url;
            drawDesign();
            toast('رُفعت الصورة', 'ok');
          } catch { toast('تعذّر الرفع', 'bad'); }
        };
        input.click();
        return;
      }

      const confPick = event.target.closest('[data-conf-pick]');
      if (confPick) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
          if (!input.files || !input.files[0]) return;
          toast('جارٍ رفعُ الصورة…');
          try {
            const url = await uploadImage(input.files[0]);
            const box = $(`#design-body [data-conf="${confPick.dataset.confPick}"]`);
            if (box) box.value = url;
            collectDesign();
            drawDesign();
          } catch { toast('تعذّر الرفع', 'bad'); }
        };
        input.click();
        return;
      }

      const drop = event.target.closest('[data-drop-img]');
      if (drop) {
        collectDesign();
        delete CONFIG.identity[drop.dataset.dropImg];
        drawDesign();
        return;
      }

      const theme = event.target.closest('[data-theme-pick]');
      if (theme) {
        collectDesign();
        CONFIG.appearance.theme = theme.dataset.themePick;
        previewTheme(theme.dataset.themePick);
        drawDesign();
        return;
      }

      const layout = event.target.closest('[data-layout-pick]');
      if (layout) {
        collectDesign();
        CONFIG.appearance.layout = layout.dataset.layoutPick;
        const picked = (CATALOG.layouts || []).find((l) => l.id === layout.dataset.layoutPick);
        drawDesign();
        if (picked) toast(`التنسيق: ${picked.name}`);
        return;
      }

      if (event.target.closest('#tune-reset')) {
        collectDesign();
        delete CONFIG.appearance.brand;
        delete CONFIG.appearance.spark;
        delete CONFIG.appearance.radius;
        drawDesign();
        return;
      }

      const add = event.target.closest('[data-link-add]');
      if (add) {
        collectDesign();
        const key = add.dataset.linkAdd;
        CONFIG.links[key] = [...(CONFIG.links[key] || []), { name: '', url: '' }];
        drawDesign();
        return;
      }

      const row = event.target.closest('[data-link]');
      if (row && event.target.closest('[data-link-rm]')) {
        collectDesign();
        const key = row.dataset.link;
        CONFIG.links[key].splice(Number(row.dataset.index), 1);
        drawDesign();
        return;
      }
      if (row && event.target.closest('[data-link-up]')) {
        collectDesign();
        const key = row.dataset.link;
        const at = Number(row.dataset.index);
        if (at > 0) {
          const list = CONFIG.links[key];
          [list[at - 1], list[at]] = [list[at], list[at - 1]];
        }
        drawDesign();
      }
    });

    /* معاينةُ اللون فوراً على اللوحة نفسِها */
    body.addEventListener('input', (event) => {
      const app = event.target.closest('[data-app]');
      if (app && app.dataset.app === 'brand') {
        document.documentElement.style.setProperty('--brand', app.value);
      }
    });
  }

  function previewTheme(id) {
    const theme = (CATALOG.themes || []).find((t) => t.id === id);
    if (!theme) return;
    Object.entries(theme.vars).forEach(([name, value]) => {
      if (name === '--font-display' || name === '--font-body') return;
      document.documentElement.style.setProperty(name, value);
    });
    toast(`معاينة: ${theme.name}`);
  }

  function collectDesign() {
    $$('#design-body [data-id]').forEach((node) => {
      const value = node.value.trim();
      if (value) CONFIG.identity[node.dataset.id] = value;
      else delete CONFIG.identity[node.dataset.id];
    });
    $$('#design-body [data-app]').forEach((node) => {
      const value = node.value.trim();
      if (value) CONFIG.appearance[node.dataset.app] = value;
      else delete CONFIG.appearance[node.dataset.app];
    });
    $$('#design-body [data-vis]').forEach((node) => {
      CONFIG.visibility[node.dataset.vis] = node.checked;
    });
    // حقولُ المؤتمر تُكتب بمسارٍ منقوطٍ مثل patron.name
    $$('#design-body [data-conf]').forEach((node) => {
      const path = node.dataset.conf.split('.');
      const value = node.value.trim();
      let host = CONFIG.conference;
      while (path.length > 1) {
        const key = path.shift();
        host[key] = host[key] || {};
        host = host[key];
      }
      if (value) host[path[0]] = value;
      else delete host[path[0]];
    });
    LINK_SETS.forEach(([key]) => {
      const host = $(`#design-body [data-links="${key}"]`);
      if (!host) return;
      const rows = $$('[data-link]', host).map((row) => ({
        name: $('.link-name', row).value.trim(),
        url: $('.link-url', row).value.trim()
      })).filter((row) => row.name && row.url);
      if (rows.length) CONFIG.links[key] = rows;
      else delete CONFIG.links[key];
    });
  }

  async function saveDesign() {
    collectDesign();
    const button = $('#design-save');
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ…';
    try {
      await db.ref('site_config').set({
        ...CONFIG,
        updatedAt: Date.now(),
        updatedBy: S.user.email || ''
      });
      toast('حُفظت الإعدادات — التصميمُ والتنسيقُ يظهران في الموقع فوراً', 'ok');
    } catch (error) {
      toast(error?.code === 'PERMISSION_DENIED'
        ? 'القواعدُ تمنع الكتابة في site_config — حدّث firebase-rules.json'
        : 'تعذّر الحفظ', 'bad');
    } finally {
      button.disabled = false;
      button.textContent = 'حفظُ الإعدادات';
    }
  }

  /* ═══════════ الإعدادات والنسخ ══════════════════════ */
  const NODES = () => [...SECTION_IDS, 'categories', 'sponsors', 'site_config', 'site_texts'];

  routes.settings = () => {
    setActive('settings');
    const heavy = S.items.filter((i) => i.heavy);

    view.innerHTML = `
      <div class="page-head">
        <div><h1>الإعدادات والنسخ</h1><p>صيانةُ البيانات وحمايتُها.</p></div>
      </div>

      <div class="grid grid--2">
        <div class="card">
          <div class="card__head"><h2>النسخُ الاحتياطي</h2></div>
          <p class="row-sub">ملفٌّ واحدٌ يحوي كلَّ ما في القاعدة: المواد والموضوعات والأسئلة والنتائج.</p>
          <div class="save-row" style="margin-block-start:.9rem">
            <button class="btn btn--brand" type="button" id="do-export">تنزيلُ نسخة</button>
            <button class="btn btn--ghost" type="button" id="do-import">استيرادُ نسخة</button>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><h2>تنظيفُ الصور المضمّنة</h2></div>
          <p class="row-sub">
            ${heavy.length
              ? `${heavy.length} مادّةً تحمل صوراً بترميز base64 داخل نصّها. الأداةُ ترفع كلَّ صورةٍ إلى المستضيف وتستبدل الرابطَ في القاعدة — فتخفّ الصفحاتُ والخلاصةُ ولوحةُ التحرير نفسُها.`
              : 'لا توجد صورٌ مضمّنة. القاعدةُ نظيفة.'}
          </p>
          <div class="save-row" style="margin-block-start:.9rem">
            <button class="btn btn--brand" type="button" id="do-clean" ${heavy.length ? '' : 'disabled'}>ابدأ التنظيف</button>
          </div>
          <p class="autosave" id="clean-log"></p>
        </div>

        <div class="card">
          <div class="card__head"><h2>الحساب</h2></div>
          <div class="mini">
            <div class="mini__row"><span>البريد</span><span class="spacer"></span><span class="row-sub" dir="ltr">${esc(S.user.email || '')}</span></div>
            <div class="mini__row"><span>آخرُ دخول</span><span class="spacer"></span><span class="row-sub">${esc(ago(Number(S.user.metadata?.lastSignInTime ? Date.parse(S.user.metadata.lastSignInTime) : 0)))}</span></div>
          </div>
          <div class="save-row" style="margin-block-start:.9rem">
            <button class="btn btn--ghost" type="button" id="do-reset">تغييرُ كلمة المرور بالبريد</button>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><h2>نشرُ الموقع</h2></div>
          <p class="row-sub">اللوحةُ تكتب في القاعدة مباشرةً، والموقعُ الثابتُ يُبنى من سطر أوامرَ واحد ثمّ يُدفع إلى GitHub:</p>
          <p><code style="display:block;direction:ltr;font-family:var(--font-mono);background:var(--paper-2);border:1px solid var(--line);border-radius:8px;padding:.5rem .7rem;margin-block:.5rem">python build.py --sync</code></p>
          <p class="row-sub">آخرُ بناءٍ معروف: ${esc(S.builtAt ? ago(S.builtAt) : 'غيرُ معروف')}.</p>
        </div>
      </div>`;

    $('#do-export').addEventListener('click', exportAll);
    $('#do-import').addEventListener('click', importAll);
    $('#do-clean').addEventListener('click', () => cleanEmbedded(heavy));
    $('#do-reset').addEventListener('click', async () => {
      try {
        await auth.sendPasswordResetEmail(S.user.email);
        toast('أُرسل رابطُ تغيير كلمة المرور إلى بريدك', 'ok');
      } catch { toast('تعذّر الإرسال', 'bad'); }
    });
  };

  function download(name, text, mime = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportAll() {
    toast('جارٍ تجميعُ النسخة…');
    const payload = {};
    for (const node of NODES()) payload[node] = (await db.ref(node).once('value')).val();
    download(`eacr-backup-${isoOf(Date.now())}.json`, JSON.stringify(payload, null, 2));
    toast('نُزّلت النسخة', 'ok');
  }

  function importAll() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const ok = await confirmBox('استيرادُ نسخة',
        'سيُستبدل محتوى العُقد الموجودة في الملفّ بما فيه. صدّر نسخةً احتياطيّةً أوّلاً.', 'استيراد');
      if (!ok) return;
      try {
        const data = JSON.parse(await file.text());
        for (const [node, value] of Object.entries(data)) {
          if (value != null) await db.ref(node).set(value);
        }
        await loadAll();
        countsPaint();
        toast('اكتمل الاستيراد', 'ok');
        go('#/dashboard');
      } catch { toast('الملفُّ غيرُ صالح', 'bad'); }
    };
    input.click();
  }

  async function cleanEmbedded(list) {
    const ok = await confirmBox('تنظيفُ الصور',
      `ستُرفع صورُ ${list.length} مادّةٍ إلى المستضيف وتُحدَّث القاعدة. قد يستغرق ذلك دقائق.`, 'ابدأ');
    if (!ok) return;

    const log = $('#clean-log');
    const button = $('#do-clean');
    button.disabled = true;
    let images = 0;

    for (const [index, item] of list.entries()) {
      log.textContent = `(${index + 1}/${list.length}) ${item.title}`;
      const snap = await db.ref(`${item.type}/${item.id}`).once('value');
      const raw = snap.val();
      if (!raw) continue;

      const holder = document.createElement('div');
      holder.innerHTML = raw.content || '';
      for (const image of Array.from(holder.querySelectorAll('img[src^="data:image"]'))) {
        try {
          image.setAttribute('src', await uploadImage(dataUriToBlob(image.src)));
          images += 1;
        } catch { /* نتجاوزها */ }
      }

      const patch = { content: holder.innerHTML };
      for (const key of ['image', 'imageUrl']) {
        if (typeof raw[key] === 'string' && raw[key].startsWith('data:image')) {
          try { patch[key] = await uploadImage(dataUriToBlob(raw[key])); images += 1; } catch { /* لا شيء */ }
        }
      }
      await db.ref(`${item.type}/${item.id}`).update(patch);
    }

    await loadAll();
    countsPaint();
    log.textContent = `اكتمل: رُفعت ${images} صورة.`;
    toast(`نُظّفت ${list.length} مادّة`, 'ok');
    routes.settings();
  }

  /* ═══════════ العدّاداتُ والقشرة ════════════════════ */
  function countsPaint() {
    $('[data-count-all]').textContent = S.items.length;
    const pending = S.comments.filter((c) => c.approved === false).length;
    const badge = document.querySelector('[data-count-comments]');
    if (badge) badge.textContent = pending ? `${pending} جديد` : String(S.comments.length);
    SECTION_IDS.forEach((id) => {
      const node = document.querySelector(`[data-count="${id}"]`);
      if (node) node.textContent = S.items.filter((i) => i.type === id).length;
    });
  }

  /* ═══════════ الدخول ════════════════════════════════ */
  const gate = $('#gate');
  const shell = $('#shell');

  $('#toggle-pass').addEventListener('click', () => {
    const input = $('#login-pass');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-pass').value;
    const error = $('#login-error');
    const button = $('#login-submit');
    error.hidden = true;

    if (!email || !password) { error.textContent = 'اكتب البريدَ وكلمةَ المرور.'; error.hidden = false; return; }

    button.disabled = true;
    button.textContent = 'جارٍ الدخول…';
    try {
      await auth.setPersistence($('#login-remember').checked
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION);
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      error.textContent = AUTH_ERRORS[err.code] || 'تعذّر الدخول. حاول مرّةً أخرى.';
      error.hidden = false;
      button.disabled = false;
      button.textContent = 'دخول';
    }
  });

  $('#forgot').addEventListener('click', async () => {
    const email = $('#login-email').value.trim();
    const error = $('#login-error');
    if (!email) { error.textContent = 'اكتب بريدَك أوّلاً ثمّ اضغط الرابط.'; error.hidden = false; return; }
    try {
      await auth.sendPasswordResetEmail(email);
      error.hidden = true;
      toast('أُرسل رابطُ إعادة التعيين إلى بريدك', 'ok');
    } catch (err) {
      error.textContent = AUTH_ERRORS[err.code] || 'تعذّر الإرسال.';
      error.hidden = false;
    }
  });

  $('#signout').addEventListener('click', async () => {
    if (S.dirty && !await confirmBox('مغادرة', 'هناك تعديلاتٌ لم تُحفظ. أتخرج؟', 'خروج')) return;
    await auth.signOut();
    window.location.reload();
  });

  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.write('eacr:admin:theme', next);
  });

  $('#side-toggle').addEventListener('click', () => $('#side').classList.toggle('is-open'));

  const searchBox = $('#global-search');
  searchBox.addEventListener('input', debounce((e) => {
    S.filter.q = e.target.value;
    S.filter.page = 1;
    if (!window.location.hash.startsWith('#/content')) go('#/content');
    else drawContent();
  }, 250));

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === '/' && !typing) { e.preventDefault(); searchBox.focus(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.editing && $('#save')) {
      e.preventDefault();
      $('#save').click();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (S.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  const netPill = $('#net-state');
  const paintNet = () => { netPill.hidden = navigator.onLine; };
  window.addEventListener('online', paintNet);
  window.addEventListener('offline', paintNet);
  paintNet();

  /* ═══════════ الإقلاع ═══════════════════════════════ */
  auth.onAuthStateChanged(async (user) => {
    document.body.classList.remove('is-booting');
    if (!user) {
      gate.hidden = false;
      shell.hidden = true;
      $('#login-email').focus();
      return;
    }
    S.user = user;
    gate.hidden = true;
    shell.hidden = false;
    $('#who-avatar').textContent = (user.email || '؟')[0];
    $('#who-name').textContent = (user.email || '').split('@')[0];
    $('#who-mail').textContent = user.email || '';

    view.innerHTML = '<div class="empty"><strong>جارٍ تحميلُ المحتوى…</strong>قد يستغرق ذلك ثوانيَ في أوّل فتح.</div>';
    try {
      // الإعداداتُ قبل المحتوى: منها نعرف أقسامَ الموقع الحاليّة
      await loadDesign().catch(() => {});
      await loadAll();
      const sponsors = await db.ref('sponsors').once('value').catch(() => null);
      S.sponsorCount = Object.keys((sponsors && sponsors.val()) || {}).length;
    } catch (error) {
      view.innerHTML = `<div class="empty"><strong>تعذّرت قراءةُ القاعدة</strong>
        ${error?.code === 'PERMISSION_DENIED'
          ? 'قواعدُ أمان Firebase تمنع القراءة لهذا الحساب — راجع firebase-rules.json في المستودع.'
          : 'تحقّق من الاتّصال ثمّ أعد التحميل.'}</div>`;
      return;
    }
    countsPaint();
    render();
  });
})();
