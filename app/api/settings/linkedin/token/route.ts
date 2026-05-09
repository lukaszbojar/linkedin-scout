import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function generateToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

// GET — return existing token (or create one if missing)
export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.ingestToken) {
    return NextResponse.json({ token: user.ingestToken })
  }

  const token = generateToken()
  await prisma.user.update({ where: { id: user.id }, data: { ingestToken: token } })
  return NextResponse.json({ token })
}

// POST — regenerate token
export async function POST() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = generateToken()
  await prisma.user.update({ where: { id: user.id }, data: { ingestToken: token } })
  return NextResponse.json({ token })
}
