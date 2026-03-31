import { useState, useCallback, useEffect, useRef } from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  properties?: any[]
  projects?: any[]
  dataCards?: any[]
  data?: any
  requestId?: string
  provenance?: {
    run_id: string
    snapshot_ts: string
  }
}

export function useAIChat(mode: 'public' | 'broker' = 'public') {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastProperties, setLastProperties] = useState<any[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [lastProvenance, setLastProvenance] = useState<Message['provenance'] | null>(null)
  const [lastRequestId, setLastRequestId] = useState<string | null>(null)
  const isSendingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (mode !== 'broker') return
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/ai/history')
        if (!response.ok) return
        const data = await response.json()
        if (data?.latest?.messages) {
          const hydrated = data.latest.messages.map((message: any) => ({
            id: message.id || `${message.timestamp}-${message.role}`,
            role: message.role,
            content: message.content,
            timestamp: new Date(message.timestamp)
          }))
          setMessages(hydrated)
          setConversationId(data.latest.id)
        }
      } catch {
        // ignore history failures
      }
    }
    loadHistory()
  }, [mode])

  const sendMessage = useCallback(async (content: string, options?: { isMobile?: boolean }) => {
    const trimmed = content.trim()
    if (!trimmed) return
    if (isSendingRef.current) return
    isSendingRef.current = true

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)
    setLastProperties([])

    try {
      const endpoint = mode === 'public' ? '/api/ai/chat' : '/api/ai/broker-chat'
      const historyPayload = [...messagesRef.current, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: historyPayload,
          conversationId,
          isMobile: options?.isMobile ?? false,
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to get response')
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || data.reply,
        timestamp: new Date(),
        properties: data.properties,
        projects: data.projects,
        dataCards: data.dataCards || data.properties,
        data: data.data,
        requestId: data.requestId,
        provenance: data.provenance
      }

      setMessages(prev => [...prev, assistantMessage])
      if (data?.conversationId) {
        setConversationId(data.conversationId)
      }
      if (data.properties) {
        setLastProperties(data.properties)
      }
      if (data.provenance) setLastProvenance(data.provenance)
      if (data.requestId) setLastRequestId(data.requestId)
    } catch (err) {
      console.error('[v0] Chat error:', err)
      const message = err instanceof Error ? err.message : 'Failed to send message. Please try again.'
      const isUnauthorized = /unauthorized|401/i.test(message)
      setError(
        isUnauthorized
          ? 'Your CRM session expired. Please sign in again to continue using AI.'
          : message
      )
      const fallbackContent = isUnauthorized
        ? 'Your CRM session has expired. Please sign in again at /crm/login, then retry your request.'
        : mode === 'broker'
          ? 'ORE AI is temporarily unavailable. Please try again shortly, or use the CRM directly for leads, listings, and project updates.'
          : 'I’m having trouble connecting to ORE AI right now. Tell me your budget, preferred area, and unit type, then share your name + phone so an ORE advisor can send a tailored shortlist.'
      const fallbackMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: fallbackContent,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, fallbackMessage])
    } finally {
      setIsLoading(false)
      isSendingRef.current = false
    }
  }, [mode, conversationId])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    setLastProperties([])
    setLastProvenance(null)
    setLastRequestId(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    lastProperties,
    lastProvenance,
    lastRequestId,
    sendMessage,
    clearMessages
  }
}
