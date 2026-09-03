"""إعداداتُ الإعلانات: مكانٌ واحدٌ يُشغّلها ويُطفئها ويحدّد مواضعَها.

القالبُ لا يعرف شيئاً عن جوجل: يسأل `ads.has('article_top')` فيضع الوحدة،
والجافاسكربت هو الذي يحمّل الإعلانَ حين يقترب من الشاشة. فإذا أُطفئ الإعلانُ
من `site.yml` لم يبقَ في الصفحة منه أثرٌ — لا وسمٌ ولا طلبُ شبكة.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

SCRIPT_BASE = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"

# المواضعُ المعروفة — الاسمُ هنا هو الاسمُ في site.yml وفي القوالب
PLACEMENTS = (
    "home_top",        # تحت صدر الصفحة الرئيسيّة
    "home_mid",        # بين «أحدثُ ما نُشر» وأشرطة الأقسام
    "home_side",       # العمودُ الجانبيُّ في الرئيسيّة
    "section_top",     # أعلى صفحة القسم
    "section_mid",     # داخل شبكة القسم
    "article_top",     # تحت عنوان المادّة قبل النصّ
    "article_mid",     # داخل النصّ (يتكرّر)
    "article_end",     # بعد النصّ قبل المشاركة
    "article_side",    # عمودُ جدول المحتويات
    "list_top",        # الموضوعات · الأرشيف · البحث · المحفوظات
)


@dataclass(frozen=True)
class AdsConfig:
    enabled: bool = False
    client: str = ""
    auto_ads: bool = False
    test_mode: bool = False
    label: str = "إعلان"
    lazy_margin: int = 400
    in_article_every: int = 4
    in_article_max: int = 3
    slots: dict[str, str] = field(default_factory=dict)

    @property
    def publisher(self) -> str:
        """رقمُ الناشر بلا البادئة: pub-0000… من ca-pub-0000…"""
        return self.client[3:] if self.client.startswith("ca-") else self.client

    @property
    def active(self) -> bool:
        """هل نُخرج شيئاً في الصفحة أصلاً؟"""
        return bool(self.enabled and (self.client or self.test_mode))

    @property
    def live(self) -> bool:
        """هل نطلب إعلاناً حقيقيّاً من جوجل؟"""
        return bool(self.enabled and self.client and not self.test_mode)

    @property
    def script_url(self) -> str:
        return f"{SCRIPT_BASE}?client={self.client}" if self.client else SCRIPT_BASE

    def slot(self, place: str) -> str:
        return str(self.slots.get(place, "") or "")

    def has(self, place: str) -> bool:
        """الوحدةُ تُطبع إن كان لها رقمُ موضعٍ، أو كنّا في وضع المعاينة."""
        if not self.active:
            return False
        return bool(self.test_mode or self.slot(place))

    @property
    def ads_txt(self) -> str:
        if not self.publisher:
            return ""
        return f"google.com, {self.publisher}, DIRECT, f08c47fec0942fa0\n"

    def to_json(self) -> str:
        """ما يحتاجه ads.js وحده — لا أكثر."""
        return json.dumps(
            {
                "client": self.client,
                "test": bool(self.test_mode),
                "live": self.live,
                "label": self.label,
                "margin": int(self.lazy_margin),
                "slots": {k: v for k, v in self.slots.items() if v},
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )


def load_ads(data: dict[str, Any] | None) -> AdsConfig:
    raw = dict(data or {})
    slots = {str(k): str(v or "") for k, v in (raw.get("slots") or {}).items()}
    in_article = raw.get("in_article") or {}
    return AdsConfig(
        enabled=bool(raw.get("enabled", False)),
        client=str(raw.get("client", "") or "").strip(),
        auto_ads=bool(raw.get("auto_ads", False)),
        test_mode=bool(raw.get("test_mode", False)),
        label=str(raw.get("label", "إعلان")),
        lazy_margin=int(raw.get("lazy_margin", 400) or 400),
        in_article_every=int(in_article.get("every", 4) or 4),
        in_article_max=int(in_article.get("max", 3) or 3),
        slots=slots,
    )
