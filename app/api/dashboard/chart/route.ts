import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = 14
  const results = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    const [reviewed, approved] = await Promise.all([
      prisma.commentSuggestion.count({
        where: {
          userId: user.id,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      prisma.commentSuggestion.count({
        where: {
          userId: user.id,
          createdAt: { gte: startOfDay, lt: endOfDay },
          status: { in: ['APPROVED', 'EDITED'] },
        },
      }),
    ])

    results.push({
      date: startOfDay.toISOString().split('T')[0],
      reviewed,
      approved,
    })
  }

  return NextResponse.json({ data: results })
}
