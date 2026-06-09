import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Send, Square } from 'lucide-react'
import { Streamdown } from 'streamdown'

import { useDocsChat } from '#/lib/ai-hook'
import type { ChatMessages } from '#/lib/ai-hook'

import './ai-chat.css'

function InitialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="text-center max-w-3xl mx-auto w-full">
        <h1 className="text-5xl font-bold mb-4 bg-linear-to-r from-(--lagoon) to-(--palm) text-transparent bg-clip-text">
          TanStack AI Docs Chat
        </h1>
        <p className="text-gray-400 mb-6 w-2/3 mx-auto text-lg">
          Ask anything about TanStack AI — powered by RAG with MongoDB
          autoEmbed vector search.
        </p>
        {children}
      </div>
    </div>
  )
}

function ChattingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-(--lagoon)/10 z-10">
      <div className="max-w-3xl mx-auto w-full px-4 py-3">{children}</div>
    </div>
  )
}

function Messages({ messages }: { messages: ChatMessages }) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  if (!messages.length) {
    return null
  }

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto pb-4 min-h-0"
    >
      <div className="max-w-3xl mx-auto w-full px-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 ${
              message.role === 'assistant'
                ? 'bg-linear-to-r from-(--lagoon)/5 to-(--palm)/5'
                : 'bg-transparent'
            }`}
          >
            <div className="flex items-start gap-4 max-w-3xl mx-auto w-full">
              {message.role === 'assistant' ? (
                <div className="w-8 h-8 rounded-lg bg-linear-to-r from-(--lagoon) to-(--palm) mt-2 flex items-center justify-center text-sm font-medium text-white shrink-0">
                  AI
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center text-sm font-medium text-white shrink-0">
                  Y
                </div>
              )}
              <div className="flex-1 min-w-0">
                {message.parts.map((part, index) => {
                  if (part.type === 'text' && part.content) {
                    return (
                      <div
                        className="flex-1 min-w-0 prose dark:prose-invert max-w-none prose-sm"
                        key={index}
                      >
                        <Streamdown>{part.content}</Streamdown>
                      </div>
                    )
                  }
                  if (part.type === 'tool-call' && part.name === 'searchDocs') {
                    const results = part.output as
                      | Array<{ title: string; section: string; score: number }>
                      | undefined
                    return (
                      <details
                        key={part.id}
                        className="my-2 rounded-lg border border-(--lagoon)/20 bg-(--lagoon)/5 overflow-hidden"
                      >
                        <summary className="cursor-pointer px-3 py-2 text-xs text-gray-400 select-none flex items-center gap-2">
                          <svg
                            className="w-3.5 h-3.5 shrink-0 text-(--lagoon)"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                          <span>
                            searchDocs({'"'}
                            {(part.input as any)?.query ?? '…'}
                            {'"'})
                            {results
                              ? ` → ${results.length} result${results.length !== 1 ? 's' : ''}`
                              : ' …'}
                          </span>
                        </summary>
                        {results && results.length > 0 && (
                          <div className="border-t border-(--lagoon)/10 px-3 py-2 space-y-1.5">
                            {results.map((r, i) => (
                              <div
                                key={i}
                                className="flex items-baseline gap-2 text-xs"
                              >
                                <span className="inline-block rounded-full border border-(--lagoon)/30 bg-(--lagoon)/10 px-1.5 py-0.5 text-[10px] font-semibold text-(--lagoon) shrink-0">
                                  {r.section}
                                </span>
                                <span className="text-gray-300 truncate">
                                  {r.title}
                                </span>
                                <span className="ml-auto text-gray-500 shrink-0">
                                  {(r.score * 100).toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </details>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatPage() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, isLoading, stop } = useDocsChat()

  const Layout = messages.length ? ChattingLayout : InitialLayout

  return (
    <div className="relative flex h-[calc(100vh-80px)] bg-gray-900">
      <div className="flex-1 flex flex-col min-h-0">
        <Messages messages={messages} />

        <Layout>
          <div className="space-y-3">
            {isLoading && (
              <div className="flex items-center justify-center">
                <button
                  onClick={stop}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (input.trim()) {
                  sendMessage(input)
                  setInput('')
                }
              }}
            >
              <div className="relative max-w-xl mx-auto">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about TanStack AI…"
                  className="w-full rounded-lg border border-(--lagoon)/20 bg-gray-800/50 pl-4 pr-12 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-(--lagoon)/50 focus:border-transparent resize-none overflow-hidden shadow-lg"
                  rows={1}
                  style={{ minHeight: '44px', maxHeight: '200px' }}
                  disabled={isLoading}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height =
                      Math.min(target.scrollHeight, 200) + 'px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                      e.preventDefault()
                      sendMessage(input)
                      setInput('')
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-(--lagoon) hover:text-(--lagoon-deep) disabled:text-gray-500 transition-colors focus:outline-none"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </Layout>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/demo/ai-chat')({
  component: ChatPage,
})
