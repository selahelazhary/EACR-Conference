'use client'

import { useState, useEffect } from 'react'
import { database, ref, onValue } from '@/lib/firebase'
import { Post, Sponsor } from '@/lib/types'

interface UseLiveDataReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useLiveNews(): UseLiveDataReturn<Post[]> {
  const [data, setData] = useState<Post[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const newsRef = ref(database, 'news')
      const unsubscribe = onValue(
        newsRef,
        (snapshot) => {
          const raw = snapshot.val()
          if (raw) {
            const posts = Object.entries(raw).map(([id, data]: any) => ({
              id,
              ...data,
            }))
            setData(posts.sort((a, b) => b.createdAt - a.createdAt))
          } else {
            setData([])
          }
          setLoading(false)
        },
        (err) => {
          console.error('Error fetching news:', err)
          setError(err.message)
          setLoading(false)
        }
      )

      return () => unsubscribe()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }, [])

  return { data, loading, error }
}

export function useLiveSponsors(): UseLiveDataReturn<Sponsor[]> {
  const [data, setData] = useState<Sponsor[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const sponsorsRef = ref(database, 'sponsors')
      const unsubscribe = onValue(
        sponsorsRef,
        (snapshot) => {
          const raw = snapshot.val()
          if (raw) {
            const sponsors = Object.entries(raw).map(([id, data]: any) => ({
              id,
              ...data,
            }))
            setData(sponsors.sort((a, b) => (a.order || 0) - (b.order || 0)))
          } else {
            setData([])
          }
          setLoading(false)
        },
        (err) => {
          console.error('Error fetching sponsors:', err)
          setError(err.message)
          setLoading(false)
        }
      )

      return () => unsubscribe()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }, [])

  return { data, loading, error }
}
