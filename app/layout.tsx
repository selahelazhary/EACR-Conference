import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EACR Conference 2026',
  description: 'المؤتمرُ السنوي للجمعيّة المصريّة لأبحاث السرطان',
  lang: 'ar',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Tajawal:wght@500;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-body">
        {children}
      </body>
    </html>
  )
}
