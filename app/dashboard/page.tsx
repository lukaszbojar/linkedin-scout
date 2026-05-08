'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, MessageSquare, CheckCircle, Star, Heart, MessageCircle } from 'lucide-react'

interface Stats {
  reviewedToday: number
  reviewedThisWeek: number
  approvedToday: number
  approvedThisWeek: number
  approvalRate: number
  avgScore: number
  topTopics: string[]
  totalReactions: number
  totalReplies: number
}

interface ChartPoint {
  date: string
  reviewed: number
  approved: number
}

function StatCard({
  label, value, sub, icon: Icon, color
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        const [statsRes, chartRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/dashboard/chart'),
        ])
        if (statsRes.ok) setStats(await statsRes.json())
        if (chartRes.ok) {
          const d = await chartRes.json()
          setChartData(d.data || [])
        }
      } catch {
        toast.error('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back, {user.name} 👋</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Reviewed Today"
              value={stats?.reviewedToday ?? 0}
              sub={`${stats?.reviewedThisWeek ?? 0} this week`}
              icon={MessageSquare}
              color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <StatCard
              label="Approved Today"
              value={stats?.approvedToday ?? 0}
              sub={`${stats?.approvedThisWeek ?? 0} this week`}
              icon={CheckCircle}
              color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            />
            <StatCard
              label="Approval Rate"
              value={`${stats?.approvalRate ?? 0}%`}
              sub="This week"
              icon={TrendingUp}
              color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
            />
            <StatCard
              label="Avg Score"
              value={stats?.avgScore ?? '—'}
              sub="Posts this week"
              icon={Star}
              color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
            />
            <StatCard
              label="Total Reactions"
              value={stats?.totalReactions ?? 0}
              sub="On your comments"
              icon={Heart}
              color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            />
            <StatCard
              label="Total Replies"
              value={stats?.totalReplies ?? 0}
              sub="On your comments"
              icon={MessageCircle}
              color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Comments per Day (Last 14 Days)</h2>
          {loading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: 13,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="reviewed" name="Reviewed" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" name="Approved" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top topics */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">🔥 Trending Topics</h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-full rounded-full" />)}
            </div>
          ) : stats?.topTopics && stats.topTopics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {stats.topTopics.map((topic) => (
                <span
                  key={topic}
                  className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full text-sm font-medium"
                >
                  {topic}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              Topics will appear after you start reviewing posts.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
