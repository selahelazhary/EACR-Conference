"""عشرون تنسيقاً للموقع — هيكلُ الصفحة لا لونُها.

التصميمُ (themes.py) يختار الورقَ والحبرَ والعلامة؛ والتنسيقُ هنا يختار
كيف تُرتَّب الصفحةُ فوق ذلك الورق: عرضُ الصحن، ونَفَسُ المسافات، وشكلُ
البطاقة، ونسبةُ الصورة، وصدرُ الرئيسيّة، وهيئةُ الشريط العلويّ.

ولا تُكتب عشرون ورقةَ أنماطٍ يدويّاً: كلُّ تنسيقٍ يعلن مقاديرَه فتُشتقُّ
منها متغيّراتُ CSS، ويعلن بنيتَه فتُكتب سماتٍ على جذر الصفحة تلتقطها
layouts.css. فزيادةُ تنسيقٍ جديدٍ سطرٌ واحدٌ في الجدول.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

NL = chr(10)

# ── المقادير ───────────────────────────────────────────────────

SHELL = {
    "narrow": "1080px",
    "normal": "1280px",
    "wide":   "1420px",
    "full":   "min(1600px, 94vw)",
}

# نَفَسُ المسافات: الفجوةُ الصغيرةُ · الكبيرةُ · حاشيةُ الصحن
DENSITY = {
    "tight":  ("clamp(.75rem, .5rem + .9vw, 1.15rem)", "clamp(1.4rem, 1rem + 2vw, 2.6rem)",   "clamp(.8rem, .4rem + 1.6vw, 1.4rem)"),
    "normal": ("clamp(1rem, .6rem + 1.4vw, 1.75rem)",  "clamp(2.2rem, 1.4rem + 3vw, 4.5rem)", "clamp(1rem, .5rem + 2vw, 2rem)"),
    "airy":   ("clamp(1.3rem, .8rem + 2vw, 2.4rem)",   "clamp(3rem, 1.8rem + 4.4vw, 6.4rem)", "clamp(1.2rem, .6rem + 2.6vw, 2.8rem)"),
}

# البطاقة: حشوةٌ · خلفيّةٌ · سُمكُ الإطار · ظلٌّ · زاوية
CARDS = {
    "plain":  ("0",      "transparent",      "0",   "none",             "0"),
    "line":   (".9rem",  "transparent",      "1px", "none",             "var(--r-md)"),
    "boxed":  ("1rem",   "var(--surface)",   "1px", "none",             "var(--r-md)"),
    "shadow": ("1rem",   "var(--surface)",   "0",   "var(--shadow-sm)", "var(--r-lg)"),
    "tint":   (".95rem", "var(--surface-2)", "0",   "none",             "var(--r-md)"),
}

# العناوين: وزنٌ · تعقّبُ الحروف · ارتفاعُ السطر
HEADS = {
    "sharp":  ("900", "-.03em",  "1.28"),
    "normal": ("800", "-.015em", "1.35"),
    "calm":   ("700", "0",       "1.5"),
}

# سُمكُ الخطّ الفاصل تحت عناوين الأقسام
RULES = {"hair": "1px", "solid": "2px", "bold": "4px"}

RATIOS = {"wide": "16/9", "photo": "3/2", "classic": "4/3", "square": "1/1"}

HEADER_HEIGHT = {"tall": "84px", "center": "104px", "compact": "52px", "bar": "62px"}


@dataclass(frozen=True)
class Layout:
    id: str
    name: str
    group: str
    shell: str = "normal"
    density: str = "normal"
    cards: str = "boxed"
    ratio: str = "wide"
    heads: str = "normal"
    rule: str = "solid"
    masthead: str = "bar"     # bar · center · tall · compact
    hero: str = "split"       # split · stack · wide · poster · list
    note: str = ""

    # ── الاشتقاق ───────────────────────────────────────────────
    def variables(self) -> dict[str, str]:
        gap, gap_lg, pad = DENSITY.get(self.density, DENSITY["normal"])
        card_pad, card_bg, card_line, card_shadow, card_radius = CARDS.get(self.cards, CARDS["boxed"])
        weight, track, height = HEADS.get(self.heads, HEADS["normal"])
        return {
            "--shell": SHELL.get(self.shell, SHELL["normal"]),
            "--gap": gap,
            "--gap-lg": gap_lg,
            "--pad": pad,
            "--card-pad": card_pad,
            "--card-bg": card_bg,
            "--card-line": card_line,
            "--card-shadow": card_shadow,
            "--card-radius": card_radius,
            "--media-ratio": RATIOS.get(self.ratio, RATIOS["wide"]),
            "--title-weight": weight,
            "--title-track": track,
            "--title-lh": height,
            "--rule-w": RULES.get(self.rule, RULES["solid"]),
            "--header-h": HEADER_HEIGHT.get(self.masthead, HEADER_HEIGHT["bar"]),
        }

    def attributes(self) -> dict[str, str]:
        """ما يُكتب على جذر الصفحة فتلتقطه ورقةُ الأنماط."""
        return {
            "data-layout": self.id,
            "data-masthead": self.masthead,
            "data-hero": self.hero,
            "data-cards": self.cards,
        }

    def css(self, selector: str = ":root") -> str:
        lines = [f"{selector} {{"]
        lines += [f"  {name}: {value};" for name, value in self.variables().items()]
        lines.append("}")
        return NL.join(lines)

    def card(self) -> dict[str, Any]:
        """ما تحتاجه لوحةُ التحرير لترسم مصغَّرَ التنسيق."""
        return {
            "id": self.id,
            "name": self.name,
            "group": self.group,
            "note": self.note,
            "masthead": self.masthead,
            "hero": self.hero,
            "cards": self.cards,
            "density": self.density,
            "shell": self.shell,
            "ratio": RATIOS.get(self.ratio, RATIOS["wide"]),
            "vars": self.variables(),
            "attrs": self.attributes(),
        }


# ── العشرون ────────────────────────────────────────────────────
# (المعرّف، الاسم، المجموعة، الصحن، النَفَس، البطاقة، النسبة، العناوين، الفاصل، الشريط، الصدر، ملاحظة)
_ROWS: tuple[tuple, ...] = (
    # جرائد
    ("classic",   "الجريدة الكلاسيكيّة", "جرائد", "normal", "normal", "plain",  "photo",   "sharp",  "solid", "bar",     "split",  "التنسيقُ الذي بُني عليه الموقع"),
    ("broad",     "الصفحة الأولى",       "جرائد", "wide",   "tight",  "plain",  "photo",   "sharp",  "bold",  "tall",    "wide",   "عنوانٌ عريضٌ يملأ الصدر"),
    ("column",    "الأعمدة",             "جرائد", "narrow", "normal", "plain",  "classic", "sharp",  "hair",  "center",  "list",   "صدرٌ بلا صورةٍ كبيرة"),
    ("digest",    "الموجز",              "جرائد", "narrow", "tight",  "line",   "square",  "normal", "hair",  "compact", "list",   "قائمةٌ كثيفةٌ لمن يقرأ سريعاً"),
    ("weekend",   "ملحقُ الأسبوع",       "جرائد", "wide",   "airy",   "plain",  "photo",   "sharp",  "solid", "center",  "poster", "غلافٌ كبيرٌ والعنوانُ فوقه"),
    # مجلّات
    ("magazine",  "المجلّة",             "مجلّات", "normal", "airy",  "shadow", "photo",   "normal", "hair",  "center",  "stack",  ""),
    ("gallery",   "المعرض",              "مجلّات", "wide",   "normal", "shadow", "square",  "normal", "hair",  "bar",     "stack",  "صورٌ مربّعةٌ متساوية"),
    ("editorial", "التحرير",             "مجلّات", "normal", "airy",   "line",   "classic", "calm",   "hair",  "tall",    "wide",   ""),
    ("cover",     "الغلاف",              "مجلّات", "full",   "normal", "tint",   "wide",    "sharp",  "solid", "compact", "poster", ""),
    ("feature",   "الملفّ",              "مجلّات", "normal", "airy",   "boxed",  "photo",   "normal", "solid", "center",  "wide",   ""),
    # حديث
    ("modern",    "الحديث",              "حديث",  "normal", "normal", "boxed",  "wide",    "normal", "hair",  "bar",     "split",  ""),
    ("cardstack", "الألواح",             "حديث",  "normal", "normal", "shadow", "wide",    "normal", "hair",  "bar",     "stack",  ""),
    ("minimal",   "الأدنى",              "حديث",  "narrow", "airy",   "plain",  "wide",    "calm",   "hair",  "compact", "stack",  "بياضٌ واسعٌ ولا زخرفة"),
    ("dense",     "الكثيف",              "حديث",  "wide",   "tight",  "line",   "wide",    "normal", "hair",  "compact", "split",  "أكبرُ عددٍ من المواد في الشاشة"),
    ("tiles",     "البلاط",              "حديث",  "wide",   "tight",  "tint",   "square",  "normal", "hair",  "bar",     "stack",  ""),
    # هادئ
    ("reader",    "القارئ",              "هادئ",  "narrow", "airy",   "plain",  "photo",   "calm",   "hair",  "compact", "list",   "مصمَّمٌ للقراءة الطويلة"),
    ("journal",   "الدفتر",              "هادئ",  "narrow", "normal", "line",   "classic", "calm",   "hair",  "center",  "stack",  ""),
    ("focus",     "التركيز",             "هادئ",  "narrow", "airy",   "plain",  "wide",    "calm",   "hair",  "compact", "wide",   ""),
    ("wideview",  "الشاشةُ العريضة",     "هادئ",  "full",   "normal", "boxed",  "wide",    "normal", "solid", "bar",     "split",  "يستغلُّ الشاشاتِ الكبيرة"),
    ("poster",    "الملصق",              "هادئ",  "normal", "airy",   "tint",   "square",  "sharp",  "bold",  "tall",    "poster", ""),
)

LAYOUTS: tuple[Layout, ...] = tuple(
    Layout(id=r[0], name=r[1], group=r[2], shell=r[3], density=r[4], cards=r[5],
           ratio=r[6], heads=r[7], rule=r[8], masthead=r[9], hero=r[10], note=r[11])
    for r in _ROWS
)

BY_ID = {layout.id: layout for layout in LAYOUTS}
DEFAULT = "classic"


def get(layout_id: str | None) -> Layout:
    return BY_ID.get(str(layout_id or ""), BY_ID[DEFAULT])


def catalog() -> list[dict[str, Any]]:
    return [layout.card() for layout in LAYOUTS]


def stylesheet(layout_id: str | None) -> str:
    return get(layout_id).css()


def attributes(layout_id: str | None) -> str:
    """سماتُ جذر الصفحة جاهزةً للطباعة في القالب."""
    pairs = get(layout_id).attributes().items()
    return " ".join(f'{name}="{value}"' for name, value in pairs)
