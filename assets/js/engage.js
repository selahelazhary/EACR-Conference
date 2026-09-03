/* ═══ المشاهدات والإعجاب والتعليقات ══════════════════════════
   موقعٌ ثابتٌ بلا خادم، فالعدّادُ يعيش في قاعدة Firebase نفسِها
   ويُقرأ ويُكتب عبر REST مباشرةً — بلا مكتبةٍ ولا حزمةِ جافاسكربت.
   الزيادةُ تجري بمقارنة ETag: نقرأ الرقمَ ببصمته، ونكتبه بشرط
   أنّها لم تتغيّر — فلا تضيع مشاهدةٌ إذا قرأ اثنان في اللحظة نفسِها.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const CFG = window.EACR_ENGAGE;
  if (!CFG || !CFG.db) return;

  const DB = CFG.db.replace(/\/$/, '');
  const LIKES_KEY = 'eacr:likes';
  const SEEN_KEY = 'eacr:viewed';
  const CACHE_KEY = 'eacr:engage';
  const CACHE_TTL = 3 * 60 * 1000;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const store = window.EACR?.store || {
    read: (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    write: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* لا شيء */ } }
  };

  const ar = (n) => Number(n || 0).toLocaleString('ar-EG');

  async function get(path, ms = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(`${DB}/${path}`, { signal: controller.signal });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /* زيادةٌ ذرّيّةٌ بمقارنة البصمة، وثلاثُ محاولاتٍ عند التزاحم */
  async function bump(path, delta) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${DB}/${path}`, { headers: { 'X-Firebase-ETag': 'true' } });
      if (!response.ok) return null;
      const etag = response.headers.get('ETag');
      const current = Number(await response.json()) || 0;
      const next = Math.max(0, current + delta);
      const write = await fetch(`${DB}/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(etag ? { 'if-match': etag } : {}) },
        body: JSON.stringify(next)
      });
      if (write.ok) return next;
      if (write.status !== 412) return null;   // ليست مشكلةَ تزاحم
    }
    return null;
  }

  /* ─── ملءُ الأرقام في البطاقات ────────────────────────── */
  async function paintCounts() {
    const holders = Array.from(document.querySelectorAll('[data-engage]'));
    if (!holders.length) return;

    let data = null;
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < CACHE_TTL) data = cached.data;
    } catch { /* لا شيء */ }

    if (!data) {
      data = await get('engagement.json') || {};
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* ممتلئ */ }
    }

    for (const holder of holders) {
      const [type, id] = (holder.dataset.engage || '').split(':');
      const entry = (data[type] || {})[id] || {};
      const views = holder.querySelector('[data-views]');
      if (views && entry.views) {
        views.textContent = `${ar(entry.views)} مشاهدة`;
        views.hidden = false;
        views.parentElement?.removeAttribute('hidden');
      }
      const likes = holder.querySelector('[data-like-count]');
      if (likes) likes.textContent = ar(entry.likes || 0);
    }
    return data;
  }

  /* ─── صفحةُ المنشور ───────────────────────────────────── */
  const article = document.querySelector('[data-engage-item]');

  async function countView() {
    if (!article) return;
    const key = article.dataset.engageItem;
    const seen = store.read(SEEN_KEY, {});
    const today = new Date().toDateString();
    if (seen[key] === today) return;          // مشاهدةٌ واحدةٌ في اليوم لكلِّ جهاز
    seen[key] = today;
    store.write(SEEN_KEY, seen);

    const [type, id] = key.split(':');
    const total = await bump(`engagement/${type}/${id}/views.json`, 1);
    if (total != null) {
      const node = article.querySelector('[data-view-total]');
      if (node) { node.textContent = `${ar(total)} مشاهدة`; node.hidden = false; }
    }
  }

  function bindLike() {
    const button = document.querySelector('[data-like]');
    if (!button || !article) return;
    const key = article.dataset.engageItem;
    const [type, id] = key.split(':');
    const counter = button.querySelector('[data-like-count]');

    const liked = () => !!store.read(LIKES_KEY, {})[key];
    const paint = () => {
      button.classList.toggle('is-on', liked());
      button.setAttribute('aria-pressed', String(liked()));
      button.title = liked() ? 'أُلغي الإعجاب' : 'أعجبني';
    };
    paint();

    button.addEventListener('click', async () => {
      const likes = store.read(LIKES_KEY, {});
      const on = !likes[key];
      if (on) likes[key] = Date.now(); else delete likes[key];
      store.write(LIKES_KEY, likes);
      paint();

      const shown = Number(String(counter.textContent).replace(/\D/g, '')) || 0;
      counter.textContent = ar(Math.max(0, shown + (on ? 1 : -1)));
      button.classList.add('is-pop');
      setTimeout(() => button.classList.remove('is-pop'), 320);

      const total = await bump(`engagement/${type}/${id}/likes.json`, on ? 1 : -1);
      if (total != null) counter.textContent = ar(total);
      else window.EACR?.toast?.('تعذّر تسجيلُ الإعجاب — تحقّق من الاتّصال');
    });
  }

  /* ─── التعليقات ───────────────────────────────────────── */
  const commentBox = document.querySelector('[data-comments]');

  const when = (stamp) => {
    const diff = Date.now() - stamp;
    if (diff < 6e4) return 'الآن';
    if (diff < 36e5) return `منذ ${Math.round(diff / 6e4)} دقيقة`;
    if (diff < 864e5) return `منذ ${Math.round(diff / 36e5)} ساعة`;
    const date = new Date(stamp);
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  async function loadComments() {
    if (!commentBox) return;
    const key = commentBox.dataset.comments;
    const [type, id] = key.split(':');
    const list = commentBox.querySelector('[data-comment-list]');
    const count = commentBox.querySelector('[data-comment-count]');

    const data = await get(`comments/${type}/${id}.json`) || {};
    const rows = Object.entries(data)
      .map(([cid, value]) => ({ id: cid, ...value }))
      .filter((row) => row && row.body && row.approved !== false)
      .sort((a, b) => (b.at || 0) - (a.at || 0));

    if (count) count.textContent = rows.length ? `(${ar(rows.length)})` : '';
    list.innerHTML = rows.length ? rows.map((row) => `
      <li class="comment">
        <span class="comment__avatar" aria-hidden="true">${esc((row.name || 'ق')[0])}</span>
        <div class="comment__body">
          <p class="comment__head"><b>${esc(row.name || 'قارئ')}</b><time>${esc(when(row.at || 0))}</time></p>
          <p class="comment__text">${esc(row.body)}</p>
        </div>
      </li>`).join('')
      : '<li class="comment comment--empty">لا تعليقاتٍ بعد — كن أوّلَ من يكتب.</li>';
  }

  function bindCommentForm() {
    const form = commentBox?.querySelector('[data-comment-form]');
    if (!form) return;
    const key = commentBox.dataset.comments;
    const [type, id] = key.split(':');
    const note = form.querySelector('[data-comment-note]');
    const saved = store.read('eacr:commenter', '');
    if (saved) form.querySelector('[name="name"]').value = saved;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = form.querySelector('[name="name"]').value.trim();
      const body = form.querySelector('[name="body"]').value.trim();
      const trap = form.querySelector('[name="website"]').value;   // مصيدةُ الآليّات
      const button = form.querySelector('button[type="submit"]');

      if (trap) return;
      if (body.length < 3) { note.textContent = 'اكتب تعليقاً أطولَ قليلاً.'; note.hidden = false; return; }
      if (body.length > 1200) { note.textContent = 'التعليقُ أطولُ من ١٢٠٠ حرف.'; note.hidden = false; return; }

      const last = Number(store.read('eacr:comment-at', 0));
      if (Date.now() - last < 30000) {
        note.textContent = 'مهلاً — نصفُ دقيقةٍ بين تعليقٍ وآخر.';
        note.hidden = false;
        return;
      }

      button.disabled = true;
      note.hidden = true;

      const payload = {
        name: (name || 'قارئ').slice(0, 40),
        body: body.slice(0, 1200),
        at: Date.now(),
        approved: !CFG.moderation
      };

      try {
        const response = await fetch(`${DB}/comments/${type}/${id}.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('rejected');
        store.write('eacr:commenter', payload.name);
        store.write('eacr:comment-at', Date.now());
        form.querySelector('[name="body"]').value = '';
        note.textContent = CFG.moderation
          ? 'وصل تعليقُك — يظهر بعد مراجعة التحرير.'
          : 'نُشر تعليقُك. شكراً.';
        note.hidden = false;
        if (!CFG.moderation) loadComments();
      } catch {
        note.textContent = 'تعذّر إرسالُ التعليق. حاول بعد قليل.';
        note.hidden = false;
      } finally {
        button.disabled = false;
      }
    });
  }

  /* ─── التشغيل ─────────────────────────────────────────── */
  const start = () => {
    paintCounts().catch(() => {});
    countView().catch(() => {});
    bindLike();
    bindCommentForm();
    loadComments().catch(() => {});
  };

  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2000 });
  else setTimeout(start, 700);
})();
