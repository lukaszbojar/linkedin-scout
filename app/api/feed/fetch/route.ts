import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchLinkedInPosts } from '@/lib/linkedin-scraper'
import { analyzePost } from '@/lib/ai'
import { getRateLimit } from '@/lib/redis'

export async function POST() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!user.linkedinSessionCookie) {
    return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 })
  }

  // Rate limit: max 1 fetch per 30 seconds per user
  const allowed = await getRateLimit(`fetch:${user.id}`, 30, 1)
  if (!allowed) {
    return NextResponse.json({ error: 'Please wait 30 seconds between fetches' }, { status: 429 })
  }

  try {
    const posts = await fetchLinkedInPosts(user.linkedinSessionCookie, user.dailyPostLimit)

    let newPostsCount = 0
    let suggestionsCount = 0

    for (const post of posts) {
      // Upsert post
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

      // Check if we already have a suggestion for this post
      const existing = await prisma.commentSuggestion.findFirst({
        where: { postId: dbPost.id, userId: user.id },
      })

      if (!existing) {
        newPostsCount++
        // Generate AI suggestion
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
        suggestionsCount++
      }
    }

    return NextResponse.json({
      success: true,
      postsFound: posts.length,
      newPosts: newPostsCount,
      suggestionsGenerated: suggestionsCount,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Fetch error:', message)

    if (message === 'SESSION_EXPIRED') {
      return NextResponse.json({ error: 'LinkedIn session expired. Please update your cookie in Settings.' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch posts. Please try again.' }, { status: 500 })
  }
}
