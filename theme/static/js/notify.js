/* ═══ الإشعارات ══════════════════════════════════════════════
   لا خادمَ ولا اشتراكَ push: الموقعُ نفسُه يسأل «هل نُشر جديد؟»
   عند كلِّ زيارة، وفي الخلفيّة إن أَذِن المتصفّحُ بالمزامنة الدوريّة.
   المصدران: /news-latest.json للمبنيّ مسبقاً، وقاعدةُ Firebase لما
   نُشر بعد آخرِ بناء — فلا يفوت القارئَ خبرٌ بين بناءٍ وآخر.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const CFG = window.EACR_NOTIFY || { interval: 4, max: 3, ask: 0 };
  const KEY = 'eacr:notify';
  const SITE = window.EACR_SITE || {};
  const SITE_TITLE = SITE.title || 'EACR Conference';
  const DB = window.EACR_DB || '';
  // أسماءُ الأقسام تأتي من الإعدادات لا من الشيفرة، فالقسمُ الذي يُضاف من
  // الإعدادات يظهر في الإشعار باسمه من غير تعديلِ هذا الملفّ.
  const SECTIONS = SITE.sections || {};
  const supported = 'Notification' in window && 'serviceWorker' in navigator;

  const store = window.EACR?.store || {
    read: (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    write: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* لا شيء */ } }
  };

  let state = store.read(KEY, { on: false, seen: 0, asked: false, unread: [], sent: [] });
  const save = (patch) => { state = { ...state, ...patch }; store.write(KEY, state); };
  const uniq = (list) => Array.from(new Set(list));

  const toast = (message) => window.EACR?.toast?.(message);
  const bell = document.querySelector('[data-notify-toggle]');
  const counter = document.querySelector('[data-notify-count]');

  /* ─── حالةُ الجرس ────────────────────────────────────── */
  const paint = () => {
    if (bell) {
      bell.hidden = !supported;
      const on = state.on && Notification.permission === 'granted';
      bell.classList.toggle('is-on', on);
      bell.setAttribute('aria-pressed', String(on));
      bell.title = on ? 'الإشعاراتُ مفعّلة — اضغط لإيقافها' : 'فعّل إشعاراتِ المنشورات الجديدة';
    }
    const count = (state.unread || []).length;
    if (counter) {
      counter.hidden = count === 0;
      counter.textContent = count > 9 ? '٩+' : String(count);
    }
    document.querySelectorAll('[data-notify-state]').forEach((node) => {
      const on = state.on && supported && Notification.permission === 'granted';
      node.dataset.notifyState = !supported ? 'unsupported'
        : Notification.permission === 'denied' ? 'blocked'
        : on ? 'on' : 'off';
    });
  };

  /* ─── جلبُ الجديد ────────────────────────────────────── */
  const toTime = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1e11 ? value : value * 1000;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(String(value));
    return m ? Date.parse(`${m[3]}-${m[2]}-${m[1]}`) : 0;
  };

  const strip = (value) => (value || '').toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  /* طلبٌ لا يُعلَّق: إن تأخّرت الشبكةُ قُطع وعُدنا بلا شيء */
  async function get(url, ms = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fromSite() {
    try {
      const data = await get('/news-latest.json');
      if (!data) return [];
      return (data.items || []).map((entry) => ({
        id: entry.u, title: entry.t, url: entry.u,
        section: entry.s, dek: entry.d, image: entry.i, stamp: entry.ts
      }));
    } catch { return []; }
  }

  async function fromDatabase() {
    const grab = async (section) => {
      try {
        const data = await get(`${DB}/${section}.json?orderBy=%22%24key%22&limitToLast=4`);
        if (!data || typeof data !== 'object') return [];
        return Object.entries(data).map(([id, raw]) => ({
          id: `${section}:${id}`,
          title: (raw.title || '').toString().trim(),
          url: `/read.html?type=${section}&id=${encodeURIComponent(id)}`,
          section: SECTIONS[section] || section,
          dek: strip(raw.summary || raw.description || '').slice(0, 120),
          image: raw.image || raw.imageUrl || '',
          stamp: toTime(raw.date || raw.createdAt || raw.timestamp)
        })).filter((entry) => entry.title);
      } catch { return []; }
    };
    const groups = await Promise.all(Object.keys(SECTIONS).map(grab));
    return groups.flat();
  }

  async function freshItems() {
    const [site, live] = await Promise.all([fromSite(), fromDatabase()]);

    /* المنشورُ نفسُه تأتي من المصدرين بتاريخين مختلفين أحياناً.
       نُبقي نسخةً واحدةً: رابطُها الدائمُ من الموقع إن وُجد،
       وتاريخُها الأحدث — وإلّا عاد المنشورُ القديمُ «جديداً». */
    const merged = new Map();
    for (const entry of [...site, ...live]) {
      const key = (entry.title || '').trim();
      if (!key || !Number.isFinite(entry.stamp) || entry.stamp <= 0) continue;
      const current = merged.get(key);
      if (!current) { merged.set(key, { ...entry }); continue; }
      current.stamp = Math.max(current.stamp, entry.stamp);
      if (!current.image && entry.image) current.image = entry.image;
    }
    const all = Array.from(merged.values()).sort((a, b) => b.stamp - a.stamp);

    /* أحدثُ ما في القائمة كلِّها — لا أحدثُ ما سنُشعر به فقط،
       وإلّا بقي المنشورُ الرابعُ يُشعر في كلِّ جولة. */
    const newest = all.length ? all[0].stamp : 0;

    /* أوّلُ زيارةٍ: نُثبّت العلامةَ فحسب ولا نُشعر بشيءٍ قديم */
    if (!state.seen) {
      save({ seen: newest || Date.now() });
      return { fresh: [], newest };
    }

    const sent = new Set(state.sent || []);
    const fresh = all
      .filter((entry) => entry.stamp > state.seen && !sent.has(entry.id))
      .slice(0, CFG.max || 3);
    return { fresh, newest };
  }

  /* ─── الإظهار ────────────────────────────────────────── */
  async function show({ fresh: items, newest }) {
    if (!items.length) return;
    save({
      seen: Math.max(state.seen || 0, newest || 0),
      sent: uniq([...items.map((entry) => entry.id), ...(state.sent || [])]).slice(0, 60),
      unread: uniq([...items.map((entry) => entry.url), ...(state.unread || [])]).slice(0, 9)
    });
    paint();

    if (!state.on || Notification.permission !== 'granted') return;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    for (const entry of items) {
      await registration.showNotification(entry.section ? `${entry.section} · ${SITE_TITLE}` : SITE_TITLE, {
        body: entry.title,
        icon: '/assets/img/icon-192.png',
        badge: '/assets/img/icon-192.png',
        image: entry.image && !entry.image.startsWith('data:') ? entry.image : undefined,
        tag: entry.id,
        dir: 'rtl',
        lang: 'ar',
        data: { url: entry.url }
      });
    }
  }

  /* جولةٌ واحدةٌ في كلِّ مرّة، ولا نُلحّ على الشبكة كلَّما عاد القارئُ
     إلى اللسان: دقائقُ فاصلةٌ تكفي، إلّا أن يطلب الفحصَ صراحةً. */
  let busy = false;
  let lastCheck = 0;
  const MIN_GAP = 5 * 60 * 1000;

  const check = async (force = false) => {
    if (busy) return;
    if (!force && Date.now() - lastCheck < MIN_GAP) return;
    busy = true;
    lastCheck = Date.now();
    try { await show(await freshItems()); } catch { /* الشبكةُ ليست شرطاً */ }
    finally { busy = false; }
  };

  /* ─── القناةُ الحيّة ──────────────────────────────────────
     قاعدةُ Firebase تبثّ التغييرَ عبر REST كـ text/event-stream،
     و EventSource يفهمه بلا مكتبة. نبثّ عقدةَ pulse وحدَها —
     سطرٌ واحدٌ تكتبه اللوحةُ عند النشر — فيصل الإشعارُ في ثوانٍ
     ما دام للموقع لسانٌ مفتوحٌ عند القارئ ولو في الخلفيّة.
     ═══════════════════════════════════════════════════ */
  let stream = null;

  const openStream = () => {
    if (stream || !('EventSource' in window)) return;
    if (!state.on || Notification.permission !== 'granted') return;

    try {
      stream = new EventSource(`${DB}/pulse.json`);
    } catch {
      stream = null;
      return;
    }

    stream.addEventListener('put', (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      const beat = payload && payload.data;
      if (!beat || !beat.title || !beat.at) return;

      /* لا نُشعر بنبضةٍ رآها القارئُ من قبل، ولا بمنشورٍ سبق إشعارُها */
      const id = `${beat.type}:${beat.id}`;
      if (beat.at <= (state.seen || 0)) return;
      if ((state.sent || []).includes(id)) return;

      show({
        fresh: [{
          id,
          title: beat.title,
          url: `/read.html?type=${beat.type}&id=${encodeURIComponent(beat.id)}`,
          section: beat.section || '',
          image: beat.image || '',
          stamp: beat.at
        }],
        newest: beat.at
      }).catch(() => {});
    });

    stream.addEventListener('error', () => {
      /* EventSource يعيد الوصلَ وحدَه؛ فإن أُغلق نهائيّاً أعدنا فتحَه */
      if (stream && stream.readyState === EventSource.CLOSED) {
        stream = null;
        setTimeout(openStream, 30000);
      }
    });
  };

  const closeStream = () => {
    if (!stream) return;
    stream.close();
    stream = null;
  };

  /* ─── التفعيلُ والإطفاء ──────────────────────────────── */
  async function enable(silent = false) {
    if (!supported) { if (!silent) toast('متصفّحك لا يدعم الإشعارات'); return false; }
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      save({ on: false, asked: true });
      paint();
      if (!silent) toast(permission === 'denied' ? 'الإشعاراتُ محجوبةٌ من إعدادات المتصفّح' : 'لم يُمنح الإذن');
      return false;
    }
    save({ on: true, asked: true });
    paint();
    if (!silent) toast('سنُشعرك بكلِّ منشورٍ جديد');

    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (registration?.periodicSync) {
      try {
        await registration.periodicSync.register('eacr-news', {
          minInterval: (CFG.interval || 4) * 60 * 60 * 1000
        });
      } catch { /* المتصفّحُ لا يمنحها إلّا للمثبَّت */ }
    }
    openStream();
    registration?.showNotification?.('تمّ تفعيلُ الإشعارات', {
      body: 'سيصلك عنوانُ كلِّ منشورٍ جديدٍ فور نشره.',
      icon: '/assets/img/icon-192.png', badge: '/assets/img/icon-192.png',
      dir: 'rtl', lang: 'ar', tag: 'eacr-welcome'
    });
    return true;
  }

  async function disable() {
    save({ on: false });
    closeStream();
    paint();
    const registration = await navigator.serviceWorker.getRegistration();
    try { await registration?.periodicSync?.unregister('eacr-news'); } catch { /* لا شيء */ }
    toast('أُوقفت الإشعارات');
  }

  const toggle = () => (state.on && Notification.permission === 'granted' ? disable() : enable());

  bell?.addEventListener('click', () => {
    save({ unread: [] });
    toggle();
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-notify-action]');
    if (!trigger) return;
    event.preventDefault();
    const action = trigger.dataset.notifyAction;
    if (action === 'enable') enable();
    else if (action === 'disable') disable();
    else toggle();
  });

  /* ─── دعوةٌ لطيفةٌ بعد أن يقرأ القارئُ فعلاً ──────────── */
  const invite = () => {
    if (state.asked || state.on || !supported || Notification.permission !== 'default') return;
    if ((CFG.ask || 0) > 0 && !document.querySelector('[data-article]')) return;
    const card = document.createElement('div');
    card.className = 'notify-invite';
    card.innerHTML = `
      <div class="notify-invite__body">
        <strong>يصلك المنشورُ الجديدُ فور نشره؟</strong>
        <span>إشعارٌ واحدٌ لكلِّ منشور — بلا بريدٍ ولا تسجيل.</span>
      </div>
      <div class="notify-invite__acts">
        <button class="btn btn--sm" type="button" data-notify-action="enable">فعّل</button>
        <button class="btn btn--sm btn--ghost" type="button" data-invite-close>لاحقاً</button>
      </div>`;
    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add('is-in'));
    const close = () => {
      card.classList.remove('is-in');
      setTimeout(() => card.remove(), 300);
      save({ asked: true });
    };
    card.querySelector('[data-invite-close]').addEventListener('click', close);
    card.querySelector('[data-notify-action]').addEventListener('click', () => setTimeout(close, 400));
    setTimeout(() => { if (document.body.contains(card)) close(); }, 20000);
  };

  /* ─── الطلبُ عند فتح الموقع ───────────────────────────
     ask = 0 يعني: اطلب الإذنَ فورَ الفتح. بعضُ المتصفّحات (فَيَرفُكس
     وسفاري) لا تفتح نافذةَ الإذن إلّا بلمسةٍ من المستخدم، فإن رُفض
     الطلبُ التلقائيُّ عُرضت البطاقةُ ليأتي الإذنُ من ضغطة زرّها.
     والمتصفّحُ يتذكّر السماحَ والمنع، فلا يُسأل من أجاب مرّةً. */
  async function askOnOpen() {
    if (state.on || !supported || Notification.permission !== 'default') return;
    try {
      if (await enable(true)) return;
    } catch { /* المتصفّحُ يشترط لمسةً */ }
    if (Notification.permission === 'default') invite();
  }

  paint();
  setTimeout(() => check(true), 2500);
  setTimeout(openStream, 3000);
  if ((CFG.ask || 0) <= 0) setTimeout(askOnOpen, 1200);
  else setTimeout(invite, CFG.ask * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });

  window.EACR_NOTIFY.enable = enable;
  window.EACR_NOTIFY.disable = disable;
  window.EACR_NOTIFY.check = () => check(true);
})();
