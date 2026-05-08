import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const suggestions = await prisma.commentSuggestion.findMany({
    where: { userId: user.id },
    include: {
      post: {
        select: { authorName: true, authorTitle: true, content: true, postedAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const headers = ['Date', 'Author', 'Author Title', 'Post Excerpt', 'Suggested Comment', 'Final Comment', 'Status', 'Score', 'Reactions', 'Replies']
  const rows = suggestions.map((s) => [
    s.createdAt.toISOString(),
    s.post.authorName,
    s.post.authorTitle,
    s.post.content.slice(0, 100).replace(/"/g, '""'),
    (s.suggestedComment || '').replace(/"/g, '""'),
    (s.finalComment || '').replace(/"/g, '""'),
    s.status,
    s.score.toString(),
    s.reactions.toString(),
    s.replies.toString(),
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="linkedin-scout-history-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
