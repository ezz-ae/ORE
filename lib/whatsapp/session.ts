/**
 * Baileys WhatsApp session manager.
 *
 * Maintains a single persistent WhatsApp WebSocket connection for the whole
 * Next.js process. Works in `next dev` and any long-running Node.js server.
 *
 * NOTE: Serverless deployments (Vercel Functions) cannot maintain a persistent
 * WebSocket between invocations. For Vercel, run this as a separate Node.js
 * microservice and call it via internal API. For self-hosted / Railway / Fly /
 * Docker this runs perfectly in-process.
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  proto,
  type WASocket,
  type ConnectionState,
  type BaileysEventMap,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import QRCode from 'qrcode'
import path from 'path'
import fs from 'fs'

// ── Types ────────────────────────────────────────────────────────────────────

export type WAStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected'

export interface WAStoredMessage {
  id: string
  from: string            // full JID e.g. 971501234567@s.whatsapp.net
  to: string
  body: string
  timestamp: number       // unix seconds
  fromMe: boolean
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'error'
  type: 'text' | 'image' | 'document' | 'audio' | 'sticker' | 'unknown'
}

export interface SessionState {
  status: WAStatus
  qrDataUrl: string | null    // base64 PNG
  connectedPhone: string | null
  connectedName: string | null
}

// ── In-memory message store ──────────────────────────────────────────────────
// key = normalised phone (digits only), value = messages sorted by timestamp

const messageStore = new Map<string, WAStoredMessage[]>()
const messageListeners: Set<(msg: WAStoredMessage) => void> = new Set()

function phoneKey(jid: string): string {
  return jid.replace(/[^0-9]/g, '')
}

function storeMessage(msg: WAStoredMessage) {
  const key = phoneKey(msg.fromMe ? msg.to : msg.from)
  const existing = messageStore.get(key) ?? []
  // deduplicate by id
  if (!existing.find((m) => m.id === msg.id)) {
    existing.push(msg)
    existing.sort((a, b) => a.timestamp - b.timestamp)
    messageStore.set(key, existing)
    messageListeners.forEach((cb) => cb(msg))
  }
}

export function getMessages(phone: string): WAStoredMessage[] {
  return messageStore.get(phone.replace(/\D/g, '')) ?? []
}

export function onMessage(cb: (msg: WAStoredMessage) => void): () => void {
  messageListeners.add(cb)
  return () => messageListeners.delete(cb)
}

// ── Session singleton ─────────────────────────────────────────────────────────

const AUTH_DIR = path.join(process.cwd(), '.whatsapp-auth')

let socket: WASocket | null = null
let sessionState: SessionState = {
  status: 'disconnected',
  qrDataUrl: null,
  connectedPhone: null,
  connectedName: null,
}
let connectPromise: Promise<void> | null = null

export function getSessionState(): SessionState {
  return { ...sessionState }
}

function parseMessageBody(msg: proto.IMessage | null | undefined): { body: string; type: WAStoredMessage['type'] } {
  if (!msg) return { body: '', type: 'unknown' }
  if (msg.conversation) return { body: msg.conversation, type: 'text' }
  if (msg.extendedTextMessage?.text) return { body: msg.extendedTextMessage.text, type: 'text' }
  if (msg.imageMessage?.caption) return { body: msg.imageMessage.caption, type: 'image' }
  if (msg.imageMessage) return { body: '[Image]', type: 'image' }
  if (msg.documentMessage) return { body: `[Document: ${msg.documentMessage.fileName ?? 'file'}]`, type: 'document' }
  if (msg.audioMessage) return { body: '[Voice message]', type: 'audio' }
  if (msg.stickerMessage) return { body: '[Sticker]', type: 'sticker' }
  return { body: '', type: 'unknown' }
}

export async function startSession(): Promise<void> {
  if (connectPromise) return connectPromise

  connectPromise = (async () => {
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()

    sessionState = { ...sessionState, status: 'connecting', qrDataUrl: null }

    socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, { level: 'silent' } as Parameters<typeof makeCacheableSignalKeyStore>[1]),
      },
      printQRInTerminal: false,
      logger: { level: 'silent' } as Parameters<typeof makeWASocket>[0]['logger'],
      getMessage: async () => undefined,
    })

    socket.ev.on('creds.update', saveCreds)

    socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        const dataUrl = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'L', margin: 1, width: 280 })
        sessionState = { ...sessionState, status: 'qr_ready', qrDataUrl: dataUrl }
      }

      if (connection === 'open') {
        const me = socket?.authState.creds.me
        sessionState = {
          status: 'connected',
          qrDataUrl: null,
          connectedPhone: me?.id?.split(':')[0] ?? null,
          connectedName: me?.name ?? null,
        }
        connectPromise = null
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = code !== DisconnectReason.loggedOut
        sessionState = { ...sessionState, status: 'disconnected', qrDataUrl: null }
        socket = null
        connectPromise = null
        if (shouldReconnect) {
          setTimeout(() => startSession(), 3000)
        }
      }
    })

    socket.ev.on('messages.upsert', (event: BaileysEventMap['messages.upsert']) => {
      for (const msg of event.messages) {
        if (!msg.message) continue
        if (isJidBroadcast(msg.key.remoteJid ?? '')) continue
        const jid = msg.key.remoteJid ?? ''
        const fromMe = msg.key.fromMe ?? false
        const { body, type } = parseMessageBody(msg.message)
        if (!body) continue

        storeMessage({
          id: msg.key.id ?? `${Date.now()}`,
          from: fromMe ? (socket?.user?.id ?? '') : jid,
          to: fromMe ? jid : (socket?.user?.id ?? ''),
          body,
          timestamp: msg.messageTimestamp as number ?? Math.floor(Date.now() / 1000),
          fromMe,
          status: fromMe ? 'sent' : 'read',
          type,
        })
      }
    })

    // message status updates
    socket.ev.on('messages.update', (updates) => {
      for (const update of updates) {
        if (!update.key.id) continue
        const jid = update.key.remoteJid ?? ''
        const key = phoneKey(jid)
        const stored = messageStore.get(key)
        if (!stored) continue
        const msg = stored.find((m) => m.id === update.key.id)
        if (msg && update.update.status !== undefined) {
          const s = update.update.status
          msg.status =
            s === 2 ? 'sent' :
            s === 3 ? 'delivered' :
            s === 4 ? 'read' : msg.status
        }
      }
    })
  })()

  return connectPromise
}

export async function sendMessage(to: string, body: string): Promise<WAStoredMessage> {
  if (!socket || sessionState.status !== 'connected') {
    throw new Error('WhatsApp not connected')
  }
  const jid = `${to.replace(/\D/g, '')}@s.whatsapp.net`
  const sent = await socket.sendMessage(jid, { text: body })

  const msg: WAStoredMessage = {
    id: sent?.key.id ?? `local_${Date.now()}`,
    from: socket.user?.id ?? '',
    to: jid,
    body,
    timestamp: Math.floor(Date.now() / 1000),
    fromMe: true,
    status: 'sent',
    type: 'text',
  }
  storeMessage(msg)
  return msg
}

export async function disconnectSession(): Promise<void> {
  if (socket) {
    await socket.logout()
    socket = null
  }
  sessionState = { status: 'disconnected', qrDataUrl: null, connectedPhone: null, connectedName: null }
  connectPromise = null
  // clear auth files
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
  }
}
