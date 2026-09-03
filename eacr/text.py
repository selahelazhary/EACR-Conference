"""أدواتُ النصّ العربيّ: الروابطُ اللطيفة، والتواريخُ، وزمنُ القراءة، والاقتباس."""

from __future__ import annotations

import html
import re
import unicodedata
from datetime import datetime, timezone

# التشكيل والتطويل يُحذفان قبل توليد الرابط
ARABIC_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
NON_SLUG = re.compile(r"[^0-9A-Za-zء-ي٠-٩۰-۹\-]+")
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

MONTHS_AR = (
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
)

# أسماءُ الشهور كما تُكتب في لوحة التحرير، بالمشرقيّة والمغربيّة معاً
MONTH_INDEX = {name: number for number, name in enumerate(MONTHS_AR, start=1)}
MONTH_INDEX.update({
    "كانون الثاني": 1, "شباط": 2, "آذار": 3, "اذار": 3, "نيسان": 4,
    "أيار": 5, "ايار": 5, "حزيران": 6, "تموز": 7, "آب": 8, "اب": 8,
    "أيلول": 9, "ايلول": 9, "تشرين الأول": 10, "تشرين الاول": 10,
    "تشرين الثاني": 11, "كانون الأول": 12, "كانون الاول": 12,
    "ابريل": 4, "اغسطس": 8, "اكتوبر": 10, "يوليه": 7, "ماي": 5,
})

# الأرقامُ العربيّة-الهنديّة والفارسيّة → لاتينيّة
DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")

_ALEF_VARIANTS = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"})


def slugify(value: str, fallback: str = "item", max_len: int = 64) -> str:
    """رابطٌ عربيٌّ نظيفٌ صالحٌ للعنوان: «إدمان الشاشة» → «ادمان-الشاشه»."""
    text = unicodedata.normalize("NFKC", value or "").strip()
    text = ARABIC_DIACRITICS.sub("", text)
    text = text.translate(_ALEF_VARIANTS)
    text = WS_RE.sub("-", text)
    text = NON_SLUG.sub("-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-").lower()
    if len(text) > max_len:
        text = text[:max_len].rsplit("-", 1)[0] or text[:max_len]
    return text or fallback


def strip_html(value: str) -> str:
    """نصٌّ خامٌ من HTML — يُستعمل للملخّصات والوصف والبحث."""
    if not value:
        return ""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", value, flags=re.S | re.I)
    text = re.sub(r"<br\s*/?>|</p>|</div>|</li>|</h[1-6]>", " ", text, flags=re.I)
    text = TAG_RE.sub(" ", text)
    return WS_RE.sub(" ", html.unescape(text)).strip()


def excerpt(value: str, words: int = 34) -> str:
    """مقتطفٌ بعدد كلماتٍ محدّد، ينتهي بعلامة حذفٍ عند القطع."""
    text = strip_html(value)
    parts = text.split(" ")
    if len(parts) <= words:
        return text
    return " ".join(parts[:words]).rstrip("،.:؛-") + "…"


def word_count(value: str) -> int:
    text = strip_html(value)
    return len([w for w in text.split(" ") if w])


def reading_time(value: str, wpm: int = 190) -> int:
    """زمنُ القراءة بالدقائق، بحدٍّ أدنى دقيقةٍ واحدة."""
    return max(1, round(word_count(value) / max(wpm, 1)))


def parse_date(value, default: datetime | None = None) -> datetime:
    """يقبل ISO، و«يوم/شهر/سنة»، والطوابعَ الزمنيّةَ بالملّي ثانية."""
    fallback = default or datetime(2026, 1, 1, tzinfo=timezone.utc)
    if value in (None, "", 0):
        return fallback

    if isinstance(value, (int, float)) or (isinstance(value, str) and value.isdigit()):
        try:
            number = float(str(value).translate(DIGITS))
        except ValueError:
            return fallback
        if number > 1e11:  # ملّي ثانية
            number /= 1000.0
        if number < 1e8:  # ليس طابعاً زمنيّاً — رقمٌ عابر
            return fallback
        try:
            return datetime.fromtimestamp(number, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return fallback

    text = str(value).strip().translate(DIGITS)

    # الصيغةُ التي تكتبها لوحةُ التحرير: «٢ مايو ٢٠٢٦»
    arabic = re.match(r"^(\d{1,2})\s+([^\d]+?)\s+(\d{4})$", text)
    if arabic:
        day, month_name, year = arabic.group(1), arabic.group(2).strip(), arabic.group(3)
        month = MONTH_INDEX.get(ARABIC_DIACRITICS.sub("", month_name))
        if month:
            try:
                return datetime(int(year), month, int(day), tzinfo=timezone.utc)
            except ValueError:
                return fallback

    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        pass

    for pattern, order in (
        (r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})", "ymd"),
        (r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", "dmy"),
    ):
        match = re.match(pattern, text)
        if not match:
            continue
        a, b, c = (int(g) for g in match.groups())
        year, month, day = (a, b, c) if order == "ymd" else (c, b, a)
        try:
            return datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError:
            return fallback

    return fallback


def arabic_date(value: datetime) -> str:
    """«12 سبتمبر 2026»."""
    return f"{value.day} {MONTHS_AR[value.month - 1]} {value.year}"


def relative_date(value: datetime, now: datetime | None = None) -> str:
    """«قبل ٣ ساعات» — يعود إلى التاريخ الكامل بعد أسبوعين."""
    now = now or datetime.now(timezone.utc)
    delta = now - value
    seconds = delta.total_seconds()
    if seconds < 0:
        return arabic_date(value)
    minutes, hours, days = seconds / 60, seconds / 3600, delta.days

    if minutes < 2:
        return "الآن"
    if minutes < 60:
        return f"قبل {int(minutes)} دقيقة"
    if hours < 24:
        count = int(hours)
        unit = "ساعة" if count < 11 else "ساعة"
        return f"قبل {count} {unit}"
    if days == 1:
        return "أمس"
    if days < 14:
        return f"قبل {days} أيّام" if days < 11 else f"قبل {days} يوماً"
    return arabic_date(value)


def is_html(value: str) -> bool:
    """يميّز محتوى المحرّر الغنيّ عن نصّ Markdown."""
    return bool(re.search(r"<(p|div|h[1-6]|ul|ol|img|br|figure|blockquote|table)\b", value or "", re.I))
