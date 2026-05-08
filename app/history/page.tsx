'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import { format } from 'date-fns'

interface HistoryItem {
  id: string
  score: number
  suggestedComment: string
  finalComment: string | null
  status: 'PENDING' | 'APPROVED' | 'EDITED' | 'SKIPPED'
  reactions: number
  replies: number
  createdAt: string
  post: {
    authorName: string
    authorTitle: string
    content: string
    postedAt: string
  }
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [exporting, setExporting] = useState(false)
  const limit = 20

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) })
        if (statusFilter) params.append('status', statusFilter)
        const res = await fetch(`/api/history?${params}`)
        if (res.ok) {
          const data = await res.json()
          setItems(data.suggestions || [])
          setTotal(data.total || 0)
        }
      } catch {
        toast.error('Failed to load history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, page, statusFilter])

  const exportCSV = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/history/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `linkedin-scout-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported!')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const statusBadge = (status: HistoryItem['status']) => {
    const classes: Record<HistoryItem['status'], string> = {
      APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      EDITED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      SKIPPED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
      PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classes[status]}`}>
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    )
  }

  const totalPages = Math.ceil(total / limit)

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} total comments</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-xl text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="EDITED">Edited</option>
            <option value="SKIPPED">Skipped</option>
            <option value="PENDING">Pending</option>
          </select>
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 dark:text-gray-400">No history yet. Start reviewing posts in your feed!</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.post.authorName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(item.createdAt), 'dd MMM yyyy')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={item.score} size="sm" />
                  {statusBadge(item.status)}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{item.post.content.slice(0, 80)}…</p>
              {item.finalComment && (
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 line-clamp-2">{item.finalComment}</p>
              )}
              {(item.reactions > 0 || item.replies > 0) && (
                <p className="text-xs text-gray-400 mt-2">❤️ {item.reactions} · 💬 {item.replies}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Author</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Post</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Final Comment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Engage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-500 dark:text-gray-400">
                    No history yet. Start reviewing posts in your feed!
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400 text-xs">
                      {format(new Date(item.createdAt), 'dd MMM')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white text-xs">{item.post.authorName}</p>
                      <p className="text-gray-400 text-xs truncate max-w-[120px]">{item.post.authorTitle}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-gray-600 dark:text-gray-400 text-xs truncate">{item.post.content.slice(0, 60)}…</p>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-gray-700 dark:text-gray-300 text-xs line-clamp-2">{item.finalComment || item.suggestedComment}</p>
                    </td>
                    <td className="px-4 py-3"><ScoreBadge score={item.score} size="sm" /></td>
                    <td className="px-4 py-3">{statusBadge(item.status)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {item.reactions > 0 || item.replies > 0 ? `❤️${item.reactions} 💬${item.replies}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
