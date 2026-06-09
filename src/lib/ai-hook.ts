import {
  fetchServerSentEvents,
  useChat,
  createChatClientOptions,
} from '@tanstack/ai-react'
import type { InferChatMessages } from '@tanstack/ai-react'

const chatOptions = createChatClientOptions({
  connection: fetchServerSentEvents('/demo/api/ai/chat'),
})

export type ChatMessages = InferChatMessages<typeof chatOptions>

export const useDocsChat = () => useChat(chatOptions)
