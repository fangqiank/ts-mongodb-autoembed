import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// Server function for the search UI page
export const searchDocs = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      query: z.string().min(1),
      section: z.string().optional(),
      limit: z.number().default(10),
    }),
  )
  .handler(async ({ data }) => {
    const { vectorSearch } = await import('./vector-search')
    return vectorSearch({
      query: data.query,
      section: data.section,
      limit: data.limit,
      contentChars: 300,
    })
  })

// Server function for case-insensitive keyword (text) search
export const keywordSearchDocs = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      query: z.string().min(1),
      section: z.string().optional(),
      limit: z.number().default(10),
    }),
  )
  .handler(async ({ data }) => {
    const { keywordSearch } = await import('./keyword-search')
    return keywordSearch({
      query: data.query,
      section: data.section,
      limit: data.limit,
      contentChars: 300,
    })
  })

// Server function for the expand-to-read-full-doc feature
export const getDocContent = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { getDb } = await import('./mongo')
    const db = await getDb()
    const doc = await db.collection('docs').findOne(
      { slug: data.slug },
      { projection: { content: 1 } },
    )
    return doc?.content as string | null
  })
