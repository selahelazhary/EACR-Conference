#!/usr/bin/env python3
"""مِبنى موقع «EACR Conference».

    python build.py                 بناءُ الموقع من المحتوى الموجود
    python build.py --sync          سحبُ المحتوى من Firebase ثمّ البناء
    python build.py --serve         بناءٌ ثمّ خادمٌ محلّيٌّ للمعاينة
    python build.py --sync --serve  الاثنان معاً
    python build.py --no-i18n       بناءٌ بلا تحديث المعجم الإنجليزي
"""

from __future__ import annotations

import argparse
import functools
import http.server
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

# طرفيّةُ ويندوز تفتح على cp1252 فتختنق بالعربيّة — نُلزمها UTF-8 قبل أوّل طباعة
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

from eacr import i18n  # noqa: E402
from eacr.builder import build, publish_dictionaries  # noqa: E402
from eacr.config import OUTPUT_DIR, load_config  # noqa: E402
from eacr.firebase import FirebaseError, sync  # noqa: E402


class Handler(http.server.SimpleHTTPRequestHandler):
    """خادمُ معاينةٍ يفهم الروابطَ النظيفةَ ويعرض صفحةَ 404 الحقيقيّة."""

    def send_error(self, code: int, message: str | None = None, explain: str | None = None) -> None:
        if code == 404:
            page = Path(self.directory) / "404.html"
            if page.exists():
                body = page.read_bytes()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def log_message(self, fmt: str, *args) -> None:  # هدوءٌ في الطرفيّة
        if "404" in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)


def serve(directory: Path, port: int) -> None:
    """خادمٌ متعدّدُ الخيوط — المتصفّحُ يفتح عدّةَ اتّصالاتٍ في آنٍ واحد."""
    handler = functools.partial(Handler, directory=str(directory))
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    http.server.ThreadingHTTPServer.daemon_threads = True
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"\n  ▸ المعاينة على http://127.0.0.1:{port}/  (Ctrl+C للإيقاف)\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  ▸ أُوقِف الخادم.")


DICTIONARY = Path(__file__).resolve().parent / "content" / "i18n" / "en.json"


def build_dictionary(output: Path, limit: int) -> None:
    """يجمع نصوصَ الصفحات المبنيّة ويترجم ما لم يُترجَم، ثمّ ينشر المعجم."""
    # الصفحاتُ المبنيّةُ وحدَها: لا قوالبُ المصدر ولا لوحةُ الإدارة
    skip = {"theme", "eacr", "content", "tools", "brand", "assets",
            "node_modules", ".git", ".claude", ".vercel"}
    pages = sorted(
        path for path in output.rglob("*.html")
        if not skip & set(path.relative_to(output).parts) and path.name != "admin.html"
    )
    strings = i18n.collect(pages)
    table = i18n.load(DICTIONARY)
    before = len(table)
    table, done, failed = i18n.extend(table, strings, limit=limit)
    if len(table) != before:
        i18n.save(DICTIONARY, table)

    publish_dictionaries(output)   # المعجمُ المحدَّث إلى assets/i18n/
    covered = sum(1 for s in strings if s in table)
    print(f"    {covered}/{len(strings)} نصّاً مترجَماً"
          + (f" · {done} جديداً" if done else "")
          + (f" · {failed} تعذّر" if failed else ""))


def main() -> int:
    parser = argparse.ArgumentParser(description="مولّد موقع مؤتمر EACR")
    parser.add_argument("--sync", action="store_true", help="سحبُ المحتوى من Firebase قبل البناء")
    parser.add_argument("--serve", action="store_true", help="تشغيلُ خادم معاينةٍ بعد البناء")
    parser.add_argument("--port", type=int, default=8000, help="منفذُ خادم المعاينة")
    parser.add_argument("--no-i18n", action="store_true", help="تخطّي تحديث المعجم الإنجليزي")
    parser.add_argument("--i18n-limit", type=int, default=400,
                        help="أقصى عددِ نصوصٍ تُترجَم في الجولة الواحدة")
    args = parser.parse_args()

    config = load_config()
    print(f"\n  ⌁ {config.get('title')} — {config.get('tagline')}\n")

    if args.sync:
        print("  ▸ مزامنةُ المحتوى من Firebase…")
        try:
            snapshot = sync(config.database_url, fallback_sections=[s.id for s in config.sections])
            counts = {k: len(v) for k, v in snapshot.items() if isinstance(v, dict) and k != "_meta"}
            print("    " + " · ".join(f"{k}: {v}" for k, v in counts.items()))
        except FirebaseError as exc:
            print(f"    ✗ {exc}")
            print("    ▸ سيُبنى الموقع من اللقطة السابقة والملفّات المحلّيّة.")

    print("  ▸ بناءُ الصفحات…")
    build(OUTPUT_DIR)

    if not args.no_i18n:
        print("  ▸ المعجمُ الإنجليزي…")
        try:
            build_dictionary(OUTPUT_DIR, args.i18n_limit)
        except Exception as exc:  # المعجمُ رفاهيةٌ لا يسقط البناءُ لأجلها
            print(f"    ✗ تعذّر تحديثُ المعجم: {exc}")

    if args.serve:
        serve(OUTPUT_DIR, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
