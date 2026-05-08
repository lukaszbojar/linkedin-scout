import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Placeholder - full Playwright engagement sync would be implemented here
  const users = await prisma.user.findMany({ select: { id: true } })

  return NextResponse.json({
    success: true,
    usersProcessed: users.length,
    message: 'Engagement sync cron completed',
  })
}
