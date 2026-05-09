'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type State = 'waiting' | 'processing' | 'done' | 'error'

function ImportContent() {
  const params = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState<State>('waiting')
  const [result, setResult] = useState<{ postsFound: number; suggestionsGenerated: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const processData = useCallback(
    async (data: unknown) => {
      setState('processing')
      try {
        const res = await fetch(`/api/feed/ingest?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Błąd serwera')
        setResult(json)
        setState('done')
        // Auto-close popup after 3 s
        setTimeout(() => window.close(), 3000)
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Nieznany błąd')
        setState('error')
      }
    },
    [token]
  )

  useEffect(() => {
    if (!token) return

    const handler = (e: MessageEvent) => {
      // Accept messages only from LinkedIn
      const allowed = ['https://www.linkedin.com', 'https://linkedin.com']
      if (!allowed.includes(e.origin)) return
      if (e.data?.type !== 'lk-scout') return
      processData(e.data.data)
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [token, processData])

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-red-500 text-sm">Brak tokena — otwórz tę stronę przez bookmarklet.</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center px-8 py-10 max-w-sm w-full">
        {state === 'waiting' && (
          <>
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Oczekiwanie na dane z LinkedIn&hellip;</p>
            <p className="text-xs text-gray-400 mt-2">To okienko odbiera posty z Twojej przeglądarki.</p>
          </>
        )}

        {state === 'processing' && (
          <>
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Analizuję posty AI&hellip;</p>
          </>
        )}

        {state === 'done' && result && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <p className="text-gray-900 font-bold text-lg mb-1">
              {result.suggestionsGenerated > 0
                ? `${result.suggestionsGenerated} nowych sugestii!`
                : 'Gotowe'}
            </p>
            <p className="text-sm text-gray-500">
              Znaleziono {result.postsFound} postów · {result.suggestionsGenerated} nowych komentarzy AI
            </p>
            <p className="text-xs text-gray-400 mt-3">Okienko zamknie się za chwilę&hellip;</p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <p className="text-gray-900 font-bold mb-1">Coś poszło nie tak</p>
            <p className="text-sm text-red-500">{errorMsg}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Zamknij
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ImportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ImportContent />
    </Suspense>
  )
}
