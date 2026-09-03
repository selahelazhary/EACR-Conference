'use client'

import { Conference } from '@/lib/types'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface HeroSectionProps {
  conference: Conference
}

export default function HeroSection({ conference }: HeroSectionProps) {
  const [daysLeft, setDaysLeft] = useState(0)
  const [hoursLeft, setHoursLeft] = useState(0)
  const [minutesLeft, setMinutesLeft] = useState(0)

  useEffect(() => {
    const updateCountdown = () => {
      const startDate = new Date(conference.starts)
      const now = new Date()
      const diff = startDate.getTime() - now.getTime()

      if (diff > 0) {
        setDaysLeft(Math.floor(diff / (1000 * 60 * 60 * 24)))
        setHoursLeft(Math.floor((diff / (1000 * 60 * 60)) % 24))
        setMinutesLeft(Math.floor((diff / (1000 * 60)) % 60))
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000)
    return () => clearInterval(interval)
  }, [conference.starts])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-spark/10 -z-10" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-spark/5 rounded-full blur-3xl -z-10" />

      <div className="container">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left side - Content */}
          <div className="animate-fade-in-up">
            <div className="mb-6">
              <span className="inline-block px-4 py-1 bg-brand/10 text-brand rounded-full text-sm font-semibold mb-4">
                🎓 مؤتمر علمي عالمي
              </span>
              <h1 className="text-5xl md:text-6xl font-bold font-display mb-4 text-slate-900 dark:text-white">
                {conference.name}
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-300 mb-2">
                {conference.organizer}
              </p>
            </div>

            {/* Details */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{conference.venue}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <svg className="w-5 h-5 text-spark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{conference.date_label}</span>
              </div>
            </div>

            {/* Countdown */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 mb-8 border border-slate-200 dark:border-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">يتبقى من الوقت:</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-brand">{daysLeft}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">أيام</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-spark">{hoursLeft}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">ساعات</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-brand">{minutesLeft}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">دقائق</div>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {conference.register_url && (
                <a
                  href={conference.register_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  التسجيل الآن
                </a>
              )}
              {conference.abstract_url && (
                <a
                  href={conference.abstract_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  إرسال ملخص بحثي
                </a>
              )}
            </div>
          </div>

          {/* Right side - Visual */}
          <div className="hidden md:flex items-center justify-center">
            <div className="relative w-full aspect-square">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-spark/20 rounded-3xl" />
              <div className="absolute top-20 right-20 w-40 h-40 bg-brand/30 rounded-2xl blur-2xl" />
              <div className="absolute bottom-20 left-20 w-40 h-40 bg-spark/30 rounded-2xl blur-2xl" />
              
              <div className="relative h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-7xl mb-4">🏥</div>
                  <p className="text-xl font-semibold">{conference.edition}</p>
                  <p className="text-slate-600 dark:text-slate-400">مؤتمر تاريخي</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
