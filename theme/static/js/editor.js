/* ═══ محرّرُ المنشورات ══════════════════════════════════════════
   Quill نواةً، وفوقه ما يحتاجه محرّرٌ صحفيّ فعلاً:

   · شريطُ أدواتٍ عربيٌّ مجموعٌ بالوظيفة، لاصقٌ عند التمرير.
   · جداولُ وإطاراتٌ مدمجةٌ تبقى كما هي — Quill يبتلعها عادةً،
     فسجّلنا لها نوعاً خاصّاً يحفظ شيفرتَها ويعرضها كما تظهر.
   · تنظيفُ اللصق: ما يأتي من وورد ومستندات جوجل يُجرَّد من
     ألوانه وخطوطه ومقاساته، ويبقى معناه: عنوانٌ وقائمةٌ ورابط.
   · عرضُ الشيفرة، وبحثٌ واستبدال، وشاشةٌ كاملة، وعدّادُ كلمات.

   لا يعرف هذا الملفّ شيئاً عن Firebase؛ يتلقّى دالّةَ الرفع من
   مُستدعيه، فيصلح للوحة وللمعاينة سواء.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  if (!window.Quill) return;

  const Delta = Quill.import('delta');
  const BlockEmbed = Quill.import('blots/block/embed');

  /* ─── الكتلةُ الخام: جدولٌ أو إطارٌ يبقى بشيفرته ────────── */
  class RawHtml extends BlockEmbed {
    static create(value) {
      const node = super.create();
      node.setAttribute('data-raw', encodeURIComponent(value || ''));
      node.setAttribute('contenteditable', 'false');
      node.innerHTML = value || '';
      return node;
    }
    static value(node) {
      const raw = node.getAttribute('data-raw');
      return raw ? decodeURIComponent(raw) : node.innerHTML;
    }
  }
  RawHtml.blotName = 'rawHtml';
  RawHtml.tagName = 'DIV';
  RawHtml.className = 'ql-raw';
  Quill.register(RawHtml, true);

  /* ─── الشريط ───────────────────────────────────────────── */
  const icon = (paths, extra = '') => (
    `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" ${extra}>${paths}</svg>`
  );

  const ICONS = {
    undo: icon('<path d="M9 14 4 9l5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h9a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    redo: icon('<path d="m15 14 5-5-5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 9h-9a6 6 0 0 0 0 12h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    bold: '<b style="font-size:15px">ب</b>',
    italic: '<i style="font-size:15px">م</i>',
    underline: '<u style="font-size:15px">خ</u>',
    strike: '<s style="font-size:15px">ش</s>',
    ul: icon('<path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor"/>'),
    ol: icon('<path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><text x="2" y="8" font-size="7" fill="currentColor">1</text><text x="2" y="14.5" font-size="7" fill="currentColor">2</text><text x="2" y="21" font-size="7" fill="currentColor">3</text>'),
    quote: icon('<path d="M7 7H4v5c0 2 1 3 3 3M17 7h-3v5c0 2 1 3 3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    code: icon('<path d="m9 8-4 4 4 4M15 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    link: icon('<path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.2 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.4-1.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
    image: icon('<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="8.5" cy="10" r="1.5" fill="currentColor"/><path d="m4 17 5-5 4 4 3-2 4 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'),
    video: icon('<rect x="3" y="6" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 12 5-3v9l-5-3z" fill="currentColor"/>'),
    table: icon('<rect x="3" y="5" width="18" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M3 14.5h18M9 5v14M15 5v14" stroke="currentColor" stroke-width="1.4"/>'),
    hr: icon('<path d="M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 7h12M6 17h12" stroke="currentColor" stroke-width="1.2" opacity=".4"/>'),
    clean: icon('<path d="M5 19h14M8 5l8 8M16 5 8 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
    find: icon('<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    source: icon('<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'),
    expand: icon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    rtl: '<b style="font-size:12px">ع</b>',
    ltr: '<b style="font-size:12px">A</b>'
  };

  const ALIGN = [
    { value: '', label: 'محاذاةٌ إلى البداية', glyph: 'M4 6h16M4 11h11M4 16h16M4 21h9' },
    { value: 'center', label: 'توسيط', glyph: 'M4 6h16M6.5 11h11M4 16h16M7.5 21h9' },
    { value: 'left', label: 'محاذاةٌ إلى اليسار', glyph: 'M4 6h16M4 11h11M4 16h16M4 21h9' },
    { value: 'justify', label: 'ضبطٌ من الطرفين', glyph: 'M4 6h16M4 11h16M4 16h16M4 21h16' }
  ];

  const COLORS = ['#15141B', '#16597D', '#0F9D8F', '#E0245E', '#D97706', '#7C3AED', '#DC2626', '#6A6775'];
  const MARKS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA', ''];

  function toolbarHTML() {
    const btn = (act, title, body, extra = '') =>
      `<button type="button" class="tb__b" data-act="${act}" title="${title}" aria-label="${title}" ${extra}>${body}</button>`;

    return `
      <div class="tb__g">
        ${btn('undo', 'تراجع (Ctrl+Z)', ICONS.undo)}
        ${btn('redo', 'إعادة (Ctrl+Y)', ICONS.redo)}
      </div>

      <div class="tb__g">
        <select class="tb__sel" data-act="header" title="مستوى النصّ">
          <option value="">نصٌّ عاديّ</option>
          <option value="2">عنوانٌ رئيسي</option>
          <option value="3">عنوانٌ فرعي</option>
          <option value="4">عنوانٌ صغير</option>
        </select>
      </div>

      <div class="tb__g">
        ${btn('bold', 'عريض (Ctrl+B)', ICONS.bold)}
        ${btn('italic', 'مائل — يظهر مُظلَّلاً في الموقع (Ctrl+I)', ICONS.italic)}
        ${btn('underline', 'تحته خطّ (Ctrl+U)', ICONS.underline)}
        ${btn('strike', 'مشطوب', ICONS.strike)}
      </div>

      <div class="tb__g">
        <span class="tb__pop">
          ${btn('color-open', 'لونُ النصّ', '<span class="tb__swatch" style="background:#16597D"></span>')}
          <span class="tb__menu" data-menu="color">
            ${COLORS.map((c) => `<button type="button" class="tb__chip" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
            <button type="button" class="tb__chip tb__chip--off" data-color="" title="بلا لون">×</button>
          </span>
        </span>
        <span class="tb__pop">
          ${btn('mark-open', 'تظليل', '<span class="tb__swatch" style="background:#FEF08A"></span>')}
          <span class="tb__menu" data-menu="mark">
            ${MARKS.filter(Boolean).map((c) => `<button type="button" class="tb__chip" data-mark="${c}" style="background:${c}" title="${c}"></button>`).join('')}
            <button type="button" class="tb__chip tb__chip--off" data-mark="" title="بلا تظليل">×</button>
          </span>
        </span>
      </div>

      <div class="tb__g">
        ${btn('list-bullet', 'قائمةٌ نقطيّة', ICONS.ul)}
        ${btn('list-ordered', 'قائمةٌ مرقّمة', ICONS.ol)}
        ${btn('indent+', 'إزاحةٌ للداخل', '<b>←|</b>')}
        ${btn('indent-', 'إزاحةٌ للخارج', '<b>|→</b>')}
      </div>

      <div class="tb__g">
        ${ALIGN.map((a) => btn(`align:${a.value}`, a.label,
          icon(`<path d="${a.glyph}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/>`))).join('')}
      </div>

      <div class="tb__g">
        ${btn('dir:rtl', 'فقرةٌ من اليمين', ICONS.rtl)}
        ${btn('dir:ltr', 'فقرةٌ من اليسار — للاقتباس الأجنبيّ', ICONS.ltr)}
      </div>

      <div class="tb__g">
        ${btn('blockquote', 'اقتباس', ICONS.quote)}
        ${btn('code-block', 'كتلةُ شيفرة', ICONS.code)}
        ${btn('hr', 'فاصلٌ أفقيّ', ICONS.hr)}
      </div>

      <div class="tb__g">
        ${btn('link', 'رابط (Ctrl+K)', ICONS.link)}
        ${btn('image', 'صورة — تُرفع ولا تُلصق', ICONS.image)}
        ${btn('video', 'فيديو يوتيوب', ICONS.video)}
        ${btn('table', 'جدول', ICONS.table)}
      </div>

      <div class="tb__g">
        ${btn('clean', 'إزالةُ التنسيق', ICONS.clean)}
        ${btn('find', 'بحثٌ واستبدال (Ctrl+F)', ICONS.find)}
      </div>

      <div class="tb__g tb__g--end">
        ${btn('source', 'عرضُ الشيفرة', ICONS.source)}
        ${btn('full', 'شاشةٌ كاملة', ICONS.expand)}
      </div>`;
  }

  /* ─── تنظيفُ ما يأتي من وورد ومستندات جوجل ─────────────── */
  const ALLOWED_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'BR', 'CODE', 'SUP', 'SUB']);

  function scrubNode(node) {
    if (node.nodeType !== 1) return;
    node.removeAttribute('style');
    node.removeAttribute('class');
    node.removeAttribute('lang');
    Array.from(node.attributes || []).forEach((attr) => {
      if (/^(id|data-|face|color|bgcolor|width|height|align|valign|border|cellspacing|cellpadding)/i.test(attr.name)) {
        node.removeAttribute(attr.name);
      }
    });
    Array.from(node.children).forEach(scrubNode);
  }

  /* ─── البناء ───────────────────────────────────────────── */
  function create(host, options = {}) {
    const upload = options.upload || (async () => { throw new Error('no uploader'); });
    const notify = options.notify || (() => {});
    const onChange = options.onChange || (() => {});

    host.innerHTML = `
      <div class="ed" dir="rtl">
        <div class="ed__bar" role="toolbar" aria-label="أدواتُ التحرير">${toolbarHTML()}</div>
        <div class="ed__find" hidden>
          <input type="text" class="ed__q" placeholder="ابحث في المنشور…" aria-label="نصُّ البحث">
          <input type="text" class="ed__r" placeholder="استبدل بـ…" aria-label="البديل">
          <span class="ed__count"></span>
          <button type="button" class="btn btn--ghost btn--sm" data-find-prev>السابق</button>
          <button type="button" class="btn btn--ghost btn--sm" data-find-next>التالي</button>
          <button type="button" class="btn btn--ghost btn--sm" data-find-rep>استبدل</button>
          <button type="button" class="btn btn--ghost btn--sm" data-find-all>استبدل الكلّ</button>
          <button type="button" class="btn btn--ghost btn--sm" data-find-close>إغلاق</button>
        </div>
        <div class="ed__body"><div class="ed__quill"></div></div>
        <textarea class="ed__source" hidden spellcheck="false" dir="ltr"></textarea>
        <div class="ed__foot">
          <span>الكلمات <b data-words>0</b></span>
          <span>الأحرف <b data-chars>0</b></span>
          <span>زمنُ القراءة <b data-mins>0</b> د</span>
          <span class="spacer"></span>
          <span class="ed__note" data-note></span>
        </div>
      </div>`;

    const shell = host.querySelector('.ed');
    const bar = host.querySelector('.ed__bar');
    const findBox = host.querySelector('.ed__find');
    const source = host.querySelector('.ed__source');

    const quill = new Quill(host.querySelector('.ed__quill'), {
      theme: 'snow',
      placeholder: 'اكتب المنشور هنا… ألصق من وورد بلا خوف: يُنظَّف التنسيقُ ويبقى المعنى.',
      modules: {
        toolbar: false,
        history: { delay: 700, maxStack: 200, userOnly: true },
        clipboard: { matchVisual: false }
      },
      formats: ['header', 'bold', 'italic', 'underline', 'strike', 'color', 'background',
                'list', 'indent', 'align', 'direction', 'blockquote', 'code-block',
                'code', 'link', 'image', 'video', 'script', 'rawHtml']
    });
    quill.root.setAttribute('dir', 'rtl');

    /* الجداولُ والإطاراتُ تُحفظ كما هي بدل أن تُبتلع */
    ['TABLE', 'IFRAME', 'FIGURE'].forEach((tag) => {
      quill.clipboard.addMatcher(tag, (node) => {
        const clone = node.cloneNode(true);
        scrubNode(clone);
        return new Delta().insert({ rawHtml: clone.outerHTML });
      });
    });

    /* ما بقي من وورد: نُسقط الأنماطَ المضمّنة قبل أن تدخل */
    quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
      if (node.tagName === 'SPAN' && !ALLOWED_INLINE.has(node.tagName)) {
        delta.ops.forEach((op) => {
          if (op.attributes) {
            delete op.attributes.font;
            delete op.attributes.size;
          }
        });
      }
      return delta;
    });

    /* ─── حالةُ الأزرار ─────────────────────────────────── */
    const buttons = Array.from(bar.querySelectorAll('.tb__b'));
    const headerSelect = bar.querySelector('[data-act="header"]');

    const syncState = () => {
      const range = quill.getSelection();
      const fmt = range ? quill.getFormat(range) : {};
      headerSelect.value = fmt.header ? String(fmt.header) : '';
      buttons.forEach((button) => {
        const act = button.dataset.act;
        let on = false;
        if (['bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block'].includes(act)) on = !!fmt[act];
        else if (act === 'list-bullet') on = fmt.list === 'bullet';
        else if (act === 'list-ordered') on = fmt.list === 'ordered';
        else if (act.startsWith('align:')) on = (fmt.align || '') === act.slice(6);
        else if (act === 'dir:rtl') on = fmt.direction !== 'rtl' ? !fmt.direction : true;
        else if (act === 'dir:ltr') on = fmt.direction === 'rtl';
        button.classList.toggle('is-on', !!on);
      });
    };

    /* ─── العدّاد ───────────────────────────────────────── */
    const stats = () => {
      const text = quill.getText().replace(/\s+/g, ' ').trim();
      const count = text ? text.split(' ').length : 0;
      host.querySelector('[data-words]').textContent = count;
      host.querySelector('[data-chars]').textContent = text.length;
      host.querySelector('[data-mins]').textContent = Math.max(1, Math.round(count / 190));
    };

    quill.on('editor-change', () => { syncState(); });
    quill.on('text-change', () => { stats(); onChange(); });

    /* ─── الأفعال ───────────────────────────────────────── */
    const toggle = (name, value) => {
      const range = quill.getSelection(true);
      const current = quill.getFormat(range);
      quill.format(name, current[name] === value ? false : value, 'user');
      syncState();
    };

    async function insertImage() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const range = quill.getSelection(true);
        notify('جارٍ رفعُ الصورة…');
        try {
          const url = await upload(file);
          quill.insertEmbed(range.index, 'image', url, 'user');
          quill.setSelection(range.index + 1);
          notify('رُفعت الصورة', 'ok');
        } catch {
          notify('تعذّر رفعُ الصورة', 'bad');
        }
      };
      input.click();
    }

    const YT = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

    function insertVideo() {
      const url = window.prompt('ألصق رابطَ فيديو يوتيوب:');
      if (!url) return;
      const match = YT.exec(url);
      if (!match) { notify('الرابطُ ليس فيديو يوتيوب', 'bad'); return; }
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'rawHtml',
        `<iframe src="https://www.youtube-nocookie.com/embed/${match[1]}" title="فيديو" ` +
        `allowfullscreen allow="accelerometer; encrypted-media; picture-in-picture"></iframe>`, 'user');
      quill.setSelection(range.index + 1);
    }

    function insertTable() {
      const rows = Math.min(20, Math.max(1, parseInt(window.prompt('عددُ الصفوف (عدا العناوين):', '3'), 10) || 0));
      if (!rows) return;
      const cols = Math.min(8, Math.max(1, parseInt(window.prompt('عددُ الأعمدة:', '3'), 10) || 0));
      if (!cols) return;

      const head = `<tr>${Array.from({ length: cols }, (_, i) => `<th>العمود ${i + 1}</th>`).join('')}</tr>`;
      const body = Array.from({ length: rows },
        () => `<tr>${'<td>—</td>'.repeat(cols)}</tr>`).join('');
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'rawHtml',
        `<table><thead>${head}</thead><tbody>${body}</tbody></table>`, 'user');
      quill.setSelection(range.index + 1);
      notify('أُدرج الجدول — حرّره من «عرض الشيفرة»');
    }

    function insertLink() {
      const range = quill.getSelection(true);
      const current = quill.getFormat(range).link;
      const url = window.prompt('عنوانُ الرابط:', current || 'https://');
      if (url === null) return;
      if (!url || url === 'https://') { quill.format('link', false, 'user'); return; }
      if (range.length === 0) {
        const text = window.prompt('نصُّ الرابط:', url);
        if (!text) return;
        quill.insertText(range.index, text, { link: url }, 'user');
      } else {
        quill.format('link', url, 'user');
      }
    }

    function insertRule() {
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'rawHtml', '<hr>', 'user');
      quill.setSelection(range.index + 1);
    }

    /* ─── عرضُ الشيفرة ──────────────────────────────────── */
    let sourceOpen = false;
    function toggleSource() {
      const body = host.querySelector('.ed__body');
      if (!sourceOpen) {
        /* تُقرأ الشيفرةُ والرايةُ ما تزال مطفأة، وإلّا عادت الخانةَ الفارغة */
        source.value = prettify(getHTML());
        sourceOpen = true;
        source.hidden = false;
        body.hidden = true;
        shell.classList.add('is-source');
        source.focus();
      } else {
        const edited = source.value;
        sourceOpen = false;
        source.hidden = true;
        body.hidden = false;
        shell.classList.remove('is-source');
        setHTML(edited);
        onChange();
      }
      bar.querySelector('[data-act="source"]').classList.toggle('is-on', sourceOpen);
    }

    const prettify = (html) => html
      .replace(/></g, '>\n<')
      .replace(/\n{2,}/g, '\n');

    /* ─── الشاشةُ الكاملة ───────────────────────────────── */
    function toggleFull() {
      const on = shell.classList.toggle('is-full');
      document.body.classList.toggle('ed-full', on);
      bar.querySelector('[data-act="full"]').classList.toggle('is-on', on);
      if (on) quill.focus();
    }

    /* ─── بحثٌ واستبدال ─────────────────────────────────── */
    let hits = [];
    let hitIndex = -1;

    const runFind = () => {
      const needle = findBox.querySelector('.ed__q').value;
      hits = [];
      hitIndex = -1;
      if (needle) {
        const text = quill.getText();
        let at = text.indexOf(needle);
        while (at !== -1 && hits.length < 500) {
          hits.push(at);
          at = text.indexOf(needle, at + needle.length);
        }
      }
      findBox.querySelector('.ed__count').textContent = hits.length ? `${hits.length} نتيجة` : 'لا نتائج';
      if (hits.length) step(1);
    };

    const step = (by) => {
      if (!hits.length) return;
      hitIndex = (hitIndex + by + hits.length) % hits.length;
      const needle = findBox.querySelector('.ed__q').value;
      quill.setSelection(hits[hitIndex], needle.length, 'user');
      findBox.querySelector('.ed__count').textContent = `${hitIndex + 1} من ${hits.length}`;
    };

    const replaceOne = () => {
      if (hitIndex < 0 || !hits.length) return;
      const needle = findBox.querySelector('.ed__q').value;
      const value = findBox.querySelector('.ed__r').value;
      quill.deleteText(hits[hitIndex], needle.length, 'user');
      quill.insertText(hits[hitIndex], value, 'user');
      runFind();
    };

    const replaceAll = () => {
      const needle = findBox.querySelector('.ed__q').value;
      const value = findBox.querySelector('.ed__r').value;
      if (!needle) return;
      let guard = 0;
      let at = quill.getText().indexOf(needle);
      while (at !== -1 && guard++ < 500) {
        quill.deleteText(at, needle.length, 'user');
        quill.insertText(at, value, 'user');
        at = quill.getText().indexOf(needle, at + value.length);
      }
      notify(`استُبدلت ${guard} نتيجة`, 'ok');
      runFind();
    };

    const openFind = () => {
      findBox.hidden = false;
      findBox.querySelector('.ed__q').focus();
    };

    /* ─── ربطُ الشريط ───────────────────────────────────── */
    bar.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-color], [data-mark]');
      if (chip) {
        if ('color' in chip.dataset) quill.format('color', chip.dataset.color || false, 'user');
        else quill.format('background', chip.dataset.mark || false, 'user');
        bar.querySelectorAll('.tb__menu').forEach((m) => m.classList.remove('is-open'));
        return;
      }

      const button = event.target.closest('.tb__b');
      if (!button) return;
      const act = button.dataset.act;
      const range = () => quill.getSelection(true);

      if (act === 'undo') quill.history.undo();
      else if (act === 'redo') quill.history.redo();
      else if (['bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block'].includes(act)) {
        const fmt = quill.getFormat(range());
        quill.format(act, !fmt[act], 'user');
      } else if (act === 'list-bullet') toggle('list', 'bullet');
      else if (act === 'list-ordered') toggle('list', 'ordered');
      else if (act === 'indent+') quill.format('indent', '+1', 'user');
      else if (act === 'indent-') quill.format('indent', '-1', 'user');
      else if (act.startsWith('align:')) quill.format('align', act.slice(6) || false, 'user');
      else if (act === 'dir:rtl') { quill.format('direction', false, 'user'); quill.format('align', false, 'user'); }
      else if (act === 'dir:ltr') { quill.format('direction', 'rtl', 'user'); quill.format('align', 'right', 'user'); }
      else if (act === 'link') insertLink();
      else if (act === 'image') insertImage();
      else if (act === 'video') insertVideo();
      else if (act === 'table') insertTable();
      else if (act === 'hr') insertRule();
      else if (act === 'clean') {
        const r = range();
        quill.removeFormat(r.index, r.length, 'user');
      } else if (act === 'find') openFind();
      else if (act === 'source') toggleSource();
      else if (act === 'full') toggleFull();
      else if (act === 'color-open' || act === 'mark-open') {
        const menu = button.parentElement.querySelector('.tb__menu');
        const wasOpen = menu.classList.contains('is-open');
        bar.querySelectorAll('.tb__menu').forEach((m) => m.classList.remove('is-open'));
        menu.classList.toggle('is-open', !wasOpen);
        return;
      }
      syncState();
    });

    headerSelect.addEventListener('change', () => {
      quill.format('header', headerSelect.value ? Number(headerSelect.value) : false, 'user');
    });

    document.addEventListener('click', (event) => {
      if (!bar.contains(event.target)) bar.querySelectorAll('.tb__menu').forEach((m) => m.classList.remove('is-open'));
    });

    findBox.querySelector('.ed__q').addEventListener('input', runFind);
    findBox.querySelector('[data-find-next]').addEventListener('click', () => step(1));
    findBox.querySelector('[data-find-prev]').addEventListener('click', () => step(-1));
    findBox.querySelector('[data-find-rep]').addEventListener('click', replaceOne);
    findBox.querySelector('[data-find-all]').addEventListener('click', replaceAll);
    findBox.querySelector('[data-find-close]').addEventListener('click', () => { findBox.hidden = true; });

    /* اختصاراتٌ داخل المحرّر */
    quill.root.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'k') { event.preventDefault(); insertLink(); }
      else if (key === 'f') { event.preventDefault(); openFind(); }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && shell.classList.contains('is-full')) toggleFull();
    });

    /* الصورةُ الملصوقةُ تُرفع بدل أن تُدفن base64 */
    quill.root.addEventListener('paste', (event) => {
      const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      files.forEach(async (file) => {
        const range = quill.getSelection(true);
        notify('جارٍ رفعُ الصورة…');
        try {
          const url = await upload(file);
          quill.insertEmbed(range.index, 'image', url, 'user');
          notify('رُفعت الصورة', 'ok');
        } catch { notify('تعذّر رفعُ الصورة', 'bad'); }
      });
    });

    /* ─── قراءةٌ وكتابةٌ للمُستدعي ───────────────────────── */
    function getHTML() {
      if (sourceOpen) return source.value;
      const clone = quill.root.cloneNode(true);
      /* نزعُ غلاف الكتل الخام فتعود جداولَ وإطاراتٍ عاديّة */
      clone.querySelectorAll('.ql-raw').forEach((node) => {
        const raw = node.getAttribute('data-raw');
        const holder = document.createElement('div');
        holder.innerHTML = raw ? decodeURIComponent(raw) : node.innerHTML;
        node.replaceWith(...holder.childNodes);
      });
      clone.querySelectorAll('.ql-cursor, .ql-clipboard').forEach((n) => n.remove());
      return clone.innerHTML.replace(/<p><br><\/p>/g, '').trim();
    }

    function setHTML(html) {
      quill.setContents([]);
      if (html) quill.clipboard.dangerouslyPasteHTML(html, 'silent');
      stats();
      syncState();
    }

    stats();
    syncState();

    return {
      quill,
      getHTML,
      setHTML,
      getText: () => quill.getText(),
      focus: () => quill.focus(),
      note: (text) => { host.querySelector('[data-note]').textContent = text; },
      destroy: () => { document.body.classList.remove('ed-full'); }
    };
  }

  window.EACREditor = { create };
})();
