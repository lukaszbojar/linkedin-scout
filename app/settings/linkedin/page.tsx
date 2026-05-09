'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Network, ArrowLeft, Copy, Check, RefreshCw, BookOpen, AlertTriangle } from 'lucide-react'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://linkedin-scout.vercel.app'

function buildBookmarklet(token: string) {
  // Minified JS that runs on linkedin.com, calls Voyager API, sends to our ingest endpoint
  const code = `(async()=>{
    const c=document.cookie.match(/JSESSIONID=(?:"([^"]+)"|([^;]+))/);
    const csrf=c?(c[1]||c[2]).trim():'ajax:0';
    const n=document.querySelector('.msg-overlay-list-bubble--is-minimized,.feed-shared-update-v2')||document.body;
    try{
      const r=await fetch('/voyager/api/feed/updatesV2?count=20&start=0&q=chronFeed&sortOrder=RECENT',{
        headers:{'Accept':'application/vnd.linkedin.normalized+json+2.1','x-restli-protocol-version':'2.0.0','Csrf-Token':csrf},
        credentials:'include'
      });
      if(!r.ok){alert('LinkedIn Scout: błąd '+r.status+' — upewnij się, że jesteś zalogowany na LinkedIn');return;}
      const j=await r.json();
      const s=await fetch('${APP_URL}/api/feed/ingest?token=${token}',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(j)
      });
      const rs=await s.json();
      if(rs.suggestionsGenerated>0){alert('✅ LinkedIn Scout: '+rs.suggestionsGenerated+' nowych sugestii AI gotowych!');}
      else if(rs.postsFound>0){alert('ℹ️ LinkedIn Scout: znaleziono '+rs.postsFound+' postów, ale wszystkie już przetworzone.');}
      else{alert('ℹ️ LinkedIn Scout: brak nowych postów z ostatnich 24h.');}
    }catch(e){alert('LinkedIn Scout: błąd — '+e.message);}
  })();`
  // Collapse to single line for bookmarklet
  return 'javascript:' + code.replace(/\s*\n\s*/g, '').replace(/\s{2,}/g, ' ')
}

export default function LinkedInSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [loadingToken, setLoadingToken] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  const fetchToken = useCallback(async () => {
    setLoadingToken(true)
    try {
      const res = await fetch('/api/settings/linkedin/token')
      if (res.ok) {
        const data = await res.json()
        setToken(data.token)
      }
    } catch {
      toast.error('Nie udało się załadować tokena')
    } finally {
      setLoadingToken(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchToken()
  }, [user, fetchToken])

  const regenerateToken = async () => {
    if (!confirm('Stary bookmarklet przestanie działać. Kontynuować?')) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/settings/linkedin/token', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setToken(data.token)
        toast.success('Token odświeżony — zaktualizuj bookmarklet')
      }
    } catch {
      toast.error('Błąd podczas odświeżania tokena')
    } finally {
      setRegenerating(false)
    }
  }

  const copyBookmarklet = async () => {
    if (!token) return
    await navigator.clipboard.writeText(buildBookmarklet(token))
    setCopied(true)
    toast.success('Bookmarklet skopiowany!')
    setTimeout(() => setCopied(false), 2500)
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const bookmarklet = token ? buildBookmarklet(token) : ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Wróć do ustawień
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <Network className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Połącz LinkedIn</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Bookmarklet — działa z Twojej przeglądarki</p>
        </div>
      </div>

      {/* Why bookmarklet */}
      <div className="flex gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
        <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-semibold mb-1">Dlaczego bookmarklet, a nie cookie?</p>
          <p>LinkedIn wykrywa żądania z obcych serwerów (inny kraj, inne IP) i automatycznie wylogowuje konto. Bookmarklet działa <strong>w Twojej przeglądarce</strong> — żądanie wychodzi z Twojego IP, LinkedIn nie reaguje.</p>
        </div>
      </div>

      {/* Step-by-step */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Jak skonfigurować (jednorazowo)</h2>
        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center justify-center">1</span>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
              <p className="font-medium mb-1">Skopiuj kod bookmarkletu</p>
              <p className="text-gray-500 dark:text-gray-400">Kliknij przycisk poniżej &mdash; kod trafi do schowka.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center justify-center">2</span>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
              <p className="font-medium mb-1">Dodaj zakładkę w przeglądarce</p>

              {/* Safari */}
              <div className="mt-2 mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Safari (Mac)</p>
                <ol className="space-y-1 text-gray-500 dark:text-gray-400">
                  <li>1. Otwórz dowolną stronę i naciśnij <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">⌘D</kbd> &mdash; dodaj zakładkę do <strong>Paska ulubionych</strong></li>
                  <li>2. Otwórz menu <strong>Zakładki → Edytuj zakładki</strong> (<kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">⌥⌘B</kbd>)</li>
                  <li>3. Znajdź właśnie dodaną zakładkę, kliknij ją dwukrotnie</li>
                  <li>4. Zmień <strong>nazwę</strong> na <em>LinkedIn Scout</em>, a <strong>adres</strong> zastąp skopiowanym kodem</li>
                  <li>5. Naciśnij <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Return</kbd></li>
                </ol>
              </div>

              {/* Chrome / Edge */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Chrome / Edge (Mac &amp; Windows)</p>
                <ol className="space-y-1 text-gray-500 dark:text-gray-400">
                  <li>1. Otwórz Menedżer zakładek <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Ctrl/⌘+Shift+O</kbd></li>
                  <li>2. Kliknij <strong>Dodaj zakładkę</strong> (⋮ &rarr; Dodaj nową zakładkę)</li>
                  <li>3. Nazwij ją <em>LinkedIn Scout</em>, w polu <strong>URL</strong> wklej skopiowany kod</li>
                  <li>4. Kliknij <strong>Zapisz</strong></li>
                </ol>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center justify-center">3</span>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
              <p className="font-medium mb-1">Używaj codziennie</p>
              <p className="text-gray-500 dark:text-gray-400">Wejdź na <strong>linkedin.com/feed</strong>, kliknij zakładkę &mdash; za kilka sekund pojawi się okienko z liczbą nowych sugestii. Wróć tutaj, żeby je przejrzeć.</p>
            </div>
          </li>
        </ol>
      </div>

      {/* Bookmarklet code block */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Twój bookmarklet</label>
          <button
            onClick={regenerateToken}
            disabled={regenerating || loadingToken}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            Odśwież token
          </button>
        </div>

        {loadingToken ? (
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ) : (
          <div className="relative">
            <div className="font-mono text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 pr-12 overflow-hidden text-gray-500 dark:text-gray-400 select-all leading-relaxed break-all">
              {bookmarklet.slice(0, 120)}…
            </div>
            <button
              onClick={copyBookmarklet}
              className="absolute right-2 top-2 p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Kopiuj"
            >
              {copied
                ? <Check className="w-4 h-4 text-green-600" />
                : <Copy className="w-4 h-4 text-gray-500" />
              }
            </button>
          </div>
        )}

        <button
          onClick={copyBookmarklet}
          disabled={loadingToken || !token}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold rounded-xl transition-colors"
        >
          {copied
            ? <><Check className="w-4 h-4" /> Skopiowano!</>
            : <><Copy className="w-4 h-4" /> Kopiuj bookmarklet</>
          }
        </button>
      </div>

      {/* Warning about token */}
      <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Token w bookmarklecie jest przypisany do Twojego konta. Nie udostępniaj go innym. Jeśli bookmarklet wpadnie w niepowołane ręce, użyj &bdquo;Odśwież token&rdquo; &mdash; stary kod przestanie działać.
        </p>
      </div>
    </div>
  )
}
