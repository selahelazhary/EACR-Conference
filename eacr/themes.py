"""واحدٌ وأربعون تصميماً جاهزاً — لوحةٌ كاملةٌ تُشتقّ من أربعة ألوانٍ بذرة.

لا نكتب أربعين لوحةً بأربعين لوناً يدويّاً؛ يكفي أن نختار لكلِّ تصميمٍ
ورقَه وحبرَه وعلامتَه وشرارتَه، ثمّ تُشتقّ منها السطوحُ والخطوطُ والباهت
باشتقاقٍ واحدٍ منضبط — فتخرج لوحاتٌ متناسقةٌ لا تتنافر ألوانُها،
ويبقى تغييرُ لونٍ واحدٍ من اللوحة كافياً لتتبعه اللوحةُ كلُّها.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

NL = chr(10)

# ── حسابُ الألوان ──────────────────────────────────────────────


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    text = value.lstrip("#")
    if len(text) == 3:
        text = "".join(ch * 2 for ch in text)
    return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _rgb_to_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{max(0, min(255, round(c))):02X}" for c in rgb)


def mix(first: str, second: str, amount: float) -> str:
    """amount = نصيبُ اللون الثاني (0 → الأوّل كما هو، 1 → الثاني)."""
    a, b = _hex_to_rgb(first), _hex_to_rgb(second)
    return _rgb_to_hex(tuple(a[i] + (b[i] - a[i]) * amount for i in range(3)))


def luminance(value: str) -> float:
    r, g, b = (c / 255 for c in _hex_to_rgb(value))
    channel = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4  # noqa: E731
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def readable_on(value: str) -> str:
    """أبيضُ أم أسود يُقرأ فوق هذا اللون؟"""
    return "#FFFFFF" if luminance(value) < 0.42 else "#12111A"


def contrast(first: str, second: str) -> float:
    """نسبةُ التباين بين لونين كما تحسبها معايير الوصول."""
    high, low = sorted((luminance(first), luminance(second)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def readable(color: str, background: str, ratio: float = 4.4) -> str:
    """يرفع اللونَ نحو البياض أو يخفضه نحو السواد حتّى يُقرأ فوق الخلفيّة.

    بأقلِّ تغييرٍ ممكن — فتبقى العلامةُ علامتَها وإن انقلب الورقُ حبراً.
    """
    target = WHITE if luminance(background) < 0.4 else BLACK
    tuned = color
    for step in range(1, 21):
        if contrast(tuned, background) >= ratio:
            break
        tuned = mix(color, target, step * 0.05)
    return tuned


# ── أساسُ الليل والنهار: منه يُشتقُّ توأمُ كلِّ تصميم ─────────────

WHITE = "#FFFFFF"
BLACK = "#08080C"
NIGHT_PAPER = "#0B0B10"
NIGHT_INK = "#F4F2EC"
DAY_PAPER = "#FCFBF8"
DAY_INK = "#15141B"

SHADOWS = {
    "light": (
        "0 1px 2px rgb(20 18 30 / .05), 0 2px 8px rgb(20 18 30 / .04)",
        "0 2px 6px rgb(20 18 30 / .06), 0 12px 32px rgb(20 18 30 / .08)",
        "0 8px 24px rgb(20 18 30 / .10), 0 32px 64px rgb(20 18 30 / .12)",
    ),
    "dark": (
        "0 1px 2px rgb(0 0 0 / .5)",
        "0 4px 14px rgb(0 0 0 / .5)",
        "0 18px 50px rgb(0 0 0 / .6)",
    ),
}

# ── مقاييسُ الشكل ──────────────────────────────────────────────

RADIUS = {
    "soft":  ("8px", "14px", "22px"),
    "sharp": ("3px", "5px", "8px"),
    "round": ("12px", "20px", "34px"),
    "pill":  ("14px", "24px", "42px"),
}

FONTS = {
    "tajawal": ('"Tajawal"', "Tajawal:wght@500;700;800;900"),
    "plex": ('"IBM Plex Sans Arabic"', "IBM+Plex+Sans+Arabic:wght@300;400;500;600;700"),
    "cairo": ('"Cairo"', "Cairo:wght@400;600;700;900"),
    "almarai": ('"Almarai"', "Almarai:wght@300;400;700;800"),
    "readex": ('"Readex Pro"', "Readex+Pro:wght@300;400;500;600;700"),
    "kufi": ('"Noto Kufi Arabic"', "Noto+Kufi+Arabic:wght@400;600;700;900"),
    "amiri": ('"Amiri"', "Amiri:wght@400;700"),
    "rubik": ('"Rubik"', "Rubik:wght@400;500;600;800"),
    "changa": ('"Changa"', "Changa:wght@400;600;700;800"),
    "markazi": ('"Markazi Text"', "Markazi+Text:wght@400;500;700"),
}


def block(selector: str, variables: dict[str, str], mode: str = "light") -> str:
    """كتلةُ رموزٍ واحدة: محدِّدٌ ثمّ متغيّراتُه."""
    lines = [f"{selector} {{"]
    lines += [f"  {name}: {value};" for name, value in variables.items()]
    lines.append(f"  color-scheme: {mode};")
    lines.append("}")
    return NL.join(lines)


@dataclass(frozen=True)
class Theme:
    id: str
    name: str
    group: str
    mode: str          # light | dark
    paper: str
    ink: str
    brand: str
    spark: str
    radius: str = "soft"
    display: str = "tajawal"
    body: str = "plex"
    note: str = ""

    # ── الاشتقاق ───────────────────────────────────────────────
    @property
    def dark(self) -> bool:
        return self.mode == "dark"

    def seeds(self, mode: str) -> tuple[str, str, str, str]:
        """بذورُ اللوحة في وضعٍ ما: ورقٌ وحبرٌ وعلامةٌ وشرارة.

        في وضع التصميم الأصليّ تُؤخذ كما اختارها صاحبُها؛ وفي الوضع المقابل
        يُشتقُّ توأمٌ يحفظ العلامةَ والشرارةَ ويقلب الورقَ والحبر — فالتصميمُ
        الذي يختاره المحرّرُ يبقى هو هو، وإن قلب القارئُ ليلَه نهاراً.
        """
        if mode == self.mode:
            return self.paper, self.ink, self.brand, self.spark
        if mode == "dark":
            paper = mix(NIGHT_PAPER, self.brand, 0.07)
            ink = mix(NIGHT_INK, self.brand, 0.05)
        else:
            paper = mix(DAY_PAPER, self.brand, 0.035)
            ink = mix(DAY_INK, self.brand, 0.07)
        return paper, ink, readable(self.brand, paper), readable(self.spark, paper)

    def palette(self, mode: str | None = None) -> dict[str, str]:
        mode = mode or self.mode
        dark = mode == "dark"
        paper, ink, brand, spark = self.seeds(mode)
        surface = mix(paper, WHITE, 0.045 if dark else 0.62)
        small, medium, large = SHADOWS["dark" if dark else "light"]
        return {
            "--paper": paper,
            "--paper-2": mix(paper, ink, 0.045),
            "--surface": surface,
            "--surface-2": mix(paper, ink, 0.075),
            "--ink": ink,
            "--ink-2": mix(ink, paper, 0.22),
            "--muted": mix(ink, paper, 0.46),
            "--line": mix(paper, ink, 0.16),
            "--line-soft": mix(paper, ink, 0.085),
            "--brand": brand,
            "--brand-ink": readable_on(brand),
            "--spark": spark,
            "--amber": "#FFC14D" if dark else "#F0A202",
            "--shadow-sm": small,
            "--shadow-md": medium,
            "--shadow-lg": large,
        }

    def shape(self) -> dict[str, str]:
        small, medium, large = RADIUS.get(self.radius, RADIUS["soft"])
        return {"--r-sm": small, "--r-md": medium, "--r-lg": large}

    def type_scale(self) -> dict[str, str]:
        display = FONTS.get(self.display, FONTS["tajawal"])[0]
        body = FONTS.get(self.body, FONTS["plex"])[0]
        return {
            "--font-display": f'{display}, "Tajawal", system-ui, sans-serif',
            "--font-body": f'{body}, "IBM Plex Sans Arabic", system-ui, sans-serif',
        }

    def variables(self, mode: str | None = None) -> dict[str, str]:
        return {**self.palette(mode), **self.shape(), **self.type_scale()}

    def font_query(self) -> list[str]:
        return [FONTS[key][1] for key in {self.display, self.body} if key in FONTS]

    def css(self, selector: str = ":root", mode: str | None = None) -> str:
        return block(selector, self.variables(mode), mode or self.mode)

    def card(self) -> dict[str, Any]:
        """ما تحتاجه لوحةُ التحرير لعرض بطاقة المعاينة."""
        colors = self.palette()
        return {
            "id": self.id,
            "name": self.name,
            "group": self.group,
            "mode": self.mode,
            "note": self.note,
            "swatch": [colors["--paper"], colors["--surface"], colors["--brand"],
                       colors["--spark"], colors["--ink"]],
            "vars": self.variables(),
            "fonts": self.font_query(),
        }


# ── لوحاتُ التصميم ───────────────────────────────────────────────────
# (المعرّف، الاسم، المجموعة، الوضع، الورق، الحبر، العلامة، الشرارة، الشكل، خطّ العناوين، خطّ المتن، ملاحظة)
_ROWS: tuple[tuple, ...] = (
    # صحافةٌ كلاسيكيّة
    ("broadsheet", "الجريدة الكبرى", "صحافة", "light", "#FFFDF8", "#1A1815", "#1F3A5F", "#B3242B", "sharp", "amiri", "plex", "ورقٌ عاجيٌّ وحبرٌ داكن"),
    ("gazette", "الغازيت", "صحافة", "light", "#F7F6F2", "#12131A", "#2B4C7E", "#C0392B", "sharp", "cairo", "plex", ""),
    ("chronicle", "السجلّ", "صحافة", "light", "#FAF9F6", "#191720", "#34495E", "#A93226", "soft", "markazi", "almarai", ""),
    ("tribune", "المنبر", "صحافة", "light", "#FFFFFF", "#101014", "#0B3C5D", "#D62828", "sharp", "kufi", "plex", "أبيضُ صافٍ وتباينٌ حادّ"),
    # حديثٌ وتقنيّ
    ("neo", "نيو", "حديث", "light", "#F8FAFC", "#0F172A", "#2563EB", "#DB2777", "round", "readex", "readex", ""),
    ("mint", "نعناع", "حديث", "light", "#F6FBF9", "#10231E", "#0F9D8F", "#E0245E", "round", "rubik", "plex", ""),
    ("violet", "بنفسج", "حديث", "light", "#FAF8FF", "#1A1327", "#7C3AED", "#F59E0B", "round", "changa", "plex", ""),
    ("cobalt", "كوبالت", "حديث", "light", "#F5F8FF", "#0D1526", "#1D4ED8", "#F97316", "soft", "rubik", "readex", ""),
    ("cyan", "سماوي", "حديث", "light", "#F4FBFD", "#0B1B22", "#0891B2", "#EA580C", "pill", "readex", "plex", ""),
    # دافئ
    ("sand", "رمل", "دافئ", "light", "#FDF9F3", "#1F1A14", "#B45309", "#0F766E", "soft", "tajawal", "almarai", ""),
    ("clay", "طين", "دافئ", "light", "#FBF6F2", "#231A17", "#9A3412", "#166534", "round", "cairo", "plex", ""),
    ("rose", "وردي", "دافئ", "light", "#FFF8FA", "#241820", "#BE185D", "#0E7490", "round", "changa", "plex", ""),
    ("amberly", "عنبر", "دافئ", "light", "#FFFBF2", "#211B10", "#D97706", "#1D4ED8", "soft", "tajawal", "plex", ""),
    ("terracotta", "فخّار", "دافئ", "light", "#FDF7F4", "#241C18", "#C2410C", "#0F766E", "sharp", "almarai", "almarai", ""),
    # باردٌ وأخضر
    ("forest", "غابة", "بارد", "light", "#F5FAF6", "#0F1A13", "#166534", "#B45309", "soft", "cairo", "plex", ""),
    ("sage", "مريميّة", "بارد", "light", "#F7FAF8", "#141A17", "#4D7C6F", "#B45309", "round", "readex", "almarai", ""),
    ("ocean", "محيط", "بارد", "light", "#F3F9FC", "#0A1720", "#0E7490", "#DC2626", "soft", "rubik", "plex", ""),
    ("slate", "أردواز", "بارد", "light", "#F6F7F9", "#111318", "#334155", "#E11D48", "sharp", "kufi", "plex", ""),
    ("steel", "فولاذ", "بارد", "light", "#F4F6F8", "#0E1216", "#475569", "#0891B2", "sharp", "readex", "readex", ""),
    # ليليّ
    ("midnight", "منتصف الليل", "ليلي", "dark", "#0B0B10", "#F3F1EC", "#5FB4E8", "#FF5C8A", "soft", "tajawal", "plex", "الوضعُ الليليُّ الأصلي"),
    ("carbon", "كربون", "ليلي", "dark", "#0E0E11", "#EDEDF2", "#8B5CF6", "#F472B6", "round", "readex", "readex", ""),
    ("ink-blue", "حبرٌ أزرق", "ليلي", "dark", "#0A1220", "#E6EDF7", "#60A5FA", "#FB7185", "soft", "rubik", "plex", ""),
    ("emerald-night", "زمرّدٌ ليلي", "ليلي", "dark", "#08120F", "#E4F1EC", "#34D399", "#FBBF24", "round", "cairo", "plex", ""),
    ("wine", "نبيذ", "ليلي", "dark", "#140A11", "#F3E9EE", "#F472B6", "#FCD34D", "soft", "changa", "almarai", ""),
    ("obsidian", "سبج", "ليلي", "dark", "#000000", "#FAFAFA", "#FFFFFF", "#FF3B30", "sharp", "kufi", "plex", "أسودُ خالصٌ لشاشات OLED"),
    ("dusk", "غسق", "ليلي", "dark", "#131020", "#EAE7F5", "#A78BFA", "#F59E0B", "round", "markazi", "plex", ""),
    ("deep-sea", "قاعُ البحر", "ليلي", "dark", "#06141B", "#DFF0F5", "#22D3EE", "#FB923C", "soft", "readex", "plex", ""),
    # تباينٌ عالٍ وإمكانيّةُ وصول
    ("high-contrast", "تباينٌ عالٍ", "وصول", "light", "#FFFFFF", "#000000", "#0000CC", "#CC0000", "sharp", "kufi", "kufi", "لأصحاب ضعف البصر"),
    ("hc-dark", "تباينٌ عالٍ ليلي", "وصول", "dark", "#000000", "#FFFFFF", "#7DD3FC", "#FCA5A5", "sharp", "kufi", "kufi", ""),
    ("sepia", "سيبيا", "وصول", "light", "#F4ECD8", "#2B2416", "#7C4A20", "#8B2E2E", "soft", "amiri", "markazi", "مريحٌ للقراءة الطويلة"),
    ("paperwhite", "ورقٌ إلكتروني", "وصول", "light", "#F7F7F5", "#1C1C1C", "#3A3A3A", "#8A2C2C", "sharp", "markazi", "markazi", "يحاكي قارئَ الكتب"),
    # علاماتٌ جريئة
    ("eacr", "هويّةُ المؤتمر", "علامة", "light", "#FCFAFB", "#15141B", "#C2185B", "#00ABCB", "soft", "tajawal", "plex", "ورديُّ شعار الجمعيّة وفيروزُه"),
    ("eacr-night", "هويّةُ المؤتمر — ليلاً", "علامة", "dark", "#0D0A0E", "#F5F0F3", "#F06BA8", "#3ECFE8", "soft", "tajawal", "plex", "توأمُ هويّة المؤتمر لشاشات الليل"),
    ("olive", "زيتونٌ وذهب", "علامة", "light", "#FAFAF5", "#14180F", "#2E7D32", "#C8A415", "soft", "amiri", "almarai", "أخضرُ زيتونيٌّ وذهب"),
    ("nile", "النيل", "علامة", "light", "#F4FAFA", "#0C1A1C", "#00838F", "#EF6C00", "round", "cairo", "plex", ""),
    ("sunrise", "شروق", "علامة", "light", "#FFFAF5", "#1F1508", "#EA580C", "#0369A1", "pill", "changa", "plex", ""),
    ("royal", "ملكيّ", "علامة", "light", "#F8F7FC", "#15122A", "#4C1D95", "#D97706", "round", "changa", "almarai", ""),
    ("crimson", "قرمز", "علامة", "light", "#FFF7F7", "#1E1113", "#9F1239", "#0F766E", "soft", "cairo", "plex", ""),
    ("graphite", "جرافيت", "علامة", "light", "#F5F5F6", "#131316", "#18181B", "#EF4444", "sharp", "rubik", "rubik", "رماديٌّ صارمٌ وشرارةٌ حمراء"),
    ("teal-gold", "فيروزٌ وذهب", "علامة", "light", "#F6FAFA", "#0E1A1A", "#0D9488", "#CA8A04", "round", "readex", "plex", ""),
    ("indigo", "نيليّ", "علامة", "light", "#F7F8FD", "#12142B", "#3730A3", "#DB2777", "soft", "rubik", "plex", ""),
)

THEMES: tuple[Theme, ...] = tuple(
    Theme(id=row[0], name=row[1], group=row[2], mode=row[3], paper=row[4], ink=row[5],
          brand=row[6], spark=row[7], radius=row[8], display=row[9], body=row[10],
          note=row[11])
    for row in _ROWS
)

BY_ID = {theme.id: theme for theme in THEMES}
DEFAULT = "eacr"


def get(theme_id: str | None) -> Theme:
    return BY_ID.get(str(theme_id or ""), BY_ID[DEFAULT])


def catalog() -> list[dict[str, Any]]:
    return [theme.card() for theme in THEMES]


def stylesheet(theme_id: str | None, overrides: dict[str, str] | None = None) -> str:
    """كتلةُ الأنماط التي تُطبع في رأس كلِّ صفحة.

    التصميمُ لا يُكتب في محدِّدٍ واحدٍ بل في أربعة: الأصلُ كما اختاره المحرّر،
    ونهارُه، وليلُه، وما يتبع نظامَ القارئ. فلو قلب القارئُ الوضعَ الليليّ
    لم يعد إلى لوحة المصنع، بل إلى ليل التصميم نفسِه.
    """
    theme = get(theme_id)
    clean = {k: v for k, v in (overrides or {}).items() if v}

    def tune(variables: dict[str, str]) -> dict[str, str]:
        """ما يختاره المحرّرُ بيده يتقدّم على التصميم، ويجرّ معه مشتقّاتِه."""
        if clean.get("brand"):
            variables["--brand"] = clean["brand"]
            variables["--brand-ink"] = readable_on(clean["brand"])
        if clean.get("spark"):
            variables["--spark"] = clean["spark"]
        if clean.get("radius") in RADIUS:
            small, medium, large = RADIUS[clean["radius"]]
            variables.update({"--r-sm": small, "--r-md": medium, "--r-lg": large})
        return variables

    light = tune(theme.variables("light"))
    dark = tune(theme.variables("dark"))
    base = dark if theme.dark else light

    return NL.join([
        block(":root", base, theme.mode),
        block(':root[data-theme="light"]', light, "light"),
        block(':root[data-theme="dark"]', dark, "dark"),
        "@media (prefers-color-scheme: dark) {",
        block('  :root[data-theme="auto"]', dark, "dark"),
        "}",
        "@media (prefers-color-scheme: light) {",
        block('  :root[data-theme="auto"]', light, "light"),
        "}",
    ])


def theme_color(theme_id: str | None, mode: str) -> str:
    """لونُ شريط المتصفّح — ورقُ التصميم في ذلك الوضع."""
    return get(theme_id).palette(mode)["--paper"]


def font_links(theme_id: str | None) -> str:
    families = "&".join(f"family={query}" for query in get(theme_id).font_query())
    return f"https://fonts.googleapis.com/css2?{families}&display=swap" if families else ""
