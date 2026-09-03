#!/usr/bin/env python3
"""مِبنى موقع «EACR Conference».

    python build.py                 بناءُ الموقع من المحتوى الموجود
    python build.py --sync          سحبُ المحتوى من Firebase ثمّ البناء
    python build.py --serve         بناءٌ ثمّ خادمٌ محلّيٌّ للمعاينة
    python build.py --sync --serve  الاثنان معاً
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

from eacr.builder import build  # noqa: E402
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


def main() -> int:
    parser = argparse.ArgumentParser(description="مولّد موقع مؤتمر EACR")
    parser.add_argument("--sync", action="store_true", help="سحبُ المحتوى من Firebase قبل البناء")
    parser.add_argument("--serve", action="store_true", help="تشغيلُ خادم معاينةٍ بعد البناء")
    parser.add_argument("--port", type=int, default=8000, help="منفذُ خادم المعاينة")
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

    if args.serve:
        serve(OUTPUT_DIR, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
