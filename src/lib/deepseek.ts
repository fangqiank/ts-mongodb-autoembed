import { BaseTextAdapter } from '@tanstack/ai/adapters'
import type {
  ContentPart,
  JSONSchema,
  ModelMessage,
  StreamChunk,
  TextOptions,
  Tool,
} from '@tanstack/ai'
import type {
  StructuredOutputOptions,
  StructuredOutputResult,
} from '@tanstack/ai/adapters'

export const DEEPSEEK_MODEL = 'deepseek-chat' as const
const DEEPSEEK_CHAT_COMPLETIONS_URL =
  'https://api.deepseek.com/chat/completions'

type DeepSeekToolCall = {
  id: string
  name: string
  args: string
  started: boolean
}

type FinishReason = Extract<StreamChunk, { type: 'RUN_FINISHED' }>['finishReason']

class DeepSeekChatCompletionsAdapter extends BaseTextAdapter<
  string,
  Record<string, unknown>,
  readonly ['text'],
  {
    text: unknown
    image: unknown
    audio: unknown
    video: unknown
    document: unknown
  }
> {
  readonly name = 'deepseek'

  constructor(
    private readonly apiKey: string,
    model: string,
  ) {
    super({}, model)
  }

  async *chatStream(
    options: TextOptions<Record<string, unknown>>,
  ): AsyncIterable<StreamChunk> {
    const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages: toDeepSeekMessages(options),
        stream: true,
        temperature: options.temperature,
        top_p: options.topP,
        max_tokens: options.maxTokens,
        tools: toDeepSeekTools(options.tools),
      }),
      signal: options.request?.signal,
    })

    if (!response.ok) {
      throw new Error(
        `DeepSeek chat completions request failed: ${response.status} ${response.statusText}`.trim(),
      )
    }

    if (!response.body) {
      throw new Error('DeepSeek chat completions response did not include a body')
    }

    const runId = this.generateId()
    const messageId = this.generateId()
    const timestamp = Date.now()
    const toolCalls = new Map<number, DeepSeekToolCall>()
    let textStarted = false
    let textContent = ''
    let finishReason: FinishReason = null

    yield {
      type: 'RUN_STARTED',
      runId,
      model: options.model,
      timestamp,
    }

    for await (const data of readServerSentEvents(response.body)) {
      if (data === '[DONE]') break

      const chunk = JSON.parse(data) as {
        choices?: Array<{
          delta?: {
            content?: string | null
            tool_calls?: Array<{
              index: number
              id?: string
              function?: {
                name?: string
                arguments?: string
              }
            }>
          }
          finish_reason?: string | null
        }>
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
        }
      }

      const choice = chunk.choices?.[0]
      if (!choice) continue

      const contentDelta = choice.delta?.content
      if (contentDelta) {
        if (!textStarted) {
          textStarted = true
          yield {
            type: 'TEXT_MESSAGE_START',
            messageId,
            model: options.model,
            timestamp,
            role: 'assistant',
          }
        }
        textContent += contentDelta
        yield {
          type: 'TEXT_MESSAGE_CONTENT',
          messageId,
          model: options.model,
          timestamp,
          delta: contentDelta,
          content: textContent,
        }
      }

      for (const toolCallDelta of choice.delta?.tool_calls ?? []) {
        const index = toolCallDelta.index
        const existing = toolCalls.get(index)
        const current =
          existing ??
          ({
            id: toolCallDelta.id ?? this.generateId(),
            name: toolCallDelta.function?.name ?? '',
            args: '',
            started: false,
          } satisfies DeepSeekToolCall)

        current.id = toolCallDelta.id ?? current.id
        current.name = toolCallDelta.function?.name ?? current.name
        current.args += toolCallDelta.function?.arguments ?? ''

        if (!current.started && current.name) {
          current.started = true
          yield {
            type: 'TOOL_CALL_START',
            toolCallId: current.id,
            toolName: current.name,
            model: options.model,
            timestamp,
            index,
          }
        }

        if (toolCallDelta.function?.arguments) {
          yield {
            type: 'TOOL_CALL_ARGS',
            toolCallId: current.id,
            model: options.model,
            timestamp,
            delta: toolCallDelta.function.arguments,
          }
        }

        toolCalls.set(index, current)
      }

      if (choice.finish_reason) {
        finishReason = mapFinishReason(choice.finish_reason)
      }
    }

    if (textStarted) {
      yield {
        type: 'TEXT_MESSAGE_END',
        messageId,
        model: options.model,
        timestamp,
      }
    }

    for (const toolCall of toolCalls.values()) {
      yield {
        type: 'TOOL_CALL_END',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        model: options.model,
        timestamp,
        input: parseToolArgs(toolCall.args),
      }
    }

    yield {
      type: 'RUN_FINISHED',
      runId,
      model: options.model,
      timestamp,
      finishReason:
        finishReason ??
        (toolCalls.size > 0 ? 'tool_calls' : 'stop'),
    }
  }

  async structuredOutput(
    _options: StructuredOutputOptions<Record<string, unknown>>,
  ): Promise<StructuredOutputResult<unknown>> {
    throw new Error('DeepSeek structured output is not implemented')
  }
}

export function deepseekAdapter(model: string = DEEPSEEK_MODEL) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required to use the DeepSeek provider')
  }

  return new DeepSeekChatCompletionsAdapter(apiKey, model)
}

function toDeepSeekMessages(options: TextOptions<Record<string, unknown>>) {
  return [
    ...(options.systemPrompts?.length
      ? [{ role: 'system', content: options.systemPrompts.join('\n') }]
      : []),
    ...options.messages.map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'tool',
          content: serializeMessageContent(message.content),
          tool_call_id: message.toolCallId,
        }
      }

      const result: Record<string, unknown> = {
        role: message.role,
        content: serializeMessageContent(message.content),
      }

      if (message.role === 'assistant' && message.toolCalls?.length) {
        result.tool_calls = message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          },
        }))
      }

      return result
    }),
  ]
}

function serializeMessageContent(messageContent: ModelMessage['content']) {
  if (messageContent === null) return null
  if (typeof messageContent === 'string') return messageContent

  return messageContent
    .filter((part): part is ContentPart & { type: 'text' } => part.type === 'text')
    .map((part) => part.content)
    .join('')
}

function toDeepSeekTools(tools: Array<Tool> | undefined) {
  if (!tools?.length) return undefined

  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: (tool.inputSchema ?? {
        type: 'object',
        properties: {},
      }) as JSONSchema,
    },
  }))
}

async function* readServerSentEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n\r?\n/)
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      for (const line of part.split(/\r?\n/)) {
        if (line.startsWith('data: ')) {
          yield line.slice(6).trim()
        }
      }
    }
  }

  buffer += decoder.decode()
  for (const line of buffer.split(/\r?\n/)) {
    if (line.startsWith('data: ')) {
      yield line.slice(6).trim()
    }
  }
}

function mapFinishReason(reason: string) {
  if (reason === 'tool_calls') return 'tool_calls'
  if (reason === 'length') return 'length'
  if (reason === 'content_filter') return 'content_filter'
  return 'stop'
}

function parseToolArgs(args: string) {
  if (!args.trim()) return {}

  try {
    return JSON.parse(args)
  } catch {
    return {}
  }
}
