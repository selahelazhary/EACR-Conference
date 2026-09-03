"""عميلٌ خفيفٌ لقاعدة Firebase Realtime عبر REST — بلا حزمٍ خارجيّة.

لوحةُ الإدارة تكتب في القاعدة، وهذا الملفّ يسحب ما كتبَته إلى لقطةٍ محلّيّة
(content/firebase-snapshot.json) ليبنيَ المولّدُ منها صفحاتٍ ثابتةً تقرؤها
محرّكاتُ البحث.

الأقسامُ ليست ثابتةً في الشيفرة: نقرأ عقدةَ `site_config` أوّلاً لنعرف ما
الأقسامُ التي أنشأها المحرّر، ثمّ نسحب عقدةَ كلِّ قسمٍ منها. فالقسمُ الذي
يُضاف من اللوحة يدخل البناءَ من غير أن يُلمس هذا الملفّ.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .config import SNAPSHOT_PATH

# عُقَدٌ لا علاقةَ لها بالأقسام — تُسحب دائماً
BASE_NODES = (
    "site_config",
    "sponsors",
    "categories",
    "site_texts",
    "config",
)

TIMEOUT = 25


class FirebaseError(RuntimeError):
    pass


def _fetch_node(database_url: str, node: str) -> Any:
    url = f"{database_url}/{node}.json"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:  # قواعدُ الأمان قد تمنع القراءة
        raise FirebaseError(f"تعذّرت قراءةُ «{node}»: HTTP {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise FirebaseError(f"تعذّر الاتّصالُ بالقاعدة عند «{node}»: {exc}") from exc
    return json.loads(payload) if payload and payload != "null" else None


def _section_ids(site_config: Any, fallback: Iterable[str]) -> list[str]:
    """معرّفاتُ الأقسام كما ضبطتها اللوحة، وإلّا فأقسامُ الملفّ."""
    rows = site_config.get("sections") if isinstance(site_config, dict) else None
    ids = [
        str(row["id"]).strip()
        for row in rows
        if isinstance(row, dict) and str(row.get("id") or "").strip()
    ] if isinstance(rows, list) else []
    return ids or [str(i) for i in fallback]


def sync(
    database_url: str,
    path: Path | None = None,
    fallback_sections: Iterable[str] = (),
) -> dict[str, Any]:
    """يسحب كلَّ العُقَد ويحفظها لقطةً واحدةً مُرتَّبة."""
    if not database_url:
        raise FirebaseError("لا يوجد عنوانُ قاعدةٍ في content/site.yml")

    snapshot: dict[str, Any] = {
        "_meta": {
            "synced_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "database": database_url,
        }
    }

    # عقدةُ الإعدادات أوّلاً: منها نعرف أقسامَ الموقع الحاليّة
    site_config = _fetch_node(database_url, "site_config")
    snapshot["site_config"] = site_config
    sections = _section_ids(site_config, fallback_sections)
    snapshot["_meta"]["sections"] = sections

    failures: list[str] = []
    for node in [n for n in BASE_NODES if n != "site_config"] + sections:
        try:
            snapshot[node] = _fetch_node(database_url, node)
        except FirebaseError:
            # عقدةٌ ممنوعةٌ أو غيرُ موجودة: المحتوى أهمُّ من أن يسقط كلُّه لأجلها.
            snapshot[node] = None
            failures.append(node)

    if sections and all(node in failures for node in sections):
        raise FirebaseError(
            "تعذّرت قراءةُ كلِّ أقسام المحتوى — راجع قواعدَ الأمان في Firebase "
            "(الصق firebase-rules.json ثمّ Publish)."
        )
    if failures:
        snapshot["_meta"]["skipped"] = failures

    target = path or SNAPSHOT_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8"
    )
    return snapshot


def load_snapshot(path: Path | None = None) -> dict[str, Any]:
    """يقرأ اللقطةَ المحفوظة، ويعود بقاموسٍ فارغٍ إن لم توجد."""
    target = path or SNAPSHOT_PATH
    if not target.exists():
        return {}
    try:
        return json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
