/* ═══ عدّادُ المؤتمر ═════════════════════════════════════════
   يعدُّ ما بقي على الافتتاح، ثمّ يتحوّل إلى «منعقدٌ الآن» طوال
   أيّامه، ثمّ إلى «انتهى» بعدها.

   التاريخُ يأتي من القالب بمنطقة توقيته صريحةً (…+03:00)، لا
   بتوقيت جهاز الزائر — فمن يفتح الموقعَ من الرياض أو لندن يرى
   العددَ نفسَه لا عدداً يزيد ساعتين أو ينقص.
   ═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const boxes = Array.from(document.querySelectorAll('[data-countdown]'));
  if (!boxes.length) return;

  /* العدّادُ يكتب أرقامَه ووحداتِه بنفسه، فلا يمرُّ على معجم الترجمة:
     يقرأ لغةَ الصفحة ويكتب بها مباشرةً. */
  const AR = document.documentElement.lang !== 'en';
  const LOCALE = AR ? 'ar-EG' : 'en-US';
  const PAD = new Intl.NumberFormat(LOCALE, { minimumIntegerDigits: 2, useGrouping: false });
  const PLAIN = new Intl.NumberFormat(LOCALE, { useGrouping: false });

  const SAYS = AR
    ? { over: 'اختُتمت أعمالُ المؤتمر', live: 'المؤتمرُ منعقدٌ الآن', soon: 'يبدأ المؤتمرُ بعد' }
    : { over: 'The conference has ended', live: 'The conference is under way', soon: 'The conference starts in' };

  /* عربيّةٌ سليمة: يومٌ · يومان · ٣ أيّام · ١١ يوماً */
  const PLURALS = {
    days: ['يوم', 'يومان', 'أيّام', 'يوماً'],
    hours: ['ساعة', 'ساعتان', 'ساعات', 'ساعة'],
    minutes: ['دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'],
    seconds: ['ثانية', 'ثانيتان', 'ثوانٍ', 'ثانية']
  };
  const ENGLISH = { days: 'day', hours: 'hour', minutes: 'minute', seconds: 'second' };

  const nameFor = (unit, value) => {
    if (!AR) return value === 1 ? ENGLISH[unit] : `${ENGLISH[unit]}s`;
    const forms = PLURALS[unit];
    if (value === 1) return forms[0];
    if (value === 2) return forms[1];
    if (value >= 3 && value <= 10) return forms[2];
    return forms[3];
  };

  function paint(box) {
    const starts = Date.parse(box.dataset.starts);
    const ends = Date.parse(box.dataset.ends) || starts;
    if (Number.isNaN(starts)) { box.remove(); return null; }

    const label = box.querySelector('[data-countdown-label]');
    const units = box.querySelector('.countdown__units');
    const now = Date.now();

    if (now >= ends) {
      box.classList.add('is-over');
      if (label) label.textContent = SAYS.over;
      if (units) units.hidden = true;
      box.hidden = false;
      return null;                     // لا حاجة إلى دقّةٍ بعد اليوم
    }

    if (now >= starts) {
      box.classList.add('is-live');
      if (label) label.textContent = SAYS.live;
      if (units) units.hidden = true;
      box.hidden = false;
      return ends - now;               // نستيقظ عند انتهائه
    }

    if (label && label.textContent.trim() !== SAYS.soon) label.textContent = SAYS.soon;

    let left = Math.floor((starts - now) / 1000);
    const parts = {
      days: Math.floor(left / 86400),
      hours: Math.floor((left % 86400) / 3600),
      minutes: Math.floor((left % 3600) / 60),
      seconds: left % 60
    };

    for (const [unit, value] of Object.entries(parts)) {
      const num = box.querySelector(`[data-countdown-${unit}]`);
      if (!num) continue;
      const text = unit === 'days' ? PLAIN.format(value) : PAD.format(value);
      if (num.textContent !== text) num.textContent = text;
      const name = num.parentElement.querySelector('.unit__name');
      if (name) name.textContent = nameFor(unit, value);
    }
    box.hidden = false;
    return 1000;
  }

  let timer = null;

  function tick() {
    let next = Infinity;
    for (const box of boxes) {
      const wait = paint(box);
      if (wait) next = Math.min(next, wait);
    }
    clearTimeout(timer);
    if (!Number.isFinite(next)) return;   // كلُّها انتهت
    // ننبض مع الثانية لا كلَّ ألف جزءٍ من الآن، فلا يقفز الرقمُ رقمين
    timer = setTimeout(tick, next === 1000 ? 1000 - (Date.now() % 1000) : Math.min(next, 60000));
  }

  tick();
  // اللسانُ المخفيُّ توقفه المتصفّحاتُ عن المؤقّتات، فنُصحّح عند العودة
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
})();
