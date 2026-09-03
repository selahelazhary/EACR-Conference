/* عاملُ الخدمة — تصفّحٌ سريعٌ وقراءةٌ دون اتّصال. */
const SITE_TITLE = "EACR Conference";
const VERSION = 'eacr-0-202609030814';
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const MEDIA = `${VERSION}-media`;

const PRECACHE = [
  '/',
  '/offline/',
  '/search/',
  '/saved/',
  '/assets/css/tokens.css?v=67c066b9',
  '/assets/css/base.css?v=6674ad29',
  '/assets/css/layout.css?v=a663b4a1',
  '/assets/css/components.css?v=1c4615b6',
  '/assets/css/layouts.css?v=e62f63c9',
  '/assets/css/conference.css?v=6cdc8c33',
  '/assets/js/skin.js?v=bc8e1dce',
  '/assets/js/core.js?v=e6a42e08',
  '/assets/js/search.js?v=09e10996',
  '/search-index.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isMedia(request) {
  return request.destination === 'image' || request.destination === 'font';
}

/* نطاقاتٌ يجب أن تمرَّ إلى الشبكة كما هي: الإعلاناتُ والقياس */
const PASSTHROUGH = /(googlesyndication|doubleclick|googleadservices|google-analytics|googletagmanager|adtrafficquality)\./i;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (PASSTHROUGH.test(url.hostname)) return;

  /* ملفُّ نبض الأخبار يُقرأ من الشبكة دائماً — عليه تقوم الإشعارات */
  if (sameOrigin && url.pathname === '/news-latest.json') {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // صفحاتُ التصفّح: الشبكةُ أوّلاً، ثمّ الذاكرة، ثمّ صفحةُ الانقطاع
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGES).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/offline/')))
    );
    return;
  }

  // الصورُ والخطوط: الذاكرةُ أوّلاً
  if (isMedia(request)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(MEDIA).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => hit))
    );
    return;
  }

  // بقيّةُ أصول الموقع: الذاكرةُ أوّلاً مع تحديثٍ صامتٍ في الخلفيّة
  if (sameOrigin) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
          return response;
        }).catch(() => hit);
        return hit || network;
      })
    );
  }
});


/* ═══ الإشعارات ═══════════════════════════════════════════
   المزامنةُ الدوريّة تُوقظ العاملَ كلَّ بضع ساعاتٍ في المتصفّحات
   التي تدعمها (والموقعُ مثبَّتٌ كتطبيق)، فيقارن أحدثَ ما نُشر
   بآخرِ ما رآه القارئُ ويُشعره إن جدّ جديد.
   ═══════════════════════════════════════════════════════ */
const NOTIFY_STATE = 'dp-notify-state';

async function readSeen() {
  try {
    const cache = await caches.open(NOTIFY_STATE);
    const hit = await cache.match('/seen');
    return hit ? (await hit.json()).seen || 0 : 0;
  } catch { return 0; }
}

async function writeSeen(stamp) {
  try {
    const cache = await caches.open(NOTIFY_STATE);
    await cache.put('/seen', new Response(JSON.stringify({ seen: stamp })));
  } catch { /* لا شيء */ }
}

async function checkNews() {
  let payload;
  try {
    payload = await (await fetch('/news-latest.json', { cache: 'no-store' })).json();
  } catch { return; }

  const items = payload.items || [];
  if (!items.length) return;

  const seen = await readSeen();
  const newest = items[0].ts || 0;
  if (!seen) { await writeSeen(newest); return; }

  const fresh = items.filter((entry) => (entry.ts || 0) > seen).slice(0, 3);
  if (!fresh.length) return;
  await writeSeen(newest);

  for (const entry of fresh) {
    await self.registration.showNotification(`${entry.s ? entry.s + ' · ' : ''}${SITE_TITLE}`, {
      body: entry.t,
      icon: '/assets/img/icon-192.png',
      badge: '/assets/img/icon-192.png',
      tag: entry.u,
      dir: 'rtl',
      lang: 'ar',
      data: { url: entry.u }
    });
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'dp-news') event.waitUntil(checkNews());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'dp-news') event.waitUntil(checkNews());
});

/* لو أُضيف خادمُ push لاحقاً، الحمولةُ تصل هنا جاهزة */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || SITE_TITLE, {
    body: data.body || '',
    icon: '/assets/img/icon-192.png',
    badge: '/assets/img/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url === target) return client.focus();
    }
    const open = windows.find((client) => 'focus' in client);
    if (open && 'navigate' in open) { await open.focus(); return open.navigate(target); }
    return self.clients.openWindow(target);
  })());
});
