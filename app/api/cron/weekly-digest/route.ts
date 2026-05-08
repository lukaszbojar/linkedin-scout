import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWeeklyDigest } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET() {
  const users = await prisma.user.findMany()
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const results = []

  for (const user of users) {
    try {
      const weeklyComments = await prisma.commentSuggestion.findMany({
        where: {
          userId: user.id,
          status: { in: ['APPROVED', 'EDITED'] },
          createdAt: { gte: oneWeekAgo },
        },
        include: { post: { select: { authorName: true, content: true } } },
        orderBy: { reactions: 'desc' },
      })

      if (weeklyComments.length === 0) continue

      const topComments = weeklyComments.slice(0, 3).map((c) => ({
        postAuthor: c.post.authorName,
        comment: (c.finalComment || c.suggestedComment).slice(0, 200),
        reactions: c.reactions,
        replies: c.replies,
      }))

      const allContent = weeklyComments.map((c) => c.post.content).join(' ')
      const words = allContent.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 5)
      const wordCount: Record<string, number> = {}
      words.forEach((w) => { wordCount[w] = (wordCount[w] || 0) + 1 })
      const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'their', 'about', 'would', 'which'])
      const topTopics = Object.entries(wordCount)
        .filter(([w]) => !stopWords.has(w))
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([w]) => w)

      await sendWeeklyDigest({
        userName: user.name,
        userEmail: user.email,
        totalComments: weeklyComments.length,
        topComments,
        topTopics,
        appUrl,
      })

      results.push({ userId: user.id, success: true })
    } catch (error) {
      results.push({ userId: user.id, success: false, error: String(error) })
    }
  }

  return NextResponse.json({ success: true, results })
}
