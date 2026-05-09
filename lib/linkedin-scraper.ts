import { decrypt } from './crypto'

export interface LinkedInPost {
  linkedinPostId: string
  authorName: string
  authorTitle: string
  authorUrl: string
  content: string
  postedAt: Date
}

// ---------------------------------------------------------------------------
// LinkedIn Voyager API helpers
// ---------------------------------------------------------------------------

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Build headers for LinkedIn Voyager API.
 *
 * IMPORTANT: We deliberately do NOT visit any LinkedIn HTML page from the
 * server. Doing so from a Vercel IP (different country than the user) triggers
 * LinkedIn's account-takeover detection and invalidates the li_at cookie.
 *
 * Read-only GET requests to Voyager JSON endpoints work fine with the static
 * CSRF token "ajax:0" — LinkedIn only enforces real CSRF validation on
 * mutating (POST/PUT/DELETE) calls.
 */
function buildHeaders(liAt: string): Record<string, string> {
  return {
    Cookie: `li_at=${liAt}; JSESSIONID=ajax:0`,
    'Csrf-Token': 'ajax:0',
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.linkedin.normalized+json+2.1',
    'x-restli-protocol-version': '2.0.0',
    'x-li-lang': 'en_US',
    'x-li-track': JSON.stringify({ clientVersion: '1.13.2491' }),
    'x-li-page-instance': 'urn:li:page:d_flagship3_feed;',
    Referer: 'https://www.linkedin.com/feed/',
    Origin: 'https://www.linkedin.com',
  }
}

// ---------------------------------------------------------------------------
// Session test
// ---------------------------------------------------------------------------

export async function testLinkedInSession(encryptedCookie: string): Promise<boolean> {
  try {
    const liAt = decrypt(encryptedCookie)
    const headers = buildHeaders(liAt)

    const res = await fetch('https://www.linkedin.com/voyager/api/me', {
      headers,
    })

    return res.ok
  } catch (err) {
    console.error('LinkedIn session test failed:', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Feed post fetching via Voyager API
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

/** Safely get a nested string from an unknown object */
function getString(obj: AnyObj, ...keys: string[]): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return ''
    cur = cur[k]
  }
  return typeof cur === 'string' ? cur : ''
}

/** Extract plain text from LinkedIn's annotated text objects */
function extractText(textObj: AnyObj | null | undefined): string {
  if (!textObj) return ''
  // Some endpoints wrap it: { text: "...", ... }
  const raw = getString(textObj, 'text')
  if (raw) return raw
  // Others: { $type: "...", text: { text: "..." } }
  const nested = getString(textObj, 'text', 'text')
  return nested
}

/**
 * Parse a raw Voyager normalized-JSON response into post objects.
 * LinkedIn returns a `data` wrapper + `included` array of all referenced
 * entities. We find `Update` entities and resolve their actors / commentary.
 */
export function parseVoyagerResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any,
  now: Date,
  oneDayAgo: Date
): LinkedInPost[] {
  const included: AnyObj[] = Array.isArray(json.included) ? json.included : []
  const posts: LinkedInPost[] = []

  for (const entity of included) {
    if (typeof entity !== 'object' || entity === null) continue

    const type: string = entity['$type'] || entity['entityUrn'] || ''
    // We care about Update entities
    const isUpdate =
      type.includes('voyager.feed.Update') ||
      type.includes('voyager.feed.render.UpdateV2') ||
      typeof entity['commentary'] !== 'undefined' ||
      typeof entity['resharedUpdate'] !== 'undefined'

    if (!isUpdate) continue

    // Post content — can live in commentary or resharedUpdate
    const commentary: AnyObj = entity['commentary'] || {}
    let content =
      extractText(commentary['text']) ||
      extractText(commentary) ||
      extractText(entity['headerText']) ||
      ''

    // Some updates wrap content differently
    if (!content && entity['updateMetadata']) {
      content = extractText(entity['updateMetadata']['shareCommentary']?.['text'])
    }

    if (!content || content.length < 20) continue

    // Author info
    const actor: AnyObj = entity['actor'] || {}
    const authorName =
      extractText(actor['name']) || extractText(actor['title']) || 'Unknown'
    if (authorName === 'Unknown') continue

    const authorTitle =
      extractText(actor['description']) ||
      extractText(actor['subDescription']) ||
      ''

    const authorUrl: string = actor['navigationUrl'] || actor['url'] || ''

    // Post ID — prefer URN-based ID
    const urn: string =
      entity['urn'] ||
      entity['entityUrn'] ||
      entity['updateMetadata']?.['urn'] ||
      ''
    const idMatch = urn.match(/:activity:(\d+)/)
    const linkedinPostId = idMatch ? `urn:li:activity:${idMatch[1]}` : urn || Math.random().toString(36)

    // Timestamp
    const rawTs: number =
      entity['publishedAt'] ||
      entity['createdAt'] ||
      entity['updateMetadata']?.['publishedAt'] ||
      0
    const postedAt = rawTs ? new Date(rawTs) : new Date(now.getTime() - 6 * 60 * 60 * 1000)

    if (postedAt < oneDayAgo) continue

    posts.push({
      linkedinPostId,
      authorName,
      authorTitle,
      authorUrl,
      content: content.trim().slice(0, 3000),
      postedAt,
    })
  }

  return posts
}

export async function fetchLinkedInPosts(
  encryptedCookie: string,
  limit: number
): Promise<LinkedInPost[]> {
  const liAt = decrypt(encryptedCookie)
  const headers = buildHeaders(liAt)

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const allPosts: LinkedInPost[] = []
  const seenIds = new Set<string>()

  // Paginate if needed — fetch up to 2 pages of 20
  const pages = Math.ceil(limit / 20)

  for (let page = 0; page < pages && allPosts.length < limit; page++) {
    const start = page * 20
    const url =
      `https://www.linkedin.com/voyager/api/feed/updatesV2` +
      `?count=20&start=${start}&includeFilteredUpdates=true` +
      `&q=chronFeed&sortOrder=RECENT`

    const res = await fetch(url, { headers })

    if (res.status === 401 || res.status === 403) {
      throw new Error('SESSION_EXPIRED')
    }

    if (!res.ok) {
      console.error(`Voyager feed returned ${res.status}`)
      break
    }

    const json = await res.json()
    const pagePosts = parseVoyagerResponse(json, now, oneDayAgo)

    for (const p of pagePosts) {
      if (!seenIds.has(p.linkedinPostId)) {
        seenIds.add(p.linkedinPostId)
        allPosts.push(p)
      }
    }

    // If we got fewer than 20 results, no point fetching more pages
    const elements: unknown[] = Array.isArray(json.data?.elements) ? json.data.elements : []
    if (elements.length < 20) break
  }

  return allPosts.slice(0, limit)
}
