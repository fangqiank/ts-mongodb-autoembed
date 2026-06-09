import { getDb } from './mongo'
import type { SearchResult } from './vector-search'

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function keywordSearch(opts: {
  query: string
  section?: string
  limit: number
  contentChars: number
}): Promise<SearchResult[]> {
  const db = await getDb()
  const escaped = escapeRegex(opts.query)

  const match: Record<string, unknown> = {
    $or: [
      { title: { $regex: escaped, $options: 'i' } },
      { content: { $regex: escaped, $options: 'i' } },
    ],
  }
  if (opts.section) match.section = opts.section

  const results = await db
    .collection('docs')
    .aggregate([
      { $match: match },
      {
        $addFields: {
          score: {
            $cond: [
              { $regexMatch: { input: '$title', regex: escaped, options: 'i' } },
              1,
              0.5,
            ],
          },
        },
      },
      { $sort: { score: -1, title: 1 } },
      { $limit: opts.limit },
      {
        $project: {
          title: 1,
          section: 1,
          slug: 1,
          content: { $substrCP: ['$content', 0, opts.contentChars] },
          score: 1,
        },
      },
    ])
    .toArray()

  return results.map((doc) => ({
    _id: doc._id?.toString() ?? '',
    title: doc.title as string,
    section: doc.section as string,
    slug: doc.slug as string,
    content: doc.content as string,
    score: doc.score as number,
  }))
}
