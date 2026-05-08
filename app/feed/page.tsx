'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { PostCardSkeleton } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import { RefreshCw, ChevronDown, ChevronUp, Check, Pencil, X, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Suggestion {
  id: string
  suggestedComment: string
  finalComment: string | null
  score: number
  scoreReasoning: string
  status: 'PENDING' | 'APPROVED' | 'EDITED' | 'SKIPPED'
}

interface Post {
  id: string
  linkedinPostId: string
  authorName: string
  authorTitle: string
  authorUrl: string | null
  content: string
  postedAt: string
  suggestions: Suggestion[]
}

type FilterType = 'all' | 'high' | 'pending'
type SortType = 'score' | 'newest' | 'oldest'

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('score')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  const loadFeed = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/feed')
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch {
      toast.error('Failed to load feed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) loadFeed()
  }, [user, loadFeed])

  const fetchNew = async () => {
    setFetching(true)
    const toastId = toast.loading('Fetching LinkedIn posts...')
    try {
      const res = await fetch('/api/feed/fetch', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Fetch failed', { id: toastId })
      } else {
        toast.success(`Found ${data.postsFound} posts, ${data.suggestionsGenerated} new suggestions`, { id: toastId })
        await loadFeed()
      }
    } catch {
      toast.error('Connection error', { id: toastId })
    } finally {
      setFetching(false)
    }
  }

  const doAction = async (suggestionId: string, action: 'approve' | 'edit' | 'skip', finalComment?: string) => {
    setActionLoading(suggestionId)
    try {
      const res = await fetch(`/api/comments/${suggestionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, finalComment }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPosts((prev) =>
        prev.map((post) => ({
          ...post,
          suggestions: post.suggestions.map((s) =>
            s.id === suggestionId ? { ...s, ...data.suggestion } : s
          ),
        }))
      )

      const msg =
        action === 'approve' ? '✓ Comment approved!' :
        action === 'edit' ? '✓ Comment saved!' :
        '✕ Post skipped'
      toast.success(msg)
      if (action === 'edit') setEditingId(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const filteredPosts = posts
    .filter((post) => {
      const s = post.suggestions[0]
      if (!s) return false
      if (filter === 'high') return s.score >= 8
      if (filter === 'pending') return s.status === 'PENDING'
      return true
    })
    .sort((a, b) => {
      const sa = a.suggestions[0]
      const sb = b.suggestions[0]
      if (!sa || !sb) return 0
      if (sort === 'score') return sb.score - sa.score
      if (sort === 'newest') return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      return new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime()
    })

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Today&apos;s Feed</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{filteredPosts.length} posts</p>
        </div>
        <button
          onClick={fetchNew}
          disabled={fetching}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
          {fetching ? 'Fetching...' : 'Fetch New'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
          {(['all', 'high', 'pending'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'high' ? '🔥 High Score (8+)' : '⏳ Pending'}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          className="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="score">Sort: Score</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <PostCardSkeleton key={i} />)}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No posts yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Click &quot;Fetch New&quot; to get LinkedIn posts and AI suggestions.</p>
          {!user.linkedinUsername && (
            <a href="/settings/linkedin" className="text-blue-600 hover:underline text-sm">
              Connect LinkedIn first →
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const suggestion = post.suggestions[0]
            if (!suggestion) return null
            const isExpanded = expanded.has(post.id)
            const isEditing = editingId === suggestion.id
            const truncated = post.content.length > 300
            const displayContent = isExpanded || !truncated ? post.content : post.content.slice(0, 300) + '...'
            const isPending = suggestion.status === 'PENDING'

            return (
              <div
                key={post.id}
                className={`bg-white dark:bg-gray-900 rounded-2xl border transition-colors ${
                  !isPending
                    ? 'border-gray-200 dark:border-gray-800 opacity-75'
                    : 'border-gray-200 dark:border-gray-800'
                } p-5`}
              >
                {/* Author row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{post.authorName}</span>
                      {post.authorUrl && (
                        <a href={post.authorUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 text-gray-400 hover:text-blue-500" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{post.authorTitle}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatDistanceToNow(new Date(post.postedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <ScoreBadge score={suggestion.score} />
                    {!isPending && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        suggestion.status === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        suggestion.status === 'EDITED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {suggestion.status.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score reasoning */}
                <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-3 leading-relaxed">
                  💡 {suggestion.scoreReasoning}
                </p>

                {/* Post content */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{displayContent}</p>
                  {truncated && (
                    <button
                      onClick={() => toggleExpand(post.id)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium"
                    >
                      {isExpanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
                    </button>
                  )}
                </div>

                {/* Comment textarea */}
                {isPending && (
                  <>
                    <textarea
                      value={isEditing ? editText : suggestion.suggestedComment}
                      onChange={(e) => {
                        if (!isEditing) {
                          setEditingId(suggestion.id)
                          setEditText(e.target.value)
                        } else {
                          setEditText(e.target.value)
                        }
                      }}
                      onFocus={() => {
                        if (!isEditing) {
                          setEditingId(suggestion.id)
                          setEditText(suggestion.suggestedComment)
                        }
                      }}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition mb-3"
                      placeholder="AI-generated comment..."
                    />

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => doAction(suggestion.id, 'approve')}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]"
                      >
                        {actionLoading === suggestion.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <><Check className="w-4 h-4" /> Approve</>
                        )}
                      </button>

                      {isEditing && (
                        <button
                          onClick={() => doAction(suggestion.id, 'edit', editText)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]"
                        >
                          <Pencil className="w-4 h-4" /> Save Edit
                        </button>
                      )}

                      <button
                        onClick={() => doAction(suggestion.id, 'skip')}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors min-h-[44px]"
                      >
                        <X className="w-4 h-4" /> Skip
                      </button>
                    </div>
                  </>
                )}

                {/* Final comment display (non-pending) */}
                {!isPending && suggestion.finalComment && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Your comment:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{suggestion.finalComment}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
