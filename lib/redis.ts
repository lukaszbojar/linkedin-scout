import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function getRateLimit(key: string, windowSeconds: number, maxRequests: number): Promise<boolean> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(key, 0, windowStart)
  pipeline.zadd(key, { score: now, member: now.toString() })
  pipeline.zcard(key)
  pipeline.expire(key, windowSeconds)

  const results = await pipeline.exec()
  const count = results[2] as number

  return count <= maxRequests
}
