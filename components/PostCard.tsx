'use client'

import { Post } from '@/lib/types'
import Link from 'next/link'
import Image from 'next/image'

interface PostCardProps {
  post: Post
  variant?: 'standard' | 'compact' | 'featured'
}

export default function PostCard({ post, variant = 'standard' }: PostCardProps) {
  if (variant === 'compact') {
    return (
      <Link href={post.url} className="group">
        <article className="card p-4">
          <h3 className="font-semibold text-sm mb-2 group-hover:text-brand transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-xs text-slate-500">{post.date}</p>
        </article>
      </Link>
    )
  }

  if (variant === 'featured') {
    return (
      <Link href={post.url} className="group">
        <article className="card overflow-hidden">
          {post.image && (
            <div className="relative w-full h-64 overflow-hidden bg-slate-200">
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <div className="p-6">
            <p className="text-xs font-semibold text-brand mb-2 uppercase">{post.section}</p>
            <h3 className="text-xl font-bold mb-2 group-hover:text-brand transition-colors">
              {post.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              {post.summary}
            </p>
            <p className="text-xs text-slate-500">{post.date}</p>
          </div>
        </article>
      </Link>
    )
  }

  return (
    <Link href={post.url} className="group">
      <article className="card overflow-hidden hover:shadow-lg transition-all">
        {post.image && (
          <div className="relative w-full h-48 overflow-hidden bg-slate-200">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="p-4">
          <p className="text-xs font-semibold text-brand mb-2">{post.section}</p>
          <h3 className="font-bold mb-2 group-hover:text-brand transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {post.summary}
          </p>
          <p className="text-xs text-slate-500 mt-3">{post.date}</p>
        </div>
      </article>
    </Link>
  )
}
