#!/usr/bin/env python3
"""فحصُ الموقع بعد البناء: روابطُ مكسورة، وأصولٌ مفقودة، وبياناتٌ مهيكلةٌ خاطئة.

    python tools/audit.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "legacy", "node_modules", "theme", "eacr", "tools", "content", "__pycache__", ".claude"}

HREF_RE = re.compile(r'(?:href|src)\s*=\s*["\']([^"\']+)["\']', re.I)
JSONLD_RE = re.compile(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', re.S | re.I)
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S | re.I)
DESC_RE = re.compile(r'<meta\s+name="description"\s+content="(.*?)"', re.S | re.I)
H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S | re.I)
IMG_RE = re.compile(r"<img\b[^>]*>", re.I)
CANONICAL_RE = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"', re.I)


def html_files() -> list[Path]:
    found: list[Path] = []
    for path in ROOT.rglob("*.html"):
        if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts[:-1]):
            continue
        if path.name in {"elgoharyX.html", "admin.html", "app.html", "uplode.html"}:
            continue
        # ملفّاتُ إثبات الملكيّة لجوجل تُكتب بيده ولا تُحرَّر: سطرٌ واحدٌ بلا رأسٍ ولا عنوان
        if path.name.startswith("google") and path.name.endswith(".html"):
            continue
        found.append(path)
    return sorted(found)


def resolve(link: str, page: Path) -> Path | None:
    """يحوّل رابطاً داخليّاً إلى مسار ملفٍّ متوقَّع."""
    clean = unquote(link.split("#")[0].split("?")[0])
    if not clean:
        return None
    parsed = urlparse(clean)
    if parsed.scheme or clean.startswith("//"):
        return None
    base = ROOT if clean.startswith("/") else page.parent
    target = (base / clean.lstrip("/")).resolve()
    if target.is_dir() or clean.endswith("/"):
        target = target / "index.html"
    return target


def main() -> int:
    problems: list[str] = []
    notes: list[str] = []
    pages = html_files()
    titles: dict[str, str] = {}

    for page in pages:
        rel = page.relative_to(ROOT).as_posix()
        html = page.read_text(encoding="utf-8", errors="replace")
        indexable = "noindex" not in html[:4000].lower()

        # ── العنوان والوصف و h1 ──
        title = TITLE_RE.search(html)
        if not title or not title.group(1).strip():
            problems.append(f"{rel}: لا يوجد <title>")
        else:
            text = title.group(1).strip()
            if indexable and text in titles and page.name != "404.html":
                notes.append(f"{rel}: عنوانٌ مكرّرٌ مع {titles[text]} — «{text[:50]}»")
            titles[text] = rel

        description = DESC_RE.search(html)
        if indexable and (not description or len(description.group(1).strip()) < 40):
            notes.append(f"{rel}: وصفٌ قصيرٌ أو مفقود")

        heads = H1_RE.findall(html)
        if indexable and len(heads) != 1:
            notes.append(f"{rel}: عددُ عناوين H1 = {len(heads)}")

        if not CANONICAL_RE.search(html):
            problems.append(f"{rel}: لا يوجد رابطٌ قانونيّ canonical")

        # ── الصور بلا نصٍّ بديل ──
        for tag in IMG_RE.findall(html):
            if "alt=" not in tag.lower():
                problems.append(f"{rel}: <img> بلا alt — {tag[:70]}")

        # ── البياناتُ المهيكلة ──
        for block in JSONLD_RE.findall(html):
            try:
                json.loads(block)
            except json.JSONDecodeError as exc:
                problems.append(f"{rel}: JSON-LD غيرُ صالح — {exc}")

        # ── الروابط الداخليّة ──
        for link in HREF_RE.findall(html):
            if link.startswith(("http://", "https://", "//", "mailto:", "tel:", "#", "data:", "javascript:")):
                continue
            target = resolve(link, page)
            if target is None:
                continue
            if not target.exists():
                problems.append(f"{rel}: رابطٌ مكسور → {link}")

    # ── ملفّاتُ الآلات ──
    for name in ("sitemap.xml", "rss.xml", "robots.txt", "search-index.json", "manifest.webmanifest", "sw.js"):
        if not (ROOT / name).exists():
            problems.append(f"ملفٌّ مفقود: {name}")

    # CNAME لا يلزم إلّا إذا كان الموقعُ على نطاقٍ خاصٍّ يخدمه GitHub Pages
    site_url = ""
    config = ROOT / "content" / "site.yml"
    if config.exists():
        for line in config.read_text(encoding="utf-8").splitlines():
            if line.startswith("url:"):
                site_url = line.split(":", 1)[1].strip().strip(chr(34) + chr(39))
                break
    host = site_url.split("//")[-1].split("/")[0]
    managed = host.endswith((".vercel.app", ".github.io", ".pages.dev", ".netlify.app"))
    if host and not managed and not (ROOT / "CNAME").exists():
        problems.append(f"ملفٌّ مفقود: CNAME (النطاق {host})")

    index = ROOT / "search-index.json"
    if index.exists():
        data = json.loads(index.read_text(encoding="utf-8"))
        missing = [i["u"] for i in data["items"] if not (ROOT / i["u"].strip("/") / "index.html").exists()]
        if missing:
            problems.append(f"فهرسُ البحث يشير إلى {len(missing)} صفحةً غير موجودة، أوّلها {missing[0]}")

    print(f"\n  ⌁ فُحصت {len(pages)} صفحة\n")
    if problems:
        print(f"  ✗ {len(problems)} مشكلة:")
        for line in problems[:60]:
            print(f"    · {line}")
        if len(problems) > 60:
            print(f"    … و{len(problems) - 60} غيرها")
    else:
        print("  ✔ لا مشاكل حرجة")

    if notes:
        print(f"\n  ! {len(notes)} ملاحظة:")
        for line in notes[:25]:
            print(f"    · {line}")
        if len(notes) > 25:
            print(f"    … و{len(notes) - 25} غيرها")

    print()
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
