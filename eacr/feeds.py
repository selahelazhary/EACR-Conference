"""ما تقرؤه الآلات: خريطةُ الموقع، وخلاصةُ RSS، وفهرسُ البحث، وملفُّ التطبيق."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape

from . import layouts, themes
from .config import SiteConfig
from .content import Category, Item
from .render import write


def _abs(config: SiteConfig, url: str) -> str:
    return str(config.get("url", "")).rstrip("/") + "/" + url.lstrip("/")


def sitemap(config: SiteConfig, urls: Iterable[tuple[str, datetime, str, str]], path: Path) -> Path:
    """urls = (المسار، آخرُ تعديل، معدّلُ التغيير، الأولويّة)."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url, lastmod, changefreq, priority in urls:
        lines += [
            "  <url>",
            f"    <loc>{escape(_abs(config, url))}</loc>",
            f"    <lastmod>{lastmod.date().isoformat()}</lastmod>",
            f"    <changefreq>{changefreq}</changefreq>",
            f"    <priority>{priority}</priority>",
            "  </url>",
        ]
    lines.append("</urlset>")
    return write(path, "\n".join(lines) + "\n")


# خلاصةٌ ينفع معها قارئٌ حقيقي: صورةٌ برابطها لا بجسدها، ونصٌّ محدودُ الطول.
DATA_URI_IMG_RE = re.compile(r"<img[^>]+src=[\"']data:[^\"']*[\"'][^>]*>", re.I)
TAG_END_RE = re.compile(r"</(?:p|div|figure|ul|ol|blockquote|h[1-6])>", re.I)

MAX_ENTRY_CHARS = 12_000  # ما يزيد يُقصّ عند أقرب نهايةِ وسم


def _feed_body(html: str, url: str) -> str:
    """نصُّ المادّة كما يصلح للقارئ: بلا صورٍ مضمّنةٍ وبطولٍ معقول."""
    body = DATA_URI_IMG_RE.sub("", html or "")
    if len(body) <= MAX_ENTRY_CHARS:
        return body
    window = body[:MAX_ENTRY_CHARS]
    cuts = list(TAG_END_RE.finditer(window))
    trimmed = window[: cuts[-1].end()] if cuts else window
    return f'{trimmed}<p><a href="{url}">تابع قراءة المادّة كاملةً على الموقع ←</a></p>'


def rss(config: SiteConfig, items: list[Item], path: Path, limit: int = 30) -> Path:
    now = format_datetime(datetime.now(timezone.utc))
    title = escape(str(config.get("title", "")))
    link = escape(str(config.get("url", "")))
    description = escape(" ".join(str(config.get("description", "")).split()))
    logo = escape(_abs(config, "/assets/img/icon-512.png"))

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml-stylesheet type="text/xsl" href="/rss.xsl"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" '
        'xmlns:content="http://purl.org/rss/1.0/modules/content/" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:media="http://search.yahoo.com/mrss/">',
        "<channel>",
        f"<title>{title}</title>",
        f"<link>{link}</link>",
        f"<description>{description}</description>",
        "<language>ar</language>",
        "<ttl>60</ttl>",
        f"<lastBuildDate>{now}</lastBuildDate>",
        f'<atom:link href="{escape(_abs(config, "/rss.xml"))}" rel="self" type="application/rss+xml"/>',
        f"<image><url>{logo}</url><title>{title}</title><link>{link}</link></image>",
    ]
    for item in items[:limit]:
        url = escape(_abs(config, item.url))
        poster = item.poster if not str(item.poster).lower().startswith("data:") else ""
        parts += [
            "<item>",
            f"<title>{escape(item.title)}</title>",
            f"<link>{url}</link>",
            f'<guid isPermaLink="true">{url}</guid>',
            f"<pubDate>{format_datetime(item.date)}</pubDate>",
            f"<category>{escape(item.section_name)}</category>",
            f"<dc:creator>{escape(item.author or str(config.get('title', '')))}</dc:creator>",
            f"<description>{escape(item.dek)}</description>",
        ]
        if poster:
            absolute_poster = escape(poster if poster.startswith("http") else _abs(config, poster))
            parts.append(f'<media:content url="{absolute_poster}" medium="image"/>')
            parts.append(f'<media:thumbnail url="{absolute_poster}"/>')
        parts += [
            f"<content:encoded><![CDATA[{_feed_body(item.body, _abs(config, item.url))}]]></content:encoded>",
            "</item>",
        ]
    parts += ["</channel>", "</rss>"]
    return write(path, '\n'.join(parts) + '\n')


