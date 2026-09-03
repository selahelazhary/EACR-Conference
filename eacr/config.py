"""تحميلُ إعدادات الموقع من content/site.yml وتعريفُ مسارات المشروع."""

from __future__ import annotations

from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import Any

import yaml

from .ads import AdsConfig, load_ads

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
ARTICLES_DIR = CONTENT_DIR / "articles"
PAGES_DIR = CONTENT_DIR / "pages"
THEME_DIR = ROOT / "theme"
TEMPLATES_DIR = THEME_DIR / "templates"
STATIC_DIR = THEME_DIR / "static"
SNAPSHOT_PATH = CONTENT_DIR / "firebase-snapshot.json"
MANIFEST_PATH = CONTENT_DIR / "build-manifest.json"
OUTPUT_DIR = ROOT  # الموقع يُبنى في جذر المستودع لأنّ الاستضافة تخدمه من الفرع

# أشكالُ عرض القسم المعروفة — ما خرج عنها يعود إلى standard
DISPLAYS = ("standard", "agenda", "people", "video", "gallery")


@dataclass(frozen=True)
class Section:
    """قسمٌ واحدٌ من أقسام الموقع: أخبارٌ أو فعاليّاتٌ أو متحدّثون أو ما يضيفه المحرّر."""

    id: str
    name: str
    plural: str = ""
    slug: str = ""
    single: str = ""       # ما يُكتب فوق المادّة الواحدة: خبر · فعاليّة · متحدّث
    icon: str = "newspaper"
    accent: str = "#C2185B"
    display: str = "standard"
    description: str = ""

    @property
    def url(self) -> str:
        return f"/{self.slug}/"

    @property
    def one(self) -> str:
        return self.single or self.name

    @property
    def many(self) -> str:
        return self.plural or self.name

    def shows(self, *displays: str) -> bool:
        return self.display in displays


_SECTION_KEYS = {f.name for f in fields(Section)}
_SAFE_SLUG = str.maketrans({" ": "-", "/": "-", "\\": "-", ".": "-", "?": "", "#": ""})


def make_section(raw: Any) -> Section | None:
    """يبني قسماً من قاموسٍ قد يأتي من الملفّ أو من لوحة الإدارة.

    اللوحةُ تكتب ما تكتبه؛ فنتجاهل المفاتيحَ التي لا نعرفها، ونُكمل
    الناقصَ بقيمٍ معقولة، ولا نَدَع قسماً بلا معرّفٍ يكسر البناء.
    """
    if not isinstance(raw, dict):
        return None
    data = {k: v for k, v in raw.items() if k in _SECTION_KEYS}
    section_id = str(data.get("id") or "").strip().translate(_SAFE_SLUG)
    if not section_id or section_id.startswith((".", "-", "_")):
        return None
    name = str(data.get("name") or "").strip() or section_id
    slug = str(data.get("slug") or "").strip().translate(_SAFE_SLUG).strip("/") or section_id
    display = str(data.get("display") or "standard")
    return Section(
        id=section_id,
        name=name,
        plural=str(data.get("plural") or "").strip() or name,
        slug=slug,
        single=str(data.get("single") or "").strip(),
        icon=str(data.get("icon") or "newspaper"),
        accent=str(data.get("accent") or "#C2185B"),
        display=display if display in DISPLAYS else "standard",
        description=str(data.get("description") or "").strip(),
    )


def make_sections(rows: Any) -> list[Section]:
    """قائمةُ أقسامٍ نظيفةٌ بلا تكرارٍ في المعرّف أو في الرابط."""
    sections: list[Section] = []
    seen_ids: set[str] = set()
    seen_slugs: set[str] = set()
    for raw in rows if isinstance(rows, list) else []:
        section = make_section(raw)
        if section is None or section.id in seen_ids or section.slug in seen_slugs:
            continue
        seen_ids.add(section.id)
        seen_slugs.add(section.slug)
        sections.append(section)
    return sections


def section_dicts(sections: list[Section]) -> list[dict[str, Any]]:
    return [{f.name: getattr(s, f.name) for f in fields(Section)} for s in sections]


