'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PostCard from '@/components/PostCard'
import { useLiveNews } from '@/components/LiveData'

export default function NewsPage() {
  const { data: news, loading } = useLiveNews()

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Header />

      <main className="section">
        <div className="container">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">أخبارُ المؤتمر</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              تابع آخر الأخبار والإعلانات المهمة
            </p>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card h-96 animate-pulse bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          ) : news && news.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {news.map((post) => (
                <PostCard key={post.id} post={post} variant="standard" />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">لا توجد أخبار حالياً</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
