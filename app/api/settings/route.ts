import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      linkedinUsername: user.linkedinUsername,
      personalityPrompt: user.personalityPrompt,
      dailyPostLimit: user.dailyPostLimit,
      hasLinkedIn: !!user.linkedinSessionCookie,
    },
  })
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, email, personalityPrompt, dailyPostLimit, currentPassword, newPassword } = body

  const updateData: Record<string, unknown> = {}

  if (name) updateData.name = name.trim()
  if (email) updateData.email = email.trim().toLowerCase()
  if (personalityPrompt !== undefined) updateData.personalityPrompt = personalityPrompt
  if (dailyPostLimit) {
    const limit = parseInt(dailyPostLimit)
    if (limit >= 1 && limit <= 10) updateData.dailyPostLimit = limit
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password required' }, { status: 400 })
    }
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }
    updateData.passwordHash = await bcrypt.hash(newPassword, 12)
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: { id: true, name: true, email: true, personalityPrompt: true, dailyPostLimit: true },
  })

  return NextResponse.json({ user: updated })
}
