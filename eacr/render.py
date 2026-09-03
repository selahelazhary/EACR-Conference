"""بيئةُ Jinja2: المرشّحاتُ العربيّةُ ووظائفُ الروابط والأصول."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from . import layouts, themes
from .config import STATIC_DIR, TEMPLATES_DIR, SiteConfig
from .text import arabic_date, excerpt, relative_date, slugify, strip_html

_ASSET_HASHES: dict[str, str] = {}


def asset_url(path: str) -> str:
    """رابطُ أصلٍ ثابتٍ موسومٌ ببصمةٍ قصيرةٍ لإبطال ذاكرة المتصفّح عند التغيير."""
    clean = path.lstrip("/")
    if clean not in _ASSET_HASHES:
        source = STATIC_DIR / clean
        digest = "0"
        if source.exists():
            digest = hashlib.sha256(source.read_bytes()).hexdigest()[:8]
        _ASSET_HASHES[clean] = digest
    return f"/assets/{clean}?v={_ASSET_HASHES[clean]}"


def make_env(config: SiteConfig, templates_dir: Path | None = None) -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(templates_dir or TEMPLATES_DIR), encoding="utf-8"),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    )

    base_url = str(config.get("url", "")).rstrip("/")

    def absolute(url: str) -> str:
        if not url:
            return base_url + "/"
        if url.startswith(("http://", "https://", "//")):
            return url
        return base_url + ("/" + url.lstrip("/"))

    env.filters.update(
        ar_date=arabic_date,
        ago=relative_date,
        excerpt=excerpt,
        plain=strip_html,
        slug=slugify,
        absolute=absolute,
    )
    env.globals.update(
        cfg=config.data,
        sections=config.sections,
        ads=config.ads,
        show=config.visible,
        identity=config.identity,
        theme_css=themes.stylesheet(
            config.appearance.get('theme'),
            {k: config.appearance.get(k) for k in ('brand', 'spark', 'radius')},
        ),
        theme_fonts=themes.font_links(config.appearance.get('theme')),
        theme_id=themes.get(config.appearance.get('theme')).id,
        layout_css=layouts.stylesheet(config.appearance.get('layout')),
        layout_attrs=layouts.attributes(config.appearance.get('layout')),
        layout_attrs_map=layouts.get(config.appearance.get('layout')).attributes(),
        layout_id=layouts.get(config.appearance.get('layout')).id,
        skin={
            'theme': themes.get(config.appearance.get('theme')).id,
            'layout': layouts.get(config.appearance.get('layout')).id,
            'brand': config.appearance.get('brand', ''),
            'spark': config.appearance.get('spark', ''),
            'radius': config.appearance.get('radius', ''),
        },
        section_list=[
            {
                "id": s.id, "name": s.name, "plural": s.plural, "single": s.single,
                "slug": s.slug, "accent": s.accent, "icon": s.icon,
                "display": s.display, "description": s.description,
            }
            for s in config.sections
        ],
        section_labels={s.id: s.one for s in config.sections},
        conference=config.conference,
        sponsor_cfg=config.sponsors,
        notify=config.get("notifications", {}) or {},
        engage=config.get("engagement", {}) or {},
        asset=asset_url,
        absolute=absolute,
        now=datetime.now(timezone.utc),
        build_year=datetime.now(timezone.utc).year,
    )
    return env


def write(path: Path, content: str) -> Path:
    """يكتب الملفَّ منشئاً مجلّداتِه، ولا يلمسه إن لم يتغيّر محتواه."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            if path.read_text(encoding="utf-8") == content:
                return path
        except UnicodeDecodeError:
            pass
    path.write_text(content, encoding="utf-8", newline="\n")
    return path


def render_to(env: Environment, template: str, path: Path, **context: Any) -> Path:
    return write(path, env.get_template(template).render(**context))
