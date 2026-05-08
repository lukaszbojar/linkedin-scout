import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const posts = await prisma.post.findMany({
    where: {
      userId: user.id,
      fetchedAt: { gte: oneDayAgo },
    },
    include: {
      suggestions: {
        where: { userId: user.id },
        orderBy: { score: 'desc' },
        take: 1,
      },
    },
    orderBy: { fetchedAt: 'desc' },
  })

  return NextResponse.json({ posts })
}
