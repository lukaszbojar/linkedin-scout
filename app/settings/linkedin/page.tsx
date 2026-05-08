'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Network, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react'

export default function LinkedInSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cookie, setCookie] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [showCookie, setShowCookie] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  const saveCookie = async () => {
    if (!cookie.trim()) {
      toast.error('Please enter a session cookie')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/linkedin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCookie: cookie }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Cookie saved securely!')
      setCookie('')
      setTestResult(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    const toastId = toast.loading('Testing LinkedIn connection...')
    try {
      const res = await fetch('/api/settings/linkedin/test', { method: 'POST' })
      const data = await res.json()
      setTestResult(data.connected)
      if (data.connected) {
        toast.success('✓ LinkedIn connected!', { id: toastId })
      } else {
        toast.error('✗ Session expired or invalid', { id: toastId })
      }
    } catch {
      toast.error('Test failed', { id: toastId })
      setTestResult(false)
    } finally {
      setTesting(false)
    }
  }

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <Network className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Connect LinkedIn</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Paste your session cookie to enable post fetching</p>
        </div>
      </div>

      {/* Warning */}
      <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 dark:text-amber-300">
          <p className="font-semibold mb-1">Session expires in ~30 days</p>
          <p>You&apos;ll need to refresh your cookie periodically. Your cookie is encrypted before storage.</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">How to get your session cookie</h2>
        <ol className="space-y-3">
          {[
            'Open LinkedIn in your browser and make sure you\'re logged in',
            'Press F12 (or right-click → Inspect) to open DevTools',
            'Go to the "Application" tab (Chrome) or "Storage" tab (Firefox)',
            'In the left panel, expand "Cookies" → select "https://www.linkedin.com"',
            'Find the cookie named "li_at" and copy its Value',
            'Paste the value below and click Save',
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Cookie input */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          LinkedIn Session Cookie (li_at)
        </label>
        <div className="relative">
          <input
            type={showCookie ? 'text' : 'password'}
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="Paste your li_at cookie value here"
            className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowCookie(!showCookie)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showCookie ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {testResult !== null && (
          <div className={`flex items-center gap-2 mt-3 text-sm font-medium ${testResult ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {testResult
              ? <><CheckCircle className="w-4 h-4" /> Connection verified!</>
              : <><XCircle className="w-4 h-4" /> Session expired or invalid</>
            }
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={saveCookie}
          disabled={saving || !cookie.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold rounded-xl transition-colors"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Save Cookie'
          )}
        </button>
        <button
          onClick={testConnection}
          disabled={testing}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors"
        >
          {testing ? (
            <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            'Test Connection'
          )}
        </button>
      </div>
    </div>
  )
}
