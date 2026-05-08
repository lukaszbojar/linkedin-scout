import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { testLinkedInSession } from '@/lib/linkedin-scraper'

export async function POST() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!user.linkedinSessionCookie) {
    return NextResponse.json({ connected: false, error: 'No session cookie saved' })
  }

  try {
    const connected = await testLinkedInSession(user.linkedinSessionCookie)
    return NextResponse.json({ connected })
  } catch {
    return NextResponse.json({ connected: false, error: 'Connection test failed' })
  }
}
