// WhatsApp conversation data and types

export type WAMessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending'
export type WAMessageType = 'text' | 'template' | 'image' | 'document' | 'audio'
export type WAMessageDirection = 'inbound' | 'outbound'

export interface WAMessage {
  id: string
  direction: WAMessageDirection
  type: WAMessageType
  body: string
  timestamp: string       // ISO string
  status: WAMessageStatus
  mediaUrl?: string
  templateName?: string
}

export interface WAExtractedData {
  budget: string | null
  budgetMin: number | null
  budgetMax: number | null
  location: string | null
  propertyType: string | null
  bedrooms: string | null
  timeline: string | null
  paymentMethod: string | null
  nationality: string | null
  purpose: 'investment' | 'end_use' | 'unknown'
  confidence: number // 0-100
}

export interface WAConversation {
  leadId: string
  leadName: string
  phone: string
  messages: WAMessage[]
  extractedData: WAExtractedData
  lastActivity: string
  status: 'active' | 'waiting_reply' | 'resolved' | 'unread'
  notebookEntryId: string | null
}

// ── Mock conversation data ────────────────────────────────────────────────────

export const waConversations: WAConversation[] = [
  {
    leadId: 'lead_001',
    leadName: 'Khalid Al Mansoori',
    phone: '+971501234567',
    status: 'active',
    lastActivity: '2026-06-06T10:30:00Z',
    notebookEntryId: null,
    extractedData: {
      budget: 'AED 2M–3.5M',
      budgetMin: 2_000_000,
      budgetMax: 3_500_000,
      location: 'Dubai Hills / MBR City',
      propertyType: 'apartment',
      bedrooms: '2–3',
      timeline: 'Q4 2026',
      paymentMethod: '60/40 post-handover',
      nationality: 'UAE',
      purpose: 'investment',
      confidence: 82,
    },
    messages: [
      {
        id: 'msg_001',
        direction: 'inbound',
        type: 'text',
        body: 'السلام عليكم، أنا مهتم بشراء شقة في دبي للاستثمار. ما هي المشاريع المتاحة؟',
        timestamp: '2026-06-04T09:15:00Z',
        status: 'read',
      },
      {
        id: 'msg_002',
        direction: 'outbound',
        type: 'text',
        body: 'وعليكم السلام! أهلاً بك. يسعدنا مساعدتك. لدينا عدد من المشاريع الرائعة للاستثمار في دبي. ما هو ميزانيتك التقريبية؟',
        timestamp: '2026-06-04T09:22:00Z',
        status: 'read',
      },
      {
        id: 'msg_003',
        direction: 'inbound',
        type: 'text',
        body: 'أفكر في ميزانية بين 2 مليون و3.5 مليون درهم. أريد منطقة جيدة للإيجار مثل دبي هيلز أو MBR City.',
        timestamp: '2026-06-04T09:45:00Z',
        status: 'read',
      },
      {
        id: 'msg_004',
        direction: 'outbound',
        type: 'text',
        body: 'ممتاز! في هذه الميزانية لدينا خيارات رائعة في Dubai Hills Estate. مشروع Dubai Hills Garden Estate يبدأ من 1.58M بخطة دفع 60/40 مع تسليم Q3 2028. العائد المتوقع 6.4%. هل أنت مهتم بغرفة أم غرفتين؟',
        timestamp: '2026-06-04T09:50:00Z',
        status: 'read',
      },
      {
        id: 'msg_005',
        direction: 'inbound',
        type: 'text',
        body: 'غرفتين أو ثلاث غرف. وفضلت خطة دفع بعد التسليم لأني لا أريد ضغط الدفع أثناء الإنشاء.',
        timestamp: '2026-06-04T10:05:00Z',
        status: 'read',
      },
      {
        id: 'msg_006',
        direction: 'outbound',
        type: 'text',
        body: 'بالتأكيد. لدي ثلاثة مشاريع تناسبك تماماً:\n\n1️⃣ *Dubai Hills Garden Estate* — 2BR من 1.58M · خطة 60/40\n2️⃣ *Sobha District Edge* — 2BR من 1.32M · خطة 60/40 مع escrow\n3️⃣ *Creek Harbour Viewpoint* — 2BR من 1.45M · خطة 60/40\n\nهل تريد أن أرسل لك ملف المشروع الكامل لأي منها؟',
        timestamp: '2026-06-04T10:12:00Z',
        status: 'read',
      },
      {
        id: 'msg_007',
        direction: 'inbound',
        type: 'text',
        body: 'يعجبني Dubai Hills Garden Estate. أرسل لي التفاصيل الكاملة. ومتى يمكن تحديد موعد لمشاهدة الموقع؟',
        timestamp: '2026-06-04T10:28:00Z',
        status: 'read',
      },
      {
        id: 'msg_008',
        direction: 'outbound',
        type: 'text',
        body: 'سأرسل لك الملف الآن. بخصوص الزيارة، نستطيع ترتيب موعد هذا الأسبوع. هل تفضل يوم الأربعاء أو الخميس؟',
        timestamp: '2026-06-04T10:30:00Z',
        status: 'read',
      },
      {
        id: 'msg_009',
        direction: 'inbound',
        type: 'text',
        body: 'الخميس يناسبني، في الساعة 5 مساءً.',
        timestamp: '2026-06-05T08:00:00Z',
        status: 'read',
      },
      {
        id: 'msg_010',
        direction: 'outbound',
        type: 'text',
        body: 'ممتاز! تم تأكيد الموعد: *الخميس 12 يونيو الساعة 5:00 مساءً*. سأرسل لك العنوان والموقع على الخريطة قبل يوم من الموعد. هل تحتاج أي معلومات إضافية؟',
        timestamp: '2026-06-05T08:10:00Z',
        status: 'read',
      },
      {
        id: 'msg_011',
        direction: 'inbound',
        type: 'text',
        body: 'شكراً. هل العائد على الاستثمار مضمون أم تقديري فقط؟',
        timestamp: '2026-06-06T10:25:00Z',
        status: 'read',
      },
      {
        id: 'msg_012',
        direction: 'inbound',
        type: 'text',
        body: 'وأيضاً هل يمكنني استخدام التمويل البنكي؟',
        timestamp: '2026-06-06T10:30:00Z',
        status: 'read',
      },
    ],
  },
  {
    leadId: 'lead_002',
    leadName: 'Sarah Thompson',
    phone: '+447911123456',
    status: 'waiting_reply',
    lastActivity: '2026-06-05T16:45:00Z',
    notebookEntryId: null,
    extractedData: {
      budget: 'AED 4M–8M',
      budgetMin: 4_000_000,
      budgetMax: 8_000_000,
      location: 'Palm Jumeirah / Marina',
      propertyType: 'apartment',
      bedrooms: '3',
      timeline: 'Ready now',
      paymentMethod: 'Full payment or mortgage',
      nationality: 'British',
      purpose: 'end_use',
      confidence: 74,
    },
    messages: [
      {
        id: 'msg_s001',
        direction: 'inbound',
        type: 'text',
        body: 'Hi, I saw your ad for properties in Dubai. I\'m interested in buying for personal use — ideally on the Palm or Marina. Budget is flexible, probably up to 6-7M AED.',
        timestamp: '2026-06-05T14:20:00Z',
        status: 'read',
      },
      {
        id: 'msg_s002',
        direction: 'outbound',
        type: 'text',
        body: 'Hello Sarah! Wonderful to hear from you. We have some incredible options on the Palm and Marina in your budget. Are you looking for a 2 or 3-bedroom? And are you planning to move in yourself or also considering rental income?',
        timestamp: '2026-06-05T14:35:00Z',
        status: 'read',
      },
      {
        id: 'msg_s003',
        direction: 'inbound',
        type: 'text',
        body: '3 bedroom ideally, mainly for personal use but open to renting it out when I\'m not there. We\'d be relocating from London — my husband works in finance.',
        timestamp: '2026-06-05T15:00:00Z',
        status: 'read',
      },
      {
        id: 'msg_s004',
        direction: 'outbound',
        type: 'text',
        body: 'Perfect profile for the Palm! We have ready-to-move 3BR on Palm Jumeirah from AED 4.8M with sea views and private beach access. Would you like to schedule a virtual tour first since you\'re currently in London?',
        timestamp: '2026-06-05T15:15:00Z',
        status: 'read',
      },
      {
        id: 'msg_s005',
        direction: 'inbound',
        type: 'text',
        body: 'Yes that would be great! We\'re actually coming to Dubai next month — 15th to 22nd July. Could we view in person then?',
        timestamp: '2026-06-05T16:45:00Z',
        status: 'delivered',
      },
    ],
  },
]

// Get conversation by lead ID
export function getWAConversation(leadId: string): WAConversation | null {
  return waConversations.find((c) => c.leadId === leadId) ?? null
}

// Get all conversations sorted by last activity
export function getAllWAConversations(): WAConversation[] {
  return [...waConversations].sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
  )
}
