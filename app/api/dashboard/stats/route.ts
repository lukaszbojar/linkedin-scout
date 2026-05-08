import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    reviewedToday,
    reviewedThisWeek,
    approvedToday,
    approvedThisWeek,
    avgScoreResult,
    recentPosts,
    engagementStats,
  ] = await Promise.all([
    prisma.commentSuggestion.count({
      where: { userId: user.id, createdAt: { gte: startOfToday } },
    }),
    prisma.commentSuggestion.count({
      where: { userId: user.id, createdAt: { gte: startOfWeek } },
    }),
    prisma.commentSuggestion.count({
      where: {
        userId: user.id,
        createdAt: { gte: startOfToday },
        status: { in: ['APPROVED', 'EDITED'] },
      },
    }),
    prisma.commentSuggestion.count({
      where: {
        userId: user.id,
        createdAt: { gte: startOfWeek },
        status: { in: ['APPROVED', 'EDITED'] },
      },
    }),
    prisma.commentSuggestion.aggregate({
      where: { userId: user.id, createdAt: { gte: startOfWeek } },
      _avg: { score: true },
    }),
    prisma.post.findMany({
      where: { userId: user.id, fetchedAt: { gte: startOfWeek } },
      select: { content: true },
    }),
    prisma.commentSuggestion.aggregate({
      where: {
        userId: user.id,
        status: { in: ['APPROVED', 'EDITED'] },
      },
      _sum: { reactions: true, replies: true },
    }),
  ])

  // Extract top keywords
  const allContent = recentPosts.map((p) => p.content).join(' ')
  const words = allContent
    .toLowerCase()
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 5)
  const wordCount: Record<string, number> = {}
  words.forEach((w) => { wordCount[w] = (wordCount[w] || 0) + 1 })
  const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'their', 'about', 'would', 'which', 'there', 'when', 'your', 'will'])
  const topTopics = Object.entries(wordCount)
    .filter(([w]) => !stopWords.has(w))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([word]) => word)

  const approvalRate = reviewedThisWeek > 0
    ? Math.round((approvedThisWeek / reviewedThisWeek) * 100)
    : 0

  return NextResponse.json({
    reviewedToday,
    reviewedThisWeek,
    approvedToday,
    approvedThisWeek,
    approvalRate,
    avgScore: Math.round((avgScoreResult._avg.score || 0) * 10) / 10,
    topTopics,
    totalReactions: engagementStats._sum.reactions || 0,
    totalReplies: engagementStats._sum.replies || 0,
  })
}
