import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action, finalComment } = body

  const suggestion = await prisma.commentSuggestion.findFirst({
    where: { id, userId: user.id },
  })

  if (!suggestion) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let updateData: Record<string, unknown> = {}

  switch (action) {
    case 'approve':
      updateData = {
        status: 'APPROVED',
        finalComment: suggestion.suggestedComment,
        publishedAt: new Date(),
      }
      break
    case 'edit':
      if (!finalComment || typeof finalComment !== 'string') {
        return NextResponse.json({ error: 'finalComment required' }, { status: 400 })
      }
      updateData = {
        status: 'EDITED',
        finalComment: finalComment.trim(),
        publishedAt: new Date(),
      }
      break
    case 'skip':
      updateData = { status: 'SKIPPED' }
      break
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const updated = await prisma.commentSuggestion.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({ suggestion: updated })
}