@dataclass
class SiteConfig:
    data: dict[str, Any]
    sections: list[Section] = field(default_factory=list)

    def __getitem__(self, key: str) -> Any:
        return self.data[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

    @property
    def build(self) -> dict[str, Any]:
        return self.data.get("build", {})

    def section(self, section_id: str) -> Section | None:
        return next((s for s in self.sections if s.id == section_id), None)

    def sections_showing(self, *displays: str) -> list[Section]:
        return [s for s in self.sections if s.display in displays]

    # ── ما تكتبه اللوحةُ يتقدّم على ما في الملفّ ──────────────
    def merge_live(self, live: dict[str, Any] | None) -> None:
        """يدمج عقدةَ site_config من القاعدة فوق القيم الافتراضيّة.

        الملفُّ هو الأصلُ الذي يقوم عليه الموقعُ ولو خلت القاعدة،
        واللوحةُ تكتب فوقه ما غيّره المحرّر — فلا يضيع أحدُهما.
        """
        if not isinstance(live, dict):
            return
        for key in ("title", "tagline", "description", "copyright"):
            value = live.get("identity", {}).get(key) if isinstance(live.get("identity"), dict) else None
            if isinstance(value, str) and value.strip():
                self.data[key] = value.strip()

        for section in ("identity", "appearance", "visibility", "labels"):
            node = live.get(section)
            if isinstance(node, dict):
                current = self.data.get(section)
                self.data[section] = {**current, **node} if isinstance(current, dict) else dict(node)

        # بياناتُ المؤتمر: دمجٌ على مستويين ليبقى ما لم تكتبه اللوحة
        conference = live.get("conference")
        if isinstance(conference, dict):
            merged = dict(self.data.get("conference") or {})
            for key, value in conference.items():
                if isinstance(value, dict) and isinstance(merged.get(key), dict):
                    merged[key] = {**merged[key], **value}
                elif value not in (None, {}):
                    merged[key] = value
            self.data["conference"] = merged

        for key, target in (("nav", "extra_nav"), ("footer", "footer_nav"), ("social", "social")):
            rows = live.get("links", {}).get(key) if isinstance(live.get("links"), dict) else None
            if isinstance(rows, list) and rows:
                kept = [r for r in rows if isinstance(r, dict) and r.get("name") and r.get("url")]
                if kept:
                    self.data[target] = kept

        team = live.get("team")
        if isinstance(team, list) and team:
            self.data["team"] = [t for t in team if isinstance(t, dict) and t.get("name")]

        # الأقسام: ما تضبطه اللوحةُ يحلُّ محلَّ قائمة الملفّ كاملةً،
        # فحذفُ قسمٍ من اللوحة يجب أن يُحذف فعلاً لا أن يعود من الملفّ.
        live_sections = make_sections(live.get("sections"))
        if live_sections:
            self.sections = live_sections
            self.data["sections"] = section_dicts(live_sections)

    @property
    def identity(self) -> dict[str, Any]:
        return self.data.get("identity", {}) or {}

    @property
    def appearance(self) -> dict[str, Any]:
        return self.data.get("appearance", {}) or {}

    @property
    def conference(self) -> dict[str, Any]:
        return self.data.get("conference", {}) or {}

    @property
    def sponsors(self) -> dict[str, Any]:
        return self.data.get("sponsors", {}) or {}

    def visible(self, key: str) -> bool:
        """كلُّ شيءٍ ظاهرٌ حتّى يُطفأ صراحةً."""
        return self.data.get("visibility", {}).get(key, True) is not False

    @property
    def ads(self) -> AdsConfig:
        return load_ads(self.data.get("ads"))

    @property
    def database_url(self) -> str:
        return self.data.get("firebase", {}).get("database_url", "").rstrip("/")


def load_config(path: Path | None = None) -> SiteConfig:
    """يقرأ ملفَّ الإعدادات ويحوّل الأقسام إلى كائناتٍ مُحكمة."""
    path = path or (CONTENT_DIR / "site.yml")
    with path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}

    return SiteConfig(data=data, sections=make_sections(data.get("sections", [])))
