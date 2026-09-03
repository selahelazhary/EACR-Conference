"""استخراجُ الصور المضمّنة (data:) إلى ملفّاتٍ حقيقيّة.

محرّرُ لوحة التحرير يلصق الصورةَ داخل نصّ المادّة بترميز base64، فتصير
الصفحةُ الواحدة تسعةَ ميجابايت، وتتضخّم خلاصةُ RSS حتّى يعجز عنها قارئ.
هنا تُكتب كلُّ صورةٍ ملفّاً واحداً باسمٍ من بصمتها، ويُستبدَل الرابطُ بمساره —
فتُخزَّن مرّةً، وتُذاكَر في المتصفّح، وتُحمَّل كسولاً كبقيّة الصور.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import re
from pathlib import Path
from urllib.parse import unquote_to_bytes

DATA_URI_RE = re.compile(
    r"""data:image/(?P<kind>[a-z0-9.+-]+)\s*;?\s*(?P<enc>base64)?\s*,(?P<payload>[^"')\s>]+)""",
    re.I,
)

EXTENSIONS = {
    "jpeg": "jpg", "jpg": "jpg", "png": "png", "gif": "gif",
    "webp": "webp", "avif": "avif", "svg+xml": "svg", "x-icon": "ico",
}


class MediaStore:
    """يكتب الصورَ المستخرجةَ مرّةً واحدةً لكلِّ بصمة."""

    def __init__(self, directory: Path, url_prefix: str = "/assets/media") -> None:
        self.directory = directory
        self.url_prefix = url_prefix.rstrip("/")
        self._seen: dict[str, str] = {}
        self.saved_bytes = 0
        self.count = 0

    def _decode(self, kind: str, encoded: bool, payload: str) -> bytes | None:
        try:
            if encoded:
                return base64.b64decode(payload + "=" * (-len(payload) % 4), validate=False)
            return unquote_to_bytes(payload)
        except (binascii.Error, ValueError):
            return None

    def put(self, kind: str, encoded: bool, payload: str) -> str | None:
        """يعيد رابطَ الملفّ المكتوب، أو None إن تعذّر فكُّ الترميز."""
        key = hashlib.sha256(payload.encode("utf-8", "ignore")).hexdigest()
        if key in self._seen:
            return self._seen[key]

        blob = self._decode(kind, encoded, payload)
        if not blob or len(blob) < 64:
            return None

        digest = hashlib.sha256(blob).hexdigest()[:16]
        extension = EXTENSIONS.get(kind.lower(), "bin")
        name = f"{digest}.{extension}"
        target = self.directory / name
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(blob)
            self.count += 1
        self.saved_bytes += len(payload) - len(name)
        url = f"{self.url_prefix}/{name}"
        self._seen[key] = url
        return url

    def rewrite(self, html: str) -> str:
        """يستبدل كلَّ data:image في النصّ بمسار ملفٍّ على الموقع."""
        if not html or "data:image" not in html:
            return html

        def swap(match: re.Match[str]) -> str:
            url = self.put(match.group("kind"), bool(match.group("enc")), match.group("payload"))
            return url or match.group(0)

        return DATA_URI_RE.sub(swap, html)

    def rewrite_url(self, value: str) -> str:
        """حقلٌ مفرد (صورةُ الغلاف مثلاً) قد يكون هو نفسُه data:."""
        if not value or not value.lower().startswith("data:image"):
            return value
        match = DATA_URI_RE.match(value.strip())
        if not match:
            return value
        return self.put(match.group("kind"), bool(match.group("enc")), match.group("payload")) or value
