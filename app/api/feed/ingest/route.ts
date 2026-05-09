import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseVoyagerResponse } from '@/lib/linkedin-scraper'
import { analyzePost } from '@/lib/ai'

export const dynamic = 'force-dynamic'

// CORS headers — bookmarklet runs on linkedin.com (cross-origin)
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'https://www.linkedin.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401, headers: CORS })
  }

  const user = await prisma.user.findFirst({ where: { ingestToken: token } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS })
  }

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const posts = parseVoyagerResponse(body, now, oneDayAgo)

  let newPosts = 0
  let suggestionsGenerated = 0

  for (const post of posts.slice(0, user.dailyPostLimit)) {
    const dbPost = await prisma.post.upsert({
      where: { linkedinPostId: post.linkedinPostId },
      update: {},
      create: {
        linkedinPostId: post.linkedinPostId,
        authorName: post.authorName,
        authorTitle: post.authorTitle,
        authorUrl: post.authorUrl,
        content: post.content,
        postedAt: post.postedAt,
        userId: user.id,
      },
    })

    const existing = await prisma.commentSuggestion.findFirst({
      where: { postId: dbPost.id, userId: user.id },
    })

    if (!existing) {
      newPosts++
      const analysis = await analyzePost(
        user.name,
        user.personalityPrompt,
        post.authorName,
        post.authorTitle,
        post.content
      )
      await prisma.commentSuggestion.create({
        data: {
          postId: dbPost.id,
          userId: user.id,
          suggestedComment: analysis.suggestedComment,
          score: analysis.score,
          scoreReasoning: analysis.reasoning,
        },
      })
      suggestionsGenerated++
    }
  }

  return NextResponse.json(
    { success: true, postsFound: posts.length, newPosts, suggestionsGenerated },
    { headers: CORS }
  )
}
