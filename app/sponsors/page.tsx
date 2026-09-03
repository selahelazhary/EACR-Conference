'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useLiveSponsors } from '@/components/LiveData'

export default function SponsorsPage() {
  const { data: sponsors, loading } = useLiveSponsors()

  const tierNames: Record<string, string> = {
    platinum: 'الرعاةُ البلاتينيّون',
    gold: 'الرعاةُ الذهبيّون',
    silver: 'الرعاةُ الفضّيّون',
    bronze: 'الرعاةُ البرونزيّون',
    partner: 'شركاءٌ وجهاتٌ داعمة',
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Header />

      <main className="section">
        <div className="container">
          <div className="mb-16 text-center">
            <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">داعمو المؤتمر</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              نتشرّف بشراكة الجهاتِ الداعمةِ والراعيةِ التي تؤمن بأهميّة البحثِ العلميِّ
            </p>
          </div>

          {loading ? (
            <div className="text-center">
              <div className="inline-block p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
              </div>
            </div>
          ) : sponsors && sponsors.length > 0 ? (
            <div className="space-y-16">
              {(['platinum', 'gold', 'silver', 'bronze', 'partner'] as const).map((tier) => {
                const tierSponsors = sponsors.filter(s => s.tier === tier)
                if (tierSponsors.length === 0) return null

                return (
                  <div key={tier}>
                    <h2 className="text-2xl font-bold font-display text-center mb-8">
                      {tierNames[tier]}
                    </h2>
                    <div className="flex flex-wrap gap-8 items-center justify-center">
                      {tierSponsors.map((sponsor) => (
                        <a
                          key={sponsor.id}
                          href={sponsor.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group"
                          title={sponsor.name}
                        >
                          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 group-hover:border-brand group-hover:shadow-lg transition-all">
                            <img
                              src={sponsor.logo}
                              alt={sponsor.name}
                              className="h-32 w-auto object-contain group-hover:scale-105 transition-transform"
                            />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">لم يتم الإعلان عن قائمة الداعمين بعد</p>
            </div>
          )}

          <div className="bg-gradient-to-r from-brand/10 to-spark/10 rounded-2xl p-8 mt-16 text-center">
            <p className="text-lg text-slate-700 dark:text-slate-300">
              ✦ يتقدّم المؤتمرُ بخالص الشكر والتقديرِ لكلِّ جهةٍ أسهمت في إقامتهِ
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
