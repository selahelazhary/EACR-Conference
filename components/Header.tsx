'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const sections = [
    { name: 'الأخبار', href: '/news', accent: '#E72085' },
    { name: 'الفعاليات', href: '/events', accent: '#00ABCB' },
    { name: 'المتحدثون', href: '/speakers', accent: '#7A2E8E' },
    { name: 'الفيديوهات', href: '/videos', accent: '#C2185B' },
    { name: 'الصور', href: '/gallery', accent: '#0F7C8A' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="container">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-brand to-spark rounded-full flex items-center justify-center text-white font-bold text-lg group-hover:scale-110 transition-transform">
              E
            </div>
            <div>
              <div className="font-bold text-lg font-display">EACR</div>
              <div className="text-xs text-slate-500">مؤتمر 2026</div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {section.name}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button 
              className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 space-y-1">
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="block px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {section.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
