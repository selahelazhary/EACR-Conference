'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-slate-900 dark:bg-black text-white border-t border-slate-800">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="font-bold text-xl font-display mb-2">EACR</div>
            <p className="text-slate-400 text-sm">المؤتمرُ السنوي للجمعيّة المصريّة لأبحاث السرطان</p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold mb-4">الأقسام</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/news" className="hover:text-white transition-colors">الأخبار</Link></li>
              <li><Link href="/events" className="hover:text-white transition-colors">الفعاليات</Link></li>
              <li><Link href="/speakers" className="hover:text-white transition-colors">المتحدثون</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">أخرى</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/sponsors" className="hover:text-white transition-colors">الداعمون</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">عن المؤتمر</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">التواصل</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>البريد: info@eacr.org</li>
              <li>الموقع: eacr-conference.vercel.app</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="text-slate-400 text-sm">© 2026 الجمعيّة المصريّة لأبحاث السرطان</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">Twitter</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">LinkedIn</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">Facebook</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
