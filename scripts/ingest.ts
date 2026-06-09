import { MongoClient } from 'mongodb'
import matter from 'gray-matter'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS_DIR = process.env.DOCS_DIR ?? fileURLToPath(new URL('../.cache/tanstack-ai/docs', import.meta.url))

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27018/?directConnection=true'
const client = new MongoClient(uri)
await client.connect()

const collection = client.db('tanstack').collection('docs')

async function walkDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)))
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  return files
}

const files = await walkDir(DOCS_DIR)
console.log(`Found ${files.length} markdown files`)

const docs = await Promise.all(
  files.map(async (filePath) => {
    const raw = await readFile(filePath, 'utf-8')
    const { data: frontmatter, content } = matter(raw)
    const relPath = relative(DOCS_DIR, filePath)
    const section = relPath.split('/')[0]
    const slug = relPath.replace(/\.md$/, '')

    return {
      slug,
      title: frontmatter.title || basename(filePath, '.md'),
      section,
      content: content.trim(),
      path: relPath,
      order: frontmatter.order ?? null,
      ingestedAt: new Date(),
    }
  }),
)

const ops = docs.map((doc) => ({
  updateOne: {
    filter: { slug: doc.slug },
    update: { $set: doc },
    upsert: true,
  },
}))

const result = await collection.bulkWrite(ops)
console.log(
  `Upserted ${result.upsertedCount} new, modified ${result.modifiedCount} existing`,
)

await client.close()
