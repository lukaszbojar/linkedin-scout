import { chromium } from 'playwright'
import { decrypt } from './crypto'

export interface LinkedInPost {
  linkedinPostId: string
  authorName: string
  authorTitle: string
  authorUrl: string
  content: string
  postedAt: Date
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function testLinkedInSession(encryptedCookie: string): Promise<boolean> {
  let browser = null
  try {
    const cookie = decrypt(encryptedCookie)
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    await context.addCookies([
      {
        name: 'li_at',
        value: cookie,
        domain: '.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true,
      },
    ])
    const page = await context.newPage()
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 })
    const url = page.url()
    return !url.includes('/login') && !url.includes('/checkpoint')
  } catch (err) {
    console.error('LinkedIn session test failed:', err)
    return false
  } finally {
    if (browser) await browser.close()
  }
}

export async function fetchLinkedInPosts(
  encryptedCookie: string,
  limit: number
): Promise<LinkedInPost[]> {
  const cookie = decrypt(encryptedCookie)
  const browser = await chromium.launch({ headless: true })
  const posts: LinkedInPost[] = []

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    })

    await context.addCookies([
      {
        name: 'li_at',
        value: cookie,
        domain: '.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true,
      },
    ])

    const page = await context.newPage()
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle', timeout: 30000 })

    // Check if still logged in
    const currentUrl = page.url()
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
      throw new Error('SESSION_EXPIRED')
    }

    // Scroll to load more posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800))
      await sleep(1500)
    }

    // Multiple selector strategies for resilience
    const postSelectors = [
      'div[data-id^="urn:li:activity"]',
      '.feed-shared-update-v2',
      'div[data-urn^="urn:li:activity"]',
      '.occludable-update',
    ]

    // Warm up selectors to ensure elements load before evaluate
    for (const selector of postSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 })
        const elements = await page.$$(selector)
        if (elements.length > 0) break
      } catch {
        continue
      }
    }

    // Parse posts from page
    const rawPosts = await page.evaluate((maxPosts) => {
      const results: Array<{
        id: string
        authorName: string
        authorTitle: string
        authorUrl: string
        content: string
        timeAgo: string
      }> = []

      // Try various container selectors
      const containers =
        document.querySelectorAll('[data-id^="urn:li:activity"]') ||
        document.querySelectorAll('.feed-shared-update-v2') ||
        document.querySelectorAll('[data-urn^="urn:li:activity"]')

      containers.forEach((container) => {
        if (results.length >= maxPosts) return

        try {
          // Extract post ID
          const id =
            container.getAttribute('data-id') ||
            container.getAttribute('data-urn') ||
            Math.random().toString(36).substr(2, 9)

          // Author name - multiple fallbacks
          const authorEl =
            container.querySelector('.update-components-actor__title span[aria-hidden="true"]') ||
            container.querySelector('.feed-shared-actor__title') ||
            container.querySelector('[data-anonymize="person-name"]') ||
            container.querySelector('.update-components-actor__name')
          const authorName = authorEl?.textContent?.trim() || 'Unknown Author'

          // Author title - multiple fallbacks
          const titleEl =
            container.querySelector('.update-components-actor__description span[aria-hidden="true"]') ||
            container.querySelector('.feed-shared-actor__description') ||
            container.querySelector('[data-anonymize="headline"]') ||
            container.querySelector('.update-components-actor__subtitle')
          const authorTitle = titleEl?.textContent?.trim() || ''

          // Author URL
          const linkEl =
            container.querySelector('a.update-components-actor__meta-link') ||
            container.querySelector('.feed-shared-actor__container-link') ||
            container.querySelector('a[data-tracking-control-name*="actor"]')
          const authorUrl = linkEl?.getAttribute('href') || ''

          // Post content - multiple fallbacks
          const contentEl =
            container.querySelector('.feed-shared-update-v2__description') ||
            container.querySelector('.update-components-text') ||
            container.querySelector('[data-test-id="main-feed-activity-card__commentary"]') ||
            container.querySelector('.break-words')
          const content = contentEl?.textContent?.trim() || ''

          // Time
          const timeEl =
            container.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]') ||
            container.querySelector('time') ||
            container.querySelector('.feed-shared-actor__sub-description')
          const timeAgo = timeEl?.textContent?.trim() || ''

          if (content && content.length > 20 && authorName !== 'Unknown Author') {
            results.push({ id, authorName, authorTitle, authorUrl, content, timeAgo })
          }
        } catch {
          // Skip malformed posts
        }
      })

      return results
    }, limit)

    const now = new Date()

    for (const raw of rawPosts.slice(0, limit)) {
      const postedAt = parseTimeAgo(raw.timeAgo, now)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      if (postedAt >= oneDayAgo) {
        posts.push({
          linkedinPostId: raw.id,
          authorName: raw.authorName,
          authorTitle: raw.authorTitle,
          authorUrl: raw.authorUrl,
          content: raw.content.slice(0, 3000),
          postedAt,
        })
      }
    }
  } finally {
    await browser.close()
  }

  return posts
}

function parseTimeAgo(timeAgo: string, now: Date): Date {
  const text = timeAgo.toLowerCase()
  if (text.includes('just now') || text.includes('moment')) {
    return new Date(now.getTime() - 5 * 60 * 1000)
  }
  const minuteMatch = text.match(/(\d+)\s*m/)
  if (minuteMatch) return new Date(now.getTime() - parseInt(minuteMatch[1]) * 60 * 1000)
  const hourMatch = text.match(/(\d+)\s*h/)
  if (hourMatch) return new Date(now.getTime() - parseInt(hourMatch[1]) * 60 * 60 * 1000)
  const dayMatch = text.match(/(\d+)\s*d/)
  if (dayMatch) return new Date(now.getTime() - parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000)
  return new Date(now.getTime() - 12 * 60 * 60 * 1000)
}