def search_index(items: list[Item], categories: list[Category], path: Path) -> Path:
    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "topics": [{"n": c.name, "u": c.url, "k": c.color, "c": c.count} for c in categories],
        "items": [item.search_record() for item in items],
    }
    return write(path, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def robots(config: SiteConfig, path: Path) -> Path:
    """`robots.txt` ملفٌّ عامّ، فلا يُذكر فيه مسارُ لوحة الإدارة.

    منعُ الفهرسة يأتي من وسم `noindex` في رأس اللوحة نفسِها؛ أمّا كتابةُ
    المسار هنا فتدلُّ عليه كلَّ من فتح الملفّ.
    """
    lines = [
        "User-agent: *",
        "Allow: /",
        "",
    ]
    if config.ads.active:
        lines += [
            "# زواحفُ الإعلانات: بغيرِ إذنها لا يقرأ أدسنس الصفحةَ فلا يلائم إعلانَها",
            "User-agent: Mediapartners-Google",
            "Allow: /",
            "",
            "User-agent: AdsBot-Google",
            "Allow: /",
            "",
            "User-agent: AdsBot-Google-Mobile",
            "Allow: /",
            "",
        ]
    lines += [f"Sitemap: {_abs(config, '/sitemap.xml')}", ""]
    return write(path, "\n".join(lines))


def manifest(config: SiteConfig, path: Path) -> Path:
    payload = {
        "name": f"{config.get('title')} — {config.get('tagline')}",
        "short_name": str(config.get("title")),
        "description": " ".join(str(config.get("description", "")).split()),
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#FCFAFB",
        "theme_color": "#C2185B",
        "lang": "ar",
        "dir": "rtl",
        "categories": ["news", "science", "education", "medical"],
        "icons": [
            {"src": "/assets/img/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "/assets/img/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "/assets/img/maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        "screenshots": [
            {"src": "/assets/img/share.png", "sizes": "1200x630", "type": "image/png", "form_factor": "wide"},
        ],
        "shortcuts": [
            {"name": section.many, "url": section.url}
            for section in config.sections[:3]
        ] + [{"name": "بحث", "url": "/search/"}],
    }
    return write(path, json.dumps(payload, ensure_ascii=False, indent=2))


def ads_txt(config: SiteConfig, path: Path) -> Path | None:
    """`ads.txt` — بغيره يرفض معظمُ المشترين الشراءَ من الموقع.

    لا يُكتب ما دام رقمُ الناشر فارغاً؛ وإن وُجد ملفٌّ قديمٌ حُذف.
    """
    body = config.ads.ads_txt
    if not body:
        if path.exists():
            path.unlink()
        return None
    header = f"# ناشرو الإعلان المُصرَّح لهم ببيع مساحة {config.get('title', '')}" + chr(10)
    return write(path, header + body)


def news_pulse(items: list[Item], path: Path, limit: int = 12) -> Path:
    """ملفٌّ صغيرٌ يسأله عاملُ الخدمة ليعرف: هل نُشر جديد؟

    فهرسُ البحث يقارب ١٤٠ كيلوبايت؛ لا يُعقل جلبُه كلَّ بضع ساعاتٍ
    في الخلفيّة لمجرّد مقارنة تاريخ. هذا الملفُّ أقلُّ من ثلاثة.
    """
    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "items": [
            {
                "id": item.url,
                "t": item.title,
                "u": item.url,
                "s": item.section_name,
                "d": item.dek[:120],
                "i": item.poster if not str(item.poster).lower().startswith("data:") else "",
                "ts": int(item.date.timestamp() * 1000),
            }
            for item in items[:limit]
        ],
    }
    return write(path, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def theme_catalog(path: Path) -> Path:
    """أربعون تصميماً وعشرون تنسيقاً تقرؤها لوحةُ التحرير معاينةً حيّة."""
    return write(path, json.dumps(
        {
            "themes": themes.catalog(),
            "layouts": layouts.catalog(),
            "radius": list(themes.RADIUS),
        },
        ensure_ascii=False, separators=(",", ":")))


def skins(directory: Path) -> int:
    """ورقةُ أنماطٍ جاهزةٌ لكلِّ تصميمٍ ولكلِّ تنسيق.

    الموقعُ المبنيُّ يحمل تصميمَه في رأسه، لكنّ المحرّرَ إن بدّله من اللوحة
    قبل البناء التالي فالصفحةُ تسحب ورقتَه من هنا وتُلبسها الموقعَ كلَّه —
    ملفٌّ صغيرٌ يُخزَّن في المتصفّح، لا اشتقاقَ في جافاسكربت ولا تكرار.
    """
    count = 0
    for theme in themes.THEMES:
        write(directory / f"{theme.id}.css", themes.stylesheet(theme.id))
        count += 1
    for layout in layouts.LAYOUTS:
        write(directory / f"layout-{layout.id}.css", layouts.stylesheet(layout.id))
        count += 1
    return count
