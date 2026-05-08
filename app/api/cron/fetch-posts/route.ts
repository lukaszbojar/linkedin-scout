import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchLinkedInPosts } from '@/lib/linkedin-scraper'

export const dynamic = 'force-dynamic'
import { analyzePost } from '@/lib/ai'
import { Resend } from 'resend'

export async function GET() {
  const secret = process.env.CRON_SECRET
  // In production, verify the request comes from Vercel cron

  const resend = new Resend(process.env.RESEND_API_KEY)

  const users = await prisma.user.findMany({
    where: { linkedinSessionCookie: { not: null } },
  })

  const results = []

  for (const user of users) {
    if (!user.linkedinSessionCookie) continue

    try {
      const posts = await fetchLinkedInPosts(user.linkedinSessionCookie, user.dailyPostLimit)

      for (const post of posts) {
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
        }
      }

      results.push({ userId: user.id, posts: posts.length, success: true })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.push({ userId: user.id, success: false, error: message })

      if (message === 'SESSION_EXPIRED') {
        await resend.emails.send({
          from: 'LinkedIn Scout <onboarding@resend.dev>',
          to: user.email,
          subject: 'LinkedIn Scout: Session Expired',
          html: `<p>Hi ${user.name},</p><p>Your LinkedIn session has expired. Please <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/linkedin">update your session cookie</a> to continue receiving post suggestions.</p>`,
        })
      }
    }
  }

  void secret // suppress unused warning
  return NextResponse.json({ success: true, results })
}
