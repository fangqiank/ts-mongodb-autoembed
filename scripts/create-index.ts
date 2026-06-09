import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27018/?directConnection=true'
const client = new MongoClient(uri)
await client.connect()

const collection = client.db('tanstack').collection('docs')

const index = {
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
}

await collection.createSearchIndex(index)
console.log('Created autoEmbed index: docs_autoembed')

await client.close()
