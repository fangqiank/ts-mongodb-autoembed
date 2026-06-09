import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI env var is required')

async function main() {
  const client = new MongoClient(uri)
  await client.connect()
  console.log('Connected to MongoDB Atlas')

  const db = client.db('tanstack')

  // Step 1: Create collection if not exists
  const cols = await db.listCollections({ name: 'docs' }).toArray()
  if (cols.length === 0) {
    await db.createCollection('docs')
    console.log('Created collection: tanstack.docs')
  } else {
    console.log('Collection tanstack.docs already exists')
  }

  // Step 2: Create autoEmbed vector search index
  const collection = db.collection('docs')
  const indexes = await collection.listSearchIndexes().toArray()
  const existing = indexes.find((i) => i.name === 'docs_autoembed')

  if (existing) {
    console.log('Index docs_autoembed already exists, status:', existing.status)
  } else {
    await collection.createSearchIndex({
      name: 'docs_autoembed',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'autoEmbed',
            path: 'content',
            model: 'voyage-4',
            modality: 'text',
          },
          {
            type: 'filter',
            path: 'section',
          },
        ],
      },
    })
    console.log('Created autoEmbed vector search index: docs_autoembed')
    console.log('Note: Index may take a few minutes to become READY on Atlas')
  }

  await client.close()
  console.log('Setup complete!')
}

main().catch((err) => {
  console.error('Setup failed:', err)
  process.exit(1)
})
