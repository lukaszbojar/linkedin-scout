import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AIAnalysis {
  score: number
  reasoning: string
  suggestedComment: string
}

export async function analyzePost(
  userName: string,
  personalityPrompt: string | null,
  authorName: string,
  authorTitle: string,
  postContent: string
): Promise<AIAnalysis> {
  const systemPrompt = `You are analyzing LinkedIn posts for ${userName}.
Their writing style: ${personalityPrompt || 'Professional, concise, and insightful. Adds real value to conversations.'}
Generate authentic comments that sound exactly like them.`

  const userPrompt = `Analyze this LinkedIn post and respond with JSON only (no markdown, no code block):
{
  "score": <1-10 integer, where 10 means highly worth commenting on>,
  "reasoning": "<one sentence why this post is or isn't worth commenting on>",
  "suggestedComment": "<comment in the user's voice, max 3 sentences, authentic and valuable>"
}

Post by ${authorName} (${authorTitle}):
${postContent}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    // Strip markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      score: Math.min(10, Math.max(1, parseInt(parsed.score) || 5)),
      reasoning: parsed.reasoning || 'Interesting post worth engaging with.',
      suggestedComment: parsed.suggestedComment || 'Great insights, thank you for sharing!',
    }
  } catch {
    return {
      score: 5,
      reasoning: 'Could not parse AI response.',
      suggestedComment: 'Thank you for sharing this perspective!',
    }
  }
}
