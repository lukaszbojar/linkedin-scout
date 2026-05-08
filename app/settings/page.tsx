'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Network, User, Lock, Save } from 'lucide-react'

interface Settings {
  name: string
  email: string
  personalityPrompt: string
  dailyPostLimit: number
  hasLinkedIn: boolean
}

export default function SettingsPage() {
  const { user, loading: authLoading, refresh } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>({
    name: '',
    email: '',
    personalityPrompt: '',
    dailyPostLimit: 5,
    hasLinkedIn: false,
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setSettings({
            name: data.user.name || '',
            email: data.user.email || '',
            personalityPrompt: data.user.personalityPrompt || '',
            dailyPostLimit: data.user.dailyPostLimit || 5,
            hasLinkedIn: data.user.hasLinkedIn || false,
          })
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: settings.name,
        email: settings.email,
        personalityPrompt: settings.personalityPrompt,
        dailyPostLimit: settings.dailyPostLimit,
      }
      if (newPassword) {
        body.currentPassword = currentPassword
        body.newPassword = newPassword
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Settings saved!')
      setCurrentPassword('')
      setNewPassword('')
      await refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <form onSubmit={save} className="space-y-6">
          {/* Profile */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Profile</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* AI personality */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🤖</span>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">AI Comment Style</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Describe your writing style. The more detail, the better the AI will match your voice.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Personality Prompt
                </label>
                <textarea
                  value={settings.personalityPrompt}
                  onChange={(e) => setSettings({ ...settings, personalityPrompt: e.target.value })}
                  rows={5}
                  placeholder="E.g.: I'm a B2B sales expert. I write concise, practical comments with real examples from my work. I avoid generic praise and always add specific insights. I use a friendly but professional tone."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Daily Post Limit
                </label>
                <select
                  value={settings.dailyPostLimit}
                  onChange={(e) => setSettings({ ...settings, dailyPostLimit: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} post{n > 1 ? 's' : ''} per fetch</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  How many posts to fetch and analyze per run.
                </p>
              </div>
            </div>
          </div>

          {/* LinkedIn connection */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">LinkedIn Connection</h2>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
                settings.hasLinkedIn
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${settings.hasLinkedIn ? 'bg-green-500' : 'bg-red-500'}`} />
                {settings.hasLinkedIn ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Connect your LinkedIn account to enable post fetching.
            </p>
            <Link
              href="/settings/linkedin"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Network className="w-4 h-4" />
              {settings.hasLinkedIn ? 'Update LinkedIn Session' : 'Connect LinkedIn'}
            </Link>
          </div>

          {/* Password */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lock className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Change Password</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Min. 8 characters"
                  minLength={8}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save className="w-5 h-5" /> Save Settings</>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
