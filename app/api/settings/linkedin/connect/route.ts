import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionCookie } = await req.json()

  if (!sessionCookie || typeof sessionCookie !== 'string' || sessionCookie.trim().length < 10) {
    return NextResponse.json({ error: 'Invalid session cookie' }, { status: 400 })
  }

  const encrypted = encrypt(sessionCookie.trim())

  await prisma.user.update({
    where: { id: user.id },
    data: { linkedinSessionCookie: encrypted },
  })

  return NextResponse.json({ success: true })
}
