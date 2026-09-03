"""تحويلُ المحتوى إلى HTML وتحسينُه: عناوينُ مُرقَّمة، وجدولُ محتويات، وصورٌ كسولة."""

from __future__ import annotations

import re
from dataclasses import dataclass

import markdown

from .text import slugify, strip_html

_MD = markdown.Markdown(
    extensions=["extra", "sane_lists", "admonition", "attr_list", "nl2br"],
    output_format="html5",
)

HEADING_RE = re.compile(r"<h([23])(\s[^>]*)?>(.*?)</h\1>", re.S | re.I)
H1_RE = re.compile(r"<(/?)h1(\s[^>]*)?>", re.I)
STYLE_ATTR_RE = re.compile(r'\sstyle\s*=\s*"([^"]*)"|\sstyle\s*=\s*\'([^\']*)\'', re.I)
FONT_TAG_RE = re.compile(r"</?font[^>]*>", re.I)
EMPTY_P_RE = re.compile(r"<p[^>]*>(?:\s|&nbsp;|<br\s*/?>)*</p>", re.I)
SPAN_BARE_RE = re.compile(r"<span\s*>(.*?)</span>", re.S | re.I)

# ما يُسمح ببقائه من التنسيق المضمَّن — الباقي يعود إلى نظام التصميم
KEEP_STYLES = ("text-align", "direction")
IMG_RE = re.compile(r"<img\b((?:(?!/?>).)*)/?>", re.S | re.I)
IFRAME_RE = re.compile(r"<iframe\b((?:(?!/?>).)*)>\s*</iframe>", re.S | re.I)
FIRST_IMG_SRC = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.I)


@dataclass
class Heading:
    level: int
    text: str
    anchor: str


@dataclass
class Rendered:
    html: str
    headings: list[Heading]


def to_html(body: str, is_markdown: bool = True) -> str:
    """Markdown → HTML، أو تمريرُ محتوى المحرّر الغنيّ كما هو."""
    if not body:
        return ""
    if not is_markdown:
        return body
    _MD.reset()
    return _MD.convert(body)


def normalize_editor_html(html_body: str) -> str:
    """يُخضع مُخرَجَ المحرّر الغنيّ لنظام تصميم الموقع.

    محرّرُ لوحة التحرير يُلصق ألواناً وخطوطاً ومقاساتٍ مضمّنةً تتصادم مع
    الوضع الليلي ومع تناسق الطباعة؛ نُبقي المحاذاة والاتّجاه فقط.
    """

    def keep_allowed(match: re.Match[str]) -> str:
        raw = match.group(1) or match.group(2) or ""
        kept = [
            rule.strip()
            for rule in raw.split(";")
            if rule.strip() and rule.split(":", 1)[0].strip().lower() in KEEP_STYLES
        ]
        return f' style="{"; ".join(kept)}"' if kept else ""

    body = STYLE_ATTR_RE.sub(keep_allowed, html_body)
    body = FONT_TAG_RE.sub("", body)
    body = EMPTY_P_RE.sub("", body)
    body = SPAN_BARE_RE.sub(r"\1", body)
    return body


def enhance(html_body: str) -> Rendered:
    """يُضيف المراسيَ إلى العناوين، ويُكسِل الصور، ويغلّف الإطارات المدمجة."""
    if not html_body:
        return Rendered(html="", headings=[])

    html_body = normalize_editor_html(html_body)

    # عنوانُ الصفحة واحدٌ لا غير: ما جاء <h1> داخل المتن يُخفَّض إلى <h2>
    html_body = H1_RE.sub(lambda m: f"<{m.group(1)}h2{m.group(2) or ''}>", html_body)

    headings: list[Heading] = []
    seen: dict[str, int] = {}

    def heading_sub(match: re.Match[str]) -> str:
        level, attrs, inner = int(match.group(1)), match.group(2) or "", match.group(3)
        label = strip_html(inner)
        base = slugify(label, fallback=f"h{len(headings) + 1}", max_len=48)
        seen[base] = seen.get(base, 0) + 1
        anchor = base if seen[base] == 1 else f"{base}-{seen[base]}"
        headings.append(Heading(level=level, text=label, anchor=anchor))
        if "id=" in attrs:
            attrs = re.sub(r'\sid=["\'][^"\']*["\']', "", attrs)
        return (
            f'<h{level} id="{anchor}"{attrs} class="prose-heading">'
            f'<a class="anchor" href="#{anchor}" aria-label="رابطٌ مباشرٌ إلى: {label}">#</a>'
            f"{inner}</h{level}>"
        )

    body = HEADING_RE.sub(heading_sub, html_body)

    def img_sub(match: re.Match[str]) -> str:
        attrs = match.group(1)
        if "loading=" not in attrs:
            attrs += ' loading="lazy" decoding="async"'
        if "alt=" not in attrs:
            attrs += ' alt=""'
        return f"<img{attrs}>"

    body = IMG_RE.sub(img_sub, body)
    body = IFRAME_RE.sub(
        lambda m: f'<div class="embed"><iframe{m.group(1)} loading="lazy"></iframe></div>', body
    )
    return Rendered(html=body, headings=headings)


def first_image(html_body: str) -> str:
    match = FIRST_IMG_SRC.search(html_body or "")
    return match.group(1) if match else ""


# ── الفواصلُ الإعلانيّةُ داخل النصّ ──────────────────────────────
P_CLOSE_RE = re.compile(r"</p>", re.I)
AD_SLOT = '<div class="ad ad--flow" data-ad="article_mid" data-ad-n="{n}"></div>'


def inject_in_article(html_body: str, every: int = 4, limit: int = 3, lead: int = 2) -> str:
    """يضع مواضعَ إعلانيّةً بين الفقرات — لا في أوّل النصّ ولا في آخره.

    الوسمُ هنا فارغٌ لا يطلب شيئاً؛ `ads.js` هو الذي يملؤه حين يقترب
    من الشاشة، فإن كانت الإعلاناتُ مُطفأةً بقي فراغاً بلا أثر.
    """
    if not html_body or every < 1 or limit < 1:
        return html_body

    ends = [m.end() for m in P_CLOSE_RE.finditer(html_body)]
    if len(ends) < lead + every:
        return html_body

    picks: list[int] = []
    index = lead + every - 1
    while index < len(ends) - 1 and len(picks) < limit:
        picks.append(ends[index])
        index += every

    for number, position in reversed(list(enumerate(picks, start=1))):
        html_body = html_body[:position] + AD_SLOT.format(n=number) + html_body[position:]
    return html_body
