"""بناءُ الموقع كاملاً: يجمع المحتوى، ويولّد كلَّ صفحةٍ وملفٍّ."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import content as content_mod
from . import feeds
from . import markup
from .media import MediaStore
from .config import CONTENT_DIR, MANIFEST_PATH, OUTPUT_DIR, STATIC_DIR, SiteConfig, load_config
from .content import Category, Item, StaticPage, Tier
from .firebase import load_snapshot
from .render import make_env, render_to, write

MIN_TOPIC_ITEMS = 2  # صفحةُ الموضوع لا تُنشأ إلّا إذا جمع منشورين فأكثر

# مجلّداتٌ يولّدها البناءُ دائماً — تُمسح قبل كلِّ بناءٍ لئلّا تبقى فيها بقايا
FIXED_DIRS = (
    "assets", "topic", "topics", "archive", "search", "saved",
    "about", "subscribe", "sponsors", "offline",
)


@dataclass
class Page:
    """صفحةُ فهرسٍ مُرقَّمة."""

    number: int
    total: int
    items: list[Item]
    base_url: str

    @property
    def has_prev(self) -> bool:
        return self.number > 1

    @property
    def has_next(self) -> bool:
        return self.number < self.total

    @property
    def prev_url(self) -> str:
        return self.base_url if self.number == 2 else f"{self.base_url}page/{self.number - 1}/"

    @property
    def next_url(self) -> str:
        return f"{self.base_url}page/{self.number + 1}/"

    def url_for(self, number: int) -> str:
        return self.base_url if number == 1 else f"{self.base_url}page/{number}/"

    @property
    def numbers(self) -> list[int]:
        span = range(max(1, self.number - 2), min(self.total, self.number + 2) + 1)
        return list(span)


@dataclass
class Site:
    config: SiteConfig
    items: list[Item]
    categories: list[Category]
    pages: list[StaticPage]
    sponsors: list[Tier]
    snapshot_meta: dict[str, Any]

    def by_section(self, section_id: str) -> list[Item]:
        return [i for i in self.items if i.section == section_id]

    def by_category(self, category_id: str) -> list[Item]:
        return [i for i in self.items if category_id in i.category_ids]

    @property
    def featured(self) -> list[Item]:
        picked = [i for i in self.items if i.featured]
        return picked or self.items[:5]

    @property
    def sponsor_count(self) -> int:
        return sum(len(tier.sponsors) for tier in self.sponsors)


def collect(config: SiteConfig | None = None) -> Site:
    """يجمع منشورات الموقع من لقطة Firebase وحدها."""
    config = config or load_config()
    snapshot = load_snapshot()
    config.merge_live(snapshot.get("site_config"))

    topics, bundles = content_mod.build_topics(snapshot.get("categories"))
    items = content_mod.from_snapshot(snapshot, config, topics, bundles)
    items = content_mod.dedupe(items)

    # العدُّ بعد إزالة التكرار، ثمّ إسقاطُ الموضوعات التي لا تجمع منشورين
    for topic in topics.values():
        topic.count = 0
    for item in items:
        for topic in item.categories:
            topic.count += 1

    used = sorted(
        (t for t in topics.values() if t.count >= MIN_TOPIC_ITEMS),
        key=lambda t: (-t.count, t.name),
    )
    kept = {t.id for t in used}
    for item in items:
        item.categories = [t for t in item.categories if t.id in kept]
        item.category_ids = [t.id for t in item.categories]

    return Site(
        config=config,
        items=items,
        categories=used,
        pages=content_mod.load_pages(),
        sponsors=content_mod.load_sponsors(snapshot.get("sponsors"), config),
        snapshot_meta=snapshot.get("_meta", {}) if isinstance(snapshot, dict) else {},
    )


def related(site: Site, item: Item, limit: int = 4) -> list[Item]:
    """الأقربُ موضوعاً: تشاركٌ في التصنيفات أوّلاً، ثمّ القسمُ نفسه."""
    scored: list[tuple[int, Item]] = []
    tags = set(item.category_ids)
    for other in site.items:
        if other.url == item.url:
            continue
        score = len(tags & set(other.category_ids)) * 3
        if other.section == item.section:
            score += 1
        if score:
            scored.append((score, other))
    scored.sort(key=lambda pair: (-pair[0], -pair[1].date.timestamp()))
    picked = [i for _, i in scored[:limit]]
    if len(picked) < limit:
        seen = {p.url for p in picked} | {item.url}
        picked += [i for i in site.items if i.url not in seen][: limit - len(picked)]
    return picked


def paginate(items: list[Item], per_page: int, base_url: str) -> list[Page]:
    if not items:
        return [Page(number=1, total=1, items=[], base_url=base_url)]
    total = (len(items) + per_page - 1) // per_page
    return [
        Page(number=n + 1, total=total, items=items[n * per_page : (n + 1) * per_page], base_url=base_url)
        for n in range(total)
    ]


def copy_static(output: Path) -> None:
    target = output / "assets"
    if target.exists():
        shutil.rmtree(target)
    if STATIC_DIR.exists():
        shutil.copytree(STATIC_DIR, target)


def publish_dictionaries(output: Path) -> int:
    """ينشر معاجمَ الترجمة مع الأصول — الأصولُ تُمسح كلَّ بناءٍ فتُنسخ معها.

    المعجمُ مصدرُه ``content/i18n/`` ويُصحَّح باليد؛ وهذا ينسخه مضغوطاً
    إلى ``assets/i18n/`` حيث يقرؤه ``lang.js``.
    """
    source = CONTENT_DIR / "i18n"
    if not source.is_dir():
        return 0
    target = output / "assets" / "i18n"
    target.mkdir(parents=True, exist_ok=True)
    count = 0
    for path in sorted(source.glob("*.json")):
        try:
            table = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        write(target / path.name,
              json.dumps(table, ensure_ascii=False, separators=(",", ":")))
        count += 1
    return count


def _previous_dirs() -> list[str]:
    """مجلّداتُ البناء السابق — بها نعرف قسماً حُذف من اللوحة فنمسح صفحاتِه."""
    if not MANIFEST_PATH.exists():
        return []
    try:
        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return [str(name) for name in data.get("dirs", []) if isinstance(name, str)]


def clean_generated(output: Path, config: SiteConfig) -> None:
    """يمسح مُخرجاتِ البناء السابق فقط — لا يقترب من ملفّات المستودع الأخرى."""
    slugs = [s.slug for s in config.sections]
    for name in {*FIXED_DIRS, *slugs, *_previous_dirs()}:
        if not name or name.startswith(".") or "/" in name or "\\" in name:
            continue
        path = output / name
        if path.is_dir():
            shutil.rmtree(path)


def remember_dirs(config: SiteConfig, pages: list[StaticPage]) -> None:
    """يحفظ ما وُلِّد في هذه الجولة ليُمسح في الجولة القادمة إن زال سببُه."""
    dirs = sorted({*FIXED_DIRS, *(s.slug for s in config.sections), *(p.slug for p in pages)})
    write(MANIFEST_PATH, json.dumps({"dirs": dirs}, ensure_ascii=False, indent=1))


def build(output: Path | None = None, verbose: bool = True) -> Site:
    output = output or OUTPUT_DIR
    site = collect()
    config = site.config
    env = make_env(config)
    build_cfg = config.build

    clean_generated(output, config)
    copy_static(output)
    publish_dictionaries(output)

    # الصورُ المضمّنةُ في نصوص المحرّر تُستخرج ملفّاتٍ قبل أن تُطبع في صفحة
    store = MediaStore(output / "assets" / "media")
    ads_cfg = config.ads
    for item in site.items:
        item.body = store.rewrite(item.body)
        item.image = store.rewrite_url(item.image)
        if ads_cfg.has("article_mid"):
            item.body = markup.inject_in_article(
                item.body, ads_cfg.in_article_every, ads_cfg.in_article_max
            )
    for static_page in site.pages:
        static_page.body = store.rewrite(static_page.body)

    written = 0
    sitemap_urls: list[tuple[str, datetime, str, str]] = []
    now = datetime.now(timezone.utc)
    newest = site.items[0].date if site.items else now

    def emit(template: str, path: Path, url: str | None = None, freq: str = "weekly",
             priority: str = "0.6", lastmod: datetime | None = None, **ctx: Any) -> None:
        nonlocal written
        render_to(env, template, path, site=site, config=config, **ctx)
        written += 1
        if url is not None:
            sitemap_urls.append((url, lastmod or now, freq, priority))

    # ── الرئيسيّة ─────────────────────────────────────────────────
    rails = [
        (section, site.by_section(section.id)[: build_cfg.get("rail_count", 6)])
        for section in config.sections
    ]
    # صدرُ الصفحة يفضّل خبراً بصورة: المتحدّثون والصورُ لهما ألواحُهما أدناه
    story_ids = {s.id for s in config.sections_showing("standard", "agenda")}
    stories = [i for i in site.items if i.section in story_ids] or site.items
    lead = next((i for i in stories if i.poster), stories[0] if stories else None)
    rest = [i for i in stories if i is not lead]
    top = rest[:4]
    river = rest[4 : build_cfg.get("home_latest", 14)]

    emit(
        "home.html",
        output / "index.html",
        url="/",
        freq="daily",
        priority="1.0",
        lastmod=newest,
        lead=lead,
        top=top,
        river=river,
        latest=site.items[: build_cfg.get("home_latest", 14)],
        rails=[(s, i) for s, i in rails if i],
        featured=site.featured[:6],
        page_title=None,
        page_url="/",
    )

    # ── الأقسام ومنشوراتُها ────────────────────────────────────────
    for section in config.sections:
        items = site.by_section(section.id)
        pages = paginate(items, build_cfg.get("per_page", 12), section.url)
        for page in pages:
            path = output / section.slug / "index.html" if page.number == 1 else (
                output / section.slug / "page" / str(page.number) / "index.html"
            )
            emit(
                "section.html",
                path,
                url=page.url_for(page.number),
                freq="daily",
                priority="0.8" if page.number == 1 else "0.4",
                lastmod=items[0].date if items else now,
                section=section,
                page=page,
                page_title=section.many,
                page_url=page.url_for(page.number),
            )

        for index, item in enumerate(items):
            emit(
                "item.html",
                output / section.slug / item.slug / "index.html",
                url=item.url,
                freq="monthly",
                priority="0.9" if item.featured else "0.7",
                lastmod=item.date,
                item=item,
                section=section,
                related=related(site, item),
                next_item=items[index - 1] if index else None,
                prev_item=items[index + 1] if index + 1 < len(items) else None,
                page_title=item.title,
                page_url=item.url,
            )

    # ── الموضوعات ────────────────────────────────────────────────
    for category in site.categories:
        items = site.by_category(category.id)
        emit(
            "topic.html",
            output / "topic" / category.slug / "index.html",
            url=category.url,
            freq="weekly",
            priority="0.6",
            lastmod=items[0].date if items else now,
            category=category,
            items=items,
            page_title=category.name,
            page_url=category.url,
        )

    emit(
        "topics.html",
        output / "topics" / "index.html",
        url="/topics/",
        page_title="الموضوعات",
        page_url="/topics/",
    )

    # ── الأرشيف ──────────────────────────────────────────────────
    buckets: dict[int, dict[int, list[Item]]] = {}
    for item in site.items:
        buckets.setdefault(item.date.year, {}).setdefault(item.date.month, []).append(item)
    archive = [
        (year, sorted(months.items(), key=lambda pair: -pair[0]))
        for year, months in sorted(buckets.items(), key=lambda pair: -pair[0])
    ]
    emit(
        "archive.html",
        output / "archive" / "index.html",
        url="/archive/",
        freq="daily",
        priority="0.5",
        archive=archive,
        page_title="الأرشيف",
        page_url="/archive/",
    )

    # ── صفحاتٌ وظيفيّة ───────────────────────────────────────────
    emit("search.html", output / "search" / "index.html", url="/search/",
         page_title="البحث", page_url="/search/")
    emit("saved.html", output / "saved" / "index.html", url="/saved/",
         priority="0.3", page_title="المحفوظات", page_url="/saved/")
    emit("sponsors.html", output / "sponsors" / "index.html", url="/sponsors/", priority="0.8",
         page_title=str(config.sponsors.get("title") or "داعمو المؤتمر"), page_url="/sponsors/")
    emit("about.html", output / "about" / "index.html", url="/about/", priority="0.8",
         page_title="عن المؤتمر", page_url="/about/")
    emit("404.html", output / "404.html", page_title="صفحة غير موجودة", page_url="/404.html")
    emit("offline.html", output / "offline" / "index.html", page_title="لا يوجد اتّصال",
         page_url="/offline/")
    emit("live.html", output / "read.html", page_title="جارٍ الفتح", page_url="/read.html")
    emit("follow.html", output / "subscribe" / "index.html", url="/subscribe/", priority="0.6",
         page_title="اشترك وتابع", page_url="/subscribe/")

    # لوحةُ الإدارة — خارجَ الفهرسة، ومسارُها من site.yml
    admin_path = str(config.get("admin", {}).get("path", "admin.html")).strip("/")
    render_to(env, "admin.html", output / admin_path, site=site, config=config,
              page_title="لوحة الإدارة", page_url=f"/{admin_path}")
    written += 1

    for page in site.pages:
        emit(
            page.template,
            output / page.slug / "index.html",
            url=page.url,
            priority="0.5",
            page=page,
            page_title=page.title,
            page_url=page.url,
        )

    # ── تحويلُ العناوين القديمة المفهرسة ─────────────────────────
    for rule in config.get("redirects", []) or []:
        source = str(rule.get("from", "")).strip("/")
        if not source:
            continue
        path = output / source
        if not path.name.endswith(".html"):
            path = path / "index.html"
        render_to(env, "redirect.html", path, site=site, config=config,
                  target=str(rule.get("to", "/")), page_title="انتقل العنوان", page_url="/")
        written += 1

    # ── ملفّاتُ الآلات ───────────────────────────────────────────
    feeds.sitemap(config, sitemap_urls, output / "sitemap.xml")
    feeds.rss(config, site.items, output / "rss.xml")
    feeds.search_index(site.items, site.categories, output / "search-index.json")
    feeds.news_pulse(site.items, output / "news-latest.json")
    feeds.robots(config, output / "robots.txt")
    feeds.manifest(config, output / "manifest.webmanifest")
    feeds.ads_txt(config, output / "ads.txt")
    feeds.theme_catalog(output / "themes.json")
    feeds.skins(output / "assets" / "skins")
    render_to(env, "sw.js", output / "sw.js", site=site, config=config)
    render_to(env, "rss.xsl", output / "rss.xsl", site=site, config=config)
    write(output / ".nojekyll", "")
    written += 10

    remember_dirs(config, site.pages)

    if verbose:
        print(f"  ✔ {written} ملفّاً مُولَّداً")
        print(f"  ✔ {len(site.items)} منشوراً · {len(config.sections)} أقساماً · "
              f"{len(site.categories)} موضوعاً · {site.sponsor_count} داعماً")
        if store.count:
            print(f"  ✔ {store.count} صورةً مضمّنةً استُخرجت إلى ملفّات "
                  f"(−{store.saved_bytes // 1024 // 1024} ميجابايت من صفحات الموقع)")
        if ads_cfg.active:
            mode = "معاينة" if ads_cfg.test_mode else "مباشر"
            print(f"  ✔ الإعلانات: {mode} · {sum(1 for p in ads_cfg.slots.values() if p)} وحدةً مضبوطة")
        if site.snapshot_meta.get("synced_at"):
            print(f"  ✔ آخرُ مزامنةٍ مع Firebase: {site.snapshot_meta['synced_at']}")
        else:
            print("  ! لا توجد لقطةٌ من Firebase — شغّل: python build.py --sync")
    return site
