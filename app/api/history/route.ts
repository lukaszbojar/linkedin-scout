import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status')

  const where: Record<string, unknown> = { userId: user.id }
  if (status) where.status = status

  const [suggestions, total] = await Promise.all([
    prisma.commentSuggestion.findMany({
      where,
      include: {
        post: {
          select: {
            authorName: true,
            authorTitle: true,
            content: true,
            postedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.commentSuggestion.count({ where }),
  ])

  return NextResponse.json({ suggestions, total, page, limit })
}
