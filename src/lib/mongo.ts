import { MongoClient } from 'mongodb'

let client: MongoClient | null = null

function getUri() {
  return process.env.MONGODB_URI ?? 'mongodb://localhost:27018/?directConnection=true'
}

export async function getDb() {
  if (!client) {
    client = new MongoClient(getUri())
  }

  // Reconnect if the topology was closed after a previous failure
  try {
    await client.db('admin').command({ ping: 1 })
  } catch {
    await client.close().catch(() => {})
    client = new MongoClient(getUri())
    await client.connect()
  }

  return client.db('tanstack')
}
