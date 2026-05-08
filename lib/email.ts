import { Resend } from 'resend'

interface WeeklyDigestData {
  userName: string
  userEmail: string
  totalComments: number
  topComments: Array<{
    postAuthor: string
    comment: string
    reactions: number
    replies: number
  }>
  topTopics: string[]
  appUrl: string
}

export async function sendWeeklyDigest(data: WeeklyDigestData) {
  const { userName, userEmail, totalComments, topComments, topTopics, appUrl } = data

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LinkedIn Scout Weekly Digest</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #2563eb; color: white; padding: 32px 40px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 40px; }
    .stat-row { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat-card { flex: 1; background: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; }
    .stat-card .number { font-size: 32px; font-weight: 700; color: #2563eb; }
    .stat-card .label { font-size: 13px; color: #64748b; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
    .comment-card { background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 4px; padding: 14px 16px; margin-bottom: 10px; }
    .comment-card .author { font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .comment-card .text { font-size: 14px; color: #1e293b; line-height: 1.5; }
    .comment-card .stats { font-size: 12px; color: #94a3b8; margin-top: 8px; }
    .topics { display: flex; flex-wrap: wrap; gap: 8px; }
    .topic { background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; }
    .cta { text-align: center; margin: 28px 0; }
    .cta a { background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; }
    .footer { padding: 20px 40px; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 LinkedIn Scout Weekly Digest</h1>
      <p>Hi ${userName}! Here's your activity summary for this week.</p>
    </div>
    <div class="content">
      <div class="stat-row">
        <div class="stat-card">
          <div class="number">${totalComments}</div>
          <div class="label">Comments This Week</div>
        </div>
        <div class="stat-card">
          <div class="number">${topComments.reduce((a, c) => a + c.reactions, 0)}</div>
          <div class="label">Total Reactions</div>
        </div>
      </div>

      ${topComments.length > 0 ? `
      <div class="section">
        <h2>🏆 Top Comments This Week</h2>
        ${topComments.map(c => `
        <div class="comment-card">
          <div class="author">On post by ${c.postAuthor}</div>
          <div class="text">"${c.comment}"</div>
          <div class="stats">❤️ ${c.reactions} reactions · 💬 ${c.replies} replies</div>
        </div>
        `).join('')}
      </div>
      ` : ''}

      ${topTopics.length > 0 ? `
      <div class="section">
        <h2>🔥 Trending Topics You Engaged With</h2>
        <div class="topics">
          ${topTopics.map(t => `<span class="topic">${t}</span>`).join('')}
        </div>
      </div>
      ` : ''}

      <div class="cta">
        <a href="${appUrl}/feed">Browse Today's Posts →</a>
      </div>
    </div>
    <div class="footer">
      <p>LinkedIn Scout — AI-powered LinkedIn engagement</p>
    </div>
  </div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'LinkedIn Scout <onboarding@resend.dev>',
    to: userEmail,
    subject: `Your LinkedIn Scout Weekly Digest 📊`,
    html,
  })
}
