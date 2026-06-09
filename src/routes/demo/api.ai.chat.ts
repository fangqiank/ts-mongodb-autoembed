import { createFileRoute } from '@tanstack/react-router'
import { chat, maxIterations, toServerSentEventsResponse } from '@tanstack/ai'
import { deepseekAdapter, DEEPSEEK_MODEL } from '#/lib/deepseek'

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about TanStack AI.

You have access to a searchDocs tool that performs semantic search across the TanStack AI documentation. Use it whenever the user asks about TanStack AI features, APIs, configuration, guides, adapters, streaming, tools, middleware, or any related topic.

Guidelines:
- ALWAYS search the docs before answering technical questions
- Cite which doc page your answer came from (use the title and section)
- If the search returns relevant results, synthesize them into a clear answer
- If no results are relevant, say so honestly
- You can make multiple searches if the first one doesn't cover the full question
- Keep answers concise but thorough
`

export const Route = createFileRoute('/demo/api/ai/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { searchDocsTool } = await import('#/lib/search-tools')

        const requestSignal = request.signal

        if (requestSignal.aborted) {
          return new Response(null, { status: 499 })
        }

        const abortController = new AbortController()

        try {
          const body = await request.json()
          const { messages } = body

          const stream = chat({
            adapter: deepseekAdapter(DEEPSEEK_MODEL),
            tools: [searchDocsTool],
            systemPrompts: [SYSTEM_PROMPT],
            agentLoopStrategy: maxIterations(5),
            messages,
            abortController,
          })

          return toServerSentEventsResponse(stream, { abortController })
        } catch (error: any) {
          if (error.name === 'AbortError' || abortController.signal.aborted) {
            return new Response(null, { status: 499 })
          }
          return new Response(
            JSON.stringify({ error: 'Failed to process chat request' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
