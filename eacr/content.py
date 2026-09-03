"""نموذجُ المحتوى: يجمع موادَّ Firebase وملفّاتِ Markdown في قائمةٍ واحدةٍ موحّدة."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import yaml

from .config import ARTICLES_DIR, PAGES_DIR, SiteConfig
from .markup import Heading, enhance, first_image, to_html
from .text import (
    arabic_date,
    excerpt,
    is_html,
    parse_date,
    reading_time,
    slugify,
    strip_html,
    word_count,
)

YOUTUBE_RE = re.compile(r"(?:youtu\.be/|watch\?v=|embed/|shorts/)([A-Za-z0-9_-]{6,})")
FRONT_MATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.S)


@dataclass
class Category:
    id: str
    name: str
    color: str = "#C2185B"
    slug: str = ""
    count: int = 0

    def __post_init__(self) -> None:
        self.slug = self.slug or slugify(self.name or self.id, fallback=self.id)

    @property
    def url(self) -> str:
        return f"/topic/{self.slug}/"


@dataclass
class Item:
    """مادّةٌ تحريريّةٌ واحدة، أيّاً كان مصدرُها."""

    id: str
    section: str
    title: str
    body: str = ""
    dek: str = ""
    image: str = ""
    date: datetime = field(default_factory=lambda: parse_date(None))
    category_ids: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    author: str = ""
    source: str = ""
    video: str = ""
    featured: bool = False
    origin: str = "firebase"
    headings: list[Heading] = field(default_factory=list)
    categories: list[Category] = field(default_factory=list)
    slug: str = ""
    section_slug: str = ""
    section_name: str = ""
    section_one: str = ""
    display: str = "standard"
    venue: str = ""    # قاعةُ الفعاليّة أو مكانُها
    when: str = ""     # توقيتُها كما يكتبه المحرّر: «١٠:٠٠ — ١٢:٣٠»
    role: str = ""     # صفةُ المتحدّث وجهتُه
    accent: str = "#C2185B"
    focus_x: float = 50.0
    focus_y: float = 50.0

    # ── خصائصُ مشتقّة ─────────────────────────────────────────────
    @property
    def section_url(self) -> str:
        """رابطُ القسم — من رابطه لا من معرّفه، فقد يختلفان في قسمٍ يُضاف من اللوحة."""
        return f"/{self.section_slug or self.section}/"

    @property
    def url(self) -> str:
        return f"{self.section_url}{self.slug}/"

    @property
    def words(self) -> int:
        return word_count(self.body)

    @property
    def minutes(self) -> int:
        return reading_time(self.body)

    @property
    def plain(self) -> str:
        return strip_html(self.body)

    @property
    def date_label(self) -> str:
        return arabic_date(self.date)

    @property
    def iso(self) -> str:
        return self.date.isoformat()

    @property
    def focus(self) -> str:
        """بؤرةُ الصورة كما تفهمها CSS — أيُّ جزءٍ يبقى حين تُقصّ."""
        return f"{self.focus_x:g}% {self.focus_y:g}%"

    @property
    def off_center(self) -> bool:
        return abs(self.focus_x - 50) > 0.5 or abs(self.focus_y - 50) > 0.5

    @property
    def has_image(self) -> bool:
        return bool(self.image)

    @property
    def video_id(self) -> str:
        match = YOUTUBE_RE.search(self.video or "")
        return match.group(1) if match else ""

    @property
    def poster(self) -> str:
        if self.image:
            return self.image
        return f"https://img.youtube.com/vi/{self.video_id}/hqdefault.jpg" if self.video_id else ""

    def search_record(self) -> dict[str, Any]:
        return {
            "t": self.title,
            "u": self.url,
            "s": self.section,
            "n": self.section_name,
            "d": self.dek,
            "c": [c.name for c in self.categories],
            "i": self.image,
            "p": self.date_label,
            "m": self.minutes,
            "b": self.plain[:600],
        }


def _focus(raw: dict[str, Any], axis: str) -> float:
    """بؤرةُ الصورة تُحفظ {x, y} بالمئة؛ ما خرج عن المدى يعود إلى المنتصف."""
    node = raw.get("focus")
    if not isinstance(node, dict):
        return 50.0
    try:
        value = float(node.get(axis, 50))
    except (TypeError, ValueError):
        return 50.0
    return min(100.0, max(0.0, value))


def _first(mapping: dict[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        value = mapping.get(key)
        if value not in (None, "", [], {}):
            return value
    return default


TOPIC_COLORS = (
    "#C2185B", "#0F9D8F", "#E0245E", "#F59E0B", "#2563EB",
    "#7C3AED", "#DC2626", "#0891B2", "#65A30D", "#DB2777",
)

SPLIT_TAGS = re.compile(r"[،,؛;|\n]+")


def _topic_color(slug: str) -> str:
    total = sum(ord(ch) for ch in slug)
    return TOPIC_COLORS[total % len(TOPIC_COLORS)]


def split_tags(value: str) -> list[str]:
    """لوحةُ التحرير تحفظ التصنيفَ حزمةَ كلماتٍ مفصولةً بفواصل — نفكّها موضوعاتٍ مستقلّة."""
    seen: list[str] = []
    for part in SPLIT_TAGS.split(value or ""):
        name = part.strip().strip(".،").strip()
        if not name or len(name) > 44:
            continue
        if name not in seen:
            seen.append(name)
    return seen


def build_topics(raw: Any) -> tuple[dict[str, Category], dict[str, list[str]]]:
    """يعود بـ (فهرسِ الموضوعات بالرابط، وخريطةِ حزمةِ التصنيف → موضوعاتها)."""
    topics: dict[str, Category] = {}
    bundles: dict[str, list[str]] = {}
    if not raw:
        return topics, bundles

    entries = raw.items() if isinstance(raw, dict) else enumerate(raw)
    for key, entry in entries:
        if not isinstance(entry, dict):
            continue
        bundle_id = str(_first(entry, "id", default="") or key)
        slugs: list[str] = []
        for name in split_tags(str(_first(entry, "name", "title", default=""))):
            slug = slugify(name, fallback="")
            if not slug:
                continue
            if slug not in topics:
                topics[slug] = Category(id=slug, name=name, color=_topic_color(slug), slug=slug)
            if slug not in slugs:
                slugs.append(slug)
        bundles[bundle_id] = slugs
    return topics, bundles


# وصفٌ يليق بنتائج البحث حين تخلو المادّةُ من متنٍ يُشتقُّ منه ملخّص —
# مبنيٌّ على شكل عرض القسم لا على معرّفه، فيصلح للأقسام التي تُضاف لاحقاً.
DEK_TEMPLATES = {
    "video": "{title} — تسجيلٌ مصوَّرٌ من {conference}، المنعقد في {venue}.",
    "gallery": "{title} — من ألبوم صور {conference} في {venue}.",
    "people": "{title} — من المتحدّثين في {conference}.",
    "agenda": "{title} — فعاليّةٌ ضمن برنامج {conference} في {venue}.",
}
DEK_DEFAULT = "{title} — {section} في {conference}، المنعقد في {venue}."


def _fallback_dek(item: Item, section: Any, config: SiteConfig) -> str:
    """وصفٌ محترمٌ للمادّة الخالية من المتن، بدل تركِ الوصف فارغاً."""
    conference = config.conference
    fields = {
        "title": item.title.strip(),
        "section": getattr(section, "many", "مادّة"),
        "conference": conference.get("name") or config.get("title", ""),
        "venue": conference.get("venue") or "",
    }
    template = DEK_TEMPLATES.get(item.display, DEK_DEFAULT)
    text = template.format(**fields)
    if item.dek and len(item.dek) > 25:
        text = f"{item.dek} — {fields['section']} في {fields['conference']}."
    return re.sub(r"\s+", " ", text.replace("، المنعقد في .", ".").replace(" في .", ".")).strip()


def _finalize(
    item: Item,
    config: SiteConfig,
    topics: dict[str, Category],
    bundles: dict[str, list[str]],
) -> Item:
    """يُكمل الحقولَ المشتقّة: الرابط، والقسم، والموضوعات، والملخّص، والعناوين."""
    section = config.section(item.section)
    if section:
        item.section_name = section.name
        item.section_one = section.one
        item.section_slug = section.slug
        item.accent = section.accent
        item.display = section.display

    rendered = enhance(item.body)
    item.body, item.headings = rendered.html, rendered.headings

    if not item.image:
        item.image = first_image(item.body)
    if not item.dek:
        item.dek = excerpt(item.body, config.build.get("excerpt_words", 34))
    if len(item.dek) < 60:  # موادُّ الصور والفيديو بلا متنٍ — وصفٌ يليق بنتائج البحث
        item.dek = _fallback_dek(item, section, config)

    # حزمُ التصنيف تُفكّ إلى موضوعاتٍ مفردة، والمكتوبُ يدويّاً يُسلَك مباشرةً
    slugs: list[str] = []
    for raw_id in item.category_ids:
        for slug in bundles.get(raw_id, [slugify(raw_id, fallback="")]):
            if slug and slug not in slugs:
                slugs.append(slug)
    for tag in item.tags:
        slug = slugify(tag, fallback="")
        if slug and slug not in slugs:
            slugs.append(slug)
            topics.setdefault(slug, Category(id=slug, name=tag, color=_topic_color(slug), slug=slug))

    item.category_ids = slugs
    item.categories = [topics[slug] for slug in slugs if slug in topics]

    short = re.sub(r"[^A-Za-z0-9]", "", item.id)[-5:].lower() or "x"
    item.slug = item.slug or f"{slugify(item.title, fallback='mada')}-{short}"
    return item


def from_snapshot(
    snapshot: dict[str, Any],
    config: SiteConfig,
    topics: dict[str, Category],
    bundles: dict[str, list[str]],
) -> list[Item]:
    """يقرأ موادَّ الأقسام من لقطة Firebase."""
    items: list[Item] = []
    for section in config.sections:
        node = snapshot.get(section.id)
        if not isinstance(node, dict):
            continue
        for key, raw in node.items():
            if not isinstance(raw, dict):
                continue
            title = str(_first(raw, "title", "name", default="")).strip()
            if not title:
                continue
            body_raw = str(_first(raw, "content", "body", "text", default=""))
            item = Item(
                id=str(key),
                section=section.id,
                title=title,
                body=to_html(body_raw, is_markdown=not is_html(body_raw)),
                dek=strip_html(str(_first(raw, "summary", "description", "excerpt", default=""))),
                image=str(_first(raw, "image", "imageUrl", "img", "photo", "thumbnail", default="")),
                date=parse_date(_first(raw, "date", "createdAt", "timestamp", default=None)),
                category_ids=[str(c) for c in (raw.get("categories") or []) if c],
                tags=[str(t) for t in (raw.get("tags") or []) if t],
                author=str(_first(raw, "author", "writer", default="")),
                source=str(_first(raw, "source", "reference", default="")),
                video=str(_first(raw, "video", "videoUrl", "url", "link", default="")),
                featured=bool(raw.get("featured")),
                venue=str(_first(raw, "venue", "hall", "place", default="")),
                when=str(_first(raw, "when", "time", "schedule", default="")),
                role=str(_first(raw, "role", "affiliation", "position", default="")),
                focus_x=_focus(raw, "x"),
                focus_y=_focus(raw, "y"),
                origin="firebase",
            )
            items.append(_finalize(item, config, topics, bundles))
    return items


def _parse_front_matter(text: str) -> tuple[dict[str, Any], str]:
    match = FRONT_MATTER_RE.match(text)
    if not match:
        return {}, text
    meta = yaml.safe_load(match.group(1)) or {}
    return (meta if isinstance(meta, dict) else {}), match.group(2)


def from_markdown(
    config: SiteConfig,
    topics: dict[str, Category],
    bundles: dict[str, list[str]],
    directory: Path | None = None,
) -> list[Item]:
    """يقرأ الموادَّ المكتوبةَ محلّيّاً في content/articles/*.md."""
    directory = directory or ARTICLES_DIR
    if not directory.exists():
        return []

    items: list[Item] = []
    for path in sorted(directory.glob("*.md")):
        if path.name.startswith("_"):
            continue
        meta, body = _parse_front_matter(path.read_text(encoding="utf-8"))
        if meta.get("draft"):
            continue
        default_section = config.sections[0].id if config.sections else "news"
        section_id = str(meta.get("section", default_section))
        if not config.section(section_id):
            section_id = default_section
        item = Item(
            id=str(meta.get("id", path.stem)),
            section=section_id,
            title=str(meta.get("title", path.stem)),
            body=to_html(body, is_markdown=True),
            dek=str(meta.get("summary", meta.get("dek", ""))),
            image=str(meta.get("image", "")),
            date=parse_date(meta.get("date")),
            category_ids=[str(c) for c in (meta.get("categories") or [])],
            tags=[str(t) for t in (meta.get("tags") or [])],
            author=str(meta.get("author", "")),
            source=str(meta.get("source", "")),
            video=str(meta.get("video", "")),
            featured=bool(meta.get("featured")),
            venue=str(meta.get("venue", "")),
            when=str(meta.get("when", "")),
            role=str(meta.get("role", "")),
            origin="local",
            slug=str(meta.get("slug", "")) or slugify(str(meta.get("title", path.stem))),
        )
        items.append(_finalize(item, config, topics, bundles))
    return items


@dataclass
class StaticPage:
    slug: str
    title: str
    body: str
    description: str = ""
    headings: list[Heading] = field(default_factory=list)
    template: str = "page.html"

    @property
    def url(self) -> str:
        return f"/{self.slug}/"


def load_pages(directory: Path | None = None) -> list[StaticPage]:
    directory = directory or PAGES_DIR
    if not directory.exists():
        return []
    pages: list[StaticPage] = []
    for path in sorted(directory.glob("*.md")):
        meta, body = _parse_front_matter(path.read_text(encoding="utf-8"))
        rendered = enhance(to_html(body, is_markdown=True))
        pages.append(
            StaticPage(
                slug=str(meta.get("slug", path.stem)),
                title=str(meta.get("title", path.stem)),
                body=rendered.html,
                description=str(meta.get("description", excerpt(rendered.html, 30))),
                headings=rendered.headings,
                template=str(meta.get("template", "page.html")),
            )
        )
    return pages


@dataclass
class Sponsor:
    """داعمٌ واحدٌ للمؤتمر — شعارٌ واسمٌ ورابطٌ ومستوى دعم."""

    id: str
    name: str
    logo: str = ""
    url: str = ""
    tier: str = ""
    note: str = ""
    order: int = 0

    @property
    def has_logo(self) -> bool:
        return bool(self.logo)


@dataclass
class Tier:
    """مستوى دعمٍ بما تحته من داعمين."""

    id: str
    name: str
    size: int = 140
    sponsors: list[Sponsor] = field(default_factory=list)


def load_sponsors(raw: Any, config: SiteConfig) -> list[Tier]:
    """يرتّب داعمي القاعدة تحت مستوياتِ الدعم المعرَّفة في الإعدادات.

    الداعمُ الذي لا مستوى له — أو مستواه غيرُ معرَّف — يسقط في آخر
    مستوىً معرَّف، فلا يضيع من الصفحة لخطأٍ في حقل.
    """
    settings = config.sponsors
    tiers = [
        Tier(
            id=str(row.get("id") or ""),
            name=str(row.get("name") or ""),
            size=int(row.get("size") or 140),
        )
        for row in (settings.get("tiers") or [])
        if isinstance(row, dict) and row.get("id")
    ]
    if not tiers:
        tiers = [Tier(id="partner", name=str(settings.get("title") or "الداعمون"))]
    by_id = {tier.id: tier for tier in tiers}

    entries = raw.items() if isinstance(raw, dict) else enumerate(raw if isinstance(raw, list) else [])
    for key, entry in entries:
        if not isinstance(entry, dict):
            continue
        name = str(_first(entry, "name", "title", default="")).strip()
        logo = str(_first(entry, "logo", "image", "imageUrl", default="")).strip()
        if not name and not logo:
            continue
        try:
            order = int(entry.get("order") or 0)
        except (TypeError, ValueError):
            order = 0
        sponsor = Sponsor(
            id=str(entry.get("id") or key),
            name=name,
            logo=logo,
            url=str(_first(entry, "url", "link", "website", default="")).strip(),
            tier=str(entry.get("tier") or ""),
            note=str(_first(entry, "note", "description", default="")).strip(),
            order=order,
        )
        by_id.get(sponsor.tier, tiers[-1]).sponsors.append(sponsor)

    for tier in tiers:
        tier.sponsors.sort(key=lambda s: (s.order, s.name))
    return [tier for tier in tiers if tier.sponsors]


def dedupe(items: Iterable[Item]) -> list[Item]:
    """المادّةُ المحلّيّة تتقدّم على مثيلتها في القاعدة عند تطابق العنوان والقسم."""
    seen: dict[tuple[str, str], Item] = {}
    for item in items:
        key = (item.section, slugify(item.title))
        current = seen.get(key)
        if current is None or (current.origin == "firebase" and item.origin == "local"):
            seen[key] = item
    return sorted(seen.values(), key=lambda i: i.date, reverse=True)
