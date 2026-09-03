"""الترجمةُ الإنجليزيّة: معجمٌ يُبنى مرّةً ويُقرأ في المتصفّح.

بعد بناء الصفحات نمرُّ على مُخرَجها فنجمع كلَّ نصٍّ عربيٍّ ظاهر — متناً
كان أم عنوانَ زرٍّ أم وصفَ صورة — ثمّ نترجم ما لم يُترجَم من قبلُ ونحفظه
في ``content/i18n/en.json``. الملفُّ يبقى بين البناءات، فلا يُترجَم النصُّ
الواحدُ مرّتين، وهو ملفٌّ نصّيٌّ يجوز تصحيحُ أيِّ سطرٍ فيه باليد.

ما يُنشر من لوحة الإدارة بعد البناء لا يمرُّ من هنا: تترجمه ``lang.js``
في متصفّح القارئ ويحفظه عنده.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

# ما لا يُترجَم: نصوصٌ برمجيّةٌ وأنماطٌ ورسومٌ متّجهة
SKIP_TAGS = {"script", "style", "noscript", "code", "pre", "svg", "template"}

# السماتُ التي يقرؤها الزائر
ATTRS = ("alt", "title", "placeholder", "aria-label", "data-share-title", "label")

ARABIC = re.compile(r"[؀-ۿ]")

ENDPOINT = "https://translate.googleapis.com/translate_a/single"
MYMEMORY = "https://api.mymemory.translated.net/get"

MAX_LEN = 1800  # أطولُ نصٍّ يُرسل دفعةً واحدة


def has_arabic(text: str) -> bool:
    return bool(ARABIC.search(text))


class _Collector(HTMLParser):
    """يجمع كلَّ نصٍّ عربيٍّ ظاهرٍ في صفحةٍ مبنيّة."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.found: set[str] = set()
        self._muted = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in SKIP_TAGS:
            self._muted += 1
        for name, value in attrs:
            if name in ATTRS and value:
                self._take(value)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in ATTRS and value:
                self._take(value)

    def handle_endtag(self, tag: str) -> None:
        if tag in SKIP_TAGS and self._muted:
            self._muted -= 1

    def handle_data(self, data: str) -> None:
        if not self._muted:
            self._take(data)

    def _take(self, raw: str) -> None:
        text = unescape(raw).strip()
        if text and len(text) <= MAX_LEN and has_arabic(text):
            self.found.add(re.sub(r"\s+", " ", text))


def collect(paths: Iterable[Path]) -> set[str]:
    """كلُّ نصٍّ عربيٍّ ظاهرٍ في الصفحات المعطاة."""
    found: set[str] = set()
    for path in paths:
        try:
            parser = _Collector()
            parser.feed(path.read_text(encoding="utf-8"))
            found |= parser.found
        except (OSError, UnicodeDecodeError, AssertionError):
            continue
    return found


def _google(text: str, target: str = "en") -> str:
    query = urllib.parse.urlencode(
        {"client": "gtx", "sl": "ar", "tl": target, "dt": "t", "q": text}
    )
    request = urllib.request.Request(
        f"{ENDPOINT}?{query}",
        headers={"User-Agent": "Mozilla/5.0 (compatible; EACR-build/1.0)"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    segments = payload[0] if payload and isinstance(payload[0], list) else []
    return "".join(part[0] for part in segments if part and part[0]).strip()


def _mymemory(text: str, target: str = "en") -> str:
    query = urllib.parse.urlencode({"q": text, "langpair": f"ar|{target}"})
    request = urllib.request.Request(
        f"{MYMEMORY}?{query}", headers={"User-Agent": "EACR-build/1.0"}
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return (payload.get("responseData") or {}).get("translatedText", "").strip()


def translate(text: str, target: str = "en") -> str:
    """يترجم نصّاً واحداً، ويعيد الأصلَ إن تعذّرت الترجمة."""
    for engine in (_google, _mymemory):
        try:
            out = engine(text, target)
        except (urllib.error.URLError, OSError, ValueError, IndexError, KeyError, TimeoutError):
            continue
        if out and out != text:
            return out
    return ""


def load(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {k: v for k, v in data.items() if isinstance(v, str)}
    except (OSError, json.JSONDecodeError):
        return {}


def save(path: Path, table: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = dict(sorted(table.items(), key=lambda pair: pair[0]))
    path.write_text(
        json.dumps(ordered, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def extend(
    table: dict[str, str],
    strings: Iterable[str],
    *,
    target: str = "en",
    limit: int = 400,
    pause: float = 0.12,
    log=print,
) -> tuple[dict[str, str], int, int]:
    """يترجم ما لم يُترجَم بعدُ. يعيد (المعجم، ما تُرجم، ما تعذّر)."""
    missing = [s for s in strings if s and s not in table]
    missing.sort(key=len)
    done = failed = 0
    for text in missing[:limit]:
        out = translate(text, target)
        if out:
            table[text] = out
            done += 1
        else:
            failed += 1
        time.sleep(pause)
    left = max(0, len(missing) - limit)
    if left:
        log(f"  … بقي {left} نصّاً لجولةٍ تالية")
    return table, done, failed
