import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deepseekAdapter } from './deepseek'

describe('deepseekAdapter', () => {
  const originalApiKey = process.env.DEEPSEEK_API_KEY

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalApiKey
    vi.restoreAllMocks()
  })

  it('uses the DeepSeek chat completions endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        toSse([
          {
            choices: [{ delta: { content: 'hello' }, finish_reason: null }],
          },
          {
            choices: [{ delta: {}, finish_reason: 'stop' }],
          },
        ]),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = deepseekAdapter()
    const chunks = []
    for await (const chunk of adapter.chatStream({
      model: adapter.model,
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      chunks.push(chunk)
    }

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock.mock.calls[0][1].body).toContain('"stream":true')
    expect(chunks.some((chunk) => chunk.type === 'TEXT_MESSAGE_CONTENT')).toBe(
      true,
    )
  })

  it('converts streamed function calls into TanStack AI tool events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          toSse([
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'call_1',
                        function: { name: 'searchDocs', arguments: '{"query"' },
                      },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            },
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        function: { arguments: ':"router"}' },
                      },
                    ],
                  },
                  finish_reason: 'tool_calls',
                },
              ],
            },
          ]),
          { status: 200 },
        ),
      ),
    )

    const adapter = deepseekAdapter()
    const chunks = []
    for await (const chunk of adapter.chatStream({
      model: adapter.model,
      messages: [{ role: 'user', content: 'Search docs' }],
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TOOL_CALL_START',
          toolCallId: 'call_1',
          toolName: 'searchDocs',
        }),
        expect.objectContaining({
          type: 'TOOL_CALL_END',
          toolCallId: 'call_1',
          input: { query: 'router' },
        }),
        expect.objectContaining({
          type: 'RUN_FINISHED',
          finishReason: 'tool_calls',
        }),
      ]),
    )
  })
})

function toSse(chunks: Array<unknown>) {
  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
    'data: [DONE]\n\n'
}
