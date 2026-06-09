import { getDb } from './mongo'

export type SearchResult = {
  _id: string
  title: string
  section: string
  slug: string
  content: string
  score: number
}

export async function vectorSearch(opts: {
  query: string
  section?: string
  limit: number
  contentChars: number
}): Promise<SearchResult[]> {
  const db = await getDb()

  const filter = opts.section
    ? { section: { $eq: opts.section } }
    : undefined

  const results = await db
    .collection('docs')
    .aggregate([
      {
        $vectorSearch: {
          index: 'docs_autoembed',
          path: 'content',
          query: { text: opts.query },
          model: 'voyage-4',
          numCandidates: 100,
          limit: opts.limit,
          ...(filter && { filter }),
        },
      },
      {
        $project: {
          title: 1,
          section: 1,
          slug: 1,
          content: { $substrCP: ['$content', 0, opts.contentChars] },
          score: { $meta: 'vectorSearchScore' },
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
