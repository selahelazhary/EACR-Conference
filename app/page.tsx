'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HeroSection from '@/components/HeroSection'
import PostCard from '@/components/PostCard'
import { useLiveNews, useLiveSponsors } from '@/components/LiveData'
import { Conference } from '@/lib/types'
import Link from 'next/link'

const conference: Conference = {
  name: 'المؤتمرُ السنوي للجمعيّة المصريّة لأبحاث السرطان',
  short: 'مؤتمر EACR ٢٠٢٦',
  edition: '٢٠٢٦',
  year: 2026,
  organizer: 'الجمعيّة المصريّة لأبحاث السرطان',
  venue: 'المركزُ القوميُّ للبحوث',
  address: 'شارعُ البحوث — الدقّي، الجيزة',
  city: 'القاهرة',
  country: 'مصر',
  starts: '2026-09-23',
  ends: '2026-09-24',
  date_label: '٢٣ — ٢٤ سبتمبر ٢٠٢٦',
  timezone: '+03:00',
}

export default function Home() {
  const { data: news, loading: newsLoading } = useLiveNews()
  const { data: sponsors, loading: sponsorsLoading } = useLiveSponsors()

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Header />

      {/* Hero Section */}
      <HeroSection conference={conference} />

      {/* Latest News Section */}
      <section className="section bg-slate-50 dark:bg-slate-900">
        <div className="container">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold font-display mb-2">آخر الأخبار</h2>
              <p className="text-slate-600 dark:text-slate-400">تابع آخر التطورات والإعلانات</p>
            </div>
            <Link href="/news" className="text-brand hover:text-brand/80 font-semibold">
              عرض الكل ←
            </Link>
          </div>

          {newsLoading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-80 animate-pulse bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          ) : news && news.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {news.slice(0, 3).map((post) => (
                <PostCard key={post.id} post={post} variant="featured" />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">لا توجد أخبار حالياً</p>
            </div>
          )}
        </div>
      </section>

      {/* Sponsors Section */}
      {!sponsorsLoading && sponsors && sponsors.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold font-display mb-2">داعمو المؤتمر</h2>
                <p className="text-slate-600 dark:text-slate-400">شركاؤنا في النجاح</p>
              </div>
              <Link href="/sponsors" className="text-brand hover:text-brand/80 font-semibold">
                عرض الكل ←
              </Link>
            </div>

            {/* Group sponsors by tier */}
            {(['platinum', 'gold', 'silver', 'bronze', 'partner'] as const).map((tier) => {
              const tierSponsors = sponsors.filter(s => s.tier === tier)
              if (tierSponsors.length === 0) return null

              const tierNames: Record<string, string> = {
                platinum: 'الرعاةُ البلاتينيّون',
                gold: 'الرعاةُ الذهبيّون',
                silver: 'الرعاةُ الفضّيّون',
                bronze: 'الرعاةُ البرونزيّون',
                partner: 'شركاءٌ وجهاتٌ داعمة',
              }

              return (
                <div key={tier} className="mb-12">
                  <h3 className="text-xl font-bold mb-6 text-center">{tierNames[tier]}</h3>
                  <div className="flex flex-wrap gap-8 items-center justify-center">
                    {tierSponsors.map((sponsor) => (
                      <a
                        key={sponsor.id}
                        href={sponsor.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group hover:scale-105 transition-transform"
                        title={sponsor.name}
                      >
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800 group-hover:border-brand transition-colors">
                          <img
                            src={sponsor.logo}
                            alt={sponsor.name}
                            className="h-20 w-auto object-contain"
                          />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="section bg-gradient-to-r from-brand/10 to-spark/10">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">جاهز للانضمام؟</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            لا تفوت فرصة المشاركة في أحد أهم المؤتمرات العلمية السنوية
          </p>
          {conference.register_url && (
            <a href={conference.register_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              سجل الآن
            </a>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
