'use client'

import { useState } from 'react'
import type { CouncilEvidenceSource } from '@/lib/council-types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: CouncilEvidenceSource[]
  answerMode?: string
}

export function ChatWithPaper({ sessionId }: { sessionId: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  const askQuestion = async (nextQuestion?: string) => {
    const prompt = (nextQuestion ?? question).trim()
    if (!prompt || !sessionId || loading) return

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: prompt,
    }

    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setLoading(true)

    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt }),
      })
      const data = await res.json()

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.ok ? String(data.answer ?? '') : String(data.error ?? 'Failed to answer question'),
        citations: res.ok && Array.isArray(data.citations) ? data.citations : [],
        answerMode: res.ok ? String(data.answerMode ?? '') : '',
      }
      setMessages((current) => [...current, assistantMessage])
    } finally {
      setLoading(false)
    }
  }

  const suggestedQuestions = [
    'What is the main claim of this paper?',
    'What are the weakest methodological points?',
    'What evidence best supports the central contribution?',
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px 18px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 4 }}>
            Chat with Paper
          </div>
        </div>
      </div>

      <div style={{
        border: '1px solid #ebebed',
        borderRadius: 12,
        background: '#fff',
        padding: 14,
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {suggestedQuestions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => askQuestion(item)}
              disabled={!sessionId || loading}
              style={{
                border: '1px solid #e4e4e7',
                background: '#fafafa',
                color: '#52525b',
                borderRadius: 999,
                padding: '7px 10px',
                fontSize: 12,
                cursor: !sessionId || loading ? 'default' : 'pointer',
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingRight: 2,
      }}>
        {messages.length === 0 ? (
          <div style={{
            border: '1px dashed #e4e4e7',
            borderRadius: 12,
            padding: '24px 18px',
            textAlign: 'center',
            color: '#a1a1aa',
            fontSize: 13,
            lineHeight: 1.7,
            background: '#fafafa',
          }}>
            Ask a question to inspect the paper without rerunning the full debate.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                border: '1px solid #ebebed',
                borderRadius: 12,
                background: message.role === 'user' ? '#f5f5f7' : '#fff',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 7 }}>
                {message.role === 'user' ? 'You' : 'Council Paper Chat'}
              </div>
              <div style={{ fontSize: 13, color: '#27272a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {message.content}
              </div>
              {message.answerMode && message.role === 'assistant' && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#a1a1aa' }}>
                  mode: {message.answerMode}
                </div>
              )}
              {message.citations && message.citations.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {message.citations.map((citation, index) => (
                    <button
                      key={`${message.id}-${index}`}
                      type="button"
                      onClick={() => citation.uri && window.open(citation.uri, '_blank', 'noopener')}
                      style={{
                        textAlign: 'left',
                        border: '1px solid #ececf1',
                        background: '#fafafa',
                        borderRadius: 10,
                        padding: '9px 10px',
                        cursor: citation.uri ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#3f3f46', marginBottom: 4 }}>
                        {citation.label}
                      </div>
                      {citation.snippet && (
                        <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.55 }}>
                          {citation.snippet}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ paddingTop: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about claims, evidence, methods, or limitations..."
            rows={3}
            style={{
              flex: 1,
              border: '1px solid #e4e4e7',
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 13,
              color: '#18181b',
              resize: 'none',
              outline: 'none',
              background: '#fff',
            }}
          />
          <button
            type="button"
            onClick={() => askQuestion()}
            disabled={!sessionId || loading || !question.trim()}
            style={{
              alignSelf: 'stretch',
              border: 'none',
              borderRadius: 12,
              padding: '0 14px',
              background: !sessionId || loading || !question.trim() ? '#d4d4d8' : '#111827',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: !sessionId || loading || !question.trim() ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Asking...' : 'Ask'}
          </button>
        </div>
      </div>
    </div>
  )
}
